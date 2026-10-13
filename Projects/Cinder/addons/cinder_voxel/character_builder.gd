@tool
class_name CharacterBuilder
extends RefCounted
## Builds a playable voxel character from a CharacterDesign.
##
## The whole character is drawn into one 64x64x64 grid (faces +Z, feet at y=0)
## with every voxel tagged by body part. The grid is then split into one cropped
## VoxelModel per part, each refined with VoxelRefine, and written to
## characters/built/<id>/ as .vox files plus rig.json (joints and hierarchy),
## which CharacterRig turns into an animatable node tree.

const GRID := CharacterDesign.GRID
const DETAIL := 2
const OUT_DIR := "res://characters/built/"
## Part order = tag value - 1. Parents must come before children.
const PARTS := ["pelvis", "torso", "head", "arm_up_l", "arm_up_r", "arm_lo_l", "arm_lo_r",
		"leg_up_l", "leg_up_r", "leg_lo_l", "leg_lo_r", "weapon", "offhand", "cape"]
const PARENT := {
	"pelvis": "", "torso": "pelvis", "head": "torso", "arm_up_l": "torso", "arm_up_r": "torso",
	"arm_lo_l": "arm_up_l", "arm_lo_r": "arm_up_r", "leg_up_l": "pelvis", "leg_up_r": "pelvis",
	"leg_lo_l": "leg_up_l", "leg_lo_r": "leg_up_r", "weapon": "arm_lo_r", "offhand": "arm_lo_l", "cape": "torso",
}
const DIRS: Array[Vector3i] = [Vector3i.UP, Vector3i.DOWN, Vector3i.LEFT, Vector3i.RIGHT, Vector3i.FORWARD, Vector3i.BACK]

var d: Dictionary
var b: VoxelBuilder
var tags := PackedByteArray()
var cur := 1
var J := {}     # joint name -> Vector3 (grid units)
var R := {}     # ramp name -> PackedInt32Array
var L := {}     # layout numbers
var feats: PackedStringArray


static func build(design: Dictionary) -> Dictionary:
	var cb := CharacterBuilder.new()
	return cb._build(design)


func _build(design: Dictionary) -> Dictionary:
	d = design
	feats = PackedStringArray(d.features)
	b = VoxelBuilder.new(Vector3i(GRID, GRID, GRID), int(d.seed))
	tags.resize(GRID * GRID * GRID)
	_ramps()
	_layout()
	_legs()
	_pelvis()
	_torso()
	_arms()
	_head()
	_weapon()
	_offhand()
	if "cape" in feats:
		_cape()
	_finish()
	return _split()


#region Palette

func _shades(hex: String, spread := 1.0) -> Array:
	var c := Color(hex)
	return [c.darkened(0.42 * spread), c.darkened(0.22 * spread), c, c.lightened(0.14 * spread), c.lightened(0.28 * spread)]


func _ramps() -> void:
	var c: Dictionary = d.colors
	var plate: bool = d.armor == "plate"
	R.skin = b.ramp(_shades(c.skin, 0.8), 0.0, 0.75)
	R.hair = b.ramp(_shades(c.hair), 0.0, 0.8)
	R.main = b.ramp(_shades(c.main), 0.0, 0.42 if plate else 0.85, 0.35 if plate else 0.0)
	R.dark = b.ramp(_shades(c.dark), 0.0, 0.8)
	R.trim = b.ramp(_shades(c.trim, 0.8), 0.0, 0.5, 0.2 if plate else 0.0)
	R.cloth = b.ramp(_shades(c.cloth), 0.0, 0.9)
	R.metal = b.ramp(_shades(c.metal, 0.9), 0.0, 0.38, 0.4)
	R.wood = b.ramp(["#2e1e14", "#4a3220", "#6b4a2e", "#8a6440", "#a8805a"], 0.0, 0.85)
	R.bone = b.ramp(CinderPalette.BONE, 0.0, 0.7)
	R.eye = PackedInt32Array([b.mat(c.eye, 0.0, 0.3)])
	var g := Color(c.glow)
	var e: float = d.glow
	var glow_cols := [g.darkened(0.3), g, g.lightened(0.3), g.lightened(0.55)]
	var glow_em := [e * 0.6, e * 0.9, e * 1.25, e * 1.6]
	R.glow = b.ramp(glow_cols, glow_em, 0.5)
	R.bead = b.ramp(glow_cols, glow_em, 0.4, 0.0, true)
	# Eyes that are clearly bright glow by themselves.
	R.eye_glow = "glow_eyes" in feats or Color(c.eye).get_luminance() > 0.45


func _shaded_ramps() -> Array:
	return [R.skin, R.hair, R.main, R.dark, R.trim, R.cloth, R.metal, R.wood, R.bone]

#endregion

#region Drawing helpers

## Wraps a paint so drawn voxels are tagged with the current part. A paint
## (or Callable) returning -1 leaves the voxel and its tag untouched.
func _t(paint: Variant) -> Callable:
	var part := cur
	return func(p: Vector3i) -> int:
		var v: int = b.paint_at(paint, p)
		if v < 0:
			return b.get_v(p)
		tags[b.model.index_of(p)] = part if v != 0 else 0
		return v


func _pk(r: PackedInt32Array, t: float, jitter := 0.06) -> int:
	return b.pick(r, t, jitter)


## Painter: ramp position from noise around `base`, lit a little towards the top of [y0, y1].
func _paint(r: PackedInt32Array, base := 0.5, y0 := 0.0, y1 := 64.0, spread := 0.18) -> Callable:
	return func(p: Vector3i) -> int:
		var lift := clampf((p.y - y0) / maxf(y1 - y0, 1.0), 0.0, 1.0) * 0.25 - 0.12
		return _pk(r, base + lift + (b.n01(Vector3(p), 1.3) - 0.5) * 2.0 * spread)


func ell(c: Vector3, r: Vector3, paint: Variant, wobble := 0.0) -> void:
	b.ellipsoid(c, r, _t(paint), wobble)


func tube(a: Vector3, z: Vector3, ra: float, rb: float, paint: Variant, wobble := 0.0) -> void:
	b.tube(a, z, ra, rb, _t(paint), wobble)


func box(a: Vector3i, z: Vector3i, paint: Variant) -> void:
	b.box(a, z, _t(paint))


func dot(p: Vector3, paint: Variant) -> void:
	b.set_v(Vector3i(p.floor()), _t(paint))


