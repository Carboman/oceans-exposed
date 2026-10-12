# Turn on automatic deploys (GitHub → Cloudflare)

**What this does:** after setup, any code change pushed to `main` (in `src/`, `public/`,
`wrangler.jsonc` or `package*.json`) deploys to https://oceans.exposed on its own, through the
**Deploy site** GitHub Action. Until then the Action runs its checks and skips the deploy with a warning.

**You do not need this for data.** Research runs published through the **Stage runs** and **Publish runs**
Actions use the publish token (`PUBLISH_TOKEN`), not a Cloudflare token. Part 4 sets that token on the Worker.

Time: about 15 minutes. You need to be logged in to Cloudflare (allen.witters@gmail.com) and to
GitHub as `Carboman`. The zone `oceans.exposed` must already be in the account
(`a0268f33dbddbfc9ca056d7575f661b3`) with no A, AAAA or CNAME record on the apex: Wrangler creates the
custom-domain record on the first deploy and fails if one is in the way. The R2 bucket
`oceans-exposed-reports` must exist (R2 Object Storage → Create bucket, no public access).

---

## Part 1: Create the Cloudflare API token

1. Open **https://dash.cloudflare.com/profile/api-tokens**
   (or Cloudflare dashboard → your profile icon, top right → **My Profile** → **API Tokens**).
2. Click **Create Token**.
3. Find the **Edit Cloudflare Workers** template and click **Use template**.
4. **Token name** (pencil icon at the top): rename it to `github-actions-oceans-exposed`. A separate token from
   water.exposed means rotating one site's token never breaks the other.
5. **Permissions:** keep the template's rows, then click **+ Add more** and add these two rows if they
   are not already listed:

   | Type | Resource | Access |
   |---|---|---|
   | Zone | DNS | Edit |
   | Zone | Zone | Read |

   These let the deploy keep the `oceans.exposed` custom domain attached. The template already includes
   *Account · Workers Scripts · Edit* and *Zone · Workers Routes · Edit*, which do the deploy itself.
6. **Account Resources:** `Include` → **Allen.witters@gmail.com's Account**.
7. **Zone Resources:** `Include` → `Specific zone` → **oceans.exposed**.
   Do not pick "All zones". The token should only touch this site.
8. **Client IP Address Filtering:** leave empty. GitHub's runners use changing IP addresses.
9. **TTL:** optional. If you set an end date, deploys stop on that date until you create a new token
   (Part 5).
10. Click **Continue to summary**, check that it lists only your account and the `oceans.exposed` zone,
    then click **Create Token**.
11. **Copy the token now.** Cloudflare shows it only once. Keep it in your clipboard or a password
    manager for Part 2. Don't paste it into chat, email or a file in the repo.

**Optional check:** Cloudflare shows a ready-made `curl` test on the confirmation page. Run it in a
terminal. It should report `"status": "active"`.

---

## Part 2: Store the secrets in GitHub

1. Open **https://github.com/Carboman/oceans-exposed/settings/secrets/actions**
   (repo → **Settings** → left sidebar **Secrets and variables** → **Actions**).
2. Click **New repository secret**:
   - **Name:** `CLOUDFLARE_API_TOKEN`
   - **Secret:** paste the token from Part 1
   - Click **Add secret**.
3. Add **`PUBLISH_TOKEN`** the same way: generate it on your own machine with `openssl rand -hex 32`, paste the
   value, and keep it for Part 4 (the Worker needs the same value).
4. Add **`ANTHROPIC_API_KEY`** (a key created inside the Console workspace `oceans-exposed`; `docs/OPERATIONS.md`).
5. The account ID (`a0268f33dbddbfc9ca056d7575f661b3`) is not sensitive and is already set in `wrangler.jsonc`.
   The page should list `ANTHROPIC_API_KEY`, `CLOUDFLARE_API_TOKEN` and `PUBLISH_TOKEN`. Optional variables (the
   **Variables** tab): `RESEARCH_MODEL` (default `claude-sonnet-5-5`), `ANTHROPIC_WORKSPACE_ID`,
   `RESEARCH_FALLBACK_AUTO`.

*Command-line alternative* (prompts for the value without displaying it):
```
gh secret set CLOUDFLARE_API_TOKEN --repo Carboman/oceans-exposed
gh secret set PUBLISH_TOKEN --repo Carboman/oceans-exposed
gh secret set ANTHROPIC_API_KEY --repo Carboman/oceans-exposed
```

---

## Part 3: Test the deploy

1. Open **https://github.com/Carboman/oceans-exposed/actions/workflows/deploy.yml**.
2. Click **Run workflow** (right side) → branch `main` → **Run workflow**.
3. Open the new run after a few seconds. It takes 1–2 minutes. Success looks like:
   - a green check on **deploy**;
   - in the **Deploy** step log: `Uploaded oceans-exposed`, `oceans.exposed (custom domain)`, and a
     `Current Version ID`;
   - **no** yellow warning saying "CLOUDFLARE_API_TOKEN secret not set; skipping deploy".
4. Open https://oceans.exposed. It should render the sample feed with the sample-data banner, and
   `curl -s https://oceans.exposed/api/ocean/summary` should answer.

*Command-line alternative:*
```
gh workflow run deploy.yml --repo Carboman/oceans-exposed
gh run watch --repo Carboman/oceans-exposed
```

---

## Part 4: The Worker secret (after the first deploy)

The Worker reads the publish token from its own secret, separate from the GitHub secret. After the first
Deploy site run succeeds, set it once from a machine logged in to Wrangler, in the repository checkout:

```
npx wrangler secret put PUBLISH_TOKEN
```

and paste the value from Part 2 step 3. (Or: Cloudflare dashboard → Workers & Pages → `oceans-exposed` →
Settings → Variables and Secrets → Add → type Secret.) Until this is set, publishes return 401 and the Stage
runs Action files a `publish-failed` issue, which is harmless. Redeploys keep the secret.

---

## Part 5: If something goes wrong

| Symptom in the Deploy log | Cause | Fix |
|---|---|---|
| Warning "secret not set; skipping deploy" | Secret missing or misspelled | Part 2. The name must be exactly `CLOUDFLARE_API_TOKEN` |
| `Authentication error [code: 10000]` | Token lacks a permission | Edit the token (API Tokens → ⋯ → Edit) and add the missing row from Part 1 step 5 |
| `Could not find zone for 'oceans.exposed'` or a custom-domain error | Zone not in the token's resources, or a DNS record already on the apex | Part 1 step 7: include the `oceans.exposed` zone; remove any placeholder record on `oceans.exposed` |
| `A request to the Cloudflare API ... failed` with 403 | Token not scoped to the account | Part 1 step 6 |
| `Invalid API Token` | Token expired, rolled or mistyped | Create a new token, then update the secret (repo Settings → Secrets → `CLOUDFLARE_API_TOKEN` → Update) |
| R2 bucket error on deploy | `oceans-exposed-reports` does not exist | Create it (dashboard, or `npx wrangler r2 bucket create oceans-exposed-reports`) |
| Publishes return 401 (`publish-failed` issue) | Worker secret not set, or it differs from the GitHub secret | Part 4 with the same value as the `PUBLISH_TOKEN` repository secret |

**Rotating the token later:** API Tokens → `github-actions-oceans-exposed` → ⋯ → **Roll**, copy the new
value, then update the `CLOUDFLARE_API_TOKEN` secret in GitHub. The next deploy uses it. To rotate the publish
token, set both the repository secret and the Worker secret to the new value.

**Turning auto-deploy off:** delete the `CLOUDFLARE_API_TOKEN` secret. The Action goes back to skipping.
