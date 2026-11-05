class_name EffectTags
extends RefCounted
## Hierarchical tag matching. Tags use dots for hierarchy, so the query
## [code]debuff[/code] matches [code]debuff[/code] and [code]debuff.poison[/code],
## but not [code]debuffed[/code].


## True if [param tag] is [param query] or a child of it.
static func matches(tag: StringName, query: StringName) -> bool:
	if tag == query:
		return true
	var t := String(tag)
	var q := String(query)
	return t.length() > q.length() and t.begins_with(q) and t[q.length()] == "."


static func any_matches(tags: Array, query: StringName) -> bool:
	for tag in tags:
		if matches(tag, query):
			return true
	return false
