extends "res://tests/test_suite.gd"
## Tests for the living-effects layer: CellField, Strain, Substrate, Reaction,
## CellHost and SubstrateVolume. Every test that moves energy checks the ledger.


func make_field(field_size: Vector3i = Vector3i(16, 8, 16), cell: float = 1.0, render: bool = false) -> CellField:
	var field := CellField.new()
	field.cell_size = cell
	field.size = field_size
	field.update_mode = CellField.UpdateMode.MANUAL
	field.rng_seed = 1234
	field.render_cells = render
	field.render_substrates = render
	tree.root.add_child(track(field))
	return field


func make_strain(props: Dictionary = {}) -> Strain:
	var strain := Strain.new()
	strain.id = &"test"
	strain.metabolism = 0.0
	strain.mature_time = 0.0
	strain.split_energy = 1000.0
	strain.max_energy = 100.0
	strain.rest_energy = 0.0
	strain.wake_energy = 0.0
	for key in props:
		strain.set(key, props[key])
	return strain


func make_substrate(props: Dictionary = {}) -> Substrate:
	var substrate := Substrate.new()
	for key in props:
		substrate.set(key, props[key])
	return substrate


func make_reaction(props: Dictionary) -> Reaction:
	var reaction := Reaction.new()
	for key in props:
		reaction.set(key, props[key])
	return reaction


func reactions(list: Array) -> Array[Reaction]:
	var typed: Array[Reaction] = []
	typed.assign(list)
	return typed


func burn_effect() -> Effect:
	return make_effect({id = &"burn", duration = 2.0, period = 0.5, tags = tags([&"fire.burn"]),
		periodic_changes = mods([mod(&"health", StatModifier.Operation.ADD, -1.0)])})


func make_host(field: CellField, at: Vector3, stats: Dictionary = {&"health": 100.0, &"max_health": 100.0}) -> CellHost:
	var body := Node3D.new()
	var component := EffectComponent.new()
	component.base_stats = stats
	component.stat_limits = {&"health": &"max_health"}
	component.update_mode = EffectComponent.UpdateMode.MANUAL
	body.add_child(component)
	var host := CellHost.new()
	host.field = field
	body.add_child(host)
	tree.root.add_child(track(body))
	body.global_position = at
	host._register()
	return host


## Feet of a host standing in [param cell].
func feet(field: CellField, cell: Vector3i) -> Vector3:
	return field.cell_to_world(cell) - Vector3(0, field.cell_size * 0.5, 0)


func one_pass(field: CellField) -> void:
	field.simulate(field.get_step())


func energy_at(field: CellField, cell: Vector3i) -> float:
	return float(field.get_cell_info(cell).get("energy", 0.0))


func check_conserved(field: CellField, label: String) -> void:
	var ledger := field.get_ledger()
	var scale := maxf(1.0, ledger.seeded + ledger.fed + ledger.generated)
	check(absf(ledger.balance) < 0.0001 * scale, "%s: energy not conserved (balance %f)" % [label, ledger.balance])


# --- The life of a cell ----------------------------------------------------------

func test_mitosis_splits_energy() -> void:
	var field := make_field()
	var strain := make_strain({seed_energy = 10.0, split_energy = 8.0, division_cost = 1.0,
		spread_up = 0.0, spread_down = 0.0})
	var born: Array = []
	field.cell_born.connect(func(cell: Vector3i, _s: Strain, _c: CellColony) -> void: born.append(cell))
	var colony := field.seed_cell(strain, Vector3i.ZERO)
	check(colony != null, "seeded")
	one_pass(field)
	check_eq(field.get_cell_count(), 2, "one division")
	for cell in field.get_cells():
		check_eq(energy_at(field, cell), 4.5, "energy split after the division cost")
		check_eq(cell.y, 0, "sideways only")
	check_eq(colony.size(), 2, "the child joins the parent's colony")
	check_eq(born.size(), 2, "born signal for the seed and the child")
	check_eq(field.get_ledger().metabolized, 1.0, "division cost")
	check_conserved(field, "mitosis")


func test_seeds_ripen_before_dividing() -> void:
	var field := make_field()
	var strain := make_strain({seed_energy = 10.0, split_energy = 8.0, mature_time = 1.0})
	field.seed_cell(strain, Vector3i.ZERO)
	field.simulate(0.5)
	check_eq(field.get_cell_count(), 1, "a seed doesn't divide")
	field.simulate(0.75)
	check(field.get_cell_count() >= 2, "a mature cell divides")


func test_starvation() -> void:
	var field := make_field()
	var strain := make_strain({metabolism = 4.0, seed_energy = 2.0})
	var causes: Array = []
	var dead_colonies: Array = []
	field.cell_died.connect(func(_c: Vector3i, _s: Strain, cause: StringName) -> void: causes.append(cause))
	field.colony_died.connect(func(colony: CellColony) -> void: dead_colonies.append(colony))
	var colony := field.seed_cell(strain, Vector3i.ZERO)
	field.simulate(1.0)
	check_eq(field.get_cell_count(), 0, "starved")
	check_eq(causes, [&"starved"], "cause")
	check_eq(dead_colonies, [colony], "colony died with its last cell")
	check_eq(field.get_ledger().metabolized, 2.0, "all energy burned")
	check_conserved(field, "starvation")


