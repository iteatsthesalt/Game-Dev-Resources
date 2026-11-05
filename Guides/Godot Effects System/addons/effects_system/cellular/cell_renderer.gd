extends Node3D
## Internal: draws a [CellField]'s cells and substrates as voxels, one MultiMesh per
## strain, and keeps lights and particles on its colonies. Created by the field.

const CELL_SHADER := preload("res://addons/effects_system/cellular/cell.gdshader")
const SUBSTRATE_SHADER := preload("res://addons/effects_system/cellular/substrate.gdshader")
const STRIDE := 20
const SLAB_HEIGHT := 0.18

var field: CellField

var _layers: Dictionary = {}
var _ground: _Layer
var _ground_index: Dictionary = {}
var _ground_cells: Array[Vector3i] = []
var _lights: Dictionary = {}
var _light_targets: Dictionary = {}
var _emitters: Dictionary = {}
var _refreshes: int = 0


class _Layer:
	var instance: MultiMeshInstance3D
	var multimesh: MultiMesh
	var buffer := PackedFloat32Array()
	var capacity: int = 0
	var height: float = 1.0


func refresh(substrates_rebuild: bool, substrate_changes: Array[Vector3i]) -> void:
	_refreshes += 1
	if field.render_cells:
		_draw_cells()
	if field.render_substrates:
		if substrates_rebuild or _ground == null:
			_rebuild_ground()
		elif not substrate_changes.is_empty():
			_patch_ground(substrate_changes)


func _process(delta: float) -> void:
	# Lights ease toward their colony's brightness and flicker with fire.
	for strain: Strain in _lights:
		var pool: Array = _lights[strain]
		var targets: Array = _light_targets.get(strain, [])
		for i in pool.size():
			var light: OmniLight3D = pool[i]
			var target: float = targets[i] if i < targets.size() else 0.0
			var wave := 1.0 - strain.flicker * 0.35 * (0.5 + 0.5 * sin(Time.get_ticks_msec() * 0.011 + i * 1.7))
			light.light_energy = lerpf(light.light_energy, target * wave, minf(delta * 4.0, 1.0))
			light.visible = light.light_energy > 0.02


# --- Cells -----------------------------------------------------------------------

func _draw_cells() -> void:
	var groups: Dictionary = {}
	for pos in field._cells:
		var strain: Strain = field._cells[pos].strain
		if not groups.has(strain):
			groups[strain] = []
		groups[strain].append(pos)
	for strain in _layers:
		if not groups.has(strain):
			_layers[strain].multimesh.visible_instance_count = 0
	for strain in groups:
		_fill_layer(strain, groups[strain])
	_place_lights()
	_place_emitters(groups)


func _fill_layer(strain: Strain, cells: Array) -> void:
	var layer := _layer_for(strain)
	_ensure(layer, cells.size())
	var buffer := layer.buffer
	var size := field.cell_size
	var pulsing := strain.supply_rate > 0.0
	var i := 0
	for pos: Vector3i in cells:
		var cell = field._cells[pos]
		var ratio := clampf(cell.energy / strain.max_energy, 0.0, 1.0)
		var grow := 1.0 if strain.mature_time <= 0.0 else clampf(cell.age / strain.mature_time, 0.0, 1.0)
		var scale := strain.cell_scale * (0.35 + 0.65 * grow) * (0.8 + 0.2 * ratio)
		var color := strain.color.lerp(strain.hot_color, ratio)
		if cell.dormant:
			scale *= 0.65
			color = color.darkened(0.45)
		if cell.root:
			scale = maxf(scale, strain.cell_scale) * 1.2
			color = color.lightened(0.25)
		# Networks fed by a root pulse outward from it; cut-off cells go dim.
		var pulse_phase := 0.0
		if pulsing:
			if cell.connected:
				pulse_phase = fposmod(cell.depth / 12.0, 1.0) * 0.98 + 0.01
			else:
				color = color.darkened(0.35)
		color.a = pulse_phase
		var s := scale * size
		# Flat strains lie on top of the ground cover instead of inside it.
		var floor_y := 0.0
		if layer.height < 1.0:
			var under := field.get_substrate(pos)
			if under != null and under.shape == Substrate.Shape.SLAB:
				floor_y = under.slab_height * size
			elif under != null and under.shape == Substrate.Shape.CUBE:
				floor_y = size
		var k := i * STRIDE
		buffer[k] = s
		buffer[k + 1] = 0.0
		buffer[k + 2] = 0.0
		buffer[k + 3] = (pos.x + 0.5) * size
		buffer[k + 4] = 0.0
		buffer[k + 5] = s
		buffer[k + 6] = 0.0
		buffer[k + 7] = pos.y * size + floor_y + 0.5 * layer.height * s
		buffer[k + 8] = 0.0
		buffer[k + 9] = 0.0
		buffer[k + 10] = s
		buffer[k + 11] = (pos.z + 0.5) * size
		buffer[k + 12] = color.r
		buffer[k + 13] = color.g
		buffer[k + 14] = color.b
		buffer[k + 15] = color.a
		buffer[k + 16] = ratio
		buffer[k + 17] = grow
		buffer[k + 18] = cell.flash
		buffer[k + 19] = _hash(pos)
		i += 1
	layer.multimesh.buffer = buffer
	layer.multimesh.visible_instance_count = cells.size()


