const { GoogleGenAI } = require('@google/genai');
const { resolveCompanyProfile } = require('../data/companyProfiles');
const { ROLES, EXPERIENCE_LEVELS, resolveRole, resolveExperience } = require('../data/roleProfiles');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';

const LIMITS = {
  MAX_RETRIES: 2,
  RETRY_DELAY: 2000,
  MAX_DELAY: 10000,
  MAX_QUESTIONS: 30,
  MAX_TOKENS: 4096,
  DEFAULT_TOKENS: 400,
  TIME_OPEN: 120,
  TIME_MCQ: 45,
  TIME_APTITUDE: 60,
  TIME_FALLBACK_OPEN: 90,
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const getErrorMessage = error => {
  const msg = error?.message || error?.error?.message || String(error || '');
  if (!msg) console.warn('getErrorMessage: received empty or unrecognised error shape', error);
  return msg;
};

const getStatus = error => {
  const status = error?.status ?? error?.code ?? error?.error?.status ?? error?.error?.code;
  if (status === undefined) console.warn('getStatus: could not resolve status from error', error);
  return status;
};

const isQuotaError = error => {
  const message = getErrorMessage(error).toLowerCase();
  return (
    getStatus(error) === 429 ||
    message.includes('resource_exhausted') ||
    message.includes('quota') ||
    message.includes('rate limit') ||
    message.includes('too many requests')
  );
};

const isTemporaryError = error =>
  [429, 500, 502, 503, 504].includes(Number(getStatus(error)));

const getRetryDelay = (error, attempt) => {
  const retryInfo = error?.details?.find?.(
    detail =>
      detail?.['@type']?.includes('RetryInfo') ||
      detail?.type?.includes('RetryInfo')
  );

  if (retryInfo?.retryDelay) {
    const seconds = parseFloat(retryInfo.retryDelay);
    if (!Number.isNaN(seconds)) return Math.min(seconds * 1000, LIMITS.MAX_DELAY);
  }

  return Math.min(LIMITS.RETRY_DELAY * Math.pow(2, attempt), LIMITS.MAX_DELAY);
};

const withRetry = async (request, options = {}) => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured.');
  }

  const maxRetries = Number.isInteger(options.maxRetries)
    ? options.maxRetries
    : LIMITS.MAX_RETRIES;

  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const generationConfig = {};

      if (request.config?.responseMimeType) {
        generationConfig.responseMimeType = request.config.responseMimeType;
      }
      if (request.config?.responseJsonSchema) {
        generationConfig.responseSchema = request.config.responseJsonSchema;
      }
      if (request.config?.maxOutputTokens) {
        generationConfig.maxOutputTokens = request.config.maxOutputTokens;
      }

      const response = await ai.models.generateContent({
        model: MODEL,
        contents: request.contents,
        config: generationConfig,
      });

      return {
        text: response.text || '',
        candidates: response.candidates,
      };
    } catch (error) {
      lastError = error;

      console.error(
        `Gemini request failed. Attempt ${attempt + 1}/${maxRetries + 1}:`,
        getErrorMessage(error)
      );

      if (isQuotaError(error)) {
        console.error('Gemini quota error — aborting retries:', getErrorMessage(error));
        throw error;
      }
      if (!isTemporaryError(error)) throw error;
      if (attempt === maxRetries) break;

      const delay = getRetryDelay(error, attempt);
      await sleep(delay);
    }
  }

  throw lastError;
};

const parseJson = responseText => {
  if (!responseText) throw new Error('Gemini returned an empty response.');

  try {
    return JSON.parse(responseText);
  } catch (firstError) {
    try {
      const cleaned = String(responseText)
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
      return JSON.parse(cleaned);
    } catch {
      console.error('parseJson: failed to parse Gemini response. Original error:', firstError.message, '\nRaw response:', responseText);
      throw new Error('Gemini returned invalid JSON.');
    }
  }
};

const QUESTION_SCHEMA = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          text: { type: 'string' },
          topic: { type: 'string' },
          difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
          questionType: { type: 'string', enum: ['open', 'mcq', 'aptitude'] },
          options: { type: 'array', items: { type: 'string' } },
          correctAnswerIndex: { type: 'integer' },
          explanation: { type: 'string' },
          timeLimit: { type: 'integer' },
        },
        required: [
          'id', 'text', 'topic', 'difficulty', 'questionType',
          'options', 'correctAnswerIndex', 'explanation', 'timeLimit',
        ],
      },
    },
  },
  required: ['questions'],
};

const VALID_MODES = ['quick', 'full', 'company', 'topic', 'mcq', 'aptitude', 'mixed'];

const normalizeType = (questionType, mode) => {
  if (['open', 'mcq', 'aptitude'].includes(questionType)) return questionType;
  if (mode === 'mcq') return 'mcq';
  if (mode === 'aptitude') return 'aptitude';
  return 'open';
};

const defaultTimeLimit = questionType => {
  if (questionType === 'mcq') return LIMITS.TIME_MCQ;
  if (questionType === 'aptitude') return LIMITS.TIME_APTITUDE;
  return LIMITS.TIME_OPEN;
};

const normalizeQuestion = (question, index, mode) => {
  const questionType = normalizeType(question?.questionType, mode);

  const options =
    questionType === 'open'
      ? []
      : Array.isArray(question?.options)
        ? question.options.map(o => String(o ?? '').trim()).filter(Boolean)
        : [];

  let correctAnswerIndex = null;
  if (questionType !== 'open') {
    const candidate = Number(question?.correctAnswerIndex);
    correctAnswerIndex =
      Number.isInteger(candidate) && candidate >= 0 && candidate < options.length
        ? candidate
        : -1;
  }

  return {
    id: question?.id || `q${index + 1}`,
    text: String(question?.text || 'Please answer the interview question.').trim(),
    topic: String(
      question?.topic ||
        (questionType === 'aptitude'
          ? 'Aptitude'
          : questionType === 'mcq'
            ? 'Technical MCQ'
            : 'General')
    ).trim(),
    difficulty: ['easy', 'medium', 'hard'].includes(question?.difficulty)
      ? question.difficulty
      : 'medium',
    questionType,
    options,
    correctAnswerIndex,
    explanation: questionType === 'open' ? '' : String(question?.explanation || '').trim(),
    timeLimit:
      Number.isFinite(Number(question?.timeLimit)) && Number(question.timeLimit) > 0
        ? Math.round(Number(question.timeLimit))
        : defaultTimeLimit(questionType),
  };
};

