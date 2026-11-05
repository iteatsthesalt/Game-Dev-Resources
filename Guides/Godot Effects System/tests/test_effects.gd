extends "res://tests/test_suite.gd"
## Tests for status effects, cues, Fx and the helper nodes.


func poison(damage: float = 4.0) -> Effect:
	return make_effect({
		id = &"poison", duration = 5.0, period = 1.0, tags = tags([&"debuff.poison"]),
		periodic_changes = mods([mod(&"health", StatModifier.Operation.ADD, -damage)]),
	})


class CountingCue extends EffectCue:
	var fired := {}
	var started := 0
	var stopped := 0

	func _init() -> void:
		events = Event.APPLIED | Event.TICKED | Event.REAPPLIED | Event.REMOVED

	func _fire(event: EffectCue.Event, _instance: EffectInstance) -> void:
		fired[event] = fired.get(event, 0) + 1

	func _start(_instance: EffectInstance) -> void:
		started += 1

	func _stop(_instance: EffectInstance) -> void:
		stopped += 1


class HookEffect extends Effect:
	var log: Array[String] = []

	func _can_apply(component: EffectComponent, _params: Dictionary) -> bool:
		return component.get_stat(&"health") > 10.0

	func _applied(_instance: EffectInstance) -> void:
		log.append("applied")

	func _ticked(_instance: EffectInstance) -> void:
		log.append("ticked")

	func _reapplied(_instance: EffectInstance, previous: int) -> void:
		log.append("reapplied:%d" % previous)

	func _removed(instance: EffectInstance) -> void:
		log.append("removed:%d" % instance.removal_reason)


# --- Stats -----------------------------------------------------------------------

func test_modifier_formula() -> void:
	var component := make_component()
	var changes: Array = []
	component.stat_changed.connect(func(stat: StringName, old: float, value: float) -> void:
		changes.append([stat, old, value]))
	var effect := make_effect({
		duration_type = Effect.DurationType.PERMANENT,
		modifiers = mods([
			mod(&"speed", StatModifier.Operation.ADD, 20.0),
			mod(&"speed", StatModifier.Operation.ADD_PERCENT, 0.5),
			mod(&"speed", StatModifier.Operation.MULTIPLY, 0.5),
		]),
	})
	component.apply_effect(effect)
	check_eq(component.get_stat(&"speed"), 90.0, "(100 + 20) * 1.5 * 0.5")
	check_eq(component.get_base_stat(&"speed"), 100.0, "base untouched")
	check_eq(changes.size(), 1, "one stat_changed signal")
	component.remove_effect(effect)
	check_eq(component.get_stat(&"speed"), 100.0, "back to base after removal")
	check_eq(changes.size(), 2, "signal on removal")


func test_override_wins() -> void:
	var component := make_component()
	component.apply_effect(make_effect({modifiers = mods([mod(&"speed", StatModifier.Operation.ADD, 50.0)])}))
	var root := component.apply_effect(make_effect({
		id = &"root", modifiers = mods([mod(&"speed", StatModifier.Operation.OVERRIDE, 0.0)])}))
	check_eq(component.get_stat(&"speed"), 0.0, "override beats other modifiers")
	root.remove()
	check_eq(component.get_stat(&"speed"), 150.0, "other modifiers return")


func test_unknown_stat_uses_default() -> void:
	var component := make_component()
	check_eq(component.get_stat(&"mana", 7.0), 7.0, "default for unknown stat")
	check(not component.has_stat(&"mana"), "has_stat false")
	component.apply_effect(make_effect({modifiers = mods([mod(&"mana", StatModifier.Operation.ADD, 5.0)])}))
	check_eq(component.get_stat(&"mana"), 5.0, "modifier-only stat")


func test_instant_changes_and_limits() -> void:
	var component := make_component()
	var depleted: Array = []
	component.stat_depleted.connect(func(stat: StringName) -> void: depleted.append(stat))
	var hit := make_effect({duration_type = Effect.DurationType.INSTANT,
		instant_changes = mods([mod(&"health", StatModifier.Operation.ADD, -30.0)])})
	var instance := component.apply_effect(hit)
	check(instance != null and not instance.is_active(), "instant effects return an inactive instance")
	check_eq(component.get_stat(&"health"), 70.0, "damage applied")
	check(component.get_effects().is_empty(), "instant effects are not stored")
	component.apply_effect(make_effect({duration_type = Effect.DurationType.INSTANT,
		instant_changes = mods([mod(&"health", StatModifier.Operation.ADD, 50.0)])}))
	check_eq(component.get_stat(&"health"), 100.0, "healing clamps to max_health")
	component.apply_effect(make_effect({duration_type = Effect.DurationType.INSTANT,
		instant_changes = mods([mod(&"health", StatModifier.Operation.ADD_PERCENT, -0.1)])}))
	check_eq(component.get_stat(&"health"), 90.0, "ADD_PERCENT change uses the limit")
	for i in 5:
		component.apply_effect(hit)
	check_eq(component.get_stat(&"health"), 0.0, "clamped at zero")
	check_eq(depleted, [&"health"], "depleted fires once")
	component.modify_base_stat(&"health", 10.0)
	component.modify_base_stat(&"health", -10.0)
	check_eq(depleted.size(), 2, "depleted fires again after recovering")


