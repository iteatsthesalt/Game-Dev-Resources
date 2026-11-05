@icon("res://addons/effects_system/icons/modifier.svg")
class_name StatModifier
extends Resource
## One change to one stat.
##
## The same resource is used two ways by [Effect]:[br]
## - In [member Effect.modifiers] it is [b]temporary[/b]: it changes the computed
##   value while the effect is active and disappears when the effect ends.[br]
## - In [member Effect.instant_changes] and [member Effect.periodic_changes] it is
##   [b]permanent[/b]: it rewrites the stat's base value (damage, healing, mana cost).

enum Operation {
	## Adds [member value]. Use negative values to subtract.
	ADD,
	## Adds a percentage ([code]0.25[/code] = +25%).[br]
	## As a modifier, all percentages on a stat are summed, then applied once.[br]
	## As a change, the percentage is of the stat's limit (for example
	## [code]max_health[/code]) when it has one, otherwise of its current value.
	ADD_PERCENT,
	## Multiplies by [member value] ([code]0.5[/code] halves, [code]2.0[/code] doubles).
	MULTIPLY,
	## Replaces the value outright. The most recently applied override wins.
	OVERRIDE,
}

## Name of the stat to change, for example [code]&"speed"[/code] or [code]&"health"[/code].
@export var stat: StringName
@export var operation: Operation = Operation.ADD
@export var value: float = 0.0
## Multiply the effect of this modifier by the effect's stack count.
## ADD and ADD_PERCENT scale linearly; MULTIPLY compounds ([code]0.8[/code] at
## 2 stacks is [code]0.64[/code]); OVERRIDE never scales.
@export var scale_with_stacks: bool = true
## If set, and the code applying the effect passed this key in its [code]params[/code],
## that number is used instead of [member value]. Lets one effect resource carry
## weapon-specific damage, for example.
@export var value_key: StringName


static func create(p_stat: StringName, p_operation: Operation, p_value: float) -> StatModifier:
	var modifier := StatModifier.new()
	modifier.stat = p_stat
	modifier.operation = p_operation
	modifier.value = p_value
	return modifier


## The value after applying caller params, stacks and magnitude.
func resolve(instance: EffectInstance) -> float:
	var base := value
	if value_key != &"" and instance.params.has(value_key):
		base = float(instance.params[value_key])
	if operation == Operation.OVERRIDE:
		return base
	var scale := instance.magnitude
	if scale_with_stacks:
		scale *= instance.stacks
	if operation == Operation.MULTIPLY:
		return pow(base, scale)
	return base * scale
