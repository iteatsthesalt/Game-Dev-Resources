extends RefCounted
## Ash Ghoul (Cinder Caldera enemy). From the sprite: a hunched grey ash body,
## orange eyes and a dark mouth. In 3D: a stooped, flaking ash husk with long
## dragging arms, bone claws, a mouth full of embers and a cracked glowing chest.
## Faces +Z.

const SEED := 21
const TEXTURE := "ash"


static func build(seed := SEED) -> VoxelModel:
	var b := VoxelBuilder.new(Vector3i(44, 56, 40), seed)
	var ash := b.ramp(CinderPalette.ASH)
	var soot := b.ramp(CinderPalette.SOOT)
	var bone := b.ramp(CinderPalette.BONE)
	var ember := b.ramp(CinderPalette.EMBER, [0.4, 0.6, 0.9, 1.2, 1.6, 2.2])
	var bead := b.ramp(CinderPalette.EMBER, [0.5, 0.7, 1.0, 1.4, 1.9, 2.6], 0.6, 0.0, true) # round voxels
	var cx := 22.0

	var skin := func(p: Vector3i) -> int:
		var t := 0.35 + (p.y - 20.0) / 60.0 + (b.n01(Vector3(p), 1.8) - 0.5) * 0.6
		return b.pick(ash, t, 0.12)
	var dark := func(p: Vector3i) -> int:
		return b.pick(soot, 0.3 + b.n01(Vector3(p), 2.0) * 0.5, 0.1)

	# Legs: short, bent, sooty.
	for side in [-1.0, 1.0]:
		var hip := Vector3(cx + side * 5.0, 20, 15)
		var knee := Vector3(cx + side * 6.5, 11, 19)
		var foot := Vector3(cx + side * 6.5, 3, 16)
		b.tube(hip, knee, 4.0, 3.2, dark)
		b.tube(knee, foot, 3.2, 2.6, dark)
		b.ellipsoid(foot + Vector3(0, -0.5, 2), Vector3(3.2, 2.2, 4.5), dark)

	# Pelvis, hunched torso and the hump of the back.
	b.ellipsoid(Vector3(cx, 21, 15), Vector3(8, 5, 6), skin, 0.1)
	b.tube(Vector3(cx, 23, 15), Vector3(cx, 35, 20), 8.0, 10.0, skin, 0.1)
	b.ellipsoid(Vector3(cx, 37, 15), Vector3(11, 8, 8), skin, 0.15)

	# Head thrust forward and low.
	b.ellipsoid(Vector3(cx, 40, 25), Vector3(7, 7.5, 7), skin, 0.08)
	b.ellipsoid(Vector3(cx, 36, 28), Vector3(5.5, 3.5, 4.5), skin) # jaw

	# Long arms dragging near the ground, bone claws.
	for side in [-1.0, 1.0]:
		var shoulder := Vector3(cx + side * 10.0, 36, 18)
		var elbow := Vector3(cx + side * 14.0, 25, 22)
		var hand := Vector3(cx + side * 13.0, 13, 26)
		b.tube(shoulder, elbow, 4.0, 3.0, skin)
		b.tube(elbow, hand, 3.0, 2.4, skin)
		b.ellipsoid(hand, Vector3(3, 3, 3), skin)
		for f in 3:
			var root := hand + Vector3(side * (f - 1) * 1.6, -1, 1.5)
			b.tube(root, root + Vector3(side * (f - 1) * 0.6, -6, 3), 0.9, 0.3, func(p: Vector3i) -> int:
				return b.pick(bone, 0.6, 0.3))

	b.shade([ash], Vector3i.UP, 1)
	b.shade([ash], Vector3i.DOWN, -2)
	b.shade([ash], Vector3i.LEFT, -1, 0.5)

	# Cracked chest: thin glowing seams through the ash.
	b.recolor(func(p: Vector3i, current: int) -> int:
		if p.y > 24 and p.y < 36 and p.z > 21 and b.exposed(p, Vector3i.BACK):
			if absf(b.noise.get_noise_3d(p.x * 2.5, p.y * 1.5, p.z)) < 0.035:
				return b.pick(ember, 0.45, 0.25)
		return current)

	# Ember mouth and eyes.
	b.box(Vector3i(19, 36, 31), Vector3i(24, 37, 33), soot[0])
	b.box(Vector3i(20, 36, 30), Vector3i(23, 36, 31), bead[2])
	for side in [-1, 1]:
		var e := Vector3i(int(cx) + side * 3 - (1 if side < 0 else 0), 41, 31)
		b.box(e, e + Vector3i(side, 0, 0), bead[5])
		b.set_v(e + Vector3i(0, 0, -1), bead[3])

	# Ash flaking off the shoulders and back.
	b.erode(0.08, 30)
	b.remove_floating()
	return b.model