const getFallbackOpen = (topic, count) => {
  let questions = [
    {
      id: 'q1',
      text: 'Explain the difference between an Array and a Linked List.',
      topic: 'DSA',
      difficulty: 'easy',
      questionType: 'open',
      options: [],
      correctAnswerIndex: null,
      explanation: '',
      timeLimit: LIMITS.TIME_FALLBACK_OPEN,
    },
    {
      id: 'q2',
      text: 'What is OOP? Explain its four main principles with examples.',
      topic: 'OOP',
      difficulty: 'easy',
      questionType: 'open',
      options: [],
      correctAnswerIndex: null,
      explanation: '',
      timeLimit: LIMITS.TIME_FALLBACK_OPEN,
    },
    {
      id: 'q3',
      text: 'What is the difference between a stack and a queue?',
      topic: 'DSA',
      difficulty: 'easy',
      questionType: 'open',
      options: [],
      correctAnswerIndex: null,
      explanation: '',
      timeLimit: LIMITS.TIME_FALLBACK_OPEN,
    },
    {
      id: 'q4',
      text: 'Explain the difference between let, const, and var in JavaScript.',
      topic: 'JavaScript',
      difficulty: 'easy',
      questionType: 'open',
      options: [],
      correctAnswerIndex: null,
      explanation: '',
      timeLimit: LIMITS.TIME_FALLBACK_OPEN,
    },
    {
      id: 'q5',
      text: 'What is a REST API and why is it commonly used?',
      topic: 'Web Development',
      difficulty: 'easy',
      questionType: 'open',
      options: [],
      correctAnswerIndex: null,
      explanation: '',
      timeLimit: LIMITS.TIME_FALLBACK_OPEN,
    },
    {
      id: 'q6',
      text: 'Explain the difference between SQL and NoSQL databases.',
      topic: 'Database',
      difficulty: 'medium',
      questionType: 'open',
      options: [],
      correctAnswerIndex: null,
      explanation: '',
      timeLimit: LIMITS.TIME_FALLBACK_OPEN,
    },
    {
      id: 'q7',
      text: 'What is inheritance in object-oriented programming?',
      topic: 'OOP',
      difficulty: 'easy',
      questionType: 'open',
      options: [],
      correctAnswerIndex: null,
      explanation: '',
      timeLimit: LIMITS.TIME_FALLBACK_OPEN,
    },
    {
      id: 'q8',
      text: 'What is binary search and what is its time complexity?',
      topic: 'DSA',
      difficulty: 'medium',
      questionType: 'open',
      options: [],
      correctAnswerIndex: null,
      explanation: '',
      timeLimit: LIMITS.TIME_FALLBACK_OPEN,
    },
    {
      id: 'q9',
      text: 'What is a JavaScript Promise and when would you use one?',
      topic: 'JavaScript',
      difficulty: 'medium',
      questionType: 'open',
      options: [],
      correctAnswerIndex: null,
      explanation: '',
      timeLimit: LIMITS.TIME_FALLBACK_OPEN,
    },
    {
      id: 'q10',
      text: 'Tell me about yourself and your technical background.',
      topic: 'HR',
      difficulty: 'easy',
      questionType: 'open',
      options: [],
      correctAnswerIndex: null,
      explanation: '',
      timeLimit: LIMITS.TIME_FALLBACK_OPEN,
    },
  ];

  if (topic) {
    const normalizedTopic = String(topic).toLowerCase();
    const matching = questions.filter(q => q.topic.toLowerCase().includes(normalizedTopic));
    const others = questions.filter(q => !q.topic.toLowerCase().includes(normalizedTopic));
    questions = [...matching, ...others];
  }

  return questions.slice(0, count);
};

const getFallbackMCQ = count => {
  const questions = [
    {
      id: 'mcq1',
      text: 'Which data structure follows the FIFO principle?',
      topic: 'Data Structures',
      difficulty: 'easy',
      questionType: 'mcq',
      options: ['Stack', 'Queue', 'Tree', 'Graph'],
      correctAnswerIndex: 1,
      explanation: 'A queue follows First-In-First-Out (FIFO).',
      timeLimit: LIMITS.TIME_MCQ,
    },
    {
      id: 'mcq2',
      text: 'What is the average time complexity of binary search on a sorted array?',
      topic: 'Algorithms',
      difficulty: 'easy',
      questionType: 'mcq',
      options: ['O(n)', 'O(log n)', 'O(n²)', 'O(1)'],
      correctAnswerIndex: 1,
      explanation: 'Binary search halves the search space at each step, giving O(log n) average time.',
      timeLimit: LIMITS.TIME_MCQ,
    },
    {
      id: 'mcq3',
      text: 'Which keyword declares a block-scoped constant in JavaScript?',
      topic: 'JavaScript',
      difficulty: 'easy',
      questionType: 'mcq',
      options: ['var', 'let', 'const', 'static'],
      correctAnswerIndex: 2,
      explanation: 'const declares a block-scoped binding that cannot be reassigned.',
      timeLimit: LIMITS.TIME_MCQ,
    },
    {
      id: 'mcq4',
      text: 'Which HTTP status code normally represents a successful request?',
      topic: 'Web Development',
      difficulty: 'easy',
      questionType: 'mcq',
      options: ['404', '500', '200', '301'],
      correctAnswerIndex: 2,
      explanation: 'HTTP 200 means the request was successfully processed.',
      timeLimit: LIMITS.TIME_MCQ,
    },
    {
      id: 'mcq5',
      text: 'Which SQL command is used to retrieve data from a table?',
      topic: 'Database',
      difficulty: 'easy',
      questionType: 'mcq',
      options: ['INSERT', 'SELECT', 'UPDATE', 'DELETE'],
      correctAnswerIndex: 1,
      explanation: 'SELECT retrieves data from one or more database tables.',
      timeLimit: LIMITS.TIME_MCQ,
    },
    {
      id: 'mcq6',
      text: 'Which OOP principle allows an object to hide internal implementation details?',
      topic: 'OOP',
      difficulty: 'medium',
      questionType: 'mcq',
      options: ['Inheritance', 'Encapsulation', 'Polymorphism', 'Recursion'],
      correctAnswerIndex: 1,
      explanation: 'Encapsulation hides internal state and implementation behind a public interface.',
      timeLimit: LIMITS.TIME_MCQ,
    },
    {
      id: 'mcq7',
      text: 'Which protocol is commonly used for secure HTTP communication?',
      topic: 'Networking',
      difficulty: 'easy',
      questionType: 'mcq',
      options: ['FTP', 'HTTP', 'HTTPS', 'SMTP'],
      correctAnswerIndex: 2,
      explanation: 'HTTPS is HTTP secured using TLS.',
      timeLimit: LIMITS.TIME_MCQ,
    },
    {
      id: 'mcq8',
      text: 'Which of the following is NOT a JavaScript primitive type?',
      topic: 'JavaScript',
      difficulty: 'medium',
      questionType: 'mcq',
      options: ['String', 'Boolean', 'Number', 'Array'],
      correctAnswerIndex: 3,
      explanation: 'Array is an object type in JavaScript, not a primitive type.',
      timeLimit: LIMITS.TIME_MCQ,
    },
  ];

  return questions.slice(0, count);
};

