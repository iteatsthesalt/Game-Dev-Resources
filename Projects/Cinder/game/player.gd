extends CharacterBody3D
## A playable voxel character: movement, follow camera and procedural animation
## (idle, walk, run, attack, dodge roll and ability) on a CharacterRig.
##
## Keys: WASD / arrows move, Shift runs, Space dodges, J or left click attacks,
## K uses the ability, drag with the right mouse button (or left, outside
## attacks) turns the camera. `move_override` lets touch controls and tests drive it.

const WALK := 2.4
const RUN := 4.6
const DODGE := 7.0
const GRAVITY := 18.0
const ATTACK_TIME := 0.5
const DODGE_TIME := 0.55
const ABILITY_TIME := 1.0

var rig: CharacterRig
var camera: Camera3D
var cam_yaw := PI
var cam_pitch := -0.32
var cam_distance := 3.6
var move_override := Vector2.ZERO   # x = right, y = forward (touch / tests)
var run_override := false
var face_yaw := 0.0
var phase := 0.0
var stride := 0.0          # 0 idle .. 1 walk .. 2 run
var attack_t := -1.0
var dodge_t := -1.0
var ability_t := -1.0
var dodge_dir := Vector3.FORWARD
var time := 0.0
var _burst: CPUParticles3D
var _flash: OmniLight3D


func setup(id: String) -> bool:
	if rig:
		rig.queue_free()
		rig = null
	rig = CharacterRig.create(id)
	if rig == null:
		return false
	add_child(rig)
	var glow := rig.glow_color()
	if _burst == null:
		_build_fx()
	(_burst.mesh.surface_get_material(0) as StandardMaterial3D).albedo_color = glow
	(_burst.mesh.surface_get_material(0) as StandardMaterial3D).emission = glow
	_flash.light_color = glow
	return true


func _ready() -> void:
	var shape := CollisionShape3D.new()
	var capsule := CapsuleShape3D.new()
	capsule.radius = 0.32
	capsule.height = 1.7
	shape.shape = capsule
	shape.position.y = 0.85
	add_child(shape)
	camera = Camera3D.new()
	camera.fov = 55.0
	camera.top_level = true
	add_child(camera)
	_update_camera(1.0)


func _build_fx() -> void:
	_burst = CPUParticles3D.new()
	_burst.emitting = false
	_burst.one_shot = true
	_burst.amount = 90
	_burst.lifetime = 0.9
	_burst.explosiveness = 0.85
	_burst.direction = Vector3.UP
	_burst.spread = 180.0
	_burst.initial_velocity_min = 1.5
	_burst.initial_velocity_max = 4.0
	_burst.gravity = Vector3(0, 1.5, 0)
	_burst.scale_amount_min = 0.6
	_burst.scale_amount_max = 1.4
	var box := BoxMesh.new()
	box.size = Vector3.ONE * 0.05
	var mat := StandardMaterial3D.new()
	mat.emission_enabled = true
	mat.emission_energy_multiplier = 3.0
	box.material = mat
	_burst.mesh = box
	_burst.position = Vector3(0, 1.0, 0)
	add_child(_burst)
	_flash = OmniLight3D.new()
	_flash.light_energy = 0.0
	_flash.omni_range = 5.0
	_flash.position = Vector3(0, 1.4, 0.3)
	add_child(_flash)


#region Input

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and (event.button_mask & (MOUSE_BUTTON_MASK_RIGHT | MOUSE_BUTTON_MASK_MIDDLE)):
		cam_yaw -= event.relative.x * 0.006
		cam_pitch = clampf(cam_pitch - event.relative.y * 0.004, -1.1, 0.2)
	elif event is InputEventMouseButton and event.pressed:
		match event.button_index:
			MOUSE_BUTTON_LEFT:
				attack()
			MOUSE_BUTTON_WHEEL_UP:
				cam_distance = maxf(cam_distance * 0.9, 1.6)
			MOUSE_BUTTON_WHEEL_DOWN:
				cam_distance = minf(cam_distance * 1.1, 9.0)
	elif event is InputEventKey and event.pressed and not event.echo:
		match event.physical_keycode:
			KEY_SPACE:
				dodge()
			KEY_J:
				attack()
			KEY_K:
				ability()


func _move_input() -> Vector2:
	var v := move_override
	if Input.is_physical_key_pressed(KEY_W) or Input.is_physical_key_pressed(KEY_UP):
		v.y += 1
	if Input.is_physical_key_pressed(KEY_S) or Input.is_physical_key_pressed(KEY_DOWN):
		v.y -= 1
	if Input.is_physical_key_pressed(KEY_D) or Input.is_physical_key_pressed(KEY_RIGHT):
		v.x += 1
	if Input.is_physical_key_pressed(KEY_A) or Input.is_physical_key_pressed(KEY_LEFT):
		v.x -= 1
	return v.limit_length(1.0)