## A flat strip along `dir` (blades, axe heads): width(s) across `across`, `thick` along X.
func strip(base: Vector3, dir: Vector3, across: Vector3, length: float, width: Callable, thick: float, paint: Callable) -> void:
	var s := 0.0
	while s <= length:
		var w: float = width.call(s / length)
		var k := -w
		while k <= w:
			var x := -thick
			while x <= thick:
				var p := base + dir * s + across * k + Vector3(x, 0, 0)
				var edge := absf(k) >= w - 0.75
				b.set_v(Vector3i(p.floor()), _t(paint.bind(s / length, edge)))
				x += 0.5
			k += 0.5
		s += 0.5


## Ellipse slices between two heights: radii(t) -> Vector2(rx, rz), t = 0 at y0 and 1 at y1.
func slices(cx: float, cz: float, y0: int, y1: int, radii: Callable, paint: Variant) -> void:
	for y in range(mini(y0, y1), maxi(y0, y1) + 1):
		var t := 0.0 if y1 == y0 else float(y - y0) / float(y1 - y0)
		var r: Vector2 = radii.call(t)
		for z in range(int(floor(cz - r.y - 1)), int(ceil(cz + r.y + 1))):
			for x in range(int(floor(cx - r.x - 1)), int(ceil(cx + r.x + 1))):
				var dx := (x + 0.5 - cx) / maxf(r.x, 0.1)
				var dz := (z + 0.5 - cz) / maxf(r.y, 0.1)
				if dx * dx + dz * dz <= 1.0:
					b.set_v(Vector3i(x, y, z), _t(paint))

#endregion

#region Layout

func _layout() -> void:
	var bd: Dictionary = d.build
	var bulk: float = bd.bulk
	var hs: float = bd.head
	var hat := 0.0
	match d.head:
		"wizard":
			hat = 12.0
		"horns", "crown":
			hat = 5.0
		"helm":
			hat = 4.0 if "plume" in feats else 2.0
	var H := minf(GRID * float(bd.height), GRID - 1.0 - hat)
	var hr := 0.1 * H * hs
	L.H = H
	L.bulk = bulk
	L.hr = hr
	L.head_y = H - hr * 1.1
	L.neck_y = L.head_y - hr * 1.0
	L.shoulder_y = L.neck_y - 2.0
	L.hip_y = clampf(0.46 * H * float(bd.legs), 0.36 * H, L.shoulder_y - 0.24 * H)
	L.waist_y = L.hip_y + (L.shoulder_y - L.hip_y) * 0.32
	L.knee_y = L.hip_y * 0.52
	L.rx = 0.12 * H * bulk
	L.rz = 0.075 * H * bulk
	L.sw = L.rx + 0.025 * H
	L.hw = maxf(2.5, 0.065 * H * bulk)
	var arms: float = bd.arms
	J.pelvis = Vector3(32, round(L.hip_y), 32)
	J.torso = Vector3(32, round(L.waist_y), 32)
	J.head = Vector3(32, round(L.neck_y), 32)
	J.cape = Vector3(32, round(L.shoulder_y), round(32 - L.rz))
	for side: int in [-1, 1]:
		var s := "l" if side > 0 else "r"
		var shoulder := Vector3(round(32 + side * L.sw), round(L.shoulder_y - 1), 32)
		var elbow := shoulder + Vector3(side, round(-0.18 * H * arms), 1)
		var wrist := elbow + Vector3(0, round(-0.03 * H), round(0.14 * H * arms))
		J["arm_up_" + s] = shoulder
		J["arm_lo_" + s] = elbow
		L["wrist_" + s] = wrist
		L["hand_" + s] = wrist + (wrist - elbow).normalized() * 1.8
		J["leg_up_" + s] = Vector3(round(32 + side * L.hw), round(L.hip_y), 32)
		J["leg_lo_" + s] = Vector3(round(32 + side * L.hw), round(L.knee_y), 32)
	L.weapon_hand = "l" if d.weapon == "bow" else "r"
	J.weapon = Vector3(L["wrist_" + L.weapon_hand]).round()
	J.offhand = Vector3(L.wrist_l).round()

#endregion

#region Body

func _cover(part: String) -> PackedInt32Array:
	## Ramp for clothing on a body region.
	match d.armor:
		"plate":
			return R.main if part != "legs" else R.dark
		"leather":
			return R.main if part == "torso" else R.dark
		"robe", "cloth":
			return R.cloth if part != "legs" else R.dark
	return R.dark if part == "legs" else R.skin


func _legs() -> void:
	var H: float = L.H
	var bulk: float = L.bulk
	for side: int in [-1, 1]:
		var s := "l" if side > 0 else "r"
		var hip: Vector3 = J["leg_up_" + s]
		var knee: Vector3 = J["leg_lo_" + s]
		var x := hip.x + 0.5
		var pants := _cover("legs")
		cur = _tag("leg_up_" + s)
		tube(Vector3(x, hip.y + 1, 32), Vector3(x, knee.y, 32.5), 0.058 * H * bulk, 0.044 * H * bulk, _paint(pants, 0.5, knee.y, hip.y))
		if d.armor == "plate" or "kneepads" in feats:
			ell(Vector3(x, knee.y + 0.5, 32.5 + 0.044 * H * bulk), Vector3(2.2, 2.0, 1.4), _paint(R.metal, 0.6))
		cur = _tag("leg_lo_" + s)
		var boot_top := 0.14 * H
		tube(Vector3(x, knee.y, 32.5), Vector3(x, 3, 32), 0.044 * H * bulk, 0.036 * H * bulk, _paint(pants, 0.45, 0, knee.y))
		tube(Vector3(x, 3, 32), Vector3(x, boot_top, 32.3), 0.042 * H * bulk + 0.4, 0.044 * H * bulk + 0.4, _paint(R.dark, 0.35, 0, boot_top))
		box(Vector3i(int(x) - 1, int(boot_top) - 1, 31), Vector3i(int(x) + 1, int(boot_top), 34), _paint(R.dark, 0.6))
		ell(Vector3(x, 2.2, 33.6), Vector3(0.04 * H * bulk + 0.8, 2.2, 4.4), _paint(R.dark, 0.3, 0, 4))
		box(Vector3i(int(x - 2.5), 0, 30), Vector3i(int(x + 2.5), 0, 37), R.dark[0])
		if "greaves" in feats or d.armor == "plate":
			var r := 0.044 * H * bulk + 0.7
			ell(Vector3(x, (knee.y + boot_top) * 0.5, 33.0), Vector3(r, (knee.y - boot_top) * 0.45, r * 0.8),
				func(p: Vector3i) -> int: return _pk(R.metal, 0.55) if p.z >= 32 else -1)