func test_feeding_depletes_substrate_and_leaves_residue() -> void:
	var field := make_field()
	var ash := make_substrate({id = &"ash"})
	var grass := make_substrate({id = &"grass", nutrients = {&"fuel": 3.0}})
	var fire := make_strain({feeds_on = &"fuel", feed_rate = 2.0, metabolism = 1.0, seed_energy = 1.0, residue = ash})
	var changed: Array = []
	field.substrate_changed.connect(func(cell: Vector3i, substrate: Substrate) -> void: changed.append([cell, substrate]))
	field.set_substrate(Vector3i.ZERO, grass)
	changed.clear()
	field.seed_cell(fire, Vector3i.ZERO)
	field.seed_cell(fire, Vector3i(5, 0, 5))
	field.simulate(1.0)
	check_eq(field.get_nutrient(Vector3i.ZERO, &"fuel"), 1.0, "two units eaten in a second")
	field.simulate(10.0)
	check_eq(field.get_cell_count(), 0, "both burned out")
	check_eq(field.get_substrate(Vector3i.ZERO), ash, "burned grass became ash")
	check_eq(field.get_substrate(Vector3i(5, 0, 5)), null, "no scar where nothing was eaten")
	check_eq(changed, [[Vector3i.ZERO, ash]], "substrate_changed for the scar")
	check_eq(field.get_ledger().fed, 3.0, "ate exactly what the grass held")
	check_conserved(field, "feeding")


func test_dormancy_and_waking() -> void:
	var field := make_field()
	var strain := make_strain({metabolism = 1.0, rest_energy = 2.0, wake_energy = 4.0,
		dormant_metabolism = 0.25, seed_energy = 3.0})
	field.seed_cell(strain, Vector3i.ZERO)
	field.simulate(1.25)
	check(field.get_cell_info(Vector3i.ZERO).dormant, "dormant below rest energy")
	var before := energy_at(field, Vector3i.ZERO)
	field.simulate(1.0)
	check_eq(before - energy_at(field, Vector3i.ZERO), 0.25, "dormant cells burn a quarter as fast")
	field.seed_cell(strain, Vector3i.ZERO, 5.0)
	one_pass(field)
	check(not field.get_cell_info(Vector3i.ZERO).dormant, "fed back above wake energy, it wakes")
	check_conserved(field, "dormancy")


func test_blocked_substrates_and_bounds() -> void:
	var field := make_field(Vector3i(3, 1, 1))
	var pond := make_substrate({blocks_tags = tags([&"fire"])})
	var rock := make_substrate({solid = true})
	var fire := make_strain({tags = tags([&"fire.ember"]), seed_energy = 20.0, split_energy = 5.0})
	field.set_substrate(Vector3i(1, 0, 0), pond)
	field.set_substrate(Vector3i(-1, 0, 0), rock)
	check(not field.can_hold(Vector3i(1, 0, 0), fire), "a pond blocks fire (by parent tag)")
	check(not field.can_hold(Vector3i(-1, 0, 0), fire), "rock is solid")
	check(not field.can_hold(Vector3i(0, 1, 0), fire), "above the field")
	check(not field.can_hold(Vector3i(0, 0, 1), fire), "beside the field")
	check(field.can_hold(Vector3i(1, 0, 0), make_strain({id = &"frost"})), "the pond admits other strains")
	field.seed_cell(fire, Vector3i.ZERO)
	field.simulate(3.0)
	check_eq(field.get_cell_count(), 1, "nowhere to divide")
	check(field.seed_cell(fire, Vector3i(1, 0, 0)) == null, "can't seed into the pond")
	check_conserved(field, "blocked")


func test_spread_weights() -> void:
	var field := make_field(Vector3i(8, 8, 8))
	var strain := make_strain({spread_up = 1.0, spread_side = 0.0, spread_down = 0.0,
		seed_energy = 64.0, split_energy = 2.0, division_cost = 0.0})
	field.seed_cell(strain, Vector3i.ZERO)
	field.simulate(3.0)
	check(field.get_cell_count() > 3, "grew")
	for cell in field.get_cells():
		check(cell.x == 0 and cell.z == 0, "fire-like strains only climb: %s" % cell)


func test_wind_bias() -> void:
	var field := make_field(Vector3i(24, 1, 24))
	field.wind = Vector3(5, 0, 0)
	var strain := make_strain({spread_up = 0.0, spread_down = 0.0, wind_factor = 1.0,
		seed_energy = 100.0, split_energy = 3.0, division_cost = 0.0})
	field.seed_cell(strain, Vector3i.ZERO)
	field.simulate(2.0)
	var mean := Vector3.ZERO
	for cell in field.get_cells():
		mean += Vector3(cell)
		check(cell.x >= 0, "never spreads against the wind")
	mean /= field.get_cell_count()
	check(mean.x > 1.0 and mean.x > absf(mean.z) + 0.5, "leans downwind: %s" % mean)


func test_wounds_heal_and_necrosis() -> void:
	var field := make_field()
	var strain := make_strain({max_wounds = 3, heal_time = 1.0, heal_cost = 1.0, seed_energy = 10.0})
	var cell := Vector3i(2, 0, 2)
	field.seed_cell(strain, cell)
	var wounds_seen: Array = []
	var causes: Array = []
	field.cell_wounded.connect(func(_c: Vector3i, _s: Strain, wounds: int) -> void: wounds_seen.append(wounds))
	field.cell_died.connect(func(_c: Vector3i, _s: Strain, cause: StringName) -> void: causes.append(cause))
	check_eq(field.wound_area(field.cell_to_world(cell), 0.1, 1, 2.0), 1, "one cell hit")
	check_eq(field.get_cell_info(cell).wounds, 1, "wounded")
	check_eq(energy_at(field, cell), 8.0, "wounds burn energy")
	field.simulate(1.25)
	check_eq(field.get_cell_info(cell).wounds, 0, "healed")
	check_eq(energy_at(field, cell), 7.0, "healing costs energy")
	field.wound_area(field.cell_to_world(cell), 0.1, 3)
	check(not field.has_cell(cell), "too many wounds is necrosis")
	check_eq(causes, [&"wounds"], "cause")
	check_eq(wounds_seen, [1, 3], "wound signals")
	check_conserved(field, "wounds")