func attack() -> void:
	if attack_t < 0.0 and dodge_t < 0.0:
		attack_t = 0.0


func dodge() -> void:
	if dodge_t < 0.0:
		dodge_t = 0.0
		var fwd := Vector3(sin(face_yaw), 0, cos(face_yaw))
		var input := _move_input()
		if input.length() > 0.1:
			fwd = _camera_basis_dir(input)
		dodge_dir = fwd


func ability() -> void:
	if ability_t < 0.0 and dodge_t < 0.0:
		ability_t = 0.0

#endregion

func _camera_basis_dir(input: Vector2) -> Vector3:
	var forward := Vector3(-sin(cam_yaw), 0, -cos(cam_yaw))
	var right := Vector3(cos(cam_yaw), 0, -sin(cam_yaw))
	return (forward * input.y + right * input.x).normalized()


func _physics_process(delta: float) -> void:
	time += delta
	var input := _move_input()
	var running := run_override or Input.is_physical_key_pressed(KEY_SHIFT)
	var target := Vector3.ZERO
	if input.length() > 0.05:
		var dir := _camera_basis_dir(input)
		target = dir * (RUN if running else WALK) * input.length()
		face_yaw = lerp_angle(face_yaw, atan2(dir.x, dir.z), minf(1.0, delta * 12.0))
	if attack_t >= 0.0 or ability_t >= 0.0:
		target *= 0.25
	if dodge_t >= 0.0:
		target = dodge_dir * DODGE * (1.0 - dodge_t / DODGE_TIME * 0.6)
		face_yaw = lerp_angle(face_yaw, atan2(dodge_dir.x, dodge_dir.z), minf(1.0, delta * 20.0))
	velocity.x = move_toward(velocity.x, target.x, delta * 30.0)
	velocity.z = move_toward(velocity.z, target.z, delta * 30.0)
	velocity.y = 0.0 if is_on_floor() else velocity.y - GRAVITY * delta
	move_and_slide()
	if rig:
		rig.rotation.y = face_yaw
		_animate(delta)
	_update_camera(delta)


func _update_camera(delta: float) -> void:
	if camera == null:
		return
	var focus := global_position + Vector3(0, 1.15, 0)
	var dir := Basis.from_euler(Vector3(cam_pitch, cam_yaw, 0)) * Vector3.BACK
	var want := focus + dir * cam_distance
	camera.global_position = camera.global_position.lerp(want, minf(1.0, delta * 8.0)) if delta < 1.0 else want
	camera.look_at(focus)


#region Animation

func _animate(delta: float) -> void:
	var speed := Vector2(velocity.x, velocity.z).length()
	stride = move_toward(stride, clampf(speed / WALK, 0.0, 2.0), delta * 6.0)
	phase += delta * (4.2 + stride * 2.6) * minf(stride, 1.0)
	pose(delta)


## Applies the current animation state to the rig. Also used for still previews.
func pose(delta := 0.0) -> void:
	rig.reset_pose()
	var walk := minf(stride, 1.0)
	var run := clampf(stride - 1.0, 0.0, 1.0)
	var s := sin(phase)
	var c := cos(phase)
	var amp := walk * (0.55 + run * 0.35)

	# Legs.
	_rot("leg_up_r", -s * amp)
	_rot("leg_up_l", s * amp)
	_rot("leg_lo_r", maxf(0.0, c) * amp * 1.3)
	_rot("leg_lo_l", maxf(0.0, -c) * amp * 1.3)
	# Arms swing against the legs; elbows stay bent in the ready pose.
	_rot("arm_up_r", s * amp * 0.7)
	_rot("arm_up_l", -s * amp * 0.7)
	_rot("arm_lo_r", -absf(s) * amp * 0.3)
	_rot("arm_lo_l", -absf(s) * amp * 0.3)
	# Body: bob, lean and twist; idle breathing.
	var breath := sin(time * 2.2) * (1.0 - walk)
	_move("pelvis", Vector3(0, absf(s) * 0.035 * amp - run * 0.04 + breath * 0.006, 0))
	_rot("torso", run * 0.18 + walk * 0.04, s * 0.12 * amp)
	_rot("head", -run * 0.12 + sin(time * 0.7) * 0.04 * (1.0 - walk), -s * 0.08 * amp + sin(time * 0.5) * 0.12 * (1.0 - walk))
	_rot("arm_up_l", breath * 0.04)
	_rot("arm_up_r", -breath * 0.04)
	_rot("cape", walk * 0.25 + run * 0.35 + absf(c) * 0.1 * amp)

	if attack_t >= 0.0:
		attack_t += delta
		_pose_attack(attack_t / ATTACK_TIME)
		if attack_t >= ATTACK_TIME:
			attack_t = -1.0
	if ability_t >= 0.0:
		if ability_t == 0.0 and delta > 0.0:
			_burst.restart()
			_burst.emitting = true
		ability_t += delta
		_pose_ability(ability_t / ABILITY_TIME)
		if ability_t >= ABILITY_TIME:
			ability_t = -1.0
	elif _flash:
		_flash.light_energy = move_toward(_flash.light_energy, 0.0, delta * 6.0)
	if dodge_t >= 0.0:
		dodge_t += delta
		_pose_dodge(dodge_t / DODGE_TIME)
		if dodge_t >= DODGE_TIME:
			dodge_t = -1.0


