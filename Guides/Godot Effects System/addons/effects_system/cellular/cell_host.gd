@icon("res://addons/effects_system/icons/host.svg")
class_name CellHost
extends Node3D
## Lets an entity catch, carry and spread living effects.
##
## Add it as a child of a character (next to its [EffectComponent]); its position
## is the entity's feet. Each simulation pass, mature cells inside the host's
## column ([member radius] by [member height]) infect it with their strain's
## [member Strain.infection_effect] and hand it some energy. While the infection
## lasts the host [b]carries[/b] that energy and [b]sheds[/b] cells where it walks,
## so a burning ghoul sets the grass alight. When the host dies or leaves the tree,
## what it carries returns to the field.

signal infected(strain: Strain)
signal carrying_changed

## The field to live in. Defaults to the first [CellField] in the scene.
@export var field: CellField
## The entity's effects. Defaults to the [EffectComponent] next to this node.
@export var component: EffectComponent
## Horizontal reach in metres.
@export_range(0.05, 10.0, 0.05, "or_greater", "suffix:m") var radius: float = 0.35
## Vertical reach in metres, from the feet up.
@export_range(0.05, 20.0, 0.05, "or_greater", "suffix:m") var height: float = 1.8
## Chance (0..1) to shrug off each infection, by strain id: [code]{&"ember": 0.5}[/code].
@export var resistances: Dictionary = {}
## Leave cells behind while carrying a strain.
@export var shed: bool = true
## When this stat runs out on the component (death), release what the host carries.
@export var death_stat: StringName = &"health"

## Energy carried per strain.
var carried: Dictionary = {}

var _cooldowns: Dictionary = {}
var _shed_timers: Dictionary = {}
var _registered: CellField


func _ready() -> void:
	if component == null:
		component = EffectComponent.find_on(get_parent())
	if component != null and not component.stat_depleted.is_connected(_on_stat_depleted):
		component.stat_depleted.connect(_on_stat_depleted)
	_register.call_deferred()


func _exit_tree() -> void:
	if is_instance_valid(_registered):
		_registered.remove_host(self)
	_registered = null


func _enter_tree() -> void:
	if is_node_ready():
		_register.call_deferred()


func get_component() -> EffectComponent:
	return component if is_instance_valid(component) else null


func get_field() -> CellField:
	return _registered


func get_resistance(strain: Strain) -> float:
	return clampf(float(resistances.get(strain.id, 0.0)), 0.0, 1.0)


## Energy carried for [param strain] (or all strains).
func get_carried(strain: Strain = null) -> float:
	if strain != null:
		return float(carried.get(strain, 0.0))
	var total := 0.0
	for each in carried:
		total += carried[each]
	return total


## Return everything carried to the field now.
func release() -> void:
	if is_instance_valid(_registered):
		_registered.release_host(self)


func _register() -> void:
	if not is_inside_tree() or is_instance_valid(_registered):
		return
	var target := field
	if target == null:
		target = get_tree().get_first_node_in_group(CellField.GROUP) as CellField
	if target != null:
		target.add_host(self)
		_registered = target


func _tick(dt: float) -> void:
	for strain in _cooldowns:
		_cooldowns[strain] -= dt


func _on_stat_depleted(stat: StringName) -> void:
	if stat == death_stat:
		release()
