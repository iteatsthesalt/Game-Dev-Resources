extends Node3D
## Animation and effects for a voxel model, read from assets/fx/<asset>.json.
## This file is what the local AI writes when you type "improve".
## Every value is clamped, so a bad answer can't break anything.

@export var asset := ""

const PARTICLES := {
	"embers": {"colors": ["#ffb35e", "#ff7a2a"], "size": 0.035, "speed": 0.5, "gravity": 0.4, "life": 2.0, "glow": true},
	"sparks": {"colors": ["#ffe9a0", "#ffc44a"], "size": 0.02, "speed": 1.6, "gravity": -2.0, "life": 0.8, "glow": true},
	"flames": {"colors": ["#ff7a2a", "#ff4614"], "size": 0.07, "speed": 0.7, "gravity": 0.9, "life": 0.7, "glow": true},
	"smoke": {"colors": ["#3a3038", "#241c20"], "size": 0.14, "speed": 0.3, "gravity": 0.25, "life": 3.0, "glow": false},
	"ash": {"colors": ["#9a9693", "#6a6460"], "size": 0.03, "speed": 0.25, "gravity": -0.15, "life": 3.5, "glow": false},
}

var fx := {}
var _mesh: Node3D
var _rest := Transform3D.IDENTITY
var _material: ShaderMaterial
var _base_energy := 1.6
var _light: OmniLight3D
var _light_energy := 1.0
var _time := 0.0
var _height := 1.0


func _ready() -> void:
	fx = load_fx(asset)
	_mesh = get_parent().get_node_or_null("Mesh")
	if _mesh == null:
		return
	_rest = _mesh.transform
	var aabb: AABB = (_mesh as MeshInstance3D).mesh.get_aabb()
	_height = maxf(aabb.size.y, 0.2)
	_time = randf() * 10.0
	if fx.glow_pulse > 0.0:
		var mat := (_mesh as MeshInstance3D).mesh.surface_get_material(0)
		if mat is ShaderMaterial:
			_material = mat.duplicate()
			(_mesh as MeshInstance3D).set_surface_override_material(0, _material)
			_base_energy = _material.get_shader_parameter("emission_energy") if _material.get_shader_parameter("emission_energy") != null else 1.6
	_light = get_parent().get_node_or_null("EmberLight")
	if _light:
		_light_energy = _light.light_energy
	for kind: String in fx.particles:
		add_child(_make_particles(kind, aabb))


func _process(delta: float) -> void:
	if _mesh == null:
		return
	_time += delta * fx.idle_speed
	var a: float = fx.idle_amount
	var t := _rest
	match fx.idle:
		"bob":
			t.origin.y += sin(_time * 2.0) * 0.04 * a * _height
		"breathe":
			var s := 1.0 + sin(_time * 1.5) * 0.03 * a
			t.basis = t.basis.scaled(Vector3(s, 1.0 + (s - 1.0) * 0.5, s))
		"sway":
			t.basis = t.basis.rotated(Vector3.FORWARD, sin(_time * 1.2) * 0.06 * a)
		"hover":
			t.origin.y += (0.06 + sin(_time * 1.6) * 0.05) * a * _height
			t.basis = t.basis.rotated(Vector3.UP, sin(_time * 0.7) * 0.15 * a)
		"pulse":
			var p := 1.0 + absf(sin(_time * 2.5)) * 0.05 * a
			t.basis = t.basis.scaled(Vector3(p, p, p))
	_mesh.transform = t
	var wave := 0.5 + 0.5 * sin(_time * 3.1)
	if _material:
		_material.set_shader_parameter("emission_energy", _base_energy * (1.0 + (wave - 0.5) * fx.glow_pulse))
	if _light and fx.light_flicker > 0.0:
		_light.light_energy = _light_energy * (1.0 - fx.light_flicker * 0.5 * (1.0 - wave))


func _make_particles(kind: String, aabb: AABB) -> CPUParticles3D:
	var spec: Dictionary = PARTICLES[kind]
	var p := CPUParticles3D.new()
	p.name = kind.capitalize()
	p.amount = int(lerpf(6.0, 60.0, fx.particle_amount))
	p.lifetime = spec.life
	p.preprocess = spec.life
	p.emission_shape = CPUParticles3D.EMISSION_SHAPE_BOX
	p.emission_box_extents = aabb.size * Vector3(0.4, 0.3, 0.4)
	p.position = aabb.get_center() + Vector3(0, aabb.size.y * 0.15, 0)
	p.direction = Vector3.UP
	p.spread = 25.0
	p.initial_velocity_min = spec.speed * 0.5
	p.initial_velocity_max = spec.speed
	p.gravity = Vector3(0, spec.gravity, 0)
	p.scale_amount_min = 0.6
	p.scale_amount_max = 1.2
	var ramp := Gradient.new()
	ramp.set_color(0, Color(spec.colors[0]))
	ramp.set_color(1, Color(Color(spec.colors[1]), 0.0))
	p.color_ramp = ramp
	var quad := QuadMesh.new()
	quad.size = Vector2.ONE * spec.size
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.vertex_color_use_as_albedo = true
	if spec.glow:
		mat.emission_enabled = true
		mat.emission = Color(spec.colors[0])
		mat.emission_energy_multiplier = 2.0
	quad.material = mat
	p.mesh = quad
	return p


## Reads and clamps assets/fx/<asset>.json.
static func load_fx(name: String) -> Dictionary:
	var out := {"idle": "none", "idle_speed": 1.0, "idle_amount": 0.5, "particles": [],
		"particle_amount": 0.3, "light_flicker": 0.0, "glow_pulse": 0.0}
	var path := "res://assets/fx/%s.json" % name
	if not FileAccess.file_exists(path):
		return out
	var data: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
	if not data is Dictionary:
		return out
	if data.get("idle") in ["none", "bob", "breathe", "sway", "hover", "pulse"]:
		out.idle = data.idle
	for key: String in ["idle_speed", "idle_amount", "particle_amount", "light_flicker", "glow_pulse"]:
		if data.get(key) is float or data.get(key) is int:
			out[key] = clampf(float(data[key]), 0.0, 3.0 if key == "idle_speed" else 1.0)
	if data.get("particles") is Array:
		for kind in data.particles:
			if kind is String and PARTICLES.has(kind) and not out.particles.has(kind) and out.particles.size() < 3:
				out.particles.append(kind)
	return out
