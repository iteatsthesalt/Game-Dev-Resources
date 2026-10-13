extends RefCounted
## The Cinder King's greatsword. From the sprite: a soot-wrapped hilt, a brass
## guard and a long blade that runs from deep ember at the guard to white-hot
## at the tip, with a serrated spine. As a prop it stands planted point-down.
## `draw` is shared with the Cinder King recipe so both stay identical.

const SEED := 61
const COLLISION := "convex"


static func build(seed := SEED) -> VoxelModel:
	var b := VoxelBuilder.new(Vector3i(20, 62, 12), seed)
	draw(b, Vector3(10, 0, 6), 1.0)
	return b.model


## Draws the sword standing point-down with its tip at `tip` (voxel coords).
## `scale` 1.0 is a 1.8 m greatsword.
static func draw(b: VoxelBuilder, tip: Vector3, scale := 1.0) -> void:
	var soot := b.ramp(CinderPalette.SOOT)
	var brass := b.ramp(CinderPalette.BRASS, 0.0, 0.45, 0.25)
	var blade := b.ramp(CinderPalette.EMBER, [0.6, 0.8, 1.1, 1.5, 2.0, 2.6], 0.4)
	var blade_len := 40.0 * scale
	var guard_y := tip.y + blade_len

	# Blade: flat (wide in X, thin in Z), hot at the tip, serrated on one edge.
	for y in range(int(tip.y), int(guard_y)):
		var t := (y - tip.y) / blade_len
		var half := lerpf(0.6, 2.6, clampf(t * 4.0, 0.0, 1.0)) * scale
		for x in range(int(floor(tip.x - half)), int(ceil(tip.x + half))):
			for z in range(int(tip.z) - 1, int(tip.z) + 1):
				var edge := absf(x + 0.5 - tip.x) / maxf(half, 0.1)
				b.set_v(Vector3i(x, y, z), b.pick(blade, (1.0 - t) * 0.75 + edge * 0.25, 0.06))
		if y % 4 == 0 and t > 0.15:
			b.set_v(Vector3i(int(tip.x + half), y, int(tip.z) - 1), blade[3])
	# Fuller: a darker groove down the middle of the blade.
	b.box(Vector3i(int(tip.x) - 1, int(tip.y + blade_len * 0.2), int(tip.z) - 2),
			Vector3i(int(tip.x), int(guard_y) - 2, int(tip.z) - 2), blade[0])
	b.box(Vector3i(int(tip.x) - 1, int(tip.y + blade_len * 0.2), int(tip.z) + 1),
			Vector3i(int(tip.x), int(guard_y) - 2, int(tip.z) + 1), blade[0])

	# Brass cross guard with upturned ends.
	var g := Vector3(tip.x, guard_y, tip.z)
	b.tube(g + Vector3(-7 * scale, 0.5, 0), g + Vector3(7 * scale, 0.5, 0), 1.4 * scale, 1.4 * scale,
			func(p: Vector3i) -> int: return b.pick(brass, 0.5 + (p.y - g.y) * 0.3, 0.1))
	for side in [-1.0, 1.0]:
		b.tube(g + Vector3(side * 7 * scale, 0.5, 0), g + Vector3(side * 8 * scale, 3 * scale, 0), 1.2, 0.6,
				func(p: Vector3i) -> int: return brass[3])
	# Wrapped grip and a glowing pommel stone.
	b.tube(g + Vector3(0, 2, 0), g + Vector3(0, 13 * scale, 0), 1.3 * scale, 1.3 * scale,
			func(p: Vector3i) -> int: return soot[2] if p.y % 2 == 0 else soot[4])
	b.ellipsoid(g + Vector3(0, 15 * scale, 0), Vector3(2.4, 2.4, 2.4) * scale, func(p: Vector3i) -> int:
		return blade[5] if p.y > int(g.y + 15 * scale) else brass[2])
