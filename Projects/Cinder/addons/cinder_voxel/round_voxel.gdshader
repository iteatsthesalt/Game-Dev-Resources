// Shader for round voxels (small spheres drawn by VoxelRound as a MultiMesh).
// Per instance: COLOR = linear albedo, INSTANCE_CUSTOM = (emission, roughness, metallic, seed).
shader_type spatial;
render_mode diffuse_burley, specular_schlick_ggx;

uniform float emission_energy : hint_range(0.0, 16.0) = 1.6;
uniform float flicker_strength : hint_range(0.0, 1.0) = 0.35;
uniform float flicker_speed : hint_range(0.0, 20.0) = 4.0;

varying vec4 data;

void vertex() {
	data = INSTANCE_CUSTOM;
}

void fragment() {
	ALBEDO = COLOR.rgb;
	ROUGHNESS = data.y;
	METALLIC = data.z;
	float h = data.w;
	float wave = 0.5 + 0.5 * sin(TIME * flicker_speed * (0.6 + h) + h * 6.2831);
	EMISSION = COLOR.rgb * data.x * emission_energy * (1.0 - flicker_strength * wave);
}
