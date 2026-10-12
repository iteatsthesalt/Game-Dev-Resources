extends RefCounted
## Cinder Hound (Cinder Caldera enemy). From the sprite: a soot-black wolf with a
## pale bone muzzle and ears and ember-hot paws. In 3D it gets a barrel chest,
## a ridge of smouldering cracks down the spine, glowing eyes and an ember tail.
## Faces +Z.

const SEED := 11


static func build(seed := SEED) -> VoxelModel:
	var b := VoxelBuilder.new(Vector3i(30, 44, 64), seed)
	var fur := b.ramp(CinderPalette.FUR)
	var bone := b.ramp(CinderPalette.BONE)
	var ember := b.ramp(CinderPalette.EMBER, [0.35, 0.5, 0.7, 1.0, 1.4, 2.0])
	var soot := b.mat(CinderPalette.SOOT[1])
	var cx := 15.0

	var fur_paint := func(p: Vector3i) -> int:
		var t := (p.y - 6.0) / 30.0 + (b.n01(Vector3(p), 1.4) - 0.5) * 0.5
		return b.pick(fur, t, 0.1)

	# Body: hips, ribcage and a deep chest.
	b.ellipsoid(Vector3(cx, 21, 20), Vector3(7, 7, 9), fur_paint, 0.08)
	b.ellipsoid(Vector3(cx, 22, 30), Vector3(8, 8.5, 10), fur_paint, 0.08)
	b.ellipsoid(Vector3(cx, 21, 39), Vector3(8.5, 9, 7), fur_paint, 0.08)
	# Hackles: a shaggy ruff over the shoulders.
	b.ellipsoid(Vector3(cx, 27, 40), Vector3(9, 6, 6), fur_paint, 0.35)

	# Neck and head.
	b.tube(Vector3(cx, 26, 42), Vector3(cx, 31, 48), 5.5, 4.5, fur_paint)
	b.ellipsoid(Vector3(cx, 32, 50), Vector3(5.5, 5, 6), fur_paint, 0.05)
	b.tube(Vector3(cx, 30.5, 53), Vector3(cx, 29, 60), 3.4, 2.4, func(p: Vector3i) -> int:
		return b.pick(bone, (p.z - 53) / 8.0 + 0.2, 0.1))
	b.tube(Vector3(cx, 27.5, 53), Vector3(cx, 27, 58), 2.4, 1.8, fur_paint) # jaw
	b.box(Vector3i(14, 29, 61), Vector3i(16, 30, 61), soot) # nose
	# Ears: pale tips like the sprite.
	for side in [-1.0, 1.0]:
		var base := Vector3(cx + side * 3.0, 35, 49)
		b.tube(base, base + Vector3(side * 1.5, 7, -1), 2.0, 0.4, func(p: Vector3i) -> int:
			return b.pick(bone, 0.4, 0.2) if p.y > 39 else b.pick(fur, 0.7, 0.1))

	# Legs with glowing paws.
	for leg: Vector3 in [Vector3(-4.5, 0, 36), Vector3(4.5, 0, 36), Vector3(-4, 0, 18), Vector3(4, 0, 18)]:
		var top := Vector3(cx + leg.x, 19, leg.z)
		var knee := Vector3(cx + leg.x * 1.05, 9, leg.z + (2.0 if leg.z < 25 else -1.0))
		b.tube(top, knee, 3.4, 2.4, fur_paint)
		b.tube(knee, Vector3(cx + leg.x, 4, leg.z + 1), 2.4, 2.0, fur_paint)
		b.ellipsoid(Vector3(cx + leg.x, 2, leg.z + 2), Vector3(2.6, 2.2, 3.2), func(p: Vector3i) -> int:
			return b.pick(ember, 0.15 + (p.z - leg.z) / 14.0, 0.15))

	# Tail: sweeps back and up, burning at the tip.
	b.tube(Vector3(cx, 24, 13), Vector3(cx, 27, 6), 3.0, 2.2, fur_paint)
	b.tube(Vector3(cx, 27, 6), Vector3(cx, 32, 2), 2.2, 1.0, func(p: Vector3i) -> int:
		return b.pick(ember, (30.0 - p.z * 4.0) / 30.0 + 0.3, 0.15) if p.y > 29 else fur_paint.call(p))

	# Light from above, shadow below, like the sprite's two-tone shading.
	b.shade([fur], Vector3i.UP, 1)
	b.shade([fur], Vector3i.DOWN, -2)

	# Smouldering cracks down the spine.
	b.recolor(func(p: Vector3i, current: int) -> int:
		if p.y > 25 and p.z > 12 and p.z < 46 and absf(p.x + 0.5 - cx) < 3.0 and b.exposed(p, Vector3i.UP):
			if absf(b.noise.get_noise_3d(p.x * 3.0, p.y * 3.0, p.z * 0.8)) < 0.08:
				return b.pick(ember, 0.4, 0.2)
		return current)

	# Eyes: two bright embers on the brow.
	for side in [-1, 1]:
		var e := Vector3i(int(cx) + side * 3 - (1 if side < 0 else 0), 33, 54)
		b.set_v(e, ember[5])
		b.set_v(e + Vector3i(side, 0, 0), ember[4])
		b.set_v(e + Vector3i(0, 0, -1), ember[3])
	return b.model