const getFallbackAptitude = count => {
  const questions = [
    {
      id: 'apt1',
      text: 'A train travels 120 km in 2 hours. What is its average speed?',
      topic: 'Quantitative Aptitude',
      difficulty: 'easy',
      questionType: 'aptitude',
      options: ['40 km/h', '50 km/h', '60 km/h', '80 km/h'],
      correctAnswerIndex: 2,
      explanation: 'Average speed = distance / time = 120 / 2 = 60 km/h.',
      timeLimit: LIMITS.TIME_APTITUDE,
    },
    {
      id: 'apt2',
      text: 'If 20% of a number is 50, what is the number?',
      topic: 'Percentages',
      difficulty: 'easy',
      questionType: 'aptitude',
      options: ['100', '150', '200', '250'],
      correctAnswerIndex: 3,
      explanation: '20% of x = 50, so x = 50 / 0.20 = 250.',
      timeLimit: LIMITS.TIME_APTITUDE,
    },
    {
      id: 'apt3',
      text: 'A product costs ₹800 and is sold at a 10% discount. What is the selling price?',
      topic: 'Percentages',
      difficulty: 'easy',
      questionType: 'aptitude',
      options: ['₹700', '₹720', '₹760', '₹780'],
      correctAnswerIndex: 1,
      explanation: '10% of ₹800 is ₹80. Therefore, selling price = ₹800 - ₹80 = ₹720.',
      timeLimit: LIMITS.TIME_APTITUDE,
    },
    {
      id: 'apt4',
      text: 'The ratio of boys to girls in a class is 3:2. If there are 30 boys, how many girls are there?',
      topic: 'Ratio',
      difficulty: 'easy',
      questionType: 'aptitude',
      options: ['15', '20', '25', '30'],
      correctAnswerIndex: 1,
      explanation: '3 parts correspond to 30, so one part is 10. Two parts correspond to 20 girls.',
      timeLimit: LIMITS.TIME_APTITUDE,
    },
    {
      id: 'apt5',
      text: 'A number is increased by 25% and becomes 100. What was the original number?',
      topic: 'Percentages',
      difficulty: 'medium',
      questionType: 'aptitude',
      options: ['75', '80', '85', '90'],
      correctAnswerIndex: 1,
      explanation: 'Original × 1.25 = 100, so original = 80.',
      timeLimit: LIMITS.TIME_APTITUDE,
    },
    {
      id: 'apt6',
      text: 'If 5 workers complete a task in 12 days, assuming equal productivity, how many days would 10 workers take?',
      topic: 'Time and Work',
      difficulty: 'medium',
      questionType: 'aptitude',
      options: ['3 days', '5 days', '6 days', '10 days'],
      correctAnswerIndex: 2,
      explanation: 'Workers and time are inversely proportional. Doubling workers from 5 to 10 halves the time from 12 to 6 days.',
      timeLimit: LIMITS.TIME_APTITUDE,
    },
    {
      id: 'apt7',
      text: 'What is the next number in the sequence: 2, 6, 12, 20, 30, ?',
      topic: 'Logical Reasoning',
      difficulty: 'medium',
      questionType: 'aptitude',
      options: ['36', '40', '42', '44'],
      correctAnswerIndex: 2,
      explanation: 'The differences are 4, 6, 8, 10, so the next difference is 12. Therefore 30 + 12 = 42.',
      timeLimit: LIMITS.TIME_APTITUDE,
    },
    {
      id: 'apt8',
      text: 'A shopkeeper buys an item for ₹500 and sells it for ₹600. What is the profit percentage?',
      topic: 'Profit and Loss',
      difficulty: 'easy',
      questionType: 'aptitude',
      options: ['10%', '15%', '20%', '25%'],
      correctAnswerIndex: 2,
      explanation: 'Profit = ₹600 - ₹500 = ₹100. Profit percentage = 100 / 500 × 100 = 20%.',
      timeLimit: LIMITS.TIME_APTITUDE,
    },
  ];

  return questions.slice(0, count);
};

const getFallbackMixed = count => {
  const open = getFallbackOpen('', 10);
  const mcq = getFallbackMCQ(8);
  const aptitude = getFallbackAptitude(8);

  const ratio = { mcq: 3, aptitude: 3, open: 4 };
  const total = ratio.mcq + ratio.aptitude + ratio.open;
  const cycles = Math.ceil(count / total);

  const pool = [];
  for (let i = 0; i < cycles; i++) {
    pool.push(...mcq.slice(0, ratio.mcq), ...aptitude.slice(0, ratio.aptitude), ...open.slice(0, ratio.open));
  }

  return pool.slice(0, count);
};

const getFallbackQuestions = (mode, topic, count) => {
  if (mode === 'mcq') return getFallbackMCQ(count);
  if (mode === 'aptitude') return getFallbackAptitude(count);
  if (mode === 'mixed') return getFallbackMixed(count);
  return getFallbackOpen(topic, count);
};

