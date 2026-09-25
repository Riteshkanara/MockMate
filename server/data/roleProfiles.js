// ─── Role + experience-level knowledge base ───────────────────────────────
// The previous prompt had no idea whether it was questioning a fresher or
// someone with 2 years' experience, or what role they're targeting — every
// session got the same generic "interview question" treatment regardless.
// This is the single highest-leverage addition for question relevance,
// since role and seniority change not just topic weighting but the
// EXPECTED DEPTH of a good answer (a fresher explaining REST vs. a 2-YOE
// candidate expected to discuss API versioning/rate-limiting trade-offs).

const ROLES = {
  sde: {
    label: 'SDE / Generalist',
    focusAreas: 'DSA, OOP, core CS fundamentals (OS, DBMS, networking), and general problem-solving.',
  },
  frontend: {
    label: 'Frontend Developer',
    focusAreas: 'JavaScript/TypeScript fundamentals, DOM & browser internals, React/framework patterns, CSS/layout reasoning, performance and accessibility basics, plus enough DSA to pass screening.',
  },
  backend: {
    label: 'Backend Developer',
    focusAreas: 'API design, databases (SQL/NoSQL trade-offs), system design fundamentals, concurrency/scaling basics, and DSA appropriate to the round.',
  },
  fullstack: {
    label: 'Full-Stack Developer',
    focusAreas: 'A blend of frontend (JS/React) and backend (APIs, databases) questions, plus how the two integrate (auth flow, data fetching, deployment basics).',
  },
  data: {
    label: 'Data / ML',
    focusAreas: 'Statistics and probability fundamentals, SQL, Python/data-manipulation questions, core ML concepts appropriate to experience level, and basic DSA.',
  },
  devops: {
    label: 'DevOps / SRE',
    focusAreas: 'CI/CD concepts, containerization (Docker/Kubernetes basics), cloud fundamentals, Linux/networking, and incident-response/reliability thinking.',
  },
  qa: {
    label: 'QA / SDET',
    focusAreas: 'Testing methodology (unit/integration/e2e), test-case design, automation framework basics, and enough coding/DSA to write test logic.',
  },
};

const EXPERIENCE_LEVELS = {
  fresher: {
    label: 'Fresher (0 YOE)',
    calibration: 'Assume campus-placement level. Expect textbook-correct fundamentals and simple, well-known problems — do not expect production-scale system design or nuanced trade-off discussions unless the mode explicitly calls for it.',
  },
  intern: {
    label: 'Internship-level',
    calibration: 'Assume some hands-on project/internship exposure. Questions can reference practical scenarios (e.g. "how would you debug X"), not just textbook definitions, but should stay approachable.',
  },
  junior: {
    label: '0-2 years experience',
    calibration: 'Assume real production experience. Expect the candidate to discuss trade-offs, past decisions, and "why", not just "what" — and expect follow-up-style depth even in a single question.',
  },
  mid: {
    label: '2-5 years experience',
    calibration: 'Assume solid ownership experience. Favor system-design and architectural-reasoning questions, leadership/mentoring behavioral questions, and depth over breadth.',
  },
};

const DEFAULT_ROLE = 'sde';
const DEFAULT_EXPERIENCE = 'fresher';

const resolveRole = (role) => ROLES[role] ? role : DEFAULT_ROLE;
const resolveExperience = (level) => EXPERIENCE_LEVELS[level] ? level : DEFAULT_EXPERIENCE;

// User.js's onboarding field `codingExperience` uses years-coded buckets
// ('<1','1-2','2-3','3+') distinct from our interview-calibration levels —
// this maps one to the other so a user's onboarding answer can silently
// pre-fill a sensible experience level without asking them to answer the
// same question twice in different words.
const CODING_EXPERIENCE_TO_LEVEL = {
  '<1':  'fresher',
  '1-2': 'intern',
  '2-3': 'junior',
  '3+':  'mid',
};
const mapCodingExperienceToLevel = (codingExperience) =>
  CODING_EXPERIENCE_TO_LEVEL[codingExperience] || null;

module.exports = {
  ROLES,
  EXPERIENCE_LEVELS,
  DEFAULT_ROLE,
  DEFAULT_EXPERIENCE,
  resolveRole,
  resolveExperience,
  mapCodingExperienceToLevel,
};

