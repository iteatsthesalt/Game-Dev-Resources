@icon("res://addons/effects_system/icons/component.svg")
class_name EffectComponent
extends Node
## Holds stats and active effects for one entity.
##
## Add it as a child of a character, enemy or prop, give it base stats, and apply
## [Effect] resources to it. Read stats back with [method get_stat] and status with
## [method has_tag]. Works for 2D, 3D and turn-based games (see [member update_mode]).

signal effect_applied(instance: EffectInstance)
## Applied again while active: refreshed, stacked or extended.
signal effect_reapplied(instance: EffectInstance)
signal effect_stacks_changed(instance: EffectInstance, previous: int)
signal effect_ticked(instance: EffectInstance)
## Check [member EffectInstance.removal_reason] for why.
signal effect_removed(instance: EffectInstance)
## Reasons: [code]"immune"[/code], [code]"blocked"[/code], [code]"missing_tags"[/code],
## [code]"already_active"[/code], [code]"rejected"[/code] (by [method Effect._can_apply]).
signal effect_rejected(effect: Effect, reason: String)
signal stat_changed(stat: StringName, previous: float, value: float)
## A limited stat (see [member stat_limits]) reached zero. Usually means death.
signal stat_depleted(stat: StringName)
signal tags_changed

enum UpdateMode {
	## Advance timers in [method Node._physics_process].
	PHYSICS,
	## Advance timers in [method Node._process].
	IDLE,
	## Only advance when you call [method advance], for turn-based games.
	MANUAL,
}

## Starting base value of each stat, for example
## [code]{&"health": 100.0, &"max_health": 100.0, &"speed": 200.0}[/code].
## Setting this resets every base value.
@export var base_stats: Dictionary = {}:
	set(value):
		base_stats = value
		_base.clear()
		for stat in value:
			_base[StringName(stat)] = float(value[stat])
		_refresh_stats(is_node_ready())
## Clamps a stat between 0 and a limit. The limit is another stat's name or a number:
## [code]{&"health": &"max_health", &"rage": 100.0}[/code].
@export var stat_limits: Dictionary = {}
## Effects carrying any of these tags can't be applied.
@export var immunities: Array[StringName] = []
## Applied in [method Node._ready].
@export var starting_effects: Array[Effect] = []
@export var update_mode: UpdateMode = UpdateMode.PHYSICS:
	set(value):
		update_mode = value
		if is_inside_tree():
			_update_processing()
## The node cues flash, tint and spawn particles on. Defaults to the parent.
@export var visual_node: NodePath

## Optional hook to adjust every base-value change made by an effect, for armor,
## shields or resistances. Called as [code]filter.call(stat, amount, instance)[/code]
## and must return the amount to apply.
var change_filter: Callable

var _base: Dictionary = {}
var _values: Dictionary = {}
var _instances: Array[EffectInstance] = []
var _tags_cache: Array[StringName] = []
var _depleted: Dictionary = {}

const _EPSILON := 0.00001


func _ready() -> void:
	_refresh_stats(false)
	for limited in stat_limits:
		_depleted[StringName(limited)] = get_stat(limited) <= 0.0
	for effect in starting_effects:
		if effect != null:
			apply_effect(effect, self)
	_update_processing()


func _physics_process(delta: float) -> void:
	advance(delta)


func _process(delta: float) -> void:
	advance(delta)


func _notification(what: int) -> void:
	# Clean up particles and tints left by persistent cues when the entity is freed.
	if what == NOTIFICATION_PREDELETE:
		for instance in _instances:
			_stop_cues(instance)


func _update_processing() -> void:
	set_physics_process(update_mode == UpdateMode.PHYSICS)
	set_process(update_mode == UpdateMode.IDLE)


# --- Applying and removing -------------------------------------------------------

