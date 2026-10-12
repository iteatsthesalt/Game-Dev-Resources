@tool
class_name VoxelModel
extends Resource
## A dense voxel grid with a palette of up to 255 materials.
##
## Voxel value 0 is empty; values 1..255 index the palette arrays. Entry 0 of
## each palette array is padding so that voxel values and indices line up.
## Colours are stored in sRGB, the same as MagicaVoxel and colour pickers.

@export var size := Vector3i.ZERO
@export var voxels := PackedByteArray()
@export var colors := PackedColorArray([Color.TRANSPARENT])
## Emission multiplier per palette entry; 0 means the material does not glow.
@export var emission := PackedFloat32Array([0.0])
@export var roughness := PackedFloat32Array([1.0])
@export var metallic := PackedFloat32Array([0.0])


static func create(p_size: Vector3i) -> VoxelModel:
	var model := VoxelModel.new()
	model.size = p_size
	model.voxels.resize(p_size.x * p_size.y * p_size.z)
	return model


func has_point(p: Vector3i) -> bool:
	return p.x >= 0 and p.y >= 0 and p.z >= 0 and p.x < size.x and p.y < size.y and p.z < size.z


func index_of(p: Vector3i) -> int:
	return p.x + size.x * (p.y + size.y * p.z)


func get_voxel(p: Vector3i) -> int:
	if not has_point(p):
		return 0
	return voxels[index_of(p)]


func set_voxel(p: Vector3i, value: int) -> void:
	if has_point(p):
		voxels[index_of(p)] = value


func is_solid(p: Vector3i) -> bool:
	return has_point(p) and voxels[index_of(p)] != 0


## Adds a palette entry, or returns an identical existing one. Returns 1..255.
func add_material(color: Color, p_emission := 0.0, p_roughness := 0.9, p_metallic := 0.0) -> int:
	for i in range(1, colors.size()):
		if colors[i].is_equal_approx(color) and is_equal_approx(emission[i], p_emission) \
				and is_equal_approx(roughness[i], p_roughness) and is_equal_approx(metallic[i], p_metallic):
			return i
	if colors.size() > 255:
		push_error("VoxelModel palette is full (255 materials); reusing the last entry.")
		return 255
	colors.append(color)
	emission.append(p_emission)
	roughness.append(p_roughness)
	metallic.append(p_metallic)
	return colors.size() - 1


func count_solid() -> int:
	return voxels.size() - voxels.count(0)


## Emission-weighted centre (voxel units) and colour of the glowing voxels.
## Returns an empty Dictionary when nothing glows.
func emissive_summary() -> Dictionary:
	var total := 0.0
	var count := 0
	var center := Vector3.ZERO
	var color := Color(0, 0, 0, 0)
	for z in size.z:
		for y in size.y:
			for x in size.x:
				var value := voxels[x + size.x * (y + size.y * z)]
				if value == 0 or emission[value] <= 0.0:
					continue
				var e := emission[value]
				total += e
				count += 1
				center += (Vector3(x, y, z) + Vector3(0.5, 0.5, 0.5)) * e
				color += colors[value] * e
	if total <= 0.0:
		return {}
	color /= total
	color.a = 1.0
	return {"center": center / total, "color": color, "weight": total, "count": count}
