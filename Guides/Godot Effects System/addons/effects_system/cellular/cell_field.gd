@icon("res://addons/effects_system/icons/field.svg")
class_name CellField
extends Node3D
## A living layer over a 3D world, where effects are organisms instead of timers.
##
## The field divides space into voxels ([member cell_size] metres). Each voxel has
## a [Substrate] (what it's made of) and can hold one living cell of a [Strain]
## (fire, frost, spores, a mycelium network). Every simulation pass, each cell:[br]
## - [b]grows[/b]: a seed ripens before it can divide or infect;[br]
## - [b]feeds[/b] on its voxel's nutrients and pays its [b]metabolism[/b];[br]
## - [b]rests[/b] (goes dormant) when low on energy, and wakes when fed;[br]
## - [b]heals[/b] its wounds, spending energy;[br]
## - undergoes [b]mitosis[/b] when rich: it splits into a neighbouring voxel, after
##   that voxel is [b]checked[/b] (bounds, solid rock, a pond that blocks fire).[br]
## Running out of energy or wounds is [b]necrosis[/b]: the cell dies and the voxel
## may turn into the strain's residue (fire leaves ash). Every few seconds each
## [CellColony] is [b]judged[/b] (it may evolve, grow old or be severed from its
## root), and energy is [b]conserved[/b]: [method get_ledger] accounts for every unit.
##
## Entities with a [CellHost] catch strains as [Effect]s, carry their energy, shed
## it as they move and return it when they die. Strains that meet run a [Reaction].

signal cell_born(cell: Vector3i, strain: Strain, colony: CellColony)
## [param cause] is [code]&"starved"[/code], [code]&"wounds"[/code],
## [code]&"reaction"[/code] or [code]&"cleared"[/code].
signal cell_died(cell: Vector3i, strain: Strain, cause: StringName)
signal cell_wounded(cell: Vector3i, strain: Strain, wounds: int)
signal colony_founded(colony: CellColony)
## Every [member Strain.judge_interval] seconds. [param verdict] is
## [code]&"growing"[/code], [code]&"stable"[/code], [code]&"declining"[/code],
## [code]&"severed"[/code], [code]&"evolved"[/code], [code]&"senescent"[/code],
## or whatever a scripted [method Strain._judge] returns.
signal colony_judged(colony: CellColony, verdict: StringName)
signal colony_evolved(colony: CellColony, from: Strain, to: Strain)
## The colony's root cell died; its network is no longer supplied.
signal colony_severed(colony: CellColony)
signal colony_died(colony: CellColony)
signal reacted(cell: Vector3i, reaction: Reaction)
signal substrate_changed(cell: Vector3i, substrate: Substrate)
signal host_infected(host: CellHost, strain: Strain)
## A host died or left, and the energy it carried returned to the field.
signal host_released(host: CellHost, strain: Strain, energy: float)
signal pass_completed(pass_index: int)

enum UpdateMode {
	PHYSICS,
	IDLE,
	## Only [method simulate] moves time on.
	MANUAL,
}

const GROUP := &"cell_fields"
const _EPS := 0.0001
const _DIRECTIONS: Array[Vector3i] = [
	Vector3i(0, 1, 0), Vector3i(0, -1, 0),
	Vector3i(1, 0, 0), Vector3i(-1, 0, 0), Vector3i(0, 0, 1), Vector3i(0, 0, -1),
]
const _Renderer := preload("res://addons/effects_system/cellular/cell_renderer.gd")

## Edge length of a voxel in metres.
@export_range(0.05, 8.0, 0.05, "or_greater", "suffix:m") var cell_size: float = 0.5
## Field size in voxels. It is centred on this node in x and z, and grows upward from it.
@export var size: Vector3i = Vector3i(48, 16, 48)
## Simulation passes per second.
@export_range(1.0, 60.0, 0.5) var tick_rate: float = 8.0
## Most milliseconds per frame the simulation may use. When a pass doesn't fit,
## it is finished next frame: under load the world slows down (rests) instead
## of the game stuttering.
@export_range(0.1, 50.0, 0.1) var frame_budget_ms: float = 3.0
@export_range(1, 200000, 1, "or_greater") var max_cells: int = 4000
## World-space wind. Strains with [member Strain.wind_factor] lean into it.
@export var wind: Vector3 = Vector3.ZERO
@export var reactions: Array[Reaction] = []:
	set(value):
		reactions = value
		_reaction_cache.clear()
## Substrate of voxels nothing has painted. Null means empty air.
@export var default_substrate: Substrate
@export var update_mode: UpdateMode = UpdateMode.PHYSICS:
	set(value):
		update_mode = value
		if is_inside_tree():
			_update_processing()
## Fixed seed for repeatable runs (0 picks a random one).
@export var rng_seed: int = 0:
	set(value):
		rng_seed = value
		if value != 0:
			_rng.seed = value

@export_group("Rendering")
## Draw cells as voxels with the built-in shader, lights and particles.
@export var render_cells: bool = true
## Also draw painted substrates as voxels, so residue (ash, blight) shows up.
@export var render_substrates: bool = false
@export var cast_shadows: bool = false

## Optional [code]func(cell: Vector3i) -> Substrate[/code] for voxels nothing painted,
## so a voxel game can describe its own world. Results are cached; call
## [method refresh_substrates] after the world changes.
var substrate_provider: Callable

var _cells: Dictionary = {}
var _substrates: Dictionary = {}
var _provided: Dictionary = {}
var _eaten: Dictionary = {}
var _colonies: Dictionary = {}
var _hosts: Array[CellHost] = []
var _rng := RandomNumberGenerator.new()
var _reaction_cache: Dictionary = {}
var _weights_cache: Dictionary = {}
var _burst_times: Dictionary = {}
var _next_colony_id: int = 1
var _pass: int = 0
var _pass_open: bool = false
var _order: Array = []
var _cursor: int = 0
var _accumulator: float = 0.0
var _substrates_dirty: bool = true
var _substrate_changes: Array[Vector3i] = []
var _renderer: Node3D
var _ledger: Dictionary = {
	seeded = 0.0, fed = 0.0, generated = 0.0, metabolized = 0.0, lost = 0.0,
	to_hosts = 0.0, from_hosts = 0.0, host_dissipated = 0.0,
}


