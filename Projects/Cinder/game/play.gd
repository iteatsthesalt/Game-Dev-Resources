extends Node3D
## Play a built character in a small Cinder Caldera arena.
##
##   godot --path . res://game/play.tscn -- --hero=knight
##
## Tab / 1-9 switch character. Extra options (used by Forge and tests):
##   --shot=/path.png   save one picture and quit
##   --pose=idle|walk|run|attack|ability|dodge  --t=0.3  pose for the picture
##   --autotest         drive the character with scripted input, then quit

const PLAYER := preload("res://game/player.gd")
const SCENE_DIR := "res://assets/scenes/"

var player: CharacterBody3D
var heroes := PackedStringArray()
var hero_index := 0
var label: Label
var opts := {}


func _ready() -> void:
	for arg in OS.get_cmdline_user_args():
		var parts := arg.trim_prefix("--").split("=", true, 1)
		opts[parts[0]] = parts[1] if parts.size() > 1 else "1"
	heroes = CharacterRig.list_built()
	_environment()
	_arena()
	player = PLAYER.new()
	player.name = "Player"
	add_child(player)
	var want: String = opts.get("hero", "")
	hero_index = maxi(heroes.find(want), 0)
	if heroes.is_empty() or not player.setup(heroes[hero_index]):
		push_error("No built characters. Run tools/build_character.gd first.")
		get_tree().quit(1)
		return
	_hud()
	if opts.has("shot"):
		_take_shot()
	elif opts.has("autotest"):
		_autotest()


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		if event.physical_keycode == KEY_TAB:
			_switch(hero_index + 1)
		elif event.physical_keycode >= KEY_1 and event.physical_keycode <= KEY_9:
			_switch(event.physical_keycode - KEY_1)
		elif event.physical_keycode == KEY_ESCAPE:
			get_tree().quit()


func _switch(index: int) -> void:
	if heroes.is_empty() or index >= heroes.size() and index != hero_index + 1:
		return
	hero_index = posmod(index, heroes.size())
	player.setup(heroes[hero_index])
	_update_label()


#region World

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
	env.ambient_light_energy = 0.9
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.tonemap_exposure = 1.25
	env.glow_enabled = true
	env.glow_intensity = 0.6
	env.fog_enabled = true
	env.fog_light_color = Color("#3a2830")
	env.fog_density = 0.02
	var world := WorldEnvironment.new()
	world.environment = env
	add_child(world)
	var sun := DirectionalLight3D.new()
	sun.light_color = Color("#ffe0cc")
	sun.light_energy = 1.1
	sun.shadow_enabled = true
	sun.rotation_degrees = Vector3(-50, 35, 0)
	add_child(sun)
	var rim := DirectionalLight3D.new()
	rim.light_color = Color("#8090e0")
	rim.light_energy = 0.5
	rim.rotation_degrees = Vector3(-20, -150, 0)
	add_child(rim)


func _arena() -> void:
	var ground := StaticBody3D.new()
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(60, 1, 60)
	shape.shape = box
	shape.position.y = -0.5
	ground.add_child(shape)
	var mesh := MeshInstance3D.new()
	var plane := PlaneMesh.new()
	plane.size = Vector2(60, 60)
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color("#1c161c")
	mat.roughness = 0.95
	plane.material = mat
	mesh.mesh = plane
	ground.add_child(mesh)
	add_child(ground)
	# Lava cracks: thin glowing strips across the floor.
	var lava := StandardMaterial3D.new()
	lava.albedo_color = Color("#ff5a1a")
	lava.emission_enabled = true
	lava.emission = Color("#ff5a1a")
	lava.emission_energy_multiplier = 2.0
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	for i in 9:
		var crack := MeshInstance3D.new()
		var strip := BoxMesh.new()
		strip.size = Vector3(0.12, 0.02, rng.randf_range(2.0, 6.0))
		strip.material = lava
		crack.mesh = strip
		var ang := rng.randf() * TAU
		var dist := rng.randf_range(6.0, 16.0)
		crack.position = Vector3(cos(ang) * dist, 0.01, sin(ang) * dist)
		crack.rotation.y = rng.randf() * TAU
		add_child(crack)
	# The baked Caldera models stand around the edge.
	var scenes := PackedStringArray()
	if DirAccess.dir_exists_absolute(SCENE_DIR):
		for f in DirAccess.get_files_at(SCENE_DIR):
			f = f.trim_suffix(".remap")
			if f.ends_with(".tscn"):
				scenes.append(SCENE_DIR + f)
	for i in scenes.size():
		var node: Node3D = load(scenes[i]).instantiate()
		var ang := TAU * i / scenes.size() + 0.4
		node.position = Vector3(cos(ang), 0, sin(ang)) * 6.5
		node.rotation.y = -ang - PI * 0.5
		add_child(node)

