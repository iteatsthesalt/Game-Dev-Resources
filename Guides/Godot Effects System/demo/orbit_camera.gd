extends Camera3D
## Cinderdeep's camera: tilted about 50° down, following the target. Q and E turn it
## in 45° steps, the mouse wheel zooms.

var target: Node3D
var yaw := deg_to_rad(-35.0)
var pitch := deg_to_rad(-52.0)
var distance := 17.0
var _yaw_goal := yaw


func _ready() -> void:
	fov = 50.0
	_yaw_goal = yaw


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		if event.physical_keycode == KEY_Q:
			_yaw_goal += PI / 4.0
		elif event.physical_keycode == KEY_E:
			_yaw_goal -= PI / 4.0
	elif event is InputEventMouseButton and event.pressed:
		if event.button_index == MOUSE_BUTTON_WHEEL_UP:
			distance = maxf(distance * 0.9, 7.0)
		elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			distance = minf(distance * 1.1, 32.0)


func _process(delta: float) -> void:
	if target == null:
		return
	yaw = lerp_angle(yaw, _yaw_goal, minf(delta * 8.0, 1.0))
	var focus := target.global_position + Vector3.UP * 0.8
	var offset := Basis.from_euler(Vector3(pitch, yaw, 0.0)) * Vector3.BACK * distance
	var want := focus + offset
	global_position = global_position.lerp(want, minf(delta * 6.0, 1.0)) if delta < 0.5 else want
	look_at(focus)


## Snap to the target immediately.
func snap() -> void:
	_process(1.0)