const fallbackEval = ({ userAnswer }) => {
  const answer = String(userAnswer || '').trim();

  if (!answer) {
    return {
      score: 0,
      aiAvailable: false,
      fallback: true,
      good: 'No answer was provided.',
      missing: 'The question was not answered.',
      idealHint: 'Try to explain the main concept asked in the question.',
      tip: 'Give a direct answer first, then support it with an example.',
      sampleAnswer: 'Start with the definition or main idea, then briefly explain how it works.',
    };
  }

  if (answer.length < 30) {
    return {
      score: 35,
      aiAvailable: false,
      fallback: true,
      good: 'You attempted the question and gave a direct response.',
      missing: 'The answer is quite short and may not contain enough explanation or supporting details.',
      idealHint: 'Explain the main concept and include one relevant example.',
      tip: 'Expand your answer with a definition, explanation, and example.',
      sampleAnswer: 'Give the main definition, explain the key idea, and finish with a simple example.',
    };
  }

  return {
    score: 60,
    aiAvailable: false,
    fallback: true,
    good: 'You provided a substantive answer to the question.',
    missing: 'Detailed AI evaluation is temporarily unavailable, so specific technical gaps could not be identified.',
    idealHint: 'Make sure your answer directly addresses the question and covers the important technical concepts.',
    tip: 'Structure your answer clearly: explain the concept, give the reasoning, and add an example where appropriate.',
    sampleAnswer: 'A strong interview answer should directly address the question, explain the key technical idea, and provide a concise example.',
  };
};

const fallbackCoachAdvice = ({
  totalSessions = 0,
  averageScore = 0,
  bestScore = 0,
  streak = 0,
  weakest = [],
  strongest = 'N/A',
  currentTierLabel = null,
  nextTierLabel = null,
  nextTierReadinessPct = null,
  primaryBlockerLabel = null,
  sessionsToUnlockNextTier = null,
} = {}) => {
  const weakestText = weakest.length ? weakest.join(', ') : 'not enough data yet to identify weak topics';
  const tierText = currentTierLabel
    ? `You're currently tracking toward the ${currentTierLabel} tier`
    : 'Your tier placement needs a few more sessions to be reliable';
  const nextTierText =
    nextTierLabel && nextTierReadinessPct !== null
      ? ` and are ${nextTierReadinessPct}% of the way to ${nextTierLabel}.`
      : '.';
  const blockerText = primaryBlockerLabel
    ? `Right now, ${primaryBlockerLabel} is your biggest blocker to leveling up.`
    : 'Keep practicing consistently to surface your biggest growth area.';
  const unlockText =
    sessionsToUnlockNextTier !== null
      ? `At your current pace, roughly ${sessionsToUnlockNextTier} more focused sessions could unlock the next tier.`
      : 'A few more sessions of consistent practice will let MockMate start projecting a reliable timeline for your next tier.';

  return {
    verdict: `AI coaching is temporarily unavailable, so here's a snapshot based on your saved stats. Across ${totalSessions} session(s), you're averaging ${averageScore}/100 with a best of ${bestScore}/100. ${tierText}${nextTierText}`,
    criticalGaps: `Your weaker areas so far: ${weakestText}. ${blockerText}`,
    strengths: `Your strongest topic has been ${strongest}. A ${streak}-day streak shows you're building consistency, which matters as much as raw scores.`,
    battlePlan: `Keep sessions short but frequent, and prioritize your weak topics (${weakestText}) before broadening out. ${unlockText}`,
    mindset: 'Placement prep is a marathon, not a sprint — steady, honest practice beats cramming. This detailed analysis will refresh automatically once AI coaching is back online.',
    aiAvailable: false,
    fallback: true,
  };
};