func test_max_health_buff_then_heal() -> void:
	var component := make_component()
	var fortify := make_effect({
		duration = 3.0,
		modifiers = mods([mod(&"max_health", StatModifier.Operation.ADD, 50.0)]),
		instant_changes = mods([mod(&"health", StatModifier.Operation.ADD, 50.0)]),
	})
	component.apply_effect(fortify)
	check_eq(component.get_stat(&"max_health"), 150.0, "max raised")
	check_eq(component.get_stat(&"health"), 150.0, "heal uses the raised max")
	component.advance(3.0)
	check_eq(component.get_stat(&"max_health"), 100.0, "max restored")
	check_eq(component.get_stat(&"health"), 100.0, "health clamped to restored max")


func test_change_filter() -> void:
	var component := make_component()
	component.change_filter = func(stat: StringName, amount: float, _instance: EffectInstance) -> float:
		return amount * 0.5 if stat == &"health" and amount < 0.0 else amount
	component.apply_effect(poison(10.0))
	component.advance(1.0)
	check_eq(component.get_stat(&"health"), 95.0, "damage halved")
	check_eq(component.get_effect(&"poison").last_changes[&"health"], -5.0, "last_changes is post-filter")
	check_eq(component.modify_base_stat(&"health", -10.0), -5.0, "modify_base_stat is filtered")
	check_eq(component.modify_base_stat(&"health", -10.0, false), -10.0, "unless asked not to")


func test_value_key_and_magnitude() -> void:
	var component := make_component()
	var hit_modifier := mod(&"health", StatModifier.Operation.ADD, -1.0)
	hit_modifier.value_key = &"amount"
	var hit := make_effect({duration_type = Effect.DurationType.INSTANT, instant_changes = mods([hit_modifier])})
	component.apply_effect(hit, null, {"amount": -25.0})
	check_eq(component.get_stat(&"health"), 75.0, "caller value used")
	component.apply_effect(hit)
	check_eq(component.get_stat(&"health"), 74.0, "falls back to value")
	var strong := poison(4.0)
	component.apply_effect(strong, null, {&"magnitude": 2.0})
	component.advance(1.0)
	check_eq(component.get_stat(&"health"), 66.0, "magnitude doubles damage")
	component.apply_effect(strong, null, {"magnitude": 0.5})
	component.advance(1.0)
	check_eq(component.get_stat(&"health"), 64.0, "re-applying updates magnitude")


# --- Time ------------------------------------------------------------------------

func test_timed_expiry() -> void:
	var component := make_component()
	var removed: Array = []
	component.effect_removed.connect(func(instance: EffectInstance) -> void: removed.append(instance))
	var instance := component.apply_effect(make_effect({duration = 2.0}))
	component.advance(1.0)
	check(instance.is_active(), "active at 1s")
	check_eq(instance.time_left, 1.0, "time_left")
	check_eq(instance.get_remaining_ratio(), 0.5, "remaining ratio")
	component.advance(1.0)
	check(not instance.is_active(), "expired at 2s")
	check_eq(instance.removal_reason, EffectInstance.RemovalReason.EXPIRED, "reason")
	check_eq(removed.size(), 1, "effect_removed emitted")


func test_periodic_ticks_frame_by_frame() -> void:
	var component := make_component()
	component.apply_effect(poison())
	for frame in 6 * 60:
		component.advance(1.0 / 60.0)
	check_eq(component.get_stat(&"health"), 80.0, "five ticks over five seconds")
	check(not component.has_effect(&"poison"), "expired")


func test_tick_on_apply() -> void:
	var component := make_component()
	var effect := poison()
	effect.tick_on_apply = true
	component.apply_effect(effect)
	check_eq(component.get_stat(&"health"), 96.0, "ticked immediately")
	component.advance(10.0)
	check_eq(component.get_stat(&"health"), 76.0, "six ticks in total")


