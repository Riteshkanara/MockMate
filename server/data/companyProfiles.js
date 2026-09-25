// ─── Company interview-format knowledge base ──────────────────────────────
// Real, general-knowledge signal about each company's known hiring process
// for Indian engineering placements — round structure, technical focus,
// and what tends to matter in each round. This is what actually makes
// "Company Specific" mode useful: without it, the AI prompt only had a bare
// company NAME to go on, which produces generic questions with a label
// slapped on top rather than questions shaped by how that company actually
// interviews.
//
// This is general public knowledge about hiring patterns (widely discussed
// on sites like GeeksforGeeks, LeetCode Discuss, Glassdoor, and college
// placement cells) — not confidential material, and it's used only to steer
// question *style*, never presented to the user as a guarantee of what
// they'll be asked.
//
// category groups companies with genuinely similar interview styles so the
// prompt can give useful guidance even for a company NOT in this list (see
// inferCompanyProfile below).

const COMPANY_PROFILES = {
  tcs: {
    displayName: 'TCS',
    category: 'it-services-mass-hiring',
    rounds: ['Online assessment (aptitude + coding)', 'Technical interview', 'HR/Managerial interview'],
    focus: 'Fundamentals over depth — basic DSA, OOP concepts, DBMS, and communication. Coding rounds favor correctness and clean logic over optimal complexity.',
    tips: 'Expect NQT/TCS CodeVita-style aptitude questions and a strong emphasis on being able to explain projects clearly.',
  },
  infosys: {
    displayName: 'Infosys',
    category: 'it-services-mass-hiring',
    rounds: ['Online assessment (aptitude + pseudocode)', 'Technical interview', 'HR interview'],
    focus: 'Aptitude and logical reasoning weighted heavily; technical rounds cover core CS fundamentals (OOP, DBMS, OS) rather than hard DSA.',
    tips: 'Pseudocode-based coding questions are common instead of a live IDE. Be ready to discuss academic projects in detail.',
  },
  wipro: {
    displayName: 'Wipro',
    category: 'it-services-mass-hiring',
    rounds: ['Online assessment (aptitude + essay + coding)', 'Technical interview', 'HR interview'],
    focus: 'Broad fundamentals across CS subjects, plus verbal/written communication (WILP/Elite hiring often includes an essay component).',
    tips: 'Keep answers structured and confident — communication clarity is explicitly evaluated, not just technical correctness.',
  },
  zoho: {
    displayName: 'Zoho',
    category: 'product-strong-fundamentals',
    rounds: ['Written test (aptitude + coding + puzzles)', 'Multiple technical interviews (2-3 rounds)', 'HR interview'],
    focus: 'Strong emphasis on DSA, problem-solving from first principles, and puzzles. Technical rounds go deep rather than wide.',
    tips: 'Zoho is known for genuinely hard technical rounds despite being a services-adjacent hire — prepare DSA seriously, not just fundamentals.',
  },
  razorpay: {
    displayName: 'Razorpay',
    category: 'product-fintech',
    rounds: ['Online coding assessment', 'DSA + problem-solving interview', 'System design / low-level design round', 'Culture-fit / bar-raiser round'],
    focus: 'Product-company bar: solid DSA, practical system design (even for entry-level, expect basic design thinking), and genuine curiosity about how payments/fintech systems work.',
    tips: 'Be ready to reason about trade-offs out loud, not just produce a correct answer. Fintech context (idempotency, consistency, reliability) can come up even in junior interviews.',
  },
  faang: {
    displayName: 'FAANG',
    category: 'faang-tier',
    rounds: ['Online assessment (2 DSA problems)', 'Phone/video technical screen', 'Onsite: 2-4 DSA + 1 system design (senior) + 1 behavioral'],
    focus: 'Heavy, disciplined DSA (arrays, trees, graphs, DP) at medium-hard LeetCode difficulty. Behavioral rounds use structured formats like STAR.',
    tips: 'Clarity of thought process matters as much as the final answer — interviewers evaluate how you approach an unfamiliar problem, not just whether you solve it.',
  },
  amazon: {
    displayName: 'Amazon',
    category: 'faang-tier',
    rounds: ['Online assessment (2 DSA + work-style survey)', 'Technical phone screen', 'Onsite loop (DSA + Leadership Principles behavioral rounds)'],
    focus: 'DSA rounds are standard medium-hard; behavioral rounds explicitly map to Amazon\u2019s Leadership Principles (Ownership, Bias for Action, etc.) and expect STAR-format answers.',
    tips: 'Every behavioral answer should map cleanly to a specific Leadership Principle — generic answers score poorly here even if the story is good.',
  },
  google: {
    displayName: 'Google',
    category: 'faang-tier',
    rounds: ['Online assessment', 'Phone screen (1-2 rounds)', 'Onsite (4-5 rounds: DSA, Googleyness/leadership)'],
    focus: 'Strong algorithmic rigor, clean code, and clear communication of approach and complexity trade-offs.',
    tips: 'Interviewers care about how you handle hints and edge cases — treat it as a collaborative problem-solving conversation, not a silent test.',
  },
  microsoft: {
    displayName: 'Microsoft',
    category: 'faang-tier',
    rounds: ['Online assessment', 'Technical interviews (2-3, DSA + CS fundamentals)', 'System design (for experienced) / As Appropriate round'],
    focus: 'DSA plus solid fundamentals (OS, networking, OOP), with an emphasis on code correctness and edge-case handling.',
    tips: 'The final "As Appropriate with Microsoft" round often blends technical and behavioral — be ready to discuss your projects and interests broadly.',
  },
  accenture: {
    displayName: 'Accenture',
    category: 'it-services-mass-hiring',
    rounds: ['Cognitive + technical assessment', 'Communication assessment', 'Technical interview', 'HR interview'],
    focus: 'Broad CS fundamentals, communication skills, and general aptitude rather than deep DSA.',
    tips: 'The English/communication assessment is scored separately and matters — practice clear, structured spoken answers.',
  },
  capgemini: {
    displayName: 'Capgemini',
    category: 'it-services-mass-hiring',
    rounds: ['Aptitude test', 'Technical + Group Discussion', 'HR interview'],
    focus: 'Fundamentals across OOP, DBMS, and basic coding; group discussion evaluates communication and teamwork.',
    tips: 'Prepare for a GD round specifically — structure your points and practice being heard clearly without dominating.',
  },
  cognizant: {
    displayName: 'Cognizant',
    category: 'it-services-mass-hiring',
    rounds: ['AMCAT-style aptitude test', 'Technical interview', 'HR interview'],
    focus: 'Fundamentals-first: OOP, DBMS, basic coding logic. Not DSA-heavy.',
    tips: 'Be thorough on your resume/projects — technical interviewers often start there before moving to fundamentals.',
  },
  flipkart: {
    displayName: 'Flipkart',
    category: 'product-fintech',
    rounds: ['Online coding assessment', '2-3 DSA interviews', 'System design / LLD round', 'Hiring manager / culture round'],
    focus: 'Product-company DSA bar plus practical system design; strong preference for candidates who can reason about real-world scale trade-offs.',
    tips: 'E-commerce-flavored system design questions (inventory, cart, search ranking) are common even at junior levels — practice one or two end-to-end.',
  },
};

