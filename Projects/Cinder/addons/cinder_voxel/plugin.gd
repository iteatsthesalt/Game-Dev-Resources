@tool
extends EditorPlugin

var _vox_importer: EditorImportPlugin


func _enter_tree() -> void:
	_vox_importer = preload("vox_import_plugin.gd").new()
	add_import_plugin(_vox_importer)


func _exit_tree() -> void:
	remove_import_plugin(_vox_importer)
	_vox_importer = null