func _pelvis() -> void:
	var H: float = L.H
	cur = _tag("pelvis")
	var hy: float = L.hip_y
	var wy: float = L.waist_y
	ell(Vector3(32, hy + 1.5, 32), Vector3(L.hw + 0.05 * H * L.bulk + 0.6, 0.065 * H, L.rz * 0.95), _paint(_cover("legs"), 0.5))
	if d.armor in ["robe", "cloth"]:
		var hem := 3 if d.armor == "robe" else int(L.knee_y)
		var rx0: float = L.rx * 0.88
		var rz0: float = L.rz * 0.95
		slices(32, 32, int(wy), hem, func(t: float) -> Vector2:
			var grow := 1.0 + (1.0 - t) * 0.45
			return Vector2(rx0 * grow, rz0 * grow * 1.05),
			func(p: Vector3i) -> int:
				if p.y <= hem + 1:
					return _pk(R.trim, 0.6)
				var fold := 0.12 if (p.x + p.z) % 5 == 0 else 0.0
				return _pk(R.cloth, 0.45 - fold + (p.y - hem) / (wy - hem + 1.0) * 0.25))
	if "belt" in feats or d.armor in ["leather", "plate", "bare"]:
		ell(Vector3(32, wy - 0.5, 32), Vector3(L.rx * 0.9 + 0.7, 1.3, L.rz + 0.7), _paint(R.dark, 0.25, 0, 64, 0.05))
		box(Vector3i(31, int(wy) - 2, int(32 + L.rz + 0.5)), Vector3i(33, int(wy), int(32 + L.rz + 1.2)), _paint(R.trim, 0.8))
	if "tabard" in feats:
		var half := int(L.rx * 0.45)
		var top := int(wy)
		var bottom := int(L.knee_y + 2)
		var front := int(32 + L.rz + 0.6)
		box(Vector3i(32 - half, bottom, front), Vector3i(31 + half, top, front + 1), func(p: Vector3i) -> int:
			if absi(p.x - 32) >= half - 1 or p.y == bottom:
				return _pk(R.trim, 0.6)
			if absi(p.x - 32) + absi(p.y - (top + bottom) / 2) <= 2:
				return _pk(R.trim, 0.8)
			return _pk(R.cloth, 0.55))
	for side: int in [-1, 1]:
		var sx: float = 32 + side * (L.rx * 0.9)
		if "pouches" in feats:
			box(Vector3i(int(sx) - 1, int(wy) - 4, 32), Vector3i(int(sx) + 1, int(wy) - 1, 34), _paint(R.dark, 0.55))
		if "skull_charms" in feats:
			ell(Vector3(sx, wy - 4, 33.5), Vector3(1.4, 1.4, 1.4), _paint(R.bone, 0.7))
			dot(Vector3(sx - 0.5, wy - 4, 34.8), R.dark[0])
			tube(Vector3(sx, wy - 1, 33), Vector3(sx, wy - 3, 33.5), 0.5, 0.5, R.dark[1])


func _torso() -> void:
	var H: float = L.H
	cur = _tag("torso")
	var sy: float = L.shoulder_y
	var wy: float = L.waist_y
	var rx: float = L.rx
	var rz: float = L.rz
	var body := _cover("torso")
	var painter := func(p: Vector3i) -> int:
		var t := 0.4 + (p.y - wy) / maxf(sy - wy, 1.0) * 0.3 + (b.n01(Vector3(p), 1.2) - 0.5) * 0.25
		match d.armor:
			"plate":
				if p.y < (wy + sy) * 0.5 and int(p.y - wy) % 3 == 0:
					t -= 0.3
				if absi(p.x - 32) <= 0 and p.z > 32:
					t += 0.2
			"robe", "cloth":
				if (p.x + 64) % 4 == 0:
					t -= 0.15
			"bare":
				if (p.x == 32 and p.z > 32) or (p.y == int(sy - 0.12 * H) and p.z > 32 + rz * 0.6):
					t -= 0.35
		return _pk(body, t, 0.05)
	ell(Vector3(32, wy + 2.5, 32), Vector3(rx * 0.86, 3.5, rz * 0.9), painter)
	ell(Vector3(32, (wy + sy) * 0.5 + 1, 32), Vector3(rx, (sy - wy) * 0.5 + 1.0, rz), painter)
	ell(Vector3(32, sy - 2.0, 32), Vector3(rx * 1.04, 3.2, rz * 1.04), painter)
	# Neck and collar.
	tube(Vector3(32, sy - 1, 32), Vector3(32, L.neck_y + 1, 32), 0.052 * H, 0.048 * H, _paint(R.skin, 0.4))
	if d.armor != "bare":
		ell(Vector3(32, sy + 0.5, 32), Vector3(0.075 * H + 1, 1.3, 0.055 * H + 1), _paint(R.trim, 0.55))
	if d.armor == "robe":
		box(Vector3i(32, int(wy), int(32 + rz) - 1), Vector3i(32, int(sy), int(32 + rz) + 1),
			func(p: Vector3i) -> int: return _pk(R.trim, 0.6) if b.solid(p) else -1)
	if "tattoos" in feats and d.armor == "bare":
		b.recolor(func(p: Vector3i, v: int) -> int:
			if tags[b.model.index_of(p)] == cur and v in R.skin and b.on_surface(p) and (p.x + p.y * 2) % 7 == 0 and p.y > wy:
				return R.trim[1]
			return v)
	if "scarf" in feats:
		ell(Vector3(32, sy + 1, 32.5), Vector3(0.09 * H + 1.5, 2.2, 0.07 * H + 1.5), _paint(R.cloth, 0.6))
		tube(Vector3(30, sy, 32 + rz), Vector3(29, sy - 0.16 * H, 32 + rz + 1.5), 1.6, 1.2, _paint(R.cloth, 0.5))
		box(Vector3i(28, int(sy - 0.16 * H) - 1, int(32 + rz + 1)), Vector3i(30, int(sy - 0.16 * H), int(32 + rz + 2)), _paint(R.trim, 0.6))
	if "fur_collar" in feats:
		ell(Vector3(32, sy + 0.5, 32), Vector3(rx * 0.95, 2.6, rz * 1.15), _paint(R.hair, 0.55, 0, 64, 0.3), 0.35)
	if "chain" in feats:
		b.line(Vector3(32 - rx * 0.8, sy - 1, 32 + rz + 0.4), Vector3(32 + rx * 0.7, wy + 1, 32 + rz * 0.85 + 0.4), _t(R.metal[3]))
	if "sash" in feats:
		for i in 3:
			b.line(Vector3(32 + rx * 0.85, sy - 1 - i, 32 + rz * 0.9), Vector3(32 - rx * 0.8, wy + 1 - i, 32 + rz * 0.9), _t(R.trim[2 + i % 2]))
	if "runes" in feats:
		var cy := (wy + sy) * 0.5 + 1
		var fz := 32 + rz + 0.2
		for seg: Array in [[Vector3(-2, 3, 0), Vector3(2, 3, 0)], [Vector3(0, 4, 0), Vector3(0, -3, 0)],
				[Vector3(-2, -1, 0), Vector3(0, -3, 0)], [Vector3(2, -1, 0), Vector3(0, -3, 0)]]:
			b.line(Vector3(32, cy, fz) + seg[0], Vector3(32, cy, fz) + seg[1], _t(R.glow[2]))
	if "gem" in feats:
		ell(Vector3(32, sy - 0.1 * H, 32 + rz + 0.3), Vector3(1.4, 1.6, 1.2), R.bead[2])
		ell(Vector3(32, sy - 0.1 * H, 32 + rz - 0.6), Vector3(2.2, 2.4, 1.2), func(p: Vector3i) -> int: return _pk(R.trim, 0.7) if not b.solid(p) else -1)
	if "quiver" in feats:
		var qa := Vector3(32 + 4, wy, 32 - rz - 2)
		var qb := Vector3(32 - 3, sy + 0.08 * H, 32 - rz - 2.5)
		tube(qa, qb, 2.2, 2.4, _paint(R.dark, 0.5))
		tube(qa, qa + (qb - qa) * 0.15, 2.5, 2.5, _paint(R.trim, 0.55))
		for i in 4:
			var off := Vector3(-1 + i % 2 * 2, 0, -1 + i / 2 * 2) * 0.8
			tube(qb + off, qb + off + (qb - qa).normalized() * 3.5, 0.6, 0.4, R.wood[3])
			ell(qb + off + (qb - qa).normalized() * 4.5, Vector3(0.8, 1.6, 0.8), _paint(R.bone, 0.6))
	if "spikes" in feats:
		for i in 3:
			var y: float = sy - 2 - i * 0.07 * H
			tube(Vector3(32, y, 32 - rz + 1), Vector3(32, y + 1.5, 32 - rz - 3.5), 1.4, 0.0, _paint(R.metal, 0.6))