class _Cell:
	var strain: Strain
	var colony: CellColony
	var energy: float = 0.0
	var age: float = 0.0
	var wounds: int = 0
	var heal_timer: float = 0.0
	var dormant: bool = false
	var root: bool = false
	var connected: bool = false
	## Steps from the root at the last judgement (for the supply pulse).
	var depth: int = 0
	var flash: float = 0.0
	var born_pass: int = -1


func _enter_tree() -> void:
	add_to_group(GROUP)


func _ready() -> void:
	if rng_seed == 0:
		_rng.randomize()
	if render_cells or render_substrates:
		_renderer = _Renderer.new()
		_renderer.name = "CellRenderer"
		_renderer.field = self
		add_child(_renderer, false, Node.INTERNAL_MODE_FRONT)
	_update_processing()


func _physics_process(delta: float) -> void:
	_advance(delta, true)


func _process(delta: float) -> void:
	_advance(delta, true)


func _update_processing() -> void:
	set_physics_process(update_mode == UpdateMode.PHYSICS)
	set_process(update_mode == UpdateMode.IDLE)


# --- Time ------------------------------------------------------------------------

## Run whole passes covering [param seconds] of simulation, ignoring the frame
## budget. For tests, turn-based games and fast-forwarding.
func simulate(seconds: float) -> void:
	var passes := maxi(roundi(seconds * tick_rate), 0)
	if _pass_open:
		_continue_pass(-1)
		_finish_pass()
	for i in passes:
		_begin_pass()
		_continue_pass(-1)
		_finish_pass()


## Seconds of simulation per pass.
func get_step() -> float:
	return 1.0 / tick_rate


## Number of finished passes.
func get_pass_count() -> int:
	return _pass - (1 if _pass_open else 0)


func _advance(delta: float, budgeted: bool) -> void:
	var step := get_step()
	# Cap the backlog: a long hitch costs a few passes, not a death spiral.
	_accumulator = minf(_accumulator + delta, step * 4.0)
	var deadline := Time.get_ticks_usec() + int(frame_budget_ms * 1000.0) if budgeted else -1
	while true:
		if not _pass_open:
			if _accumulator < step:
				return
			_accumulator -= step
			_begin_pass()
		if not _continue_pass(deadline):
			return
		_finish_pass()


func _begin_pass() -> void:
	_pass += 1
	_pass_open = true
	_order = _cells.keys()
	_cursor = 0
	_weights_cache.clear()


func _continue_pass(deadline: int) -> bool:
	var dt := get_step()
	while _cursor < _order.size():
		var pos: Vector3i = _order[_cursor]
		_cursor += 1
		var cell: _Cell = _cells.get(pos)
		if cell != null and cell.born_pass != _pass:
			_update_cell(pos, cell, dt)
		if deadline >= 0 and (_cursor & 31) == 0 and Time.get_ticks_usec() > deadline:
			return false
	return true


func _finish_pass() -> void:
	var dt := get_step()
	_pass_open = false
	_order = []
	for host in _hosts.duplicate():
		if is_instance_valid(host) and host.is_inside_tree():
			_update_host(host, dt)
	for colony in _colonies.values():
		_update_colony(colony, dt)
	if _renderer != null:
		_renderer.refresh(_substrates_dirty, _substrate_changes)
	_substrates_dirty = false
	_substrate_changes.clear()
	pass_completed.emit(_pass)


# --- Seeding, wounding, clearing -------------------------------------------------

## Plant a cell of [param strain] at [param world_position]. With [param as_root]
## it founds a colony whose root pumps energy through the network. Returns the
## colony, or null if the voxel can't hold the strain. Seeding into another
## strain runs their [Reaction], if there is one.
func seed(strain: Strain, world_position: Vector3, energy: float = -1.0, as_root: bool = false) -> CellColony:
	return seed_cell(strain, world_to_cell(world_position), energy, as_root)


func seed_cell(strain: Strain, cell: Vector3i, energy: float = -1.0, as_root: bool = false) -> CellColony:
	if strain == null or not can_hold(cell, strain):
		return null
	if energy < 0.0:
		energy = strain.seed_energy
	_ledger.seeded += energy
	var other: _Cell = _cells.get(cell)
	if other != null:
		if other.strain == strain:
			# Reinforce the cell; a root seed promotes it if its colony has none.
			other.energy += energy
			_cap(other)
			if as_root and not other.colony.root_alive:
				other.root = true
				other.connected = true
				other.dormant = false
				other.colony.has_root = true
				other.colony.root = cell
				other.colony.root_alive = true
			return other.colony
		var reaction := get_reaction(strain, other.strain)
		if reaction == null:
			_ledger.metabolized += energy
			return null
		var incoming := _Cell.new()
		incoming.strain = strain
		incoming.energy = energy
		_react(reaction, cell, incoming, cell, other, true)
		var result: _Cell = _cells.get(cell)
		return result.colony if result != null else null
	if _cells.size() >= max_cells:
		_ledger.metabolized += energy
		return null
	var colony := _new_colony(strain) if as_root else _colony_near(strain, cell)
	var born := _spawn(cell, strain, colony, energy)
	if as_root:
		colony.has_root = true
		colony.root = cell
		colony.root_alive = true
		born.root = true
		born.connected = true
	return colony


