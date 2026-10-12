/**
 * ASPIRE WORK — Verified Brand Knowledge Base for Aspire AI
 * 
 * Comprehensive source of truth built strictly from existing project data,
 * categories, quotes, gallery, discipline checklists, and brand manifests.
 */

import { MOTIVATION_CATEGORIES } from './categories';
import { ORIGINAL_QUOTES } from './quotes';
import { GALLERY_POSTS } from './gallery';
import { SOCIAL_CONFIG, BRAND_CONFIG } from '../config/social';

export interface WebsiteKnowledge {
  brand: typeof BRAND_CONFIG;
  social: typeof SOCIAL_CONFIG;
  manifestoCodes: Array<{ number: string; title: string; doctrine: string }>;
  pillars: Array<{
    pillar: string;
    title: string;
    summary: string;
    doctrine: string;
    actionHabit: string;
    tenets: string[];
  }>;
  quotes: Array<{
    id: string;
    quote: string;
    author: string;
    meta: string;
    category: string;
    tags?: string[];
  }>;
  gallery: Array<{
    id: string;
    title: string;
    caption: string;
    category: string;
    likes: string;
    hashtags: string[];
  }>;
  dailyDisciplineChecklist: Array<{
    id: string;
    title: string;
    subtitle: string;
  }>;
  websiteSections: Array<{
    id: string;
    name: string;
    description: string;
  }>;
}

export const ASPIRE_WEBSITE_KNOWLEDGE: WebsiteKnowledge = {
  brand: BRAND_CONFIG,
  social: SOCIAL_CONFIG,
  manifestoCodes: [
    {
      number: '01',
      title: 'Unconditional Accountability',
      doctrine: 'Zero excuses tolerated. If an outcome in your sphere fails, you own 100% of the cause. You never blame weather, market cycles, or personnel.',
    },
    {
      number: '02',
      title: 'Sovereign Work Ethic',
      doctrine: 'You work long past the applause of onlookers. What you forge in obscurity will inevitably manifest in broad daylight.',
    },
    {
      number: '03',
      title: 'Ruthless Cognitive Elimination',
      doctrine: 'Distraction is the weapon of the mediocre. Say no to 99% of transient opportunities to defend the asymmetric 1%.',
    },
    {
      number: '04',
      title: 'Physical & Mental Hardening',
      doctrine: 'The mind mirrors the body. Voluntary physical hardship breeds unshakeable confidence in high-stakes boardrooms.',
    },
    {
      number: '05',
      title: 'Asymmetric Compounding',
      doctrine: 'Play long-term games with long-term people. Build enduring equity, intellectual capital, and unassailable reputation.',
    },
  ],
  pillars: MOTIVATION_CATEGORIES.map((c) => ({
    pillar: c.pillarNumber,
    title: c.title,
    summary: c.shortDescription,
    doctrine: c.fullDoctrine,
    actionHabit: c.actionHabit,
    tenets: c.keyTenets,
  })),
  quotes: ORIGINAL_QUOTES.map((q) => ({
    id: q.id,
    quote: q.quote,
    author: q.author,
    meta: q.meta,
    category: q.category,
    tags: q.tags,
  })),
  gallery: GALLERY_POSTS.map((g) => ({
    id: g.id,
    title: g.title,
    caption: g.caption,
    category: g.category,
    likes: g.likes,
    hashtags: g.hashtags,
  })),
  dailyDisciplineChecklist: [
    {
      id: 'task-1',
      title: 'Complete primary needle-mover prior to 11:00 AM',
      subtitle: 'Zero interruptions, communication apps severed, pure execution',
    },
    {
      id: 'task-2',
      title: 'Read 20 pages of high-yield literature',
      subtitle: 'Strategy, philosophy, capital allocation, or domain craftsmanship',
    },
    {
      id: 'task-3',
      title: 'Intense physical conditioning session',
      subtitle: 'Cardiovascular strain, heavy lifting, or VO2 max elevation',
    },
    {
      id: 'task-4',
      title: 'Eliminate all cheap dopamine consumption',
      subtitle: 'No mindless feed scrolling, algorithm traps, or passive indulgence',
    },
    {
      id: 'task-5',
      title: "Evening audit & tomorrow's battle order",
      subtitle: 'Clear workspace, review scorecard, lock in the exact 3 targets',
    },
  ],
  websiteSections: [
    {
      id: 'hero',
      name: 'Interactive 3D Hero',
      description: 'Features the core maxim "YOUR FUTURE IS BUILT BY WHAT YOU DO TODAY", floating gold rings, and quick portal links.',
    },
    {
      id: 'motivation-pillars',
      name: 'Pillars of Motivation',
      description: 'The six core philosophical foundations with actionable daily execution habits.',
    },
    {
      id: 'quotes-vault',
      name: 'Daily Directives & Quotes Vault',
      description: 'Curated library of high-impact maxims with copyable text and LocalStorage bookmarks.',
    },
    {
      id: 'daily-discipline',
      name: 'Daily Discipline Protocol',
      description: 'Interactive checklist with real-time streak tracking, completion percentage, and audio sound effects.',
    },
    {
      id: 'stories-gallery',
      name: 'Visual Storytelling Gallery',
      description: 'Curated visual case studies and executive imagery with social bookmarks.',
    },
    {
      id: 'social-dispatch',
      name: 'Executive Social Media Dispatch',
      description: 'Direct links to official Instagram, TikTok, YouTube, and X channels.',
    },
    {
      id: 'about-contact',
      name: 'Brand Manifesto & Communications',
      description: 'Direct inquiries to director@aspirework.vip across Zurich, New York, and Singapore.',
    },
  ],
};