func test_root_supply_and_severing() -> void:
	var field := make_field(Vector3i(16, 1, 1))
	var strain := make_strain({root_regen = 4.0, supply_rate = 1.0, metabolism = 0.5, seed_energy = 5.0,
		rest_energy = 0.1, wake_energy = 0.2, judge_interval = 0.5})
	var colony := field.seed_cell(strain, Vector3i.ZERO, -1.0, true)
	for x in range(1, 5):
		field.seed_cell(strain, Vector3i(x, 0, 0))
	check_eq(colony.size(), 5, "neighbours join the root's colony")
	check(colony.has_root and colony.root_alive, "has a living root")
	field.simulate(0.5)
	check_eq(colony.connected_count, 5, "all connected after the first judgement")
	field.clear_area(field.cell_to_world(Vector3i(2, 0, 0)), 0.1)
	field.simulate(0.5)
	check_eq(colony.connected_count, 2, "the gap cuts the far cells off")
	var near_before := energy_at(field, Vector3i(1, 0, 0))
	var far_before := energy_at(field, Vector3i(3, 0, 0))
	field.simulate(2.0)
	check(energy_at(field, Vector3i(1, 0, 0)) > near_before, "connected cells are fed by the root")
	check(energy_at(field, Vector3i(3, 0, 0)) < far_before, "cut-off cells starve")
	var severed: Array = []
	field.colony_severed.connect(func(c: CellColony) -> void: severed.append(c))
	field.clear_area(field.cell_to_world(Vector3i.ZERO), 0.1)
	check_eq(severed, [colony], "killing the root severs the colony")
	field.simulate(0.5)
	check_eq(colony.verdict, &"severed", "the judge says so")
	var near := energy_at(field, Vector3i(1, 0, 0))
	field.simulate(1.0)
	check(energy_at(field, Vector3i(1, 0, 0)) < near, "no more supply")
	check_conserved(field, "roots")


func test_root_promotes_existing_cell() -> void:
	var field := make_field()
	var strain := make_strain()
	var colony := field.seed_cell(strain, Vector3i.ZERO)
	check(not colony.has_root, "plain seed")
	check(field.seed_cell(strain, Vector3i.ZERO, 1.0, true) == colony, "same colony")
	check(colony.root_alive and field.get_cell_info(Vector3i.ZERO).root, "promoted to root")
	check_conserved(field, "promotion")


func test_judge_evolves() -> void:
	var field := make_field()
	var wild := make_strain({id = &"wildfire"})
	var ember := make_strain({id = &"ember", seed_energy = 40.0, split_energy = 4.0, division_cost = 0.0,
		judge_interval = 0.5, evolve_into = wild, evolve_at_cells = 4})
	var evolved: Array = []
	field.colony_evolved.connect(func(_c: CellColony, from: Strain, to: Strain) -> void: evolved.append([from, to]))
	var colony := field.seed_cell(ember, Vector3i.ZERO)
	field.simulate(1.0)
	check_eq(evolved, [[ember, wild]], "evolved once")
	check_eq(colony.strain, wild, "colony strain")
	check_eq(colony.generation, 1, "generation")
	check_eq(field.get_cell_count(ember), 0, "no ember cells left")
	check_eq(field.get_cell_count(wild), colony.size(), "every cell evolved")
	check_conserved(field, "evolution")


func test_judge_senescence() -> void:
	var field := make_field()
	var strain := make_strain({seed_energy = 40.0, split_energy = 4.0, division_cost = 0.0,
		judge_interval = 0.5, lifespan = 1.0})
	var verdicts: Array = []
	field.colony_judged.connect(func(_c: CellColony, verdict: StringName) -> void: verdicts.append(verdict))
	var colony := field.seed_cell(strain, Vector3i.ZERO)
	field.simulate(1.0)
	check(colony.senescent and colony.verdict == &"senescent", "old age")
	check_eq(verdicts, [&"growing", &"senescent"], "verdicts")
	var count := colony.size()
	field.seed_cell(strain, field.get_cells()[0], 40.0)
	field.simulate(2.0)
	check_eq(colony.size(), count, "senescent colonies don't divide")


# --- Reactions -------------------------------------------------------------------

func test_reaction_wounds_at_the_border() -> void:
	var field := make_field(Vector3i(2, 1, 1))
	var attacker := make_strain({id = &"attacker", seed_energy = 20.0, split_energy = 5.0,
		spread_up = 0.0, spread_down = 0.0})
	var defender := make_strain({id = &"defender", seed_energy = 10.0})
	# Listed in the other order on purpose: reactions work both ways round.
	field.reactions = reactions([make_reaction({strain_a = defender, strain_b = attacker, wound_a = 1, wound_energy = 2.0})])
	field.seed_cell(attacker, Vector3i(-1, 0, 0))
	field.seed_cell(defender, Vector3i.ZERO)
	var reacted: Array = []
	field.reacted.connect(func(cell: Vector3i, _r: Reaction) -> void: reacted.append(cell))
	for i in 60:
		one_pass(field)
		if not reacted.is_empty():
			break
	check_eq(reacted, [Vector3i.ZERO], "reacted at the defender's voxel")
	check_eq(field.get_cell_info(Vector3i.ZERO).wounds, 1, "defender wounded")
	check_eq(energy_at(field, Vector3i.ZERO), 8.0, "wound energy")
	check_eq(energy_at(field, Vector3i(-1, 0, 0)), 20.0, "attacker unharmed, and didn't divide")
	check_conserved(field, "border")


