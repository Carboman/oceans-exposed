# The publishing contract

The contract is what the research lane may publish and how the site reads it. It lives in this folder:

| File | What it is |
|---|---|
| `ocean-intelligence.schema.json` | Machine-readable definition of `runs/<folder>/feed.json` (JSON Schema 2020-12) |
| `VERSION` | Current contract version (semver). Must equal the schema's `contract_version`. |
| `CHANGELOG.md` | Every accepted change, newest first |
| `examples/finding.feed.json` | One valid feed with an example record per shape (a sea-bound finding, a global one) |
| `proposals/` | Written proposals (one Markdown file each) |

## Who decides

| Role | Who | Can do |
|---|---|---|
| **Owner** | Allen (repo owner) | Final authority. Approves every **breaking** change. Can veto anything. |
| **Proposer** | Claude Code or the owner | Proposes changes by pull request (edits in `contract/` only) or a `contract-change` issue. |
| **Implementer** | Claude Code | Reviews proposals; implements them in the converter, validation, API and site; merges; bumps versions; writes the changelog. |

**Non-breaking changes** (new optional fields, new enum values such as a sea code, looser limits) are merged by
Claude Code once the site supports them. **Breaking changes** (new required fields, removed or renamed fields or
values, stricter limits that would reject past runs) need the owner's explicit approval: a comment from the owner
on the pull request or issue saying "approved", or the owner telling Claude Code directly.

Because the proposer and the implementer are usually the same account, approval is never inferred from labels,
reviews or merges. It is always the owner's own words.

## How a change flows

1. **Propose.** Claude Code, or the owner, either:
   - opens a pull request from a branch `contract/<short-name>` that edits files only under `contract/`
     (the schema, plus `proposals/<date>-<short-name>.md` explaining the why, the new fields and an example record), or
   - opens an issue labeled `contract-change` (and `claude-task`) with the same content.
2. **Check.** The **Contract check** workflow runs on every pull request touching `contract/**`. It verifies that the
   schema compiles, that every past run is still valid (or lists the runs that would break), and that the
   version was bumped. It posts its report on the pull request and labels it `contract-change` (plus `breaking` if needed).
3. **Decide.** Non-breaking: Claude Code proceeds. Breaking: Claude Code waits for the owner's approval.
4. **Implement.** Claude Code updates `src/model.js` or `src/geo.js` (vocabulary), `src/adapt.js`, `src/validate.js`,
   the API and the site so the new fields are accepted and displayed, then updates `docs/FEED_SPEC.md`,
   `docs/RESEARCH_PROMPT.md` (bumping its `instructions_version`) and `tools/research/BRIEF.template.md`, `VERSION`
   and `CHANGELOG.md`.
5. **Ship.** Claude Code merges. The site deploys automatically. The Daily research Action picks up the new prompt on
   its next run (it reads it from its checkout every run). Claude Code comments on the proposal with what shipped,
   and closes it.

Until a change ships, the research lane keeps publishing under the current contract. Never send new fields early:
unknown fields are kept but not shown, and new required fields would fail validation. The first planned change is
1.1.0, the monthly ocean indicators (`docs/OCEANS_EXPOSED_PLAN.md`).
