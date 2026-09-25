const {
  shrinkToward,
  maturityMultiplier,
  buildDimensionProfile,
  computeIRSBreakdown,
} = require('../utils/scoringModel');

// ─────────────────────────────────────────────────────────────────────────
// shrinkToward — the Bayesian shrinkage helper
// ─────────────────────────────────────────────────────────────────────────
describe('shrinkToward', () => {
  test('n=0 returns exactly the prior (no evidence = no trust)', () => {
    expect(shrinkToward(95, 0)).toBe(50);
  });

  test('at n=K (default 6), score is blended exactly 50/50 with the prior', () => {
    const result = shrinkToward(90, 6);
    expect(result).toBeCloseTo(50 + 0.5 * (90 - 50), 5);
  });

  test('large n approaches the raw score (trusts real data almost fully)', () => {
    const result = shrinkToward(90, 1000);
    expect(result).toBeGreaterThan(89);
  });

  test('a single answered question barely moves the score off the prior', () => {
    const result = shrinkToward(100, 1);
    expect(result).toBeCloseTo(57.14, 1);
    expect(result).toBeLessThan(60);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// maturityMultiplier — the account-wide trust gate
// ─────────────────────────────────────────────────────────────────────────
describe('maturityMultiplier', () => {
  test('zero answered questions returns the floor (0.35), not zero', () => {
    expect(maturityMultiplier(0)).toBeCloseTo(0.35, 5);
  });

  test('at n=K (40), multiplier is halfway between floor and 1.0', () => {
    expect(maturityMultiplier(40)).toBeCloseTo(0.675, 3);
  });

  test('very high question count approaches full trust (1.0)', () => {
    expect(maturityMultiplier(10000)).toBeGreaterThan(0.99);
  });

  test('multiplier is monotonically increasing with more evidence', () => {
    const low  = maturityMultiplier(5);
    const mid  = maturityMultiplier(40);
    const high = maturityMultiplier(200);
    expect(low).toBeLessThan(mid);
    expect(mid).toBeLessThan(high);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// computeIRSBreakdown — the full formula, exercised at 3 concrete scenarios
// ─────────────────────────────────────────────────────────────────────────
describe('computeIRSBreakdown — realistic scenarios', () => {
  test('SCENARIO A: brand-new user, 1 session, all 90s — should NOT show a high IRS', () => {
    const { profile: dimensionProfile } = buildDimensionProfile([
      { topic: 'DSA', averageScore: 90, attempts: 5 },
    ]);

    const result = computeIRSBreakdown({
      dimensionProfile,
      scoreTrend: [{ score: 90, date: new Date() }],
      topicPerformance: [{ topic: 'DSA', averageScore: 90, attempts: 5 }],
      averageScore: 90,
      totalAnsweredQuestions: 5,
    });

    expect(result.maturity).toBeLessThan(0.45);
    expect(result.finalScore).toBeLessThan(45);
    console.log('Scenario A (new user, 5 Qs @ 90):', result.finalScore, 'maturity:', result.maturity);
  });

  test('SCENARIO B: moderate user, ~10 sessions worth of evidence, consistent 75s', () => {
    const { profile: dimensionProfile } = buildDimensionProfile([
      { topic: 'DSA',           averageScore: 75, attempts: 20 },
      { topic: 'System Design', averageScore: 75, attempts: 15 },
      { topic: 'OOP',           averageScore: 75, attempts: 10 },
    ]);

    const scoreTrend = Array.from({ length: 10 }, (_, i) => ({
      score: 75 + (i % 2 === 0 ? 2 : -2),
      date: new Date(),
    }));

    const result = computeIRSBreakdown({
      dimensionProfile,
      scoreTrend,
      topicPerformance: [
        { topic: 'DSA',           averageScore: 75, attempts: 20 },
        { topic: 'System Design', averageScore: 75, attempts: 15 },
        { topic: 'OOP',           averageScore: 75, attempts: 10 },
      ],
      averageScore: 75,
      totalAnsweredQuestions: 45,
    });

    expect(result.maturity).toBeGreaterThan(0.6);
    expect(result.maturity).toBeLessThan(0.85);
    expect(result.finalScore).toBeGreaterThan(40);
    expect(result.finalScore).toBeLessThan(75);
    console.log('Scenario B (moderate user, 45 Qs @ ~75):', result.finalScore, 'maturity:', result.maturity);
  });

  test('SCENARIO C: veteran user, heavy evidence, strong scores across ALL dimensions', () => {
    const { profile: dimensionProfile } = buildDimensionProfile([
      { topic: 'DSA',           averageScore: 85, attempts: 80 },
      { topic: 'System Design', averageScore: 85, attempts: 60 },
      { topic: 'OOP',           averageScore: 85, attempts: 40 },
      { topic: 'DBMS',          averageScore: 85, attempts: 40 },
      { topic: 'HR',            averageScore: 85, attempts: 30 },
      { topic: 'Behavioral',    averageScore: 85, attempts: 20 },
    ]);

    const scoreTrend = Array.from({ length: 20 }, () => ({
      score: 85,
      date: new Date(),
    }));

    const result = computeIRSBreakdown({
      dimensionProfile,
      scoreTrend,
      topicPerformance: [
        { topic: 'DSA',           averageScore: 85, attempts: 80 },
        { topic: 'System Design', averageScore: 85, attempts: 60 },
        { topic: 'OOP',           averageScore: 85, attempts: 40 },
        { topic: 'DBMS',          averageScore: 85, attempts: 40 },
        { topic: 'HR',            averageScore: 85, attempts: 30 },
        { topic: 'Behavioral',    averageScore: 85, attempts: 20 },
      ],
      averageScore: 85,
      totalAnsweredQuestions: 270,
    });

    expect(result.maturity).toBeGreaterThanOrEqual(0.9);
    expect(result.finalScore).toBeGreaterThan(75);
    expect(result.finalScore).toBeLessThanOrEqual(result.rawComposite + 0.01);
    console.log('Scenario C (veteran, ALL dimensions, 270 Qs @ 85):', result.finalScore, 'maturity:', result.maturity);
  });

  test('SCENARIO C2: same evidence volume but ONLY technical topics — shows breadth gating', () => {
    const { profile: dimensionProfile } = buildDimensionProfile([
      { topic: 'DSA',           averageScore: 85, attempts: 80 },
      { topic: 'System Design', averageScore: 85, attempts: 60 },
      { topic: 'OOP',           averageScore: 85, attempts: 40 },
      { topic: 'DBMS',          averageScore: 85, attempts: 40 },
    ]);

    const scoreTrend = Array.from({ length: 20 }, () => ({ score: 85, date: new Date() }));

    const result = computeIRSBreakdown({
      dimensionProfile,
      scoreTrend,
      topicPerformance: [
        { topic: 'DSA',           averageScore: 85, attempts: 80 },
        { topic: 'System Design', averageScore: 85, attempts: 60 },
        { topic: 'OOP',           averageScore: 85, attempts: 40 },
        { topic: 'DBMS',          averageScore: 85, attempts: 40 },
      ],
      averageScore: 85,
      totalAnsweredQuestions: 220,
    });

    expect(result.maturity).toBeGreaterThanOrEqual(0.9);
    expect(result.finalScore).toBeLessThan(70);
    console.log('Scenario C2 (technical-only, no HR/behavioral, 220 Qs @ 85):', result.finalScore, 'maturity:', result.maturity);
  });

  test('component contributions always sum to the raw composite (weights sum to 1.0)', () => {
    const { profile: dimensionProfile } = buildDimensionProfile([
      { topic: 'DSA', averageScore: 70, attempts: 10 },
    ]);
    const result = computeIRSBreakdown({
      dimensionProfile,
      scoreTrend: [{ score: 70, date: new Date() }],
      topicPerformance: [{ topic: 'DSA', averageScore: 70, attempts: 10 }],
      averageScore: 70,
      totalAnsweredQuestions: 10,
    });

    const sumOfContributions = Object.values(result.components)
      .reduce((sum, c) => sum + c.contribution, 0);

    expect(sumOfContributions).toBeCloseTo(result.rawComposite, 1);
  });

  test('finalScore is always within [0, 100] regardless of inputs', () => {
    const { profile: dimensionProfile } = buildDimensionProfile([
      { topic: 'DSA', averageScore: 100, attempts: 500 },
    ]);
    const result = computeIRSBreakdown({
      dimensionProfile,
      scoreTrend: Array.from({ length: 50 }, () => ({ score: 100, date: new Date() })),
      topicPerformance: [{ topic: 'DSA', averageScore: 100, attempts: 500 }],
      averageScore: 100,
      totalAnsweredQuestions: 500,
    });
    expect(result.finalScore).toBeGreaterThanOrEqual(0);
    expect(result.finalScore).toBeLessThanOrEqual(100);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// buildDimensionProfile — topic normalization + shrinkage integration
// ─────────────────────────────────────────────────────────────────────────
describe('buildDimensionProfile', () => {
  test('unmapped topics are tracked separately, not silently dropped', () => {
    const { profile, unmapped } = buildDimensionProfile([
      { topic: 'Underwater Basket Weaving', averageScore: 80, attempts: 3 },
    ]);
    expect(unmapped.length).toBe(1);
    expect(unmapped[0].topic).toBe('Underwater Basket Weaving');
    profile.forEach((dim) => {
      expect(dim.hasData).toBe(false);
    });
  });

  test('topic string variants (DSA vs "Data Structures & Algorithms") resolve to the same dimension', () => {
    const { profile: profileA } = buildDimensionProfile([
      { topic: 'DSA', averageScore: 80, attempts: 10 },
    ]);
    const { profile: profileB } = buildDimensionProfile([
      { topic: 'Data Structures & Algorithms', averageScore: 80, attempts: 10 },
    ]);

    const technicalA = profileA.find((d) => d.key === 'technical');
    const technicalB = profileB.find((d) => d.key === 'technical');

    expect(technicalA.score).toBeCloseTo(technicalB.score, 5);
  });
});