func test_reaction_product_and_burst() -> void:
	var field := make_field(Vector3i(2, 1, 1))
	var ember := make_strain({id = &"ember", seed_energy = 20.0, split_energy = 5.0, spread_up = 0.0, spread_down = 0.0})
	var spore := make_strain({id = &"spore", seed_energy = 10.0})
	var blast := make_effect({id = &"blast", duration_type = Effect.DurationType.INSTANT,
		instant_changes = mods([mod(&"health", StatModifier.Operation.ADD, -15.0)])})
	field.reactions = reactions([make_reaction({strain_a = ember, strain_b = spore, product = ember,
		efficiency = 0.5, burst_effect = blast, burst_radius = 3.0, burst_color = Color.ORANGE})])
	var host := make_host(field, feet(field, Vector3i.ZERO) + Vector3(0, 0, 1.2))
	field.seed_cell(ember, Vector3i(-1, 0, 0))
	field.seed_cell(spore, Vector3i.ZERO)
	var reacted := [0]
	field.reacted.connect(func(_c: Vector3i, _r: Reaction) -> void: reacted[0] += 1)
	for i in 60:
		one_pass(field)
		if reacted[0] > 0:
			break
	check_eq(field.get_strain_at(field.cell_to_world(Vector3i.ZERO)), ember, "the spores became fire")
	check_eq(energy_at(field, Vector3i.ZERO), 15.0, "half the pooled energy")
	check(not field.has_cell(Vector3i(-1, 0, 0)), "the attacking cell was consumed")
	check_eq(host.get_component().get_stat(&"health"), 85.0, "the blast hit the host")
	check_conserved(field, "product")


func test_seeding_into_another_strain_reacts() -> void:
	var field := make_field()
	var fire := make_strain({id = &"fire"})
	var water := make_strain({id = &"water"})
	field.reactions = reactions([make_reaction({strain_a = fire, strain_b = water, wound_a = 3, wound_energy = 1.0})])
	var cell := Vector3i(1, 0, 1)
	field.seed_cell(fire, cell, 10.0)
	field.seed_cell(water, cell, 6.0)
	check_eq(field.get_strain_at(field.cell_to_world(cell)), water, "water put the fire out and moved in")
	check_eq(energy_at(field, cell), 6.0, "with all its energy")
	check(field.seed_cell(make_strain({id = &"stranger"}), cell) == null, "no reaction, no entry")
	check_conserved(field, "seed reaction")


func test_products_join_neighbouring_colonies() -> void:
	var field := make_field(Vector3i(3, 1, 1))
	var ember := make_strain({id = &"ember", split_energy = 5.0, spread_up = 0.0, spread_down = 0.0})
	var spore := make_strain({id = &"spore"})
	field.reactions = reactions([make_reaction({strain_a = ember, strain_b = spore, product = ember})])
	field.seed_cell(ember, Vector3i(-1, 0, 0), 20.0)
	field.seed_cell(spore, Vector3i.ZERO, 10.0)
	var neighbour := field.seed_cell(ember, Vector3i(1, 0, 0), 1.0)
	for i in 60:
		one_pass(field)
		if field.get_strain_at(field.cell_to_world(Vector3i.ZERO)) == ember:
			break
	check_eq(field.get_cell_info(Vector3i.ZERO).get("colony"), neighbour, "joined the neighbouring colony")


# --- Hosts -----------------------------------------------------------------------

func test_host_infection_moves_energy() -> void:
	var field := make_field()
	var burn := burn_effect()
	var fire := make_strain({id = &"fire", infection_effect = burn, infection_cost = 2.0, seed_energy = 10.0, shed_energy = 0.0})
	var cell := Vector3i.ZERO
	field.seed_cell(fire, cell)
	var host := make_host(field, feet(field, cell))
	var infected: Array = []
	field.host_infected.connect(func(h: CellHost, s: Strain) -> void: infected.append([h, s]))
	one_pass(field)
	check(host.get_component().has_effect(burn), "caught the burn")
	check_eq(host.get_carried(fire), 2.0, "carries the cell's energy")
	check_eq(energy_at(field, cell), 8.0, "the cell paid for it")
	check_eq(infected, [[host, fire]], "signal")
	one_pass(field)
	check_eq(host.get_carried(fire), 2.0, "no reinfection during the cooldown")
	field.simulate(0.5)
	check_eq(host.get_carried(fire), 4.0, "reinfected after the cooldown")
	check_conserved(field, "infection")


func test_carriers_shed_where_they_walk() -> void:
	var field := make_field(Vector3i(48, 4, 8))
	var fire := make_strain({id = &"fire", infection_effect = burn_effect(), infection_cost = 9.0,
		seed_energy = 20.0, shed_energy = 3.0, shed_interval = 0.25})
	var start := Vector3i(-20, 0, 0)
	field.seed_cell(fire, start)
	var host := make_host(field, feet(field, start))
	one_pass(field)
	check_eq(host.get_carried(fire), 9.0, "infected")
	# Walk away three voxels a pass, so the host never stands on its own sheds.
	for i in 8:
		host.get_parent().global_position = feet(field, start + Vector3i(3 * (i + 1), 0, 0))
		one_pass(field)
	var trail := field.get_cells(fire).filter(func(c: Vector3i) -> bool: return c.x > start.x + 1)
	check_eq(trail.size(), 3, "three sheds of three along the path")
	check_eq(host.get_carried(fire), 0.0, "carried energy all shed")
	check_eq(field.get_ledger().from_hosts, 9.0, "ledger")
	check_conserved(field, "shedding")