// category-level fallback guidance used both for companies not individually
// profiled above, and to still give the AI something concrete rather than
// nothing when a user types a company we don't recognize by name.
const CATEGORY_FALLBACK = {
  'it-services-mass-hiring': {
    rounds: ['Aptitude/online assessment', 'Technical interview', 'HR interview'],
    focus: 'CS fundamentals (OOP, DBMS, OS) over deep DSA; strong weight on communication and clarity.',
  },
  'product-strong-fundamentals': {
    rounds: ['Written test', 'Multiple technical interviews', 'HR interview'],
    focus: 'Solid DSA and first-principles problem solving; technical rounds go deep.',
  },
  'product-fintech': {
    rounds: ['Online assessment', 'DSA interview(s)', 'System/low-level design', 'Culture-fit round'],
    focus: 'Product-company DSA bar plus practical system design and trade-off reasoning.',
  },
  'faang-tier': {
    rounds: ['Online assessment', 'Phone screen', 'Onsite (DSA + behavioral, +design for senior roles)'],
    focus: 'Rigorous medium-hard DSA and structured (STAR-format) behavioral rounds.',
  },
  unknown: {
    rounds: ['Online assessment', 'Technical interview', 'HR interview'],
    focus: 'General CS fundamentals and problem-solving, calibrated to a standard Indian placement process.',
  },
};

const normalizeKey = (name) =>
  String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Returns the best available interview-format profile for a company name,
 * whether or not it's in our curated list. Powers both the "quick pick"
 * chips (always profiled) and free-text entry (falls back to a sensible
 * category-level guess, or a generic profile as a last resort) — so the
 * AI prompt always has SOME concrete process/focus signal to work with,
 * never just a bare company name.
 */
const resolveCompanyProfile = (companyName) => {
  const trimmed = String(companyName || '').trim();
  if (!trimmed) return null;

  const key = normalizeKey(trimmed);
  const exact = COMPANY_PROFILES[key];
  if (exact) return { ...exact, displayName: exact.displayName || trimmed, isKnown: true };

  // Loose match for common variants (e.g. "Amazon India", "Google LLC").
  const partial = Object.values(COMPANY_PROFILES).find(
    (p) => key.includes(normalizeKey(p.displayName)) || normalizeKey(p.displayName).includes(key)
  );
  if (partial) return { ...partial, displayName: trimmed, isKnown: true };

  // Unrecognized company — give the AI a neutral, still-useful fallback
  // instead of nothing. isKnown:false lets the prompt phrase this as
  // "infer from general knowledge" rather than presenting invented specifics
  // as if they were verified facts about that company.
  const fallback = CATEGORY_FALLBACK.unknown;
  return {
    displayName: trimmed,
    category: 'unknown',
    rounds: fallback.rounds,
    focus: fallback.focus,
    tips: '',
    isKnown: false,
  };
};

// Quick-pick list shown as chips in the UI — kept small and curated.
// Free-text entry covers everything else via resolveCompanyProfile.
const QUICK_PICK_COMPANIES = [
  'TCS', 'Infosys', 'Wipro', 'Accenture', 'Cognizant', 'Capgemini',
  'Zoho', 'Razorpay', 'Flipkart', 'Amazon', 'Google', 'Microsoft',
];

module.exports = { COMPANY_PROFILES, CATEGORY_FALLBACK, resolveCompanyProfile, QUICK_PICK_COMPANIES };
