extends CharacterBody3D
## An Ash Ghoul: wanders the caldera, catches whatever it walks through and
## carries it. A burning ghoul panics and runs, shedding fire into the grass; a
## dead one scatters what it carried. It crawls back out of the ash later.

signal died(ghoul: Node3D)

const GRAVITY := 18.0

## Set by the demo: the area to wander.
var bounds := 12.0
var dead := false

var effects: EffectComponent
var host: CellHost
var body: Node3D
var _target := Vector3.ZERO
var _rethink := 0.0
var _rng := RandomNumberGenerator.new()


func _ready() -> void:
	_rng.seed = hash(name)
	var shape := CollisionShape3D.new()
	shape.name = "CollisionShape3D"
	var capsule := CapsuleShape3D.new()
	capsule.radius = 0.28
	capsule.height = 1.4
	shape.shape = capsule
	shape.position.y = 0.7
	add_child(shape)
	body = Node3D.new()
	body.name = "Body"
	add_child(body)
	var ash := Color("#6a6460")
	var soot := Color("#3a3038")
	VoxelBody.box(body, Vector3(0.16, 0.5, 0.16), Vector3(-0.12, 0.25, 0), soot)
	VoxelBody.box(body, Vector3(0.16, 0.5, 0.16), Vector3(0.12, 0.25, 0), soot)
	var torso := VoxelBody.box(body, Vector3(0.46, 0.55, 0.32), Vector3(0, 0.8, 0.04), ash)
	torso.rotation.x = 0.35
	VoxelBody.box(body, Vector3(0.12, 0.62, 0.12), Vector3(-0.32, 0.72, 0.16), soot)
	VoxelBody.box(body, Vector3(0.12, 0.62, 0.12), Vector3(0.32, 0.72, 0.16), soot)
	VoxelBody.box(body, Vector3(0.3, 0.3, 0.3), Vector3(0, 1.15, 0.2), Color("#7d7874"))
	VoxelBody.box(body, Vector3(0.07, 0.05, 0.02), Vector3(-0.07, 1.17, 0.36), Color("#ff7a2a"), 5.0)
	VoxelBody.box(body, Vector3(0.07, 0.05, 0.02), Vector3(0.07, 1.17, 0.36), Color("#ff7a2a"), 5.0)
	effects = EffectComponent.new()
	effects.name = "EffectComponent"
	effects.base_stats = {&"health": 60.0, &"max_health": 60.0, &"speed": 1.6}
	effects.stat_limits = {&"health": &"max_health"}
	effects.visual_node = NodePath("../Body")
	add_child(effects)
	effects.stat_depleted.connect(_on_depleted)
	host = CellHost.new()
	host.name = "CellHost"
	host.radius = 0.3
	host.height = 1.4
	add_child(host)
	_pick_target()


func _physics_process(delta: float) -> void:
	var target_velocity := Vector3.ZERO
	if not dead:
		var burning := effects.has_tag(&"fire")
		_rethink -= delta
		# Burning ghouls panic: fast, erratic, and they spread the fire.
		if _rethink <= 0.0 or global_position.distance_to(_target) < 0.6:
			_pick_target(burning)
		var to_target := _target - global_position
		to_target.y = 0.0
		var speed := effects.get_stat(&"speed") * (2.2 if burning else 1.0)
		target_velocity = to_target.normalized() * speed
		if to_target.length() > 0.1:
			body.rotation.y = lerp_angle(body.rotation.y, atan2(to_target.x, to_target.z), minf(delta * 6.0, 1.0))
		body.position.y = absf(sin(Time.get_ticks_msec() * 0.008 * speed)) * 0.06
	velocity.x = move_toward(velocity.x, target_velocity.x, delta * 12.0)
	velocity.z = move_toward(velocity.z, target_velocity.z, delta * 12.0)
	velocity.y = 0.0 if is_on_floor() else velocity.y - GRAVITY * delta
	move_and_slide()


func _pick_target(panicked: bool = false) -> void:
	var reach := 3.0 if panicked else 7.0
	_target = global_position + Vector3(_rng.randf_range(-reach, reach), 0, _rng.randf_range(-reach, reach))
	_target.x = clampf(_target.x, -bounds, bounds)
	_target.z = clampf(_target.z, -bounds, bounds)
	_rethink = _rng.randf_range(0.6, 1.4) if panicked else _rng.randf_range(3.0, 6.0)


func _on_depleted(stat: StringName) -> void:
	if stat != &"health" or dead:
		return
	dead = true
	died.emit(self)
	Fx.voxel_burst(global_position + Vector3.UP * 0.8, Color("#6a6460"), 28, 0.09, 3.5)
	body.visible = false
	$CollisionShape3D.disabled = true
	await get_tree().create_timer(8.0).timeout
	effects.clear_effects()
	global_position = Vector3(_rng.randf_range(-bounds, bounds), 0.3, _rng.randf_range(-bounds, bounds))
	effects.set_base_stat(&"health", effects.get_stat(&"max_health"))
	$CollisionShape3D.disabled = false
	body.visible = true
	dead = false
