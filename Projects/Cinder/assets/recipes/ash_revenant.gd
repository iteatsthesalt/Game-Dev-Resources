extends RefCounted
## Ash Revenant (Cinder Caldera elite). From the sprite: a hooded ash figure
## with pale burning eyes, an orange tunic, dark boots and a drawn sword. In 3D
## it becomes a broad warrior with a deep cowl, a tattered tabard edged with
## embers, iron pauldrons and a notched steel blade held low. Faces +Z.

const SEED := 31


static func build(seed := SEED) -> VoxelModel:
	var b := VoxelBuilder.new(Vector3i(48, 66, 40), seed)
	var ash := b.ramp(CinderPalette.ASH)
	var soot := b.ramp(CinderPalette.SOOT)
	var cloth := b.ramp(CinderPalette.CLOTH_ORANGE)
	var iron := b.ramp(CinderPalette.IRON, 0.0, 0.55, 0.2)
	var steel := b.ramp(CinderPalette.STEEL, 0.0, 0.4, 0.25)
	var brass := b.ramp(CinderPalette.BRASS, 0.0, 0.45, 0.25)
	var ember := b.ramp(CinderPalette.EMBER, [0.4, 0.6, 0.9, 1.2, 1.6, 2.2])
	var cx := 22.0
	var cz := 18.0

	var skin := func(p: Vector3i) -> int:
		return b.pick(ash, 0.68 + (b.n01(Vector3(p), 1.6) - 0.5) * 0.4, 0.1)
	var boot := func(p: Vector3i) -> int:
		return b.pick(soot, 0.3 + b.n01(Vector3(p), 2.0) * 0.5, 0.1)
	var tunic := func(p: Vector3i) -> int:
		return b.pick(cloth, 0.25 + (p.y - 14.0) / 40.0 + (b.n01(Vector3(p), 2.0) - 0.5) * 0.4, 0.1)

	# Legs and boots.
	for side in [-1.0, 1.0]:
		var hip := Vector3(cx + side * 4.5, 26, cz)
		b.tube(hip, Vector3(cx + side * 5.0, 12, cz + 1), 3.6, 3.0, skin)
		b.tube(Vector3(cx + side * 5.0, 13, cz + 1), Vector3(cx + side * 5.0, 3, cz + 1), 3.4, 3.4, boot)
		b.ellipsoid(Vector3(cx + side * 5.0, 2, cz + 3), Vector3(3.4, 2.2, 5), boot)

	# Torso and tabard (wider at the hem, ragged bottom edge).
	b.column(cx, cz, 14, 44, func(t: float) -> float: return lerpf(10.0, 8.5, t), tunic)
	b.recolor(func(p: Vector3i, current: int) -> int:
		if p.y < 20 and cloth.has(current) and b.n01(Vector3(p.x, 0, p.z), 3.0) > 0.42 + (p.y - 14) * 0.03:
			return 0
		return current)
	# Belt with a brass buckle.
	b.column(cx, cz, 27, 28, 9.0, func(p: Vector3i) -> int: return b.pick(soot, 0.6))
	b.box(Vector3i(21, 27, 26), Vector3i(23, 28, 27), brass[2])

	# Shoulders: rounded iron pauldrons.
	for side in [-1.0, 1.0]:
		b.ellipsoid(Vector3(cx + side * 10.0, 43, cz), Vector3(5, 4, 5.5), func(p: Vector3i) -> int:
			return b.pick(iron, 0.3 + (p.y - 40) / 10.0, 0.1), 0.05)

	# Arms: left hangs, right grips the sword.
	b.tube(Vector3(cx - 10, 41, cz), Vector3(cx - 12, 30, cz + 2), 3.2, 2.8, skin)
	b.tube(Vector3(cx - 12, 30, cz + 2), Vector3(cx - 12, 21, cz + 3), 2.8, 2.6, skin)
	b.tube(Vector3(cx + 10, 41, cz), Vector3(cx + 13, 31, cz + 3), 3.2, 2.8, skin)
	b.tube(Vector3(cx + 13, 31, cz + 3), Vector3(cx + 14, 24, cz + 8), 2.8, 2.6, skin)

	# Sword: brass guard and hilt, long steel blade angled to the ground.
	var grip := Vector3(cx + 14, 23, cz + 9)
	b.tube(grip + Vector3(0, 3, -1), grip + Vector3(0, -2, 1), 1.1, 1.1, func(p: Vector3i) -> int: return soot[3])
	b.tube(grip + Vector3(-3, -2, 1), grip + Vector3(3, -2, 1), 1.0, 1.0, func(p: Vector3i) -> int: return brass[2])
	b.tube(grip + Vector3(0, -3, 1.5), grip + Vector3(0, -20, 8), 1.4, 0.6, func(p: Vector3i) -> int:
		return b.pick(steel, 0.7 + float(p.x - int(grip.x)) * 0.2, 0.1))

	# Hood and face: a peaked cowl framing a shadowed face with two burning eyes.
	var hood := func(p: Vector3i) -> int:
		return b.pick(ash, 0.5 + b.n01(Vector3(p), 2.0) * 0.35, 0.1)
	b.ellipsoid(Vector3(cx, 50, cz), Vector3(6.5, 6.5, 6.5), hood, 0.05)
	b.tube(Vector3(cx, 52, cz - 1), Vector3(cx, 58, cz - 5), 5.0, 1.5, hood)
	b.ellipsoid(Vector3(cx, 45, cz), Vector3(9, 3, 7), hood, 0.1) # draped collar
	b.ellipsoid(Vector3(cx, 49.5, cz + 6.5), Vector3(4, 4.5, 2.5), soot[0]) # face hollow
	for side in [-1, 1]:
		var e := Vector3i(int(cx) + side * 2 - (1 if side < 0 else 0), 50, int(cz) + 6)
		b.box(e, e + Vector3i(side, 0, 0), ember[5])

	# Ember trim on the tabard hem and across the chest.
	b.recolor(func(p: Vector3i, current: int) -> int:
		if cloth.has(current) and b.exposed(p, Vector3i.DOWN):
			return b.pick(ember, 0.5, 0.2)
		return current)
	b.shade([ash, cloth, iron], Vector3i.UP, 1)
	b.shade([ash, cloth], Vector3i.DOWN, -1)
	b.remove_floating()
	return b.model
