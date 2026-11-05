extends "res://tests/test_suite.gd"
## Tests for the Cinder Caldera demo: its resources load, its abilities work, and
## its world actually lives (and keeps its books) when left running.

const LIVING := "res://demo/living/"


func files_in(dir: String, suffix: String) -> Array[String]:
	var found: Array[String] = []
	for file in DirAccess.get_files_at(dir):
		file = file.trim_suffix(".remap")
		if file.ends_with(suffix):
			found.append(dir + file)
	return found


func start_demo(args: Dictionary = {}) -> Node:
	var demo: Node = load("res://demo/demo.tscn").instantiate()
	for key in args:
		demo._opts[key] = args[key]
	tree.root.add_child(track(demo))
	tree.current_scene = demo
	return demo


func stop_demo() -> void:
	Engine.time_scale = 1.0
	tree.current_scene = null


func test_demo_resources_load() -> void:
	var strains := files_in(LIVING + "strains/", ".tres")
	var substrates := files_in(LIVING + "substrates/", ".tres")
	var reactions := files_in(LIVING + "reactions/", ".tres")
	var effects := files_in(LIVING + "effects/", ".tres")
	check(strains.size() >= 8 and substrates.size() >= 14 and reactions.size() >= 7 and effects.size() >= 7,
		"all resource kinds present")
	for path in strains:
		var strain := load(path) as Strain
		check(strain != null and String(strain.id) == path.get_file().get_basename(), "%s is a Strain with a matching id" % path)
		if strain != null and strain.infection_effect != null:
			check(strain.infection_effect is Effect, "%s infects with an Effect" % path)
	for path in substrates:
		check(load(path) is Substrate, "%s is a Substrate" % path)
	for path in reactions:
		var reaction := load(path) as Reaction
		check(reaction != null and (reaction.strain_a != null or reaction.tag_a != &"")
			and (reaction.strain_b != null or reaction.tag_b != &""), "%s has two sides" % path)
	for path in effects:
		check(load(path) is Effect, "%s is an Effect" % path)
	for path in files_in(LIVING + "particles/", ".tscn"):
		var node: Node = load(path).instantiate()
		check(node is CPUParticles3D, "%s is a particle scene" % path)
		node.free()


func test_demo_abilities() -> void:
	var demo := start_demo()
	await tree.process_frame
	var field: CellField = demo.field
	var meadow := Vector3(-3.25, 0.25, 4.75)
	demo.cast(0, meadow)
	check(field.get_cell_count(demo.EMBER) > 0, "Ember ignites the meadow")
	demo.cast(2, meadow)
	check(field.get_cell_count(load(LIVING + "strains/steam.tres")) > 0, "Deluge turns fire to steam")
	var pond := Vector3(-8.25, 0.25, -7.25)
	demo.cast(1, pond)
	check(field.get_cell_count(demo.RIME) > 0, "Rime freezes the pond")
	demo.cast(4, Vector3(3.25, 0.25, 4.75))
	check(field.get_cell_count(demo.MYCELIUM) > 0, "Mycelium spreads")
	var blight_before := field.get_cell_count(demo.BLIGHT)
	demo.cast(3, Vector3(4.75, 0.25, -4.25))
	check(field.get_cell_count(demo.BLIGHT) > blight_before, "Blight sows spores")
	var wounded := [0]
	field.cell_wounded.connect(func(_c: Vector3i, _s: Strain, _w: int) -> void: wounded[0] += 1)
	demo.cast(5, Vector3(4.75, 0.25, -4.25))
	check(wounded[0] > 0, "Cleanse wounds the blight")
	check(absf(field.get_ledger().balance) < 0.01, "books balance")
	stop_demo()


func test_demo_world_lives() -> void:
	var demo := start_demo({auto = "1"})
	await tree.process_frame
	var field: CellField = demo.field
	var seen := {}
	var scars := [0]
	field.cell_born.connect(func(_c: Vector3i, strain: Strain, _col: CellColony) -> void: seen[strain.id] = true)
	field.substrate_changed.connect(func(_c: Vector3i, _s: Substrate) -> void: scars[0] += 1)
	var ghoul_start: Vector3 = demo.ghouls[0].global_position
	Engine.time_scale = 4.0
	await wait_seconds(5.0)
	Engine.time_scale = 1.0
	check(seen.has(&"ember"), "fire spread")
	check(seen.has(&"mycelium") and seen.has(&"blight"), "both networks grew")
	check(scars[0] > 0, "the world was scarred (%d voxels changed)" % scars[0])
	check(demo.node_source.colony != null and demo.node_source.colony.root_alive, "the Mycelium Node lives")
	check(demo.heart.colony != null, "the Blight Heart was planted")
	check(demo.ghouls[0].global_position.distance_to(ghoul_start) > 0.5, "ghouls wander")
	check(demo.get_node_or_null("CanvasLayer/Hud") != null or demo.find_children("Hud", "", true, false).size() > 0, "HUD built")
	var ledger := field.get_ledger()
	check(absf(ledger.balance) < 0.01 * maxf(1.0, ledger.seeded + ledger.fed + ledger.generated),
		"energy conserved across the whole run (balance %f)" % ledger.balance)
	stop_demo()
