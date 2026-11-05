@icon("res://addons/effects_system/icons/strain.svg")
class_name Strain
extends Resource
## A living effect: fire, frost, spores, a mycelium network. Its cells live in the
## voxels of a [CellField] and follow the cellular life cycle:[br]
## [b]Growing[/b] seeds ripen, [b]mitosis[/b] splits a rich cell into a
## neighbouring voxel, [b]energy[/b] runs out and the cell goes dormant,
## [b]wounds[/b] heal or end in [b]necrosis[/b] (leaving [member residue]), and each
## colony is [b]judged[/b] now and then: it can evolve, grow old, or be severed
## from its root.
##
## Cells that touch an entity with a [CellHost] infect it with
## [member infection_effect], handing over some of their energy, which the host
## carries, sheds as it moves, and returns to the world when it dies.

enum Shape {
	CUBE,
	SPHERE,
	## A thin glowing tile, for things that creep along the ground.
	SLAB,
}

@export var id: StringName
@export var display_name: String
## Hierarchical tags, used by [member Substrate.blocks_tags] and by your own code.
@export var tags: Array[StringName] = []

@export_group("Energy")
## Energy of a freshly seeded cell.
@export_range(0.0, 100.0, 0.1, "or_greater") var seed_energy: float = 10.0
## Anything above this radiates away.
@export_range(0.1, 200.0, 0.1, "or_greater") var max_energy: float = 20.0
## Energy burned per second just staying alive.
@export_range(0.0, 50.0, 0.01, "or_greater") var metabolism: float = 1.0
## The substrate nutrient this strain eats. Empty means it never feeds.
@export var feeds_on: StringName
## Most energy per second a cell can draw from its voxel.
@export_range(0.0, 50.0, 0.01, "or_greater") var feed_rate: float = 3.0
## Below this a cell goes dormant: it stops dividing and burns energy slowly.
@export_range(0.0, 100.0, 0.1, "or_greater") var rest_energy: float = 2.0
## A dormant cell wakes when it climbs back above this.
@export_range(0.0, 100.0, 0.1, "or_greater") var wake_energy: float = 4.0
## Metabolism multiplier while dormant.
@export_range(0.0, 1.0, 0.01) var dormant_metabolism: float = 0.25

@export_group("Growth")
## Seconds before a new cell can divide or infect.
@export_range(0.0, 30.0, 0.05, "or_greater") var mature_time: float = 0.5
## A mature cell with at least this much energy divides.
@export_range(0.1, 200.0, 0.1, "or_greater") var split_energy: float = 12.0
## Energy lost to each division.
@export_range(0.0, 50.0, 0.05, "or_greater") var division_cost: float = 1.0
## How strongly cells divide upward, sideways and downward. Fire rises, water falls.
@export_range(0.0, 10.0, 0.05) var spread_up: float = 1.0
@export_range(0.0, 10.0, 0.05) var spread_side: float = 1.0
@export_range(0.0, 10.0, 0.05) var spread_down: float = 1.0
## How much the field's [member CellField.wind] steers division (0..1).
@export_range(0.0, 1.0, 0.01) var wind_factor: float = 0.0
## A colony stops dividing at this many cells.
@export_range(1, 100000, 1, "or_greater") var max_colony_cells: int = 600

@export_group("Wounds")
## Wounds a cell survives. Reaching this is necrosis.
@export_range(1, 20, 1) var max_wounds: int = 3
## Seconds to heal one wound.
@export_range(0.0, 60.0, 0.05, "or_greater") var heal_time: float = 2.0
## Energy spent healing one wound.
@export_range(0.0, 50.0, 0.05, "or_greater") var heal_cost: float = 1.0

@export_group("Hosts")
## Applied to entities whose [CellHost] touches a mature cell. Null means harmless.
@export var infection_effect: Effect
## Seconds between infections of the same host by this strain.
@export_range(0.05, 30.0, 0.05, "or_greater") var infection_interval: float = 0.5
## Energy a cell hands to the host it infects (never more than half its own).
@export_range(0.0, 100.0, 0.1, "or_greater") var infection_cost: float = 2.0
## Most energy a host can carry for this strain.
@export_range(0.0, 500.0, 0.5, "or_greater") var host_capacity: float = 20.0
## Energy of each cell a carrier sheds as it moves. 0 means hosts never shed.
@export_range(0.0, 100.0, 0.1, "or_greater") var shed_energy: float = 4.0
## Seconds between sheds.
@export_range(0.05, 30.0, 0.05, "or_greater") var shed_interval: float = 0.6

@export_group("Colony")
## Energy per second the root cell generates. This is the only way, besides
## feeding and seeding, that energy enters the world.
@export_range(0.0, 200.0, 0.1, "or_greater") var root_regen: float = 0.0
## Energy per second the root pumps into every cell still connected to it.
@export_range(0.0, 50.0, 0.01, "or_greater") var supply_rate: float = 0.0
## Seconds between judgements.
@export_range(0.1, 60.0, 0.1, "or_greater") var judge_interval: float = 2.0
## Colony age in seconds after which it stops dividing and fades. 0 = never.
@export_range(0.0, 3600.0, 0.5, "or_greater") var lifespan: float = 0.0
## The judge turns the colony into this strain once it reaches [member evolve_at_cells].
@export var evolve_into: Strain
@export_range(0, 100000, 1, "or_greater") var evolve_at_cells: int = 0

@export_group("Residue")
## What a voxel becomes when a cell dies after eating from it (fire leaves ash),
## unless the voxel's [member Substrate.residues] says otherwise.
@export var residue: Substrate

@export_group("Look")
@export var shape: Shape = Shape.CUBE
## Colour at low energy, and at full energy.
@export var color: Color = Color(0.6, 0.6, 0.6)
@export var hot_color: Color = Color(1.0, 1.0, 1.0)
@export_range(0.0, 16.0, 0.05) var emission: float = 1.5
## Size relative to a voxel at full maturity. Slightly over 1 wraps the voxel.
@export_range(0.05, 1.5, 0.01) var cell_scale: float = 1.0
## Shader motion: flicker (fire), rise (vertical stretch), bob (floating spores).
@export_range(0.0, 1.0, 0.01) var flicker: float = 0.0
@export_range(0.0, 1.0, 0.01) var rise: float = 0.0
@export_range(0.0, 1.0, 0.01) var bob: float = 0.0
## Lights placed on the biggest colonies, brightness growing with their size.
@export var light_color: Color = Color.BLACK
@export_range(0.0, 16.0, 0.05) var light_energy: float = 0.0
@export_range(0, 16, 1) var max_lights: int = 0
## Looping particles (embers, spores) kept on random mature cells.
@export var particles: PackedScene
@export_range(0, 64, 1) var max_emitters: int = 0
## Replaces the built-in cell shader.
@export var material_override: Material


func get_display_name() -> String:
	return display_name if display_name != "" else String(id).capitalize()


func has_tag(tag: StringName) -> bool:
	return EffectTags.any_matches(tags, tag)


# --- Hooks for scripted strains -------------------------------------------------

## A cell was born, by seeding, mitosis, shedding or a reaction.
func _born(_field: CellField, _cell: Vector3i) -> void:
	pass


## A cell died. [param cause] is [code]&"starved"[/code], [code]&"wounds"[/code],
## [code]&"reaction"[/code] or [code]&"cleared"[/code].
func _died(_field: CellField, _cell: Vector3i, _cause: StringName) -> void:
	pass


## Return a different verdict to override the built-in judgement (or [param verdict]
## to keep it). Called after evolution and ageing have been decided.
func _judge(_colony: CellColony, verdict: StringName) -> StringName:
	return verdict