func test_host_death_releases_energy() -> void:
	var field := make_field()
	var fire := make_strain({id = &"fire", infection_effect = burn_effect(), infection_cost = 9.0,
		seed_energy = 20.0, shed_energy = 0.0})
	field.seed_cell(fire, Vector3i.ZERO)
	var host := make_host(field, feet(field, Vector3i(0, 0, 0)))
	one_pass(field)
	host.get_parent().global_position = feet(field, Vector3i(5, 0, 5))
	var released: Array = []
	field.host_released.connect(func(_h: CellHost, _s: Strain, energy: float) -> void: released.append(energy))
	host.get_component().modify_base_stat(&"health", -1000.0)
	check_eq(released, [9.0], "released on death")
	check_eq(host.get_carried(), 0.0, "nothing left on the body")
	check(field.get_cells(fire).any(func(c: Vector3i) -> bool: return c.distance_to(Vector3i(5, 0, 5)) <= 2.0),
		"the energy came back as cells around the body")
	check_conserved(field, "death")


func test_freed_host_returns_energy() -> void:
	var field := make_field()
	var fire := make_strain({id = &"fire", infection_effect = burn_effect(), infection_cost = 9.0,
		seed_energy = 20.0, shed_energy = 0.0})
	field.seed_cell(fire, Vector3i.ZERO)
	var host := make_host(field, feet(field, Vector3i.ZERO))
	one_pass(field)
	var before := field.get_cell_count()
	host.get_parent().free()
	check(field.get_cell_count() > before, "released into the field")
	check(field.get_hosts().is_empty(), "unregistered")
	check_conserved(field, "freed")


func test_cured_hosts_dissipate_what_they_carry() -> void:
	var field := make_field()
	var burn := burn_effect()
	var fire := make_strain({id = &"fire", infection_effect = burn, infection_cost = 9.0, seed_energy = 20.0})
	field.seed_cell(fire, Vector3i.ZERO)
	var host := make_host(field, feet(field, Vector3i.ZERO))
	one_pass(field)
	host.get_parent().global_position = feet(field, Vector3i(6, 0, 6))
	host.get_component().remove_effect(burn)
	one_pass(field)
	check_eq(host.get_carried(fire), 0.0, "spent")
	check_eq(field.get_ledger().host_dissipated, 9.0, "ledger")
	check_conserved(field, "cured")


func test_resistance_and_immunity() -> void:
	var field := make_field()
	var fire := make_strain({id = &"fire", infection_effect = burn_effect(), seed_energy = 20.0})
	field.seed_cell(fire, Vector3i.ZERO)
	var resistant := make_host(field, feet(field, Vector3i.ZERO))
	resistant.resistances = {&"fire": 1.0}
	var immune := make_host(field, feet(field, Vector3i.ZERO))
	immune.get_component().immunities = tags([&"fire"])
	field.simulate(2.0)
	check_eq(resistant.get_carried(), 0.0, "resisted")
	check(not resistant.get_component().has_effect(&"burn"), "no burn")
	check_eq(immune.get_carried(), 0.0, "immune hosts take no energy")
	check_eq(energy_at(field, Vector3i.ZERO), 20.0, "the cell kept its energy")


# --- Whole-system properties -----------------------------------------------------

func test_energy_is_conserved_in_chaos() -> void:
	for seed_value in [11, 22, 33]:
		var field := make_field(Vector3i(20, 6, 20), 0.5)
		field.rng_seed = seed_value
		field.max_cells = 700
		var rng := RandomNumberGenerator.new()
		rng.seed = seed_value
		var ash := make_substrate({id = &"ash", nutrients = {&"organic": 1.0}})
		var grounds: Array[Substrate] = [
			make_substrate({id = &"grass", nutrients = {&"fuel": 6.0, &"organic": 4.0}}),
			make_substrate({id = &"wood", nutrients = {&"fuel": 12.0}}),
			make_substrate({id = &"pond", nutrients = {&"water": 5.0}, blocks_tags = tags([&"fire"])}),
			make_substrate({id = &"rock", solid = true}),
		]
		for x in range(-10, 10):
			for z in range(-10, 10):
				field.set_substrate(Vector3i(x, 0, z), grounds[rng.randi() % grounds.size()])
		var burn := burn_effect()
		var steam := make_strain({id = &"steam", metabolism = 3.0, spread_up = 3.0, split_energy = 4.0})
		var fire := make_strain({id = &"fire", tags = tags([&"fire"]), feeds_on = &"fuel", feed_rate = 3.0,
			metabolism = 1.0, split_energy = 6.0, residue = ash, infection_effect = burn, shed_energy = 2.0,
			max_energy = 12.0, spread_up = 2.0})
		var frost := make_strain({id = &"frost", feeds_on = &"water", feed_rate = 2.0, metabolism = 0.5, split_energy = 5.0})
		var spore := make_strain({id = &"spore", feeds_on = &"organic", feed_rate = 1.5, metabolism = 0.4,
			split_energy = 4.0, root_regen = 2.0, supply_rate = 0.3, judge_interval = 0.5})
		var water := make_strain({id = &"water", metabolism = 2.0, split_energy = 3.0, spread_down = 3.0})
		field.reactions = reactions([
			make_reaction({strain_a = fire, strain_b = spore, product = fire, efficiency = 0.6, burst_effect = burn, burst_radius = 1.5}),
			make_reaction({strain_a = fire, strain_b = frost, wound_a = 1, wound_b = 1}),
			make_reaction({strain_a = fire, strain_b = water, product = steam, efficiency = 0.5}),
			make_reaction({strain_a = frost, strain_b = water, product = frost, efficiency = 0.8}),
			make_reaction({strain_a = spore, strain_b = frost, wound_a = 1, chance = 0.5}),
		])
		var hosts: Array[CellHost] = []
		for i in 3:
			hosts.append(make_host(field, field.cell_to_world(Vector3i(rng.randi_range(-8, 8), 0, rng.randi_range(-8, 8)))))
		field.seed_cell(spore, Vector3i(-6, 0, -6), 30.0, true)
		var all_strains: Array[Strain] = [fire, frost, spore, water]
		for i in 12:
			field.seed_cell(all_strains[i % 4], Vector3i(rng.randi_range(-9, 9), rng.randi_range(0, 2), rng.randi_range(-9, 9)), 15.0)
		for step in 50:
			field.simulate(0.25)
			var roll := rng.randi() % 6
			var spot := field.cell_to_world(Vector3i(rng.randi_range(-9, 9), 0, rng.randi_range(-9, 9)))
			match roll:
				0:
					field.spray(water, spot, 1.0, 4.0)
				1:
					field.wound_area(spot, 1.5, 1, 3.0)
				2:
					field.spray(fire, spot, 0.8, 8.0, true)
				3:
					if not hosts.is_empty() and step % 10 == 9:
						var gone: CellHost = hosts.pop_back()
						if step % 20 == 9:
							gone.get_parent().free()
						else:
							gone.get_component().modify_base_stat(&"health", -1000.0)
							field.remove_host(gone, false)
			for host in hosts:
				if is_instance_valid(host):
					host.get_parent().global_position = field.cell_to_world(
						Vector3i(rng.randi_range(-9, 9), 0, rng.randi_range(-9, 9)))
			if step % 5 == 4:
				check_conserved(field, "seed %d step %d" % [seed_value, step])
		check(field.get_ledger().fed > 0.0 and field.get_ledger().to_hosts > 0.0, "the run exercised feeding and hosts")
		check(field.get_cell_count() <= 700, "max_cells respected")


