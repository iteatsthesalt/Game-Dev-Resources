@icon("res://addons/effects_system/icons/reaction.svg")
class_name Reaction
extends Resource
## What happens when two strains meet: a cell of one tries to divide (or is seeded)
## into a voxel the other occupies. Fire and spores explode, fire and water make
## steam, frost freezes water, rival networks wound each other at the border.
##
## Add reactions to [member CellField.reactions]. Each side is a strain or a tag,
## and the order of the two sides doesn't matter.

@export var strain_a: Strain
## Matches any strain with this tag when [member strain_a] is empty, so one
## reaction covers [code]fire[/code] against every kind of blight.
@export var tag_a: StringName
@export var strain_b: Strain
@export var tag_b: StringName
## Chance per contact, so borders grind instead of resolving instantly.
@export_range(0.0, 1.0, 0.01) var chance: float = 1.0

@export_group("Wounds")
@export_range(0, 20, 1) var wound_a: int = 0
@export_range(0, 20, 1) var wound_b: int = 0
## Energy each wound also burns.
@export_range(0.0, 100.0, 0.1, "or_greater") var wound_energy: float = 2.0

@export_group("Product")
## Both cells are consumed and this strain takes the contested voxel.
@export var product: Strain
## Share of the two cells' energy the product keeps. The rest is released as heat.
@export_range(0.0, 1.0, 0.01) var efficiency: float = 0.5

@export_group("Burst")
## Applied to hosts within [member burst_radius] metres: an explosion, a chill wave.
@export var burst_effect: Effect
@export_range(0.0, 20.0, 0.05, "or_greater") var burst_radius: float = 0.0
## Light and shockwave at the contested voxel (transparent for none). Repeats are
## throttled per reaction.
@export var burst_color: Color = Color(0, 0, 0, 0)
@export_range(0.0, 1.0, 0.01) var shake: float = 0.0


## True if this reaction is between [param a] and [param b], in either order.
func joins(a: Strain, b: Strain) -> bool:
	return (matches_a(a) and matches_b(b)) or (matches_a(b) and matches_b(a))


func matches_a(strain: Strain) -> bool:
	return strain == strain_a if strain_a != null else tag_a != &"" and strain.has_tag(tag_a)


func matches_b(strain: Strain) -> bool:
	return strain == strain_b if strain_b != null else tag_b != &"" and strain.has_tag(tag_b)
