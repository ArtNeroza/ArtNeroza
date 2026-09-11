export type Project = {
  name: string;
  stack: string;
  /** Omit to render a non-interactive card (no anchor, no arrow). */
  url?: string;
};

/** The 2x2 grid under the masthead. */
export const featured: Project[] = [
  { name: "Headless WordPress", stack: "WPGraphQL · Next.js · ISR" },
  { name: "Web App",            stack: "Next.js · Vite.js · Nest.js · Supabase · Auth + RLS" },
  { name: "CRM Integration",    stack: "HubSpot Ops Hub · Custom code · Webhooks" },
  { name: "Storefront & Theme", stack: "Shopify · Custom WP theme · Gutenberg" },
];

/** The "Projects" rail. Add an entry here and it appears in the carousel. */
export const projects: Project[] = [
  { name: "Ask Lex PH Academy",   stack: "LMS · Course platform",              url: "https://asklexph.com/" },
  { name: "Marketech APAC",       stack: "Custom WP theme · Elementor Pro · WooCommerce",  url: "https://marketech-apac.com/" },
  { name: "AFFC App Site",        stack: "Nextjs · SaaS-ready app",            url: "https://affc-appsite.vercel.app/" },
  //{ name: "David Willards Group", stack: "Custom WP · REST API · Listings",    url: "https://davidwillardsgroup.com/" },
  { name: "Eternal Homes Portal", stack: "Next.js · HubSpot API",              url: "https://portal.eternalhomes.com.au/" },
  { name: "Eternal Homes",        stack: "Custom WP · Gutenberg",              url: "https://eternalhomes.com.au/" },
];