const generateQuestions = async ({
  mode = 'quick',
  company = '',
  topic = '',
  topics = [],
  role = '',
  experienceLevel = '',
  weakAreas = [],
  difficulty = 'mixed',
  count = 10,
  previousQuestions = [],
}) => {
  const safeCount = Math.max(1, Math.min(Number(count) || 10, LIMITS.MAX_QUESTIONS));
  const normalizedMode = VALID_MODES.includes(mode) ? mode : 'quick';

  const exclusionBlock = previousQuestions.length > 0
    ? `\nPREVIOUSLY SEEN QUESTIONS (do NOT repeat or closely paraphrase any of these):\n${previousQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n`
    : '';

  // ── Company: resolve to real interview-format knowledge, not just a name ──
  // Works for both curated companies AND anything the user typed in freely —
  // resolveCompanyProfile always returns usable rounds/focus signal, and
  // marks isKnown:false for unrecognized names so the prompt is honest with
  // the model about what's verified vs. inferred.
  const companyProfile = normalizedMode === 'company' ? resolveCompanyProfile(company) : null;
  const companyBlock = companyProfile
    ? `
COMPANY INTERVIEW PROFILE — ${companyProfile.displayName}
${companyProfile.isKnown
    ? `Known round structure: ${companyProfile.rounds.join(' → ')}.
Technical focus at this company: ${companyProfile.focus}
${companyProfile.tips ? `Practical note: ${companyProfile.tips}` : ''}`
    : `This company isn't in our curated list — infer a realistic interview style from general knowledge of how similar companies in this space hire (typical rounds: ${companyProfile.rounds.join(', ')}). Do not invent specific, unverifiable claims about this exact company (e.g. specific interviewer names or internal processes) — keep it to realistic, general placement-style questions.`}
Shape the questions to genuinely reflect this company's interview style, not just generic questions with the company name inserted.
`
    : '';

  // ── Role + experience: changes both topic weighting and expected depth ──
  const roleKey = resolveRole(role);
  const roleProfile = ROLES[roleKey];
  const experienceKey = resolveExperience(experienceLevel);
  const experienceProfile = EXPERIENCE_LEVELS[experienceKey];
  const roleBlock = `
CANDIDATE PROFILE

Target role: ${roleProfile.label}
Role focus areas to weight questions toward: ${roleProfile.focusAreas}
Experience level: ${experienceProfile.label}
Calibration: ${experienceProfile.calibration}
`;

  // ── Topics: support one legacy single topic OR a multi-topic array ──────
  const topicList = Array.isArray(topics) && topics.length ? topics : (topic ? [topic] : []);
  const topicBlock = topicList.length
    ? topicList.length === 1
      ? `Topic: ${topicList[0]}`
      : `Topics (blend across all of these, don't silo into separate blocks): ${topicList.join(', ')}`
    : 'Topic: Mixed';

  const prompt = `
You are an expert interviewer and assessment designer.

Generate exactly ${safeCount} questions for an Indian engineering student preparing for placements.
${exclusionBlock}
${roleBlock}
INTERVIEW CONFIGURATION

Mode: ${normalizedMode}
Company: ${company || 'General'}
${topicBlock}
Difficulty: ${difficulty || 'mixed'}
Weak areas: ${weakAreas?.length ? weakAreas.join(', ') : 'None'}
${companyBlock}
MODE RULES

1. QUICK MODE
- Primarily realistic interview questions.
- Use open-ended questions.
- Include technical, behavioral, or role-related questions, weighted toward the candidate's target role above.
- questionType must be "open".
2. FULL MODE
- Same as quick but broader topic coverage. 10 questions.
- questionType must be "open".

3. COMPANY MODE
- Questions tailored to the specified company's known interview patterns (see COMPANY INTERVIEW PROFILE above).
- Mix technical and behavioral, matching the company's actual round mix where known.
- questionType must be "open".

4. TOPIC MODE
- Deep dive into the specified topic(s) only. If multiple topics are given, blend across them rather than treating them as separate sections.
- questionType must be "open".

5. MCQ MODE
- Every question must be multiple choice.
- questionType must be "mcq".
- Exactly 4 options.
- Only one option may be correct.
- correctAnswerIndex must be 0, 1, 2, or 3.
- Include a short explanation.

6. APTITUDE MODE
- Every question must be aptitude/reasoning.
- questionType must be "aptitude".
- Exactly 4 options.
- Only one option may be correct.
- correctAnswerIndex must be 0, 1, 2, or 3.
- Include a short explanation.

7. MIXED MODE
Combine:
- technical MCQs
- aptitude questions
- open-ended interview questions

QUALITY RULES

- CRITICAL: Do not repeat or closely paraphrase any question from the PREVIOUSLY SEEN list above.
- Each question must test a clearly different concept, angle, or sub-topic from the others.
- Match requested difficulty AND the candidate's experience-level calibration above — these two must agree (e.g. "hard" difficulty for a fresher still means hard-but-fresher-appropriate, not senior-engineer-scope).
- Prioritize weak areas.
- Weight question selection toward the candidate's target role focus areas above — don't ask backend-heavy questions to a frontend candidate and vice versa, unless mode is "full" or "mixed" where broader coverage is expected.
- Use company context where appropriate.
- Avoid ambiguous wording.
- Make objective questions have exactly one correct answer.
- Keep options concise and plausible.
- Keep aptitude arithmetic internally consistent.
- Use realistic Indian placement-test style.

TIME LIMITS

Open: 120 seconds
MCQ: 45 seconds
Aptitude: 60 seconds

Return ONLY JSON.
`;

  const normalize = str =>
    String(str || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  try {
    const result = await withRetry(
      {
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseJsonSchema: QUESTION_SCHEMA,
        },
      },
      { maxRetries: 1 }
    );

    const parsed = parseJson(result.text);

    if (!parsed.questions || !Array.isArray(parsed.questions) || parsed.questions.length < safeCount) {
      throw new Error('Gemini returned fewer questions than requested.');
    }

    const normalized = parsed.questions
      .slice(0, safeCount)
      .map((question, index) => normalizeQuestion(question, index, normalizedMode));

    const previousSet = new Set(previousQuestions.map(normalize));
    const deduped = [];

    for (const q of normalized) {
      const key = normalize(q.text);
      if (!previousSet.has(key)) {
        previousSet.add(key);
        deduped.push(q);
      }
    }

    const hasInvalidObjective = deduped.some(q => {
      if (q.questionType === 'open') return false;
      return q.options.length !== 4 || q.correctAnswerIndex === null || q.correctAnswerIndex === -1;
    });

    if (hasInvalidObjective) throw new Error('Gemini returned an invalid objective question.');

    return deduped;
  } catch (error) {
    console.error('Gemini generateQuestions error:', getErrorMessage(error));

    if (getStatus(error) === 503) {
      try {
        const retryResult = await withRetry(
          {
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
              responseJsonSchema: QUESTION_SCHEMA,
            },
          },
          { maxRetries: 1 }
        );
        const retryParsed = parseJson(retryResult.text);
        if (retryParsed.questions?.length >= safeCount) {
          return retryParsed.questions
            .slice(0, safeCount)
            .map((q, i) => normalizeQuestion(q, i, normalizedMode));
        }
           } catch (_err) {
        // fall through to static fallback
      }
    }

    return getFallbackQuestions(normalizedMode, topicList[0] || topic, safeCount);
  }
};



