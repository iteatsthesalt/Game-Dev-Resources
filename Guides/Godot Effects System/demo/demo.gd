extends Node3D
## Cinder Caldera: living effects in a small Cinderdeep world.
##
## Fire climbs the deadwood, leaves ash and evolves into Wildfire. A Blight Heart
## pumps spores across the ground; your Mycelium Node grows a network that heals
## you and fights the blight, and turns ash back into loam. Ash Ghouls catch
## whatever they walk through and spread it. Every strain, substrate, reaction and
## infection is a .tres file in demo/living/.
##
## WASD move · 1-6 cast at the cursor · Q/E turn · wheel zoom · Tab autopilot.
## Command-line options (after --): --auto  --seed=N  --zoom=metres  --shot=path.png --at=seconds

signal event_logged(text: String, color: Color)

const ABILITIES := [
	{name = "Ember", key = "1", color = Color("#ff7a2a"), text = "Ignite the ground"},
	{name = "Rime", key = "2", color = Color("#8fd4ff"), text = "Freeze water, chill foes"},
	{name = "Deluge", key = "3", color = Color("#5aa0ff"), text = "Douse fire into steam"},
	{name = "Blight", key = "4", color = Color("#c86ae0"), text = "Sow spores"},
	{name = "Mycelium", key = "5", color = Color("#3fd6b0"), text = "Grow your network"},
	{name = "Cleanse", key = "6", color = Color("#fff0c0"), text = "Wound fire and blight"},
]

const EMBER := preload("res://demo/living/strains/ember.tres")
const RIME := preload("res://demo/living/strains/rime.tres")
const BLIGHT := preload("res://demo/living/strains/blight.tres")
const MYCELIUM := preload("res://demo/living/strains/mycelium.tres")
const WATER := preload("res://demo/living/strains/water.tres")

const ASH_GRASS := preload("res://demo/living/substrates/ash_grass.tres")
const LEAF_LITTER := preload("res://demo/living/substrates/leaf_litter.tres")
const CANOPY := preload("res://demo/living/substrates/canopy.tres")
const DEADWOOD := preload("res://demo/living/substrates/deadwood.tres")
const BASALT := preload("res://demo/living/substrates/basalt.tres")
const BOULDER := preload("res://demo/living/substrates/boulder.tres")
const POND := preload("res://demo/living/substrates/pond.tres")
const LAVA := preload("res://demo/living/substrates/lava.tres")
const MYCELIUM_BED := preload("res://demo/living/substrates/mycelium_bed.tres")
const BLIGHTED_SOIL := preload("res://demo/living/substrates/blighted_soil.tres")

const REACTION_DIR := "res://demo/living/reactions/"
const HALF := 14.0
const HEART_SPOT := Vector3(9.25, 0.25, -9.25)
const NODE_SPOT := Vector3(-9.25, 0.25, 9.25)
const VENT_SPOT := Vector3(8.25, 0.25, 7.25)
const HeroScript := preload("res://demo/hero.gd")
const GhoulScript := preload("res://demo/ghoul.gd")
const CameraScript := preload("res://demo/orbit_camera.gd")
const HudScript := preload("res://demo/hud.gd")

var field: CellField
var hero: HeroScript
var camera: CameraScript
var ghouls: Array = []
var heart: CellSource
var node_source: CellSource
var autopilot := false

var _rng := RandomNumberGenerator.new()
var _opts := {}
var _heart_mesh: Node3D
var _node_mesh: Node3D
var _heart_down_time := 0.0
var _reaction_times := {}
var _auto_timer := 0.0
var _auto_goal := Vector3.ZERO
var _auto_step := 0


