extends Node2D
## Effects system demo. Click a button to apply an effect to the hero, or watch it
## walk through the lava, mud and healing spring zones. Every effect is a .tres in
## demo/effects/, so open them in the inspector to see how they're built.

const EFFECTS: Array[Effect] = [
	preload("res://demo/effects/poison.tres"),
	preload("res://demo/effects/burn.tres"),
	preload("res://demo/effects/wet.tres"),
	preload("res://demo/effects/shock.tres"),
	preload("res://demo/effects/frost.tres"),
	preload("res://demo/effects/stun.tres"),
	preload("res://demo/effects/haste.tres"),
	preload("res://demo/effects/regen.tres"),
	preload("res://demo/effects/fortify.tres"),
	preload("res://demo/effects/doom.tres"),
	preload("res://demo/effects/cleanse.tres"),
]
const HEAVY_HIT := preload("res://demo/effects/heavy_hit.tres")
const LOG_LINES := 9

@onready var hero: Node2D = $Hero
@onready var effects: EffectComponent = $Hero/EffectComponent
@onready var ui: CanvasLayer = $UI

var _stats_label: RichTextLabel
var _log_label: RichTextLabel
var _log: Array[String] = []


func _ready() -> void:
	_build_ui()
	effects.effect_applied.connect(func(instance: EffectInstance) -> void:
		_add_log("[color=#9fe0a0]+[/color] %s" % instance.effect.get_display_name()))
	effects.effect_reapplied.connect(func(instance: EffectInstance) -> void:
		_add_log("[color=#a0c8ff]↻[/color] %s (x%d)" % [instance.effect.get_display_name(), instance.stacks]))
	effects.effect_removed.connect(func(instance: EffectInstance) -> void:
		var reason: String = EffectInstance.RemovalReason.keys()[instance.removal_reason].to_lower()
		_add_log("[color=#ff9c8a]−[/color] %s [color=#888](%s)[/color]" % [instance.effect.get_display_name(), reason]))
	effects.effect_rejected.connect(func(effect: Effect, reason: String) -> void:
		_add_log("[color=#ffd36b]✕[/color] %s [color=#888](%s)[/color]" % [effect.get_display_name(), reason])
		Fx.popup_text(reason.replace("_", " ").capitalize() + "!", hero.global_position + Vector2(0, -120), Color(1, 0.85, 0.4)))
	effects.stat_changed.connect(func(_stat: StringName, _old: float, _new: float) -> void: _update_stats())
	effects.tags_changed.connect(_update_stats)
	_update_stats()


func _build_ui() -> void:
	var left := _panel(Vector2(16, 16), Vector2(250, 0))
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 6)
	left.add_child(column)
	column.add_child(_label("Effects System", 20))
	column.add_child(_label("Apply to the hero:", 13, Color(0.75, 0.75, 0.8)))
	var grid := GridContainer.new()
	grid.columns = 2
	grid.add_theme_constant_override("h_separation", 6)
	grid.add_theme_constant_override("v_separation", 6)
	column.add_child(grid)
	for effect in EFFECTS:
		grid.add_child(_effect_button(effect.get_display_name(), effect.description, effect.color,
			func() -> void: effects.apply_effect(effect, self)))
	grid.add_child(_effect_button("Heavy hit", "Instant damage with shake, hit-stop and flash. "
		+ "The amount comes from params: apply_effect(hit, self, {\"amount\": -18}).",
		Color(0.95, 0.95, 0.95), func() -> void: effects.apply_effect(HEAVY_HIT, self, {"amount": -18.0})))
	column.add_child(_effect_button("Clear all", "EffectComponent.clear_effects()", Color(0.6, 0.6, 0.65),
		func() -> void: effects.clear_effects()))
	column.add_child(_label("Try: Wet then Shock. Wet then Burn.\nFrost three times. Stun then Cleanse.",
		12, Color(0.65, 0.65, 0.7)))

	var right := _panel(Vector2(1152 - 16 - 290, 16), Vector2(290, 0))
	var info := VBoxContainer.new()
	info.add_theme_constant_override("separation", 8)
	right.add_child(info)
	_stats_label = _rich_label(Vector2(266, 140))
	info.add_child(_stats_label)
	info.add_child(HSeparator.new())
	_log_label = _rich_label(Vector2(266, 190))
	info.add_child(_log_label)

	var bar := EffectBar.new()
	bar.position = Vector2(-108, -200)
	bar.icon_size = Vector2(30, 30)
	hero.add_child(bar)
	bar.component = effects


func _update_stats() -> void:
	var tags := ", ".join(effects.get_tags().map(func(tag: StringName) -> String: return String(tag)))
	_stats_label.text = "[b]Hero[/b]\nHealth  [b]%d[/b] / %d\nSpeed   [b]%d[/b]  [color=#888](base %d)[/color]\nArmor   [b]%d[/b]\n\n[b]Tags[/b]\n%s" % [
		roundi(effects.get_stat(&"health")), roundi(effects.get_stat(&"max_health")),
		roundi(effects.get_stat(&"speed")), roundi(effects.get_base_stat(&"speed")),
		roundi(effects.get_stat(&"armor")), tags if tags != "" else "[color=#888]none[/color]"]


func _add_log(line: String) -> void:
	_log.push_front(line)
	_log.resize(mini(_log.size(), LOG_LINES))
	_log_label.text = "[b]Events[/b]\n" + "\n".join(_log)


func _panel(at: Vector2, min_size: Vector2) -> PanelContainer:
	var panel := PanelContainer.new()
	panel.position = at
	panel.custom_minimum_size = min_size
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.08, 0.08, 0.11, 0.88)
	style.set_corner_radius_all(8)
	style.set_content_margin_all(12)
	panel.add_theme_stylebox_override("panel", style)
	ui.add_child(panel)
	return panel


func _label(text: String, size: int, color: Color = Color.WHITE) -> Label:
	var label := Label.new()
	label.text = text
	label.add_theme_font_size_override("font_size", size)
	label.add_theme_color_override("font_color", color)
	return label


func _rich_label(min_size: Vector2) -> RichTextLabel:
	var label := RichTextLabel.new()
	label.bbcode_enabled = true
	label.fit_content = true
	label.scroll_active = false
	label.custom_minimum_size = min_size
	label.add_theme_font_size_override("normal_font_size", 13)
	label.add_theme_font_size_override("bold_font_size", 13)
	return label


func _effect_button(text: String, tooltip: String, accent: Color, pressed: Callable) -> Button:
	var button := Button.new()
	button.text = text
	button.tooltip_text = tooltip
	button.custom_minimum_size = Vector2(110, 30)
	button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	button.add_theme_font_size_override("font_size", 13)
	for state in ["normal", "hover", "pressed"]:
		var style := StyleBoxFlat.new()
		style.bg_color = accent.darkened(0.7 if state == "normal" else 0.55 if state == "hover" else 0.4)
		style.border_color = accent.darkened(0.15)
		style.border_width_left = 3
		style.set_corner_radius_all(4)
		style.set_content_margin_all(4)
		button.add_theme_stylebox_override(state, style)
	button.pressed.connect(pressed)
	return button
