extends Control
## The demo's HUD: abilities, the living colonies and their verdicts, the energy
## ledger, an event log, and the hero's health and status effects.

const MAX_COLONIES := 8
const MAX_LOG := 8
const MARGIN := 14.0

var demo: Node
var _colonies: RichTextLabel
var _ledger: RichTextLabel
var _log: RichTextLabel
var _health: ProgressBar
var _health_label: Label
var _lines: Array[String] = []
var _refresh := 0.0


func setup(owner_demo: Node) -> void:
	demo = owner_demo
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_build()
	demo.event_logged.connect(_on_event)
	_on_event("The caldera is alive. Press 1-6 to cast, Tab for autopilot.", Color("#d8d0c8"))


func _process(delta: float) -> void:
	_refresh -= delta
	if _refresh > 0.0 or demo == null:
		return
	_refresh = 0.25
	_update_colonies()
	_update_ledger()
	var effects: EffectComponent = demo.hero.effects
	_health.max_value = effects.get_stat(&"max_health")
	_health.value = effects.get_stat(&"health")
	_health_label.text = "%d / %d" % [roundi(_health.value), roundi(_health.max_value)]


func _build() -> void:
	var left := _panel(false, false, 270.0)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 4)
	left.add_child(column)
	column.add_child(_label("Cinderdeep · Living Effects", 18, Color("#ffd08a")))
	column.add_child(_label("WASD move · Q/E turn · wheel zoom · Tab autopilot", 11, Color("#a8a0a0")))
	for ability in demo.ABILITIES:
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 8)
		var key := _label(ability.key, 13, Color("#120a0e"))
		key.custom_minimum_size = Vector2(20, 20)
		key.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		var chip := StyleBoxFlat.new()
		chip.bg_color = ability.color
		chip.set_corner_radius_all(4)
		key.add_theme_stylebox_override("normal", chip)
		row.add_child(key)
		row.add_child(_label("%s  " % ability.name, 13, ability.color))
		var hint := _label(ability.text, 11, Color("#a8a0a0"))
		row.add_child(hint)
		column.add_child(row)

	var right := _panel(true, false, 330.0)
	_colonies = _rich(Vector2(306, 210))
	right.add_child(_colonies)

	var bottom_right := _panel(true, true, 330.0)
	_ledger = _rich(Vector2(306, 96))
	bottom_right.add_child(_ledger)

	var bottom_left := _panel(false, true, 400.0)
	_log = _rich(Vector2(376, 150))
	bottom_left.add_child(_log)

	var status := VBoxContainer.new()
	status.custom_minimum_size = Vector2(300, 0)
	status.add_theme_constant_override("separation", 4)
	_pin(status, 0.5, 1.0, 0.0, -18.0)
	add_child(status)
	var bar := EffectBar.new()
	bar.icon_size = Vector2(30, 30)
	bar.alignment = BoxContainer.ALIGNMENT_CENTER
	status.add_child(bar)
	bar.component = demo.hero.effects
	var health_box := Control.new()
	health_box.custom_minimum_size = Vector2(300, 18)
	status.add_child(health_box)
	_health = ProgressBar.new()
	_health.show_percentage = false
	_health.set_anchors_preset(Control.PRESET_FULL_RECT)
	var fill := StyleBoxFlat.new()
	fill.bg_color = Color("#c4401c")
	fill.set_corner_radius_all(3)
	var back := StyleBoxFlat.new()
	back.bg_color = Color(0.05, 0.03, 0.04, 0.85)
	back.set_corner_radius_all(3)
	_health.add_theme_stylebox_override("fill", fill)
	_health.add_theme_stylebox_override("background", back)
	health_box.add_child(_health)
	_health_label = _label("", 11, Color("#f1e5cd"))
	_health_label.set_anchors_preset(Control.PRESET_FULL_RECT)
	_health_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_health_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	health_box.add_child(_health_label)