## Seed every voxel within [param radius] metres that can hold the strain, or
## that holds a strain it reacts with. With [param only_where_food], empty voxels
## are seeded only if they have something for the strain to eat. With
## [param flat], only the layer of voxels at [param world_position] is seeded (a
## disc on the ground instead of a ball). Returns how many voxels were seeded.
func spray(strain: Strain, world_position: Vector3, radius: float, energy: float = -1.0,
		only_where_food: bool = false, flat: bool = false) -> int:
	var count := 0
	var cells := cells_in_disc(world_position, radius) if flat else cells_in_sphere(world_position, radius)
	for cell in cells:
		var occupant: _Cell = _cells.get(cell)
		if occupant == null and only_where_food:
			var substrate := get_substrate(cell)
			if strain.feeds_on == &"" or substrate == null or substrate.get_nutrient(strain.feeds_on) <= 0.0:
				continue
		elif occupant != null and occupant.strain != strain and get_reaction(strain, occupant.strain) == null:
			continue
		if seed_cell(strain, cell, energy) != null or occupant != null:
			count += 1
	return count


## Wound every cell within [param radius] metres (optionally only strains with
## [param tag]). Each wound also burns [param energy]. Returns how many were hit.
func wound_area(world_position: Vector3, radius: float, wounds: int = 1, energy: float = 2.0,
		tag: StringName = &"") -> int:
	var count := 0
	for cell in cells_in_sphere(world_position, radius):
		var target: _Cell = _cells.get(cell)
		if target != null and (tag == &"" or target.strain.has_tag(tag)):
			_wound(cell, target, wounds, energy)
			count += 1
	return count


## Kill every cell within [param radius] metres (optionally only strains with
## [param tag]). Returns how many died.
func clear_area(world_position: Vector3, radius: float, tag: StringName = &"") -> int:
	var count := 0
	for cell in cells_in_sphere(world_position, radius):
		var target: _Cell = _cells.get(cell)
		if target != null and (tag == &"" or target.strain.has_tag(tag)):
			_kill(cell, target, &"cleared")
			count += 1
	return count


## Remove every cell, colony and carried energy (counted as lost). Substrates stay.
func clear() -> void:
	for cell in _cells.keys():
		_kill(cell, _cells[cell], &"cleared")
	for host in _hosts:
		if is_instance_valid(host):
			for strain in host.carried:
				_ledger.host_dissipated += host.carried[strain]
			host.carried.clear()


# --- Substrates ------------------------------------------------------------------

func set_substrate(cell: Vector3i, substrate: Substrate) -> void:
	if substrate == null:
		_substrates.erase(cell)
	else:
		_substrates[cell] = substrate
	_eaten.erase(cell)
	_substrate_changes.append(cell)
	substrate_changed.emit(cell, substrate)


## Paint every voxel whose centre lies in the box between two world corners.
func paint_box(from: Vector3, to: Vector3, substrate: Substrate) -> int:
	var a := world_to_cell(Vector3(minf(from.x, to.x), minf(from.y, to.y), minf(from.z, to.z)) + Vector3.ONE * cell_size * 0.5)
	var b := world_to_cell(Vector3(maxf(from.x, to.x), maxf(from.y, to.y), maxf(from.z, to.z)) - Vector3.ONE * cell_size * 0.5)
	var count := 0
	for x in range(a.x, b.x + 1):
		for y in range(a.y, b.y + 1):
			for z in range(a.z, b.z + 1):
				var cell := Vector3i(x, y, z)
				if is_inside(cell):
					paint_cell(cell, substrate)
					count += 1
	_substrates_dirty = true
	return count


func paint_sphere(center: Vector3, radius: float, substrate: Substrate) -> int:
	var count := 0
	for cell in cells_in_sphere(center, radius):
		paint_cell(cell, substrate)
		count += 1
	_substrates_dirty = true
	return count


## The substrate at [param cell]: painted, then provided, then the default.
func get_substrate(cell: Vector3i) -> Substrate:
	var painted: Substrate = _substrates.get(cell)
	if painted != null:
		return painted
	if substrate_provider.is_valid():
		if not _provided.has(cell):
			_provided[cell] = substrate_provider.call(cell)
		var provided: Substrate = _provided[cell]
		if provided != null:
			return provided
	return default_substrate


## Nutrient left in a voxel (its full amount if nothing has eaten there yet).
func get_nutrient(cell: Vector3i, nutrient: StringName) -> float:
	var store: Dictionary = _eaten.get(cell, {})
	if store.has(nutrient):
		return store[nutrient]
	var substrate := get_substrate(cell)
	return substrate.get_nutrient(nutrient) if substrate != null else 0.0


## Forget cached [member substrate_provider] answers.
func refresh_substrates() -> void:
	_provided.clear()
	_substrates_dirty = true


## Paint one voxel without emitting [signal substrate_changed]. For bulk painting
## while building a level; use [method set_substrate] for changes during play.
func paint_cell(cell: Vector3i, substrate: Substrate) -> void:
	if substrate == null:
		_substrates.erase(cell)
	else:
		_substrates[cell] = substrate
	_eaten.erase(cell)
	_substrates_dirty = true


# --- Queries ---------------------------------------------------------------------

func world_to_cell(world_position: Vector3) -> Vector3i:
	var local := global_transform.affine_inverse() * world_position / cell_size
	return Vector3i(floori(local.x), floori(local.y), floori(local.z))


## World position of the centre of [param cell].
func cell_to_world(cell: Vector3i) -> Vector3:
	return global_transform * ((Vector3(cell) + Vector3.ONE * 0.5) * cell_size)


func is_inside(cell: Vector3i) -> bool:
	var half_x := size.x / 2
	var half_z := size.z / 2
	return cell.x >= -half_x and cell.x < size.x - half_x and cell.y >= 0 and cell.y < size.y \
		and cell.z >= -half_z and cell.z < size.z - half_z


## True if [param strain] could live at [param cell] (ignoring who is there now).
func can_hold(cell: Vector3i, strain: Strain) -> bool:
	if not is_inside(cell):
		return false
	var substrate := get_substrate(cell)
	return substrate == null or substrate.admits(strain)


