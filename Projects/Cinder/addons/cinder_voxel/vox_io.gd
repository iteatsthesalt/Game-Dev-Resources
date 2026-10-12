@tool
class_name VoxIO
extends RefCounted
## Reads and writes MagicaVoxel .vox files.
##
## MagicaVoxel is Z-up and Godot is Y-up; a Godot voxel (x, y, z) maps to the
## MagicaVoxel voxel (x, size.z - 1 - z, y), so models keep their handedness.
##
## Reading merges every model placed by the scene graph (translations only;
## rotated instances are placed unrotated with a warning). MATL chunks carry
## emission (`_emit` * (1 + `_flux`)), roughness and metallic values.

const _IDENTITY_ROTATION := 4


static func load_file(path: String) -> VoxelModel:
	var bytes := FileAccess.get_file_as_bytes(path)
	if bytes.is_empty():
		push_error("VoxIO: could not read %s (%s)" % [path, error_string(FileAccess.get_open_error())])
		return null
	var model := parse(bytes)
	if model == null:
		push_error("VoxIO: %s is not a valid .vox file" % path)
	return model


static func save_file(model: VoxelModel, path: String) -> Error:
	var file := FileAccess.open(path, FileAccess.WRITE)
	if file == null:
		return FileAccess.get_open_error()
	file.store_buffer(serialize(model))
	return OK


static func parse(bytes: PackedByteArray) -> VoxelModel:
	var buf := StreamPeerBuffer.new()
	buf.data_array = bytes
	if bytes.size() < 20 or _read_id(buf) != "VOX ":
		return null
	buf.get_32() # version
	if _read_id(buf) != "MAIN":
		return null
	var main_content := buf.get_32()
	var main_children := buf.get_32()
	buf.seek(buf.get_position() + main_content)
	var end := mini(buf.get_position() + main_children, bytes.size())

	var shapes: Array[Dictionary] = [] # {size: Vector3i, xyzi: PackedByteArray}
	var palette := PackedColorArray()
	var materials := {}
	var nodes := {}
	var pending_size := Vector3i.ZERO
	while buf.get_position() + 12 <= end:
		var id := _read_id(buf)
		var content := buf.get_32()
		var children := buf.get_32()
		var start := buf.get_position()
		match id:
			"SIZE":
				pending_size = Vector3i(buf.get_32(), buf.get_32(), buf.get_32())
			"XYZI":
				var count := buf.get_32()
				shapes.append({"size": pending_size, "xyzi": bytes.slice(buf.get_position(), buf.get_position() + count * 4)})
			"RGBA":
				for i in 256:
					palette.append(Color8(buf.get_u8(), buf.get_u8(), buf.get_u8(), buf.get_u8()))
			"MATL":
				var mat_id := buf.get_32()
				materials[mat_id] = _read_dict(buf)
			"nTRN":
				var node_id := buf.get_32()
				_read_dict(buf)
				var child := buf.get_32()
				buf.get_32() # reserved
				buf.get_32() # layer
				var frames := buf.get_32()
				var frame := _read_dict(buf) if frames > 0 else {}
				nodes[node_id] = {"type": "trn", "child": child, "frame": frame}
			"nGRP":
				var node_id := buf.get_32()
				_read_dict(buf)
				var kids: Array[int] = []
				for i in buf.get_32():
					kids.append(buf.get_32())
				nodes[node_id] = {"type": "grp", "children": kids}
			"nSHP":
				var node_id := buf.get_32()
				_read_dict(buf)
				var models: Array[int] = []
				for i in buf.get_32():
					models.append(buf.get_32())
					_read_dict(buf)
				nodes[node_id] = {"type": "shp", "models": models}
		buf.seek(start + content + children)

	if shapes.is_empty():
		return null
	if palette.is_empty():
		push_warning("VoxIO: file has no RGBA palette; using greys.")
		for i in 256:
			palette.append(Color(float(i) / 255.0, float(i) / 255.0, float(i) / 255.0))

	# Place shapes in MagicaVoxel world space: [shape index, translation].
	var placed: Array = []
	if nodes.has(0):
		_walk(nodes, 0, Vector3i.ZERO, placed)
	else:
		for i in shapes.size():
			placed.append([i, shapes[i].size / 2])

	var lo := Vector3i(1 << 30, 1 << 30, 1 << 30)
	var hi := -lo
	for entry: Array in placed:
		var shape: Dictionary = shapes[entry[0]]
		var origin: Vector3i = entry[1] - shape.size / 2
		lo = lo.min(origin)
		hi = hi.max(origin + shape.size - Vector3i.ONE)
	var vsize := hi - lo + Vector3i.ONE
	var model := VoxelModel.create(Vector3i(vsize.x, vsize.z, vsize.y))

	var remap := {}
	for entry: Array in placed:
		var shape: Dictionary = shapes[entry[0]]
		var origin: Vector3i = entry[1] - shape.size / 2 - lo
		var xyzi: PackedByteArray = shape.xyzi
		for i in range(0, xyzi.size(), 4):
			var color_index := xyzi[i + 3]
			if color_index == 0:
				continue
			if not remap.has(color_index):
				remap[color_index] = _add_vox_material(model, palette[color_index - 1], materials.get(color_index, {}))
			var vx := origin.x + xyzi[i]
			var vy := origin.y + xyzi[i + 1]
			var vz := origin.z + xyzi[i + 2]
			model.set_voxel(Vector3i(vx, vz, vsize.y - 1 - vy), remap[color_index])
	return model


