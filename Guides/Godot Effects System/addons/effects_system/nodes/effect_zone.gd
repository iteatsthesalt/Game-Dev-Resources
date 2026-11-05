@icon("res://addons/effects_system/icons/zone.svg")
class_name EffectZone
extends Node
## Applies effects to anything with an [EffectComponent] that enters the parent
## [Area2D] or [Area3D]: poison clouds, healing springs, lava, slowing mud.

signal component_entered(component: EffectComponent)
signal component_exited(component: EffectComponent)

@export var effects: Array[Effect] = []
## Apply again every this many seconds while inside (lava, healing springs).
## 0 applies only on entry.
@export_range(0.0, 60.0, 0.05, "or_greater", "suffix:s") var reapply_interval: float = 0.0
## Remove the effects this zone applied when the target leaves (auras, slowing mud).
@export var remove_on_exit: bool = false
## Also react to areas (hurtboxes), not just physics bodies.
@export var detect_areas: bool = false
## Passed to [method EffectComponent.apply_effect]; see [member StatModifier.value_key].
@export var params: Dictionary = {}
@export var enabled: bool = true

var _timers: Dictionary = {}
var _overlaps: Dictionary = {}


func _ready() -> void:
	var area := get_parent()
	if not (area is Area2D or area is Area3D):
		push_warning("EffectZone '%s' must be a child of an Area2D or Area3D." % name)
		set_physics_process(false)
		return
	area.body_entered.connect(_on_entered)
	area.body_exited.connect(_on_exited)
	if detect_areas:
		area.area_entered.connect(_on_entered)
		area.area_exited.connect(_on_exited)


func _physics_process(delta: float) -> void:
	if not enabled or reapply_interval <= 0.0:
		return
	for component in _timers.keys():
		if not is_instance_valid(component):
			_timers.erase(component)
			_overlaps.erase(component)
			continue
		_timers[component] -= delta
		if _timers[component] <= 0.0:
			_timers[component] += reapply_interval
			_apply(component)


## Components currently inside the zone.
func get_components() -> Array[EffectComponent]:
	var inside: Array[EffectComponent] = []
	for component in _timers:
		if is_instance_valid(component):
			inside.append(component)
	return inside


func _on_entered(node: Node) -> void:
	var component := EffectComponent.find_on(node)
	if component == null:
		return
	# A body and its hurtbox can both overlap; count them so the first exit doesn't count.
	_overlaps[component] = _overlaps.get(component, 0) + 1
	if _overlaps[component] > 1:
		return
	_timers[component] = reapply_interval
	if enabled:
		_apply(component)
	component_entered.emit(component)


func _on_exited(node: Node) -> void:
	var component := EffectComponent.find_on(node)
	if component == null or not _overlaps.has(component):
		return
	_overlaps[component] -= 1
	if _overlaps[component] > 0:
		return
	_overlaps.erase(component)
	_timers.erase(component)
	if remove_on_exit:
		for effect in effects:
			if effect != null:
				component.remove_effects_from(self, effect)
	component_exited.emit(component)


func _apply(component: EffectComponent) -> void:
	for effect in effects:
		if effect != null:
			component.apply_effect(effect, self, params)
