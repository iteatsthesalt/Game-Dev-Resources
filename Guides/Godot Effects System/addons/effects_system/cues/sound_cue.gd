@icon("res://addons/effects_system/icons/cue.svg")
class_name SoundCue
extends EffectCue
## Plays a one-shot sound.

@export var stream: AudioStream
@export_range(-40.0, 12.0, 0.1, "suffix:dB") var volume_db: float = 0.0
## Random pitch shift either way, so repeated sounds don't grate. 0.1 = ±10%.
@export_range(0.0, 0.5, 0.01) var pitch_variance: float = 0.05
## Play from the target's position (AudioStreamPlayer2D/3D) instead of globally.
@export var positional: bool = true
@export var bus: StringName = &"Master"


func _fire(_event: EffectCue.Event, instance: EffectInstance) -> void:
	var position: Variant = get_position(instance) if positional else null
	Fx.play_sound(stream, position, volume_db, pitch_variance, bus)
