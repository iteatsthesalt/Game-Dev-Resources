@tool
class_name CharacterDesign
extends RefCounted
## The character design format that people and AIs write (JSON).
##
## A design is data, not code: `sanitize` fills in defaults, clamps every number,
## drops unknown words and reports what it changed, so any design either builds
## or is rejected with a readable reason.

const GRID := 64

const HEADS := ["bare", "helm", "hood", "wizard", "mask", "horns", "cowl", "skullhood", "crown"]
const HAIR := ["none", "short", "long", "braids", "mohawk", "topknot"]
const WEAPONS := ["none", "sword", "greatsword", "axe", "mace", "spear", "scythe", "bow", "staff", "firestaff",
		"stormrod", "daggers", "tome"]
const OFFHANDS := ["none", "shield", "dagger", "tome", "orb", "lantern"]
const ARMOR := ["plate", "leather", "robe", "cloth", "bare"]
const TEXTURES := ["", "plate", "fur", "ash"]
const FX := ["fire", "frost", "storm", "poison", "shadow", "holy", "blood", "arcane"]
const FEATURES := {
	"pauldrons": "armoured shoulder caps",
	"cape": "a cape down the back",
	"tabard": "a cloth panel hanging at the front",
	"belt": "a belt with a buckle",
	"pouches": "small pouches on the belt",
	"quiver": "a quiver of arrows on the back",
	"scarf": "a wrapped scarf at the neck",
	"fur_collar": "a fur collar around the shoulders",
	"beard": "a beard",
	"bracers": "bracers on the forearms",
	"greaves": "armoured shins",
	"spikes": "spikes on the shoulders and back",
	"skull_charms": "little skulls hanging from the belt",
	"runes": "glowing runes on the chest",
	"ember_cracks": "glowing cracks in the skin or armour",
	"glow_eyes": "glowing eyes",
	"gem": "a glowing gem on the chest or brow",
	"chain": "a chain across the chest",
	"sash": "a sash across the body",
	"tattoos": "painted markings on bare skin",
	"plume": "a plume or crest on the head",
	"kneepads": "armoured knees",
}
const COLOR_KEYS := ["skin", "hair", "main", "dark", "trim", "cloth", "metal", "eye", "glow"]
const DEFAULT_COLORS := {
	"skin": "#e8b48c", "hair": "#6b4428", "main": "#8fa3b8", "dark": "#55677c", "trim": "#2f5fa8",
	"cloth": "#2f5fa8", "metal": "#b3b0b4", "eye": "#1a1214", "glow": "#ff9a3c",
}
const BUILD_LIMITS := {
	"height": [0.75, 0.95, 0.88], "bulk": [0.7, 1.5, 1.0], "head": [0.8, 1.4, 1.0],
	"arms": [0.85, 1.15, 1.0], "legs": [0.85, 1.15, 1.0],
}


