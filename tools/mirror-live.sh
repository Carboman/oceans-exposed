#!/usr/bin/env bash
# Mirrors the live feed to the orphan branch `live` (one commit, force-pushed, so no history accumulates).
# Research sessions without network access to the site read the live state from GitHub instead:
#   GET /repos/Carboman/oceans-exposed/contents/latest.json?ref=live   (Accept: application/vnd.github.raw)
set -euo pipefail
SITE="${SITE:-https://oceans.exposed}"
work="$(mktemp -d)"
curl -fsS "$SITE/api/ocean/feed" -o "$work/latest.json"
curl -fsS "$SITE/api/ocean/summary" -o "$work/summary.json"
curl -fsS "$SITE/api/ocean/runs" -o "$work/runs.json"
cat > "$work/README.md" <<EOF
# Live mirror of oceans.exposed

Overwritten after every publish (single commit, force-pushed). Read-only; do not commit here.

- \`latest.json\`: the live feed (same as $SITE/api/ocean/feed)
- \`summary.json\`: the live summary
- \`runs.json\`: published run snapshots

Mirrored at $(date -u +%Y-%m-%dT%H:%M:%SZ).
EOF
cd "$work"
git init -q -b live
git config user.name "oceans-exposed-bot"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git add -A
git commit -q -m "Live mirror $(date -u +%Y-%m-%dT%H:%MZ)"
git push -q --force "https://x-access-token:${GH_TOKEN}@github.com/${GITHUB_REPOSITORY}.git" live:live
echo "Mirrored live feed to branch 'live' ($(wc -c < latest.json) bytes)."
