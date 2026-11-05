@icon("res://addons/effects_system/icons/cue.svg")
class_name SceneCue
extends EffectCue
## Spawns a scene, usually particles. One-shot on the chosen [member events], or
## kept alive for as long as the effect lasts.

enum Mode {
	## Spawn on every event ticked in [member EffectCue.events].
	ONE_SHOT,
	## Spawn when the effect starts and remove it when the effect ends.
	WHILE_ACTIVE,
}

@export var scene: PackedScene
@export var mode: Mode = Mode.ONE_SHOT
## Parent the spawned node to the target so it follows it. WHILE_ACTIVE always attaches.
@export var attach: bool = false
## Offset from the target. Only x and y are used in 2D.
@export var offset: Vector3 = Vector3.ZERO
## ONE_SHOT: free after this many seconds (0 = let one-shot particles free themselves).
## WHILE_ACTIVE: particles stop emitting when the effect ends and are freed after this
## many seconds, so they fade out instead of vanishing (0 = use the particle lifetime).
@export_range(0.0, 30.0, 0.05, "or_greater", "suffix:s") var linger: float = 0.0


func _fire(_event: EffectCue.Event, instance: EffectInstance) -> void:
	if mode == Mode.ONE_SHOT:
		_spawn(instance, attach, linger)


func _start(instance: EffectInstance) -> void:
	if mode == Mode.WHILE_ACTIVE:
		var node := _spawn(instance, true, 0.0)
		if node != null:
			get_state(instance)[&"node"] = node


func _stop(instance: EffectInstance) -> void:
	var state := get_state(instance)
	# Untyped: the node may already have been freed along with its parent.
	var node = state.get(&"node")
	state.erase(&"node")
	if not is_instance_valid(node) or node.is_queued_for_deletion():
		return
	if "emitting" in node and node.is_inside_tree():
		node.emitting = false
		var wait: float = linger if linger > 0.0 else float(node.get(&"lifetime"))
		node.get_tree().create_timer(wait, false).timeout.connect(node.queue_free)
	else:
		node.queue_free()


func _spawn(instance: EffectInstance, attached: bool, lifetime: float) -> Node:
	if scene == null:
		return null
	var visual := get_visual(instance)
	var position: Variant = get_position(instance)
	if attached and visual != null:
		var node := Fx.spawn(scene, null, visual, lifetime)
		if node is Node2D:
			node.position = Vector2(offset.x, offset.y)
		elif node is Node3D:
			node.position = offset
		return node
	if position is Vector2:
		position += Vector2(offset.x, offset.y)
	elif position is Vector3:
		position += offset
	return Fx.spawn(scene, position, null, lifetime)
