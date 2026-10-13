@tool
class_name VoxelRound
extends RefCounted
## Draws the round voxels of a VoxelModel (materials with round = 1) as small
## spheres in one MultiMesh. VoxelMesher draws everything else as cubes.
##
## Scenes store the sphere data on a RoundVoxels node (round_voxels.gd), which
## rebuilds the MultiMesh when loaded: MultiMesh buffers aren't saved by a
## headless bake.

const SHADER := preload("round_voxel.gdshader")
## Sphere radius in voxels; a little over 0.5 so neighbouring beads touch.
const RADIUS := 0.6


## Visible round voxels as {positions, colors, custom}; same `pivot` as
## VoxelMesher.build, so spheres line up with the cube mesh.
static func collect(model: VoxelModel, voxel_size := VoxelMesher.DEFAULT_VOXEL_SIZE, pivot := Vector3(0.5, 0.0, 0.5)) -> Dictionary:
	var offset := VoxelMesher.pivot_offset(model, pivot)
	var positions := PackedVector3Array()
	var colors := PackedColorArray()
	var custom := PackedColorArray()
	for z in model.size.z:
		for y in model.size.y:
			for x in model.size.x:
				var p := Vector3i(x, y, z)
				var value := model.voxels[model.index_of(p)]
				if not model.is_round_value(value) or not _visible(model, p):
					continue
				positions.append((Vector3(p) + Vector3(0.5, 0.5, 0.5) - offset) * voxel_size)
				colors.append(model.colors[value].srgb_to_linear())
				var seed := fposmod(sin(float(p.x * 73 + p.y * 151 + p.z * 37)) * 43758.5453, 1.0)
				custom.append(Color(model.emission[value], model.roughness[value], model.metallic[value], seed))
	return {"positions": positions, "colors": colors, "custom": custom}


## Builds the sphere MultiMesh; null when there are no visible round voxels.
static func build(model: VoxelModel, voxel_size := VoxelMesher.DEFAULT_VOXEL_SIZE, pivot := Vector3(0.5, 0.0, 0.5)) -> MultiMesh:
	var data := collect(model, voxel_size, pivot)
	return make(data.positions, data.colors, data.custom, RADIUS * voxel_size)


static func make(positions: PackedVector3Array, colors: PackedColorArray, custom: PackedColorArray, radius: float) -> MultiMesh:
	if positions.is_empty():
		return null
	var sphere := SphereMesh.new()
	sphere.radius = radius
	sphere.height = radius * 2.0
	sphere.radial_segments = 10
	sphere.rings = 5
	var material := ShaderMaterial.new()
	material.shader = SHADER
	sphere.material = material

	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	mm.use_custom_data = true
	mm.mesh = sphere
	mm.instance_count = positions.size()
	for i in positions.size():
		mm.set_instance_transform(i, Transform3D(Basis(), positions[i]))
		mm.set_instance_color(i, colors[i])
		mm.set_instance_custom_data(i, custom[i])
	return mm


## Hidden when all six neighbours are filled (it would be buried).
static func _visible(model: VoxelModel, p: Vector3i) -> bool:
	for dir: Vector3i in [Vector3i.UP, Vector3i.DOWN, Vector3i.LEFT, Vector3i.RIGHT, Vector3i.FORWARD, Vector3i.BACK]:
		if not model.is_solid(p + dir):
			return true
	return false