## Voxels inside the field whose centres are within [param radius] metres.
func cells_in_sphere(world_position: Vector3, radius: float) -> Array[Vector3i]:
	var found: Array[Vector3i] = []
	var center := world_to_cell(world_position)
	var reach := ceili(radius / cell_size)
	var limit := radius * radius
	for x in range(-reach, reach + 1):
		for y in range(-reach, reach + 1):
			for z in range(-reach, reach + 1):
				var cell := center + Vector3i(x, y, z)
				if is_inside(cell) and cell_to_world(cell).distance_squared_to(world_position) <= limit:
					found.append(cell)
	return found


## Voxels in the layer at [param world_position] whose centres are within
## [param radius] metres horizontally.
func cells_in_disc(world_position: Vector3, radius: float) -> Array[Vector3i]:
	var found: Array[Vector3i] = []
	var center := world_to_cell(world_position)
	var reach := ceili(radius / cell_size)
	var limit := radius * radius
	for x in range(-reach, reach + 1):
		for z in range(-reach, reach + 1):
			var cell := center + Vector3i(x, 0, z)
			var offset := cell_to_world(cell) - world_position
			offset.y = 0.0
			if is_inside(cell) and offset.length_squared() <= limit:
				found.append(cell)
	return found


func has_cell(cell: Vector3i) -> bool:
	return _cells.has(cell)


## The strain living at a world position, or null.
func get_strain_at(world_position: Vector3) -> Strain:
	var cell: _Cell = _cells.get(world_to_cell(world_position))
	return cell.strain if cell != null else null


## Everything about one cell, or an empty dictionary: strain, colony, energy, age,
## wounds, dormant, root, connected.
func get_cell_info(cell: Vector3i) -> Dictionary:
	var target: _Cell = _cells.get(cell)
	if target == null:
		return {}
	return {strain = target.strain, colony = target.colony, energy = target.energy, age = target.age,
		wounds = target.wounds, dormant = target.dormant, root = target.root, connected = target.connected}


## Positions of living cells, optionally of one strain.
func get_cells(strain: Strain = null) -> Array[Vector3i]:
	var found: Array[Vector3i] = []
	for cell in _cells:
		if strain == null or _cells[cell].strain == strain:
			found.append(cell)
	return found


func get_cell_count(strain: Strain = null) -> int:
	if strain == null:
		return _cells.size()
	var count := 0
	for cell in _cells.values():
		if cell.strain == strain:
			count += 1
	return count


## Energy held by living cells, optionally of one strain.
func get_energy(strain: Strain = null) -> float:
	var total := 0.0
	for cell in _cells.values():
		if strain == null or cell.strain == strain:
			total += cell.energy
	return total


func get_colonies(strain: Strain = null) -> Array[CellColony]:
	var found: Array[CellColony] = []
	for colony in _colonies.values():
		if strain == null or colony.strain == strain:
			found.append(colony)
	return found


func get_colony_energy(colony: CellColony) -> float:
	var total := 0.0
	for cell in colony.cells:
		total += _cells[cell].energy
	return total


## Average world position of a colony's cells.
func get_colony_center(colony: CellColony) -> Vector3:
	if colony.cells.is_empty():
		return global_position
	var sum := Vector3.ZERO
	for cell in colony.cells:
		sum += Vector3(cell)
	return global_transform * ((sum / colony.cells.size() + Vector3.ONE * 0.5) * cell_size)


func get_hosts() -> Array[CellHost]:
	return _hosts.duplicate()


## Where every unit of energy came from and went. [code]balance[/code] is what the
## books say should exist minus what does exist, and stays at zero.[br]
## In: [code]seeded[/code], [code]fed[/code] (from substrates), [code]generated[/code]
## (by roots). Out: [code]metabolized[/code] (living, dividing, healing, reacting,
## radiating), [code]lost[/code] (left in dying cells), [code]host_dissipated[/code].
## Moving: [code]to_hosts[/code], [code]from_hosts[/code].
## Totals: [code]alive[/code] (in cells), [code]carried[/code] (by hosts).
func get_ledger() -> Dictionary:
	var ledger := _ledger.duplicate()
	ledger.alive = get_energy()
	var carried := 0.0
	for host in _hosts:
		if is_instance_valid(host):
			for strain in host.carried:
				carried += host.carried[strain]
	ledger.carried = carried
	var expected: float = ledger.seeded + ledger.fed + ledger.generated - ledger.metabolized \
		- ledger.lost - ledger.host_dissipated
	ledger.balance = expected - ledger.alive - carried
	return ledger


## The reaction between two strains, or null.
func get_reaction(a: Strain, b: Strain) -> Reaction:
	var key := "%d:%d" % [a.get_instance_id(), b.get_instance_id()]
	if not _reaction_cache.has(key):
		var found: Reaction = null
		for reaction in reactions:
			if reaction != null and reaction.joins(a, b):
				found = reaction
				break
		_reaction_cache[key] = found
	return _reaction_cache[key]


# --- Saving the world ------------------------------------------------------------

