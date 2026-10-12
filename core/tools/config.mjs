// Loads the site's site.config.json (walking up from the current directory) and derives the paths the core
// tools need. Every core tool imports this instead of hard-coding a site name.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function findSiteRoot(start = process.cwd()) {
  let d = resolve(start);
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(d, 'site.config.json'))) return d;
    const up = dirname(d); if (up === d) break; d = up;
  }
  throw new Error('site.config.json not found (run from the site repository)');
}
export const SITE_ROOT = findSiteRoot();
export const cfg = JSON.parse(readFileSync(join(SITE_ROOT, 'site.config.json'), 'utf8'));
export const API = `/api/${cfg.slug}`;
export const INTERNAL = `/internal/${cfg.slug}`;
export const SITE_URL = `https://${cfg.host}`;
export const sitePath = (...p) => join(SITE_ROOT, ...p);
export const siteModule = (rel) => import(pathToFileURL(join(SITE_ROOT, rel)).href);