func _layer_for(strain: Strain) -> _Layer:
	if _layers.has(strain):
		return _layers[strain]
	var layer := _Layer.new()
	var mesh: Mesh
	match strain.shape:
		Strain.Shape.SPHERE:
			var sphere := SphereMesh.new()
			sphere.radius = 0.5
			sphere.height = 1.0
			sphere.radial_segments = 10
			sphere.rings = 5
			mesh = sphere
		Strain.Shape.SLAB:
			var slab := BoxMesh.new()
			slab.size = Vector3(1.0, SLAB_HEIGHT, 1.0)
			layer.height = SLAB_HEIGHT
			mesh = slab
		_:
			mesh = BoxMesh.new()
	var material: Material = strain.material_override
	if material == null:
		var shader_material := ShaderMaterial.new()
		shader_material.shader = CELL_SHADER
		shader_material.set_shader_parameter(&"emission_strength", strain.emission)
		shader_material.set_shader_parameter(&"flicker", strain.flicker)
		shader_material.set_shader_parameter(&"rise", strain.rise)
		shader_material.set_shader_parameter(&"bob", strain.bob)
		shader_material.set_shader_parameter(&"base_y", -0.5 * layer.height)
		shader_material.set_shader_parameter(&"pulse", 1.0 if strain.supply_rate > 0.0 else 0.0)
		material = shader_material
	layer.multimesh = _new_multimesh(mesh)
	layer.instance = _new_instance(layer.multimesh, material, "Cells_%s" % String(strain.id))
	_layers[strain] = layer
	return layer


func _place_lights() -> void:
	var by_strain: Dictionary = {}
	for colony in field.get_colonies():
		var strain := colony.strain
		if strain.max_lights > 0 and strain.light_energy > 0.0:
			if not by_strain.has(strain):
				by_strain[strain] = []
			by_strain[strain].append(colony)
	for strain in _light_targets:
		if not by_strain.has(strain):
			_light_targets[strain] = []
	for strain: Strain in by_strain:
		var colonies: Array = by_strain[strain]
		colonies.sort_custom(func(a: CellColony, b: CellColony) -> bool: return a.size() > b.size())
		var pool: Array = _lights.get(strain, [])
		_lights[strain] = pool
		var targets: Array = []
		for i in mini(colonies.size(), strain.max_lights):
			var colony: CellColony = colonies[i]
			if pool.size() <= i:
				var light := OmniLight3D.new()
				light.light_color = strain.light_color
				light.light_energy = 0.0
				light.shadow_enabled = false
				add_child(light)
				pool.append(light)
			var root_size := sqrt(float(colony.size()))
			pool[i].global_position = field.get_colony_center(colony) + Vector3.UP * field.cell_size
			pool[i].omni_range = clampf(field.cell_size * (3.0 + root_size * 1.2), 2.0, 14.0)
			targets.append(strain.light_energy * clampf(root_size / 4.0, 0.4, 2.0))
		_light_targets[strain] = targets


func _place_emitters(groups: Dictionary) -> void:
	for strain: Strain in groups:
		if strain.particles == null or strain.max_emitters <= 0:
			continue
		var pool: Array = _emitters.get(strain, [])
		_emitters[strain] = pool
		while pool.size() < strain.max_emitters:
			var emitter := strain.particles.instantiate()
			add_child(emitter)
			pool.append(emitter)
		var cells: Array = groups[strain]
		for j in pool.size():
			var emitter: Node = pool[j]
			var active := j < cells.size()
			if "emitting" in emitter:
				emitter.emitting = active
			# Hop to a new cell every few passes, staggered so they don't all jump.
			if active and (_refreshes + j) % 4 == 0:
				var pos: Vector3i = cells[(j * 7919 + _refreshes * 31) % cells.size()]
				emitter.position = (Vector3(pos) + Vector3(0.5, 0.5, 0.5)) * field.cell_size
	for strain in _emitters:
		if not groups.has(strain):
			for emitter in _emitters[strain]:
				if "emitting" in emitter:
					emitter.emitting = false