## A snapshot of the living world: painted substrates and their scars, what has
## been eaten, every cell and colony, and the ledger. It holds only numbers,
## strings and arrays (strains and substrates by resource path), so it can go
## straight to JSON or a save file. Energy carried by hosts isn't part of the
## field; the snapshot books it as dissipated.
func get_state() -> Dictionary:
	if _pass_open:
		_continue_pass(-1)
		_finish_pass()
	var palette: Array[String] = []
	var index_of := func(resource: Resource) -> int:
		var path := resource.resource_path
		var found := palette.find(path)
		if found < 0:
			palette.append(path)
			found = palette.size() - 1
		return found
	var substrates := []
	for cell in _substrates:
		substrates.append([cell.x, cell.y, cell.z, index_of.call(_substrates[cell])])
	var eaten := []
	for cell in _eaten:
		for nutrient in _eaten[cell]:
			eaten.append([cell.x, cell.y, cell.z, String(nutrient), _eaten[cell][nutrient]])
	var colonies := []
	for colony: CellColony in _colonies.values():
		colonies.append({id = colony.id, strain = index_of.call(colony.strain), has_root = colony.has_root,
			root = [colony.root.x, colony.root.y, colony.root.z], root_alive = colony.root_alive, age = colony.age,
			peak_size = colony.peak_size, verdict = String(colony.verdict), generation = colony.generation,
			senescent = colony.senescent, judge_timer = colony._judge_timer, last_size = colony._last_size})
	var cells := []
	for cell in _cells:
		var c: _Cell = _cells[cell]
		cells.append([cell.x, cell.y, cell.z, c.colony.id, index_of.call(c.strain), c.energy, c.age, c.wounds,
			c.heal_timer, c.dormant, c.root, c.connected, c.depth])
	var ledger := get_ledger()
	ledger.host_dissipated += ledger.carried
	for key in ["alive", "carried", "balance"]:
		ledger.erase(key)
	return {version = 1, passes = get_pass_count(), next_colony_id = _next_colony_id, palette = palette,
		substrates = substrates, eaten = eaten, colonies = colonies, cells = cells, ledger = ledger}


## Replace the living world with a snapshot from [method get_state]. Hosts keep
## nothing they carried. Entries whose resources can't be loaded are skipped.
func set_state(state: Dictionary) -> void:
	_pass_open = false
	_order = []
	_cells.clear()
	_colonies.clear()
	_substrates.clear()
	_eaten.clear()
	_provided.clear()
	for host in _hosts:
		if is_instance_valid(host):
			host.carried.clear()
	var palette: Array = []
	for path in state.get("palette", []):
		palette.append(load(path) if ResourceLoader.exists(path) else null)
	for entry in state.get("substrates", []):
		var substrate = palette[int(entry[3])]
		if substrate is Substrate:
			_substrates[Vector3i(int(entry[0]), int(entry[1]), int(entry[2]))] = substrate
	for entry in state.get("eaten", []):
		var cell := Vector3i(int(entry[0]), int(entry[1]), int(entry[2]))
		if not _eaten.has(cell):
			_eaten[cell] = {}
		_eaten[cell][StringName(entry[3])] = float(entry[4])
	var lost := 0.0
	for data in state.get("colonies", []):
		var strain = palette[int(data.strain)]
		if not strain is Strain:
			continue
		var colony := CellColony.new(int(data.id), strain)
		colony.has_root = data.has_root
		colony.root = Vector3i(int(data.root[0]), int(data.root[1]), int(data.root[2]))
		colony.root_alive = data.root_alive
		colony.age = float(data.age)
		colony.peak_size = int(data.peak_size)
		colony.verdict = StringName(data.verdict)
		colony.generation = int(data.generation)
		colony.senescent = data.senescent
		colony._judge_timer = float(data.judge_timer)
		colony._last_size = int(data.last_size)
		_colonies[colony.id] = colony
	for entry in state.get("cells", []):
		var colony: CellColony = _colonies.get(int(entry[3]))
		var strain = palette[int(entry[4])]
		if colony == null or not strain is Strain:
			lost += float(entry[5])
			continue
		var cell := _Cell.new()
		var pos := Vector3i(int(entry[0]), int(entry[1]), int(entry[2]))
		cell.colony = colony
		cell.strain = strain
		cell.energy = float(entry[5])
		cell.age = float(entry[6])
		cell.wounds = int(entry[7])
		cell.heal_timer = float(entry[8])
		cell.dormant = entry[9]
		cell.root = entry[10]
		cell.connected = entry[11]
		cell.depth = int(entry[12])
		_cells[pos] = cell
		colony.cells[pos] = true
	for id in _colonies.keys():
		if _colonies[id].cells.is_empty():
			_colonies.erase(id)
	_next_colony_id = int(state.get("next_colony_id", _next_colony_id))
	_pass = int(state.get("passes", 0))
	for key in _ledger:
		_ledger[key] = float(state.get("ledger", {}).get(key, 0.0))
	_ledger.lost += lost
	_substrates_dirty = true
	_substrate_changes.clear()


# --- Hosts -----------------------------------------------------------------------

func add_host(host: CellHost) -> void:
	if not _hosts.has(host):
		_hosts.append(host)


## Stop tracking a host. Its carried energy returns to the field or dissipates.
func remove_host(host: CellHost, release: bool = true) -> void:
	if not _hosts.has(host):
		return
	if release:
		release_host(host)
	else:
		for strain in host.carried:
			_ledger.host_dissipated += host.carried[strain]
		host.carried.clear()
	_hosts.erase(host)


## Return everything [param host] carries to the voxels around it: a burning
## ghoul's death scatters embers. Energy that finds no room dissipates.
func release_host(host: CellHost) -> void:
	if host.carried.is_empty():
		return
	var center := world_to_cell(host.global_position)
	var spots: Array[Vector3i] = []
	for x in range(-1, 2):
		for z in range(-1, 2):
			for y in range(0, 2):
				spots.append(center + Vector3i(x, y, z))
	for strain: Strain in host.carried.keys():
		var amount: float = host.carried[strain]
		var placed := 0.0
		var free: Array[Vector3i] = []
		for spot in spots:
			if not _cells.has(spot) and can_hold(spot, strain):
				free.append(spot)
		_shuffle(free)
		var share := maxf(strain.seed_energy, amount / maxf(free.size(), 1))
		for spot in free:
			if amount - placed <= _EPS or _cells.size() >= max_cells:
				break
			var energy := minf(share, amount - placed)
			_spawn(spot, strain, _colony_near(strain, spot), energy)
			placed += energy
		_ledger.from_hosts += placed
		_ledger.host_dissipated += amount - placed
		host_released.emit(host, strain, amount)
	host.carried.clear()
	host.carrying_changed.emit()


