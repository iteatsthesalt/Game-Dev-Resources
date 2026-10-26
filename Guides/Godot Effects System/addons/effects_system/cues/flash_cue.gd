@icon("res://addons/effects_system/icons/cue.svg")
class_name FlashCue
extends EffectCue
## Briefly flashes the target, for hits and damage ticks.

@export var color: Color = Color.WHITE
@export_range(0.01, 2.0, 0.01, "suffix:s") var duration: float = 0.12


func _init() -> void:
	events = Event.APPLIED | Event.TICKED


func _fire(_event: EffectCue.Event, instance: EffectInstance) -> void:
	var visual := get_visual(instance)
	if visual != null:
		Fx.flash(visual, color, duration)
