// Shared vocabulary of the oceans.exposed contract (pure: no Node APIs).
// Categories, issue layers, severity components, scoring. The browser keeps its own copy of the category
// names in public/assets/app.js; keep them in step.

export const CATEGORIES = [
  { slug: 'ocean-warming-heatwaves', name: 'Ocean Warming & Marine Heatwaves' },
  { slug: 'sea-level-coastal-flooding', name: 'Sea Level & Coastal Flooding' },
  { slug: 'acidification-deoxygenation', name: 'Acidification & Deoxygenation' },
  { slug: 'coral-reefs', name: 'Coral Reefs' },
  { slug: 'fisheries-overfishing', name: 'Fisheries & Overfishing' },
  { slug: 'plastics-marine-debris', name: 'Plastics & Marine Debris' },
  { slug: 'nutrient-pollution-dead-zones', name: 'Nutrient Pollution & Dead Zones' },
  { slug: 'chemical-oil-pollution', name: 'Chemical & Oil Pollution' },
  { slug: 'shipping-ports-noise', name: 'Shipping, Ports & Noise' },
  { slug: 'offshore-energy', name: 'Offshore Energy' },
  { slug: 'deep-sea-mining', name: 'Deep-Sea Mining' },
  { slug: 'coastal-habitats', name: 'Coastal Habitats' },
  { slug: 'marine-wildlife', name: 'Marine Wildlife' },
  { slug: 'polar-oceans-sea-ice', name: 'Polar Oceans & Sea Ice' },
  { slug: 'governance-treaties-disputes', name: 'Governance, Treaties & Disputes' },
  { slug: 'aquaculture', name: 'Aquaculture' },
  { slug: 'other', name: 'Other Ocean Issues' },
];
export const CATEGORY_SLUGS = CATEGORIES.map((c) => c.slug);

export const LAYERS = ['Climate & Physical', 'Pollution', 'Living Resources & Habitats', 'Governance & Economy'];

// Severity components, each 0-2. The site computes the total (0-10) and the level from these.
export const COMPONENTS = ['harm', 'livelihoods', 'scale', 'duration', 'significance'];

export const STATUSES = ['Ongoing Major Issue', 'Corrective Action Underway', 'Monitoring or Emerging Risk', 'Resolved or Stabilized'];
export const RISK_LEVELS = ['Severe', 'Elevated', 'Watch', 'Not Indicated', 'Unknown'];
export const TRENDS = ['Worsening', 'Improving', 'Stable', 'Volatile or Mixed', 'Insufficient History'];

export function score(r) {
  const c = (r && r.severity && r.severity.components) || {};
  return COMPONENTS.reduce((s, k) => s + (Number(c[k]) || 0), 0);
}
export function level(s) { return s >= 9 ? 'Critical' : s >= 7 ? 'High' : s >= 4 ? 'Moderate' : 'Low'; }