func test_large_delta_does_not_overtick() -> void:
	var component := make_component()
	component.apply_effect(poison())
	component.advance(100.0)
	check_eq(component.get_stat(&"health"), 80.0, "still only five ticks")


func test_permanent_effect_ticks_forever() -> void:
	var component := make_component({&"health": 10.0, &"max_health": 100.0})
	var regen := make_effect({duration_type = Effect.DurationType.PERMANENT, period = 0.5,
		periodic_changes = mods([mod(&"health", StatModifier.Operation.ADD, 1.0)])})
	var instance := component.apply_effect(regen)
	component.advance(10.0)
	check_eq(component.get_stat(&"health"), 30.0, "20 ticks")
	check(instance.is_active(), "still active")
	check(instance.is_permanent() and instance.time_left == INF, "permanent")


func test_manual_mode_ignores_frames() -> void:
	var component := make_component()
	component.apply_effect(make_effect({duration = 0.05}))
	await tree.physics_frame
	await tree.physics_frame
	await tree.process_frame
	check(component.get_effects().size() == 1, "not advanced by frames in MANUAL mode")
	component.update_mode = EffectComponent.UpdateMode.PHYSICS
	await wait_seconds(0.2)
	check(component.get_effects().is_empty(), "advanced by physics frames")


# --- Stacking --------------------------------------------------------------------

func test_refresh() -> void:
	var component := make_component()
	var effect := make_effect({duration = 5.0})
	var instance := component.apply_effect(effect)
	component.advance(3.0)
	check(component.apply_effect(effect) == instance, "same instance")
	check_eq(instance.time_left, 5.0, "timer reset")
	check_eq(instance.stacks, 1, "no stacks added")


func test_stack() -> void:
	var component := make_component({&"speed": 100.0, &"armor": 0.0}, {})
	var stack_changes: Array = []
	component.effect_stacks_changed.connect(func(instance: EffectInstance, previous: int) -> void:
		stack_changes.append([previous, instance.stacks]))
	var sunder := make_effect({stack_mode = Effect.StackMode.STACK, max_stacks = 3, modifiers = mods([
		mod(&"armor", StatModifier.Operation.ADD, -10.0),
		mod(&"speed", StatModifier.Operation.MULTIPLY, 0.8),
	])})
	for i in 4:
		component.apply_effect(sunder)
	check_eq(component.get_stacks(sunder), 3, "capped at max_stacks")
	check_eq(component.get_stat(&"armor"), -30.0, "ADD scales linearly")
	check_eq(component.get_stat(&"speed"), 51.2, "MULTIPLY compounds")
	check_eq(stack_changes, [[1, 2], [2, 3]], "stack signals")
	component.get_effect(sunder).set_stacks(1)
	check_eq(component.get_stat(&"armor"), -10.0, "set_stacks")
	component.get_effect(sunder).set_stacks(0)
	check(not component.has_effect(sunder), "zero stacks removes")


func test_extend() -> void:
	var component := make_component()
	var effect := make_effect({duration = 2.0, stack_mode = Effect.StackMode.EXTEND, max_stacks = 3})
	for i in 4:
		component.apply_effect(effect)
	check_eq(component.get_effect(effect).time_left, 6.0, "capped at duration * max_stacks")


func test_independent() -> void:
	var component := make_component()
	var effect := make_effect({duration = 2.0, stack_mode = Effect.StackMode.INDEPENDENT})
	component.apply_effect(effect)
	component.advance(1.0)
	component.apply_effect(effect)
	check_eq(component.get_effects().size(), 2, "two instances")
	check_eq(component.get_stacks(effect), 2, "get_stacks sums instances")
	component.advance(1.0)
	check_eq(component.get_effects().size(), 1, "first one expired on its own")


func test_ignore() -> void:
	var component := make_component()
	var rejected: Array = []
	component.effect_rejected.connect(func(_effect: Effect, reason: String) -> void: rejected.append(reason))
	var effect := make_effect({stack_mode = Effect.StackMode.IGNORE})
	check(component.apply_effect(effect) != null, "first application")
	check(component.apply_effect(effect) == null, "second rejected")
	check_eq(rejected, ["already_active"], "reason")


