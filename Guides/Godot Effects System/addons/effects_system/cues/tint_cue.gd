@icon("res://addons/effects_system/icons/cue.svg")
class_name TintCue
extends EffectCue
## Tints the target for as long as the effect is active: green while poisoned,
## blue while frozen. Several tints are averaged (2D) or the newest wins (3D).

@export var color: Color = Color(0.6, 1.0, 0.6)


func _init() -> void:
	events = 0


func _start(instance: EffectInstance) -> void:
	var visual := get_visual(instance)
	if visual != null:
		get_state(instance)[&"node"] = visual
		Fx.push_tint(visual, instance, color)


func _stop(instance: EffectInstance) -> void:
	var visual = get_state(instance).get(&"node")  # Untyped: may already be freed.
	if is_instance_valid(visual):
		Fx.pop_tint(visual, instance)
