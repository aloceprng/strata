import importlib.util
import json
import shutil
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]


@pytest.fixture
def cli(monkeypatch, tmp_path):
    spec = importlib.util.spec_from_file_location("build_tokens", REPO / "tools" / "build_tokens.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    tokens = tmp_path / "tokens"
    shutil.copytree(REPO / "tokens", tokens)
    monkeypatch.setattr(module, "TOKENS_DIR", tokens)
    monkeypatch.setattr(module, "ROOT", tmp_path)

    def run(*argv):
        monkeypatch.setattr(sys, "argv", ["build_tokens.py", *argv])
        return module.main()

    run.module = module
    run.tokens = tokens
    return run


def test_builds_every_brand_into_latest(cli, tmp_path, capsys):
    out = tmp_path / "dist"
    assert cli("--out", str(out)) == 0
    for brand in ("clementine", "kumquat", "pomelo"):
        assert (out / brand / "latest" / "theme.css").exists()
        assert (out / brand / "latest" / "tokens.json").exists()
    assert "Building 3 brand(s)" in capsys.readouterr().out


def test_one_brand_with_a_version_writes_both_targets(cli, tmp_path):
    out = tmp_path / "dist"
    assert cli("pomelo", "--version", "v2", "--out", str(out)) == 0
    assert sorted(p.name for p in (out / "pomelo").iterdir()) == ["latest", "v2"]
    assert not (out / "kumquat").exists()


def test_an_unknown_brand_fails(cli, tmp_path, capsys):
    assert cli("grapefruit", "--out", str(tmp_path)) == 1
    assert "grapefruit: no token file" in capsys.readouterr().out


def test_a_broken_brand_fails_but_the_others_still_build(cli, tmp_path, capsys):
    path = cli.tokens / "pomelo.tokens.json"
    document = json.loads(path.read_text(encoding="utf-8"))
    document["semantic"]["colour"]["action"]["bg"]["$value"] = "{primitive.colour.nope}"
    path.write_text(json.dumps(document), encoding="utf-8")
    out = tmp_path / "dist"
    assert cli("--out", str(out)) == 1
    assert "pomelo: FAILED" in capsys.readouterr().out
    assert (out / "kumquat" / "latest" / "theme.css").exists()


def test_no_token_files_is_an_error(cli, tmp_path, capsys):
    for path in cli.tokens.glob("*.tokens.json"):
        path.unlink()
    assert cli("--out", str(tmp_path)) == 1
    assert "No token files found" in capsys.readouterr().out


def test_output_inside_the_repo_is_shown_relative(cli, tmp_path, capsys):
    assert cli("kumquat", "--out", str(tmp_path / "dist")) == 0
    assert "into dist/" in capsys.readouterr().out


def test_output_outside_the_repo_is_shown_absolute(cli, tmp_path_factory, capsys):
    elsewhere = tmp_path_factory.mktemp("elsewhere")
    assert cli("kumquat", "--out", str(elsewhere)) == 0
    assert f"into {elsewhere.as_posix()}/" in capsys.readouterr().out