func test_stack_per_source() -> void:
	var component := make_component()
	var a := track(Node.new())
	var b := track(Node.new())
	var effect := make_effect({stack_mode = Effect.StackMode.STACK, max_stacks = 5, stack_per_source = true})
	component.apply_effect(effect, a)
	component.apply_effect(effect, a)
	component.apply_effect(effect, b)
	check_eq(component.get_effects().size(), 2, "one instance per source")
	check_eq(component.get_stacks(effect), 3, "total stacks")
	check_eq(component.remove_effects_from(a), 1, "remove by source")
	check_eq(component.get_effect(effect).get_source(), b, "b's instance remains")


func test_lose_one_stack_on_expiry() -> void:
	var component := make_component()
	var effect := make_effect({duration = 1.0, stack_mode = Effect.StackMode.STACK, max_stacks = 3,
		lose_one_stack_on_expiry = true})
	for i in 3:
		component.apply_effect(effect)
	component.advance(1.0)
	check_eq(component.get_stacks(effect), 2, "lost one stack")
	component.advance(1.5)
	check_eq(component.get_stacks(effect), 1, "lost another, carrying over time")
	check_eq(component.get_effect(effect).time_left, 0.5, "timer restarted with carry")
	component.advance(0.5)
	check(not component.has_effect(effect), "last stack expired")


# --- Tags ------------------------------------------------------------------------

func test_tag_hierarchy() -> void:
	check(EffectTags.matches(&"debuff.poison", &"debuff"), "child matches parent")
	check(EffectTags.matches(&"debuff", &"debuff"), "exact match")
	check(not EffectTags.matches(&"debuffed", &"debuff"), "prefix without dot")
	check(not EffectTags.matches(&"debuff", &"debuff.poison"), "parent doesn't match child")
	var component := make_component()
	var tag_signals := [0]
	component.tags_changed.connect(func() -> void: tag_signals[0] += 1)
	component.apply_effect(poison())
	check(component.has_tag(&"debuff"), "has parent tag")
	check(component.has_tag(&"debuff.poison"), "has exact tag")
	check(not component.has_tag(&"buff"), "no unrelated tag")
	check_eq(component.get_tags(), [&"debuff.poison"], "get_tags")
	check_eq(component.remove_effects_with_tag(&"debuff"), 1, "remove by parent tag")
	check_eq(tag_signals[0], 2, "tags_changed on add and remove")


func test_immunity_blocked_required() -> void:
	var component := make_component()
	component.immunities = tags([&"fire"])
	var rejected: Array = []
	component.effect_rejected.connect(func(_effect: Effect, reason: String) -> void: rejected.append(reason))
	var burn := make_effect({id = &"burn", tags = tags([&"fire.burn"])})
	check(component.apply_effect(burn) == null, "immune to fire")
	component.immunities = tags([])
	var wet := make_effect({id = &"wet", tags = tags([&"wet"])})
	var burning := make_effect({id = &"burning", blocked_by_tags = tags([&"wet"])})
	var shock := make_effect({id = &"shock", required_tags = tags([&"wet"])})
	check(component.apply_effect(shock) == null, "shock needs wet")
	component.apply_effect(wet)
	check(component.apply_effect(burning) == null, "wet blocks burning")
	check(component.apply_effect(shock) != null, "shock works when wet")
	check_eq(rejected, ["immune", "missing_tags", "blocked"], "reasons")
	check(not component.can_apply(burning), "can_apply agrees")


func test_removes_tags() -> void:
	var component := make_component()
	var poisoned := component.apply_effect(poison())
	var cleanse := make_effect({duration_type = Effect.DurationType.INSTANT, removes_tags = tags([&"debuff"])})
	component.apply_effect(cleanse)
	check(not poisoned.is_active(), "poison cleansed")
	check_eq(poisoned.removal_reason, EffectInstance.RemovalReason.CLEANSED, "reason is CLEANSED")
	# Mutually exclusive stances: each removes the "stance" tag but keeps its own instance.
	var attack := make_effect({id = &"attack", duration_type = Effect.DurationType.PERMANENT,
		tags = tags([&"stance"]), removes_tags = tags([&"stance"])})
	var defend := make_effect({id = &"defend", duration_type = Effect.DurationType.PERMANENT,
		tags = tags([&"stance"]), removes_tags = tags([&"stance"])})
	var first := component.apply_effect(attack)
	check(component.apply_effect(attack) == first, "re-applying keeps own instance")
	component.apply_effect(defend)
	check(not component.has_effect(attack) and component.has_effect(defend), "stances swap")


# --- Hooks, cues and signals -----------------------------------------------------

