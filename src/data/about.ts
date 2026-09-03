import { featured, recents } from "./projects";

const list = (items: { name: string; stack: string; year?: string }[]) =>
  items
    .map((p) => `<li><b>${p.name}</b> — ${p.stack}${p.year ? ` · ${p.year}` : ""}</li>`)
    .join("");


/**
 * The ONLY facts the model is allowed to state. Curated prose — deliberately no
 * source paths, file names or repo structure (a public bot leaking "home.tsx"
 * tells a visitor nothing and looks unfinished).
 */
export const facts = `
Name: Art C. Neroza. Goes by Art.
Role: Full-Stack Developer and HubSpot Administrator.
Based: La Union, Philippines. Timezone GMT+8. Works remotely with teams globally.
Availability: open to contract, gig and full-time remote work.
Contact: art.neroza@gmail.com. Also on LinkedIn (art-neroza) and GitHub (ArtNeroza).
Website: artneroza.com
Resume: downloadable at https://artneroza.com/art-neroza-resume.pdf

What he does:
- Builds web applications end to end - database and API layer through to the interface.
- Administers and integrates HubSpot: Ops Hub custom-code actions, webhooks, CRM integrations.
- Headless architectures: WordPress or Shopify as the content layer with Next.js in front.

Frontend: HTML, CSS, JavaScript, TypeScript, React, Next.js, Angular, Vue, Astro.
Backend: Node.js, Express, PHP, Laravel, GraphQL.
Data and cloud: PostgreSQL, MongoDB, Supabase, AWS, Vercel.
CMS and CRM: WordPress, Shopify, HubSpot.

Recent projects:
${recents.map((p) => `- ${p.name} (${p.year}): ${p.stack}`).join("\n")}

Areas he builds in:
${featured.map((p) => `- ${p.name}: ${p.stack}`).join("\n")}
`.trim();

/**
 * The file lives in public/ — anything there is copied
 * to the site root unchanged, so this URL stays stable and shareable (files
 * under src/ get content-hashed instead, which would break saved links).
 */
export const RESUME_URL = "/art-neroza-resume.pdf";

export type QA = { id: string; q: string; a: string };

/**
 * Phase 1 answers: written by hand, rendered into the page at build time.
 * No API call, no lookup — so they are instant and always correct.
 * Project lines are generated from projects.ts so they cannot drift.
 */
export const canned: QA[] = [
  {
    id: "about",
    q: "Tell me about Art.",
    a: `<p>Art C. Neroza is a full-stack developer and HubSpot administrator based in
        La&nbsp;Union, Philippines (GMT+8), working remotely with teams globally.</p>
        <p>He builds web applications end to end — from the database and API layer through
        to the interface — and administers the CRM systems businesses run on.</p>`,
  },
  {
    id: "projects",
    q: "What has he built?",
    a: `<p>Recent work:</p><ul>${list(recents)}</ul>
        <p>Areas he builds in:</p><ul>${list(featured)}</ul>`,
  },
  {
    id: "stack",
    q: "What's his tech stack?",
    a: `<p><b>Frontend</b> — HTML, CSS, JavaScript, TypeScript, React, Next.js, Angular, Vue, Astro</p>
        <p><b>Backend</b> — Node.js, Express, PHP, Laravel, GraphQL</p>
        <p><b>Data &amp; cloud</b> — PostgreSQL, MongoDB, Supabase, AWS, Vercel</p>
        <p><b>CMS &amp; CRM</b> — WordPress, Shopify, HubSpot</p>`,
  },
  {
    id: "hubspot",
    q: "What does he do with HubSpot?",
    a: `<p>Ops Hub custom-code actions, webhooks, and CRM integrations — wiring HubSpot to
        the rest of a business's stack so data moves without anyone re-typing it.</p>
        <p>He also builds headless setups: WordPress or Shopify as the content layer with
        Next.js in front.</p>`,
  },
  {
    id: "resume",
    q: "Can I see his resume?",
    a: `<p>Yes — <a href="/art-neroza-resume.pdf" target="_blank" rel="noopener">download Art&rsquo;s resume (PDF)</a>.</p>
        <p>If you need it in another format, email
        <a href="mailto:art.neroza@gmail.com">art.neroza@gmail.com</a>.</p>`,
  },
  {
    id: "contact",
    q: "How can I reach him?",
    a: `<p>Email <a href="mailto:art.neroza@gmail.com">art.neroza@gmail.com</a> — that reaches
        him fastest. He's also on
        <a href="https://www.linkedin.com/in/art-neroza/" target="_blank" rel="noopener">LinkedIn</a>
        and <a href="https://github.com/ArtNeroza" target="_blank" rel="noopener">GitHub</a>.</p>
        <p>Open to contract, gig and full-time remote work, GMT+8.</p>`,
  },
];
