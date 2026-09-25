// ─── Topic taxonomy ────────────────────────────────────────────────────────
// Previously a flat list of 8 topics with no grouping and no multi-select.
// Grouped so the UI can present them in sensible clusters, and the prompt
// builder can phrase multi-topic requests coherently (e.g. "DSA + System
// Design" should read as one combined-focus session, not two bolted-together
// single-topic ones).

const TOPIC_GROUPS = [
  {
    id: 'cs-fundamentals',
    label: 'CS Fundamentals',
    topics: ['DSA', 'OOP', 'DBMS', 'Operating Systems', 'Computer Networks'],
  },
  {
    id: 'web-dev',
    label: 'Web Development',
    topics: ['JavaScript', 'React', 'Node.js', 'REST APIs', 'System Design'],
  },
  {
    id: 'behavioral',
    label: 'Behavioral & HR',
    topics: ['HR', 'Behavioral (STAR format)', 'Resume Deep-Dive'],
  },
  {
    id: 'data-ml',
    label: 'Data & ML',
    topics: ['SQL', 'Statistics & Probability', 'Machine Learning Basics'],
  },
];

const ALL_TOPICS = TOPIC_GROUPS.flatMap((g) => g.topics);

module.exports = { TOPIC_GROUPS, ALL_TOPICS };