## Apply [param effect]. [param source] is whoever caused it (used by
## [member Effect.stack_per_source] and [method remove_effects_from]). [param params]
## feeds [member StatModifier.value_key] and [code]magnitude[/code].
## Returns the instance, or null if the effect was rejected.
func apply_effect(effect: Effect, source: Object = null, params: Dictionary = {}) -> EffectInstance:
	if effect == null:
		push_error("EffectComponent.apply_effect: effect is null")
		return null
	var reason := get_rejection_reason(effect, source, params)
	if reason != "":
		effect_rejected.emit(effect, reason)
		return null

	if not effect.removes_tags.is_empty():
		_remove_matching(func(instance: EffectInstance) -> bool:
			if instance.effect.get_key() == effect.get_key():
				return false
			for tag in effect.removes_tags:
				if instance.effect.has_tag(tag):
					return true
			return false, EffectInstance.RemovalReason.CLEANSED)

	if effect.is_instant():
		var once := EffectInstance.new(effect, self, source, params)
		once.removal_reason = EffectInstance.RemovalReason.EXPIRED
		_apply_changes(once, effect.instant_changes)
		effect._applied(once)
		_fire_cues(once, EffectCue.Event.APPLIED)
		effect_applied.emit(once)
		return once

	var existing := _find_stack_target(effect, source)
	if existing != null:
		return _reapply(existing, params)

	var instance := EffectInstance.new(effect, self, source, params)
	_instances.append(instance)
	_rebuild_tags()
	_refresh_stats()
	# Modifiers are live before instant changes, so "+50 max health, heal 50" works.
	_apply_changes(instance, effect.instant_changes)
	if not instance.is_active():
		return instance
	effect._applied(instance)
	_start_cues(instance)
	_fire_cues(instance, EffectCue.Event.APPLIED)
	effect_applied.emit(instance)
	if instance.is_active() and effect.tick_on_apply and effect.period > 0.0:
		_tick(instance)
	return instance


## Why [param effect] can't be applied right now, or [code]""[/code] if it can.
func get_rejection_reason(effect: Effect, source: Object = null, params: Dictionary = {}) -> String:
	for tag in effect.tags:
		for immunity in immunities:
			if EffectTags.matches(tag, immunity):
				return "immune"
	for tag in effect.blocked_by_tags:
		if has_tag(tag):
			return "blocked"
	for tag in effect.required_tags:
		if not has_tag(tag):
			return "missing_tags"
	if effect.stack_mode == Effect.StackMode.IGNORE and not effect.is_instant():
		if _find_stack_target(effect, source) != null:
			return "already_active"
	if not effect._can_apply(self, params):
		return "rejected"
	return ""


func can_apply(effect: Effect, source: Object = null) -> bool:
	return get_rejection_reason(effect, source) == ""


## Remove an effect by resource or id. Returns how many instances were removed.
func remove_effect(effect_or_id: Variant) -> int:
	var key := _key_of(effect_or_id)
	return _remove_matching(func(instance: EffectInstance) -> bool:
		return instance.effect.get_key() == key, EffectInstance.RemovalReason.REMOVED)


## Remove every effect carrying [param tag] (or a child tag). Returns how many were removed.
func remove_effects_with_tag(tag: StringName) -> int:
	return _remove_matching(func(instance: EffectInstance) -> bool:
		return instance.effect.has_tag(tag), EffectInstance.RemovalReason.REMOVED)


## Remove every effect applied by [param source], optionally only those of one effect.
func remove_effects_from(source: Object, effect_or_id: Variant = null) -> int:
	var key := _key_of(effect_or_id) if effect_or_id != null else &""
	return _remove_matching(func(instance: EffectInstance) -> bool:
		return instance.get_source() == source and (key == &"" or instance.effect.get_key() == key),
		EffectInstance.RemovalReason.REMOVED)


func clear_effects() -> void:
	_remove_matching(func(_instance: EffectInstance) -> bool: return true,
		EffectInstance.RemovalReason.REMOVED)


func remove_instance(instance: EffectInstance,
		reason: EffectInstance.RemovalReason = EffectInstance.RemovalReason.REMOVED) -> void:
	if instance == null or not instance.is_active() or instance.component != self:
		return
	instance.removal_reason = reason
	_instances.erase(instance)
	_rebuild_tags()
	_refresh_stats()
	instance.effect._removed(instance)
	_fire_cues(instance, EffectCue.Event.REMOVED)
	_stop_cues(instance)
	effect_removed.emit(instance)


