extends RefCounted
## Ash Vulture (Cinder Caldera enemy). From the sprite: spread grey wings, a
## white chest, a bare pinkish head, orange hooked beak and orange talons.
## In 3D: mid-swoop with layered primary feathers, a ruff of pale down at the
## neck, smouldering wingtips and talons hooked forward. Faces +Z.

const SEED := 51
const TEXTURE := "feather"


static func build(seed := SEED) -> VoxelModel:
	var b := VoxelBuilder.new(Vector3i(84, 44, 44), seed)
	var ash := b.ramp(CinderPalette.ASH)
	var bone := b.ramp(CinderPalette.BONE)
	var flesh := b.ramp(CinderPalette.FLESH)
	var beak := b.ramp(["#a8361c", "#ff7a2a", "#ffa04a"], 0.0, 0.5)
	var ember := b.ramp(CinderPalette.EMBER, [0.4, 0.6, 0.9, 1.2, 1.6, 2.2])
	var soot := b.mat(CinderPalette.SOOT[0])
	var cx := 42.0

	var feather := func(p: Vector3i) -> int:
		return b.pick(ash, 0.55 + (b.n01(Vector3(p), 1.8) - 0.5) * 0.5, 0.1)

	# Body: a tilted egg, pale chest at the front.
	b.ellipsoid(Vector3(cx, 22, 20), Vector3(7, 7.5, 11), feather, 0.06)
	b.ellipsoid(Vector3(cx, 20, 26), Vector3(6, 6, 5), func(p: Vector3i) -> int:
		return b.pick(bone, 0.5 + (p.y - 16) / 16.0, 0.1))
	# Ruff of pale down and the bare neck and head.
	b.ellipsoid(Vector3(cx, 27, 28), Vector3(6, 3.5, 4), func(p: Vector3i) -> int: return b.pick(bone, 0.85, 0.15), 0.3)
	b.tube(Vector3(cx, 27, 29), Vector3(cx, 32, 33), 2.8, 2.4, func(p: Vector3i) -> int: return b.pick(flesh, 0.4, 0.2))
	b.ellipsoid(Vector3(cx, 33, 35), Vector3(3.5, 3.5, 4), func(p: Vector3i) -> int: return b.pick(flesh, 0.6, 0.2))
	# Hooked beak.
	b.tube(Vector3(cx, 33, 38), Vector3(cx, 32, 42), 1.8, 1.2, func(p: Vector3i) -> int: return beak[1])
	b.tube(Vector3(cx, 32, 42), Vector3(cx, 29.5, 42.5), 1.1, 0.5, func(p: Vector3i) -> int: return beak[0])
	for side in [-1, 1]:
		b.set_v(Vector3i(int(cx) + side * 3 - (1 if side < 0 else 0), 34, 37), ember[5])
		b.set_v(Vector3i(int(cx) + side * 3 - (1 if side < 0 else 0), 34, 36), soot)

	# Wings: arm bone plus a fan of long primaries, raised mid-beat.
	for side in [-1.0, 1.0]:
		var shoulder := Vector3(cx + side * 6.0, 25, 22)
		var wrist := Vector3(cx + side * 22.0, 33, 18)
		var tip := Vector3(cx + side * 40.0, 30, 12)
		b.tube(shoulder, wrist, 4.0, 2.5, feather)
		b.tube(wrist, tip, 2.5, 1.0, feather)
		# Covert feathers filling the wing plane.
		for i in 12:
			var t := i / 11.0
			var root := shoulder.lerp(tip, t)
			var length := lerpf(7.0, 14.0, sin(t * PI * 0.9))
			var end := root + Vector3(side * t * 4.0, -2.5, -length)
			b.tube(root, end, 1.6, 0.8, func(p: Vector3i) -> int:
				var away := absf(p.x + 0.5 - cx) / 40.0
				if away > 0.85 and p.z < 10:
					return b.pick(ember, 0.3, 0.2)
				return b.pick(ash, 0.25 + away * 0.6 + (b.n01(Vector3(p), 2.0) - 0.5) * 0.3, 0.1))

	# Tail fan.
	for i in 5:
		var a := (i - 2) * 0.22
		b.tube(Vector3(cx, 21, 10), Vector3(cx + sin(a) * 9.0, 19, 10 - cos(a) * 9.0), 1.6, 1.0, feather)

	# Talons tucked forward.
	for side in [-1.0, 1.0]:
		var leg := Vector3(cx + side * 3.0, 15, 22)
		b.tube(leg, leg + Vector3(0, -6, 4), 1.3, 1.0, func(p: Vector3i) -> int: return beak[1])
		for f in 3:
			b.tube(leg + Vector3(0, -6, 4), leg + Vector3(side * (f - 1) * 1.5, -9, 6.5), 0.8, 0.4, func(p: Vector3i) -> int: return soot)

	b.shade([ash], Vector3i.UP, 1)
	b.shade([ash], Vector3i.DOWN, -2)
	return b.model