func _update_host(host: CellHost, dt: float) -> void:
	var component := host.get_component()
	if component == null:
		return
	host._tick(dt)
	var center := world_to_cell(host.global_position)
	var reach := ceili(host.radius / cell_size)
	var tall := maxi(ceili(host.height / cell_size), 1)
	for y in tall:
		for x in range(-reach, reach + 1):
			for z in range(-reach, reach + 1):
				var pos := center + Vector3i(x, y, z)
				var cell: _Cell = _cells.get(pos)
				if cell != null:
					_try_infect(host, component, pos, cell)
	_shed_and_fade(host, component, center, dt)


func _try_infect(host: CellHost, component: EffectComponent, pos: Vector3i, cell: _Cell) -> void:
	var strain := cell.strain
	if strain.infection_effect == null or cell.dormant or cell.age < strain.mature_time:
		return
	if host._cooldowns.get(strain, 0.0) > 0.0:
		return
	host._cooldowns[strain] = strain.infection_interval
	if _rng.randf() < host.get_resistance(strain):
		return
	var magnitude := clampf(cell.energy / maxf(strain.max_energy * 0.5, _EPS), 0.25, 2.0)
	var instance := component.apply_effect(strain.infection_effect, self, {&"magnitude": magnitude})
	if instance == null:
		return
	# A cell never gives away more than half of itself, so passing on an infection
	# doesn't eat the fire a host is standing in.
	var room := maxf(strain.host_capacity - float(host.carried.get(strain, 0.0)), 0.0)
	var transfer := minf(minf(strain.infection_cost, cell.energy * 0.5), room)
	if transfer > 0.0:
		cell.energy -= transfer
		host.carried[strain] = float(host.carried.get(strain, 0.0)) + transfer
		_ledger.to_hosts += transfer
		host.carrying_changed.emit()
	host.infected.emit(strain)
	host_infected.emit(host, strain)


func _shed_and_fade(host: CellHost, component: EffectComponent, foot: Vector3i, dt: float) -> void:
	for strain: Strain in host.carried.keys():
		var amount: float = host.carried[strain]
		var infected := strain.infection_effect != null and component.has_effect(strain.infection_effect)
		if not infected:
			# The infection is over; whatever it carried is spent.
			_ledger.host_dissipated += amount
			host.carried.erase(strain)
			host.carrying_changed.emit()
			continue
		var fade := minf(amount, strain.metabolism * dt)
		amount -= fade
		_ledger.host_dissipated += fade
		if strain.shed_energy > 0.0 and host.shed:
			host._shed_timers[strain] = float(host._shed_timers.get(strain, 0.0)) + dt
			if host._shed_timers[strain] >= strain.shed_interval and amount > _EPS:
				host._shed_timers[strain] = 0.0
				var spot := _free_spot_near(foot, strain)
				if spot != Vector3i.MAX and _cells.size() < max_cells:
					var energy := minf(amount, strain.shed_energy)
					_spawn(spot, strain, _colony_near(strain, spot), energy)
					amount -= energy
					_ledger.from_hosts += energy
		if amount <= _EPS:
			_ledger.host_dissipated += maxf(amount, 0.0)
			host.carried.erase(strain)
			host.carrying_changed.emit()
		else:
			host.carried[strain] = amount


func _free_spot_near(cell: Vector3i, strain: Strain) -> Vector3i:
	var options: Array[Vector3i] = [cell, cell + Vector3i(1, 0, 0), cell + Vector3i(-1, 0, 0),
		cell + Vector3i(0, 0, 1), cell + Vector3i(0, 0, -1)]
	for option in options:
		if not _cells.has(option) and can_hold(option, strain):
			return option
	return Vector3i.MAX


# --- The life of a cell ----------------------------------------------------------

func _update_cell(pos: Vector3i, cell: _Cell, dt: float) -> void:
	var strain := cell.strain
	var colony := cell.colony
	cell.age += dt
	if cell.flash > 0.0:
		cell.flash = maxf(cell.flash - dt * 4.0, 0.0)

	# Feed on the voxel, and the root generates.
	if strain.feeds_on != &"" and strain.feed_rate > 0.0:
		var food := _eat(pos, strain.feeds_on, strain.feed_rate * dt)
		cell.energy += food
		_ledger.fed += food
	if cell.root and strain.root_regen > 0.0:
		var made := strain.root_regen * dt
		cell.energy += made
		_ledger.generated += made

	# Metabolism. Dormant cells idle; old colonies burn out.
	var burn := strain.metabolism * dt
	if cell.dormant:
		burn *= strain.dormant_metabolism
	if colony.senescent:
		burn *= 2.0
	burn = minf(burn, cell.energy)
	cell.energy -= burn
	_ledger.metabolized += burn
	_cap(cell)
	if cell.energy <= _EPS:
		_kill(pos, cell, &"starved")
		return

	# Energy: rest when low, wake when fed. Roots never sleep.
	if cell.dormant:
		if cell.energy >= strain.wake_energy:
			cell.dormant = false
	elif cell.energy < strain.rest_energy and not cell.root:
		cell.dormant = true

	# Heal.
	if cell.wounds > 0:
		cell.heal_timer += dt
		if cell.heal_timer >= strain.heal_time and cell.energy > strain.heal_cost:
			cell.heal_timer = 0.0
			cell.wounds -= 1
			cell.energy -= strain.heal_cost
			_ledger.metabolized += strain.heal_cost

	# Mitosis.
	if not cell.dormant and not colony.senescent and cell.age >= strain.mature_time \
			and cell.energy >= strain.split_energy:
		_divide(pos, cell)


