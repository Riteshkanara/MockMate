// utils/topicNormalizer.js
const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// canonical dimension-topic → array of raw strings/patterns that should roll into it
const TOPIC_SYNONYMS = {
  dsa: ['dsa', 'data structures algorithms', 'data structures & algorithms', 'data structures', 'algorithms'],
  oop: ['oop', 'object oriented programming', 'object-oriented programming'],
  dbms: ['dbms', 'database management systems', 'database management', 'database'],
  os: ['os', 'operating systems', 'operating system'],
  javascript: ['javascript', 'js'],
  webdev: ['web development', 'web dev'],
  systemdesign: ['system design', 'system design networking', 'architecture', 'project architecture', 'scalability'],
  networking: ['computer networks', 'networking', 'network'],
  hr: ['hr'],
  behavioral: ['behavioral', 'behavioural'],
  communication: ['communication'],
  csfundamentals: ['computer science fundamentals'],
};

// each raw DB topic string → canonical key, resolved by substring match
// after normalization — handles "Java / Memory Management" style outliers
// by falling into the nearest canonical bucket or an explicit 'unmapped' bucket