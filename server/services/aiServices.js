const { GoogleGenAI } = require('@google/genai');

// ---------------------------------------------------------
// Gemini configuration
// ---------------------------------------------------------

const apiKey = process.env.GEMINI_API_KEY;

const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
    })
  : null;

const MODEL =
  process.env.GEMINI_MODEL || 'gemini-3.6-flash';

// ---------------------------------------------------------
// Configuration
// ---------------------------------------------------------

const MAX_RETRIES = 2;
const INITIAL_RETRY_DELAY = 2000;
const MAX_RETRY_DELAY = 10000;

// ---------------------------------------------------------
// Helpers
// ---------------------------------------------------------

const sleep = ms =>
  new Promise(resolve => setTimeout(resolve, ms));

const getErrorMessage = error =>
  error?.message ||
  error?.error?.message ||
  String(error || '');

const getStatus = error =>
  error?.status ||
  error?.code ||
  error?.error?.status ||
  error?.error?.code;

// ---------------------------------------------------------
// Error detection
// ---------------------------------------------------------

const isQuotaError = error => {
  const message =
    getErrorMessage(error).toLowerCase();

  return (
    getStatus(error) === 429 ||
    message.includes('resource_exhausted') ||
    message.includes('quota') ||
    message.includes('rate limit') ||
    message.includes('too many requests')
  );
};

const isTemporaryError = error => {
  const status = Number(getStatus(error));

  return [
    429,
    500,
    502,
    503,
    504,
  ].includes(status);
};

// ---------------------------------------------------------
// Retry delay
// ---------------------------------------------------------

const getRetryDelay = (
  error,
  attempt
) => {
  const retryInfo =
    error?.details?.find?.(
      detail =>
        detail?.['@type']?.includes(
          'RetryInfo'
        ) ||
        detail?.type?.includes(
          'RetryInfo'
        )
    );

  if (retryInfo?.retryDelay) {
    const retryDelay =
      retryInfo.retryDelay;

    if (
      typeof retryDelay ===
      'string'
    ) {
      const seconds =
        parseFloat(retryDelay);

      if (
        !Number.isNaN(seconds)
      ) {
        return Math.min(
          seconds * 1000,
          MAX_RETRY_DELAY
        );
      }
    }
  }

  return Math.min(
    INITIAL_RETRY_DELAY *
      Math.pow(2, attempt),
    MAX_RETRY_DELAY
  );
};

// ---------------------------------------------------------
// Gemini request
// ---------------------------------------------------------


const generateWithRetry = async request => {
    if (!ai) {
      throw new Error(
        'GEMINI_API_KEY is not configured.'
      );
    }

    let lastError = null;

    for (
      let attempt = 0;
      attempt <= MAX_RETRIES;
      attempt++
    ) {
      try {
        return await ai.models.generateContent(
          request
        );
      } catch (error) {
        lastError = error;

        console.error(
          `Gemini request failed. Attempt ${
            attempt + 1
          }/${MAX_RETRIES + 1}:`,
          getErrorMessage(error)
        );

        // Never waste retries on quota errors.
        if (isQuotaError(error)) {
          throw error;
        }

        if (
          !isTemporaryError(error)
        ) {
          throw error;
        }

        if (
          attempt === MAX_RETRIES
        ) {
          break;
        }

        const delay =
          getRetryDelay(
            error,
            attempt
          );

        console.log(
          `Retrying Gemini request in ${delay}ms...`
        );

        await sleep(delay);
      }
    }

    throw lastError;
  };

// ---------------------------------------------------------
// JSON parser
// ---------------------------------------------------------

