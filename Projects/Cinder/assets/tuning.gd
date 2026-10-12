class_name Tuning
extends RefCounted
## Per-asset look settings in assets/tuning/<asset>.json.
##
## These are the only knobs the phone AI ("push" / "ask") is allowed to turn,
## so it can never break a recipe. Every value is clamped to a safe range.

const DIR := "res://assets/tuning/"

## name: [default, min, max]
const NUMBERS := {
	"scale": [1.0, 0.6, 1.6],       # overall size of the placed scene
	"glow": [1.0, 0.0, 3.0],        # multiplies every emissive voxel
	"brightness": [1.0, 0.6, 1.5],  # multiplies non-glowing colours
	"tint_strength": [0.0, 0.0, 0.5],
	"saturation": [1.0, 0.4, 1.6],
	"wear": [0.0, 0.0, 0.25],       # chance to chip surface voxels away
	"seed": [0, 0, 9999],           # 0 = the recipe's own seed
}
const DEFAULT_TINT := "#ff7a2a"


static func load_for(asset: String) -> Dictionary:
	var out := {"tint": DEFAULT_TINT, "notes": ""}
	for key: String in NUMBERS:
		out[key] = NUMBERS[key][0]
	var path := DIR + asset + ".json"
	if not FileAccess.file_exists(path):
		return out
	var data: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
	if not data is Dictionary:
		push_warning("Tuning file %s is not valid JSON; using defaults." % path)
		return out
	for key: String in NUMBERS:
		if data.has(key) and (data[key] is float or data[key] is int):
			out[key] = clampf(float(data[key]), NUMBERS[key][1], NUMBERS[key][2])
	if data.has("tint") and data.tint is String and Color.html_is_valid(data.tint):
		out.tint = data.tint
	if data.has("notes") and data.notes is String:
		out.notes = data.notes
	return out


## Applies colour, glow and wear settings to a freshly built model.
static func apply(model: VoxelModel, t: Dictionary, seed: int) -> void:
	var tint := Color(t.tint)
	for i in range(1, model.colors.size()):
		model.emission[i] *= t.glow
		if model.emission[i] > 0.0:
			continue
		var c := model.colors[i]
		var grey := c.get_luminance()
		c = Color(grey, grey, grey).lerp(c, t.saturation)
		c = c.lerp(tint, t.tint_strength) * t.brightness
		c.a = 1.0
		model.colors[i] = c.clamp()
	if t.wear > 0.0:
		var b := VoxelBuilder.new(Vector3i.ONE, seed)
		b.model = model
		b.erode(t.wear, 2)
