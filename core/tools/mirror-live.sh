#!/usr/bin/env bash
# Mirrors the live feed to the orphan branch `live` (one commit, force-pushed, so no history accumulates).
# The research lane reads the live state from GitHub rather than from the site:
#   GET /repos/<owner>/<repo>/contents/latest.json?ref=live   (Accept: application/vnd.github.raw)
# Site name, slug and bot identity come from site.config.json in the repository root.
set -euo pipefail
HOST="$(node -p "JSON.parse(require('fs').readFileSync('site.config.json','utf8')).host")"
SLUG="$(node -p "JSON.parse(require('fs').readFileSync('site.config.json','utf8')).slug")"
BOT="$(node -p "const c=JSON.parse(require('fs').readFileSync('site.config.json','utf8'));c.bot||c.repo.split('/')[1]+'-bot'")"
SITE="${SITE:-https://$HOST}"
work="$(mktemp -d)"
curl -fsS "$SITE/api/$SLUG/feed" -o "$work/latest.json"
curl -fsS "$SITE/api/$SLUG/summary" -o "$work/summary.json"
curl -fsS "$SITE/api/$SLUG/runs" -o "$work/runs.json"
cat > "$work/README.md" <<EOT
# Live mirror of $HOST

Overwritten after every publish (single commit, force-pushed). Read-only; do not commit here.

- \`latest.json\`: the live feed (same as $SITE/api/$SLUG/feed)
- \`summary.json\`: the live summary
- \`runs.json\`: published run snapshots

Mirrored at $(date -u +%Y-%m-%dT%H:%M:%SZ).
EOT
cd "$work"
git init -q -b live
git config user.name "$BOT"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git add -A
git commit -q -m "Live mirror $(date -u +%Y-%m-%dT%H:%MZ)"
git push -q --force "https://x-access-token:${GH_TOKEN}@github.com/${GITHUB_REPOSITORY}.git" live:live
echo "Mirrored live feed to branch 'live' ($(wc -c < latest.json) bytes)."