func test_frame_budget_rests_instead_of_hitching() -> void:
	var field := make_field(Vector3i(40, 1, 40))
	var strain := make_strain()
	for x in range(-20, 20):
		for z in range(-20, 20):
			field.seed_cell(strain, Vector3i(x, 0, z))
	field.frame_budget_ms = 0.001
	field._advance(field.get_step(), true)
	check(field._pass_open, "the pass didn't fit in one frame")
	check_eq(field.get_pass_count(), 0, "not finished yet")
	var frames := 1
	while field._pass_open and frames < 10000:
		field._advance(0.0, true)
		frames += 1
	check(frames > 1, "spread over %d frames" % frames)
	check_eq(field.get_pass_count(), 1, "then finished")
	field.frame_budget_ms = 0.001
	field._advance(field.get_step(), true)
	field.simulate(field.get_step())
	check_eq(field.get_pass_count(), 3, "simulate finishes an open pass first")


func test_max_cells() -> void:
	var field := make_field()
	field.max_cells = 10
	var strain := make_strain({seed_energy = 100.0, split_energy = 2.0, division_cost = 0.0})
	field.seed_cell(strain, Vector3i.ZERO)
	field.simulate(3.0)
	check_eq(field.get_cell_count(), 10, "capped")
	check_conserved(field, "cap")


# --- Painting, queries and rendering ---------------------------------------------

func test_spray_and_clear() -> void:
	var field := make_field()
	var strain := make_strain()
	var center := field.cell_to_world(Vector3i(0, 2, 0))
	check_eq(field.spray(strain, center, 1.0), 7, "centre and six neighbours")
	check_eq(field.get_cell_count(), 7, "cells")
	var causes: Array = []
	field.cell_died.connect(func(_c: Vector3i, _s: Strain, cause: StringName) -> void: causes.append(cause))
	check_eq(field.clear_area(center, 1.0), 7, "cleared")
	check(causes.all(func(c: StringName) -> bool: return c == &"cleared"), "cause")
	var grass := make_substrate({nutrients = {&"fuel": 5.0}})
	field.set_substrate(Vector3i.ZERO, grass)
	var eater := make_strain({id = &"eater", feeds_on = &"fuel"})
	check_eq(field.spray(eater, field.cell_to_world(Vector3i.ZERO), 1.5, -1.0, true), 1, "only where there's food")
	check_conserved(field, "spray")


func test_substrate_volumes() -> void:
	var field := make_field(Vector3i(24, 8, 24), 0.5)
	var grass := make_substrate({id = &"grass"})
	var shapes := [
		[SubstrateVolume.Shape.BOX, Vector3(2, 1, 2), Vector3.ZERO, 32],
		[SubstrateVolume.Shape.CYLINDER, Vector3(2, 0.5, 2), Vector3(4, 0, 4), 12],
		[SubstrateVolume.Shape.SPHERE, Vector3(2, 2, 2), Vector3(-4, 0, -4), 32],
	]
	for spec in shapes:
		var volume := SubstrateVolume.new()
		volume.substrate = grass
		volume.field = field
		volume.shape = spec[0]
		volume.size = spec[1]
		tree.root.add_child(track(volume))
		volume.global_position = spec[2]
		check_eq(volume.paint(), spec[3], "voxels painted by %s" % SubstrateVolume.Shape.keys()[spec[0]])
	var ragged := SubstrateVolume.new()
	ragged.substrate = grass
	ragged.field = field
	ragged.size = Vector3(2, 1, 2)
	ragged.gaps = 0.5
	tree.root.add_child(track(ragged))
	ragged.global_position = Vector3(4, 0, -4)
	var count := ragged.paint()
	check(count > 0 and count < 32, "gaps leave holes: %d" % count)


