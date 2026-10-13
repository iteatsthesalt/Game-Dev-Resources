@tool
class_name VoxelRefine
extends RefCounted
## Turns a blocky voxel model into a finer, layered-looking one:
##   1. upsample: every voxel becomes factor^3 smaller voxels;
##   2. smooth: shave convex corners and fill small concave gaps, a few passes,
##      so silhouettes read as rounded layers instead of stacked blocks;
##   3. surface layer: darker paint in creases and a fine colour grain.
## Only voxels near the surface are visited, so it stays fast.

const _NEIGHBOURS_6: Array[Vector3i] = [Vector3i.UP, Vector3i.DOWN, Vector3i.LEFT, Vector3i.RIGHT, Vector3i.FORWARD, Vector3i.BACK]


## texture: "fur" (hanging strands), "feather" (strands sweeping back), "ash"
## (flaking pits and chips), "plate" (crisp lit edges) or "" for none.
static func refine(model: VoxelModel, factor := 2, smooth_passes := 2, grain := 0.18, seed := 1, texture := "") -> VoxelModel:
	if factor <= 1:
		return model
	var src := model.size
	var out := VoxelModel.create(src * factor)
	out.colors = model.colors.duplicate()
	out.emission = model.emission.duplicate()
	out.roughness = model.roughness.duplicate()
	out.metallic = model.metallic.duplicate()

	# 1. Upsample.
	var size := out.size
	for z in src.z:
		for y in src.y:
			for x in src.x:
				var value := model.voxels[x + src.x * (y + src.y * z)]
				if value == 0:
					continue
				for dz in factor:
					for dy in factor:
						var row := (x * factor) + size.x * ((y * factor + dy) + size.y * (z * factor + dz))
						for dx in factor:
							out.voxels[row + dx] = value

	# 2. Smooth near the surface.
	for i in smooth_passes:
		_smooth(out, _surface_band(out))

	# 3. Surface layer: crease shading and grain.
	var rng := RandomNumberGenerator.new()
	rng.seed = seed
	var darker := {}
	for i in range(1, out.colors.size()):
		if out.emission[i] <= 0.0:
			var c := out.colors[i].darkened(0.22)
			darker[i] = out.add_material(c, 0.0, out.roughness[i], out.metallic[i])
	var lighter := {}
	for i in darker:
		lighter[i] = out.add_material(out.colors[i].lightened(0.08), 0.0, out.roughness[i], out.metallic[i])
	var changes := {}
	for p: Vector3i in _surface_band(out):
		var value := out.get_voxel(p)
		if value == 0 or not darker.has(value) or not _is_exposed(out, p):
			continue
		var n := _count_27(out, p)
		if n >= 17:
			changes[p] = darker[value]          # crease / under a layer
		elif rng.randf() < grain:
			changes[p] = darker[value] if rng.randf() < 0.5 else lighter[value]
	for p: Vector3i in changes:
		out.set_voxel(p, changes[p])

	# 4. Edge layer: voxels on an outer edge (two or more open faces) catch light,
	#    which makes stacked shapes read as sculpted layers.
	var edges := {}
	var edge_boost := 0.25 if texture == "plate" else 0.1
	var edge_tone := {}
	for p: Vector3i in _surface_band(out):
		var value := out.get_voxel(p)
		if value == 0 or out.emission[value] > 0.0:
			continue
		var open := 0
		for d in _NEIGHBOURS_6:
			if not out.is_solid(p + d):
				open += 1
		if open >= 2:
			if not edge_tone.has(value):
				edge_tone[value] = out.add_material(out.colors[value].lightened(edge_boost), 0.0, out.roughness[value], out.metallic[value])
			edges[p] = edge_tone[value]
	for p: Vector3i in edges:
		out.set_voxel(p, edges[p])

	# 5. Texture layer.
	if texture != "":
		_texture(out, texture, rng)
	return out


static func _texture(model: VoxelModel, texture: String, rng: RandomNumberGenerator) -> void:
	var grow := {}
	var carve: Array[Vector3i] = []
	for p: Vector3i in _surface_band(model):
		var value := model.get_voxel(p)
		if value == 0 or model.emission[value] > 0.0 or not _is_exposed(model, p):
			continue
		match texture:
			"fur", "feather":
				if rng.randf() > 0.22:
					continue
				var out_dir := Vector3.ZERO
				for d in _NEIGHBOURS_6:
					if not model.is_solid(p + d):
						out_dir += Vector3(d)
				if out_dir == Vector3.ZERO:
					continue
				var dir := out_dir.normalized()
				dir += Vector3.DOWN * 0.8 if texture == "fur" else Vector3.BACK * -0.9
				dir = dir.normalized()
				var length := rng.randi_range(1, 3)
				for i in range(1, length + 1):
					var q := Vector3i((Vector3(p) + dir * i).round())
					if model.has_point(q) and not model.is_solid(q):
						grow[q] = value
			"ash":
				var r := rng.randf()
				if r < 0.08:
					carve.append(p)
				elif r < 0.14:
					var d: Vector3i = _NEIGHBOURS_6[rng.randi_range(0, 5)]
					if model.has_point(p + d) and not model.is_solid(p + d):
						grow[p + d] = value
	for p in carve:
		model.set_voxel(p, 0)
	for p: Vector3i in grow:
		model.set_voxel(p, grow[p])


static func _smooth(model: VoxelModel, band: Array[Vector3i]) -> void:
	var remove: Array[Vector3i] = []
	var fill := {}
	for p in band:
		var n := _count_27(model, p)
		var value := model.get_voxel(p)
		if value != 0:
			if n <= 10 and model.emission[value] <= 0.0:
				remove.append(p)
		elif n >= 17:
			fill[p] = _majority(model, p)
	for p in remove:
		model.set_voxel(p, 0)
	for p: Vector3i in fill:
		model.set_voxel(p, fill[p])


## Every voxel position (solid or empty) touching the boundary between solid and air.
static func _surface_band(model: VoxelModel) -> Array[Vector3i]:
	var size := model.size
	var seen := {}
	var band: Array[Vector3i] = []
	for z in size.z:
		for y in size.y:
			for x in size.x:
				if model.voxels[x + size.x * (y + size.y * z)] == 0:
					continue
				var p := Vector3i(x, y, z)
				if not _is_exposed(model, p):
					continue
				for dz in range(-1, 2):
					for dy in range(-1, 2):
						for dx in range(-1, 2):
							var q := p + Vector3i(dx, dy, dz)
							if model.has_point(q) and not seen.has(q):
								seen[q] = true
								band.append(q)
	return band


static func _is_exposed(model: VoxelModel, p: Vector3i) -> bool:
	for d in _NEIGHBOURS_6:
		if not model.is_solid(p + d):
			return true
	return false


static func _count_27(model: VoxelModel, p: Vector3i) -> int:
	var n := 0
	for dz in range(-1, 2):
		for dy in range(-1, 2):
			for dx in range(-1, 2):
				if model.is_solid(p + Vector3i(dx, dy, dz)):
					n += 1
	return n


static func _majority(model: VoxelModel, p: Vector3i) -> int:
	var counts := {}
	var best := 0
	var best_count := 0
	for dz in range(-1, 2):
		for dy in range(-1, 2):
			for dx in range(-1, 2):
				var v := model.get_voxel(p + Vector3i(dx, dy, dz))
				if v != 0:
					counts[v] = counts.get(v, 0) + 1
					if counts[v] > best_count:
						best_count = counts[v]
						best = v
	return best
