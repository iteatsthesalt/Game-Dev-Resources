class_name Fx
extends RefCounted
## Fire-and-forget game feel: screen shake, hit-stop, flashes, tints, particles,
## floating text and one-shot sounds.
##
## Everything is static, so call it from anywhere: [code]Fx.shake(0.4)[/code],
## [code]Fx.hitstop(0.05)[/code]. No autoload is needed; a helper node is added to the
## scene tree the first time shake or hit-stop is used. Works in 2D and 3D: pass a
## Vector2 or a Vector3 position and the matching node type is used.

const _Server := preload("res://addons/effects_system/fx/fx_server.gd")

## Camera offset at full trauma, in pixels (2D) or metres (3D).
static var shake_offset_2d := Vector2(18.0, 14.0)
static var shake_offset_3d := Vector2(0.35, 0.25)
## Camera2D rotation at full trauma, in radians. Needs [member Camera2D.ignore_rotation] off.
static var shake_rotation_2d := 0.0
## Trauma lost per second.
static var shake_decay := 1.6
## How fast the shake wobbles.
static var shake_frequency := 18.0

## Floating text: how far it rises (pixels in 2D, metres in 3D) and for how long.
static var text_rise_2d := 36.0
static var text_rise_3d := 0.8
static var text_duration := 0.8
static var text_font_size := 18
static var text_outline_size := 4

## How strongly [method push_tint] colours 3D meshes (0..1).
static var tint_strength_3d := 0.35
## Brightness multiplier for [method flash] on sprites without the flash shader.
static var flash_boost := 6.0

static var _instance: Node


# --- Camera ----------------------------------------------------------------------

## Shake the camera. [param trauma] is 0..1 and accumulates, so repeated hits shake
## harder; the visible shake is trauma squared. Uses the active Camera2D, else the
## active Camera3D, unless you pass [param camera].
static func shake(trauma: float = 0.3, camera: Node = null) -> void:
	var server := _server()
	if server != null:
		server.add_trauma(trauma, camera)


## Stop shaking now and put the camera back.
static func stop_shake() -> void:
	if is_instance_valid(_instance):
		_instance.stop_shake()


## Current trauma, 0..1.
static func get_trauma() -> float:
	return _instance.trauma if is_instance_valid(_instance) else 0.0


# --- Time ------------------------------------------------------------------------

## Freeze (or slow) the game for [param duration] real-time seconds by lowering
## [member Engine.time_scale]. Overlapping calls extend the freeze; the previous
## time scale is restored afterwards.
static func hitstop(duration: float = 0.06, time_scale: float = 0.0) -> void:
	var server := _server()
	if server != null:
		server.hitstop(duration, time_scale)


static func cancel_hitstop() -> void:
	if is_instance_valid(_instance):
		_instance.cancel_hitstop()


static func is_hitstopped() -> bool:
	return is_instance_valid(_instance) and _instance.hitstop_active


# --- Colour ----------------------------------------------------------------------

## Flash a node, fading back over [param duration]. 2D nodes using a ShaderMaterial
## with a [code]flash_amount[/code] uniform (see [code]hit_flash.gdshader[/code])
## animate that instead of [member CanvasItem.modulate] for a true silhouette flash.
## 3D nodes flash every mesh under them using a material overlay.
static func flash(target: Node, color: Color = Color.WHITE, duration: float = 0.12) -> void:
	if not is_instance_valid(target) or not target.is_inside_tree():
		return
	if target is CanvasItem:
		var material := (target as CanvasItem).material as ShaderMaterial
		if material != null and material.shader != null and _has_uniform(material.shader, &"flash_amount"):
			_tween_shader_flash(target, material, color, duration)
			return
	var tween: Tween = target.get_meta(&"_fx_flash_tween") if target.has_meta(&"_fx_flash_tween") else null
	if tween != null and tween.is_valid():
		tween.kill()
	tween = target.create_tween()
	target.set_meta(&"_fx_flash_tween", tween)
	tween.tween_method(func(amount: float) -> void: _set_flash(target, color, amount), 1.0, 0.0, duration)
	tween.finished.connect(func() -> void:
		if is_instance_valid(target):
			target.remove_meta(&"_fx_flash_tween"))


## Tint a node until [method pop_tint] is called with the same [param key].
## In 2D, active tints are averaged (so poison green and frost blue make teal rather
## than black) and multiplied into [member CanvasItem.modulate]. In 3D the newest
## tint is overlaid on every mesh under the node. The original look is restored
## when the last tint is removed. Don't set modulate yourself while a tint is active.
static func push_tint(target: Node, key: Variant, color: Color) -> void:
	if not is_instance_valid(target):
		return
	if target is CanvasItem:
		_remember_modulate(target)
		var tints: Dictionary = target.get_meta(&"_fx_tints", {})
		tints[key] = color
		target.set_meta(&"_fx_tints", tints)
		_compose_2d(target)
	else:
		for geometry in _geometries(target):
			var tints: Dictionary = geometry.get_meta(&"_fx_tints", {})
			tints[key] = color
			geometry.set_meta(&"_fx_tints", tints)
			_compose_3d(geometry)


