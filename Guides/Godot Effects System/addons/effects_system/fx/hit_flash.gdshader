// Silhouette flash for sprites. Assign as the sprite's material and Fx.flash()
// (or a FlashCue) animates flash_amount instead of modulate.
// Tip: enable "Local to Scene" on the material so enemies don't flash together.
shader_type canvas_item;

uniform vec4 flash_color : source_color = vec4(1.0);
uniform float flash_amount : hint_range(0.0, 1.0) = 0.0;

void fragment() {
	// COLOR already holds the texture colour multiplied by modulate.
	COLOR.rgb = mix(COLOR.rgb, flash_color.rgb, flash_amount);
}