func _arms() -> void:
	var H: float = L.H
	var bulk: float = L.bulk
	var sleeve := _cover("arms")
	var robe: bool = d.armor in ["robe", "cloth"]
	for side: int in [-1, 1]:
		var s := "l" if side > 0 else "r"
		var sh: Vector3 = J["arm_up_" + s] + Vector3(0.5, 0.5, 0.5)
		var el: Vector3 = J["arm_lo_" + s] + Vector3(0.5, 0.5, 0.5)
		var wr: Vector3 = L["wrist_" + s] + Vector3(0.5, 0.5, 0.5)
		var hand: Vector3 = L["hand_" + s] + Vector3(0.5, 0.5, 0.5)
		cur = _tag("arm_up_" + s)
		ell(sh, Vector3.ONE * 0.058 * H * bulk, _paint(sleeve, 0.5))
		tube(sh, el, 0.052 * H * bulk, 0.043 * H * bulk, _paint(sleeve, 0.5, el.y, sh.y))
		if "pauldrons" in feats or d.armor == "plate":
			var pc := sh + Vector3(side * 0.8, 1.2, 0)
			var pr := Vector3(0.08 * H * bulk, 0.055 * H, 0.075 * H * bulk)
			ell(pc, pr, func(p: Vector3i) -> int:
				if p.y < pc.y - pr.y * 0.35:
					return _pk(R.trim, 0.6)
				return _pk(R.main if d.armor == "plate" else R.metal, 0.55 + (p.y - pc.y) / pr.y * 0.25))
			if "spikes" in feats:
				tube(pc + Vector3(0, pr.y * 0.6, 0), pc + Vector3(side * 2.5, pr.y + 3.5, 0), 1.3, 0.0, _paint(R.metal, 0.7))
		cur = _tag("arm_lo_" + s)
		var bare_fore: bool = d.armor == "bare" or d.armor == "leather"
		tube(el, wr, 0.043 * H * bulk, (0.06 * H if robe else 0.036 * H * bulk), _paint(R.skin if bare_fore and not robe else sleeve, 0.45))
		ell(el, Vector3.ONE * 0.045 * H * bulk, _paint(R.skin if bare_fore and not robe else sleeve, 0.45))
		if "bracers" in feats or d.armor == "plate":
			var dir := (wr - el).normalized()
			tube(wr - dir * 3.5, wr - dir * 0.5, 0.045 * H * bulk + 0.6, 0.042 * H * bulk + 0.6, _paint(R.metal if d.armor == "plate" else R.dark, 0.55))
		var glove: PackedInt32Array = R.main if d.armor == "plate" else R.skin
		ell(hand, Vector3(0.042 * H, 0.05 * H, 0.045 * H) * clampf(bulk, 0.9, 1.2), _paint(glove, 0.5))


