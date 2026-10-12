@tool
extends EditorImportPlugin
## Imports MagicaVoxel .vox files as ArrayMesh resources built by VoxelMesher.


func _get_importer_name() -> String:
	return "cinder_voxel.vox_mesh"


func _get_visible_name() -> String:
	return "Voxel Mesh (Cinder)"


func _get_recognized_extensions() -> PackedStringArray:
	return PackedStringArray(["vox"])


func _get_save_extension() -> String:
	return "mesh"


func _get_resource_type() -> String:
	return "ArrayMesh"


func _get_priority() -> float:
	return 1.0


func _get_import_order() -> int:
	return 0


func _get_preset_count() -> int:
	return 1


func _get_preset_name(_preset_index: int) -> String:
	return "Default"


func _get_import_options(_path: String, _preset_index: int) -> Array[Dictionary]:
	return [
		{"name": "voxel_size", "default_value": VoxelMesher.DEFAULT_VOXEL_SIZE},
		# Fraction of the model bounds used as origin; (0.5, 0, 0.5) is bottom centre.
		{"name": "pivot", "default_value": Vector3(0.5, 0.0, 0.5)},
	]


func _get_option_visibility(_path: String, _option_name: StringName, _options: Dictionary) -> bool:
	return true


func _import(source_file: String, save_path: String, options: Dictionary, _platform_variants: Array[String], _gen_files: Array[String]) -> Error:
	var model := VoxIO.load_file(source_file)
	if model == null:
		return ERR_PARSE_ERROR
	var mesh := VoxelMesher.build(model, options.voxel_size, options.pivot)
	return ResourceSaver.save(mesh, "%s.%s" % [save_path, _get_save_extension()])
