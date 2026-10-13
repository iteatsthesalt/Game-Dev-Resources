extends SceneTree
## Builds playable voxel characters from design files.
##
##   godot --headless --path . --script res://tools/build_character.gd -- --heroes
##   godot --headless --path . --script res://tools/build_character.gd -- --design=/path/to/design.json
##
## Output: characters/built/<id>/ (part .vox files, rig.json, design.json).
## Prints one line per character: RESULT {"id":..., "notes": [...], "error": ""}.

const HERO_DIR := "res://characters/heroes/"


func _init() -> void:
	var files := PackedStringArray()
	for arg in OS.get_cmdline_user_args():
		if arg == "--heroes":
			for f in DirAccess.get_files_at(HERO_DIR):
				if f.ends_with(".json"):
					files.append(HERO_DIR + f)
		elif arg.begins_with("--design="):
			files.append(arg.trim_prefix("--design="))
	var failed := false
	for path in files:
		var start := Time.get_ticks_msec()
		var text := FileAccess.get_file_as_string(path)
		var checked := CharacterDesign.sanitize(text if text != "" else "")
		var report := {"file": path, "id": "", "notes": checked.notes, "error": checked.error}
		if checked.error == "" and text == "":
			report.error = "could not read %s" % path
		if report.error == "":
			report.id = checked.design.id
			report.error = CharacterBuilder.build_and_save(checked.design)
		report.ms = Time.get_ticks_msec() - start
		failed = failed or report.error != ""
		print("RESULT " + JSON.stringify(report))
	quit(1 if failed else 0)