func _ready() -> void:
	for arg in OS.get_cmdline_user_args():
		var parts := arg.trim_prefix("--").split("=", true, 1)
		_opts[parts[0]] = parts[1] if parts.size() > 1 else "1"
	_rng.seed = int(_opts.get("seed", "7"))
	autopilot = _opts.has("auto") or _opts.has("shot")
	_environment()
	_build_field()
	_paint_world()
	_spawn_actors()
	_connect_events()
	var hud: HudScript = HudScript.new()
	hud.name = "Hud"
	var layer := CanvasLayer.new()
	layer.add_child(hud)
	add_child(layer)
	hud.setup(self)
	if _opts.has("shot"):
		_take_shot()


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		var index: int = event.physical_keycode - KEY_1
		if index >= 0 and index < ABILITIES.size():
			cast(index, _cursor_point())
		elif event.physical_keycode == KEY_TAB:
			autopilot = not autopilot
			log_event("Autopilot " + ("on" if autopilot else "off"), Color("#a0a0a8"))
		elif event.physical_keycode == KEY_ESCAPE:
			get_tree().quit()


func _physics_process(delta: float) -> void:
	if autopilot:
		_drive_autopilot(delta)
	else:
		hero.move_input = _keyboard_move()
	hero.camera_yaw = camera.yaw
	_update_landmarks(delta)


# --- Abilities -------------------------------------------------------------------

## Cast ability [param index] (see ABILITIES) at a point on the ground.
func cast(index: int, at: Vector3) -> void:
	if hero.dead:
		return
	at.y = 0.25
	var ability: Dictionary = ABILITIES[index]
	match index:
		0:
			field.spray(EMBER, at, 1.0, 10.0, true, true)
		1:
			field.spray(RIME, at, 1.8, 8.0, false, true)
		2:
			field.spray(WATER, at + Vector3.UP * 0.75, 1.3, 6.0)
		3:
			field.spray(BLIGHT, at, 1.0, 8.0, true, true)
		4:
			field.spray(MYCELIUM, at, 1.2, 8.0, true, true)
		5:
			field.wound_area(at + Vector3.UP * 0.5, 2.6, 2, 4.0, &"fire")
			field.wound_area(at + Vector3.UP * 0.5, 2.6, 2, 4.0, &"corruption")
			Fx.shockwave(at, ability.color, 2.6, 0.45)
	Fx.impact_light(at + Vector3.UP * 0.6, ability.color, 3.0, 4.0, 0.3)


func _cursor_point() -> Vector3:
	var mouse := get_viewport().get_mouse_position()
	var origin := camera.project_ray_origin(mouse)
	var normal := camera.project_ray_normal(mouse)
	var hit = Plane(Vector3.UP, 0.25).intersects_ray(origin, normal)
	if hit == null:
		return hero.global_position + Vector3(0, 0, -2)
	return hit


func _keyboard_move() -> Vector2:
	var v := Vector2.ZERO
	if Input.is_physical_key_pressed(KEY_W) or Input.is_physical_key_pressed(KEY_UP):
		v.y += 1
	if Input.is_physical_key_pressed(KEY_S) or Input.is_physical_key_pressed(KEY_DOWN):
		v.y -= 1
	if Input.is_physical_key_pressed(KEY_D) or Input.is_physical_key_pressed(KEY_RIGHT):
		v.x += 1
	if Input.is_physical_key_pressed(KEY_A) or Input.is_physical_key_pressed(KEY_LEFT):
		v.x -= 1
	return v.limit_length(1.0)


# --- Autopilot -------------------------------------------------------------------

