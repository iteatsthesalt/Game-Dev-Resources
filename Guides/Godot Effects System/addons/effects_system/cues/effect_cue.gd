@icon("res://addons/effects_system/icons/cue.svg")
class_name EffectCue
extends Resource
## Feedback (visuals, sound, camera) played when an [Effect] changes state.
##
## Cues are shared between every instance of an effect, so keep per-target state in
## [method get_state]. To make your own, extend this class and override:[br]
## - [method _fire] for one-shot feedback on the events ticked in [member events];[br]
## - [method _start] and [method _stop] for feedback that lasts while the effect is active.

enum Event {
	APPLIED = 1,
	TICKED = 2,
	## Applied again while active (refreshed, stacked or extended).
	REAPPLIED = 4,
	REMOVED = 8,
}

## Which events trigger [method _fire].
@export_flags("Applied", "Ticked", "Reapplied", "Removed") var events: int = Event.APPLIED


## One-shot feedback. [param event] is one of the flags set in [member events].
## INSTANT effects only ever fire APPLIED.
func _fire(_event: Event, _instance: EffectInstance) -> void:
	pass


## The effect became active. Not called for INSTANT effects.
func _start(_instance: EffectInstance) -> void:
	pass


## The effect ended, or its target was freed. Must cope with [method _start] not
## having run and with nodes that were already freed.
func _stop(_instance: EffectInstance) -> void:
	pass


## Per-instance storage for this cue.
func get_state(instance: EffectInstance) -> Dictionary:
	if not instance.data.has(self):
		instance.data[self] = {}
	return instance.data[self]


## Where to play positional feedback: the target's position as a Vector2 or Vector3, or null.
func get_position(instance: EffectInstance) -> Variant:
	return instance.component.get_fx_position() if is_instance_valid(instance.component) else null


func get_visual(instance: EffectInstance) -> Node:
	return instance.component.get_visual_node() if is_instance_valid(instance.component) else null