func _head() -> void:
	var hr: float = L.hr
	cur = _tag("head")
	var c := Vector3(32, L.head_y, 32.5)
	var r := Vector3(hr, hr * 1.08, hr * 0.95)
	var face_z := c.z + r.z
	var eye_y := c.y - 0.05 * hr
	var head: String = d.head
	ell(c, r, _paint(R.skin, 0.55, c.y - r.y, c.y + r.y, 0.08))
	ell(c + Vector3(0, -hr * 0.55, hr * 0.15), Vector3(hr * 0.72, hr * 0.5, hr * 0.8), _paint(R.skin, 0.45))
	if head in ["bare", "wizard", "mask", "crown"]:
		for side: int in [-1, 1]:
			ell(c + Vector3(side * r.x, -0.05 * hr, -0.1 * hr), Vector3(0.9, 1.5, 1.1), _paint(R.skin, 0.4))
	# Face.
	var glow_eyes: bool = R.eye_glow
	for side: int in [-1, 1]:
		var ex := 32 + side * 0.38 * hr
		var ep := Vector3(ex, eye_y, face_z - 0.4)
		if glow_eyes:
			dot(ep, R.bead[3])
			dot(ep + Vector3(0, 1, 0), R.bead[2])
		else:
			dot(ep, R.eye[0])
			dot(ep + Vector3(0, 1, 0), R.eye[0])
			dot(ep + Vector3(side, 0, -0.3), R.bone[3])
		b.line(Vector3(ex - 1, eye_y + 2.2, face_z - 0.2), Vector3(ex + 1, eye_y + 2.0, face_z - 0.2), _t(R.hair[1]))
	dot(Vector3(32, eye_y - 1.5, face_z + 0.4), R.skin[1])
	dot(Vector3(32, eye_y - 1.5, face_z - 0.4), R.skin[1])
	b.line(Vector3(31, eye_y - 3.3, face_z - 0.6), Vector3(33, eye_y - 3.3, face_z - 0.6), _t(R.skin[0]))
	if "beard" in feats:
		ell(c + Vector3(0, -hr * 0.65, hr * 0.35), Vector3(hr * 0.75, hr * 0.6, hr * 0.7),
			func(p: Vector3i) -> int: return _pk(R.hair, 0.5, 0.12) if p.y < eye_y - 2.5 and p.z > c.z else -1, 0.25)
	_hair(c, r, eye_y)
	match head:
		"helm":
			var hc := c + Vector3(0, 0.5, -0.2)
			var hrr := r + Vector3(1.2, 1.2, 1.2)
			ell(hc, hrr, func(p: Vector3i) -> int:
				var front := p.z > c.z + r.z * 0.35
				if front and p.y < eye_y + 2 and p.y > c.y - r.y * 1.2 and absi(p.x - 32) < hr * 0.7 and absi(p.x - 32) >= 1:
					return -1
				if absi(p.y - int(eye_y + 2.5)) <= 0:
					return _pk(R.trim, 0.6)
				return _pk(R.main if d.armor == "plate" else R.metal, 0.45 + (p.y - c.y) / hrr.y * 0.3))
			if "plume" in feats:
				for i in 7:
					var a := float(i) / 6.0
					ell(c + Vector3(0, r.y + 1.5 + sin(a * PI) * 2.5, r.z * (0.8 - a * 1.9)), Vector3(1.2, 1.6, 1.2), _paint(R.cloth, 0.6))
		"hood", "cowl", "skullhood":
			var hc := c + Vector3(0, 0.6, -0.6)
			var hrr := r + Vector3(1.6, 1.8, 1.8)
			var deep: bool = head != "hood"
			var cloth: PackedInt32Array = R.cloth if head == "hood" else R.dark
			ell(hc, hrr, func(p: Vector3i) -> int:
				var open := p.z > c.z + r.z * (0.2 if deep else 0.45) and p.y < c.y + r.y * 0.45 and p.y > c.y - r.y * 0.95 and absf(p.x - 31.5) < hr * 0.82
				if open:
					return -1
				return _pk(cloth, 0.45 + (p.y - c.y) / hrr.y * 0.2, 0.08))
			tube(hc + Vector3(0, hrr.y * 0.4, -hrr.z * 0.6), hc + Vector3(0, hrr.y * 0.1, -hrr.z * 1.5), 2.2, 0.5, _paint(cloth, 0.4))
			ell(Vector3(32, L.shoulder_y + 1, 32), Vector3(L.rx * 0.95, 2.5, L.rz * 1.2), _paint(cloth, 0.45))
			if deep:
				ell(c + Vector3(0, 0, 0.3), r - Vector3(0.6, 0.6, 0.0), func(p: Vector3i) -> int:
					if p.z < face_z - 1.5 or not b.solid(p) or tags[b.model.index_of(p)] != cur:
						return -1
					var v := b.get_v(p)
					if v in R.bead or v in R.eye:
						return v
					if head == "skullhood":
						if p.y < eye_y - 2.5 and p.y > eye_y - 4.5 and (p.x % 2 == 0):
							return R.dark[0]
						return _pk(R.bone, 0.6)
					return R.dark[0])
				if head == "skullhood":
					for side: int in [-1, 1]:
						dot(Vector3(32 + side * 0.38 * hr - 1 * side, eye_y, face_z - 0.4), R.dark[0])
		"wizard":
			var by := c.y + r.y * 0.55
			slices(32, 32.5, int(by), int(by), func(_t2: float) -> Vector2: return Vector2(hr * 1.9, hr * 1.8), _paint(R.main, 0.5))
			slices(32, 32.5, int(by) + 1, int(by) + 2, func(_t2: float) -> Vector2: return Vector2(hr * 1.1, hr * 1.05), _paint(R.trim, 0.6))
			var base := Vector3(32, by + 3, 32.5)
			var mid := base + Vector3(0, 6, -1.2)
			var tip := mid + Vector3(0, 4.5, -3.5)
			tube(base, mid, hr * 1.05, hr * 0.55, _paint(R.main, 0.55))
			tube(mid, tip, hr * 0.55, 0.3, _paint(R.main, 0.6))
			ell(tip, Vector3.ONE * 1.2, R.bead[3])
		"mask":
			ell(c + Vector3(0, -hr * 0.35, 0.6), r * Vector3(1.04, 0.62, 1.0), func(p: Vector3i) -> int:
				return _pk(R.main, 0.5) if p.y < eye_y - 0.5 and p.z > c.z - 0.5 else -1)
			b.line(Vector3(32 - hr, eye_y - 1, face_z + 0.3), Vector3(32 + hr, eye_y - 1, face_z + 0.3), _t(R.trim[2]))
		"horns":
			ell(c + Vector3(0, 0.6, -0.2), r + Vector3(1, 1, 1), func(p: Vector3i) -> int:
				return _pk(R.metal, 0.5 + (p.y - c.y) / r.y * 0.25) if p.y > eye_y + 1.5 else -1)
			for side: int in [-1, 1]:
				var a := c + Vector3(side * hr * 0.85, hr * 0.45, 0)
				var m := a + Vector3(side * hr * 0.75, hr * 0.35, 0.5)
				var t := m + Vector3(side * hr * 0.3, hr * 0.95, 1.5)
				tube(a, m, 1.9, 1.4, _paint(R.bone, 0.45))
				tube(m, t, 1.4, 0.2, _paint(R.bone, 0.7))
		"crown":
			var cy := c.y + r.y * 0.62
			slices(32, 32.5, int(cy), int(cy) + 1, func(_t2: float) -> Vector2: return Vector2(hr * 0.95, hr * 0.9), _paint(R.trim, 0.65))
			for i in 6:
				var ang := TAU * i / 6.0
				var p := Vector3(32 + cos(ang) * hr * 0.9, cy + 2, 32.5 + sin(ang) * hr * 0.85)
				tube(p, p + Vector3(0, 2.5, 0), 0.9, 0.2, _paint(R.trim, 0.8))
			dot(Vector3(32, cy + 0.5, 32.5 + hr * 0.95), R.bead[3])