## Set the stack count of an active instance, clamped to its max. Below 1 removes it.
func set_effect_stacks(instance: EffectInstance, count: int) -> void:
	if not instance.is_active():
		return
	if count < 1:
		remove_instance(instance)
		return
	var previous := instance.stacks
	instance.stacks = mini(count, instance.effect.max_stacks)
	if instance.stacks != previous:
		_refresh_stats()
		effect_stacks_changed.emit(instance, previous)


# --- Queries ---------------------------------------------------------------------

func has_effect(effect_or_id: Variant) -> bool:
	return get_effect(effect_or_id) != null


## The first active instance of an effect, or null.
func get_effect(effect_or_id: Variant) -> EffectInstance:
	var key := _key_of(effect_or_id)
	for instance in _instances:
		if instance.effect.get_key() == key:
			return instance
	return null


## Total stacks of an effect across all its instances.
func get_stacks(effect_or_id: Variant) -> int:
	var key := _key_of(effect_or_id)
	var total := 0
	for instance in _instances:
		if instance.effect.get_key() == key:
			total += instance.stacks
	return total


## A copy of the active instances, oldest first.
func get_effects() -> Array[EffectInstance]:
	return _instances.duplicate()


## True if any active effect has [param tag] or a child of it.
func has_tag(tag: StringName) -> bool:
	return EffectTags.any_matches(_tags_cache, tag)


## Every tag granted by active effects (no duplicates).
func get_tags() -> Array[StringName]:
	return _tags_cache.duplicate()


# --- Stats -----------------------------------------------------------------------

## The current value of a stat: base value plus active modifiers, clamped by limits.
func get_stat(stat: StringName, default: float = 0.0) -> float:
	if _values.has(stat):
		return _values[stat]
	return default


func get_base_stat(stat: StringName, default: float = 0.0) -> float:
	return _base.get(stat, default)


func has_stat(stat: StringName) -> bool:
	return _base.has(stat) or _values.has(stat)


func set_base_stat(stat: StringName, value: float) -> void:
	_base[stat] = _clamp_to_limit(stat, value)
	_refresh_stats()


## Add to a base value (negative to subtract), for damage or healing from your own
## code. Goes through [member change_filter] unless [param filtered] is false.
## Returns the amount actually applied.
func modify_base_stat(stat: StringName, amount: float, filtered: bool = true) -> float:
	if filtered and change_filter.is_valid():
		amount = change_filter.call(stat, amount, null)
	var before: float = _base.get(stat, 0.0)
	_base[stat] = _clamp_to_limit(stat, before + amount)
	_refresh_stats()
	return _base[stat] - before


## Every stat name with a base value or an active modifier.
func get_stat_names() -> Array[StringName]:
	var names: Array[StringName] = []
	for stat in _base:
		names.append(stat)
	for stat in _values:
		if not _base.has(stat):
			names.append(stat)
	return names


# --- Time ------------------------------------------------------------------------

## Advance every effect's timer by [param delta] seconds. Called automatically
## unless [member update_mode] is MANUAL. In a turn-based game, call
## [code]advance(1.0)[/code] per turn and give effects durations in turns.
func advance(delta: float) -> void:
	if delta <= 0.0 or _instances.is_empty():
		return
	for instance in _instances.duplicate():
		_advance_instance(instance, delta)


func _advance_instance(instance: EffectInstance, delta: float) -> void:
	var effect := instance.effect
	var timed := effect.duration_type == Effect.DurationType.TIMED
	var remaining := delta
	while instance.is_active():
		var step := minf(remaining, maxf(instance.time_left, 0.0)) if timed else remaining
		remaining -= step
		instance.elapsed += step
		if effect.period > 0.0:
			instance._tick_timer += step
			while instance._tick_timer >= effect.period - _EPSILON and instance.is_active():
				instance._tick_timer -= effect.period
				_tick(instance)
		if not timed or not instance.is_active():
			return
		instance.time_left -= step
		if instance.time_left > _EPSILON:
			return
		if effect.lose_one_stack_on_expiry and instance.stacks > 1:
			instance.time_left += effect.duration
			set_effect_stacks(instance, instance.stacks - 1)
			if remaining <= 0.0 or effect.duration <= 0.0:
				return
		else:
			remove_instance(instance, EffectInstance.RemovalReason.EXPIRED)
			return