func _divide(pos: Vector3i, cell: _Cell) -> void:
	var strain := cell.strain
	var direction := _pick_direction(strain)
	if direction == Vector3i.ZERO:
		return
	var target := pos + direction
	if not can_hold(target, strain):
		return
	var other: _Cell = _cells.get(target)
	if other != null:
		if other.strain != strain:
			var reaction := get_reaction(strain, other.strain)
			if reaction != null:
				_react(reaction, pos, cell, target, other, false)
		return
	if cell.colony.size() >= strain.max_colony_cells or _cells.size() >= max_cells:
		return
	var cost := minf(strain.division_cost, cell.energy)
	cell.energy -= cost
	_ledger.metabolized += cost
	var half := cell.energy * 0.5
	cell.energy -= half
	var child := _spawn(target, strain, cell.colony, half)
	child.connected = cell.connected
	child.depth = cell.depth + 1


func _pick_direction(strain: Strain) -> Vector3i:
	var weights: PackedFloat32Array = _weights_cache.get(strain, PackedFloat32Array())
	if weights.is_empty():
		weights.resize(6)
		var local_wind := global_transform.basis.inverse() * wind
		var strength := local_wind.length()
		var wind_dir := local_wind / strength if strength > _EPS else Vector3.ZERO
		var total := 0.0
		for i in 6:
			var direction := _DIRECTIONS[i]
			var w := strain.spread_up if i == 0 else strain.spread_down if i == 1 else strain.spread_side
			if strain.wind_factor > 0.0 and strength > _EPS:
				w *= maxf(1.0 + strain.wind_factor * strength * wind_dir.dot(Vector3(direction)), 0.0)
			total += w
			weights[i] = total
		_weights_cache[strain] = weights
	var total_weight := weights[5]
	if total_weight <= 0.0:
		return Vector3i.ZERO
	var roll := _rng.randf() * total_weight
	for i in 6:
		if roll < weights[i]:
			return _DIRECTIONS[i]
	return _DIRECTIONS[5]


func _eat(pos: Vector3i, nutrient: StringName, want: float) -> float:
	var store: Dictionary = _eaten.get(pos, {})
	if not store.has(nutrient):
		var substrate := get_substrate(pos)
		var amount := substrate.get_nutrient(nutrient) if substrate != null else 0.0
		if amount <= 0.0:
			return 0.0
		store[nutrient] = amount
		_eaten[pos] = store
	var left: float = store[nutrient]
	var got := minf(want, left)
	store[nutrient] = left - got
	return got


func _spawn(pos: Vector3i, strain: Strain, colony: CellColony, energy: float) -> _Cell:
	var cell := _Cell.new()
	cell.strain = strain
	cell.colony = colony
	cell.energy = energy
	cell.born_pass = _pass
	_cells[pos] = cell
	colony.cells[pos] = true
	colony.peak_size = maxi(colony.peak_size, colony.cells.size())
	_cap(cell)
	strain._born(self, pos)
	cell_born.emit(pos, strain, colony)
	return cell


func _cap(cell: _Cell) -> void:
	if cell.energy > cell.strain.max_energy:
		_ledger.metabolized += cell.energy - cell.strain.max_energy
		cell.energy = cell.strain.max_energy


func _wound(pos: Vector3i, cell: _Cell, wounds: int, energy: float) -> void:
	if _cells.get(pos) != cell:
		return
	cell.wounds += wounds
	cell.heal_timer = 0.0
	cell.flash = 1.0
	var burn := minf(energy, cell.energy)
	cell.energy -= burn
	_ledger.metabolized += burn
	cell_wounded.emit(pos, cell.strain, cell.wounds)
	if cell.wounds >= cell.strain.max_wounds or cell.energy <= _EPS:
		_kill(pos, cell, &"wounds")


func _kill(pos: Vector3i, cell: _Cell, cause: StringName) -> void:
	if _cells.get(pos) != cell:
		return
	var strain := cell.strain
	var colony := cell.colony
	_cells.erase(pos)
	colony.cells.erase(pos)
	_ledger.lost += cell.energy
	cell.energy = 0.0
	# Necrosis leaves a scar where the cell actually fed. The voxel's own material
	# decides first (wood chars, leaves vanish), then the strain.
	if strain.feeds_on != &"" and _eaten.has(pos) and _eaten[pos].has(strain.feeds_on):
		var current := get_substrate(pos)
		var residue: Substrate = current.residue_for(strain) if current != null else null
		if residue == null:
			residue = strain.residue
		if residue != null:
			set_substrate(pos, residue)
	if cell.root and colony.root_alive:
		colony.root_alive = false
		colony_severed.emit(colony)
	strain._died(self, pos, cause)
	cell_died.emit(pos, strain, cause)
	if colony.cells.is_empty() and _colonies.has(colony.id):
		_colonies.erase(colony.id)
		colony_died.emit(colony)


func _react(reaction: Reaction, a_pos: Vector3i, a: _Cell, b_pos: Vector3i, b: _Cell, a_incoming: bool) -> void:
	if reaction.chance < 1.0 and _rng.randf() >= reaction.chance:
		if a_incoming:
			_ledger.metabolized += a.energy
		return
	var a_first := reaction.matches_a(a.strain) and reaction.matches_b(b.strain)
	reacted.emit(b_pos, reaction)
	_burst(reaction, b_pos)
	if reaction.product != null:
		var pooled := a.energy + b.energy
		a.energy = 0.0
		b.energy = 0.0
		if not a_incoming:
			_kill(a_pos, a, &"reaction")
		_kill(b_pos, b, &"reaction")
		var kept := pooled * reaction.efficiency
		_ledger.metabolized += pooled - kept
		if kept > _EPS and not _cells.has(b_pos) and can_hold(b_pos, reaction.product):
			_spawn(b_pos, reaction.product, _colony_near(reaction.product, b_pos), kept)
		else:
			_ledger.metabolized += kept
		return
	var wound_a := reaction.wound_a if a_first else reaction.wound_b
	var wound_b := reaction.wound_b if a_first else reaction.wound_a
	if wound_b > 0:
		_wound(b_pos, b, wound_b, reaction.wound_energy * wound_b)
	if a_incoming:
		# A seeded cell that wins the voxel moves in with what it has left.
		var left := a.energy - reaction.wound_energy * wound_a
		if wound_a < a.strain.max_wounds and left > _EPS and not _cells.has(b_pos) and _cells.size() < max_cells:
			_ledger.metabolized += a.energy - left
			_spawn(b_pos, a.strain, _colony_near(a.strain, b_pos), left)
		else:
			_ledger.metabolized += a.energy
	elif wound_a > 0:
		_wound(a_pos, a, wound_a, reaction.wound_energy * wound_a)


