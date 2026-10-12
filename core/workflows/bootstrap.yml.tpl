name: Bootstrap site

# One-off launch of {{SITE_HOST}}, run by hand (Actions > Bootstrap site > Run workflow). Safe to re-run.
# Needs the repository secrets CLOUDFLARE_API_TOKEN (Edit Cloudflare Workers template + Zone DNS Edit + Zone Read
# + Account Workers R2 Storage Edit, scoped to the {{SITE_HOST}} zone) and PUBLISH_TOKEN.
#   1. Creates the R2 bucket {{BUCKET_NAME}} if it does not exist.
#   2. Deploys the Worker, the pages and the {{SITE_HOST}} custom domain (same as Deploy site).
#   3. Sets the Worker secret PUBLISH_TOKEN from the repository secret of the same name.
#   4. Publishes the sample run {{SAMPLE_RUN}} and confirms the live API answers.
on:
  workflow_dispatch:
    inputs:
      publish_sample:
        description: 'Publish the sample run after deploying'
        type: boolean
        default: true

concurrency:
  group: deploy
  cancel-in-progress: false

permissions:
  contents: read

jobs:
  bootstrap:
    runs-on: ubuntu-latest
    env:
      CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    steps:
      - uses: actions/checkout@v5

      - uses: actions/setup-node@v5
        with:
          node-version: 22
          cache: npm

      - run: npm ci --no-audit --no-fund

      - name: Check secrets
        env:
          PUBLISH_TOKEN: ${{ secrets.PUBLISH_TOKEN }}
        run: |
          [ -n "$CLOUDFLARE_API_TOKEN" ] || { echo "::error::CLOUDFLARE_API_TOKEN secret is not set (Settings > Secrets and variables > Actions)."; exit 1; }
          [ -n "$PUBLISH_TOKEN" ] || { echo "::error::PUBLISH_TOKEN secret is not set."; exit 1; }
          npx wrangler whoami | sed -n '1,12p'

      - name: Site checks and tests
        run: |
          node tools/site-check.mjs
          node --test tests/*.test.mjs

      - name: Create the R2 bucket (if missing)
        run: |
          if npx wrangler r2 bucket list 2>/dev/null | grep -q '{{BUCKET_NAME}}'; then
            echo "Bucket {{BUCKET_NAME}} exists."
          else
            npx wrangler r2 bucket create {{BUCKET_NAME}}
          fi

      - name: Deploy
        run: npx wrangler deploy

      - name: Set the Worker secret PUBLISH_TOKEN
        env:
          PUBLISH_TOKEN: ${{ secrets.PUBLISH_TOKEN }}
        run: printf '%s' "$PUBLISH_TOKEN" | npx wrangler secret put PUBLISH_TOKEN

      - name: Wait for the custom domain
        run: |
          for i in $(seq 1 40); do
            code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 https://{{SITE_HOST}}{{API}}/validate || true)
            if [ "$code" = "200" ]; then echo "{{SITE_HOST}} answers ($code)."; exit 0; fi
            echo "attempt $i: $code"; sleep 15
          done
          echo "::warning::https://{{SITE_HOST}} did not answer within 10 minutes; DNS may still be propagating. Re-run later."

      - name: Publish the sample run
        if: ${{ inputs.publish_sample }}
        env:
          PUBLISH_TOKEN: ${{ secrets.PUBLISH_TOKEN }}
          REPORT_DIR: ${{ runner.temp }}/reports
        run: node core/tools/publish-run.mjs {{SAMPLE_RUN}}

      - name: Live check
        if: always()
        run: |
          echo "## Bootstrap" >> "$GITHUB_STEP_SUMMARY"
          { echo; echo '```json'; curl -s --max-time 20 https://{{SITE_HOST}}{{API}}/summary | head -c 1500 || echo '{"error":"no answer"}'; echo; echo '```'; } >> "$GITHUB_STEP_SUMMARY"
