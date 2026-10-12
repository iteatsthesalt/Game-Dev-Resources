extends Node3D
## Lines up every baked Cinder asset under dusk lighting.
##
## Drag to orbit, scroll to zoom. Command-line options (after `--`):
##   --asset=<name>   show a single asset from assets/scenes/
##   --yaw=<deg> --pitch=<deg> --zoom=<factor>
##   --shot=<file.png> render a few frames, save a screenshot and quit

const SCENE_DIR := "res://assets/scenes/"

var _camera := Camera3D.new()
var _focus := Vector3.ZERO
var _radius := 3.0
var _yaw := -30.0
var _pitch := -18.0
var _zoom := 1.0
var _shot_path := ""
var _auto_rotate := true


func _ready() -> void:
	var only := ""
	for arg in OS.get_cmdline_user_args():
		var parts := arg.trim_prefix("--").split("=", true, 1)
		if parts.size() != 2:
			continue
		match parts[0]:
			"asset": only = parts[1]
			"yaw": _yaw = float(parts[1])
			"pitch": _pitch = float(parts[1])
			"zoom": _zoom = float(parts[1])
			"shot": _shot_path = parts[1]

	_build_environment()
	_build_ground()
	_spawn_assets(only)
	_camera.fov = 40.0
	add_child(_camera)
	_update_camera()

	if not _shot_path.is_empty():
		_auto_rotate = false
		for i in 12:
			await get_tree().process_frame
		await RenderingServer.frame_post_draw
		get_viewport().get_texture().get_image().save_png(_shot_path)
		get_tree().quit()


func _process(delta: float) -> void:
	if _auto_rotate:
		_yaw += delta * 6.0
		_update_camera()


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and event.button_mask & MOUSE_BUTTON_MASK_LEFT:
		_auto_rotate = false
		_yaw -= event.relative.x * 0.3
		_pitch = clampf(_pitch - event.relative.y * 0.3, -85.0, -2.0)
		_update_camera()
	elif event is InputEventMouseButton and event.pressed:
		if event.button_index == MOUSE_BUTTON_WHEEL_UP:
			_zoom = maxf(_zoom * 0.9, 0.2)
		elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			_zoom = minf(_zoom * 1.1, 4.0)
		_update_camera()


func _update_camera() -> void:
	var distance := _radius / sin(deg_to_rad(_camera.fov * 0.5)) * _zoom
	var dir := Basis.from_euler(Vector3(deg_to_rad(_pitch), deg_to_rad(_yaw), 0.0)) * Vector3.BACK
	_camera.position = _focus + dir * distance
	_camera.look_at(_focus)


func _spawn_assets(only: String) -> void:
	var entries: Array[Dictionary] = []
	for file in DirAccess.get_files_at(SCENE_DIR):
		file = file.trim_suffix(".remap")
		if not file.ends_with(".tscn") or (only != "" and file.get_basename() != only):
			continue
		var node: Node3D = load(SCENE_DIR + file).instantiate()
		var aabb := _aabb_of(node)
		entries.append({"node": node, "aabb": aabb})
	if entries.is_empty():
		push_warning("No baked assets found in %s; run tools/bake.gd first." % SCENE_DIR)
		return

	# Tall pieces go in the back row so nothing hides behind them.
	entries.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return a.aabb.size.y > b.aabb.size.y)
	var rows: Array = [entries.slice(0, (entries.size() + 1) / 2), entries.slice((entries.size() + 1) / 2)]
	if entries.size() == 1:
		rows = [entries]
	var gap := 0.5
	var bounds := AABB()
	var first := true
	var z := 0.0
	for row: Array in rows:
		var width := 0.0
		var depth := 0.0
		for entry: Dictionary in row:
			width += entry.aabb.size.x + gap
			depth = maxf(depth, entry.aabb.size.z)
		var x := -width * 0.5
		for entry: Dictionary in row:
			var aabb: AABB = entry.aabb
			var node: Node3D = entry.node
			node.position = Vector3(x - aabb.position.x, 0.0, z - aabb.get_center().z)
			add_child(node)
			x += aabb.size.x + gap
			var placed := AABB(aabb.position + node.position, aabb.size)
			bounds = placed if first else bounds.merge(placed)
			first = false
		z += depth + gap * 2.0

	_focus = bounds.get_center()
	_radius = bounds.size.length() * 0.5


func _aabb_of(node: Node3D) -> AABB:
	for child in node.get_children():
		if child is MeshInstance3D:
			return child.mesh.get_aabb()
	return AABB(Vector3(-0.5, 0, -0.5), Vector3.ONE)


func _build_environment() -> void:
	var sky_material := ProceduralSkyMaterial.new()
	sky_material.sky_top_color = Color("#16142a")
	sky_material.sky_horizon_color = Color("#5a3438")
	sky_material.ground_horizon_color = Color("#2e1f24")
	sky_material.ground_bottom_color = Color("#0c0a0e")
	sky_material.sun_angle_max = 20.0
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
	env.glow_intensity = 0.55
	env.glow_bloom = 0.04
	env.glow_hdr_threshold = 0.9
	env.glow_blend_mode = Environment.GLOW_BLEND_MODE_SOFTLIGHT
	env.ssao_enabled = true
	env.ssao_intensity = 1.5
	env.fog_enabled = true
	env.fog_light_color = Color("#2b2130")
	env.fog_density = 0.006
	var world := WorldEnvironment.new()
	world.environment = env
	add_child(world)

	var sun := DirectionalLight3D.new()
	sun.light_color = Color("#ffe0cc")
	sun.light_energy = 1.1
	sun.shadow_enabled = true
	sun.rotation_degrees = Vector3(-32.0, -50.0, 0.0)
	add_child(sun)

	var rim := DirectionalLight3D.new()
	rim.light_color = Color("#8090e0")
	rim.light_energy = 0.5
	rim.rotation_degrees = Vector3(-20.0, 140.0, 0.0)
	add_child(rim)


func _build_ground() -> void:
	var plane := PlaneMesh.new()
	plane.size = Vector2(60.0, 60.0)
	var material := StandardMaterial3D.new()
	material.albedo_color = Color("#16121a")
	material.roughness = 1.0
	plane.material = material
	var ground := MeshInstance3D.new()
	ground.mesh = plane
	add_child(ground)
