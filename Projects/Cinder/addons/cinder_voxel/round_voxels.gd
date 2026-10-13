@tool
extends MultiMeshInstance3D
## Round voxels of a baked asset (see VoxelRound). Rebuilds its spheres on load.

@export var radius := 0.01875
@export var positions := PackedVector3Array()
@export var colors := PackedColorArray()
@export var custom := PackedColorArray()


func _ready() -> void:
	multimesh = VoxelRound.make(positions, colors, custom, radius)
