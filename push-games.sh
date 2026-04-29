#!/bin/bash
set -e

REPO="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO"

MSG=${1:-"Update game data — $(date '+%Y-%m-%d')"}

# Stage all game files across all dashboards
git add 2026/public/games/ 2026-scrimmage/public/games/

# Nothing to commit?
if git diff --cached --quiet; then
  echo "No new or changed game files found. Nothing to push."
  exit 0
fi

echo "Staged files:"
git diff --cached --name-only
echo ""

git commit -m "$MSG"
git push

echo ""
echo "Pushed. GitHub Actions is now rebuilding the dashboards."
echo "Watch progress at: https://github.com/druskim/Women_stats_dashboard/actions"