## Returns {"design": Dictionary, "notes": PackedStringArray, "error": String}.
static func sanitize(raw: Variant) -> Dictionary:
	var notes := PackedStringArray()
	if raw is String:
		var parsed: Variant = JSON.parse_string(raw)
		if parsed == null:
			return {"design": {}, "notes": notes, "error": "The design is not valid JSON."}
		raw = parsed
	if not raw is Dictionary:
		return {"design": {}, "notes": notes, "error": "The design must be a JSON object."}
	var src: Dictionary = raw
	var d := {}

	d.name = str(src.get("name", "")).strip_edges().substr(0, 40)
	if d.name == "":
		return {"design": {}, "notes": notes, "error": "The design needs a name."}
	d.id = make_id(str(src.get("id", d.name)))
	d.blurb = str(src.get("blurb", "")).strip_edges().substr(0, 200)
	d.seed = clampi(int(src.get("seed", hash(d.id) % 99999)), 1, 99999)

	var build_src: Dictionary = src.get("build", {}) if src.get("build") is Dictionary else {}
	d.build = {}
	for key: String in BUILD_LIMITS:
		var lim: Array = BUILD_LIMITS[key]
		var value := float(build_src.get(key, lim[2]))
		var clamped := clampf(value, lim[0], lim[1])
		if not is_equal_approx(value, clamped):
			notes.append("build.%s %.2f -> %.2f" % [key, value, clamped])
		d.build[key] = clamped

	var colors_src: Dictionary = src.get("colors", {}) if src.get("colors") is Dictionary else {}
	d.colors = {}
	for key: String in COLOR_KEYS:
		var text := str(colors_src.get(key, DEFAULT_COLORS[key]))
		if not Color.html_is_valid(text):
			notes.append("colors.%s '%s' is not a colour; using %s" % [key, text, DEFAULT_COLORS[key]])
			text = DEFAULT_COLORS[key]
		d.colors[key] = "#" + Color.html(text).to_html(false)

	d.head = _pick(src, "head", HEADS, "bare", notes)
	d.hair = _pick(src, "hair", HAIR, "short", notes)
	d.weapon = _pick(src, "weapon", WEAPONS, "sword", notes)
	d.offhand = _pick(src, "offhand", OFFHANDS, "none", notes)
	d.armor = _pick(src, "armor", ARMOR, "leather", notes)
	d.texture = _pick(src, "texture", TEXTURES, "", notes)
	d.fx = _pick(src, "fx", FX, "fire", notes)
	d.glow = clampf(float(src.get("glow", 1.4)), 0.0, 2.5)

	d.features = PackedStringArray()
	var feats: Variant = src.get("features", [])
	if feats is Array or feats is PackedStringArray:
		for f in feats:
			var word := str(f).strip_edges().to_lower().replace(" ", "_")
			if FEATURES.has(word):
				if word not in d.features:
					d.features.append(word)
			else:
				notes.append("unknown feature '%s' dropped" % word)
	if d.features.size() > 10:
		d.features = d.features.slice(0, 10)
		notes.append("kept the first 10 features")
	return {"design": d, "notes": notes, "error": ""}


static func make_id(text: String) -> String:
	var out := ""
	for ch in text.to_lower().strip_edges():
		if (ch >= "a" and ch <= "z") or (ch >= "0" and ch <= "9"):
			out += ch
		elif out != "" and not out.ends_with("_"):
			out += "_"
	out = out.trim_suffix("_").substr(0, 32)
	return out if out != "" else "character"


static func _pick(src: Dictionary, key: String, allowed: Array, fallback: String, notes: PackedStringArray) -> String:
	var value := str(src.get(key, fallback)).strip_edges().to_lower()
	if value in allowed:
		return value
	notes.append("%s '%s' is not one of %s; using '%s'" % [key, value, ", ".join(allowed), fallback])
	return fallback


## Human/AI-readable description of the format, used in the AI prompt and docs.
static func format_help() -> String:
	var feats := PackedStringArray()
	for k: String in FEATURES:
		feats.append("%s (%s)" % [k, FEATURES[k]])
	return "\n".join([
		"name: short name. blurb: one sentence. seed: 1-99999.",
		"build: height 0.75-0.95, bulk 0.7-1.5, head 0.8-1.4, arms 0.85-1.15, legs 0.85-1.15.",
		"colors (hex like #aa3322): " + ", ".join(COLOR_KEYS) + ". glow is used for glowing parts.",
		"head: " + ", ".join(HEADS),
		"hair: " + ", ".join(HAIR),
		"weapon: " + ", ".join(WEAPONS),
		"offhand: " + ", ".join(OFFHANDS),
		"armor: " + ", ".join(ARMOR),
		"texture: \"\", plate, fur, ash",
		"fx: " + ", ".join(FX) + ". glow: 0-2.5 brightness.",
		"features (up to 10): " + ", ".join(feats),
	])