const evaluateOpenAnswer = async ({ question, answer, topic, voiceMetrics = null }) => {
  const questionText  = typeof question === 'string' ? question : question?.text || '';
  const userAnswer    = String(answer || '').trim();
  const questionTopic = topic || (typeof question === 'string' ? 'General' : question?.topic) || 'General';
 
  if (!userAnswer) {
    return {
      score: 0,
      feedback: 'No answer was provided.',
      good: 'No answer was provided.',
      missing: 'The question was not answered.',
      idealHint: 'Start with the main concept or definition asked by the question.',
      tip: 'Answer the question directly first, then explain your reasoning.',
      sampleAnswer: 'Start with the main definition or idea, explain it briefly, and give an example if appropriate.',
      aiAvailable: true,
      fallback: false,
    };
  }
 
  // ── Voice-metrics block (injected only when available) ──────────────────
  const voiceBlock = voiceMetrics
    ? `
Voice delivery metrics (collected from the student's microphone — these are
measured values, not estimates; use them as ground truth):
- Words per minute       : ${voiceMetrics.wpm?.wpm ?? '—'} wpm  (${voiceMetrics.wpm?.label ?? '—'})
- Pace consistency       : ${voiceMetrics.wpm?.consistency
    ? `${voiceMetrics.wpm.consistency.rating} (${voiceMetrics.wpm.consistency.firstHalfWpm} wpm first half → ${voiceMetrics.wpm.consistency.secondHalfWpm} wpm second half)`
    : '—'}
- Filler word count      : ${voiceMetrics.fillerWords?.total ?? '—'} total  |  rate: ${voiceMetrics.fillerWords?.rate ?? '—'} per 100 words
- Filler breakdown       : ${JSON.stringify(voiceMetrics.fillerWords?.breakdown ?? [])}
- Filler positional trend: ${voiceMetrics.fillerWords?.trend ?? '—'} (front-loaded = nerves settling, back-loaded = losing structure, even = spread out)
- Pauses                 : ${voiceMetrics.pauses
    ? `${voiceMetrics.pauses.rating} — ${voiceMetrics.pauses.deadAirCount} dead-air gap(s) 4s+ (longest ${voiceMetrics.pauses.longestPauseSeconds}s), ${voiceMetrics.pauses.thinkingPauseCount} shorter thinking pause(s)`
    : '—'}
- Answer length          : ${voiceMetrics.answerLength?.wordCount ?? '—'} words  (${voiceMetrics.answerLength?.rating ?? '—'}; target ${voiceMetrics.answerLength?.min ?? '—'}–${voiceMetrics.answerLength?.max ?? '—'})
- Vocabulary TTR         : ${voiceMetrics.vocabularyDiversity?.ttr ?? '—'}  (${voiceMetrics.vocabularyDiversity?.label ?? '—'}) — ${voiceMetrics.vocabularyDiversity?.uniqueWords ?? '—'} unique / ${voiceMetrics.vocabularyDiversity?.totalWords ?? '—'} total words
- Sentence clarity       : avg ${voiceMetrics.sentenceClarity?.avgWordsPerSentence ?? '—'} words/sentence  (${voiceMetrics.sentenceClarity?.label ?? '—'})
- Computed delivery score: ${voiceMetrics.deliveryScore ?? '—'} / 100  (pre-computed from pace + fillers + pauses + length — do not recompute, use it as a calibration anchor)
- Recording length       : ${voiceMetrics.durationSeconds != null ? voiceMetrics.durationSeconds.toFixed(1) + 's' : '—'}

Instructions for using these metrics:
- Use ALL of the above as ground truth to populate toneAnalysis, vocabularyRichness, hesitationPattern, and deliveryTip.
- toneAnalysis.formalPct / casualPct should reflect the CONTENT language style, not the WPM.
- vocabularyRichness.uniqueRatio must match the TTR above (${voiceMetrics.vocabularyDiversity?.ttr ?? '—'}) — do not guess a different number.
- hesitationPattern.score must be INVERSELY related to filler rate: high fillers → low score.
- hesitationPattern.where: use the filler positional trend and pause data above (not a fresh inference from the transcript alone).
- deliveryTip: one specific, actionable coaching sentence (max 30 words) targeting the single weakest measured metric.
`
    : 'No voice metrics were recorded (student typed their answer). Set deliveryTip, toneAnalysis, vocabularyRichness, and hesitationPattern all to null.';
 
  const prompt = `
You are a strict but fair technical placement interviewer and speech coach.
 
Question:
${questionText}
 
Topic:
${questionTopic}
 
Student Answer:
${userAnswer}
 
${voiceBlock}
 
────────────────────────────────────────────
CONTENT EVALUATION (score 0–100):
 
Evaluate on:
1. Correctness — are the technical claims accurate?
2. Technical depth — does the student show real understanding?
3. Relevance — does the answer address exactly what was asked?
4. Clarity — is it structured and easy to follow?
5. Completeness — are the key points covered?
6. Practical reasoning — examples or applied thinking where appropriate.
 
RULES:
- Concise but technically correct answers can score highly.
- Penalise incorrect technical claims and question-avoidance.
- For behavioural questions, evaluate relevance, clarity, ownership,
  reasoning, and stated outcome.
- Do not require examples when the question does not warrant them.
 
────────────────────────────────────────────
STAR METHOD BREAKDOWN:
 
Assess how well the student structured their answer using the STAR framework.
Each pillar gets:
  - score (0–100)
  - note  (one short sentence of specific feedback for that pillar, max 15 words)
 
Only evaluate STAR when the question is behavioural or situational.
For purely technical questions, set every STAR pillar score to 0 and set
overall to "STAR structure is not applicable for this technical question."
 
────────────────────────────────────────────
KEYWORD COVERAGE:
 
Identify the 4–8 technical keywords or concepts a strong answer to THIS
specific question must include. Then classify each as:
  - hit    : the student explicitly mentioned or clearly addressed it
  - missed : the student omitted it entirely
 
────────────────────────────────────────────
CONFIDENCE SCORE:
 
Read the student's language for assertiveness vs hedging.
- score (0–100): 100 = fully assertive, 0 = extremely hesitant
- label : "Assertive" | "Measured" | "Hesitant"
- formalPct  : estimated % of language that is formal/technical (0–100)
- hedgingPct : estimated % of language that uses hedges ("I think", "maybe", "sort of") (0–100)
- note  : one short insight (max 20 words)
 
────────────────────────────────────────────
FOLLOW-UP QUESTIONS:
 
Write exactly 3 questions a real interviewer would ask NEXT based on this
specific answer. Make them targeted — not generic interview questions.
 
────────────────────────────────────────────
VOICE DELIVERY ANALYSIS (only when voice metrics are provided):
 
toneAnalysis:
  - score      : 0–100 (how professional/appropriate the tone sounds)
  - label      : "Professional" | "Conversational" | "Casual"
  - formalPct  : estimated formal-language ratio (0–100)
  - casualPct  : estimated casual-language ratio (0–100)
  - note       : one actionable sentence (max 20 words)
 
vocabularyRichness:
  - score       : 0–100 (how varied and precise the vocabulary is)
  - label       : "Rich" | "Average" | "Basic"
  - uniqueRatio : estimated ratio of unique words to total words (0.0–1.0)
  - note        : one actionable sentence (max 20 words)
 
hesitationPattern:
  - score   : 0–100 (100 = very fluent / no hesitation, 0 = very hesitant)
  - pattern : "Confident" | "Moderate" | "Hesitant"
  - where   : "start-heavy" | "end-heavy" | "distributed" | null
              (where pauses / fillers were most concentrated)
  - note    : one actionable sentence (max 20 words)
 
deliveryTip:
  A single, specific, actionable coaching tip based on the voice metrics
  and the content of the answer. Max 30 words.
  If no voice metrics were recorded, set deliveryTip to null.
 
────────────────────────────────────────────
Return ONLY valid JSON matching the schema below. No markdown, no extra keys.
`;
 
  // ── JSON schema for Gemini structured output ────────────────────────────
  const EVAL_SCHEMA = {
    type: 'object',
    properties: {
      score:         { type: 'number' },
      good:          { type: 'string' },
      missing:       { type: 'string' },
      idealHint:     { type: 'string' },
      tip:           { type: 'string' },
      sampleAnswer:  { type: 'string' },
      deliveryTip:   { type: 'string' },
 
      starBreakdown: {
        type: 'object',
        properties: {
          S:       { type: 'object', properties: { score: { type: 'number' }, note: { type: 'string' } }, required: ['score', 'note'] },
          T:       { type: 'object', properties: { score: { type: 'number' }, note: { type: 'string' } }, required: ['score', 'note'] },
          A:       { type: 'object', properties: { score: { type: 'number' }, note: { type: 'string' } }, required: ['score', 'note'] },
          R:       { type: 'object', properties: { score: { type: 'number' }, note: { type: 'string' } }, required: ['score', 'note'] },
          overall: { type: 'string' },
        },
        required: ['S', 'T', 'A', 'R', 'overall'],
      },
 
      followUpQuestions: {
        type: 'array',
        items: { type: 'string' },
      },
 
      keywordCoverage: {
        type: 'object',
        properties: {
          hit:    { type: 'array', items: { type: 'string' } },
          missed: { type: 'array', items: { type: 'string' } },
        },
        required: ['hit', 'missed'],
      },
 
      confidenceScore: {
        type: 'object',
        properties: {
          score:      { type: 'number' },
          label:      { type: 'string' },
          formalPct:  { type: 'number' },
          hedgingPct: { type: 'number' },
          note:       { type: 'string' },
        },
        required: ['score', 'label', 'note'],
      },
 
      toneAnalysis: {
        type: 'object',
        properties: {
          score:     { type: 'number' },
          label:     { type: 'string' },
          formalPct: { type: 'number' },
          casualPct: { type: 'number' },
          note:      { type: 'string' },
        },
        required: ['score', 'label', 'note'],
      },
 
      vocabularyRichness: {
        type: 'object',
        properties: {
          score:       { type: 'number' },
          label:       { type: 'string' },
          uniqueRatio: { type: 'number' },
          note:        { type: 'string' },
        },
        required: ['score', 'label', 'note'],
      },
 
      hesitationPattern: {
        type: 'object',
        properties: {
          score:   { type: 'number' },
          pattern: { type: 'string' },
          where:   { type: 'string' },
          note:    { type: 'string' },
        },
        required: ['score', 'pattern', 'note'],
      },
    },
    required: ['score', 'good', 'missing', 'idealHint', 'tip', 'sampleAnswer',
               'starBreakdown', 'followUpQuestions', 'keywordCoverage', 'confidenceScore'],
  };
 
  try {
    const result = await withRetry({
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseJsonSchema: EVAL_SCHEMA,
      },
    });
 
    const parsed = parseJson(result.text);
 
    let score = Number(parsed.score);
    if (!Number.isFinite(score)) throw new Error('Gemini returned an invalid score.');
    score = Math.max(0, Math.min(100, Math.round(score)));
 
    const base = {
      good:         String(parsed.good         || '').trim(),
      missing:      String(parsed.missing       || '').trim(),
      idealHint:    String(parsed.idealHint     || '').trim(),
      tip:          String(parsed.tip           || '').trim(),
      sampleAnswer: String(parsed.sampleAnswer  || '').trim(),
      deliveryTip:  parsed.deliveryTip ? String(parsed.deliveryTip).trim() : null,
    };
 
    // ── new enriched fields ───────────────────────────────────────────────
    const enriched = {
      starBreakdown:      parsed.starBreakdown      || null,
      followUpQuestions:  Array.isArray(parsed.followUpQuestions) ? parsed.followUpQuestions.filter(Boolean) : [],
      keywordCoverage:    parsed.keywordCoverage    || null,
      confidenceScore:    parsed.confidenceScore    || null,
      toneAnalysis:       parsed.toneAnalysis       || null,
      vocabularyRichness: parsed.vocabularyRichness || null,
      hesitationPattern:  parsed.hesitationPattern  || null,
    };
 
    return {
      score,
      feedback: JSON.stringify({ ...base, ...enriched }),
      ...base,
      ...enriched,
      aiAvailable: true,
      fallback: false,
    };
  } catch (error) {
    console.error('Gemini evaluateOpenAnswer error:', getErrorMessage(error));
    const fb = fallbackEval({ userAnswer });
    return {
      ...fb,
      feedback: JSON.stringify({
        good: fb.good, missing: fb.missing, idealHint: fb.idealHint,
        tip: fb.tip, sampleAnswer: fb.sampleAnswer,
      }),
    };
  }
};
const getSkippedAnswer = async ({ question, topic }) => {
  const questionText = typeof question === 'string' ? question : question?.text || '';
  const questionTopic = topic || (typeof question === 'string' ? 'General' : question?.topic) || 'General';

  const prompt = `
You are a senior technical interviewer writing a model answer for a placement-interview
question that a student SKIPPED (did not attempt).

Question:
${questionText}

Topic:
${questionTopic}

Write the ideal answer a strong candidate would give. Requirements:
- Total length 75-100 words.
- Write it as 3-5 short, distinct points (not one dense paragraph) — each point should
  be a self-contained idea a student could scan quickly.
- Be concrete and specific to THIS question — no generic filler like "explain the concept
  clearly." Include the actual technical content, terms, or reasoning steps involved.
- If the question invites an example, include one short concrete example within the points.
- Assume the student has zero context beyond the question itself.

Also write:
- keyIdea: one sentence (max 20 words) naming the single most important concept this
  question is really testing.
- commonMistake: one sentence (max 20 words) on the most common way candidates get this
  wrong or lose points, phrased usefully for someone who skipped rather than attempted it.

Return ONLY JSON.
`;

  try {
    const result = await withRetry({
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseJsonSchema: {
          type: 'object',
          properties: {
            keyIdea: { type: 'string' },
            commonMistake: { type: 'string' },
            modelAnswer: { type: 'string' },
          },
          required: ['keyIdea', 'commonMistake', 'modelAnswer'],
        },
      },
    });

    const parsed = parseJson(result.text);
    const modelAnswer = String(parsed.modelAnswer || '').trim();
    const keyIdea = String(parsed.keyIdea || '').trim();
    const commonMistake = String(parsed.commonMistake || '').trim();

    if (!modelAnswer) throw new Error('Gemini returned an empty model answer.');

    return {
      idealHint: keyIdea,
      tip: commonMistake,
      sampleAnswer: modelAnswer,
      aiAvailable: true,
      fallback: false,
    };
  } catch (error) {
    console.error('Gemini getSkippedAnswer error:', getErrorMessage(error));

    return {
      idealHint: 'Start with the core definition or concept the question is testing.',
      tip: 'Answer the question directly first, then support it with reasoning or an example.',
      sampleAnswer:
        'A strong answer would name the key concept the question is testing, explain it in ' +
        'two or three concrete points, and close with a short example or real scenario ' +
        'showing how it applies in practice.',
      aiAvailable: false,
      fallback: true,
    };
  }
};

