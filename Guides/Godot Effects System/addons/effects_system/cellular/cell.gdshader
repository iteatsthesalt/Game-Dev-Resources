// Living cells, drawn as voxels by CellField. Per-instance data:
//   COLOR.rgb         strain colour (already mixed by energy, darkened when dormant)
//   COLOR.a           position along the root's supply network (0 = not connected)
//   INSTANCE_CUSTOM.x energy, 0..1 of the strain's maximum
//   INSTANCE_CUSTOM.y growth, 0 (seed) .. 1 (mature)
//   INSTANCE_CUSTOM.z wound flash, 1 .. 0
//   INSTANCE_CUSTOM.w random per voxel
shader_type spatial;
render_mode cull_back;

uniform float emission_strength = 1.5;
uniform float flicker = 0.0;
uniform float rise = 0.0;
uniform float bob = 0.0;
// Bottom of the mesh in model space, so flames stretch up from the floor.
uniform float base_y = -0.5;
// Waves of light travelling out from the root along connected cells.
uniform float pulse = 0.0;

varying float v_energy;
varying float v_flash;
varying float v_shade;
varying float v_network;

void vertex() {
	float energy = INSTANCE_CUSTOM.x;
	float seed = INSTANCE_CUSTOM.w;
	float t = TIME * 7.0 + seed * 61.0;
	vec3 v = VERTEX;
	float stretch = 1.0 + rise * (0.35 + 0.65 * energy) * (0.75 + 0.25 * sin(t * 0.9));
	v.y = (v.y - base_y) * stretch + base_y;
	float top = clamp((v.y - base_y) / max(stretch, 0.001), 0.0, 1.0);
	v.xz *= 1.0 + flicker * (0.12 * sin(t) + 0.07 * sin(t * 2.3 + 1.7)) * (1.0 - 0.5 * top);
	v.x += flicker * 0.08 * sin(t * 1.3 + v.y * 9.0) * top;
	v.y += bob * 0.2 * sin(TIME * 1.7 + seed * 40.0);
	VERTEX = v;
	v_energy = energy;
	v_flash = INSTANCE_CUSTOM.z;
	v_shade = 0.88 + 0.24 * seed;
	v_network = COLOR.a;
}

void fragment() {
	vec3 col = COLOR.rgb * v_shade;
	ALBEDO = mix(col * 0.45, vec3(1.0), v_flash * 0.7);
	ROUGHNESS = 0.85;
	EMISSION = col * emission_strength * (0.25 + v_energy) + vec3(1.0, 0.95, 0.9) * v_flash * 2.5;
	if (pulse > 0.0 && v_network > 0.0) {
		float wave = pow(0.5 + 0.5 * sin(TIME * 3.0 - v_network * 6.2832 * 3.0), 8.0);
		EMISSION += col * emission_strength * 0.9 * pulse * wave;
	}
}
