#!/usr/bin/env python3
"""Print release notes for a tag: its CHANGELOG.md section plus install steps.

Usage: python scripts/release_notes.py v1.0.0
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REPO = "jjia63937-rgb/Claude-thinking-better"

INSTALL = f"""
## Install

**Claude apps (claude.ai / desktop):** download `think-better.zip` below (not the "Source code" archives), then open https://claude.ai/settings/capabilities, click **Upload skill** under Skills and turn it on.

**Claude Code (plugin):**
```
/plugin marketplace add {REPO}
/plugin install think-better@claude-thinking-better
```

**Any agent:** `npx skills add {REPO}`

**Claude Code (manual):** unzip `think-better.zip` into `~/.claude/skills/` (Windows: `%USERPROFILE%\\.claude\\skills\\`).

Full instructions: https://github.com/{REPO}#install
"""


def main():
    if len(sys.argv) != 2:
        sys.exit("usage: release_notes.py vX.Y.Z")
    version = sys.argv[1].lstrip("v")
    changelog = (ROOT / "CHANGELOG.md").read_text(encoding="utf-8")
    match = re.search(rf"^## \[{re.escape(version)}\].*?$(.*?)(?=^## \[|\Z)", changelog, re.MULTILINE | re.DOTALL)
    if not match:
        sys.exit(f"CHANGELOG.md has no section for [{version}]")
    print(match.group(1).strip())
    print(INSTALL)


if __name__ == "__main__":
    main()