#endregion

#region HUD and touch

func _hud() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	label = Label.new()
	label.position = Vector2(16, 12)
	label.add_theme_font_size_override("font_size", 18)
	label.add_theme_color_override("font_color", Color("#f1e5cd"))
	label.add_theme_color_override("font_outline_color", Color("#0c070a"))
	label.add_theme_constant_override("outline_size", 6)
	layer.add_child(label)
	_update_label()
	if DisplayServer.is_touchscreen_available():
		_touch(layer)


func _update_label() -> void:
	if label == null:
		return
	var rig: CharacterRig = player.rig
	label.text = "%s\nWASD move · Shift run · Space dodge · J/click attack · K ability · right-drag camera · Tab next (%d/%d)" % [
		str(rig.rig.get("name", heroes[hero_index])) if rig else heroes[hero_index], hero_index + 1, heroes.size()]


func _touch(layer: CanvasLayer) -> void:
	var stick := Control.new()
	stick.set_anchors_preset(Control.PRESET_FULL_RECT)
	stick.mouse_filter = Control.MOUSE_FILTER_PASS
	layer.add_child(stick)
	var origin := Vector2.ZERO
	stick.gui_input.connect(func(e: InputEvent) -> void:
		if e is InputEventScreenTouch:
			if e.pressed and e.position.x < stick.size.x * 0.5:
				origin = e.position
			elif not e.pressed:
				player.move_override = Vector2.ZERO
		elif e is InputEventScreenDrag and e.position.x < stick.size.x * 0.5:
			var v: Vector2 = (e.position - origin) / 80.0
			player.move_override = Vector2(v.x, -v.y).limit_length(1.0)
			player.run_override = v.length() > 1.4)
	var names := ["Attack", "Dodge", "Ability"]
	var calls := [player.attack, player.dodge, player.ability]
	for i in 3:
		var button := Button.new()
		button.text = names[i]
		button.custom_minimum_size = Vector2(120, 80)
		button.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
		button.position = Vector2(-140 - i * 130, -100)
		button.pressed.connect(calls[i])
		layer.add_child(button)

#endregion

#region Pictures and tests

func _take_shot() -> void:
	var p := player
	var pose: String = opts.get("pose", "idle")
	var t := float(opts.get("t", "0.3"))
	p.set_physics_process(false)
	p.time = 1.3
	match pose:
		"walk":
			p.stride = 1.0
			p.phase = 1.2
		"run":
			p.stride = 2.0
			p.phase = 1.2
		"attack":
			p.attack_t = t * player.ATTACK_TIME
		"ability":
			p.ability_t = t * player.ABILITY_TIME
		"dodge":
			p.dodge_t = t * player.DODGE_TIME
	p.pose(0.0)
	var yaw := deg_to_rad(float(opts.get("yaw", "25")))
	var h: float = p.rig.height()
	var focus := Vector3(0, h * 0.52, 0)
	var cam: Camera3D = p.camera
	cam.fov = 35.0
	cam.global_position = focus + Vector3(sin(yaw), 0.18, cos(yaw)).normalized() * h * 2.3 * float(opts.get("zoom", "1"))
	cam.look_at(focus)
	for i in 10:
		await get_tree().process_frame
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(opts.shot)
	get_tree().quit()


func _autotest() -> void:
	var p := player
	var lines := []
	var steps := [
		[40, Vector2(0, 1), false, ""], [40, Vector2(1, 0.5), true, ""], [5, Vector2.ZERO, false, "attack"],
		[40, Vector2.ZERO, false, ""], [5, Vector2(0, 1), false, "dodge"], [40, Vector2.ZERO, false, ""],
		[5, Vector2.ZERO, false, "ability"], [70, Vector2.ZERO, false, ""], [5, Vector2.ZERO, false, "switch"],
		[45, Vector2(-1, -1), false, ""],
	]
	var start := p.global_position
	for step: Array in steps:
		p.move_override = step[1]
		p.run_override = step[2]
		match step[3]:
			"attack":
				p.attack()
			"dodge":
				p.dodge()
			"ability":
				p.ability()
			"switch":
				_switch(hero_index + 1)
		for f in int(step[0]):
			await get_tree().physics_frame
		lines.append("%s pos=%s" % [step[3] if step[3] != "" else str(step[1]), p.global_position.snapped(Vector3.ONE * 0.01)])
	print("AUTOTEST moved %.2f m; %s" % [p.global_position.distance_to(start), " | ".join(lines)])
	print("AUTOTEST OK" if p.global_position.distance_to(start) > 1.0 and is_finite(p.global_position.x) else "AUTOTEST FAIL")
	get_tree().quit()

#endregion