func _pose_attack(t: float) -> void:
	var bow: bool = rig.rig.get("weapon", "") == "bow"
	if bow:
		var draw := sin(clampf(t, 0.0, 1.0) * PI)
		_rot("arm_up_l", -1.2 * draw, 0.0, 0.3 * draw)
		_rot("arm_up_r", -1.0 * draw, 0.0, -0.4 * draw)
		_rot("arm_lo_r", -0.9 * draw)
		_rot("torso", 0.0, 0.5 * draw)
		return
	# Wind up overhead, then a fast diagonal swing with a body twist.
	var up := smoothstep(0.0, 0.3, t)
	var down := smoothstep(0.3, 0.55, t)
	var back := smoothstep(0.7, 1.0, t)
	var arm := lerpf(lerpf(0.0, -2.4, up), 0.5, down)
	arm = lerpf(arm, 0.0, back)
	_rot("arm_up_r", arm, 0.0, lerpf(-0.3 * up, 0.25, down) * (1.0 - back))
	_rot("arm_lo_r", lerpf(-0.6 * up, 0.0, down) * (1.0 - back))
	_rot("torso", 0.12 * down * (1.0 - back), lerpf(-0.45 * up, 0.5, down) * (1.0 - back))
	_rot("arm_up_l", -0.5 * down * (1.0 - back))


func _pose_ability(t: float) -> void:
	var rise := smoothstep(0.0, 0.25, t) * (1.0 - smoothstep(0.75, 1.0, t))
	_rot("arm_up_r", -2.6 * rise, 0.0, -0.35 * rise)
	_rot("arm_up_l", -2.6 * rise, 0.0, 0.35 * rise)
	_rot("arm_lo_r", -0.3 * rise)
	_rot("arm_lo_l", -0.3 * rise)
	_rot("torso", -0.15 * rise)
	_rot("head", -0.3 * rise)
	_move("pelvis", Vector3(0, 0.05 * rise, 0))
	if _flash:
		_flash.light_energy = 3.0 * rise


func _pose_dodge(t: float) -> void:
	# Tuck and roll forward around the body's middle.
	var tuck := sin(clampf(t, 0.0, 1.0) * PI)
	var angle := smoothstep(0.05, 0.9, t) * TAU
	var mid := rig.height() * 0.45
	var spin := Transform3D(Basis(Vector3.RIGHT, angle), Vector3.ZERO)
	var pelvis: Node3D = rig.j("pelvis")
	if pelvis:
		var rest_pos: Vector3 = rig.rest["pelvis"]
		var about := Vector3(0, mid, 0)
		pelvis.transform = Transform3D(Basis(), about) * spin * Transform3D(Basis(), rest_pos - about - Vector3(0, mid * 0.45 * tuck, 0))
	_rot("leg_up_r", -1.6 * tuck)
	_rot("leg_up_l", -1.5 * tuck)
	_rot("leg_lo_r", 2.0 * tuck)
	_rot("leg_lo_l", 2.0 * tuck)
	_rot("arm_up_r", -1.2 * tuck)
	_rot("arm_up_l", -1.2 * tuck)
	_rot("torso", 0.6 * tuck)
	_rot("head", 0.4 * tuck)


func _rot(part: String, x: float, y := 0.0, z := 0.0) -> void:
	var node: Node3D = rig.j(part)
	if node:
		node.rotation += Vector3(x, y, z)


func _move(part: String, offset: Vector3) -> void:
	var node: Node3D = rig.j(part)
	if node:
		node.position += offset

#endregion