func test_custom_effect_hooks() -> void:
	var component := make_component()
	var effect := HookEffect.new()
	effect.duration = 2.0
	effect.period = 1.0
	effect.stack_mode = Effect.StackMode.STACK
	effect.max_stacks = 2
	component.apply_effect(effect)
	component.apply_effect(effect)
	component.advance(2.0)
	check_eq(effect.log, ["applied", "reapplied:1", "ticked", "ticked",
		"removed:%d" % EffectInstance.RemovalReason.EXPIRED], "hook order")
	component.set_base_stat(&"health", 5.0)
	check(component.apply_effect(effect) == null, "_can_apply rejects")


func test_cue_events() -> void:
	var component := make_component()
	var cue := CountingCue.new()
	var effect := poison()
	effect.cues = cues([cue])
	component.apply_effect(effect)
	component.apply_effect(effect)
	component.advance(5.0)
	check_eq(cue.fired.get(EffectCue.Event.APPLIED, 0), 1, "applied")
	check_eq(cue.fired.get(EffectCue.Event.REAPPLIED, 0), 1, "reapplied")
	check_eq(cue.fired.get(EffectCue.Event.TICKED, 0), 5, "ticked")
	check_eq(cue.fired.get(EffectCue.Event.REMOVED, 0), 1, "removed")
	check_eq([cue.started, cue.stopped], [1, 1], "start and stop once")

	var instant_cue := CountingCue.new()
	component.apply_effect(make_effect({duration_type = Effect.DurationType.INSTANT,
		cues = cues([instant_cue])}))
	check_eq(instant_cue.fired, {EffectCue.Event.APPLIED: 1}, "instant fires APPLIED only")
	check_eq([instant_cue.started, instant_cue.stopped], [0, 0], "no start/stop for instant")

	var filtered := CountingCue.new()
	filtered.events = EffectCue.Event.REMOVED
	component.apply_effect(make_effect({duration = 1.0, cues = cues([filtered])}))
	component.advance(1.0)
	check_eq(filtered.fired, {EffectCue.Event.REMOVED: 1}, "events mask respected")


func test_reentrant_clear_on_depleted() -> void:
	var component := make_component({&"health": 8.0, &"max_health": 100.0})
	var cue := CountingCue.new()
	var effect := poison()
	effect.cues = cues([cue])
	component.stat_depleted.connect(func(_stat: StringName) -> void: component.clear_effects())
	component.apply_effect(effect)
	component.apply_effect(make_effect({id = &"other", duration = 10.0}))
	component.advance(3.0)
	check_eq(component.get_stat(&"health"), 0.0, "health hit zero")
	check(component.get_effects().is_empty(), "everything cleared from inside the tick")
	check_eq(cue.fired.get(EffectCue.Event.TICKED, 0), 1, "no ticked cue after removal mid-tick")
	check_eq([cue.started, cue.stopped], [1, 1], "cues stopped")


func test_starting_effects_and_queries() -> void:
	var entity := Node2D.new()
	var component := EffectComponent.new()
	component.base_stats = {"speed": 10.0}
	var haste := make_effect({id = &"haste", duration_type = Effect.DurationType.PERMANENT,
		modifiers = mods([mod(&"speed", StatModifier.Operation.MULTIPLY, 2.0)])})
	var starting: Array[Effect] = [haste]
	component.starting_effects = starting
	entity.add_child(component)
	tree.root.add_child(track(entity))
	check_eq(component.get_stat("speed"), 20.0, "String keys and starting effects work")
	check(component.has_effect("haste") and component.has_effect(haste), "lookup by id or resource")
	check_eq(EffectComponent.find_on(entity), component, "find_on entity")
	var hurtbox := Area2D.new()
	entity.add_child(hurtbox)
	check_eq(EffectComponent.find_on(hurtbox), component, "find_on sibling hurtbox")
	check_eq(component.remove_effect(&"haste"), 1, "remove by id")
	check_eq(component.get_stat_names(), [&"speed"], "stat names")


# --- Fx and visual cues ----------------------------------------------------------