## A scripted opening, then random casts at interesting places.
func _drive_autopilot(delta: float) -> void:
	_auto_timer -= delta
	var to_goal := _auto_goal - hero.global_position
	to_goal.y = 0.0
	if to_goal.length() > 0.8:
		var forward := Vector3(-sin(camera.yaw), 0, -cos(camera.yaw))
		var right := Vector3(cos(camera.yaw), 0, -sin(camera.yaw))
		var d := to_goal.normalized()
		hero.move_input = Vector2(d.dot(right), d.dot(forward))
	else:
		hero.move_input = Vector2.ZERO
	if _auto_timer > 0.0:
		return
	_auto_timer = 2.2
	var script := [
		[Vector3(-4, 0, 4), 4, Vector3(-6.5, 0, 6.5)],
		[Vector3(-2, 0, 0), 0, Vector3(-3.0, 0, -2.5)],
		[Vector3(-5, 0, -3), 1, Vector3(-8.0, 0, -7.0)],
		[Vector3(1, 0, -3), 0, Vector3(4.0, 0, -4.0)],
		[Vector3(2, 0, -5), 2, Vector3(-1.5, 0, -3.0)],
	]
	if _auto_step < script.size():
		var step: Array = script[_auto_step]
		_auto_goal = step[0]
		cast(step[1], step[2])
		_auto_step += 1
		return
	var choice := _rng.randi() % 6
	var target := hero.global_position + Vector3(_rng.randf_range(-5, 5), 0, _rng.randf_range(-5, 5))
	var fires := field.get_cells(EMBER) + field.get_cells(EMBER.evolve_into)
	var blight := field.get_cells(BLIGHT) + field.get_cells(BLIGHT.evolve_into)
	if (choice == 2 or choice == 5) and not fires.is_empty():
		target = field.cell_to_world(fires[_rng.randi() % fires.size()])
	elif choice == 5 and not blight.is_empty():
		target = field.cell_to_world(blight[_rng.randi() % blight.size()])
	target.x = clampf(target.x, -HALF + 1, HALF - 1)
	target.z = clampf(target.z, -HALF + 1, HALF - 1)
	cast(choice, target)
	_auto_goal = Vector3(_rng.randf_range(-10, 10), 0, _rng.randf_range(-10, 10))


# --- World -----------------------------------------------------------------------

func _environment() -> void:
	var sky_material := ProceduralSkyMaterial.new()
	sky_material.sky_top_color = Color("#16142a")
	sky_material.sky_horizon_color = Color("#5a3438")
	sky_material.ground_horizon_color = Color("#2e1f24")
	sky_material.ground_bottom_color = Color("#0c0a0e")
	var sky := Sky.new()
	sky.sky_material = sky_material
	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color("#7a7088")
	env.ambient_light_energy = 0.55
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.tonemap_exposure = 1.0
	env.glow_enabled = true
	env.glow_intensity = 0.55
	env.fog_enabled = true
	env.fog_light_color = Color("#3a2830")
	env.fog_density = 0.012
	var world := WorldEnvironment.new()
	world.environment = env
	add_child(world)
	var sun := DirectionalLight3D.new()
	sun.light_color = Color("#ffe0cc")
	sun.light_energy = 0.85
	sun.shadow_enabled = true
	sun.rotation_degrees = Vector3(-55, 35, 0)
	add_child(sun)
	var rim := DirectionalLight3D.new()
	rim.light_color = Color("#8090e0")
	rim.light_energy = 0.35
	rim.rotation_degrees = Vector3(-20, -150, 0)
	add_child(rim)


func _build_field() -> void:
	field = CellField.new()
	field.name = "CellField"
	field.cell_size = 0.5
	field.size = Vector3i(56, 16, 56)
	field.tick_rate = 8.0
	field.max_cells = 3500
	field.wind = Vector3(0.8, 0.0, 0.3)
	field.render_cells = true
	field.render_substrates = true
	field.rng_seed = _rng.seed
	var list: Array[Reaction] = []
	for file in DirAccess.get_files_at(REACTION_DIR):
		file = file.trim_suffix(".remap")
		if file.ends_with(".tres"):
			list.append(load(REACTION_DIR + file))
	field.reactions = list
	add_child(field)
	# The ground the characters walk on.
	var ground := StaticBody3D.new()
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(HALF * 2.0 + 4.0, 1.0, HALF * 2.0 + 4.0)
	shape.shape = box
	shape.position.y = -0.375
	ground.add_child(shape)
	var floor_mesh := MeshInstance3D.new()
	var plane := PlaneMesh.new()
	plane.size = Vector2(80, 80)
	var floor_material := StandardMaterial3D.new()
	floor_material.albedo_color = Color("#1c161c")
	floor_material.roughness = 1.0
	plane.material = floor_material
	floor_mesh.mesh = plane
	floor_mesh.position.y = -0.01
	ground.add_child(floor_mesh)
	add_child(ground)


