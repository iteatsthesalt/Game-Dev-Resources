extends SceneTree
## Headless test runner. From this folder:
##
##   godot --headless --path . --import                         # once, registers class names
##   godot --headless --path . --script res://tests/run_tests.gd
##   godot --headless --path . --script res://tests/run_tests.gd -- test_stacking   # filter
##
## Exits with code 0 when every test passes. On Godot 4.5+ a test also fails if it
## logs an engine or script error.

const Suite := preload("res://tests/test_effects.gd")

# Collects engine and script errors so a test that logs one fails. Logger only exists
# on Godot 4.5+, so it's compiled from source at runtime to keep older editors happy.
const ERROR_LOGGER_SOURCE := """
extends Logger

var _errors: Array[String] = []
var _mutex := Mutex.new()


func _log_error(function: String, file: String, line: int, code: String, rationale: String,
		_editor_notify: bool, error_type: int, _script_backtraces: Array[ScriptBacktrace]) -> void:
	if error_type == ERROR_TYPE_WARNING:
		return
	_mutex.lock()
	_errors.append("%s (%s:%d in %s)" % [rationale if rationale != "" else code, file, line, function])
	_mutex.unlock()


func take() -> Array[String]:
	_mutex.lock()
	var errors := _errors.duplicate()
	_errors.clear()
	_mutex.unlock()
	return errors
"""


func _initialize() -> void:
	_run()


func _run() -> void:
	await process_frame  # Let the root become ready so _ready() runs on added nodes.
	var filter := OS.get_cmdline_user_args()
	var suite: Suite = Suite.new()
	suite.tree = self
	var names: Array[String] = []
	for method in suite.get_method_list():
		var method_name: String = method.name
		if method_name.begins_with("test_") and not names.has(method_name):
			if filter.is_empty() or Array(filter).any(func(f: String) -> bool: return method_name.contains(f)):
				names.append(method_name)

	var logger: RefCounted = null
	if ClassDB.class_exists(&"Logger"):
		var script := GDScript.new()
		script.source_code = ERROR_LOGGER_SOURCE
		script.reload()
		logger = script.new()
		OS.call(&"add_logger", logger)

	var started := Time.get_ticks_msec()
	for method_name in names:
		suite.begin(method_name)
		await suite.call(method_name)
		await suite.end()
		if logger != null:
			for error in logger.take():
				suite.check(false, "engine error: " + error)
		var failures := suite.failures_for(method_name)
		if failures.is_empty():
			print("  ok    ", method_name)
		else:
			print("  FAIL  ", method_name)
			for failure in failures:
				print("          ", failure)

	var failed := suite.failed_tests()
	print("\n%d tests, %d passed, %d failed (%d ms)" % [
		names.size(), names.size() - failed, failed, Time.get_ticks_msec() - started])
	quit(1 if failed > 0 or names.is_empty() else 0)
