extends CharacterBody2D
## Demo character: walks back and forth at its "speed" stat, stops while it has
## a "control" tag (stun), uses "armor" to soften hits, and respawns when
## health runs out.

const LEFT := 150.0
const RIGHT := 1010.0

@onready var effects: EffectComponent = $EffectComponent
@onready var body: Node2D = $Body

var direction := 1.0
var dead := false


func _ready() -> void:
	# Armor flatly reduces damage from every source, never below 1.
	effects.change_filter = func(stat: StringName, amount: float, _instance: EffectInstance) -> float:
		if stat == &"health" and amount < 0.0:
			return minf(amount + effects.get_stat(&"armor"), -1.0)
		return amount
	effects.stat_depleted.connect(_on_stat_depleted)
	effects.stat_changed.connect(func(_stat: StringName, _old: float, _new: float) -> void: queue_redraw())


func _physics_process(delta: float) -> void:
	if dead or effects.has_tag(&"control"):
		return
	position.x += direction * effects.get_stat(&"speed") * delta
	if position.x > RIGHT or position.x < LEFT:
		direction = -direction
		position.x = clampf(position.x, LEFT, RIGHT)
	body.scale.x = direction
	# A little bob that speeds up with the speed stat.
	body.position.y = -absf(sin(Time.get_ticks_msec() * 0.0001 * effects.get_stat(&"speed"))) * 6.0


func _draw() -> void:
	var health := effects.get_stat(&"health")
	var maximum := maxf(effects.get_stat(&"max_health"), 1.0)
	var bar := Rect2(-40, -84, 80, 8)
	draw_rect(bar.grow(2), Color(0, 0, 0, 0.6))
	draw_rect(Rect2(bar.position, Vector2(bar.size.x * health / maximum, bar.size.y)),
		Color(0.35, 0.9, 0.4) if health / maximum > 0.3 else Color(0.95, 0.3, 0.25))


func _on_stat_depleted(stat: StringName) -> void:
	if stat != &"health" or dead:
		return
	dead = true
	effects.clear_effects()
	body.rotation = PI * 0.5 * direction
	Fx.shake(0.8)
	Fx.hitstop(0.15)
	Fx.popup_text("K.O.", global_position + Vector2(0, -110), Color(1, 0.35, 0.3))
	await get_tree().create_timer(1.5).timeout
	body.rotation = 0.0
	effects.set_base_stat(&"health", effects.get_stat(&"max_health"))
	Fx.popup_text("Back on my feet", global_position + Vector2(0, -110), Color(0.6, 1, 0.6))
	dead = false
