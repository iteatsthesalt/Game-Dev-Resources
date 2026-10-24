extends Effect
## Example of a scripted effect: when Doom runs out (rather than being cleansed),
## it deals a big hit. Shows how to extend Effect with the lifecycle hooks.

@export var damage: float = 40.0


func _removed(instance: EffectInstance) -> void:
	if instance.removal_reason != EffectInstance.RemovalReason.EXPIRED:
		return
	var component := instance.component
	var dealt := -component.modify_base_stat(&"health", -damage)
	var position: Variant = component.get_fx_position()
	if position != null:
		Fx.popup_text("DOOM %d" % roundi(dealt), position + Vector2(0, -60), Color(0.85, 0.4, 1.0))
	Fx.flash(component.get_visual_node(), Color(0.8, 0.3, 1.0), 0.25)
	Fx.shake(0.7)
	Fx.hitstop(0.12)
