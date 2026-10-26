@icon("res://addons/effects_system/icons/volume.svg")
class_name SubstrateVolume
extends Node3D
## Paints a [Substrate] into a [CellField] when the scene starts: a meadow of dry
## grass, a deadwood trunk, a pond. Later volumes paint over earlier ones.

enum Shape { BOX, SPHERE, CYLINDER }

@export var substrate: Substrate
## The field to paint. Defaults to the first [CellField] in the scene.
@export var field: CellField
@export var shape: Shape = Shape.BOX
## Size in metres. Centred on this node in x and z; y grows upward from it.
@export var size: Vector3 = Vector3(4.0, 0.5, 4.0)
## Chance (0..1) to skip each voxel, for ragged natural edges.
@export_range(0.0, 1.0, 0.01) var gaps: float = 0.0
@export var gap_seed: int = 1


func _ready() -> void:
	_paint.call_deferred()


## Paint now. Returns the number of voxels painted.
func paint(target: CellField = null) -> int:
	if target == null:
		target = field if field != null else get_tree().get_first_node_in_group(CellField.GROUP) as CellField
	if target == null or substrate == null:
		return 0
	var rng := RandomNumberGenerator.new()
	rng.seed = gap_seed
	var count := 0
	var half := Vector3(size.x * 0.5, 0.0, size.z * 0.5)
	var low := global_position - half
	var high := global_position + half + Vector3(0.0, size.y, 0.0)
	var a := target.world_to_cell(low + Vector3.ONE * target.cell_size * 0.5)
	var b := target.world_to_cell(high - Vector3.ONE * target.cell_size * 0.5)
	for x in range(a.x, b.x + 1):
		for y in range(a.y, b.y + 1):
			for z in range(a.z, b.z + 1):
				var cell := Vector3i(x, y, z)
				if not target.is_inside(cell) or not _contains(target.cell_to_world(cell)):
					continue
				if gaps > 0.0 and rng.randf() < gaps:
					continue
				target.paint_cell(cell, substrate)
				count += 1
	return count


func _paint() -> void:
	paint()


func _contains(point: Vector3) -> bool:
	var local := point - global_position
	match shape:
		Shape.SPHERE:
			var r := Vector3(size.x, size.y, size.z) * 0.5
			var centered := local - Vector3(0, r.y, 0)
			return (centered.x * centered.x) / (r.x * r.x) + (centered.y * centered.y) / (r.y * r.y) \
				+ (centered.z * centered.z) / (r.z * r.z) <= 1.0
		Shape.CYLINDER:
			var rx := size.x * 0.5
			var rz := size.z * 0.5
			return (local.x * local.x) / (rx * rx) + (local.z * local.z) / (rz * rz) <= 1.0 \
				and local.y >= 0.0 and local.y <= size.y
	return absf(local.x) <= size.x * 0.5 and absf(local.z) <= size.z * 0.5 and local.y >= 0.0 and local.y <= size.y