func test_substrate_provider() -> void:
	var field := make_field()
	var grass := make_substrate({nutrients = {&"fuel": 50.0}})
	var calls := [0]
	field.substrate_provider = func(cell: Vector3i) -> Substrate:
		calls[0] += 1
		return grass if cell.y == 0 else null
	check_eq(field.get_substrate(Vector3i(3, 0, 3)), grass, "provided")
	check_eq(field.get_substrate(Vector3i(3, 0, 3)), grass, "cached")
	check_eq(calls[0], 1, "asked once")
	check_eq(field.get_substrate(Vector3i(3, 1, 3)), null, "air")
	field.seed_cell(make_strain({feeds_on = &"fuel", feed_rate = 2.0}), Vector3i.ZERO, 1.0)
	one_pass(field)
	check(field.get_ledger().fed > 0.0, "cells eat provided substrates")


func test_renderer_draws_cells_and_substrates() -> void:
	var field := make_field(Vector3i(16, 4, 16), 0.5, true)
	var cubes := make_strain({id = &"cubes"})
	var slabs := make_strain({id = &"slabs", shape = Strain.Shape.SLAB})
	var grass := make_substrate({id = &"grass", shape = Substrate.Shape.SLAB, color = Color(0.2, 0.5, 0.1)})
	var ash := make_substrate({id = &"ash", color = Color(0.4, 0.4, 0.4)})
	check_eq(field.paint_box(Vector3(-1, 0, -1), Vector3(1, 0.5, 1), grass), 16, "painted")
	field.seed(cubes, Vector3(0.25, 0.25, 0.25))
	field.seed(slabs, Vector3(-0.75, 0.25, -0.75))
	field.seed(slabs, Vector3(0.75, 0.25, 0.75))
	one_pass(field)
	var renderer = field._renderer
	check(renderer != null, "renderer created")
	if renderer == null:
		return
	check_eq(renderer._layers[cubes].multimesh.visible_instance_count, 1, "cube layer")
	check_eq(renderer._layers[slabs].multimesh.visible_instance_count, 2, "slab layer")
	check_eq(renderer._ground.multimesh.visible_instance_count, 16, "substrate layer")
	field.set_substrate(Vector3i.ZERO, ash)
	field.set_substrate(Vector3i(5, 0, 5), ash)
	one_pass(field)
	check_eq(renderer._ground.multimesh.visible_instance_count, 17, "patched in place, plus one new voxel")
	var index: int = renderer._ground_index[Vector3i.ZERO]
	var buffer: PackedFloat32Array = renderer._ground.multimesh.buffer
	check(Color(buffer[index * 20 + 12], buffer[index * 20 + 13], buffer[index * 20 + 14]).is_equal_approx(ash.color),
		"the scar is drawn in ash colour")
	field.clear()
	one_pass(field)
	check_eq(renderer._layers[cubes].multimesh.visible_instance_count, 0, "empty layers hide")


func test_renderer_lights_and_particles() -> void:
	var field := make_field(Vector3i(16, 4, 16), 0.5, true)
	var scene := PackedScene.new()
	var particles := CPUParticles3D.new()
	scene.pack(particles)
	particles.free()
	var glow := make_strain({id = &"glow", max_lights = 2, light_energy = 2.0, light_color = Color.ORANGE,
		particles = scene, max_emitters = 3})
	for x in [-6, 0, 6]:
		field.seed_cell(glow, Vector3i(x, 0, 0))
	one_pass(field)
	var renderer = field._renderer
	check_eq(renderer._lights[glow].size(), 2, "a light on each of the two biggest colonies")
	check_eq(renderer._light_targets[glow].size(), 2, "with target brightness")
	check_eq(renderer._emitters[glow].size(), 3, "emitters")
	check(renderer._emitters[glow].all(func(e: Node) -> bool: return e.emitting), "all emitting")


func test_fx_3d_impacts() -> void:
	var light := Fx.impact_light(Vector3(1, 2, 3), Color.ORANGE, 4.0, 5.0, 0.1)
	check(light is OmniLight3D and light.global_position.is_equal_approx(Vector3(1, 2, 3)), "light placed")
	var ring := Fx.shockwave(Vector3.ZERO, Color.WHITE, 2.0, 0.1)
	check(ring is MeshInstance3D, "ring")
	var burst := Fx.voxel_burst(Vector3.ZERO, Color.RED, 8)
	check(burst != null and burst.emitting, "burst emitting")
	await wait_seconds(1.4)
	check(not is_instance_valid(light), "light faded and freed")
	check(not is_instance_valid(ring), "ring freed")
	check(not is_instance_valid(burst), "burst freed when finished")


func test_reactions_by_tag() -> void:
	var field := make_field()
	var ember := make_strain({id = &"ember", tags = tags([&"fire.ember"])})
	var wildfire := make_strain({id = &"wildfire", tags = tags([&"fire.wild"])})
	var water := make_strain({id = &"water", tags = tags([&"water"])})
	var steam := make_strain({id = &"steam"})
	var quench := make_reaction({tag_a = &"fire", tag_b = &"water", product = steam, efficiency = 1.0})
	field.reactions = reactions([quench])
	check(quench.joins(water, wildfire), "matches by parent tag, either order")
	check(not quench.joins(ember, wildfire), "fire doesn't quench fire")
	check_eq(field.get_reaction(water, ember), quench, "found for ember")
	field.seed_cell(wildfire, Vector3i(1, 0, 1), 5.0)
	field.seed_cell(water, Vector3i(1, 0, 1), 3.0)
	check_eq(field.get_strain_at(field.cell_to_world(Vector3i(1, 0, 1))), steam, "steam")
	check_eq(energy_at(field, Vector3i(1, 0, 1)), 8.0, "pooled")
	check_conserved(field, "tag reaction")


