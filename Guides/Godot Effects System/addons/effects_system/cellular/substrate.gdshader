// Substrate voxels drawn by CellField when render_substrates is on.
//   COLOR             substrate colour
//   INSTANCE_CUSTOM.x emission
//   INSTANCE_CUSTOM.w random per voxel
shader_type spatial;
render_mode cull_back;

varying float v_glow;
varying float v_shade;

void vertex() {
	v_glow = INSTANCE_CUSTOM.x;
	v_shade = 0.86 + 0.28 * INSTANCE_CUSTOM.w;
}

void fragment() {
	vec3 col = COLOR.rgb * v_shade;
	ALBEDO = col;
	ROUGHNESS = 0.95;
	EMISSION = col * v_glow;
}
