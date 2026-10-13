@tool
class_name CharacterRig
extends Node3D
## Loads a character built by CharacterBuilder (characters/built/<id>/) as a
## tree of joint nodes, one per body part, ready for procedural animation.
## Joints keep their rest pose at rotation zero; `joints[name]` gives the node.

const BUILT_DIR := "res://characters/built/"
const BASE_VOXEL := 1.0 / 32.0

var rig := {}
var joints := {}
var rest := {}   # name -> rest position


static func list_built() -> PackedStringArray:
	var out := PackedStringArray()
	for dir in DirAccess.get_directories_at(BUILT_DIR):
		if FileAccess.file_exists(BUILT_DIR + dir + "/rig.json"):
			out.append(dir)
	return out


static func create(id: String) -> CharacterRig:
	var node := CharacterRig.new()
	node.name = "Rig"
	if not node.load_character(id):
		node.free()
		return null
	return node


func load_character(id: String) -> bool:
	var dir := BUILT_DIR + id + "/"
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(dir + "rig.json"))
	if not parsed is Dictionary:
		push_error("CharacterRig: no rig.json for '%s' (build it first)." % id)
		return false
	rig = parsed
	var detail := float(rig.get("detail", 2))
	var joint_pos := {}
	for part: String in rig.order:
		var info: Dictionary = rig.parts[part]
		var joint := Vector3(info.joint[0], info.joint[1], info.joint[2])
		joint_pos[part] = joint
		var node := Node3D.new()
		node.name = part
		var parent: String = info.parent
		if parent == "" or not joints.has(parent):
			node.position = (joint - Vector3(32, 0, 32)) * BASE_VOXEL
			add_child(node)
		else:
			node.position = (joint - (joint_pos[parent] as Vector3)) * BASE_VOXEL
			joints[parent].add_child(node)
		joints[part] = node
		rest[part] = node.position

		var model := VoxIO.load_file(dir + str(info.file))
		if model == null:
			continue
		var offset := Vector3(info.offset[0], info.offset[1], info.offset[2])
		var pivot := (offset + Vector3(0.25, 0.25, 0.25)) / Vector3(model.size)
		var mesh_instance := MeshInstance3D.new()
		mesh_instance.name = "Mesh"
		mesh_instance.mesh = VoxelMesher.build(model, VoxelMesher.DEFAULT_VOXEL_SIZE, pivot)
		mesh_instance.scale = Vector3.ONE / detail
		node.add_child(mesh_instance)
		var beads := VoxelRound.build(model, VoxelMesher.DEFAULT_VOXEL_SIZE, pivot)
		if beads:
			var bead_instance := MultiMeshInstance3D.new()
			bead_instance.name = "RoundVoxels"
			bead_instance.multimesh = beads
			bead_instance.scale = Vector3.ONE / detail
			node.add_child(bead_instance)
	return true


func glow_color() -> Color:
	return Color(str(rig.get("glow", "#ff9a3c")))


## Height of the character in metres.
func height() -> float:
	return float(rig.get("height", 56.0)) * BASE_VOXEL


func j(part: String) -> Node3D:
	return joints.get(part)


## Clears every joint back to the rest pose.
func reset_pose() -> void:
	for part: String in joints:
		var node: Node3D = joints[part]
		node.rotation = Vector3.ZERO
		node.position = rest[part]
		node.scale = Vector3.ONE