static func serialize(model: VoxelModel) -> PackedByteArray:
	var s := model.size
	if s.x > 256 or s.y > 256 or s.z > 256:
		push_warning("VoxIO: models larger than 256 voxels per axis won't open in MagicaVoxel.")

	var size_chunk := StreamPeerBuffer.new()
	size_chunk.put_32(s.x)
	size_chunk.put_32(s.z)
	size_chunk.put_32(s.y)

	var xyzi := StreamPeerBuffer.new()
	xyzi.put_32(model.count_solid())
	for z in s.z:
		for y in s.y:
			for x in s.x:
				var value := model.voxels[x + s.x * (y + s.y * z)]
				if value != 0:
					xyzi.put_u8(x)
					xyzi.put_u8(s.z - 1 - z)
					xyzi.put_u8(y)
					xyzi.put_u8(value)

	var rgba := StreamPeerBuffer.new()
	for i in range(1, 257):
		var c := model.colors[i] if i < model.colors.size() else Color.BLACK
		rgba.put_u8(c.r8)
		rgba.put_u8(c.g8)
		rgba.put_u8(c.b8)
		rgba.put_u8(255)

	var children := PackedByteArray()
	children.append_array(_chunk("SIZE", size_chunk.data_array))
	children.append_array(_chunk("XYZI", xyzi.data_array))
	children.append_array(_chunk("RGBA", rgba.data_array))
	for i in range(1, model.colors.size()):
		var matl := StreamPeerBuffer.new()
		matl.put_32(i)
		var props := {}
		if model.emission[i] > 0.0:
			props["_type"] = "_emit"
			props["_emit"] = str(minf(model.emission[i], 1.0))
			props["_flux"] = str(maxf(model.emission[i] - 1.0, 0.0))
		elif model.metallic[i] > 0.0:
			props["_type"] = "_metal"
			props["_metal"] = str(model.metallic[i])
		else:
			props["_type"] = "_diffuse"
		props["_rough"] = str(model.roughness[i])
		_write_dict(matl, props)
		children.append_array(_chunk("MATL", matl.data_array))

	var out := StreamPeerBuffer.new()
	out.put_data("VOX ".to_ascii_buffer())
	out.put_32(150)
	out.put_data(_chunk("MAIN", PackedByteArray(), children))
	return out.data_array


static func _add_vox_material(model: VoxelModel, color: Color, props: Dictionary) -> int:
	var type: String = props.get("_type", "_diffuse")
	var emission := 0.0
	var metal := 0.0
	if type == "_emit":
		emission = float(props.get("_emit", "1")) * (1.0 + float(props.get("_flux", "0")))
	elif type == "_metal":
		metal = float(props.get("_metal", "1"))
	var default_rough := "0.3" if type == "_metal" else "0.9"
	var rough := float(props.get("_rough", default_rough))
	color.a = 1.0
	return model.add_material(color, emission, rough, metal)


static func _walk(nodes: Dictionary, id: int, offset: Vector3i, placed: Array) -> void:
	var node: Dictionary = nodes.get(id, {})
	match node.get("type", ""):
		"trn":
			var frame: Dictionary = node.frame
			if frame.has("_r") and int(frame._r) != _IDENTITY_ROTATION:
				push_warning("VoxIO: rotated model instances are imported unrotated.")
			if frame.has("_t"):
				var t: PackedStringArray = String(frame._t).split(" ", false)
				if t.size() == 3:
					offset += Vector3i(int(t[0]), int(t[1]), int(t[2]))
			_walk(nodes, node.child, offset, placed)
		"grp":
			for child: int in node.children:
				_walk(nodes, child, offset, placed)
		"shp":
			for model_id: int in node.models:
				placed.append([model_id, offset])


static func _read_id(buf: StreamPeerBuffer) -> String:
	return buf.get_data(4)[1].get_string_from_ascii()


static func _read_string(buf: StreamPeerBuffer) -> String:
	var length := buf.get_32()
	return buf.get_data(length)[1].get_string_from_utf8() if length > 0 else ""


static func _read_dict(buf: StreamPeerBuffer) -> Dictionary:
	var d := {}
	for i in buf.get_32():
		var key := _read_string(buf)
		d[key] = _read_string(buf)
	return d


static func _write_dict(buf: StreamPeerBuffer, d: Dictionary) -> void:
	buf.put_32(d.size())
	for key: String in d:
		for text: String in [key, String(d[key])]:
			var raw := text.to_utf8_buffer()
			buf.put_32(raw.size())
			buf.put_data(raw)


static func _chunk(id: String, content: PackedByteArray, children := PackedByteArray()) -> PackedByteArray:
	var buf := StreamPeerBuffer.new()
	buf.put_data(id.to_ascii_buffer())
	buf.put_32(content.size())
	buf.put_32(children.size())
	buf.put_data(content)
	buf.put_data(children)
	return buf.data_array