static func pop_tint(target: Node, key: Variant) -> void:
	if not is_instance_valid(target):
		return
	var nodes: Array = [target] if target is CanvasItem else _geometries(target)
	for node in nodes:
		if not node.has_meta(&"_fx_tints"):
			continue
		var tints: Dictionary = node.get_meta(&"_fx_tints")
		tints.erase(key)
		if tints.is_empty():
			node.remove_meta(&"_fx_tints")
		if node is CanvasItem:
			_compose_2d(node)
		else:
			_compose_3d(node)


# --- Spawning --------------------------------------------------------------------

## Instance [param scene] at [param at] (a Vector2, Vector3 or node to copy the
## position of) under [param parent] (default: the current scene).[br]
## Particles start emitting. With [param lifetime] > 0 the node is freed after
## that many seconds; with 0, one-shot particles, sounds and non-looping animated
## sprites free themselves when finished and anything else is left to you.
static func spawn(scene: PackedScene, at: Variant = null, parent: Node = null, lifetime: float = 0.0) -> Node:
	if scene == null:
		return null
	if parent == null:
		parent = _default_parent()
	if parent == null:
		return null
	var node := scene.instantiate()
	parent.add_child(node)
	_place(node, at)
	_autostart(node, lifetime)
	return node


## Show [param text] floating up from [param at] and fading out: damage numbers,
## "Immune!", "Level up". A Vector3 position makes a billboarded Label3D.
static func popup_text(text: String, at: Variant, color: Color = Color.WHITE, parent: Node = null) -> Node:
	if parent == null:
		parent = _default_parent()
	if parent == null:
		return null
	if at is Node:
		at = _position_of(at)
	var jitter := randf_range(-1.0, 1.0)
	var tween: Tween
	var node: Node
	if at is Vector3:
		var label := Label3D.new()
		label.text = text
		label.modulate = color
		label.outline_modulate = Color(0, 0, 0, color.a)
		label.font_size = text_font_size * 3
		label.outline_size = text_outline_size * 3
		label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		label.no_depth_test = true
		label.render_priority = 10
		parent.add_child(label)
		label.global_position = at + Vector3(jitter * 0.25, 0.0, 0.0)
		tween = label.create_tween().set_parallel()
		tween.tween_property(label, "position:y", label.position.y + text_rise_3d, text_duration) \
			.set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
		tween.tween_property(label, "modulate:a", 0.0, text_duration * 0.6).set_delay(text_duration * 0.4)
		tween.tween_property(label, "outline_modulate:a", 0.0, text_duration * 0.6).set_delay(text_duration * 0.4)
		node = label
	else:
		var label := Label.new()
		label.text = text
		label.mouse_filter = Control.MOUSE_FILTER_IGNORE
		label.z_index = 100
		label.add_theme_color_override("font_color", color)
		label.add_theme_color_override("font_outline_color", Color(0, 0, 0, color.a))
		label.add_theme_constant_override("outline_size", text_outline_size)
		label.add_theme_font_size_override("font_size", text_font_size)
		parent.add_child(label)
		label.size = label.get_minimum_size()
		var origin: Vector2 = at if at is Vector2 else Vector2.ZERO
		label.global_position = origin - label.size * 0.5 + Vector2(jitter * 14.0, 0.0)
		tween = label.create_tween().set_parallel()
		tween.tween_property(label, "position:y", label.position.y - text_rise_2d, text_duration) \
			.set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
		tween.tween_property(label, "modulate:a", 0.0, text_duration * 0.6).set_delay(text_duration * 0.4)
		node = label
	tween.chain().tween_callback(node.queue_free)
	return node


## Play a one-shot sound. With a Vector2 or Vector3 position it is positional,
## otherwise global. The player frees itself when done.
static func play_sound(stream: AudioStream, at: Variant = null, volume_db: float = 0.0,
		pitch_variance: float = 0.0, bus: StringName = &"Master") -> Node:
	if stream == null:
		return null
	if at is Node:
		at = _position_of(at)
	var player: Node
	if at is Vector2:
		player = AudioStreamPlayer2D.new()
	elif at is Vector3:
		player = AudioStreamPlayer3D.new()
	else:
		player = AudioStreamPlayer.new()
	player.stream = stream
	player.volume_db = volume_db
	player.pitch_scale = maxf(0.01, 1.0 + randf_range(-pitch_variance, pitch_variance))
	player.bus = bus
	var parent := _default_parent()
	if parent == null:
		player.free()
		return null
	parent.add_child(player)
	_place(player, at)
	player.finished.connect(player.queue_free)
	player.play()
	return player


