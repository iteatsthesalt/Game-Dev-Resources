@icon("res://addons/effects_system/icons/cue.svg")
class_name ShakeCue
extends EffectCue
## Shakes the camera. Trauma accumulates, so rapid hits shake harder.

@export_range(0.0, 1.0, 0.01) var trauma: float = 0.3
## Multiply trauma by the stack count.
@export var scale_with_stacks: bool = false


func _fire(_event: EffectCue.Event, instance: EffectInstance) -> void:
	Fx.shake(trauma * (instance.stacks if scale_with_stacks else 1))
