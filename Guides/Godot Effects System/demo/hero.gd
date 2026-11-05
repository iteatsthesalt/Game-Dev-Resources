extends CharacterBody3D
## The demo's hero: a voxel wanderer with an EffectComponent and a CellHost, so
## the world's strains can burn, chill, sicken or mend it. When it falls, the
## mycelium drags it back to the Mycelium Node.

signal died

const GRAVITY := 18.0

## Set by the demo: where the mycelium brings you back.
var respawn_point := Vector3.ZERO
## Movement in camera space (x right, y forward), from the keyboard or the autopilot.
var move_input := Vector2.ZERO
var camera_yaw := 0.0
var dead := false

var effects: EffectComponent
var host: CellHost
var body: Node3D
var _legs: Array[Node3D] = []
var _phase := 0.0


func _ready() -> void:
	var shape := CollisionShape3D.new()
	shape.name = "CollisionShape3D"
	var capsule := CapsuleShape3D.new()
	capsule.radius = 0.3
	capsule.height = 1.7
	shape.shape = capsule
	shape.position.y = 0.85
	add_child(shape)
	body = Node3D.new()
	body.name = "Body"
	add_child(body)
	_build_body()
	effects = EffectComponent.new()
	effects.name = "EffectComponent"
	effects.base_stats = {&"health": 120.0, &"max_health": 120.0, &"speed": 4.0}
	effects.stat_limits = {&"health": &"max_health"}
	effects.visual_node = NodePath("../Body")
	add_child(effects)
	effects.stat_depleted.connect(_on_depleted)
	host = CellHost.new()
	host.name = "CellHost"
	host.radius = 0.3
	host.height = 1.8
	add_child(host)


func _build_body() -> void:
	var iron := Color("#3a3038")
	var steel := Color("#84807e")
	var cloth := Color("#8a1a1e")
	for side in [-1, 1]:
		var leg := Node3D.new()
		leg.position = Vector3(0.12 * side, 0.7, 0)
		body.add_child(leg)
		VoxelBody.box(leg, Vector3(0.18, 0.7, 0.2), Vector3(0, -0.35, 0), iron)
		_legs.append(leg)
	VoxelBody.box(body, Vector3(0.5, 0.6, 0.3), Vector3(0, 1.0, 0), steel)
	VoxelBody.box(body, Vector3(0.52, 0.12, 0.32), Vector3(0, 0.75, 0), Color("#554e53"))
	VoxelBody.box(body, Vector3(0.46, 0.7, 0.06), Vector3(0, 0.95, -0.18), cloth)
	for side in [-1, 1]:
		VoxelBody.box(body, Vector3(0.14, 0.55, 0.16), Vector3(0.33 * side, 1.0, 0), iron)
	VoxelBody.box(body, Vector3(0.34, 0.34, 0.34), Vector3(0, 1.5, 0), Color("#b3b0b4"))
	VoxelBody.box(body, Vector3(0.24, 0.05, 0.02), Vector3(0, 1.52, 0.175), Color("#ffb35e"), 4.0)
	VoxelBody.box(body, Vector3(0.06, 0.9, 0.06), Vector3(0.42, 1.1, 0.12), Color("#dcdde4"), 0.4)


func _physics_process(delta: float) -> void:
	var target := Vector3.ZERO
	if not dead and move_input.length() > 0.05:
		var forward := Vector3(-sin(camera_yaw), 0, -cos(camera_yaw))
		var right := Vector3(cos(camera_yaw), 0, -sin(camera_yaw))
		var direction := (forward * move_input.y + right * move_input.x).normalized()
		target = direction * effects.get_stat(&"speed") * minf(move_input.length(), 1.0)
		body.rotation.y = lerp_angle(body.rotation.y, atan2(direction.x, direction.z), minf(delta * 12.0, 1.0))
	velocity.x = move_toward(velocity.x, target.x, delta * 30.0)
	velocity.z = move_toward(velocity.z, target.z, delta * 30.0)
	velocity.y = 0.0 if is_on_floor() else velocity.y - GRAVITY * delta
	move_and_slide()
	var speed := Vector2(velocity.x, velocity.z).length()
	_phase += delta * speed * 3.0
	for i in _legs.size():
		_legs[i].rotation.x = sin(_phase + PI * i) * minf(speed / 4.0, 1.0) * 0.6


func _on_depleted(stat: StringName) -> void:
	if stat != &"health" or dead:
		return
	dead = true
	died.emit()
	Fx.voxel_burst(global_position + Vector3.UP, Color("#b3b0b4"), 30, 0.1, 4.0)
	Fx.shake(0.6)
	body.visible = false
	await get_tree().create_timer(2.0).timeout
	effects.clear_effects()
	global_position = respawn_point
	velocity = Vector3.ZERO
	effects.set_base_stat(&"health", effects.get_stat(&"max_health"))
	body.visible = true
	dead = false
	Fx.shockwave(global_position + Vector3.UP * 0.2, Color("#3fd6b0"), 2.5, 0.6)
	Fx.impact_light(global_position + Vector3.UP, Color("#3fd6b0"), 4.0, 6.0, 0.8)
	Fx.popup_text("The mycelium drags you back", global_position + Vector3.UP * 2.4, Color("#7fffd8"))