func _burst(reaction: Reaction, cell: Vector3i) -> void:
	var at := cell_to_world(cell)
	if reaction.burst_effect != null and reaction.burst_radius > 0.0:
		var limit := reaction.burst_radius * reaction.burst_radius
		for host in _hosts:
			if is_instance_valid(host) and host.get_component() != null \
					and host.global_position.distance_squared_to(at) <= limit:
				host.get_component().apply_effect(reaction.burst_effect, self)
	# Feedback is throttled so a grinding border doesn't strobe.
	var now := Time.get_ticks_msec()
	if now - int(_burst_times.get(reaction, -100000)) < 150:
		return
	_burst_times[reaction] = now
	if reaction.burst_color.a > 0.0 and is_inside_tree():
		Fx.impact_light(at, reaction.burst_color, 3.0, maxf(reaction.burst_radius * 2.0, 3.0), 0.3)
		if reaction.burst_radius > 0.0:
			Fx.shockwave(at, reaction.burst_color, reaction.burst_radius, 0.35)
	if reaction.shake > 0.0:
		Fx.shake(reaction.shake)


# --- Colonies --------------------------------------------------------------------

func _new_colony(strain: Strain) -> CellColony:
	var colony := CellColony.new(_next_colony_id, strain)
	_next_colony_id += 1
	_colonies[colony.id] = colony
	colony_founded.emit(colony)
	return colony


## A neighbouring colony of the same strain, or a new one.
func _colony_near(strain: Strain, cell: Vector3i) -> CellColony:
	for direction in _DIRECTIONS:
		var neighbour: _Cell = _cells.get(cell + direction)
		if neighbour != null and neighbour.strain == strain:
			return neighbour.colony
	return _new_colony(strain)


func _update_colony(colony: CellColony, dt: float) -> void:
	if colony.cells.is_empty():
		return
	colony.age += dt
	var strain := colony.strain
	if colony.has_root and colony.root_alive and strain.supply_rate > 0.0:
		_supply(colony, dt)
	colony._judge_timer += dt
	if colony._judge_timer >= strain.judge_interval:
		colony._judge_timer = 0.0
		_judge(colony)


## The root pumps energy to every connected cell, as far as its own energy allows.
func _supply(colony: CellColony, dt: float) -> void:
	var root: _Cell = _cells.get(colony.root)
	if root == null:
		return
	var targets: Array[_Cell] = []
	for pos in colony.cells:
		var cell: _Cell = _cells[pos]
		if cell.connected and not cell.root:
			targets.append(cell)
	if targets.is_empty():
		return
	var available := maxf(root.energy - colony.strain.rest_energy, 0.0)
	var give := minf(colony.strain.supply_rate * dt * targets.size(), available)
	if give <= _EPS:
		return
	root.energy -= give
	var share := give / targets.size()
	for cell in targets:
		cell.energy += share
		_cap(cell)


func _judge(colony: CellColony) -> void:
	var strain := colony.strain
	var count := colony.size()
	if colony.has_root and colony.root_alive:
		_connect_from_root(colony)
	var verdict: StringName
	if strain.evolve_into != null and strain.evolve_at_cells > 0 and count >= strain.evolve_at_cells:
		_evolve(colony, strain.evolve_into)
		verdict = &"evolved"
	elif colony.senescent or (strain.lifespan > 0.0 and colony.age >= strain.lifespan):
		colony.senescent = true
		verdict = &"senescent"
	elif colony.is_severed():
		verdict = &"severed"
	elif count > colony._last_size:
		verdict = &"growing"
	elif count < colony._last_size:
		verdict = &"declining"
	else:
		verdict = &"stable"
	verdict = colony.strain._judge(colony, verdict)
	colony._last_size = count
	colony.verdict = verdict
	colony_judged.emit(colony, verdict)


func _evolve(colony: CellColony, into: Strain) -> void:
	var from := colony.strain
	colony.strain = into
	colony.generation += 1
	for pos in colony.cells:
		var cell: _Cell = _cells[pos]
		cell.strain = into
		_cap(cell)
	colony_evolved.emit(colony, from, into)


func _connect_from_root(colony: CellColony) -> void:
	for pos in colony.cells:
		_cells[pos].connected = false
	# Breadth first, so depth is the shortest path back to the root.
	var frontier: Array[Vector3i] = [colony.root]
	var root: _Cell = _cells[colony.root]
	root.connected = true
	root.depth = 0
	var head := 0
	while head < frontier.size():
		var pos: Vector3i = frontier[head]
		head += 1
		var depth: int = _cells[pos].depth + 1
		for direction in _DIRECTIONS:
			var next := pos + direction
			if colony.cells.has(next):
				var cell: _Cell = _cells[next]
				if not cell.connected:
					cell.connected = true
					cell.depth = depth
					frontier.append(next)
	colony.connected_count = frontier.size()


func _shuffle(list: Array) -> void:
	for i in range(list.size() - 1, 0, -1):
		var j := _rng.randi_range(0, i)
		var swap = list[i]
		list[i] = list[j]
		list[j] = swap
