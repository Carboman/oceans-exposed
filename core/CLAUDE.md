# exposed-core: notes for Claude Code

The shared pipeline every .exposed site vendors under `core/`. A change here reaches the sites only through a Core sync
pull request or a by-hand re-vendor, never silently.

- Behaviour changes need a `VERSION` bump and a `CHANGELOG.md` entry that says what changes for a site.
- Keep tools site-agnostic: every site-specific value comes from `site.config.json` through `tools/config.mjs`. Grep for
  `water`, `ocean`, `waste` before committing; none may appear outside `site.config.example.json` and the docs.
- Test a change by rendering both known configs (water, oceans) and diffing against the sites' live workflows; and by
  running the tools inside a site checkout (`node core/tools/contract-check.mjs`, `node core/tools/quality-check.mjs runs/<folder> --prev-run auto`).
- Never print tokens. Commit messages end with the Co-Authored-By line from the session's attribution instructions.