/**
 * Format the structured knowledge base as a prompt context for the Gemini system instruction.
 */
export function generateSystemPrompt(): string {
  const brand = ASPIRE_WEBSITE_KNOWLEDGE.brand;
  const pillarsText = ASPIRE_WEBSITE_KNOWLEDGE.pillars
    .map(
      (p) =>
        `[${p.pillar}: ${p.title}]\n- Summary: ${p.summary}\n- Full Doctrine: ${p.doctrine}\n- Action Habit: ${p.actionHabit}\n- Key Tenets: ${p.tenets.join('; ')}`
    )
    .join('\n\n');

  const quotesText = ASPIRE_WEBSITE_KNOWLEDGE.quotes
    .map(
      (q) =>
        `• "${q.quote}" — ${q.author} (${q.meta}, Category: ${q.category})`
    )
    .join('\n');

  const galleryText = ASPIRE_WEBSITE_KNOWLEDGE.gallery
    .map((g) => `• "${g.title}" (${g.category}): "${g.caption}" [${g.likes} likes]`)
    .join('\n');

  const tasksText = ASPIRE_WEBSITE_KNOWLEDGE.dailyDisciplineChecklist
    .map((t) => `• ${t.title} (${t.subtitle})`)
    .join('\n');

  const socialsText = Object.values(ASPIRE_WEBSITE_KNOWLEDGE.social)
    .map((s) => `• ${s.platform}: handle ${s.handle}, ${s.subscribersOrFollowers}, URL: ${s.url}`)
    .join('\n');

  return `You are Aspire AI, the luxury, intelligent, motivational assistant for the ASPIRE WORK website.

BRAND IDENTITY & PURPOSE:
- Brand Name: ${brand.name}
- Tagline: "${brand.tagline}"
- Executive Locations: ${brand.location}
- Contact Email: ${brand.email}
- Philosophy: Developing discipline, consistency, productivity, resilience, mental strength, and success-oriented mindsets.

YOUR PERSONALITY & TONE:
- Professional, elegant, encouraging, articulate, and commanding yet respectful.
- Clear, practical, and grounded — avoid generic fluffy platitudes, fake hype, or unrealistic get-rich-quick claims.
- Reflect the sovereign "black-and-gold" luxury aesthetic of ASPIRE WORK: calm, deliberate, unwavering, and focused on relentless execution.
- Helpful to beginners building their first routines as well as seasoned operators sharpening high-yield performance.

STRICT KNOWLEDGE BOUNDARIES:
1. When asked about ASPIRE WORK, its quotes, pillars, articles, checklist, gallery, authors, social channels, or website features: ONLY cite the verified content below. Never fabricate nonexistent articles, team members, or store products.
2. If asked about something specific to the ASPIRE WORK website that is NOT present in this knowledge base, clearly and politely acknowledge that it is not currently on the website.
3. For general questions on personal discipline, habit building, overcoming procrastination, fitness consistency, productivity systems (like deep work and time blocking), and executive mindset: provide outstanding, practical, high-impact guidance completely aligned with the ASPIRE WORK philosophy.
4. Keep responses concise, well-structured, formatted with clean bullet points or bold text where helpful, and avoid endless walls of text.

=== VERIFIED WEBSITE CONTENT ===

[THE 5 SOVEREIGN MANIFESTO CODES]
${ASPIRE_WEBSITE_KNOWLEDGE.manifestoCodes.map((c) => `Code ${c.number}: ${c.title} — ${c.doctrine}`).join('\n')}

[THE 6 PILLARS OF MOTIVATION]
${pillarsText}

[VERIFIED DIRECTIVES & QUOTES]
${quotesText}

[DAILY DISCIPLINE CHECKLIST PROTOCOL]
${tasksText}

[VISUAL GALLERY CASE STUDIES]
${galleryText}

[OFFICIAL SOCIAL CHANNELS]
${socialsText}

[WEBSITE SECTIONS]
${ASPIRE_WEBSITE_KNOWLEDGE.websiteSections.map((s) => `• ${s.name} (#${s.id}): ${s.description}`).join('\n')}
`;
}
