@icon("res://addons/effects_system/icons/source.svg")
class_name CellSource
extends Node3D
## Keeps seeding a strain into a [CellField]: a lava vent spitting embers, a
## brazier, a spore pod, a spring of water. Optionally plants a root first, so a
## Blight Heart or Mycelium Node can anchor its whole network here.

@export var strain: Strain
## The field to seed. Defaults to the first [CellField] in the scene.
@export var field: CellField
## Seconds between seeds. 0 seeds only once.
@export_range(0.0, 600.0, 0.05, "or_greater", "suffix:s") var interval: float = 2.0
## Energy per seeded voxel (negative uses the strain's seed energy).
@export var energy: float = -1.0
## Seed every voxel within this many metres instead of just one.
@export_range(0.0, 20.0, 0.05, "or_greater", "suffix:m") var radius: float = 0.0
## With a radius, only seed voxels that have food for the strain.
@export var only_where_food: bool = true
## Plant a root cell here on the first seed.
@export var plant_root: bool = false
@export var enabled: bool = true

## The colony the root founded, if [member plant_root] is on.
var colony: CellColony

var _timer: float = 0.0
var _seeded_once: bool = false


func _physics_process(delta: float) -> void:
	if not enabled or strain == null:
		return
	var target := get_field()
	if target == null:
		return
	if not _seeded_once:
		_seeded_once = true
		emit_now()
		return
	if interval <= 0.0:
		return
	_timer += delta
	if _timer >= interval:
		_timer -= interval
		emit_now()


func get_field() -> CellField:
	if field != null:
		return field
	if is_inside_tree():
		return get_tree().get_first_node_in_group(CellField.GROUP) as CellField
	return null


## Seed now. Returns the number of voxels seeded.
func emit_now() -> int:
	var target := get_field()
	if target == null or strain == null:
		return 0
	if plant_root and (colony == null or not colony.root_alive):
		colony = target.seed(strain, global_position, energy, true)
		return 1 if colony != null else 0
	if radius > 0.0:
		return target.spray(strain, global_position, radius, energy, only_where_food)
	return 1 if target.seed(strain, global_position, energy) != null else 0