func _hair(c: Vector3, r: Vector3, eye_y: float) -> void:
	var style: String = d.hair
	if style == "none" or d.head in ["helm", "hood", "cowl", "skullhood"]:
		return
	var hr: float = L.hr
	var hair := func(p: Vector3i) -> int:
		if p.z > c.z + r.z * 0.4 and p.y < eye_y + 2.5:
			return -1
		return _pk(R.hair, 0.45 + (p.y - c.y) / r.y * 0.25, 0.1)
	ell(c + Vector3(0, 0.8, -0.5), r + Vector3(0.9, 0.7, 0.9), hair, 0.15)
	match style:
		"long":
			tube(c + Vector3(0, 0, -r.z), c + Vector3(0, -hr * 2.2, -r.z - 1), hr * 0.9, hr * 1.0, _paint(R.hair, 0.45), 0.2)
		"braids":
			for side: int in [-1, 1]:
				tube(c + Vector3(side * r.x, -hr * 0.2, -0.5), c + Vector3(side * (r.x + 0.5), -hr * 2.0, 1), 1.3, 1.0,
					func(p: Vector3i) -> int: return R.hair[1 + int(p.y) % 3])
		"mohawk":
			tube(c + Vector3(0, r.y + 0.5, r.z * 0.6), c + Vector3(0, r.y + 1.5, -r.z * 0.9), 1.6, 1.0, _paint(R.hair, 0.65), 0.2)
		"topknot":
			ell(c + Vector3(0, r.y + 1.8, -0.5), Vector3(1.8, 1.8, 1.8), _paint(R.hair, 0.6))
			ell(c + Vector3(0, r.y + 0.6, -0.5), Vector3(1.2, 0.6, 1.2), _paint(R.trim, 0.6))

#endregion

#region Weapons

func _blade_paint(r: PackedInt32Array) -> Callable:
	return func(_p: Vector3i, t: float, edge: bool) -> int:
		if edge:
			return r[r.size() - 1]
		return _pk(r, 0.45 + t * 0.15, 0.04)


func _weapon() -> void:
	var H: float = L.H
	cur = _tag("weapon")
	var g: Vector3 = L["hand_" + L.weapon_hand] + Vector3(0.5, 0.5, 0.5)
	var up := Vector3(0, 0.78, 0.62).normalized()
	var across := Vector3(0, -up.z, up.y)
	var steel: PackedInt32Array = R.metal
	match d.weapon:
		"sword", "greatsword":
			var big: bool = d.weapon == "greatsword"
			var length := H * (0.55 if big else 0.4)
			tube(g - up * 2.5, g + up * 2.5, 1.0, 1.0, _paint(R.dark, 0.5))
			ell(g - up * 3.2, Vector3.ONE * 1.4, _paint(R.trim, 0.7))
			tube(g + up * 2.8 + Vector3(-4, 0, 0), g + up * 2.8 + Vector3(4, 0, 0), 1.0, 1.0, _paint(R.trim, 0.6))
			strip(g + up * 3.5, up, across, length, func(t: float) -> float: return (2.2 if big else 1.6) * (1.0 - pow(t, 4.0)) + 0.2,
				0.6, _blade_paint(steel))
			if "runes" in feats or "ember_cracks" in feats:
				b.line(g + up * 5, g + up * (length * 0.8), _t(R.glow[2]))
		"axe":
			tube(g - up * 6, g + up * (0.36 * H), 1.0, 0.9, _paint(R.wood, 0.5))
			var top := g + up * (0.36 * H - 6.5)
			strip(top, up, -across, 6.5, func(t: float) -> float: return 1.2 + 4.8 * sin(t * PI), 0.6,
				func(p: Vector3i, t: float, _edge: bool) -> int:
					var reach := (Vector3(p) - top).dot(-across)
					return steel[4] if reach > 4.5 else _pk(steel, 0.4 + t * 0.2))
			tube(top + up * 3, top + up * 3 + across * 3.5, 1.2, 0.2, _paint(steel, 0.5))
		"mace":
			tube(g - up * 4, g + up * (0.28 * H), 1.0, 1.0, _paint(R.wood, 0.5))
			var head := g + up * (0.28 * H + 2)
			ell(head, Vector3.ONE * 3.0, _paint(steel, 0.5))
			for dv: Vector3 in [Vector3.UP, Vector3.LEFT, Vector3.RIGHT, Vector3.FORWARD, Vector3.BACK, up]:
				tube(head + dv * 2.5, head + dv * 5.0, 1.0, 0.0, _paint(steel, 0.7))
		"spear", "scythe":
			var length := 0.62 * H
			tube(g - up * 12, g + up * length, 0.9, 0.8, _paint(R.wood, 0.5))
			if d.weapon == "spear":
				strip(g + up * length, up, across, 8, func(t: float) -> float: return 2.0 * sin(t * PI * 0.9) + 0.2, 0.5, _blade_paint(steel))
			else:
				var top := g + up * length
				var prev := top
				for i in range(1, 9):
					var a := float(i) / 8.0
					var p := top + across * (a * 12.0) + up * (sin(a * PI) * 3.0 - a * 4.0)
					tube(prev, p, 1.6 * (1.0 - a) + 0.4, 1.6 * (1.0 - a * 1.1) + 0.3, _paint(steel, 0.5 + a * 0.3))
					prev = p
		"staff", "firestaff", "stormrod":
			var v := Vector3(0, 1, 0.12).normalized()
			var bottom := Vector3(g.x, 1.5, g.z - (g.y - 1.5) * 0.12)
			var top := g + v * (0.42 * H)
			var shaft: PackedInt32Array = R.metal if d.weapon == "stormrod" else R.wood
			tube(bottom, top, 1.0, 1.1, _paint(shaft, 0.45))
			for k in [0.35, 0.65]:
				tube(g + v * (0.42 * H * k - 0.6), g + v * (0.42 * H * k + 0.6), 1.5, 1.5, _paint(R.trim, 0.6))
			match d.weapon:
				"staff":
					ell(top + v * 3, Vector3(1.8, 3.2, 1.8), R.bead[2])
					for i in 3:
						var ang := TAU * i / 3.0
						tube(top, top + Vector3(cos(ang) * 2.4, 4.5, sin(ang) * 2.4), 0.8, 0.4, _paint(R.trim, 0.6))
				"firestaff":
					for i in 4:
						var ang := TAU * i / 4.0 + 0.4
						tube(top, top + Vector3(cos(ang) * 2.8, 4.0, sin(ang) * 2.8), 1.0, 0.3, _paint(R.metal, 0.4))
					ell(top + v * 2.5, Vector3.ONE * 2.0, R.bead[3])
					for i in 5:
						var ang := TAU * i / 5.0
						tube(top + v * 4 + Vector3(cos(ang), 0, sin(ang)) * 1.5, top + v * (8.5 + i % 2 * 2) + Vector3(cos(ang), 0, sin(ang)) * 0.6,
							1.2, 0.0, R.glow[1 + i % 3])
				"stormrod":
					var fork_l := top + Vector3(-3, 5, 0)
					var fork_r := top + Vector3(3, 5, 0)
					tube(top, fork_l, 1.0, 0.5, _paint(R.metal, 0.7))
					tube(top, fork_r, 1.0, 0.5, _paint(R.metal, 0.7))
					var prev := fork_l
					for i in range(1, 7):
						var p := fork_l.lerp(fork_r, i / 6.0) + Vector3(0, (1.5 if i % 2 == 1 else -1.0) + 1.0, 0)
						b.line(prev, p, _t(R.glow[3]))
						prev = p
					ell(top + Vector3(0, 2, 0), Vector3.ONE * 1.4, R.bead[3])
		"daggers":
			_dagger(g, up, across)
		"tome":
			_tome(g + Vector3(0, 1, 3))
		"bow":
			for i in range(1, 9):
				var a := float(i) / 8.0
				for sy: int in [-1, 1]:
					var p := g + Vector3(0, sy * a * 0.3 * H, -a * a * 4.5)
					var q := g + Vector3(0, sy * (a - 0.125) * 0.3 * H, -(a - 0.125) * (a - 0.125) * 4.5)
					tube(q, p, 1.1 - a * 0.5, 1.0 - a * 0.5, _paint(R.wood, 0.5 + a * 0.2))
			b.line(g + Vector3(0, 0.3 * H, -4.5), g + Vector3(0, -0.3 * H, -4.5), _t(R.bone[3]))
			tube(g + Vector3(0, -1.5, 0), g + Vector3(0, 1.5, 0), 1.3, 1.3, _paint(R.dark, 0.5))


