name: Core sync

# Weekly: compares the vendored core/ with the latest exposed-core main and opens (or updates) one pull request with the
# update and the re-rendered workflows. Nothing updates silently; the site stays on its current core until the PR merges.
# Needs the repository secret CORE_SYNC_TOKEN: a fine-grained token with Contents, Workflows and Pull requests read/write
# on this repository and Contents read on exposed-core. (The built-in token cannot read the private core or push changes
# to workflow files.) Also "Allow GitHub Actions to create and approve pull requests" (Settings > Actions > General).
on:
  schedule:
    - cron: '37 6 * * 1'
  workflow_dispatch:

permissions:
  contents: write
  pull-requests: write

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: 22
      - name: Check the token
        env:
          T: ${{ secrets.CORE_SYNC_TOKEN }}
        run: |
          [ -n "$T" ] || { echo "::error::CORE_SYNC_TOKEN secret is not set (see core/README.md)."; exit 1; }
      - name: Fetch the latest core
        env:
          GH_TOKEN: ${{ secrets.CORE_SYNC_TOKEN }}
        run: |
          git clone --depth 1 "https://x-access-token:${GH_TOKEN}@github.com/Carboman/exposed-core.git" "$RUNNER_TEMP/core"
          new=$(cat "$RUNNER_TEMP/core/VERSION"); cur=$(cat core/VERSION)
          echo "current core $cur, latest $new"
          echo "new=$new" >> "$GITHUB_ENV"; echo "cur=$cur" >> "$GITHUB_ENV"
      - name: Update the vendored copy and re-render
        run: |
          rsync -a --delete --exclude .git "$RUNNER_TEMP/core/" core/
          node core/tools/render-workflows.mjs
          git status --short
      - name: Open or update the pull request
        env:
          GH_TOKEN: ${{ secrets.CORE_SYNC_TOKEN }}
        run: |
          if git diff --quiet; then echo "Core is current."; exit 0; fi
          git config user.name "{{BOT_NAME}}"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git checkout -B core/update
          git add -A
          git commit -q -m "Core update: exposed-core $cur -> $new" -m "Vendored core/ refreshed and workflows re-rendered by the Core sync Action."
          git push -f "https://x-access-token:${GH_TOKEN}@github.com/${GITHUB_REPOSITORY}.git" core/update
          n=$(gh pr list --head core/update --state open --json number --jq '.[0].number')
          if [ -z "$n" ]; then gh pr create --head core/update --base main --title "Core update: exposed-core $new" --body "Vendored \`core/\` refreshed from exposed-core \`$new\` (was \`$cur\`) and the workflows re-rendered. Review the diff, run \`npm run check\`, merge."; else gh pr edit "$n" --title "Core update: exposed-core $new"; fi