# --- Substrates ------------------------------------------------------------------

func _rebuild_ground() -> void:
	if _ground == null:
		var material := ShaderMaterial.new()
		material.shader = SUBSTRATE_SHADER
		_ground = _Layer.new()
		_ground.multimesh = _new_multimesh(BoxMesh.new())
		_ground.instance = _new_instance(_ground.multimesh, material, "Substrates")
	_ground_index.clear()
	_ground_cells.clear()
	for pos in field._substrates:
		var substrate: Substrate = field._substrates[pos]
		if substrate.shape != Substrate.Shape.HIDDEN:
			_ground_index[pos] = _ground_cells.size()
			_ground_cells.append(pos)
	_ensure(_ground, _ground_cells.size())
	for i in _ground_cells.size():
		_write_ground(i, _ground_cells[i])
	_ground.multimesh.buffer = _ground.buffer
	_ground.multimesh.visible_instance_count = _ground_cells.size()


func _patch_ground(changes: Array[Vector3i]) -> void:
	for pos in changes:
		if not _ground_index.has(pos):
			var substrate: Substrate = field._substrates.get(pos)
			if substrate == null or substrate.shape == Substrate.Shape.HIDDEN:
				continue
			_ground_index[pos] = _ground_cells.size()
			_ground_cells.append(pos)
			_ensure(_ground, _ground_cells.size())
		_write_ground(_ground_index[pos], pos)
	_ground.multimesh.buffer = _ground.buffer
	_ground.multimesh.visible_instance_count = _ground_cells.size()


func _write_ground(i: int, pos: Vector3i) -> void:
	var substrate: Substrate = field._substrates.get(pos)
	var size := field.cell_size
	var height := 0.0
	var color := Color.BLACK
	var glow := 0.0
	if substrate != null and substrate.shape != Substrate.Shape.HIDDEN:
		height = substrate.slab_height if substrate.shape == Substrate.Shape.SLAB else 1.0
		color = substrate.color
		glow = substrate.emission
	var width := size if height > 0.0 else 0.0
	var k := i * STRIDE
	var buffer := _ground.buffer
	buffer[k] = width
	buffer[k + 1] = 0.0
	buffer[k + 2] = 0.0
	buffer[k + 3] = (pos.x + 0.5) * size
	buffer[k + 4] = 0.0
	buffer[k + 5] = height * size
	buffer[k + 6] = 0.0
	buffer[k + 7] = (pos.y + 0.5 * height) * size
	buffer[k + 8] = 0.0
	buffer[k + 9] = 0.0
	buffer[k + 10] = width
	buffer[k + 11] = (pos.z + 0.5) * size
	buffer[k + 12] = color.r
	buffer[k + 13] = color.g
	buffer[k + 14] = color.b
	buffer[k + 15] = 1.0
	buffer[k + 16] = glow
	buffer[k + 17] = 0.0
	buffer[k + 18] = 0.0
	buffer[k + 19] = _hash(pos)


# --- Helpers ---------------------------------------------------------------------

func _new_multimesh(mesh: Mesh) -> MultiMesh:
	var multimesh := MultiMesh.new()
	multimesh.transform_format = MultiMesh.TRANSFORM_3D
	multimesh.use_colors = true
	multimesh.use_custom_data = true
	multimesh.mesh = mesh
	return multimesh


func _new_instance(multimesh: MultiMesh, material: Material, node_name: String) -> MultiMeshInstance3D:
	var instance := MultiMeshInstance3D.new()
	instance.name = node_name
	instance.multimesh = multimesh
	instance.material_override = material
	instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if field.cast_shadows \
		else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	# Cover the whole field so flames stretched by the shader are never culled.
	var extent := Vector3(field.size) * field.cell_size
	instance.custom_aabb = AABB(Vector3(-extent.x * 0.5, -field.cell_size, -extent.z * 0.5),
		extent + Vector3(0, field.cell_size * 4.0, 0))
	add_child(instance)
	return instance


func _ensure(layer: _Layer, count: int) -> void:
	if count <= layer.capacity:
		return
	var capacity := maxi(layer.capacity, 64)
	while capacity < count:
		capacity *= 2
	layer.capacity = capacity
	layer.multimesh.instance_count = capacity
	layer.buffer.resize(capacity * STRIDE)  # Keeps what's there, pads with zeros.


static func _hash(pos: Vector3i) -> float:
	return fposmod(sin(pos.x * 12.9898 + pos.y * 78.233 + pos.z * 37.719) * 43758.5453, 1.0)