func _dagger(g: Vector3, up: Vector3, across: Vector3) -> void:
	tube(g - up * 1.8, g + up * 1.8, 0.9, 0.9, _paint(R.dark, 0.5))
	tube(g + up * 2.0 + Vector3(-2.2, 0, 0), g + up * 2.0 + Vector3(2.2, 0, 0), 0.8, 0.8, _paint(R.trim, 0.6))
	strip(g + up * 2.5, up, across, 0.2 * L.H, func(t: float) -> float: return 1.2 * (1.0 - t * t) + 0.1, 0.4, _blade_paint(R.metal))


func _tome(at: Vector3) -> void:
	var w := 3
	var h := 4
	box(Vector3i(at) + Vector3i(-w, -h, -1), Vector3i(at) + Vector3i(w, h, 1), func(p: Vector3i) -> int:
		var inside := absi(p.x - int(at.x)) < w and absi(p.y - int(at.y)) < h
		if absi(p.z - int(at.z)) < 1 and inside:
			return _pk(R.bone, 0.7)
		if p.z == int(at.z) + 1 and inside and absi(p.x - int(at.x)) + absi(p.y - int(at.y)) <= 1:
			return R.glow[3]
		if absi(p.x - int(at.x)) == w or absi(p.y - int(at.y)) == h:
			return _pk(R.trim, 0.6)
		return _pk(R.main, 0.5))
	for i in 3:
		dot(at + Vector3(-1 + i, -h - 1.5 - i % 2 * 1.5, 1.6), R.bead[1 + i % 3])


func _offhand() -> void:
	if d.weapon == "bow":
		return
	var H: float = L.H
	cur = _tag("offhand")
	var g: Vector3 = L.hand_l + Vector3(0.5, 0.5, 0.5)
	var up := Vector3(0, 0.78, 0.62).normalized()
	var across := Vector3(0, -up.z, up.y)
	var off: String = d.offhand
	if d.weapon == "daggers" and off == "none":
		off = "dagger"
	match off:
		"dagger":
			_dagger(g, up, across)
		"tome":
			_tome(g + Vector3(0, 1, 3))
		"orb":
			ell(g + Vector3(0, 4.5, 1), Vector3.ONE * 2.6, R.bead[2])
			ell(g + Vector3(0, 4.5, 1), Vector3.ONE * 1.4, R.bead[3])
		"lantern":
			var top := g + Vector3(0, -2, 1)
			b.line(top, top + Vector3(0, -2, 0), _t(R.metal[2]))
			box(Vector3i(top) + Vector3i(-2, -7, -2), Vector3i(top) + Vector3i(2, -3, 2), func(p: Vector3i) -> int:
				var edge := (absi(p.x - int(top.x)) == 2) and (absi(p.z - int(top.z)) == 2)
				var cap := p.y == int(top.y) - 3 or p.y == int(top.y) - 7
				if edge or cap:
					return _pk(R.metal, 0.4)
				return R.glow[2 + (p.y % 2)])
		"shield":
			var center := g + Vector3(2.5, 1.0, 1.5)
			var normal := Vector3(0.45, 0, 0.9).normalized()
			var u := Vector3(0, 1, 0)
			var v := normal.cross(u).normalized()
			var radius := 0.15 * H
			var rr := -radius
			while rr <= radius:
				var cc := -radius
				while cc <= radius:
					var dist := Vector2(rr, cc).length()
					if dist <= radius:
						for k in 3:
							var p := center + u * rr + v * cc + normal * (k * 0.5 - (dist / radius) * 1.2)
							var paint: int
							if dist > radius - 1.4:
								paint = _pk(R.trim, 0.55)
							elif dist < 2.2:
								paint = _pk(R.metal, 0.7)
							elif absf(rr) < 1.0 or absf(cc) < 1.0:
								paint = _pk(R.trim, 0.45)
							else:
								paint = _pk(R.main, 0.5)
							dot(p, paint)
					cc += 0.5
				rr += 0.5


