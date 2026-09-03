export type Project = {
  name: string;
  stack: string;
  /** Omit to render a non-interactive card (no anchor, no arrow). */
  url?: string;
  /** Shown on the Recents rail only. Omit on the featured grid. */
  year?: string;
};

/** The 2x2 grid under the masthead. */
export const featured: Project[] = [
  { name: "Headless WordPress", stack: "WPGraphQL · Next.js · ISR" },
  { name: "Web App",            stack: "Next.js · Supabase · Auth + RLS" },
  { name: "CRM Integration",    stack: "HubSpot Ops Hub · Custom code · Webhooks" },
  { name: "Storefront & Theme", stack: "Shopify · Custom WP theme · Gutenberg" },
];

/** The "Recents" rail. Add an entry here and it appears in the carousel. */
// TODO: confirm these years — placeholders, not verified dates.
export const recents: Project[] = [
  { name: "David Willards Group", stack: "Custom WP · REST API · Listings",    url: "https://davidwillardsgroup.com/",     year: "2026" },
  { name: "Eternal Homes Portal", stack: "Next.js · Express.js · HubSpot API", url: "https://portal.eternalhomes.com.au/", year: "2026" },
  { name: "Eternal Homes",        stack: "Custom WP · Gutenberg",              url: "https://eternalhomes.com.au/",        year: "2025" },
];
