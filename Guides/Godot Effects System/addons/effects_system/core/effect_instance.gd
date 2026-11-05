class_name EffectInstance
extends RefCounted
## One active copy of an [Effect] on an [EffectComponent].
##
## Instances are created by [method EffectComponent.apply_effect]; don't make them
## yourself. The resource is shared, so put per-target state in [member data].

enum RemovalReason {
	## Not removed yet.
	NONE,
	## The timer ran out.
	EXPIRED,
	## Removed by code ([method EffectComponent.remove_effect] and friends).
	REMOVED,
	## Removed by another effect's [member Effect.removes_tags].
	CLEANSED,
}

var effect: Effect
var component: EffectComponent
## Values passed to [method EffectComponent.apply_effect]. Re-applying merges in the
## new values. See [member StatModifier.value_key].
var params: Dictionary
## Multiplies every scaling modifier. Taken from [code]params.magnitude[/code], default 1.
var magnitude: float = 1.0
var stacks: int = 1
## Seconds left for TIMED effects. INF for PERMANENT ones.
var time_left: float = 0.0
## Seconds since the effect was first applied.
var elapsed: float = 0.0
## Number of ticks so far.
var tick_count: int = 0
var removal_reason: RemovalReason = RemovalReason.NONE
## Change in base value per stat from the most recent application or tick.
## [TextCue] uses this for damage numbers.
var last_changes: Dictionary = {}
## Free storage for scripted effects and cues.
var data: Dictionary = {}

var _source_ref: WeakRef
var _tick_timer: float = 0.0


func _init(p_effect: Effect, p_component: EffectComponent, p_source: Object, p_params: Dictionary) -> void:
	effect = p_effect
	component = p_component
	params = p_params.duplicate()
	magnitude = float(params.get(&"magnitude", 1.0))
	_source_ref = weakref(p_source) if p_source != null else null
	match effect.duration_type:
		Effect.DurationType.TIMED:
			time_left = effect.duration
		Effect.DurationType.PERMANENT:
			time_left = INF


## Whatever applied the effect, or null if it was freed or not given.
func get_source() -> Object:
	return _source_ref.get_ref() if _source_ref != null else null


## The node that owns the [EffectComponent] (the character, enemy, prop...).
func get_target() -> Node:
	return component.get_parent() if is_instance_valid(component) else null


func is_active() -> bool:
	return removal_reason == RemovalReason.NONE and is_instance_valid(component)


func is_permanent() -> bool:
	return effect.duration_type == Effect.DurationType.PERMANENT


## Total duration of the current timer.
func get_duration() -> float:
	return effect.duration if effect.duration_type == Effect.DurationType.TIMED else INF


## 1.0 when fresh, 0.0 when about to expire. Always 1.0 for permanent effects.
func get_remaining_ratio() -> float:
	if effect.duration_type != Effect.DurationType.TIMED or effect.duration <= 0.0:
		return 1.0
	return clampf(time_left / effect.duration, 0.0, 1.0)


## Restart the timer.
func refresh() -> void:
	if effect.duration_type == Effect.DurationType.TIMED:
		time_left = effect.duration


## Change the stack count, clamped to 1..max_stacks. Dropping below 1 removes the effect.
func set_stacks(count: int) -> void:
	if is_active():
		component.set_effect_stacks(self, count)


## Remove this instance from its component.
func remove() -> void:
	if is_active():
		component.remove_instance(self)