func _paint_world() -> void:
	var n := int(HALF * 2.0)
	for x in range(-n, n):
		for z in range(-n, n):
			field.paint_cell(Vector3i(x, 0, z), ASH_GRASS)
	for i in 12:
		_disc(Vector2(_rng.randf_range(-12, 12), _rng.randf_range(-12, 12)), _rng.randf_range(1.0, 2.2), LEAF_LITTER, 0.25)
	# Basalt roads: firebreaks, with a few grassy gaps the fire can jump.
	for i in range(-n, n):
		var gap := absi(i - 14) < 2 or absi(i + 18) < 2
		if not gap:
			for w in [-1, 0]:
				field.paint_cell(Vector3i(w, 0, i), BASALT)
				field.paint_cell(Vector3i(i, 0, w), BASALT)
	_disc(Vector2(-8, -7), 3.2, POND)
	_disc(Vector2(NODE_SPOT.x, NODE_SPOT.z), 2.6, MYCELIUM_BED)
	_disc(Vector2(HEART_SPOT.x, HEART_SPOT.z), 3.2, BLIGHTED_SOIL)
	for i in 4:
		var angle := _rng.randf() * TAU
		var start := Vector2(VENT_SPOT.x, VENT_SPOT.z) + Vector2(_rng.randf_range(-1, 1), _rng.randf_range(-1, 1))
		for step in 7:
			var p := start + Vector2(cos(angle), sin(angle)) * step * 0.45
			field.paint_cell(field.world_to_cell(Vector3(p.x, 0.25, p.y)), LAVA)
	var placed: Array[Vector2] = []
	var attempts := 0
	while placed.size() < 16 and attempts < 400:
		attempts += 1
		var spot := Vector2(_rng.randf_range(-12.5, 12.5), _rng.randf_range(-12.5, 12.5))
		if absf(spot.x) < 1.6 or absf(spot.y) < 1.6 or spot.distance_to(Vector2(-8, -7)) < 4.4 \
				or spot.distance_to(Vector2(NODE_SPOT.x, NODE_SPOT.z)) < 4.0 \
				or spot.distance_to(Vector2(HEART_SPOT.x, HEART_SPOT.z)) < 3.6 \
				or spot.distance_to(Vector2(VENT_SPOT.x, VENT_SPOT.z)) < 2.5 \
				or placed.any(func(other: Vector2) -> bool: return other.distance_to(spot) < 3.0):
			continue
		placed.append(spot)
		if placed.size() % 5 == 0:
			_boulder(spot)
		else:
			_tree(spot)


func _disc(center: Vector2, radius: float, substrate: Substrate, gaps: float = 0.0) -> void:
	var c := field.world_to_cell(Vector3(center.x, 0.25, center.y))
	var reach := ceili(radius / field.cell_size)
	for x in range(-reach, reach + 1):
		for z in range(-reach, reach + 1):
			var cell := c + Vector3i(x, 0, z)
			var world := field.cell_to_world(cell)
			if Vector2(world.x, world.z).distance_to(center) <= radius and field.is_inside(cell) \
					and (gaps <= 0.0 or _rng.randf() > gaps):
				field.paint_cell(cell, substrate)


