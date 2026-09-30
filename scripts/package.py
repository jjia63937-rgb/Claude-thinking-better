#!/usr/bin/env python3
"""Validate each skill under skills/ and package it for release.

For every skills/<name>/SKILL.md this writes two identical archives to dist/:
  <name>.skill  - opens with the "Save skill" button in the Claude apps
  <name>.zip    - for uploading in claude.ai settings or unzipping into ~/.claude/skills

Each archive contains a single <name>/ folder. The evals/ folder is left out,
since it's only used for testing the skill.

Usage:
  python scripts/package.py                    # validate and package
  python scripts/package.py --check-version v1.2.0
                                               # also require the marketplace version to match the tag
"""
import argparse
import json
import re
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SKILLS_DIR = ROOT / "skills"
DIST = ROOT / "dist"
MARKETPLACE = ROOT / ".claude-plugin" / "marketplace.json"

ALLOWED_KEYS = {"name", "description", "license", "allowed-tools", "metadata", "compatibility"}
EXCLUDE_DIRS = {"evals", "__pycache__"}
EXCLUDE_FILES = {".DS_Store"}


def fail(msg):
    print(f"error: {msg}", file=sys.stderr)
    sys.exit(1)


def read_frontmatter(skill_md):
    text = skill_md.read_text(encoding="utf-8")
    match = re.match(r"^---\n(.*?)\n---\n", text, re.DOTALL)
    if not match:
        fail(f"{skill_md}: missing YAML frontmatter")
    fields = {}
    for line in match.group(1).splitlines():
        # Top-level keys only; indented lines belong to a nested value such as metadata.
        m = re.match(r"^([A-Za-z][\w-]*):\s*(.*)$", line)
        if m:
            fields[m.group(1)] = m.group(2).strip()
    return fields


def validate(skill_dir):
    skill_md = skill_dir / "SKILL.md"
    fields = read_frontmatter(skill_md)
    unexpected = set(fields) - ALLOWED_KEYS
    if unexpected:
        fail(f"{skill_md}: unexpected frontmatter keys {sorted(unexpected)}")
    name = fields.get("name", "")
    if name != skill_dir.name:
        fail(f"{skill_md}: name '{name}' must match folder name '{skill_dir.name}'")
    if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", name) or len(name) > 64:
        fail(f"{skill_md}: name must be lowercase letters, digits and hyphens (max 64)")
    description = fields.get("description", "")
    if not description:
        fail(f"{skill_md}: description is required")
    if len(description) > 1024:
        fail(f"{skill_md}: description is {len(description)} chars (max 1024)")
    # Every file the skill points to must exist.
    body = skill_md.read_text(encoding="utf-8")
    for ref in set(re.findall(r"`((?:agents|references|scripts|assets)/[^`\s]+)`", body)):
        if not (skill_dir / ref).exists():
            fail(f"{skill_md}: references missing file {ref}")


def package(skill_dir):
    files = [
        p for p in sorted(skill_dir.rglob("*"))
        if p.is_file()
        and p.name not in EXCLUDE_FILES
        and not set(p.relative_to(skill_dir).parts[:-1]) & EXCLUDE_DIRS
    ]
    outputs = []
    for ext in (".skill", ".zip"):
        out = DIST / f"{skill_dir.name}{ext}"
        with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
            for p in files:
                zf.write(p, Path(skill_dir.name) / p.relative_to(skill_dir))
        outputs.append(out)
    return files, outputs


def check_marketplace(tag):
    data = json.loads(MARKETPLACE.read_text(encoding="utf-8"))
    for plugin in data["plugins"]:
        for path in plugin.get("skills", []):
            if not (ROOT / path / "SKILL.md").exists():
                fail(f"marketplace.json: plugin '{plugin['name']}' points to missing skill {path}")
    if tag is not None:
        version = data["metadata"]["version"]
        if tag.lstrip("v") != version:
            fail(f"tag {tag} does not match marketplace.json version {version}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check-version", metavar="TAG", help="require marketplace.json version to match TAG")
    args = parser.parse_args()

    skill_dirs = sorted(p.parent for p in SKILLS_DIR.glob("*/SKILL.md"))
    if not skill_dirs:
        fail("no skills found under skills/")
    check_marketplace(args.check_version)
    DIST.mkdir(exist_ok=True)
    for skill_dir in skill_dirs:
        validate(skill_dir)
        files, outputs = package(skill_dir)
        print(f"{skill_dir.name}: {len(files)} files -> {', '.join(o.name for o in outputs)}")


if __name__ == "__main__":
    main()
