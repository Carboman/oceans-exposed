# Turn on automatic deploys (GitHub → Cloudflare) for earth.exposed

Same pattern as oceans.exposed (`docs/AUTO_DEPLOY_SETUP.md` there), with one difference: the hub has no R2 bucket
and no publish token, so there is exactly one secret.

1. **Zone.** `earth.exposed` in account `a0268f33dbddbfc9ca056d7575f661b3`, no A, AAAA or CNAME on the apex.
   Wrangler creates the custom-domain record on the first deploy.
2. **Token.** https://dash.cloudflare.com/profile/api-tokens → Create Token → *Edit Cloudflare Workers* template.
   Name `github-actions-earth-exposed`. Add *Zone · DNS · Edit* and *Zone · Zone · Read*. Account Resources: your
   account. Zone Resources: Specific zone → **earth.exposed** only. Copy the token once; never paste it into chat or a
   file.
3. **Secret.** https://github.com/Carboman/earth-exposed/settings/secrets/actions → New repository secret →
   `CLOUDFLARE_API_TOKEN`. (Or `gh secret set CLOUDFLARE_API_TOKEN --repo Carboman/earth-exposed`.)
4. **Bootstrap.** Actions → Bootstrap site → Run workflow. It refreshes the snapshot from the live sites, commits it,
   deploys, and waits for https://earth.exposed to answer.
5. **Analytics.** Dashboard → Analytics & Logs → Web Analytics → Add a site → earth.exposed → automatic setup. Or set
   `CF_BEACON_TOKEN` in `wrangler.jsonc` → `vars` (the token is not a secret; it is visible in every page that carries
   the beacon) and push: the Worker injects the beacon.

After that: pushes to `main` under `src/`, `public/`, `network/`, `tools/` or `tests/` deploy through **Deploy site**;
the **Network refresh** Action commits a new snapshot twice a day, which deploys the same way.

| Symptom | Fix |
|---|---|
| "secret not set; skipping deploy" | Step 3, name exactly `CLOUDFLARE_API_TOKEN` |
| `Authentication error [code: 10000]` | Add the missing permission row (step 2) |
| Custom-domain error | Zone not in the token, or a record already on the apex (step 1) |
| Refresh commits but nothing deploys | Deploy site's `paths` include `public/**`; check the Actions tab for the run |
