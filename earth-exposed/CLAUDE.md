# earth.exposed: notes for Claude Code

The hub of the .exposed network. Facts only: no advocacy, no rankings across sites, no company mentions, no credit
lines on the hub. Every number on the hub comes from a site's stats file (or, until a site ships one, from the hub's
adapter over the site's public feed) through `src/validate.js`; never type a figure into a page. Tagline on every
page: "Public data, mapped. No opinions."

## Routine

- `git pull --rebase` first. The Network refresh Action commits to `main` twice a day as `earth-exposed-bot`.
- `npm run check` before pushing; `node tools/chrome.mjs` after any change under `network/` (CI fails otherwise).
- Open `network-stale` issues mean a site has not answered for 3 days; the hub needs nothing, the site does.
- Pushes to `main` deploy through Deploy site.

## Guardrails

- Never print `CLOUDFLARE_API_TOKEN` or any token.
- Never edit `public/data/` by hand; run `node tools/refresh.mjs`.
- Never load a script from anywhere but cdnjs with an exact version; stylesheets only from Google Fonts.
- A contract change (`contract/`) that would reject a file a site publishes today is `breaking` and needs the
  owner's written approval; bump `contract/VERSION` and the changelog either way.
- Commit messages end with the Co-Authored-By line from the session's attribution instructions.
