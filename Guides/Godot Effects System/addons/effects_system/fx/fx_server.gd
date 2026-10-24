extends Node
## Internal helper behind [Fx]: runs camera shake and restores the time scale after
## hit-stop. Created on demand; you don't need to add it yourself.

var trauma := 0.0
var hitstop_active := false

var _camera: Node
var _requested_camera: WeakRef
var _applied_offset := Vector2.ZERO
var _applied_rotation := 0.0
var _noise := FastNoiseLite.new()
var _time := 0.0
var _last_usec := 0

var _saved_time_scale := 1.0
var _hitstop_until := 0
var _hitstop_id := 0


func _init() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_noise.seed = randi()
	_noise.frequency = 1.0
	set_process(false)


func add_trauma(amount: float, camera: Node = null) -> void:
	trauma = clampf(trauma + amount, 0.0, 1.0)
	if camera != null:
		_requested_camera = weakref(camera)
	set_process(trauma > 0.0)


func stop_shake() -> void:
	trauma = 0.0
	_restore_camera()
	set_process(false)


func hitstop(duration: float, time_scale: float) -> void:
	if duration <= 0.0:
		return
	if not hitstop_active:
		_saved_time_scale = Engine.time_scale
		hitstop_active = true
	Engine.time_scale = minf(Engine.time_scale, maxf(time_scale, 0.0))
	var until := Time.get_ticks_usec() + int(duration * 1000000.0)
	if until <= _hitstop_until:
		return  # A longer freeze is already running and will restore the time scale.
	_hitstop_until = until
	_hitstop_id += 1
	var id := _hitstop_id
	var tree := Engine.get_main_loop() as SceneTree
	# Real time: process_always, not in physics, ignore_time_scale.
	tree.create_timer(duration, true, false, true).timeout.connect(func() -> void:
		if id == _hitstop_id:
			cancel_hitstop())


func cancel_hitstop() -> void:
	if not hitstop_active:
		return
	hitstop_active = false
	_hitstop_until = 0
	_hitstop_id += 1
	Engine.time_scale = _saved_time_scale


func _process(_delta: float) -> void:
	# Real time, so the camera keeps shaking through hit-stop.
	var now := Time.get_ticks_usec()
	var dt := 0.0 if _last_usec == 0 else minf((now - _last_usec) / 1000000.0, 0.1)
	_last_usec = now
	_time += dt

	var camera := _find_camera()
	if camera != _camera:
		_restore_camera()
		_camera = camera
	trauma = maxf(trauma - Fx.shake_decay * dt, 0.0)
	if _camera == null or trauma <= 0.0:
		stop_shake()
		_last_usec = 0
		return

	var amount := trauma * trauma
	var wobble := Vector2(
		_noise.get_noise_2d(_time * Fx.shake_frequency, 0.0),
		_noise.get_noise_2d(0.0, _time * Fx.shake_frequency + 100.0))
	if _camera is Camera2D:
		var offset := wobble * Fx.shake_offset_2d * amount
		var rotation := _noise.get_noise_2d(_time * Fx.shake_frequency, 200.0) * Fx.shake_rotation_2d * amount
		_camera.offset += offset - _applied_offset
		_camera.rotation += rotation - _applied_rotation
		_applied_offset = offset
		_applied_rotation = rotation
	elif _camera is Camera3D:
		var offset := wobble * Fx.shake_offset_3d * amount
		_camera.h_offset += offset.x - _applied_offset.x
		_camera.v_offset += offset.y - _applied_offset.y
		_applied_offset = offset


func _find_camera() -> Node:
	if _requested_camera != null:
		var requested: Node = _requested_camera.get_ref()
		if is_instance_valid(requested) and requested.is_inside_tree():
			return requested
		_requested_camera = null
	var viewport := get_viewport()
	if viewport == null:
		return null
	var camera_2d := viewport.get_camera_2d()
	if camera_2d != null:
		return camera_2d
	return viewport.get_camera_3d()


func _restore_camera() -> void:
	if is_instance_valid(_camera):
		if _camera is Camera2D:
			_camera.offset -= _applied_offset
			_camera.rotation -= _applied_rotation
		elif _camera is Camera3D:
			_camera.h_offset -= _applied_offset.x
			_camera.v_offset -= _applied_offset.y
	_camera = null
	_applied_offset = Vector2.ZERO
	_applied_rotation = 0.0
