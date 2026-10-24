@icon("res://addons/effects_system/icons/substrate.svg")
class_name Substrate
extends Resource
## What a voxel of the world is made of, as far as living effects care: dry grass,
## deadwood, a pond, basalt. Strains feed on its nutrients, and some can't enter it.
##
## Paint substrates into a [CellField] with [SubstrateVolume] nodes,
## [method CellField.paint_box], or a [member CellField.substrate_provider] that
## reads your own voxel world.

enum Shape {
	## Not drawn (air, or geometry your game already draws).
	HIDDEN,
	## A full voxel.
	CUBE,
	## A thin tile on the floor of the voxel, for ground cover.
	SLAB,
}

@export var id: StringName
@export var display_name: String
## Food in each voxel, by nutrient name: [code]{&"fuel": 30.0, &"organic": 12.0}[/code].
## A strain eats the nutrient named in [member Strain.feeds_on] until it runs out.
@export var nutrients: Dictionary = {}
## Nothing can live here (rock, walls).
@export var solid: bool = false
## Strains carrying any of these tags can't enter. A pond blocks [code]fire[/code].
@export var blocks_tags: Array[StringName] = []
## What this voxel becomes when a strain dies after feeding on it, by strain id or
## tag: [code]{&"fire": ash}[/code]. Overrides [member Strain.residue]. Map to a
## HIDDEN substrate to make the voxel vanish, like leaves burning away.
@export var residues: Dictionary = {}

@export_group("Look")
## Used when [member CellField.render_substrates] is on.
@export var color: Color = Color(0.3, 0.3, 0.3)
@export var shape: Shape = Shape.CUBE
## Height of a SLAB as a fraction of the voxel.
@export_range(0.05, 1.0, 0.05) var slab_height: float = 0.25
## Glow for lava, embers in ash, crystals.
@export_range(0.0, 8.0, 0.05) var emission: float = 0.0


func get_nutrient(nutrient: StringName) -> float:
	return float(nutrients.get(nutrient, 0.0))


## The residue this substrate leaves when [param strain] has fed on it, or null.
func residue_for(strain: Strain) -> Substrate:
	if residues.has(strain.id):
		return residues[strain.id]
	for key in residues:
		if strain.has_tag(key):
			return residues[key]
	return null


## True if [param strain] may live in this substrate.
func admits(strain: Strain) -> bool:
	if solid:
		return false
	for blocked in blocks_tags:
		if strain.has_tag(blocked):
			return false
	return true
