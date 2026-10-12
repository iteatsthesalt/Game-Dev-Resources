extends RefCounted
## Ember Wisp (Cinder Caldera enemy). From the sprite: a teardrop of orange
## flame with a pale face and two dark eyes. In 3D it hovers above the ground:
## a white-hot core shading out to orange, licking flame tongues on top, a
## smooth pale mask and a few drifting sparks. Faces +Z.

const SEED := 41
const COLLISION := "none"


static func build(seed := SEED) -> VoxelModel:
	var b := VoxelBuilder.new(Vector3i(34, 58, 34), seed)
	var flame := b.ramp(CinderPalette.FLAME, [0.9, 1.1, 1.4, 1.8, 2.4], 0.6)
	var mask := b.ramp(["#c9935a", "#e8b680", "#ffd08a", "#ffe6c0"], 0.35, 0.6)
	var soot := b.mat(CinderPalette.SOOT[0])
	var c := Vector2(17, 17)
	var y0 := 8
	var y1 := 44

	# Teardrop body: wide round bottom tapering into a flame point.
	var radius := func(t: float) -> float:
		return 11.0 * pow(sin(PI * clampf(pow(t, 0.8), 0.0, 1.0)), 0.7) * (1.0 - t * 0.35)
	b.column(c.x, c.y, y0, y1, radius, func(p: Vector3i) -> int:
		var t := float(p.y - y0) / float(y1 - y0)
		var r: float = maxf(radius.call(t), 0.5)
		var d := Vector2(p.x + 0.5 - c.x, p.z + 0.5 - c.y).length() / r
		var heat := (1.0 - d) * 0.8 + (1.0 - t) * 0.3 + (b.n01(Vector3(p), 2.5) - 0.5) * 0.3
		return b.pick(flame, heat, 0.08))

	# Flame tongues curling off the top.
	for i in 5:
		var a := TAU * i / 5.0 + b.rng.randf() * 0.5
		var base := Vector3(c.x + cos(a) * 4.0, 36, c.y + sin(a) * 4.0)
		var tip := base + Vector3(cos(a) * 3.0, b.rng.randf_range(8, 14), sin(a) * 3.0)
		b.tube(base, tip, 2.8, 0.4, func(p: Vector3i) -> int:
			return b.pick(flame, 0.25 + (tip.y - p.y) / 30.0, 0.1), 0.2)
	b.tube(Vector3(c.x, 40, c.y), Vector3(c.x + 1, 55, c.y - 2), 3.5, 0.5, func(p: Vector3i) -> int:
		return b.pick(flame, 0.2 + (55.0 - p.y) / 40.0, 0.1), 0.15)

	# Pale mask on the front with hollow eyes.
	b.ellipsoid(Vector3(c.x, 21, c.y + 8.5), Vector3(6.5, 6, 3), func(p: Vector3i) -> int:
		return b.pick(mask, 0.5 + (p.y - 18) / 14.0, 0.1))
	for side in [-1, 1]:
		var e := Vector3i(int(c.x) + side * 3 - (1 if side < 0 else 0), 22, int(c.y) + 11)
		b.box(e - Vector3i(0, 1, 1), e + Vector3i(side, 0, 1), soot)
	b.box(Vector3i(16, 17, 27), Vector3i(17, 17, 28), soot)

	# Sparks drifting around it.
	for i in 10:
		var p := Vector3i(b.rng.randi_range(2, 31), b.rng.randi_range(10, 54), b.rng.randi_range(2, 31))
		if Vector2(p.x - c.x, p.z - c.y).length() > 10.0:
			b.set_v(p, flame[b.rng.randi_range(2, 4)])
	return b.model