func test_tint_cue_restores_modulate() -> void:
	var sprite := Node2D.new()
	sprite.modulate = Color(0.5, 0.5, 0.5)
	var component := make_component({}, {}, sprite)
	var green := TintCue.new()
	green.color = Color(0.5, 1.0, 0.5)
	var blue := TintCue.new()
	blue.color = Color(1.0, 1.0, 0.5)
	var a := component.apply_effect(make_effect({id = &"a", duration = 1.0, cues = cues([green])}))
	var b := component.apply_effect(make_effect({id = &"b", duration = 2.0, cues = cues([blue])}))
	check(sprite.modulate.is_equal_approx(Color(0.375, 0.5, 0.25)), "tints average: %s" % sprite.modulate)
	component.advance(1.0)
	check(not a.is_active(), "a expired")
	check(sprite.modulate.is_equal_approx(Color(0.5, 0.5, 0.25)), "one tint left: %s" % sprite.modulate)
	b.remove()
	check(sprite.modulate.is_equal_approx(Color(0.5, 0.5, 0.5)), "restored: %s" % sprite.modulate)
	check(not sprite.has_meta(&"_fx_base_modulate") and not sprite.has_meta(&"_fx_tints"), "metadata cleaned up")


func test_flash_2d_restores() -> void:
	var sprite := track(Node2D.new()) as Node2D
	sprite.modulate = Color(0.8, 0.6, 0.4)
	tree.root.add_child(sprite)
	Fx.push_tint(sprite, "tint", Color(1, 1, 0.5))
	Fx.flash(sprite, Color.WHITE, 0.1)
	await tree.process_frame
	check(sprite.modulate.r > 1.0, "flashing brightens: %s" % sprite.modulate)
	await wait_seconds(0.2)
	check(sprite.modulate.is_equal_approx(Color(0.8, 0.6, 0.2)), "flash ends on the tint: %s" % sprite.modulate)
	Fx.pop_tint(sprite, "tint")
	check(sprite.modulate.is_equal_approx(Color(0.8, 0.6, 0.4)), "original restored: %s" % sprite.modulate)


func test_flash_shader_material() -> void:
	var sprite := track(Sprite2D.new()) as Sprite2D
	var material := ShaderMaterial.new()
	material.shader = load("res://addons/effects_system/fx/hit_flash.gdshader")
	sprite.material = material
	tree.root.add_child(sprite)
	Fx.flash(sprite, Color.RED, 0.1)
	await tree.process_frame
	check(float(material.get_shader_parameter(&"flash_amount")) > 0.0, "shader flash running")
	check_eq(material.get_shader_parameter(&"flash_color"), Color.RED, "flash colour set")
	check(sprite.modulate == Color.WHITE, "modulate untouched")
	await wait_seconds(0.2)
	check_eq(float(material.get_shader_parameter(&"flash_amount")), 0.0, "shader flash finished")


func test_flash_and_tint_3d() -> void:
	var body := track(Node3D.new()) as Node3D
	var mesh := MeshInstance3D.new()
	mesh.mesh = BoxMesh.new()
	body.add_child(mesh)
	var particles := CPUParticles3D.new()
	body.add_child(particles)
	tree.root.add_child(body)
	var original := StandardMaterial3D.new()
	mesh.material_overlay = original
	Fx.push_tint(body, "frozen", Color.CYAN)
	check(mesh.material_overlay != original, "tint overlay applied")
	check(particles.material_overlay == null, "particles skipped")
	var overlay := mesh.material_overlay as StandardMaterial3D
	check(overlay.albedo_color.is_equal_approx(Color(Color.CYAN, Fx.tint_strength_3d)), "tint colour")
	Fx.flash(body, Color.WHITE, 0.1)
	await tree.process_frame
	check(overlay.albedo_color.r > 0.9 and overlay.albedo_color.a > 0.1, "flash overrides tint: %s" % overlay.albedo_color)
	await wait_seconds(0.2)
	check(overlay.albedo_color.is_equal_approx(Color(Color.CYAN, Fx.tint_strength_3d)), "back to tint")
	Fx.pop_tint(body, "frozen")
	check(mesh.material_overlay == original, "original overlay restored")


func test_hitstop_restores_time_scale() -> void:
	Engine.time_scale = 0.5
	Fx.hitstop(0.05)
	check_eq(Engine.time_scale, 0.0, "frozen")
	check(Fx.is_hitstopped(), "is_hitstopped")
	Fx.hitstop(0.2, 0.1)
	check_eq(Engine.time_scale, 0.0, "a gentler overlapping hitstop doesn't unfreeze")
	await wait_seconds(0.1)
	check_eq(Engine.time_scale, 0.0, "still frozen by the longer hitstop")
	await wait_seconds(0.2)
	check_eq(Engine.time_scale, 0.5, "previous time scale restored")
	check(not Fx.is_hitstopped(), "not hitstopped")