func _tree(spot: Vector2) -> void:
	var base := field.world_to_cell(Vector3(spot.x, 0.25, spot.y))
	var height := _rng.randi_range(6, 9)
	for y in range(1, height + 1):
		field.paint_cell(base + Vector3i(0, y, 0), DEADWOOD)
	# A couple of bare branches, then a dry canopy.
	for i in 2:
		var dir := Vector3i(1, 0, 0) if _rng.randf() < 0.5 else Vector3i(0, 0, 1)
		if _rng.randf() < 0.5:
			dir = -dir
		var y := _rng.randi_range(3, height - 2)
		field.paint_cell(base + Vector3i(0, y, 0) + dir, DEADWOOD)
		field.paint_cell(base + Vector3i(0, y + 1, 0) + dir * 2, DEADWOOD)
	var radius := _rng.randf_range(1.6, 2.4)
	var crown := base + Vector3i(0, height, 0)
	var reach := ceili(radius)
	for x in range(-reach, reach + 1):
		for y in range(-1, reach + 1):
			for z in range(-reach, reach + 1):
				var offset := Vector3(x, y * 1.3, z)
				var cell := crown + Vector3i(x, y, z)
				if offset.length() <= radius and field.get_substrate(cell) == null and _rng.randf() > 0.2:
					field.paint_cell(cell, CANOPY)
	var trunk := StaticBody3D.new()
	var shape := CollisionShape3D.new()
	var cylinder := CylinderShape3D.new()
	cylinder.radius = 0.3
	cylinder.height = height * field.cell_size
	shape.shape = cylinder
	trunk.add_child(shape)
	add_child(trunk)
	trunk.global_position = field.cell_to_world(base) + Vector3(0, cylinder.height * 0.5, 0)


func _boulder(spot: Vector2) -> void:
	var base := field.world_to_cell(Vector3(spot.x, 0.25, spot.y))
	for x in 2:
		for z in 2:
			for y in range(0, 2 if (x + z) % 2 == 0 else 1):
				field.paint_cell(base + Vector3i(x, y, z), BOULDER)
	var rock := StaticBody3D.new()
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(1.0, 1.0, 1.0)
	shape.shape = box
	rock.add_child(shape)
	add_child(rock)
	rock.global_position = field.cell_to_world(base) + Vector3(0.25, 0.25, 0.25)


func _spawn_actors() -> void:
	heart = CellSource.new()
	heart.name = "BlightHeart"
	heart.strain = BLIGHT
	heart.plant_root = true
	heart.interval = 0.0
	heart.energy = 12.0
	add_child(heart)
	heart.global_position = HEART_SPOT
	_heart_mesh = _landmark(HEART_SPOT, Color("#c86ae0"), 0.7)
	node_source = CellSource.new()
	node_source.name = "MyceliumNode"
	node_source.strain = MYCELIUM
	node_source.plant_root = true
	node_source.interval = 0.0
	node_source.energy = 12.0
	add_child(node_source)
	node_source.global_position = NODE_SPOT
	_node_mesh = _landmark(NODE_SPOT, Color("#3fd6b0"), 0.55)
	var vent := CellSource.new()
	vent.name = "LavaVent"
	vent.strain = EMBER
	vent.interval = 9.0
	vent.radius = 1.4
	vent.energy = 9.0
	add_child(vent)
	vent.global_position = VENT_SPOT

	hero = HeroScript.new()
	hero.name = "Hero"
	add_child(hero)
	hero.global_position = Vector3(-7, 0.3, 7)
	hero.respawn_point = Vector3(NODE_SPOT.x + 1.5, 0.3, NODE_SPOT.z - 1.5)
	camera = CameraScript.new()
	camera.name = "Camera"
	add_child(camera)
	camera.target = hero
	camera.current = true
	camera.distance = float(_opts.get("zoom", str(camera.distance)))
	camera.snap()
	for i in 6:
		var ghoul: GhoulScript = GhoulScript.new()
		ghoul.name = "Ghoul%d" % i
		ghoul.bounds = HALF - 1.5
		add_child(ghoul)
		ghoul.global_position = Vector3(_rng.randf_range(-11, 11), 0.3, _rng.randf_range(-11, 11))
		ghouls.append(ghoul)


