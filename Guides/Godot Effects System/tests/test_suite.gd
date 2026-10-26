extends RefCounted
## Shared harness for the test suites. Run everything with tests/run_tests.gd.

var tree: SceneTree

var _current := ""
var _failures: Dictionary = {}
var _nodes: Array[Node] = []


# --- Harness ---------------------------------------------------------------------

func begin(test_name: String) -> void:
	_current = test_name
	_failures[test_name] = []


func end() -> void:
	for node in _nodes:
		if is_instance_valid(node):
			node.free()
	_nodes.clear()
	Fx.stop_shake()
	Fx.cancel_hitstop()
	Engine.time_scale = 1.0
	await tree.process_frame


func failures_for(test_name: String) -> Array:
	return _failures.get(test_name, [])


func failed_tests() -> int:
	var count := 0
	for test_name in _failures:
		if not _failures[test_name].is_empty():
			count += 1
	return count


func check(condition: bool, message: String) -> void:
	if not condition:
		_failures[_current].append(message)


func check_eq(actual: Variant, expected: Variant, message: String) -> void:
	var same: bool
	if (actual is float or actual is int) and (expected is float or expected is int):
		same = is_equal_approx(float(actual), float(expected))
	else:
		same = actual == expected
	if not same:
		_failures[_current].append("%s: expected %s, got %s" % [message, str(expected), str(actual)])


func track(node: Node) -> Node:
	_nodes.append(node)
	return node


func wait_seconds(seconds: float) -> void:
	await tree.create_timer(seconds, true, false, true).timeout


## An entity (Node2D by default) with an EffectComponent child, in the tree.
func make_component(stats: Dictionary = {&"health": 100.0, &"max_health": 100.0, &"speed": 100.0},
		limits: Dictionary = {&"health": &"max_health"}, entity: Node = null) -> EffectComponent:
	if entity == null:
		entity = Node2D.new()
	var component := EffectComponent.new()
	component.base_stats = stats
	component.stat_limits = limits
	component.update_mode = EffectComponent.UpdateMode.MANUAL
	entity.add_child(component)
	tree.root.add_child(track(entity))
	return component


func make_effect(props: Dictionary = {}) -> Effect:
	var effect := Effect.new()
	for key in props:
		effect.set(key, props[key])
	return effect


func mod(stat: StringName, operation: StatModifier.Operation, value: float) -> StatModifier:
	return StatModifier.create(stat, operation, value)


func mods(list: Array) -> Array[StatModifier]:
	var typed: Array[StatModifier] = []
	typed.assign(list)
	return typed


func tags(list: Array) -> Array[StringName]:
	var typed: Array[StringName] = []
	typed.assign(list)
	return typed


func cues(list: Array) -> Array[EffectCue]:
	var typed: Array[EffectCue] = []
	typed.assign(list)
	return typed