func test_shake_restores_camera() -> void:
	var camera := track(Camera2D.new()) as Camera2D
	camera.offset = Vector2(5, 5)
	tree.root.add_child(camera)
	camera.make_current()
	await tree.process_frame
	Fx.shake(1.0)
	var moved := false
	for i in 10:
		await tree.process_frame
		moved = moved or not camera.offset.is_equal_approx(Vector2(5, 5))
	check(moved, "camera moved")
	check(Fx.get_trauma() > 0.0, "trauma present")
	await wait_seconds(0.9)
	check(camera.offset.is_equal_approx(Vector2(5, 5)), "offset restored: %s" % camera.offset)
	check_eq(Fx.get_trauma(), 0.0, "trauma decayed")


func test_scene_cue_while_active() -> void:
	var component := make_component()
	var scene := PackedScene.new()
	var particles := CPUParticles2D.new()
	particles.lifetime = 0.1
	scene.pack(particles)
	particles.free()
	var cue := SceneCue.new()
	cue.scene = scene
	cue.mode = SceneCue.Mode.WHILE_ACTIVE
	cue.offset = Vector3(0, -10, 0)
	var effect := make_effect({duration = 1.0, cues = cues([cue])})
	var instance := component.apply_effect(effect)
	var entity := component.get_parent()
	var spawned: CPUParticles2D = null
	for child in entity.get_children():
		if child is CPUParticles2D:
			spawned = child
	check(spawned != null, "particles attached to the target")
	if spawned == null:
		return
	check(spawned.emitting, "emitting")
	check_eq(spawned.position, Vector2(0, -10), "offset")
	instance.remove()
	check(not spawned.emitting, "stops emitting on removal")
	await wait_seconds(0.25)
	check(not is_instance_valid(spawned), "freed after its lifetime")


func test_one_shot_spawn_frees_itself() -> void:
	var scene := PackedScene.new()
	var particles := CPUParticles2D.new()
	particles.one_shot = true
	particles.lifetime = 0.1
	particles.explosiveness = 1.0
	scene.pack(particles)
	particles.free()
	var node := Fx.spawn(scene, Vector2(40, 50), tree.root)
	check(node is CPUParticles2D and node.emitting, "spawned and emitting")
	check_eq(node.global_position, Vector2(40, 50), "placed")
	var timed := Fx.spawn(scene, null, tree.root, 0.05)
	await wait_seconds(0.5)
	check(not is_instance_valid(node), "one-shot particles freed when finished")
	check(not is_instance_valid(timed), "lifetime respected")


func test_text_cue_damage_numbers() -> void:
	var component := make_component()
	component.get_parent().position = Vector2(200, 200)
	var cue := TextCue.new()
	cue.events = EffectCue.Event.TICKED
	cue.text = "{signed} ({name} x{stacks})"
	var effect := poison(4.0)
	effect.display_name = "Poison"
	effect.cues = cues([cue])
	component.apply_effect(effect)
	var before := tree.root.get_child_count()
	component.advance(1.0)
	var label: Label = null
	for child in tree.root.get_children():
		if child is Label:
			label = child
	check(label != null, "label spawned")
	if label != null:
		_nodes.append(label)
		check_eq(label.text, "-4 (Poison x1)", "formatted text")
		var centre := label.global_position + label.size * 0.5
		check(centre.distance_to(Vector2(200, 168)) < 16.0, "centred above the target: %s" % centre)
	check_eq(tree.root.get_child_count(), before + 1, "one popup per tick")
	var absorbed := make_component()
	absorbed.change_filter = func(_s: StringName, _a: float, _i: EffectInstance) -> float: return 0.0
	before = tree.root.get_child_count()
	absorbed.apply_effect(effect)
	absorbed.advance(1.0)
	check_eq(tree.root.get_child_count(), before, "zero amounts hidden")
	await wait_seconds(Fx.text_duration + 0.2)
	check(label == null or not is_instance_valid(label), "popup freed after animating")


func test_freeing_entity_cleans_up() -> void:
	var sprite := Node2D.new()
	var component := make_component({}, {}, sprite)
	var tint := TintCue.new()
	# Attached nodes are freed before the component, so the cue must cope with that.
	var marker_scene := PackedScene.new()
	var marker := Node2D.new()
	marker_scene.pack(marker)
	marker.free()
	var attached := SceneCue.new()
	attached.scene = marker_scene
	attached.mode = SceneCue.Mode.WHILE_ACTIVE
	var cue := CountingCue.new()
	component.apply_effect(make_effect({duration = 10.0, cues = cues([tint, attached, cue])}))
	check_eq(sprite.get_child_count(), 2, "marker attached")
	sprite.free()
	check_eq(cue.stopped, 1, "persistent cues stopped when the entity is freed")


