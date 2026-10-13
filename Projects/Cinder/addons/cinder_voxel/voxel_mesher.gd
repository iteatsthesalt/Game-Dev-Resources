@tool
class_name VoxelMesher
extends RefCounted
## Turns a VoxelModel into an ArrayMesh.
##
## - Greedy meshing: coplanar faces with the same material and the same corner
##   occlusion are merged into one quad, so flat areas cost two triangles.
## - Ambient occlusion is baked per vertex from the neighbouring voxels, and
##   quads are split along the diagonal that hides interpolation artefacts.
## - Per-vertex data feeds voxel.gdshader:
##     COLOR = linear albedo, UV = (emission, ao), UV2 = (roughness, metallic).

const DEFAULT_VOXEL_SIZE := 0.03125
const DEFAULT_MATERIAL := preload("voxel_material.tres")
## Brightness per corner occlusion level: 0 = fully occluded, 3 = open.
const AO_LEVELS: Array[float] = [0.38, 0.6, 0.8, 1.0]


## `pivot` is a fraction of the model size used as origin; (0.5, 0, 0.5) puts
## the origin at the bottom centre. The offset is snapped to whole voxels so the
## shader's voxel grid stays aligned with the geometry.
static func build(model: VoxelModel, voxel_size := DEFAULT_VOXEL_SIZE, pivot := Vector3(0.5, 0.0, 0.5), material: Material = null) -> ArrayMesh:
	var mesh := ArrayMesh.new()
	var size := model.size
	if model.voxels.size() != size.x * size.y * size.z:
		push_error("VoxelModel voxel data does not match its size %s." % size)
		return mesh

	var offset := (Vector3(size) * pivot).floor()
	var linear_colors := PackedColorArray()
	for c in model.colors:
		linear_colors.append(c.srgb_to_linear())

	var verts := PackedVector3Array()
	var normals := PackedVector3Array()
	var colors := PackedColorArray()
	var uvs := PackedVector2Array()
	var uv2s := PackedVector2Array()
	var indices := PackedInt32Array()

	for d in 3:
		var u := (d + 1) % 3
		var v := (d + 2) % 3
		var du := Vector3i.ZERO
		du[u] = 1
		var dv := Vector3i.ZERO
		dv[v] = 1
		var nu := size[u]
		var nv := size[v]
		var mask := PackedInt32Array()
		mask.resize(nu * nv)

		for s: int in [-1, 1]:
			var dn := Vector3i.ZERO
			dn[d] = s
			var normal := Vector3(dn)
			# Corner order is counter-clockwise seen from the face; Godot treats
			# clockwise triangles as front-facing, so triangles are emitted reversed.
			var ring: Array[int] = []
			ring.assign([0, 1, 2, 3] if s > 0 else [0, 3, 2, 1])

			for layer in size[d]:
				# 1. Mask of visible faces in this layer, keyed by material + AO.
				var p := Vector3i.ZERO
				p[d] = layer
				for j in nv:
					p[v] = j
					for i in nu:
						p[u] = i
						var key := 0
						var value := model.voxels[p.x + size.x * (p.y + size.y * p.z)]
						if value != 0 and not model.is_round_value(value):
							var q := p + dn
							if not model.is_cube(q):
								key = value \
									| (_ao(model, q, -du, -dv) << 8) \
									| (_ao(model, q, du, -dv) << 10) \
									| (_ao(model, q, du, dv) << 12) \
									| (_ao(model, q, -du, dv) << 14)
						mask[i + j * nu] = key

				# 2. Greedily merge equal mask cells into rectangles.
				for j in nv:
					var i := 0
					while i < nu:
						var key := mask[i + j * nu]
						if key == 0:
							i += 1
							continue
						var w := 1
						while i + w < nu and mask[i + w + j * nu] == key:
							w += 1
						var h := 1
						var grow := true
						while grow and j + h < nv:
							for k in w:
								if mask[i + k + (j + h) * nu] != key:
									grow = false
									break
							if grow:
								h += 1
						for hh in h:
							for k in w:
								mask[i + k + (j + hh) * nu] = 0

						var base := Vector3i.ZERO
						base[d] = layer + (1 if s > 0 else 0)
						base[u] = i
						base[v] = j
						var corners: Array[Vector3i] = [base, base + du * w, base + du * w + dv * h, base + dv * h]
						var ao: Array[int] = [(key >> 8) & 3, (key >> 10) & 3, (key >> 12) & 3, (key >> 14) & 3]
						var value := key & 0xFF
						var first := verts.size()
						for c in 4:
							verts.append((Vector3(corners[c]) - offset) * voxel_size)
							normals.append(normal)
							colors.append(linear_colors[value])
							uvs.append(Vector2(model.emission[value], AO_LEVELS[ao[c]]))
							uv2s.append(Vector2(model.roughness[value], model.metallic[value]))
						# Put the darker corners on the shared diagonal so occlusion
						# fades evenly across the quad instead of forming a hard wedge.
						if ao[ring[0]] + ao[ring[2]] > ao[ring[1]] + ao[ring[3]]:
							indices.append_array([first + ring[1], first + ring[3], first + ring[2],
									first + ring[1], first + ring[0], first + ring[3]])
						else:
							indices.append_array([first + ring[0], first + ring[2], first + ring[1],
									first + ring[0], first + ring[3], first + ring[2]])
						i += w

	if verts.is_empty():
		return mesh
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = verts
	arrays[Mesh.ARRAY_NORMAL] = normals
	arrays[Mesh.ARRAY_COLOR] = colors
	arrays[Mesh.ARRAY_TEX_UV] = uvs
	arrays[Mesh.ARRAY_TEX_UV2] = uv2s
	arrays[Mesh.ARRAY_INDEX] = indices
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)

	if material == null:
		material = DEFAULT_MATERIAL
		if not is_equal_approx(voxel_size, DEFAULT_VOXEL_SIZE):
			material = DEFAULT_MATERIAL.duplicate()
			material.set_shader_parameter("voxel_size", voxel_size)
	mesh.surface_set_material(0, material)
	return mesh


## Origin offset (in voxels) that `build` applies for a given pivot.
static func pivot_offset(model: VoxelModel, pivot: Vector3) -> Vector3:
	return (Vector3(model.size) * pivot).floor()


## Occlusion level (0..3, 3 = open) for the face corner that touches the empty
## voxel `q`, looking towards the two in-plane directions `a` and `b`.
static func _ao(model: VoxelModel, q: Vector3i, a: Vector3i, b: Vector3i) -> int:
	var side_a := model.is_solid(q + a)
	var side_b := model.is_solid(q + b)
	if side_a and side_b:
		return 0
	return 3 - (int(side_a) + int(side_b) + int(model.is_solid(q + a + b)))
