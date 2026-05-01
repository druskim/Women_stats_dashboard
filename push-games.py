#!/usr/bin/env python3
"""Stage and push all game Excel files across every dashboard."""

import subprocess
import sys
from datetime import date
from pathlib import Path

GAME_DIRS = [
    "2026/public/games/",
    "2026-scrimmage/public/games/",
    "opponents/public/games/",
]

ACTIONS_URL = "https://github.com/druskim/Women_stats_dashboard/actions"


def run(args, cwd):
    return subprocess.run(args, cwd=cwd, capture_output=True, text=True)


def main():
    repo = Path(__file__).resolve().parent

    msg = sys.argv[1] if len(sys.argv) > 1 else f"Update game data — {date.today()}"

    result = run(["git", "add"] + GAME_DIRS, cwd=repo)
    if result.returncode != 0:
        print(result.stderr.strip())
        sys.exit(result.returncode)

    diff = run(["git", "diff", "--cached", "--quiet"], cwd=repo)
    if diff.returncode == 0:
        print("No new or changed game files found. Nothing to push.")
        sys.exit(0)

    staged = run(["git", "diff", "--cached", "--name-only"], cwd=repo)
    print("Staged files:")
    print(staged.stdout.strip())
    print()

    commit = run(["git", "commit", "-m", msg], cwd=repo)
    if commit.returncode != 0:
        print(commit.stderr.strip())
        sys.exit(commit.returncode)

    push = run(["git", "push"], cwd=repo)
    if push.returncode != 0:
        print(push.stderr.strip())
        sys.exit(push.returncode)

    print("Pushed. GitHub Actions is now rebuilding the dashboards.")
    print(f"Watch progress at: {ACTIONS_URL}")


if __name__ == "__main__":
    main()