func test_3d_entity_cues_and_shake() -> void:
	var entity := Node3D.new()
	entity.position = Vector3(1, 2, 3)
	var component := make_component({&"health": 50.0, &"max_health": 50.0}, {&"health": &"max_health"}, entity)
	check_eq(component.get_fx_position(), Vector3(1, 2, 3), "Vector3 fx position")
	var marker_scene := PackedScene.new()
	var marker := Node3D.new()
	marker_scene.pack(marker)
	marker.free()
	var text := TextCue.new()
	text.text = "{amount}"
	text.offset = Vector3(0, 2, 0)
	var spawn := SceneCue.new()
	spawn.scene = marker_scene
	spawn.mode = SceneCue.Mode.WHILE_ACTIVE
	spawn.offset = Vector3(0, 1, 0)
	var hit := make_effect({duration = 1.0, cues = cues([text, spawn]),
		instant_changes = mods([mod(&"health", StatModifier.Operation.ADD, -7.0)])})
	component.apply_effect(hit)
	var label: Label3D = null
	for child in tree.root.get_children():
		if child is Label3D:
			label = child
	check(label != null and label.text == "7", "Label3D damage number")
	if label != null:
		_nodes.append(label)
		check(label.global_position.distance_to(Vector3(1, 4, 3)) < 0.3, "above the entity")
	var attached := entity.get_children().filter(func(n: Node) -> bool: return n is Node3D)
	check_eq(attached.size(), 1, "scene attached to the 3D entity")
	if attached.size() == 1:
		check_eq(attached[0].position, Vector3(0, 1, 0), "3D offset")

	var camera := track(Camera3D.new()) as Camera3D
	tree.root.add_child(camera)
	camera.make_current()
	await tree.process_frame
	Fx.shake(1.0)
	var moved := false
	for i in 10:
		await tree.process_frame
		moved = moved or camera.h_offset != 0.0 or camera.v_offset != 0.0
	check(moved, "Camera3D shook")
	await wait_seconds(0.9)
	check(is_zero_approx(camera.h_offset) and is_zero_approx(camera.v_offset), "Camera3D offsets restored")


# --- Nodes -----------------------------------------------------------------------

func test_effect_zone() -> void:
	var area := track(Area2D.new()) as Area2D
	var zone := EffectZone.new()
	var aura := make_effect({id = &"aura", duration_type = Effect.DurationType.PERMANENT,
		modifiers = mods([mod(&"speed", StatModifier.Operation.MULTIPLY, 0.5)])})
	var heal := make_effect({duration_type = Effect.DurationType.INSTANT,
		instant_changes = mods([mod(&"health", StatModifier.Operation.ADD, 5.0)])})
	var effects: Array[Effect] = [aura, heal]
	zone.effects = effects
	zone.reapply_interval = 1.0
	zone.remove_on_exit = true
	area.add_child(zone)
	tree.root.add_child(area)
	var component := make_component({&"health": 50.0, &"max_health": 100.0, &"speed": 100.0})
	var body := component.get_parent()
	zone._on_entered(body)
	check_eq(component.get_stat(&"speed"), 50.0, "aura applied on entry")
	check_eq(component.get_stat(&"health"), 55.0, "heal applied on entry")
	check_eq(zone.get_components(), [component], "tracked inside")
	zone._physics_process(0.5)
	zone._physics_process(0.5)
	check_eq(component.get_stat(&"health"), 60.0, "reapplied after the interval")
	zone._on_entered(body)
	zone._on_exited(body)
	check(component.has_effect(aura), "a second overlap keeps it inside")
	zone._on_exited(body)
	check(not component.has_effect(aura), "removed on exit")
	check(zone.get_components().is_empty(), "nothing inside")


func test_effect_bar() -> void:
	var component := make_component()
	var bar := track(EffectBar.new()) as EffectBar
	tree.root.add_child(bar)
	bar.component = component
	check_eq(bar.component, component, "getter")
	var instance := component.apply_effect(poison())
	component.apply_effect(make_effect({hidden = true}))
	check_eq(bar.get_child_count(), 1, "hidden effects are skipped")
	await tree.process_frame
	component.advance(2.5)
	bar._process(0.0)
	var slot := bar.get_child(0)
	check_eq((slot.get_node("Timer") as Label).text, "3s", "timer text")
	instance.remove()
	await tree.process_frame
	check_eq(bar.get_child_count(), 0, "slot removed")
	bar.component = null
	component.apply_effect(poison())
	check_eq(bar.get_child_count(), 0, "unbound")

