extends RefCounted
## Ember crystal cluster: a basalt base split by glowing shards that brighten
## from a deep red root to a white-hot tip.

const SEED := 7


static func build(seed := SEED) -> VoxelModel:
	var b := VoxelBuilder.new(Vector3i(40, 56, 40), seed)
	var basalt := b.ramp(CinderPalette.BASALT)
	var crystal := b.ramp(CinderPalette.CRYSTAL, [0.25, 0.5, 1.0, 1.6, 2.2, 3.0], 0.35)
	var c := Vector3(20, 0, 20)

	# Base: a few overlapping boulders.
	for i in 5:
		var a := TAU * i / 5.0 + b.rng.randf() * 0.6
		var p := c + Vector3(cos(a), 0, sin(a)) * b.rng.randf_range(4.0, 9.0)
		b.ellipsoid(p + Vector3(0, 2, 0), Vector3(7, 5, 7) * b.rng.randf_range(0.8, 1.1), b.noisy(basalt, 0.45, 0.3), 0.2)
	b.ellipsoid(c + Vector3(0, 3, 0), Vector3(10, 6, 10), b.noisy(basalt, 0.5, 0.3), 0.15)

	# Shards: tapered tubes leaning outwards, colour by height along the shard.
	var shards := [[0.0, 0.0, 44.0, 3.4], [0.9, 0.35, 30.0, 2.6], [2.6, 0.45, 26.0, 2.4],
			[4.2, 0.4, 32.0, 2.8], [5.4, 0.55, 20.0, 2.0], [1.8, 0.7, 16.0, 1.6], [3.5, 0.75, 14.0, 1.5]]
	for s: Array in shards:
		var angle: float = s[0]
		var lean: float = s[1]
		var length: float = s[2]
		var radius: float = s[3]
		var dir := Vector3(cos(angle) * lean, 1.0, sin(angle) * lean).normalized()
		var root := c + Vector3(cos(angle), 0, sin(angle)) * lean * 6.0 + Vector3(0, 4, 0)
		var tip := root + dir * length
		b.tube(root, tip, radius, 0.4, func(p: Vector3i) -> int:
			var t := clampf((Vector3(p) - root).dot(dir) / length, 0.0, 1.0)
			return b.pick(crystal, t * 0.95 + 0.05, 0.08))
	return b.model