const evalObjectiveAnswer = ({ question, answerIndex }) => {
  const selectedIndex =
    answerIndex === null || answerIndex === undefined || answerIndex === ''
      ? null
      : Number(answerIndex);

  const correctIndex =
    question?.correctAnswerIndex === null || question?.correctAnswerIndex === undefined
      ? null
      : Number(question.correctAnswerIndex);

  if (selectedIndex === null || !Number.isInteger(selectedIndex)) {
    return { score: 0, feedback: 'No option was selected.', correct: false };
  }

  if (correctIndex === null || !Number.isInteger(correctIndex) || correctIndex === -1) {
    return {
      score: 0,
      feedback: 'The correct answer was not available for this question.',
      correct: false,
    };
  }

  if (selectedIndex === correctIndex) {
    return {
      score: 100,
      feedback: question?.explanation || 'Correct answer.',
      correct: true,
    };
  }

  const correctOption = question?.options?.[correctIndex];

  return {
    score: 0,
    feedback: correctOption
      ? `Incorrect. The correct answer is: ${correctOption}. ${question?.explanation || ''}`
      : 'Incorrect answer.',
    correct: false,
  };
};

const evaluateAnswer = async ({ question, userAnswer, topic }) => {
  const result = await evaluateOpenAnswer({ question, answer: userAnswer, topic });

  return {
    ...result,
    score10: Math.round(Number(result.score || 0) / 10),
  };
};