# --- 3D impacts ------------------------------------------------------------------

## A flash of light at [param at] that fades out: explosions, spell hits, sparks.
static func impact_light(at: Vector3, color: Color, energy: float = 4.0, reach: float = 5.0,
		duration: float = 0.35, parent: Node = null) -> OmniLight3D:
	if parent == null:
		parent = _default_parent()
	if parent == null:
		return null
	var light := OmniLight3D.new()
	light.light_color = color
	light.light_energy = energy
	light.omni_range = reach
	light.shadow_enabled = false
	parent.add_child(light)
	light.global_position = at
	var tween := light.create_tween()
	tween.tween_property(light, "light_energy", 0.0, duration).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_QUAD)
	tween.tween_callback(light.queue_free)
	return light


## A glowing ring that expands flat across the ground to [param radius] metres and fades.
static func shockwave(at: Vector3, color: Color, radius: float = 3.0, duration: float = 0.4,
		parent: Node = null) -> MeshInstance3D:
	if parent == null:
		parent = _default_parent()
	if parent == null:
		return null
	var torus := TorusMesh.new()
	torus.inner_radius = 0.86
	torus.outer_radius = 1.0
	torus.rings = 40
	torus.ring_segments = 6
	var material := StandardMaterial3D.new()
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	material.cull_mode = BaseMaterial3D.CULL_DISABLED
	material.albedo_color = Color(color, 0.9)
	var ring := MeshInstance3D.new()
	ring.mesh = torus
	ring.material_override = material
	ring.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(ring)
	ring.global_position = at
	ring.scale = Vector3(0.1, 0.05, 0.1)
	var tween := ring.create_tween().set_parallel()
	tween.tween_property(ring, "scale", Vector3(radius, radius * 0.25, radius), duration) \
		.set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_CUBIC)
	tween.tween_property(material, "albedo_color:a", 0.0, duration).set_ease(Tween.EASE_IN)
	tween.chain().tween_callback(ring.queue_free)
	return ring


## Voxel debris flying out from [param at] and falling, then gone: hits, breaking
## blocks, a cell colony bursting.
static func voxel_burst(at: Vector3, color: Color, amount: int = 24, voxel_size: float = 0.08,
		speed: float = 3.0, parent: Node = null) -> CPUParticles3D:
	if parent == null:
		parent = _default_parent()
	if parent == null:
		return null
	var particles := CPUParticles3D.new()
	particles.one_shot = true
	particles.explosiveness = 1.0
	particles.amount = maxi(amount, 1)
	particles.lifetime = 0.9
	particles.direction = Vector3.UP
	particles.spread = 75.0
	particles.initial_velocity_min = speed * 0.5
	particles.initial_velocity_max = speed
	particles.gravity = Vector3(0.0, -9.8, 0.0)
	particles.angular_velocity_min = -360.0
	particles.angular_velocity_max = 360.0
	var shrink := Curve.new()
	shrink.add_point(Vector2(0.0, 1.0))
	shrink.add_point(Vector2(1.0, 0.0))
	particles.scale_amount_curve = shrink
	var box := BoxMesh.new()
	box.size = Vector3.ONE * voxel_size
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.emission_enabled = true
	material.emission = color
	material.emission_energy_multiplier = 1.5
	box.material = material
	particles.mesh = box
	parent.add_child(particles)
	particles.global_position = at
	_autostart(particles, 0.0)
	return particles


# --- Internals -------------------------------------------------------------------

static func _server() -> Node:
	if is_instance_valid(_instance):
		return _instance
	var tree := Engine.get_main_loop() as SceneTree
	if tree == null or tree.root == null:
		return null
	_instance = _Server.new()
	_instance.name = "FxServer"
	# Deferred, because we may be called while the tree is busy adding nodes.
	tree.root.add_child.call_deferred(_instance)
	return _instance


static func _default_parent() -> Node:
	var tree := Engine.get_main_loop() as SceneTree
	if tree == null:
		return null
	return tree.current_scene if is_instance_valid(tree.current_scene) else tree.root


static func _position_of(node: Node) -> Variant:
	if node is Node2D or node is Control or node is Node3D:
		return node.global_position
	return null


static func _place(node: Node, at: Variant) -> void:
	if at is Node:
		at = _position_of(at)
	if at is Vector2 and (node is Node2D or node is Control):
		node.global_position = at
	elif at is Vector3 and node is Node3D:
		node.global_position = at


