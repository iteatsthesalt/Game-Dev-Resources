@icon("res://addons/effects_system/icons/cue.svg")
class_name HitstopCue
extends EffectCue
## Freezes the game for a moment to sell a heavy hit.

@export_range(0.0, 1.0, 0.005, "suffix:s") var duration: float = 0.06
## 0 freezes completely; 0.1 is a heavy slow-down.
@export_range(0.0, 1.0, 0.01) var time_scale: float = 0.0


func _fire(_event: EffectCue.Event, _instance: EffectInstance) -> void:
	Fx.hitstop(duration, time_scale)
