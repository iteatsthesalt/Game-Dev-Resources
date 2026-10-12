# Headless voxel builder and validator.
#
#   godot --headless --path <session> --script res://tools/build_voxel.gd -- <name>
#
# Reads res://.ai/manifests/<name>.json, re-validates the referenced spec, and
# saves a MultiMesh scene to res://scenes/generated/<name>.tscn.
# Exit code 0 means the asset is valid and the scene loads back.
extends SceneTree

const MAX_AXIS := 64
const MAX_VOXELS := 262144
const MAX_PALETTE := 256
const VOXEL_SIZE := 1.0


func _initialize() -> void:
	var error := _run(OS.get_cmdline_user_args())
	if error != "":
		printerr("build_voxel: ", error)
		quit(1)
	else:
		quit(0)


func _run(args: PackedStringArray) -> String:
	if args.size() != 1:
		return "expected exactly one asset name"
	var name := args[0]
	var name_re := RegEx.create_from_string("^[a-z0-9_]{1,48}$")
	if name_re.search(name) == null:
		return "invalid asset name"

	var manifest = _read_json("res://.ai/manifests/%s.json" % name)
	if not manifest is Dictionary:
		return "manifest missing or not an object"
	var spec_path := "res://assets/generated/%s.json" % name
	var scene_path := "res://scenes/generated/%s.tscn" % name
	# The manifest may only point at the paths derived from the name.
	if manifest.get("spec") != spec_path or manifest.get("scene") != scene_path:
		return "manifest paths do not match the asset name"

	var asset = _read_json(spec_path)
	var problem := _validate(asset, name)
	if problem != "":
		return problem

	var root := _build_scene(asset)
	var packed := PackedScene.new()
	var err := packed.pack(root)
	root.free()
	if err != OK:
		return "could not pack scene (%s)" % error_string(err)

	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://scenes/generated"))
	err = ResourceSaver.save(packed, scene_path)
	if err != OK:
		return "could not save %s (%s)" % [scene_path, error_string(err)]

	var reloaded = ResourceLoader.load(scene_path, "", ResourceLoader.CACHE_MODE_IGNORE)
	if not reloaded is PackedScene or not reloaded.can_instantiate():
		return "saved scene does not load back"
	print("build_voxel: %s -> %s (%d voxels)" % [spec_path, scene_path, asset["voxels"].size()])
	return ""


func _read_json(path: String) -> Variant:
	if not FileAccess.file_exists(path):
		return null
	return JSON.parse_string(FileAccess.get_file_as_string(path))


func _is_int(value: Variant) -> bool:
	# JSON numbers arrive as floats.
	return (typeof(value) == TYPE_FLOAT and value == floor(value)) or typeof(value) == TYPE_INT


func _validate(asset: Variant, name: String) -> String:
	if not asset is Dictionary:
		return "spec missing or not an object"
	if asset.get("name") != name:
		return "spec name does not match"

	var dims = asset.get("dimensions")
	if not dims is Array or dims.size() != 3:
		return "dimensions must have three entries"
	for n in dims:
		if not _is_int(n) or n < 1 or n > MAX_AXIS:
			return "each axis must be an integer in 1..%d" % MAX_AXIS

	var palette = asset.get("palette")
	if not palette is Array or palette.is_empty() or palette.size() > MAX_PALETTE:
		return "palette must have 1..%d colours" % MAX_PALETTE
	for colour in palette:
		if not colour is String or colour.length() != 7 or not colour.begins_with("#") \
				or not Color.html_is_valid(colour):
			return "invalid palette colour %s" % str(colour)

	var voxels = asset.get("voxels")
	if not voxels is Array or voxels.size() > MAX_VOXELS:
		return "voxels must be a list of at most %d entries" % MAX_VOXELS
	var seen := {}
	for v in voxels:
		if not v is Array or v.size() != 4:
			return "each voxel must be [x, y, z, palette_index]"
		for n in v:
			if not _is_int(n):
				return "voxel %s has a non-integer value" % str(v)
		var x := int(v[0])
		var y := int(v[1])
		var z := int(v[2])
		var c := int(v[3])
		if x < 0 or y < 0 or z < 0 or x >= dims[0] or y >= dims[1] or z >= dims[2]:
			return "voxel %s is outside dimensions" % str(v)
		if c < 0 or c >= palette.size():
			return "voxel %s has an invalid palette index" % str(v)
		var key := Vector3i(x, y, z)
		if seen.has(key):
			return "duplicate voxel at %s" % str(key)
		seen[key] = true
	return ""


func _build_scene(asset: Dictionary) -> Node3D:
	var palette: Array = asset["palette"]
	var voxels: Array = asset["voxels"]

	var material := StandardMaterial3D.new()
	material.vertex_color_use_as_albedo = true

	var box := BoxMesh.new()
	box.size = Vector3.ONE * VOXEL_SIZE

	var multimesh := MultiMesh.new()
	multimesh.transform_format = MultiMesh.TRANSFORM_3D
	multimesh.use_colors = true  # must be set before instance_count
	multimesh.mesh = box
	multimesh.instance_count = voxels.size()
	var offset := Vector3.ONE * (VOXEL_SIZE * 0.5)
	for i in voxels.size():
		var v: Array = voxels[i]
		var origin := Vector3(int(v[0]), int(v[1]), int(v[2])) * VOXEL_SIZE + offset
		multimesh.set_instance_transform(i, Transform3D(Basis(), origin))
		multimesh.set_instance_color(i, Color.html(palette[int(v[3])]))

	var root := Node3D.new()
	root.name = String(asset["name"]).to_pascal_case()
	var instance := MultiMeshInstance3D.new()
	instance.name = "Voxels"
	instance.multimesh = multimesh
	instance.material_override = material
	root.add_child(instance)
	instance.owner = root
	return root