func _landmark(at: Vector3, color: Color, size: float) -> Node3D:
	var root := Node3D.new()
	add_child(root)
	root.global_position = at + Vector3(0, 0.6, 0)
	VoxelBody.box(root, Vector3.ONE * size, Vector3.ZERO, color, 3.0)
	VoxelBody.box(root, Vector3.ONE * size * 0.6, Vector3(0, size * 0.8, 0), color.lightened(0.3), 4.0)
	var light := OmniLight3D.new()
	light.light_color = color
	light.light_energy = 1.5
	light.omni_range = 4.0
	root.add_child(light)
	return root


func _update_landmarks(delta: float) -> void:
	var t := Time.get_ticks_msec() * 0.001
	_heart_mesh.scale = Vector3.ONE * (1.0 + 0.12 * sin(t * 4.0))
	_node_mesh.rotation.y += delta * 0.8
	# A destroyed Blight Heart regrows after a while.
	if heart.colony != null and not heart.colony.root_alive:
		if _heart_mesh.visible:
			_heart_mesh.visible = false
			Fx.voxel_burst(HEART_SPOT + Vector3.UP * 0.6, Color("#c86ae0"), 40, 0.1, 4.0)
			Fx.shockwave(HEART_SPOT, Color("#c86ae0"), 4.0, 0.6)
		_heart_down_time += delta
		if _heart_down_time > 25.0:
			_heart_down_time = 0.0
			if heart.emit_now() > 0:
				_heart_mesh.visible = true
				log_event("The Blight Heart regrows", Color("#e0a0ff"))
	if node_source.colony != null and not node_source.colony.root_alive:
		node_source.emit_now()


# --- Events ----------------------------------------------------------------------

func log_event(text: String, color: Color = Color("#d8d0c8")) -> void:
	event_logged.emit(text, color)


func _connect_events() -> void:
	field.colony_evolved.connect(func(colony: CellColony, from: Strain, to: Strain) -> void:
		log_event("Mitosis gone wild: %s became %s at %d cells" % [from.get_display_name(), to.get_display_name(),
			colony.size()], to.hot_color)
		Fx.shake(0.3)
		Fx.impact_light(field.get_colony_center(colony) + Vector3.UP, to.light_color, 6.0, 10.0, 0.8))
	field.colony_severed.connect(func(colony: CellColony) -> void:
		var what := "Blight Heart" if colony.strain.has_tag(&"blight") else "Mycelium Node"
		log_event("%s destroyed: its network is severed" % what, colony.strain.hot_color))
	field.host_released.connect(func(host: CellHost, strain: Strain, energy: float) -> void:
		if energy >= 1.0:
			log_event("%s fell; %d %s energy returned to the world" % [_name_of(host), roundi(energy),
				strain.get_display_name()], strain.hot_color))
	field.host_infected.connect(func(host: CellHost, strain: Strain) -> void:
		if host == hero.host and not _recent(strain.id, 3.0):
			log_event("You caught %s" % strain.infection_effect.get_display_name(), strain.hot_color))
	field.reacted.connect(func(cell: Vector3i, reaction: Reaction) -> void:
		var title := reaction.resource_path.get_file().get_basename().capitalize()
		if not _recent(title, 2.5):
			log_event("Reaction: %s" % title, reaction.burst_color if reaction.burst_color.a > 0.0 else Color("#c8c0b8")))
	hero.died.connect(func() -> void: log_event("You fell", Color("#ff6a5a")))


func _recent(key: Variant, seconds: float) -> bool:
	var now := Time.get_ticks_msec() * 0.001
	if now - float(_reaction_times.get(key, -1000.0)) < seconds:
		return true
	_reaction_times[key] = now
	return false


func _name_of(host: CellHost) -> String:
	if host == hero.host:
		return "You"
	return "An Ash Ghoul"


func _take_shot() -> void:
	var at := float(_opts.get("at", "20"))
	await get_tree().create_timer(at).timeout
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(_opts.shot)
	get_tree().quit()