func _tick(instance: EffectInstance) -> void:
	instance.tick_count += 1
	instance.last_changes.clear()
	_apply_changes(instance, instance.effect.periodic_changes)
	if not instance.is_active():
		return
	instance.effect._ticked(instance)
	_fire_cues(instance, EffectCue.Event.TICKED)
	effect_ticked.emit(instance)


# --- Internals -------------------------------------------------------------------

func _reapply(instance: EffectInstance, params: Dictionary) -> EffectInstance:
	var effect := instance.effect
	var previous := instance.stacks
	instance.params.merge(params, true)
	instance.magnitude = float(instance.params.get(&"magnitude", 1.0))
	match effect.stack_mode:
		Effect.StackMode.REFRESH:
			instance.refresh()
		Effect.StackMode.STACK:
			instance.stacks = mini(instance.stacks + 1, effect.max_stacks)
			instance.refresh()
		Effect.StackMode.EXTEND:
			instance.time_left = minf(instance.time_left + effect.duration,
				effect.duration * effect.max_stacks)
	if instance.stacks != previous:
		_refresh_stats()
	instance.last_changes.clear()
	_apply_changes(instance, effect.instant_changes)
	if not instance.is_active():
		return instance
	effect._reapplied(instance, previous)
	_fire_cues(instance, EffectCue.Event.REAPPLIED)
	effect_reapplied.emit(instance)
	if instance.stacks != previous:
		effect_stacks_changed.emit(instance, previous)
	return instance


func _find_stack_target(effect: Effect, source: Object) -> EffectInstance:
	if effect.stack_mode == Effect.StackMode.INDEPENDENT:
		return null
	var key := effect.get_key()
	for instance in _instances:
		if instance.effect.get_key() != key:
			continue
		if effect.stack_per_source and instance.get_source() != source:
			continue
		return instance
	return null


func _remove_matching(predicate: Callable, reason: EffectInstance.RemovalReason) -> int:
	var count := 0
	for instance in _instances.duplicate():
		if instance.is_active() and predicate.call(instance):
			remove_instance(instance, reason)
			count += 1
	return count


func _apply_changes(instance: EffectInstance, changes: Array[StatModifier]) -> void:
	if changes.is_empty():
		return
	for change in changes:
		if change == null or change.stat == &"":
			continue
		var stat := change.stat
		var before: float = _base.get(stat, 0.0)
		var amount := change.resolve(instance)
		var target := before
		match change.operation:
			StatModifier.Operation.ADD:
				target = before + amount
			StatModifier.Operation.ADD_PERCENT:
				var limit := _get_limit(stat)
				target = before + amount * (limit if is_finite(limit) else before)
			StatModifier.Operation.MULTIPLY:
				target = before * amount
			StatModifier.Operation.OVERRIDE:
				target = amount
		var delta := target - before
		if change_filter.is_valid():
			delta = change_filter.call(stat, delta, instance)
		_base[stat] = _clamp_to_limit(stat, before + delta)
		instance.last_changes[stat] = instance.last_changes.get(stat, 0.0) + _base[stat] - before
	_refresh_stats()


func _compute(stat: StringName) -> float:
	var value: float = _base.get(stat, 0.0)
	var added := 0.0
	var percent := 0.0
	var multiplier := 1.0
	var has_override := false
	var override_value := 0.0
	for instance in _instances:
		for modifier in instance.effect.modifiers:
			if modifier == null or modifier.stat != stat:
				continue
			var amount := modifier.resolve(instance)
			match modifier.operation:
				StatModifier.Operation.ADD:
					added += amount
				StatModifier.Operation.ADD_PERCENT:
					percent += amount
				StatModifier.Operation.MULTIPLY:
					multiplier *= amount
				StatModifier.Operation.OVERRIDE:
					has_override = true
					override_value = amount
	if has_override:
		value = override_value
	else:
		value = (value + added) * (1.0 + percent) * multiplier
	return _clamp_to_limit(stat, value)