static func _autostart(node: Node, lifetime: float) -> void:
	if "emitting" in node:
		node.emitting = true
	if lifetime > 0.0:
		node.get_tree().create_timer(lifetime, false).timeout.connect(node.queue_free)
	elif "one_shot" in node and node.one_shot and node.has_signal("finished"):
		node.finished.connect(node.queue_free)
	elif node is AnimatedSprite2D or node is AnimatedSprite3D:
		var frames: SpriteFrames = node.sprite_frames
		if frames != null and not frames.get_animation_loop(node.animation):
			node.play()
			node.animation_finished.connect(node.queue_free)


static func _has_uniform(shader: Shader, uniform: StringName) -> bool:
	for info in shader.get_shader_uniform_list():
		if info.name == uniform:
			return true
	return false


static func _tween_shader_flash(target: Node, material: ShaderMaterial, color: Color, duration: float) -> void:
	var tween: Tween = target.get_meta(&"_fx_flash_tween") if target.has_meta(&"_fx_flash_tween") else null
	if tween != null and tween.is_valid():
		tween.kill()
	material.set_shader_parameter(&"flash_color", color)
	tween = target.create_tween()
	target.set_meta(&"_fx_flash_tween", tween)
	tween.tween_method(func(amount: float) -> void:
		material.set_shader_parameter(&"flash_amount", amount), 1.0, 0.0, duration)


static func _set_flash(target: Node, color: Color, amount: float) -> void:
	if not is_instance_valid(target):
		return
	if target is CanvasItem:
		_remember_modulate(target)
		var boosted := Color(color.r * flash_boost, color.g * flash_boost, color.b * flash_boost, 1.0)
		target.set_meta(&"_fx_flash", Color.WHITE.lerp(boosted, amount))
		_compose_2d(target)
	else:
		for geometry in _geometries(target):
			geometry.set_meta(&"_fx_flash", Color(color, color.a * amount))
			_compose_3d(geometry)


static func _remember_modulate(target: CanvasItem) -> void:
	if not target.has_meta(&"_fx_base_modulate"):
		target.set_meta(&"_fx_base_modulate", target.modulate)


static func _compose_2d(target: CanvasItem) -> void:
	if not target.has_meta(&"_fx_base_modulate"):
		return
	var color: Color = target.get_meta(&"_fx_base_modulate")
	var tints: Dictionary = target.get_meta(&"_fx_tints", {})
	if not tints.is_empty():
		var sum := Color(0, 0, 0, 0)
		for tint in tints.values():
			sum += tint
		color *= sum / tints.size()
	var flash_color: Color = target.get_meta(&"_fx_flash", Color.WHITE)
	color *= flash_color
	target.modulate = color
	if tints.is_empty() and flash_color == Color.WHITE:
		target.remove_meta(&"_fx_base_modulate")
		target.remove_meta(&"_fx_flash")


static func _geometries(target: Node) -> Array:
	var found: Array = []
	if target is GeometryInstance3D:
		found.append(target)
	for node in target.find_children("*", "GeometryInstance3D", true, false):
		found.append(node)
	return found.filter(func(node: Node) -> bool:
		return not (node is GPUParticles3D or node is CPUParticles3D or node is Label3D))


static func _compose_3d(geometry: GeometryInstance3D) -> void:
	var flash_color: Color = geometry.get_meta(&"_fx_flash", Color.TRANSPARENT)
	var tints: Dictionary = geometry.get_meta(&"_fx_tints", {})
	var color := Color.TRANSPARENT
	if flash_color.a > 0.001:
		color = flash_color
	elif not tints.is_empty():
		color = Color(tints.values()[-1], tint_strength_3d)

	if color.a <= 0.001:
		if geometry.has_meta(&"_fx_overlay_original"):
			geometry.material_overlay = geometry.get_meta(&"_fx_overlay_original")[0]
			geometry.remove_meta(&"_fx_overlay_original")
		geometry.remove_meta(&"_fx_flash")
		return
	if not geometry.has_meta(&"_fx_overlay_original"):
		# Wrapped in an array because set_meta(null) would delete the entry.
		geometry.set_meta(&"_fx_overlay_original", [geometry.material_overlay])
	var overlay: StandardMaterial3D = geometry.get_meta(&"_fx_overlay") if geometry.has_meta(&"_fx_overlay") else null
	if overlay == null:
		overlay = StandardMaterial3D.new()
		overlay.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		overlay.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		geometry.set_meta(&"_fx_overlay", overlay)
	overlay.albedo_color = color
	geometry.material_overlay = overlay
