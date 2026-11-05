@icon("res://addons/effects_system/icons/bar.svg")
class_name EffectBar
extends HBoxContainer
## A row of status icons for an [EffectComponent]: icon (or coloured initials),
## a darkening sweep as the timer runs down, the stack count and seconds left.
## Hover an icon for its name and description.

## The component to show. Can also be set from code with [method bind].
@export var component: EffectComponent:
	set(value):
		bind(value)
	get:
		return _component
@export var icon_size: Vector2 = Vector2(36, 36)
@export var show_timers: bool = true

var _component: EffectComponent
var _slots: Dictionary = {}


func _init() -> void:
	add_theme_constant_override("separation", 6)


func _ready() -> void:
	_rebuild()


## Show [param target]'s effects (pass null to clear).
func bind(target: EffectComponent) -> void:
	if target == _component:
		return
	if is_instance_valid(_component):
		_component.effect_applied.disconnect(_add_slot)
		_component.effect_removed.disconnect(_remove_slot)
	_component = target
	if is_instance_valid(_component):
		_component.effect_applied.connect(_add_slot)
		_component.effect_removed.connect(_remove_slot)
	if is_inside_tree():
		_rebuild()


func _process(_delta: float) -> void:
	for instance in _slots:
		_update_slot(instance, _slots[instance])


func _rebuild() -> void:
	for instance in _slots.keys():
		_remove_slot(instance)
	if is_instance_valid(_component):
		for instance in _component.get_effects():
			_add_slot(instance)


func _add_slot(instance: EffectInstance) -> void:
	if instance.effect.hidden or not instance.is_active() or _slots.has(instance):
		return
	var effect := instance.effect
	var slot := VBoxContainer.new()
	slot.add_theme_constant_override("separation", 2)
	slot.tooltip_text = effect.get_display_name()
	if effect.description != "":
		slot.tooltip_text += "\n" + effect.description

	var frame := Panel.new()
	frame.custom_minimum_size = icon_size
	frame.mouse_filter = Control.MOUSE_FILTER_PASS
	var style := StyleBoxFlat.new()
	style.bg_color = effect.color.darkened(0.55)
	style.border_color = effect.color
	style.set_border_width_all(2)
	style.set_corner_radius_all(4)
	frame.add_theme_stylebox_override("panel", style)
	slot.add_child(frame)

	if effect.icon != null:
		var icon := TextureRect.new()
		icon.texture = effect.icon
		icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		icon.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT, Control.PRESET_MODE_MINSIZE, 3)
		icon.mouse_filter = Control.MOUSE_FILTER_IGNORE
		frame.add_child(icon)
	else:
		var initials := Label.new()
		initials.text = effect.get_display_name().left(2)
		initials.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		initials.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		initials.add_theme_color_override("font_color", effect.color.lightened(0.4))
		initials.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		frame.add_child(initials)

	var sweep := ColorRect.new()
	sweep.name = "Sweep"
	sweep.color = Color(0, 0, 0, 0.55)
	sweep.mouse_filter = Control.MOUSE_FILTER_IGNORE
	sweep.anchor_right = 1.0
	frame.add_child(sweep)

	var stacks := Label.new()
	stacks.name = "Stacks"
	stacks.add_theme_font_size_override("font_size", 12)
	stacks.add_theme_constant_override("outline_size", 4)
	stacks.add_theme_color_override("font_outline_color", Color.BLACK)
	stacks.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_RIGHT)
	stacks.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	stacks.grow_vertical = Control.GROW_DIRECTION_BEGIN
	frame.add_child(stacks)
	# Hang the count off the corner so it doesn't cover the icon.
	stacks.position += Vector2(6, 7)

	var timer := Label.new()
	timer.name = "Timer"
	timer.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	timer.add_theme_font_size_override("font_size", 11)
	timer.visible = show_timers
	slot.add_child(timer)

	add_child(slot)
	_slots[instance] = slot
	_update_slot(instance, slot)


func _remove_slot(instance: EffectInstance) -> void:
	var slot = _slots.get(instance)
	_slots.erase(instance)
	if is_instance_valid(slot):
		slot.queue_free()


func _update_slot(instance: EffectInstance, slot: Control) -> void:
	var frame := slot.get_child(0) as Control
	var sweep := frame.get_node("Sweep") as ColorRect
	sweep.offset_bottom = frame.size.y * (1.0 - instance.get_remaining_ratio())
	(frame.get_node("Stacks") as Label).text = str(instance.stacks) if instance.stacks > 1 else ""
	var timer := slot.get_node("Timer") as Label
	if show_timers and not instance.is_permanent():
		timer.text = "%ds" % ceili(instance.time_left) if instance.time_left >= 1.0 else "%.1f" % instance.time_left
	else:
		timer.text = ""
