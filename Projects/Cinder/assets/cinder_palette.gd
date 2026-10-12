class_name CinderPalette
extends RefCounted
## Cinderdeep's colour ramps, dark to light, sampled from the original sprites
## (reference/cinderdeep/) and the game's UI tokens (soot, bone, ember, gold).
##
## Keep every voxel asset on these ramps so the set reads as one world: cool
## soot and ash, warm bark and stone, saturated ember as the accent.

## Outline/soot black used by every Cinderdeep sprite.
const SOOT := ["#0c070a", "#120a0e", "#1a1418", "#241c20", "#2a2228", "#3a3038"]
const ASH := ["#272322", "#2c2726", "#3a3432", "#484441", "#534e4c", "#6a6460", "#7d7874", "#9a9693"]
const CHAR := ["#120a0e", "#1b1111", "#241616", "#2e2222", "#3f3131", "#514444", "#5f5353"]
const BASALT := ["#1a1418", "#241c22", "#2e2630", "#3a3240", "#4a4252"]
const STONE := ["#2e2622", "#3e342e", "#514640", "#675a52", "#7f7068"]
const BARK := ["#1a1214", "#231915", "#2e211c", "#3a2a24", "#4a3830"]
const FUR := ["#1a1214", "#271d1b", "#312322", "#3a2a28", "#443533", "#534544", "#796e6d"]
const BONE := ["#b3a898", "#d4c6b0", "#ebdcc4", "#f4ead8"]
const FLESH := ["#c9a89a", "#ebc8ba", "#efd4c9"]
const IRON := ["#1a1418", "#2a2228", "#3a3038", "#554e53", "#7a727a"]
const STEEL := ["#615c5a", "#84807e", "#b3b0b4", "#dcdde4"]
const BRASS := ["#7a5214", "#a8741c", "#c8901c", "#ffd35c"]
const CLOTH_RED := ["#3e0a0e", "#611215", "#8a1a1e", "#a8282a"]
const CLOTH_ORANGE := ["#7a3812", "#ad531d", "#bf5c20", "#d66623", "#ff8b45"]

## Glowing ramps (use with emission > 0).
const EMBER := ["#a8361c", "#c4401c", "#ff7a2a", "#ff9a3c", "#ffb35e", "#ffd08a"]
const FLAME := ["#ff4614", "#ff7a2a", "#ff9a3c", "#ffc44a", "#ffe9a0"]
const LAVA := ["#611215", "#a8261a", "#e2432a", "#ff7a2a", "#ffb35e"]
const GOLD := ["#c8901c", "#ffd35c", "#ffe08a"]
const CRYSTAL := ["#6e1207", "#a8230b", "#e5431a", "#ff7a32", "#ffbe6a", "#fff0c0"]