const generateCoachAdvice = async ({
  profile = {},
  totalSessions = 0,
  averageScore = 0,
  bestScore = 0,
  streak = 0,
  weakest = [],
  strongest = 'N/A',
  topicPerformance = [],
  irs = null,
  currentTierLabel = null,
  nextTierLabel = null,
  nextTierReadinessPct = null,
  primaryBlockerLabel = null,
  primaryBlockerGap = null,
  sessionsToUnlockNextTier = null,
}) => {
  const readinessBlock = irs !== null
    ? `
Verified readiness data (this is the SAME number shown on the student's dashboard — your analysis must agree with it, not contradict it):
- Interview Readiness Score (IRS): ${irs}/100
- Current package tier: ${currentTierLabel || 'Not yet determined'}
- Next tier target: ${nextTierLabel || 'Already at the highest tracked tier'}
${nextTierReadinessPct !== null ? `- Readiness toward next tier: ${nextTierReadinessPct}%` : ''}
${primaryBlockerLabel ? `- Primary blocking dimension: ${primaryBlockerLabel} (${primaryBlockerGap} points short of the bar for the next tier)` : ''}
${sessionsToUnlockNextTier !== null ? `- At current pace, estimated sessions to unlock next tier: ${sessionsToUnlockNextTier}` : '- Not enough per-dimension history yet to project a reliable sessions-to-unlock estimate — say so honestly rather than inventing a number.'}
`
    : '';

  const prompt = `
You are MockMate's AI placement coach for
an Indian engineering student preparing for
campus placements.

Student profile:
- College: ${profile.college || 'Not provided'}
- Branch: ${profile.branch || 'Not provided'}
- Semester: ${profile.semester || 'Not provided'}
- Interviews completed: ${totalSessions}
- Average score: ${averageScore}/100
- Best score: ${bestScore}/100
- Current streak: ${streak} days
- Strongest topic: ${strongest}
- Weakest topics: ${weakest.length ? weakest.join(', ') : 'Not enough data'}
${readinessBlock}
Topic performance:
${JSON.stringify(topicPerformance)}

Give a concise but highly personalised
placement-preparation analysis.

CRITICAL RULES:
- Your verdict and battle plan MUST be consistent with the verified readiness
  data above — do not state a different tier, percentage, or blocker than
  what's given. If readiness data is missing, say the student needs more
  sessions before a tier estimate is reliable, rather than guessing one.
- If a sessions-to-unlock estimate was provided, mention it in the battle
  plan as a concrete milestone. If it was explicitly marked unavailable,
  do not invent one — instead say what kind of practice would let MockMate
  start projecting an ETA (e.g. "a few more sessions focused on X").
- Do not invent achievements, scores, or numbers not given above.

Return ONLY JSON with:

{
  "verdict": "...",
  "criticalGaps": "...",
  "strengths": "...",
  "battlePlan": "...",
  "mindset": "..."
}

Be specific. Reference the student's actual performance and the verified
readiness numbers above.
`;

  try {
    const result = await withRetry({
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseJsonSchema: {
          type: 'object',
          properties: {
            verdict: { type: 'string' },
            criticalGaps: { type: 'string' },
            strengths: { type: 'string' },
            battlePlan: { type: 'string' },
            mindset: { type: 'string' },
          },
          required: ['verdict', 'criticalGaps', 'strengths', 'battlePlan', 'mindset'],
        },
      },
    });

    const parsed = parseJson(result.text);

    return { ...parsed, aiAvailable: true, fallback: false };
  } catch (error) {
    console.error('Gemini generateCoachAdvice error:', getErrorMessage(error));

    return fallbackCoachAdvice({
      totalSessions,
      averageScore,
      bestScore,
      streak,
      weakest,
      strongest,
      currentTierLabel,
      nextTierLabel,
      nextTierReadinessPct,
      primaryBlockerLabel,
      sessionsToUnlockNextTier,
    });
  }
};

const generateFreeform = async (prompt, maxTokens = LIMITS.DEFAULT_TOKENS) => {
  if (typeof prompt !== 'string' || !prompt.trim()) {
    throw new Error('AI prompt is required.');
  }

  const safeMaxTokens = Math.min(Math.max(Number(maxTokens) || LIMITS.DEFAULT_TOKENS, 16), LIMITS.MAX_TOKENS);

  try {
    const result = await withRetry({
      contents: prompt.trim(),
      config: {
        responseMimeType: 'text/plain',
        maxOutputTokens: safeMaxTokens,
      },
    });

    return (result?.text || '').trim();
  } catch (error) {
    console.error('Gemini generateFreeform error:', getErrorMessage(error));

    if (isQuotaError(error) || isTemporaryError(error)) {
      return 'AI insights are temporarily busy — please try again in a moment.';
    }

    throw error;
  }
};

module.exports = {
  generateQuestions,
  evaluateOpenAnswer,
  getSkippedAnswer,
  evalObjectiveAnswer,
  evaluateAnswer,
  getFallbackQuestions,
  fallbackEval,
  fallbackCoachAdvice,
  generateCoachAdvice,
  generateFreeform,
};