func _get_limit(stat: StringName) -> float:
	if not stat_limits.has(stat):
		return INF
	var limit: Variant = stat_limits[stat]
	if limit is String or limit is StringName:
		return _values.get(StringName(limit), _base.get(StringName(limit), INF))
	return float(limit)


func _clamp_to_limit(stat: StringName, value: float) -> float:
	if not stat_limits.has(stat):
		return value
	return clampf(value, 0.0, _get_limit(stat))


func _refresh_stats(emit: bool = true) -> void:
	var names := {}
	for stat in _base:
		names[stat] = true
	for stat in _values:
		names[stat] = true
	for instance in _instances:
		for modifier in instance.effect.modifiers:
			if modifier != null and modifier.stat != &"":
				names[modifier.stat] = true

	var previous := _values.duplicate()
	# Unlimited stats first, so limited ones clamp against up-to-date maximums.
	for stat in names:
		if not stat_limits.has(stat):
			_values[stat] = _compute(stat)
	for stat in names:
		if stat_limits.has(stat):
			if _base.has(stat):
				_base[stat] = _clamp_to_limit(stat, _base[stat])
			_values[stat] = _compute(stat)
	if not emit:
		return

	# Emit after the state is settled, in case a listener changes it again.
	var changed: Array = []
	var depleted: Array[StringName] = []
	for stat in _values:
		var old: float = previous.get(stat, 0.0)
		if not is_equal_approx(old, _values[stat]):
			changed.append([stat, old, _values[stat]])
		if stat_limits.has(stat):
			var empty: bool = _values[stat] <= 0.0
			if empty and not _depleted.get(stat, false):
				depleted.append(stat)
			_depleted[stat] = empty
	for entry in changed:
		stat_changed.emit(entry[0], entry[1], entry[2])
	for stat in depleted:
		stat_depleted.emit(stat)


func _rebuild_tags() -> void:
	var tags: Array[StringName] = []
	for instance in _instances:
		for tag in instance.effect.tags:
			if not tags.has(tag):
				tags.append(tag)
	if tags != _tags_cache:
		_tags_cache = tags
		tags_changed.emit()


func _key_of(effect_or_id: Variant) -> StringName:
	if effect_or_id is Effect:
		return effect_or_id.get_key()
	return StringName(effect_or_id)


func _fire_cues(instance: EffectInstance, event: EffectCue.Event) -> void:
	for cue in instance.effect.cues:
		if cue != null and cue.events & event:
			cue._fire(event, instance)


func _start_cues(instance: EffectInstance) -> void:
	for cue in instance.effect.cues:
		if cue != null:
			cue._start(instance)


func _stop_cues(instance: EffectInstance) -> void:
	for cue in instance.effect.cues:
		if cue != null:
			cue._stop(instance)


# --- Visual helpers for cues -----------------------------------------------------

## The node cues should decorate: [member visual_node], or the parent.
func get_visual_node() -> Node:
	if not visual_node.is_empty():
		var node := get_node_or_null(visual_node)
		if node != null:
			return node
	return get_parent()


## Global position of the visual node as a Vector2 or Vector3, or null.
func get_fx_position() -> Variant:
	var node := get_visual_node()
	if node is Node2D or node is Control:
		return node.global_position
	if node is Node3D:
		return node.global_position
	return null


## Find the EffectComponent for [param node]: the node itself, one of its children,
## or a child of its parent (for hurtbox areas). Handy in hitboxes:
## [code]EffectComponent.find_on(body)[/code].
static func find_on(node: Node) -> EffectComponent:
	var candidate := node
	for _level in 2:
		if candidate == null:
			return null
		if candidate is EffectComponent:
			return candidate
		for child in candidate.get_children():
			if child is EffectComponent:
				return child
		candidate = candidate.get_parent()
	return null