func _cape() -> void:
	cur = _tag("cape")
	var top := int(L.shoulder_y)
	var bottom := int(L.knee_y * 0.6)
	var back: float = 32 - L.rz - 1.2
	for y in range(bottom, top + 1):
		var t := float(top - y) / float(top - bottom)
		var half: float = L.rx * (0.85 + t * 0.45)
		var z0 := back - t * 3.5
		for x in range(int(32 - half), int(ceil(32 + half))):
			var wave := sin((x - 32) * 0.7 + t * 2.0) * 0.6 * t
			for k in 2:
				var p := Vector3(x, y, z0 - k + wave)
				var paint: int
				if y <= bottom + 1:
					paint = _pk(R.trim, 0.6)
				else:
					var fold := 0.15 if (x + 64) % 4 == 0 else 0.0
					paint = _pk(R.cloth, 0.55 - t * 0.2 - fold - k * 0.15, 0.04)
				dot(p, paint)
	for side: int in [-1, 1]:
		ell(Vector3(32 + side * (L.rx * 0.7), L.shoulder_y - 0.5, back + 0.8), Vector3(1.3, 1.3, 1.0), _paint(R.trim, 0.8))

#endregion

#region Finish and split

func _finish() -> void:
	if "ember_cracks" in feats:
		b.recolor(func(p: Vector3i, v: int) -> int:
			if (v in R.skin or v in R.main or v in R.dark) and b.on_surface(p):
				var n := b.n01(Vector3(p), 2.6)
				if absf(n - 0.5) < 0.035:
					return R.glow[1 + int(n * 100) % 3]
			return v)
	b.shade(_shaded_ramps(), Vector3i.UP, 1, 0.75)
	b.shade(_shaded_ramps(), Vector3i.DOWN, -1, 0.9)


func _tag(part: String) -> int:
	return PARTS.find(part) + 1


## Splits the grid into cropped, refined part models. Returns
## {"parts": {name: VoxelModel}, "rig": Dictionary}.
func _split() -> Dictionary:
	var lo := {}
	var hi := {}
	var m := b.model
	for z in GRID:
		for y in GRID:
			for x in GRID:
				var i := x + GRID * (y + GRID * z)
				if m.voxels[i] == 0:
					continue
				var t := tags[i]
				if t == 0:
					continue
				var p := Vector3i(x, y, z)
				lo[t] = p if not lo.has(t) else (lo[t] as Vector3i).min(p)
				hi[t] = p if not hi.has(t) else (hi[t] as Vector3i).max(p)
	var parts := {}
	var rig_parts := {}
	var parents := PARENT.duplicate()
	if L.weapon_hand == "l":
		parents.weapon = "arm_lo_l"
	for t: int in lo:
		var name: String = PARTS[t - 1]
		var o: Vector3i = (lo[t] as Vector3i) - Vector3i.ONE
		var size: Vector3i = (hi[t] as Vector3i) - o + Vector3i(2, 2, 2)
		var pm := VoxelModel.create(size)
		pm.colors = m.colors.duplicate()
		pm.emission = m.emission.duplicate()
		pm.roughness = m.roughness.duplicate()
		pm.metallic = m.metallic.duplicate()
		pm.round = m.round.duplicate()
		for z in range(1, size.z - 1):
			for y in range(1, size.y - 1):
				for x in range(1, size.x - 1):
					var src := Vector3i(x, y, z) + o
					if not m.has_point(src):
						continue
					var i := m.index_of(src)
					if tags[i] == t:
						pm.voxels[x + size.x * (y + size.y * z)] = m.voxels[i]
		var thin := name in ["weapon", "offhand"]
		var texture: String = "plate" if thin else ("" if name == "head" else d.texture)
		pm = VoxelRefine.refine(pm, DETAIL, 0 if thin else 1, 0.12 if thin else 0.18, int(d.seed) + t, texture)
		parts[name] = pm
		var joint: Vector3 = J.get(name, Vector3(32, 0, 32))
		var offset := (joint - Vector3(o)) * DETAIL
		var parent: String = parents[name]
		while parent != "" and not lo.has(_tag(parent)):
			parent = parents[parent]
		rig_parts[name] = {"parent": parent, "joint": [joint.x, joint.y, joint.z], "offset": [offset.x, offset.y, offset.z],
			"file": name + ".vox"}
	var rig := {
		"id": d.id, "name": d.name, "blurb": d.blurb, "fx": d.fx, "glow": d.colors.glow, "weapon": d.weapon,
		"weapon_hand": L.weapon_hand, "detail": DETAIL, "grid": GRID, "height": L.H, "parts": rig_parts,
		"order": PARTS.filter(func(n: String) -> bool: return rig_parts.has(n)),
	}
	return {"parts": parts, "rig": rig}


## Builds a design and writes characters/built/<id>/. Returns "" or an error.
static func build_and_save(design: Dictionary) -> String:
	var result := build(design)
	var dir: String = OUT_DIR + str(design.id) + "/"
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(dir))
	for f in DirAccess.get_files_at(dir):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(dir + f))
	for name: String in result.parts:
		var err := VoxIO.save_file(result.parts[name], ProjectSettings.globalize_path(dir + name + ".vox"))
		if err != OK:
			return "could not write %s.vox: %s" % [name, error_string(err)]
	var rig_file := FileAccess.open(dir + "rig.json", FileAccess.WRITE)
	rig_file.store_string(JSON.stringify(result.rig, "\t"))
	rig_file.close()
	var design_file := FileAccess.open(dir + "design.json", FileAccess.WRITE)
	design_file.store_string(JSON.stringify(design, "\t"))
	design_file.close()
	return ""

#endregion
