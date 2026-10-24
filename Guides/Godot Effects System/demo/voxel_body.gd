class_name VoxelBody
extends RefCounted
## Builds simple voxel characters out of boxes, in the Cinderdeep palette.


## Add a box to [param parent] and return it.
static func box(parent: Node3D, size: Vector3, position: Vector3, color: Color, glow: float = 0.0) -> MeshInstance3D:
	var mesh := BoxMesh.new()
	mesh.size = size
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = 0.9
	if glow > 0.0:
		material.emission_enabled = true
		material.emission = color
		material.emission_energy_multiplier = glow
	mesh.material = material
	var instance := MeshInstance3D.new()
	instance.mesh = mesh
	instance.position = position
	parent.add_child(instance)
	return instance
