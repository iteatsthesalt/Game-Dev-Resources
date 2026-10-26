@icon("res://addons/effects_system/icons/effect.svg")
class_name Effect
extends Resource
## A data-driven gameplay effect: a buff, debuff, damage-over-time, heal, stun...
##
## Create one in the FileSystem dock ([b]New Resource > Effect[/b]), fill it in, and
## apply it with [method EffectComponent.apply_effect]. For behaviour the inspector
## can't express, extend this script and override the [code]_applied[/code],
## [code]_ticked[/code], [code]_reapplied[/code] and [code]_removed[/code] hooks.

enum DurationType {
	## Applies [member instant_changes] once and is never stored.
	INSTANT,
	## Lasts [member duration] seconds.
	TIMED,
	## Lasts until something removes it.
	PERMANENT,
}

enum StackMode {
	## Re-applying resets the timer.
	REFRESH,
	## Re-applying adds a stack (up to [member max_stacks]) and resets the timer.
	STACK,
	## Re-applying adds [member duration] to the remaining time,
	## up to [member max_stacks] x [member duration].
	EXTEND,
	## Every application is a separate instance with its own timer.
	INDEPENDENT,
	## Re-applying is rejected while the effect is active.
	IGNORE,
}

## Identifies the effect for stacking, lookups and removal. Defaults to the resource path.
@export var id: StringName
@export var display_name: String
@export_multiline var description: String
@export var icon: Texture2D
## Used by [EffectBar] when there is no icon, and handy for your own UI.
@export var color: Color = Color.WHITE
## Hide from [EffectBar] (for internal bookkeeping effects).
@export var hidden: bool = false

@export_group("Duration")
@export var duration_type: DurationType = DurationType.TIMED
@export_range(0.0, 600.0, 0.05, "or_greater", "suffix:s") var duration: float = 5.0
## Seconds between ticks of [member periodic_changes] and [code]Ticked[/code] cues. 0 disables ticking.
@export_range(0.0, 60.0, 0.05, "or_greater", "suffix:s") var period: float = 0.0
## Also tick once the moment the effect is applied.
@export var tick_on_apply: bool = false

@export_group("Stacking")
@export var stack_mode: StackMode = StackMode.REFRESH
@export_range(1, 999, 1, "or_greater") var max_stacks: int = 1
## Track stacks separately for each source, so two enemies' poisons don't share a counter.
@export var stack_per_source: bool = false
## When the timer runs out, drop one stack and restart instead of ending the effect.
@export var lose_one_stack_on_expiry: bool = false

@export_group("Stats")
## Applied to base values once, every time the effect lands (including re-applications).
@export var instant_changes: Array[StatModifier] = []
## Applied to base values every [member period] seconds.
@export var periodic_changes: Array[StatModifier] = []
## Active while the effect lasts; removed when it ends.
@export var modifiers: Array[StatModifier] = []

@export_group("Tags")
## Tags this effect gives its target while active. Dotted tags are hierarchical:
## a query for [code]debuff[/code] matches [code]debuff.poison[/code].
@export var tags: Array[StringName] = []
## The target must have every one of these tags.
@export var required_tags: Array[StringName] = []
## The target must have none of these tags.
@export var blocked_by_tags: Array[StringName] = []
## Active effects carrying any of these tags are removed when this one lands.
## Instances of this same effect are left to the stacking rules.
@export var removes_tags: Array[StringName] = []

@export_group("Cues")
## Visual and audio feedback. See the [EffectCue] subclasses.
@export var cues: Array[EffectCue] = []


## Key used to recognise "the same effect" for stacking and lookups.
func get_key() -> StringName:
	if id != &"":
		return id
	if resource_path != "":
		return StringName(resource_path)
	return StringName("effect_%d" % get_instance_id())


func get_display_name() -> String:
	if display_name != "":
		return display_name
	return String(get_key()).get_file().get_basename().capitalize()


func is_instant() -> bool:
	return duration_type == DurationType.INSTANT


func has_tag(tag: StringName) -> bool:
	for own in tags:
		if EffectTags.matches(own, tag):
			return true
	return false


# --- Hooks for scripted effects -------------------------------------------------

## Return false to reject the application. Runs after the tag checks.
func _can_apply(_component: EffectComponent, _params: Dictionary) -> bool:
	return true


## The effect landed for the first time (or every time, for INSTANT effects).
func _applied(_instance: EffectInstance) -> void:
	pass


## Called every [member period] seconds.
func _ticked(_instance: EffectInstance) -> void:
	pass


## Applied again while already active (refreshed, stacked or extended).
func _reapplied(_instance: EffectInstance, _previous_stacks: int) -> void:
	pass


## The effect ended. Check [member EffectInstance.removal_reason] to see why.
func _removed(_instance: EffectInstance) -> void:
	pass
