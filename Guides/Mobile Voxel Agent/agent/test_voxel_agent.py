"""Boundary tests for voxel_agent. Run: python -m unittest test_voxel_agent"""
import json
import os
import tempfile
import unittest
from pathlib import Path

import voxel_agent as va

ASSET = {
    "name": "ember",
    "dimensions": [16, 16, 16],
    "palette": ["#26130F", "#D94B20", "#FFB52E"],
    "voxels": [[4, 0, 7, 0], [4, 1, 7, 1]],
}


class AgentTest(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)
        self.config_dir = self.root / "config"
        self.config_dir.mkdir()
        for attr, name in (("MODE_FILE", "mode"), ("STOP_FILE", "STOP")):
            original = getattr(va, attr)
            self.addCleanup(setattr, va, attr, original)
            setattr(va, attr, self.config_dir / name)
        (self.config_dir / "mode").write_text("local\n")

        self.workspace = self.root / "workspace"
        self.session = self.workspace / "sessions" / "20261012-120000"
        self.session.mkdir(parents=True)
        (self.session / ".git").write_text("gitdir: elsewhere\n")
        (self.session / "project.godot").write_text("")
        self.config = {"workspace": str(self.workspace), "limits": dict(va.DEFAULT_LIMITS)}

    def request(self, **overrides):
        asset = json.loads(json.dumps(ASSET))
        asset.update(overrides)
        return {"action": "write_voxel_spec",
                "path": f"assets/generated/{asset['name']}.json", "asset": asset}

    def test_valid_spec_writes_spec_and_manifest(self):
        va.execute(self.session, self.request(), self.config)
        spec = json.loads((self.session / "assets/generated/ember.json").read_text())
        self.assertEqual(spec, ASSET)
        manifest = json.loads((self.session / ".ai/manifests/ember.json").read_text())
        self.assertEqual(manifest["scene"], "res://scenes/generated/ember.tscn")

    def test_paths_denied(self):
        for path in ("/storage/emulated/0/x.json", "../../x.json",
                     "assets/generated/../../project.godot", "assets/x.json",
                     "assets/generated/ember.gd", "assets/generated/sub/ember.json",
                     "assets\\generated\\ember.json", "assets/generated//ember.json"):
            with self.subTest(path=path):
                request = self.request()
                request["path"] = path
                with self.assertRaises(va.Denied):
                    va.execute(self.session, request, self.config)

    def test_bounded_path_rejects_scripts_and_wrong_roots(self):
        for path, root in (("tools/build_voxel.gd", "tools"),
                           ("scenes/generated/x.tscn", va.SPEC_ROOT),
                           ("project.godot", "")):
            with self.subTest(path=path), self.assertRaises(va.Denied):
                va.bounded_path(self.session, path, root or va.SPEC_ROOT, ".json")

    def test_symlink_denied(self):
        outside = self.root / "outside"
        outside.mkdir()
        (self.session / "assets").mkdir()
        os.symlink(outside, self.session / "assets/generated")
        with self.assertRaises(va.Denied):
            va.execute(self.session, self.request(), self.config)
        self.assertEqual(list(outside.iterdir()), [])

    def test_invalid_assets_denied(self):
        cases = {
            "out of bounds": {"voxels": [[16, 0, 0, 0]]},
            "negative": {"voxels": [[-1, 0, 0, 0]]},
            "bad palette index": {"voxels": [[0, 0, 0, 3]]},
            "duplicate": {"voxels": [[0, 0, 0, 0], [0, 0, 0, 1]]},
            "float coord": {"voxels": [[0.5, 0, 0, 0]]},
            "bool coord": {"voxels": [[True, 0, 0, 0]]},
            "axis too big": {"dimensions": [65, 1, 1]},
            "two axes": {"dimensions": [4, 4]},
            "bad colour": {"palette": ["red"]},
            "bad name": {"name": "../ember"},
        }
        for label, overrides in cases.items():
            with self.subTest(label), self.assertRaises(va.Denied):
                va.execute(self.session, self.request(**overrides), self.config)

    def test_extra_keys_and_unknown_actions_denied(self):
        request = self.request()
        request["command"] = "rm -rf ~"
        with self.assertRaises(va.Denied):
            va.execute(self.session, request, self.config)
        for request in ({"action": "shell", "command": "ls"}, {"action": "write_file"}, []):
            with self.subTest(request=request), self.assertRaises(va.Denied):
                va.execute(self.session, request, self.config)

    def test_off_and_stop_block_actions(self):
        (self.config_dir / "mode").write_text("off\n")
        with self.assertRaises(RuntimeError):
            va.execute(self.session, self.request(), self.config)
        (self.config_dir / "mode").write_text("local\n")
        (self.config_dir / "STOP").touch()
        with self.assertRaises(RuntimeError):
            va.execute(self.session, self.request(), self.config)
        self.assertFalse((self.session / "assets").exists())

    def test_validate_requires_manifest(self):
        with self.assertRaises(va.Denied):
            va.execute(self.session, {"action": "validate_voxel", "name": "ember"}, self.config)

    def test_parse_request_rejects_prose(self):
        for text in ("Sure! Here it is", "```json\n{}\n```", "[1, 2]"):
            with self.subTest(text=text), self.assertRaises(va.Denied):
                va.parse_request(text)
        self.assertEqual(va.parse_request(' {"action": "done"} '), {"action": "done"})

    def test_endpoint_policy(self):
        config = {"local": {"base_url": "http://192.168.1.5:8080/v1", "model": "m"},
                  "remote": {"base_url": "http://provider.example/v1", "model": "m"}}
        for mode in ("local", "remote"):
            with self.subTest(mode=mode), self.assertRaises(RuntimeError):
                va.endpoint(config, mode)
        config["local"]["base_url"] = "http://127.0.0.1:8080/v1"
        self.assertEqual(va.endpoint(config, "local")["base_url"], "http://127.0.0.1:8080/v1")

    def test_check_session(self):
        self.assertEqual(va.check_session(self.workspace, self.session), self.session.resolve())
        project = self.workspace / "project"
        project.mkdir()
        with self.assertRaises(va.Denied):
            va.check_session(self.workspace, project)


if __name__ == "__main__":
    unittest.main()
