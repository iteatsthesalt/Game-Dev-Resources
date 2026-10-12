extends OmniLight3D
## Soft firelight flicker for lights attached to glowing voxel props.

@export_range(0.0, 1.0) var flicker := 0.25
@export var speed := 7.0

var _base_energy := 0.0
var _time := 0.0


func _ready() -> void:
	_base_energy = light_energy
	_time = randf() * 100.0


func _process(delta: float) -> void:
	_time += delta * speed
	var wave := 0.5 * sin(_time) + 0.3 * sin(_time * 2.3 + 1.0) + 0.2 * sin(_time * 5.1 + 2.0)
	light_energy = _base_energy * (1.0 - flicker * (0.5 - 0.5 * wave))