const parseJsonResponse = responseText => {
    if (!responseText) {
      throw new Error(
        'Gemini returned an empty response.'
      );
    }

    try {
      return JSON.parse(
        responseText
      );
    } catch {
      try {
        const cleaned =
          String(responseText)
            .replace(
              /^```json\s*/i,
              ''
            )
            .replace(
              /^```\s*/i,
              ''
            )
            .replace(
              /\s*```$/i,
              ''
            )
            .trim();

        return JSON.parse(
          cleaned
        );
      } catch {
        throw new Error(
          'Gemini returned invalid JSON.'
        );
      }
    }
  };

// ---------------------------------------------------------
// Question helpers
// ---------------------------------------------------------

const normalizeQuestionType = (
  questionType,
  mode
) => {
  if (
    [
      'open',
      'mcq',
      'aptitude',
    ].includes(questionType)
  ) {
    return questionType;
  }

  if (mode === 'mcq') {
    return 'mcq';
  }

  if (mode === 'aptitude') {
    return 'aptitude';
  }

  return 'open';
};

const getDefaultTimeLimit = questionType => {
    if (
      questionType === 'mcq'
    ) {
      return 45;
    }

    if (
      questionType ===
      'aptitude'
    ) {
      return 60;
    }

    return 120;
  };

const normalizeQuestion = (
  question,
  index,
  mode
) => {
  const questionType =
    normalizeQuestionType(
      question?.questionType,
      mode
    );

  const options =
    questionType === 'open'
      ? []
      : Array.isArray(
          question?.options
        )
        ? question.options
            .map(option =>
              String(
                option ?? ''
              ).trim()
            )
            .filter(Boolean)
        : [];

  let correctAnswerIndex =
    null;

  if (
    questionType !== 'open'
  ) {
    const candidate = Number(
      question?.correctAnswerIndex
    );

    if (
      Number.isInteger(
        candidate
      ) &&
      candidate >= 0 &&
      candidate < options.length
    ) {
      correctAnswerIndex =
        candidate;
    }
  }

  return {
    id:
      question?.id ||
      `q${index + 1}`,

    text:
      String(
        question?.text ||
          'Please answer the interview question.'
      ).trim(),

    topic:
      String(
        question?.topic ||
          (questionType ===
          'aptitude'
            ? 'Aptitude'
            : questionType ===
                'mcq'
              ? 'Technical MCQ'
              : 'General')
      ).trim(),

    difficulty:
      [
        'easy',
        'medium',
        'hard',
      ].includes(
        question?.difficulty
      )
        ? question.difficulty
        : 'medium',

    questionType,

    options,

    correctAnswerIndex,

    explanation:
      questionType === 'open'
        ? ''
        : String(
            question?.explanation ||
              ''
          ).trim(),

    timeLimit:
      Number.isFinite(
        Number(
          question?.timeLimit
        )
      ) &&
      Number(
        question.timeLimit
      ) > 0
        ? Math.round(
            Number(
              question.timeLimit
            )
          )
        : getDefaultTimeLimit(
            questionType
          ),
  };
};

// ---------------------------------------------------------
// Fallback questions
// ---------------------------------------------------------

const getFallbackOpenQuestions = (
  topic,
  count
) => {
  let questions = [
    {
      id: 'q1',
      text:
        'Explain the difference between an Array and a Linked List.',
      topic: 'DSA',
      difficulty: 'easy',
      questionType: 'open',
      options: [],
      correctAnswerIndex: null,
      explanation: '',
      timeLimit: 120,
    },

    {
      id: 'q2',
      text:
        'What is OOP? Explain its four main principles with examples.',
      topic: 'OOP',
      difficulty: 'easy',
      questionType: 'open',
      options: [],
      correctAnswerIndex: null,
      explanation: '',
      timeLimit: 120,
    },

    {
      id: 'q3',
      text:
        'What is the difference between a stack and a queue?',
      topic: 'DSA',
      difficulty: 'easy',
      questionType: 'open',
      options: [],
      correctAnswerIndex: null,
      explanation: '',
      timeLimit: 120,
    },

    {
      id: 'q4',
      text:
        'Explain the difference between let, const, and var in JavaScript.',
      topic: 'JavaScript',
      difficulty: 'easy',
      questionType: 'open',
      options: [],
      correctAnswerIndex: null,
      explanation: '',
      timeLimit: 120,
    },

    {
      id: 'q5',
      text:
        'What is a REST API and why is it commonly used?',
      topic: 'Web Development',
      difficulty: 'easy',
      questionType: 'open',
      options: [],
      correctAnswerIndex: null,
      explanation: '',
      timeLimit: 120,
    },

    {
      id: 'q6',
      text:
        'Explain the difference between SQL and NoSQL databases.',
      topic: 'Database',
      difficulty: 'medium',
      questionType: 'open',
      options: [],
      correctAnswerIndex: null,
      explanation: '',
      timeLimit: 120,
    },

    {
      id: 'q7',
      text:
        'What is inheritance in object-oriented programming?',
      topic: 'OOP',
      difficulty: 'easy',
      questionType: 'open',
      options: [],
      correctAnswerIndex: null,
      explanation: '',
      timeLimit: 120,
    },

    {
      id: 'q8',
      text:
        'What is binary search and what is its time complexity?',
      topic: 'DSA',
      difficulty: 'medium',
      questionType: 'open',
      options: [],
      correctAnswerIndex: null,
      explanation: '',
      timeLimit: 120,
    },

    {
      id: 'q9',
      text:
        'What is a JavaScript Promise and when would you use one?',
      topic: 'JavaScript',
      difficulty: 'medium',
      questionType: 'open',
      options: [],
      correctAnswerIndex: null,
      explanation: '',
      timeLimit: 120,
    },

    {
      id: 'q10',
      text:
        'Tell me about yourself and your technical background.',
      topic: 'HR',
      difficulty: 'easy',
      questionType: 'open',
      options: [],
      correctAnswerIndex: null,
      explanation: '',
      timeLimit: 120,
    },
  ];

  if (topic) {
    const normalizedTopic =
      String(topic)
        .toLowerCase();

    const matching =
      questions.filter(
        question =>
          question.topic
            .toLowerCase()
            .includes(
              normalizedTopic
            )
      );

    const others =
      questions.filter(
        question =>
          !question.topic
            .toLowerCase()
            .includes(
              normalizedTopic
            )
      );

    questions = [
      ...matching,
      ...others,
    ];
  }

  return questions.slice(
    0,
    count
  );
};

const getFallbackMCQQuestions = count => {
    const questions = [
      {
        id: 'mcq1',
        text:
          'Which data structure follows the FIFO principle?',
        topic: 'Data Structures',
        difficulty: 'easy',
        questionType: 'mcq',
        options: [
          'Stack',
          'Queue',
          'Tree',
          'Graph',
        ],
        correctAnswerIndex: 1,
        explanation:
          'A queue follows First-In-First-Out (FIFO).',
        timeLimit: 45,
      },

      {
        id: 'mcq2',
        text:
          'What is the average time complexity of binary search on a sorted array?',
        topic: 'Algorithms',
        difficulty: 'easy',
        questionType: 'mcq',
        options: [
          'O(n)',
          'O(log n)',
          'O(n²)',
          'O(1)',
        ],
        correctAnswerIndex: 1,
        explanation:
          'Binary search halves the search space at each step, giving O(log n) average time.',
        timeLimit: 45,
      },

      {
        id: 'mcq3',
        text:
          'Which keyword declares a block-scoped constant in JavaScript?',
        topic: 'JavaScript',
        difficulty: 'easy',
        questionType: 'mcq',
        options: [
          'var',
          'let',
          'const',
          'static',
        ],
        correctAnswerIndex: 2,
        explanation:
          'const declares a block-scoped binding that cannot be reassigned.',
        timeLimit: 45,
      },

      {
        id: 'mcq4',
        text:
          'Which HTTP status code normally represents a successful request?',
        topic: 'Web Development',
        difficulty: 'easy',
        questionType: 'mcq',
        options: [
          '404',
          '500',
          '200',
          '301',
        ],
        correctAnswerIndex: 2,
        explanation:
          'HTTP 200 means the request was successfully processed.',
        timeLimit: 45,
      },

      {
        id: 'mcq5',
        text:
          'Which SQL command is used to retrieve data from a table?',
        topic: 'Database',
        difficulty: 'easy',
        questionType: 'mcq',
        options: [
          'INSERT',
          'SELECT',
          'UPDATE',
          'DELETE',
        ],
        correctAnswerIndex: 1,
        explanation:
          'SELECT retrieves data from one or more database tables.',
        timeLimit: 45,
      },

      {
        id: 'mcq6',
        text:
          'Which OOP principle allows an object to hide internal implementation details?',
        topic: 'OOP',
        difficulty: 'medium',
        questionType: 'mcq',
        options: [
          'Inheritance',
          'Encapsulation',
          'Polymorphism',
          'Recursion',
        ],
        correctAnswerIndex: 1,
        explanation:
          'Encapsulation hides internal state and implementation behind a public interface.',
        timeLimit: 45,
      },

      {
        id: 'mcq7',
        text:
          'Which protocol is commonly used for secure HTTP communication?',
        topic: 'Networking',
        difficulty: 'easy',
        questionType: 'mcq',
        options: [
          'FTP',
          'HTTP',
          'HTTPS',
          'SMTP',
        ],
        correctAnswerIndex: 2,
        explanation:
          'HTTPS is HTTP secured using TLS.',
        timeLimit: 45,
      },

      {
        id: 'mcq8',
        text:
          'Which of the following is NOT a JavaScript primitive type?',
        topic: 'JavaScript',
        difficulty: 'medium',
        questionType: 'mcq',
        options: [
          'String',
          'Boolean',
          'Number',
          'Array',
        ],
        correctAnswerIndex: 3,
        explanation:
          'Array is an object type in JavaScript, not a primitive type.',
        timeLimit: 45,
      },
    ];

    return questions.slice(
      0,
      count
    );
  };

const getFallbackAptitudeQuestions = count => {
    const questions = [
      {
        id: 'apt1',
        text:
          'A train travels 120 km in 2 hours. What is its average speed?',
        topic:
          'Quantitative Aptitude',
        difficulty: 'easy',
        questionType: 'aptitude',
        options: [
          '40 km/h',
          '50 km/h',
          '60 km/h',
          '80 km/h',
        ],
        correctAnswerIndex: 2,
        explanation:
          'Average speed = distance / time = 120 / 2 = 60 km/h.',
        timeLimit: 60,
      },

      {
        id: 'apt2',
        text:
          'If 20% of a number is 50, what is the number?',
        topic: 'Percentages',
        difficulty: 'easy',
        questionType: 'aptitude',
        options: [
          '100',
          '150',
          '200',
          '250',
        ],
        correctAnswerIndex: 3,
        explanation:
          '20% of x = 50, so x = 50 / 0.20 = 250.',
        timeLimit: 60,
      },

      {
        id: 'apt3',
        text:
          'A product costs ₹800 and is sold at a 10% discount. What is the selling price?',
        topic: 'Percentages',
        difficulty: 'easy',
        questionType: 'aptitude',
        options: [
          '₹700',
          '₹720',
          '₹760',
          '₹780',
        ],
        correctAnswerIndex: 1,
        explanation:
          '10% of ₹800 is ₹80. Therefore, selling price = ₹800 - ₹80 = ₹720.',
        timeLimit: 60,
      },

      {
        id: 'apt4',
        text:
          'The ratio of boys to girls in a class is 3:2. If there are 30 boys, how many girls are there?',
        topic: 'Ratio',
        difficulty: 'easy',
        questionType: 'aptitude',
        options: [
          '15',
          '20',
          '25',
          '30',
        ],
        correctAnswerIndex: 1,
        explanation:
          '3 parts correspond to 30, so one part is 10. Two parts correspond to 20 girls.',
        timeLimit: 60,
      },

      {
        id: 'apt5',
        text:
          'A number is increased by 25% and becomes 100. What was the original number?',
        topic: 'Percentages',
        difficulty: 'medium',
        questionType: 'aptitude',
        options: [
          '75',
          '80',
          '85',
          '90',
        ],
        correctAnswerIndex: 1,
        explanation:
          'Original × 1.25 = 100, so original = 80.',
        timeLimit: 60,
      },

      {
        id: 'apt6',
        text:
          'If 5 workers complete a task in 12 days, assuming equal productivity, how many days would 10 workers take?',
        topic: 'Time and Work',
        difficulty: 'medium',
        questionType: 'aptitude',
        options: [
          '3 days',
          '5 days',
          '6 days',
          '10 days',
        ],
        correctAnswerIndex: 2,
        explanation:
          'Workers and time are inversely proportional. Doubling workers from 5 to 10 halves the time from 12 to 6 days.',
        timeLimit: 60,
      },

      {
        id: 'apt7',
        text:
          'What is the next number in the sequence: 2, 6, 12, 20, 30, ?',
        topic: 'Logical Reasoning',
        difficulty: 'medium',
        questionType: 'aptitude',
        options: [
          '36',
          '40',
          '42',
          '44',
        ],
        correctAnswerIndex: 2,
        explanation:
          'The differences are 4, 6, 8, 10, so the next difference is 12. Therefore 30 + 12 = 42.',
        timeLimit: 60,
      },

      {
        id: 'apt8',
        text:
          'A shopkeeper buys an item for ₹500 and sells it for ₹600. What is the profit percentage?',
        topic:
          'Profit and Loss',
        difficulty: 'easy',
        questionType: 'aptitude',
        options: [
          '10%',
          '15%',
          '20%',
          '25%',
        ],
        correctAnswerIndex: 2,
        explanation:
          'Profit = ₹600 - ₹500 = ₹100. Profit percentage = 100 / 500 × 100 = 20%.',
        timeLimit: 60,
      },
    ];

    return questions.slice(
      0,
      count
    );
  };

const getFallbackMixedQuestions = count => {
    const openQuestions =
      getFallbackOpenQuestions(
        '',
        10
      );

    const mcqQuestions =
      getFallbackMCQQuestions(
        8
      );

    const aptitudeQuestions =
      getFallbackAptitudeQuestions(
        8
      );

    const combined = [];

    const maxLength =
      Math.max(
        openQuestions.length,
        mcqQuestions.length,
        aptitudeQuestions.length
      );

    for (
      let index = 0;
      index < maxLength;
      index++
    ) {
      if (
        combined.length <
          count &&
        mcqQuestions[index]
      ) {
        combined.push(
          mcqQuestions[index]
        );
      }

      if (
        combined.length <
          count &&
        aptitudeQuestions[index]
      ) {
        combined.push(
          aptitudeQuestions[index]
        );
      }

      if (
        combined.length <
          count &&
        openQuestions[index]
      ) {
        combined.push(
          openQuestions[index]
        );
      }
    }

    return combined.slice(
      0,
      count
    );
  };

const getFallbackQuestions = (
  mode,
  topic,
  count
) => {
  if (mode === 'mcq') {
    return getFallbackMCQQuestions(
      count
    );
  }

  if (
    mode === 'aptitude'
  ) {
    return getFallbackAptitudeQuestions(
      count
    );
  }

  if (mode === 'mixed') {
    return getFallbackMixedQuestions(
      count
    );
  }

  return getFallbackOpenQuestions(
    topic,
    count
  );
};

// ---------------------------------------------------------
// Fallback evaluation
// ---------------------------------------------------------

const getFallbackEvaluation = ({ userAnswer,}) => {
  const answer =
    String(
      userAnswer || ''
    ).trim();

  if (!answer) {
    return {
      score: 0,
      aiAvailable: false,
      fallback: true,

      good:
        'No answer was provided.',

      missing:
        'The question was not answered.',

      idealHint:
        'Try to explain the main concept asked in the question.',

      tip:
        'Give a direct answer first, then support it with an example.',

      sampleAnswer:
        'Start with the definition or main idea, then briefly explain how it works.',
    };
  }

  if (
    answer.length < 30
  ) {
    return {
      score: 35,
      aiAvailable: false,
      fallback: true,

      good:
        'You attempted the question and gave a direct response.',

      missing:
        'The answer is quite short and may not contain enough explanation or supporting details.',

      idealHint:
        'Explain the main concept and include one relevant example.',

      tip:
        'Expand your answer with a definition, explanation, and example.',

      sampleAnswer:
        'Give the main definition, explain the key idea, and finish with a simple example.',
    };
  }

  return {
    score: 60,
    aiAvailable: false,
    fallback: true,

    good:
      'You provided a substantive answer to the question.',

    missing:
      'Detailed AI evaluation is temporarily unavailable, so specific technical gaps could not be identified.',

    idealHint:
      'Make sure your answer directly addresses the question and covers the important technical concepts.',

    tip:
      'Structure your answer clearly: explain the concept, give the reasoning, and add an example where appropriate.',

    sampleAnswer:
      'A strong interview answer should directly address the question, explain the key technical idea, and provide a concise example.',
  };
};

// ---------------------------------------------------------
// Generate questions
// ---------------------------------------------------------

const generateQuestions = async ({
    mode = 'quick',
    company = '',
    topic = '',
    weakAreas = [],
    difficulty = 'mixed',
    count = 10,
  }) => {
    const safeCount =
      Math.max(
        1,
        Math.min(
          Number(count) || 10,
          30
        )
      );

    const normalizedMode =
      [
        'quick',
        'full',
        'company',
        'topic',
        'mcq',
        'aptitude',
        'mixed',
      ].includes(mode)
        ? mode
        : 'quick';

    const prompt = `
You are an expert interviewer and assessment designer.

Generate exactly ${safeCount} questions for an Indian engineering student preparing for placements.

INTERVIEW CONFIGURATION

Mode: ${normalizedMode}
Company: ${company || 'General'}
Topic: ${topic || 'Mixed'}
Difficulty: ${difficulty || 'mixed'}
Weak areas: ${
      weakAreas?.length
        ? weakAreas.join(', ')
        : 'None'
    }

MODE RULES

1. QUICK MODE
- Primarily realistic interview questions.
- Use open-ended questions.
- Include technical, behavioral, or role-related questions.
- questionType must be "open".
2. FULL MODE
- Same as quick but broader topic coverage. 10 questions.
- questionType must be \"open\".

3. COMPANY MODE
- Questions tailored to the specified company's known interview patterns.
- Mix technical and behavioral. questionType must be \"open\".

4. TOPIC MODE
- Deep dive into the specified topic only. All questions on that topic.
- questionType must be \"open\".

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

7score: s.averageScore ?? 0,. MIXED MODE
Combine:
- technical MCQs
- aptitude questions
- open-ended interview questions

QUALITY RULES

- Do not repeat questions.
- Match requested difficulty.
- Prioritize weak areas.
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

    try {
      const result =
        await generateWithRetry({
          model: MODEL,
          contents: prompt,

          config: {
            responseMimeType:
              'application/json',

            responseJsonSchema: {
              type: 'object',

              properties: {
                questions: {
                  type: 'array',

                  items: {
                    type: 'object',

                    properties: {
                      id: {
                        type: 'string',
                      },

                      text: {
                        type: 'string',
                      },

                      topic: {
                        type: 'string',
                      },

                      difficulty: {
                        type: 'string',
                        enum: [
                          'easy',
                          'medium',
                          'hard',
                        ],
                      },

                      questionType: {
                        type: 'string',
                        enum: [
                          'open',
                          'mcq',
                          'aptitude',
                        ],
                      },

                      options: {
                        type: 'array',
                        items: {
                          type: 'string',
                        },
                      },

                      correctAnswerIndex: {
                        type: [
                          'integer',
                          'null',
                        ],
                      },

                      explanation: {
                        type: 'string',
                      },

                      timeLimit: {
                        type: 'integer',
                      },
                    },

                    required: [
                      'id',
                      'text',
                      'topic',
                      'difficulty',
                      'questionType',
                      'options',
                      'correctAnswerIndex',
                      'explanation',
                      'timeLimit',
                    ],
                  },
                },
              },

              required: [
                'questions',
              ],
            },
          },
        });

      const parsed =
        parseJsonResponse(
          result.text
        );

      if (
        !parsed.questions ||
        !Array.isArray(
          parsed.questions
        ) ||
        parsed.questions.length <
          safeCount
      ) {
        throw new Error(
          'Gemini returned fewer questions than requested.'
        );
      }

      const normalized =
        parsed.questions
          .slice(
            0,
            safeCount
          )
          .map(
            (
              question,
              index
            ) =>
              normalizeQuestion(
                question,
                index,
                normalizedMode
              )
          );

      const hasInvalidObjective =
        normalized.some(
          question => {
            if (
              question.questionType ===
              'open'
            ) {
              return false;
            }

            return (
              question.options.length !==
                4 ||
              question.correctAnswerIndex ===
                null
            );
          }
        );

      if (
        hasInvalidObjective
      ) {
        throw new Error(
          'Gemini returned an invalid objective question.'
        );
      }

      return normalized;
    } catch (error) {
      console.error(
        'Gemini generateQuestions error:',
        getErrorMessage(error)
      );

      return getFallbackQuestions(
        normalizedMode,
        topic,
        safeCount
      );
    }
  };

// ---------------------------------------------------------
// Evaluate open answer
// ---------------------------------------------------------

const evaluateOpenAnswer = async ({
    question,
    answer,
    topic,
  }) => {
    const questionText =
      typeof question ===
      'string'
        ? question
        : question?.text || '';

    const userAnswer =
      String(
        answer || ''
      ).trim();

    const questionTopic =
      topic ||
      (typeof question ===
      'string'
        ? 'General'
        : question?.topic) ||
      'General';

   if (!userAnswer) {
  return {
    score: 0,

    feedback:
      'No answer was provided. Try to answer the question directly and explain your reasoning.',

    good: 'No answer was provided.',
    missing: 'The question was not answered.',
    idealHint:
      'Start with the main concept or definition asked by the question.',
    tip:
      'Answer the question directly first, then explain your reasoning.',
    sampleAnswer:
      'Start with the main definition or idea, explain it briefly, and give an example if appropriate.',

    aiAvailable: true,
    fallback: false,
  };
}

    const prompt = `
You are a strict but fair technical placement interviewer.

Question:
${questionText}

Topic:
${questionTopic}

Student Answer:
${userAnswer}

Evaluate based on:

1. Correctness
2. Technical understanding
3. Relevance
4. Clarity
5. Completeness
6. Practical reasoning or examples where appropriate

Give a score from 0 to 100.

IMPORTANT:
- Do not reward length by itself.
- A concise but technically correct answer can score highly.
- Penalize incorrect technical claims.
- Penalize answers that avoid the question.
- For behavioral questions, evaluate relevance, clarity, ownership, reasoning, and outcome.
- Do not require an example when one is unnecessary.
- Be constructive but honest.

Return ONLY JSON.
`;

    try {
      const result =
        await generateWithRetry({
          model: MODEL,
          contents: prompt,

          config: {
            responseMimeType:
              'application/json',

            responseJsonSchema: {
              type: 'object',

              properties: {
                score: {
                  type: 'number',
                },

                good: {
                  type: 'string',
                },

                missing: {
                  type: 'string',
                },

                idealHint: {
                  type: 'string',
                },

                tip: {
                  type: 'string',
                },

                sampleAnswer: {
                  type: 'string',
                },
              },

              required: [
                'score',
                'good',
                'missing',
                'idealHint',
                'tip',
                'sampleAnswer',
              ],
            },
          },
        });

      const parsed =
        parseJsonResponse(
          result.text
        );

      let score =
        Number(parsed.score);

      if (
        !Number.isFinite(score)
      ) {
        throw new Error(
          'Gemini returned an invalid score.'
        );
      }

      score = Math.max(
        0,
        Math.min(
          100,
          Math.round(score)
        )
      );

      const feedback = {
        good:
          String(
            parsed.good || ''
          ).trim(),

        missing:
          String(
            parsed.missing || ''
          ).trim(),

        idealHint:
          String(
            parsed.idealHint ||
              ''
          ).trim(),

        tip:
          String(
            parsed.tip || ''
          ).trim(),

        sampleAnswer:
          String(
            parsed.sampleAnswer ||
              ''
          ).trim(),
      };

      return {
        score,

        feedback:
          JSON.stringify(
            feedback
          ),

        ...feedback,

        aiAvailable: true,
        fallback: false,
      };
    } catch (error) {
      console.error(
        'Gemini evaluateOpenAnswer error:',
        getErrorMessage(error)
      );

      const fallback =
        getFallbackEvaluation({
          userAnswer,
        });

      return {
        ...fallback,

        feedback:
          JSON.stringify({
            good: fallback.good,
            missing:
              fallback.missing,
            idealHint:
              fallback.idealHint,
            tip: fallback.tip,
            sampleAnswer:
              fallback.sampleAnswer,
          }),
      };
    }
  };

// ---------------------------------------------------------
// Evaluate MCQ / aptitude
// ---------------------------------------------------------

const evaluateObjectiveAnswer =
  ({
    question,
    answerIndex,
  }) => {
    const selectedIndex =
      answerIndex === null ||
      answerIndex === undefined ||
      answerIndex === ''
        ? null
        : Number(answerIndex);

    const correctIndex =
      question?.correctAnswerIndex ===
        null ||
      question?.correctAnswerIndex ===
        undefined
        ? null
        : Number(
            question.correctAnswerIndex
          );

    if (
      selectedIndex === null ||
      !Number.isInteger(
        selectedIndex
      )
    ) {
      return {
        score: 0,
        feedback:
          'No option was selected.',
        correct: false,
      };
    }

    if (
      correctIndex === null ||
      !Number.isInteger(
        correctIndex
      )
    ) {
      return {
        score: 0,
        feedback:
          'The correct answer was not available for this question.',
        correct: false,
      };
    }

    const correct =
      selectedIndex ===
      correctIndex;

    if (correct) {
      return {
        score: 100,
        feedback:
          question?.explanation ||
          'Correct answer.',
        correct: true,
      };
    }

    const correctOption =
      question?.options?.[
        correctIndex
      ];

    return {
      score: 0,

      feedback: correctOption
        ? `Incorrect. The correct answer is: ${correctOption}. ${
            question?.explanation ||
            ''
          }`
        : 'Incorrect answer.',

      correct: false,
    };
  };

// ---------------------------------------------------------
// Backward compatibility
// ---------------------------------------------------------
const evaluateAnswer = async ({
    question,
    userAnswer,
    topic,
  }) => {
    const result =
      await evaluateOpenAnswer({
        question,
        answer: userAnswer,
        topic,
      });

    return {
      ...result,

      // Old code can still use score10.
      score10:
        Math.round(
          Number(
            result.score || 0
          ) / 10
        ),
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
  }) => {
    const prompt = `
You are MockMate's AI placement coach for
an Indian engineering student preparing for
campus placements.

Student profile:
- College: ${
      profile.college || 'Not provided'
    }
- Branch: ${
      profile.branch || 'Not provided'
    }
- Semester: ${
      profile.semester || 'Not provided'
    }
- Interviews completed: ${totalSessions}
- Average score: ${averageScore}/100
- Best score: ${bestScore}/100
- Current streak: ${streak} days
- Strongest topic: ${strongest}
- Weakest topics: ${
      weakest.length
        ? weakest.join(', ')
        : 'Not enough data'
    }

Topic performance:
${JSON.stringify(topicPerformance)}

Give a concise but highly personalised
placement-preparation analysis.

Return ONLY JSON with:

{
  "verdict": "...",
  "criticalGaps": "...",
  "strengths": "...",
  "battlePlan": "...",
  "mindset": "..."
}

Be specific.
Reference the student's actual performance.
Do not invent achievements or scores.
`;

    const result =
      await generateWithRetry({
        model: MODEL,
        contents: prompt,

        config: {
          responseMimeType:
            'application/json',

          responseJsonSchema: {
            type: 'object',

            properties: {
              verdict: {
                type: 'string',
              },

              criticalGaps: {
                type: 'string',
              },

              strengths: {
                type: 'string',
              },

              battlePlan: {
                type: 'string',
              },

              mindset: {
                type: 'string',
              },
            },

            required: [
              'verdict',
              'criticalGaps',
              'strengths',
              'battlePlan',
              'mindset',
            ],
          },
        },
      });

    return parseJsonResponse(
      result.text
    );
  };

// ---------------------------------------------------------
// Exports
// ---------------------------------------------------------

module.exports = {
  generateQuestions,
  evaluateOpenAnswer,
  evaluateObjectiveAnswer,
  evaluateAnswer,
  getFallbackQuestions,
  getFallbackEvaluation,
  generateCoachAdvice,
};