func test_substrates_choose_their_residue() -> void:
	var field := make_field()
	var ash := make_substrate({id = &"ash"})
	var charcoal := make_substrate({id = &"charcoal"})
	var air := make_substrate({id = &"air", shape = Substrate.Shape.HIDDEN})
	var wood := make_substrate({id = &"wood", nutrients = {&"fuel": 1.0}, residues = {&"fire": charcoal}})
	var leaves := make_substrate({id = &"leaves", nutrients = {&"fuel": 1.0}, residues = {&"ember": air}})
	var grass := make_substrate({id = &"grass", nutrients = {&"fuel": 1.0}})
	var ember := make_strain({id = &"ember", tags = tags([&"fire"]), feeds_on = &"fuel", feed_rate = 4.0,
		metabolism = 2.0, seed_energy = 1.0, residue = ash})
	field.set_substrate(Vector3i(0, 0, 0), wood)
	field.set_substrate(Vector3i(3, 0, 0), leaves)
	field.set_substrate(Vector3i(6, 0, 0), grass)
	for x in [0, 3, 6]:
		field.seed_cell(ember, Vector3i(x, 0, 0))
	field.simulate(5.0)
	check_eq(field.get_cell_count(), 0, "all burned out")
	check_eq(field.get_substrate(Vector3i(0, 0, 0)), charcoal, "wood chars (matched by tag)")
	check_eq(field.get_substrate(Vector3i(3, 0, 0)), air, "leaves vanish (matched by id)")
	check_eq(field.get_substrate(Vector3i(6, 0, 0)), ash, "grass falls back to the strain's ash")


func test_cell_source() -> void:
	var field := make_field()
	var grass := make_substrate({nutrients = {&"fuel": 5.0}})
	field.paint_box(Vector3(-2, 0, -2), Vector3(2, 1, 2), grass)
	var ember := make_strain({id = &"ember", feeds_on = &"fuel", seed_energy = 3.0})
	var vent := CellSource.new()
	vent.strain = ember
	vent.field = field
	vent.interval = 0.5
	vent.radius = 1.2
	tree.root.add_child(track(vent))
	vent.global_position = Vector3(0, 0, 0)
	check(vent.emit_now() > 0, "sprays where there's food")
	var count := field.get_cell_count()
	field.clear()
	vent._physics_process(0.1)
	check_eq(field.get_cell_count(), count, "seeds on its first tick")
	field.clear()
	vent._physics_process(0.3)
	check_eq(field.get_cell_count(), 0, "waits for the interval")
	vent._physics_process(0.3)
	check_eq(field.get_cell_count(), count, "then seeds again")
	var heart := CellSource.new()
	heart.strain = make_strain({id = &"blight", root_regen = 1.0})
	heart.field = field
	heart.plant_root = true
	heart.interval = 0.0
	tree.root.add_child(track(heart))
	heart.global_position = Vector3(5.5, 0.5, 5.5)
	heart._physics_process(0.1)
	check(heart.colony != null and heart.colony.root_alive, "planted a root")
	field.clear()
	check(not heart.colony.root_alive, "root died")
	heart.emit_now()
	check(heart.colony.root_alive, "replanted")
	check_conserved(field, "source")


func test_save_and_restore_the_world() -> void:
	var dir := "user://living_test/"
	DirAccess.make_dir_recursive_absolute(dir)
	var ash := make_substrate({id = &"ash"})
	var grass := make_substrate({id = &"grass", nutrients = {&"fuel": 6.0, &"organic": 3.0}, residues = {&"fire": ash}})
	var blight := make_strain({id = &"blight", feeds_on = &"organic", feed_rate = 1.0, metabolism = 0.3,
		split_energy = 4.0, root_regen = 2.0, supply_rate = 0.4, judge_interval = 0.5, mature_time = 0.2})
	var fire := make_strain({id = &"fire", feeds_on = &"fuel", feed_rate = 3.0, metabolism = 1.0, split_energy = 6.0})
	# Saved resources, because the snapshot refers to them by path.
	for pair in [[ash, "ash"], [grass, "grass"], [blight, "blight"], [fire, "fire"]]:
		ResourceSaver.save(pair[0], dir + pair[1] + ".tres")
	ash = load(dir + "ash.tres")
	grass = load(dir + "grass.tres")
	blight = load(dir + "blight.tres")
	fire = load(dir + "fire.tres")
	var field := make_field()
	field.paint_box(Vector3(-8, 0, -8), Vector3(8, 1, 8), grass)
	field.seed_cell(blight, Vector3i(-4, 0, -4), 10.0, true)
	field.seed_cell(fire, Vector3i(4, 0, 4), 10.0)
	field.simulate(3.0)
	var json := JSON.stringify(field.get_state())
	var state: Dictionary = JSON.parse_string(json)
	check(state is Dictionary and state.version == 1, "survives JSON")
	var copy := make_field()
	copy.set_state(state)
	check_eq(copy.get_cell_count(), field.get_cell_count(), "same cells")
	check_eq(copy.get_energy(), field.get_energy(), "same energy")
	check_eq(copy.get_colonies().size(), field.get_colonies().size(), "same colonies")
	check_eq(copy._substrates.size(), field._substrates.size(), "same substrates and scars")
	var root_colony: CellColony = copy.get_colonies(blight)[0] if not copy.get_colonies(blight).is_empty() else null
	check(root_colony != null and root_colony.root_alive, "the blight root survived the round trip")
	for cell in field.get_cells():
		check_eq(copy.get_cell_info(cell).get("energy", -1.0), field.get_cell_info(cell).energy, "cell %s" % cell)
		break
	check_eq(copy.get_nutrient(Vector3i(4, 0, 4), &"fuel"), field.get_nutrient(Vector3i(4, 0, 4), &"fuel"), "nutrients")
	check_conserved(copy, "restored")
	copy.simulate(3.0)
	check_conserved(copy, "restored world keeps living")
	for file in DirAccess.get_files_at(dir):
		DirAccess.remove_absolute(dir + file)
