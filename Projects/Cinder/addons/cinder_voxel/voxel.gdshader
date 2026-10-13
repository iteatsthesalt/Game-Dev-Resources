// Voxel surface shader used by VoxelMesher meshes.
// Vertex data: COLOR = linear albedo, UV = (emission, ao), UV2 = (roughness, metallic).
shader_type spatial;
render_mode diffuse_burley, specular_schlick_ggx;

// Size of one voxel in mesh units; must match the value passed to VoxelMesher.
uniform float voxel_size = 0.03125;
uniform float ao_strength : hint_range(0.0, 1.0) = 1.0;
uniform float emission_energy : hint_range(0.0, 16.0) = 1.6;
// Per-voxel shimmer on emissive voxels (embers, flames, crystals).
uniform float flicker_strength : hint_range(0.0, 1.0) = 0.35;
uniform float flicker_speed : hint_range(0.0, 20.0) = 4.0;
// Slight darkening along voxel borders so individual voxels still read on
// greedy-merged faces. Fades out when voxels get small on screen.
uniform float edge_darken : hint_range(0.0, 0.5) = 0.1;
uniform float edge_width : hint_range(0.0, 0.5) = 0.07;

varying vec3 grid_pos;
varying vec3 grid_normal;

void vertex() {
	grid_pos = VERTEX / voxel_size;
	grid_normal = NORMAL;
}

float hash13(vec3 p) {
	p = fract(p * 0.1031);
	p += dot(p, p.zyx + 31.32);
	return fract((p.x + p.y) * p.z);
}

void fragment() {
	float emit = UV.x;
	float ao = mix(1.0, UV.y, ao_strength);

	// Distance (0 = centre, 0.5 = border) to the nearest voxel edge in the face plane.
	vec3 axis = abs(grid_normal);
	vec3 f = abs(fract(grid_pos) - 0.5) * (1.0 - axis);
	float edge = max(f.x, max(f.y, f.z));
	float fw = length(fwidth(grid_pos));
	float edge_mask = smoothstep(0.5 - edge_width - fw, 0.5, edge) * (1.0 - smoothstep(0.15, 0.45, fw));
	float shade = 1.0 - edge_darken * edge_mask;

	float glowing = step(0.001, emit);
	ALBEDO = COLOR.rgb * shade * mix(ao, 1.0, glowing);
	ROUGHNESS = UV2.x;
	METALLIC = UV2.y;

	vec3 cell = floor(grid_pos - grid_normal * 0.5);
	float h = hash13(cell + 17.0);
	float wave = 0.5 + 0.5 * sin(TIME * flicker_speed * (0.6 + h) + h * 6.2831);
	float flicker = 1.0 - flicker_strength * wave;
	EMISSION = COLOR.rgb * emit * emission_energy * flicker * shade;
}
