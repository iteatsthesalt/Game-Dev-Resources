@icon("res://addons/effects_system/icons/cue.svg")
class_name TextCue
extends EffectCue
## Floating text above the target: status names, damage numbers, "Immune!".
##
## [member text] understands these placeholders:[br]
## [code]{name}[/code] the effect's display name,
## [code]{stacks}[/code] the stack count,
## [code]{amount}[/code] how much [member stat] just changed (rounded, no sign),
## [code]{signed}[/code] the same with a + or - sign.

@export var text: String = "{name}"
@export var color: Color = Color.WHITE
## The stat whose change fills [code]{amount}[/code] and [code]{signed}[/code].
@export var stat: StringName = &"health"
## Skip the popup when [code]{amount}[/code] would be 0 (for example, damage fully absorbed).
@export var hide_when_zero: bool = true
## Added to the target position. Only x and y are used in 2D.
@export var offset: Vector3 = Vector3(0, -32, 0)


func _fire(_event: EffectCue.Event, instance: EffectInstance) -> void:
	var change: float = instance.last_changes.get(stat, 0.0)
	var amount := roundi(absf(change))
	if hide_when_zero and amount == 0 and (text.contains("{amount}") or text.contains("{signed}")):
		return
	var message := text.format({
		"name": instance.effect.get_display_name(),
		"stacks": instance.stacks,
		"amount": amount,
		"signed": ("+%d" if change >= 0.0 else "-%d") % amount,
	})
	var position: Variant = get_position(instance)
	if position is Vector2:
		position += Vector2(offset.x, offset.y)
	elif position is Vector3:
		position += offset
	elif position == null:
		return
	Fx.popup_text(message, position, color)