func _update_colonies() -> void:
	var field: CellField = demo.field
	var colonies := field.get_colonies()
	colonies.sort_custom(func(a: CellColony, b: CellColony) -> bool: return a.size() > b.size())
	var text := "[b]Living colonies[/b]  [color=#888]%d cells[/color]\n" % field.get_cell_count()
	for i in mini(colonies.size(), MAX_COLONIES):
		var colony: CellColony = colonies[i]
		var strain := colony.strain
		var root := ""
		if colony.has_root:
			root = " [color=#f0c0ff]♥ root[/color]" if colony.root_alive else " [color=#ff8a7a]severed[/color]"
		text += "[color=#%s]■[/color] %s  [b]%d[/b] [color=#888]cells · %d energy ·[/color] %s%s\n" % [
			strain.hot_color.to_html(false), strain.get_display_name(), colony.size(),
			roundi(field.get_colony_energy(colony)), _verdict(colony.verdict), root]
	if colonies.size() > MAX_COLONIES:
		text += "[color=#888]+ %d smaller colonies[/color]" % (colonies.size() - MAX_COLONIES)
	_colonies.text = text


func _verdict(verdict: StringName) -> String:
	var colors := {&"growing": "#9fe0a0", &"stable": "#c8c0b8", &"declining": "#e0b070", &"severed": "#ff8a7a",
		&"evolved": "#ffd08a", &"senescent": "#a090a0"}
	return "[color=%s]%s[/color]" % [colors.get(verdict, "#c8c0b8"), String(verdict)]


func _update_ledger() -> void:
	var l: Dictionary = demo.field.get_ledger()
	var ok: bool = absf(l.balance) < 0.01 * maxf(1.0, l.seeded + l.fed + l.generated)
	_ledger.text = ("[b]Energy ledger[/b]  %s\n[color=#9fe0a0]in[/color]  fed %d · seeded %d · roots %d\n"
		+ "[color=#e0b070]out[/color]  metabolism %d · necrosis %d · hosts %d\n"
		+ "alive [b]%d[/b] · carried by hosts [b]%d[/b] · balance %.3f") % [
		"[color=#9fe0a0]conserved ✓[/color]" if ok else "[color=#ff6a5a]out of balance[/color]",
		roundi(l.fed), roundi(l.seeded), roundi(l.generated), roundi(l.metabolized), roundi(l.lost),
		roundi(l.host_dissipated), roundi(l.alive), roundi(l.carried), l.balance]


func _on_event(text: String, color: Color) -> void:
	_lines.push_front("[color=#%s]%s[/color]" % [color.to_html(false), text])
	_lines.resize(mini(_lines.size(), MAX_LOG))
	_log.text = "[b]World events[/b]\n" + "\n".join(_lines)


## A panel pinned to a corner of the screen, growing inward as its content grows.
func _panel(right: bool, bottom: bool, width: float) -> PanelContainer:
	var panel := PanelContainer.new()
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.047, 0.027, 0.039, 0.82)
	style.border_color = Color("#3a2a24")
	style.set_border_width_all(1)
	style.set_corner_radius_all(6)
	style.set_content_margin_all(12)
	panel.add_theme_stylebox_override("panel", style)
	panel.custom_minimum_size = Vector2(width, 0)
	_pin(panel, 1.0 if right else 0.0, 1.0 if bottom else 0.0, -MARGIN if right else MARGIN, -MARGIN if bottom else MARGIN)
	add_child(panel)
	return panel


func _pin(control: Control, anchor_x: float, anchor_y: float, x: float, y: float) -> void:
	control.anchor_left = anchor_x
	control.anchor_right = anchor_x
	control.anchor_top = anchor_y
	control.anchor_bottom = anchor_y
	control.offset_left = x
	control.offset_right = x
	control.offset_top = y
	control.offset_bottom = y
	control.grow_horizontal = Control.GROW_DIRECTION_BOTH if anchor_x == 0.5 \
		else Control.GROW_DIRECTION_BEGIN if anchor_x == 1.0 else Control.GROW_DIRECTION_END
	control.grow_vertical = Control.GROW_DIRECTION_BEGIN if anchor_y == 1.0 else Control.GROW_DIRECTION_END


func _label(text: String, size: int, color: Color) -> Label:
	var label := Label.new()
	label.text = text
	label.add_theme_font_size_override("font_size", size)
	label.add_theme_color_override("font_color", color)
	return label


func _rich(min_size: Vector2) -> RichTextLabel:
	var label := RichTextLabel.new()
	label.bbcode_enabled = true
	label.fit_content = true
	label.scroll_active = false
	label.custom_minimum_size = min_size
	label.add_theme_font_size_override("normal_font_size", 12)
	label.add_theme_font_size_override("bold_font_size", 13)
	label.add_theme_color_override("default_color", Color("#d8d0c8"))
	return label
