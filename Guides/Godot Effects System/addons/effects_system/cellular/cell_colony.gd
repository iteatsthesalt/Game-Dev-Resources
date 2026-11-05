class_name CellColony
extends RefCounted
## A connected family of cells descended from one seed. Colonies are created by
## [CellField]; read them, don't build them.

var id: int
var strain: Strain
## Voxel positions of the living cells (keys; values are unused).
var cells: Dictionary = {}
## The root cell pumps energy through the cells connected to it.
var has_root: bool = false
var root: Vector3i
var root_alive: bool = false
## Seconds since the colony was founded.
var age: float = 0.0
## Largest size reached.
var peak_size: int = 0
## Latest verdict: growing, stable, declining, severed, evolved or senescent.
var verdict: StringName = &"growing"
## Number of times the colony has evolved.
var generation: int = 0
## Past its [member Strain.lifespan]: no more division.
var senescent: bool = false
## Cells reachable from the root at the last judgement.
var connected_count: int = 0

var _judge_timer: float = 0.0
var _last_size: int = 0


func _init(p_id: int, p_strain: Strain) -> void:
	id = p_id
	strain = p_strain


func size() -> int:
	return cells.size()


func is_alive() -> bool:
	return not cells.is_empty()


## The root died: the network no longer gets supplied.
func is_severed() -> bool:
	return has_root and not root_alive
