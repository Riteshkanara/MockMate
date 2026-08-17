import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

import API_BASE from '../config/api.js';

// ═══════════════════════════════════════════════════════════════════════════
// MOCKMATE — ONBOARDING v2
// Same blueprint-blue system as Dashboard.jsx (readiness console). Onboarding
// is reframed as the FIRST readiness reading, not a form — every choice here
// feeds directly into the IRS model the user will see on day one.
// ═══════════════════════════════════════════════════════════════════════════

// ─── Design tokens — identical to Dashboard.jsx for visual continuity ───────
const C = {
  bg:       '#F0F4FF',
  bgDeep:   '#E8EEFF',

  card:     '#FFFFFF',
  cardAlt:  '#F8FAFF',

  text:     '#0A1628',
  sub:      '#3D5280',
  muted:    '#7A8BAF',
  faint:    '#A8B8D4',

  border:   '#DDE5F7',
  borderMd: '#B8CAF0',
  borderStr:'#7FA3E8',

  blue50:   '#EBF2FF',
  blue100:  '#C7DAFF',
  blue200:  '#9DBFFF',
  blue400:  '#4D8FFF',
  blue500:  '#1A6EFF',
  blue600:  '#0057E8',
  blue700:  '#0044C4',
  blue900:  '#001F6B',

  cyan400:  '#00C8F0',
  cyan500:  '#00ADE0',
  cyan600:  '#0093C4',
  cyanTint: '#E6F9FF',

  green:    '#059669',
  greenTint:'#ECFDF5',
  greenGlow:'rgba(5,150,105,0.18)',

  amber:    '#D97706',
  amberTint:'#FFFBEB',
  orange:   '#EA580C',

  red:      '#DC2626',
  redTint:  '#FEF2F2',

  shadow:   '0 1px 12px rgba(26,110,255,0.07)',
  shadowMd: '0 6px 28px rgba(26,110,255,0.12)',
  shadowLg: '0 16px 56px rgba(0,31,107,0.18)',
};

const F = {
  display: "'Plus Jakarta Sans', 'Lexend', sans-serif",
  body:    "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  mono:    "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
};

// ─── Static option data ──────────────────────────────────────────────────────
const COMPANIES = ['TCS', 'Infosys', 'Wipro', 'Zoho', 'Razorpay', 'FAANG'];

const BRANCHES = [
  { value: 'CSE', label: 'Computer Science' },
  { value: 'IT', label: 'Information Technology' },
  { value: 'ECE', label: 'Electronics & Communication' },
  { value: 'CE', label: 'Civil Engineering' },
  { value: 'ME', label: 'Mechanical Engineering' },
  { value: 'EEE', label: 'Electrical Engineering' },
];

// Six dimensions — same keys, labels and weights as Dashboard's DIMENSIONS,
// so the self-rating step maps 1:1 onto the real IRS model the user sees later.
const DIMENSIONS = [
  { key: 'technical',      label: 'Technical Depth',   icon: '⚙', weight: 0.28, tip: 'DSA, OOP, DBMS, OS, JS' },
  { key: 'problemSolving', label: 'Problem Solving',   icon: '🔍', weight: 0.22, tip: 'Breaking down unknowns' },
  { key: 'communication',  label: 'Communication',     icon: '💬', weight: 0.18, tip: 'Clarity under questioning' },
  { key: 'behavioral',     label: 'Behavioral',        icon: '🤝', weight: 0.12, tip: 'HR & situational rounds' },
  { key: 'design',         label: 'System Design',     icon: '🏗', weight: 0.10, tip: 'Matters at ₹12 LPA+' },
  { key: 'fundamentals',   label: 'CS Fundamentals',   icon: '📚', weight: 0.10, tip: 'DBMS, OS, Networking' },
];

const TARGET_ROLES = [
  { value: 'software',   label: 'Software Engineer',     icon: '⌘' },
  { value: 'frontend',   label: 'Frontend Developer',    icon: '◫' },
  { value: 'backend',    label: 'Backend Developer',     icon: '⚙' },
  { value: 'fullstack',  label: 'Full Stack Developer',  icon: '◆' },
  { value: 'data',       label: 'Data / Analytics',      icon: '◈' },
  { value: 'general',    label: 'Placement Generalist',  icon: '✦' },
];

const GOALS = [
  { value: 'campus',     label: 'Campus placement', icon: '🎓' },
  { value: 'offcampus',  label: 'Off-campus job',    icon: '🚀' },
  { value: 'internship', label: 'Internship',        icon: '💼' },
  { value: 'practice',   label: 'Practice + confidence', icon: '🔥' },
];

const ANSWER_STYLES = [
  { value: 'explain', label: 'Explain-first', desc: 'Talk through reasoning, then code' },
  { value: 'code',    label: 'Code-first',    desc: 'Jump into implementation, explain after' },
];

// Days/week → session target, kept as a small integer scale (not an abstract
// 1–10 slider) so it reads as a real commitment, not a number to fiddle with.
const CADENCE = [
  { value: 2, label: '2 days', sub: 'Light' },
  { value: 4, label: '4 days', sub: 'Steady' },
  { value: 6, label: '6 days', sub: 'Intense' },
];

// ─── Package tier bands — identical thresholds to Dashboard's TIERS ─────────
const TIERS = [
  { label: '₹3–6 LPA',  minScore: 0,  color: C.muted,   desc: 'Service companies, off-campus starts' },
  { label: '₹6–12 LPA', minScore: 38, color: C.amber,   desc: 'Mid-tier product, IT MNCs, campus drives' },
  { label: '₹12–20 LPA',minScore: 60, color: C.blue500, desc: 'Top product companies, FAANG-adjacent' },
  { label: '₹20 LPA+',  minScore: 80, color: C.cyan500, desc: 'FAANG, unicorn startups, remote-first' },
];

const tierForScore = (score) => {
  const reached = TIERS.filter(t => score >= t.minScore);
  return reached[reached.length - 1] || TIERS[0];
};

const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(v || 0)));

// ─── Initial state — every field pre-filled with a sane default so nothing
// blocks forward motion; the user only edits what they want to change. ──────
const INITIAL_PROFILE = {
  college: '',
  branch: '',
  semester: '',
  targetCompanies: [],
  weakAreas: [],
};

const INITIAL_PREFERENCES = {
  targetRole: 'software',
  primaryGoal: 'campus',
  answerStyle: 'explain',
  weeklyDays: 4,
};

const INITIAL_SELF_RATING = DIMENSIONS.reduce((acc, d) => {
  acc[d.key] = 45; // realistic starting-out default, not 0 and not inflated
  return acc;
}, {});

const STEPS = [
  { key: 'basics',   label: 'Your context' },
  { key: 'skills',   label: 'Self-rating' },
  { key: 'training', label: 'Preparation style' },
];

const Onboarding = () => {
  const [stepIndex, setStepIndex] = useState(0);
  const [profile, setProfile] = useState(INITIAL_PROFILE);
  const [preferences, setPreferences] = useState(INITIAL_PREFERENCES);
  const [selfRating, setSelfRating] = useState(INITIAL_SELF_RATING);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setTimeout(() => setMounted(true), 40));
  }, []);

  const toggleArrayValue = useCallback((key, value) => {
    setProfile(previous => {
      const current = previous[key] || [];
      const next = current.includes(value)
        ? current.filter(item => item !== value)
        : [...current, value];
      return { ...previous, [key]: next };
    });
  }, []);

  const requiredComplete = Boolean(
    profile.college.trim() &&
    profile.branch &&
    Number(profile.semester) >= 1 &&
    Number(profile.semester) <= 8
  );

  // ── Live projected IRS — the signature element. Computed the same way
  // Dashboard computes it post-session, just seeded from self-ratings instead
  // of real attempts, so onboarding previews the exact system it feeds. ─────
  const projectedIRS = useMemo(() => {
    const dimScore = DIMENSIONS.reduce((acc, d) => acc + (selfRating[d.key] * d.weight), 0);
    // No trend/consistency data exists yet — those components start neutral
    // at 60% of a first-session assumption, breadth from topics picked.
    const breadthComponent = Math.min(profile.weakAreas.length / 8, 1) * 100 * 0.15;
    const dimComponent = clamp(dimScore) * 0.40;
    const neutralTrend = clamp(dimScore) * 0.25 * 0.85; // slightly conservative
    const neutralConsistency = 55 * 0.20; // unproven consistency, mid value
    return clamp(dimComponent + neutralTrend + breadthComponent + neutralConsistency);
  }, [selfRating, profile.weakAreas]);

  const currentTier = useMemo(() => tierForScore(projectedIRS), [projectedIRS]);

  const completion = useMemo(() => {
    const checks = [
      Boolean(profile.college.trim()),
      Boolean(profile.branch),
      Boolean(profile.semester),
      profile.targetCompanies.length > 0,
      profile.weakAreas.length > 0,
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [profile]);

  const goNext = () => {
    if (stepIndex === 0 && !requiredComplete) {
      toast.error('Add your college, branch and semester to continue.');
      return;
    }
    setStepIndex(i => Math.min(STEPS.length - 1, i + 1));
  };

  const goBack = () => setStepIndex(i => Math.max(0, i - 1));

  const jumpTo = (index) => {
    if (index === 0 || requiredComplete) {
      setStepIndex(index);
    } else {
      toast.error('Complete your basic details first.');
    }
  };

  const handleComplete = async () => {
    if (!requiredComplete) {
      setStepIndex(0);
      return;
    }

    setLoading(true);
    const toastId = toast.loading('Building your preparation profile...');

    try {
      const token = localStorage.getItem('token');

      await axios.post(
        `${API_BASE}/auth/onboarding`,
        profile,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      localStorage.setItem(
        'mockmate_preferences',
        JSON.stringify({ ...preferences, selfRating })
      );

      toast.dismiss(toastId);
      toast.success('Your MockMate profile is ready.');

      window.location.href = '/interview';
    } catch (error) {
      console.error('Onboarding failed:', error);
      toast.dismiss(toastId);
      toast.error(
        error?.response?.data?.message || 'Unable to save your onboarding profile.'
      );
    } finally {
      setLoading(false);
    }
  };

  const activeStep = STEPS[stepIndex].key;
  const isLastStep = stepIndex === STEPS.length - 1;

  return (
    <div style={S.page} className="ob-page">
      <div style={{ ...S.container, opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(10px)' }}>

        {/* ── STATUS STRIP — matches Dashboard exactly ─────────────────── */}
        <div style={S.strip} className="ob-strip">
          <div style={S.stripL}>
            <span style={S.liveDot} />
            <span style={S.mono}>MOCKMATE READINESS CONSOLE</span>
          </div>
          <div style={S.stripR} className="ob-strip-r">
            <span style={S.mono}>ONBOARDING</span>
            <span style={{ color: C.borderMd }}>·</span>
            <span style={S.mono}>{completion}% PROFILE READY</span>
          </div>
        </div>

        {/* ── HERO — live IRS projection instead of a static welcome ─────── */}
        <section style={S.hero} className="ob-hero">
          <div style={S.heroScan} />
          <div style={S.heroGrid} className="ob-hero-grid">

            <div style={S.irsBlock}>
              <div style={S.irsLabel}>PROJECTED READINESS SCORE</div>
              <div style={S.irsNum}>
                {projectedIRS}
                <span style={S.irsMax}>/100</span>
              </div>
              <div style={{ ...S.tierPill, background: `${currentTier.color}22`, color: currentTier.color, border: `1px solid ${currentTier.color}55` }}>
                {currentTier.label} band
              </div>
              <div style={S.irsBar}>
                <div style={{ ...S.irsBarFill, width: mounted ? `${projectedIRS}%` : '0%' }} />
              </div>
              <div style={S.irsGapText}>
                Based on self-ratings — <span style={{ color: C.cyan400, fontWeight: 700 }}>your first session will replace this</span> with real data.
              </div>
            </div>

            <div style={S.verdictBlock}>
              <div style={S.eyebrow}>
                <span style={S.eyebrowDot} />
                STEP {stepIndex + 1} OF {STEPS.length}
              </div>
              <h1 style={S.heroH1}>
                {activeStep === 'basics' && "Let's set your baseline."}
                {activeStep === 'skills' && 'Rate yourself, honestly.'}
                {activeStep === 'training' && 'How do you want to train?'}
              </h1>
              <p style={S.heroSub}>
                {activeStep === 'basics' && 'Your college, branch and semester anchor everything MockMate recommends. Takes about 20 seconds.'}
                {activeStep === 'skills' && 'These sliders seed your Interview Readiness Score. Nothing here is graded — it just tells MockMate where to start.'}
                {activeStep === 'training' && 'Pick a role, a goal and a pace. You can change all of this later from settings.'}
              </p>
            </div>
          </div>
        </section>

        {/* ── STEP NAV ──────────────────────────────────────────────────── */}
        <div style={S.stepNav} className="ob-step-nav">
          {STEPS.map((s, i) => (
            <button
              key={s.key}
              type="button"
              onClick={() => jumpTo(i)}
              style={{
                ...S.stepPill,
                ...(i === stepIndex ? S.stepPillActive : {}),
                ...(i < stepIndex ? S.stepPillDone : {}),
              }}
            >
              <span style={S.stepPillNum}>
                {i < stepIndex ? '✓' : i + 1}
              </span>
              {s.label}
            </button>
          ))}
        </div>

        {/* ── STEP BODY ─────────────────────────────────────────────────── */}
        <section style={S.card} className="ob-card">
          {activeStep === 'basics' && (
            <BasicsStep
              profile={profile}
              setProfile={setProfile}
              toggleArrayValue={toggleArrayValue}
            />
          )}

          {activeStep === 'skills' && (
            <SkillsStep
              selfRating={selfRating}
              setSelfRating={setSelfRating}
              mounted={mounted}
            />
          )}

          {activeStep === 'training' && (
            <TrainingStep
              preferences={preferences}
              setPreferences={setPreferences}
            />
          )}
        </section>

        {/* ── NAV FOOTER ────────────────────────────────────────────────── */}
        <div style={S.navFooter} className="ob-nav-footer">
          <button
            type="button"
            style={{ ...S.btnGhostDark, visibility: stepIndex === 0 ? 'hidden' : 'visible' }}
            onClick={goBack}
            disabled={loading}
          >
            ← Back
          </button>

          <div style={S.navFooterRight}>
            <span style={S.navHint}>
              {activeStep === 'basics' && 'Required: college, branch, semester'}
              {activeStep === 'skills' && 'Optional — defaults are fine to start'}
              {activeStep === 'training' && 'You can adjust this anytime'}
            </span>

            {!isLastStep ? (
              <button type="button" style={S.btnPrimaryBlue} onClick={goNext}>
                Continue →
              </button>
            ) : (
              <button
                type="button"
                style={S.btnPrimaryBlue}
                onClick={handleComplete}
                disabled={loading}
              >
                {loading ? 'Creating profile…' : 'Enter MockMate →'}
              </button>
            )}
          </div>
        </div>

        <footer style={S.footerRow}>
          <span style={S.mono}>MOCKMATE ONBOARDING v2.0</span>
          <span style={S.mono}>PROJECTED IRS SEEDS THE SAME MODEL AS YOUR DASHBOARD</span>
        </footer>
      </div>
      <GlobalStyles />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// STEP 1 — BASICS
// ═══════════════════════════════════════════════════════════════════════════
const BasicsStep = ({ profile, setProfile, toggleArrayValue }) => (
  <>
    <div style={S.stepHeader}>
      <div style={S.eyebrowDark}>PROFILE BASICS</div>
      <h2 style={S.cardH2}>Start with your real context.</h2>
      <p style={S.cardSub}>This becomes the foundation MockMate uses for every recommendation.</p>
    </div>

    <div style={S.formGrid} className="ob-form-grid">
      <Field label="College / University" full>
        <input
          type="text"
          value={profile.college}
          placeholder="e.g. Gandhinagar University"
          style={S.input}
          onChange={e => setProfile(p => ({ ...p, college: e.target.value }))}
        />
      </Field>

      <Field label="Branch">
        <select
          value={profile.branch}
          style={S.select}
          onChange={e => setProfile(p => ({ ...p, branch: e.target.value }))}
        >
          <option value="">Choose your branch</option>
          {BRANCHES.map(b => (
            <option key={b.value} value={b.value}>{b.label}</option>
          ))}
        </select>
      </Field>

      <Field label="Semester">
        <input
          type="number"
          min="1"
          max="8"
          value={profile.semester}
          placeholder="1 – 8"
          style={S.input}
          onChange={e => setProfile(p => ({ ...p, semester: e.target.value }))}
        />
      </Field>
    </div>

    <div style={S.groupBlock}>
      <div style={S.groupHead}>
        <strong style={S.groupTitle}>Companies on your radar</strong>
        <span style={S.groupTag}>OPTIONAL · TAP ANY</span>
      </div>
      <div style={S.chipGrid}>
        {COMPANIES.map(company => {
          const active = profile.targetCompanies.includes(company);
          return (
            <button
              key={company}
              type="button"
              style={{ ...S.chip, ...(active ? S.chipActive : {}) }}
              onClick={() => toggleArrayValue('targetCompanies', company)}
            >
              {company}
            </button>
          );
        })}
      </div>
    </div>

    <div style={S.groupBlock}>
      <div style={S.groupHead}>
        <strong style={S.groupTitle}>Where do you want more reps?</strong>
        <span style={S.groupTag}>OPTIONAL · TAP ANY</span>
      </div>
      <div style={S.chipGrid}>
        {DIMENSIONS.map(d => {
          const active = profile.weakAreas.includes(d.label);
          return (
            <button
              key={d.key}
              type="button"
              style={{ ...S.chip, ...(active ? S.chipActive : {}) }}
              onClick={() => toggleArrayValue('weakAreas', d.label)}
            >
              <span style={{ marginRight: 6 }}>{d.icon}</span>
              {d.label}
            </button>
          );
        })}
      </div>
    </div>
  </>
);

const Field = ({ label, full, children }) => (
  <div style={{ ...S.field, ...(full ? S.fieldFull : {}) }}>
    <label style={S.fieldLabel}>{label}</label>
    {children}
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════
// STEP 2 — SELF-RATING (dimension sliders that feed the real IRS model)
// ═══════════════════════════════════════════════════════════════════════════
const SkillsStep = ({ selfRating, setSelfRating, mounted }) => {
  const setDim = (key, value) => setSelfRating(prev => ({ ...prev, [key]: value }));

  return (
    <>
      <div style={S.stepHeader}>
        <div style={S.eyebrowDark}>SIX-DIMENSION BASELINE</div>
        <h2 style={S.cardH2}>Where do you stand today?</h2>
        <p style={S.cardSub}>
          Same six dimensions your Dashboard tracks after every session. Move each slider to
          roughly where you'd honestly place yourself — the readiness score above updates live.
        </p>
      </div>

      <div style={S.dimSliderList}>
        {DIMENSIONS.map(d => {
          const value = selfRating[d.key];
          const col = value >= 70 ? C.green : value >= 45 ? C.blue500 : C.amber;
          return (
            <div key={d.key} style={S.dimSliderRow}>
              <div style={S.dimSliderMeta}>
                <div style={S.dimSliderLeft}>
                  <span style={S.dimIcon}>{d.icon}</span>
                  <div>
                    <span style={S.dimName}>{d.label}</span>
                    <span style={S.dimWeight}>{d.tip} · {Math.round(d.weight * 100)}% weight</span>
                  </div>
                </div>
                <span style={{ ...S.dimScore, color: col }}>{value}</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={value}
                onChange={e => setDim(d.key, Number(e.target.value))}
                style={{ ...S.rangeInput, accentColor: col }}
              />
              <div style={S.dimTrackBg}>
                <div style={{
                  ...S.dimTrackFill,
                  width: mounted ? `${value}%` : '0%',
                  background: col,
                }} />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// STEP 3 — TRAINING PREFERENCES
// ═══════════════════════════════════════════════════════════════════════════
const TrainingStep = ({ preferences, setPreferences }) => (
  <>
    <div style={S.stepHeader}>
      <div style={S.eyebrowDark}>PREPARATION PROFILE</div>
      <h2 style={S.cardH2}>Tell MockMate how you want to train.</h2>
      <p style={S.cardSub}>Every default here is already a reasonable choice — change only what matters to you.</p>
    </div>

    <div style={S.groupBlock}>
      <div style={S.groupHead}>
        <strong style={S.groupTitle}>Target role</strong>
        <span style={S.groupTag}>ONE</span>
      </div>
      <div style={S.roleGrid} className="ob-role-grid">
        {TARGET_ROLES.map(role => {
          const active = preferences.targetRole === role.value;
          return (
            <button
              key={role.value}
              type="button"
              style={{ ...S.roleCard, ...(active ? S.roleCardActive : {}) }}
              onClick={() => setPreferences(p => ({ ...p, targetRole: role.value }))}
            >
              <div style={{ ...S.roleIcon, ...(active ? S.roleIconActive : {}) }}>{role.icon}</div>
              <strong style={S.roleLabel}>{role.label}</strong>
            </button>
          );
        })}
      </div>
    </div>

    <div style={S.groupBlock}>
      <div style={S.groupHead}>
        <strong style={S.groupTitle}>Main objective</strong>
        <span style={S.groupTag}>ONE</span>
      </div>
      <div style={S.goalGrid} className="ob-goal-grid">
        {GOALS.map(goal => {
          const active = preferences.primaryGoal === goal.value;
          return (
            <button
              key={goal.value}
              type="button"
              style={{ ...S.goalCard, ...(active ? S.goalCardActive : {}) }}
              onClick={() => setPreferences(p => ({ ...p, primaryGoal: goal.value }))}
            >
              <div style={S.goalIcon}>{goal.icon}</div>
              <strong style={S.goalLabel}>{goal.label}</strong>
            </button>
          );
        })}
      </div>
    </div>

    <div style={S.groupBlock}>
      <div style={S.groupHead}>
        <strong style={S.groupTitle}>How you answer best</strong>
        <span style={S.groupTag}>ONE</span>
      </div>
      <div style={S.answerStyleGrid}>
        {ANSWER_STYLES.map(opt => {
          const active = preferences.answerStyle === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              style={{ ...S.answerStyleCard, ...(active ? S.answerStyleCardActive : {}) }}
              onClick={() => setPreferences(p => ({ ...p, answerStyle: opt.value }))}
            >
              <strong style={S.roleLabel}>{opt.label}</strong>
              <span style={S.answerStyleDesc}>{opt.desc}</span>
            </button>
          );
        })}
      </div>
    </div>

    <div style={S.groupBlock}>
      <div style={S.groupHead}>
        <strong style={S.groupTitle}>Practice cadence</strong>
        <span style={S.groupTag}>ONE</span>
      </div>
      <div style={S.cadenceGrid}>
        {CADENCE.map(c => {
          const active = preferences.weeklyDays === c.value;
          return (
            <button
              key={c.value}
              type="button"
              style={{ ...S.cadenceCard, ...(active ? S.cadenceCardActive : {}) }}
              onClick={() => setPreferences(p => ({ ...p, weeklyDays: c.value }))}
            >
              <strong style={S.cadenceLabel}>{c.label}</strong>
              <span style={S.cadenceSub}>{c.sub} pace</span>
            </button>
          );
        })}
      </div>
    </div>

    <div style={S.summaryBox}>
      <div style={S.summaryIcon}>✦</div>
      <div style={{ flex: 1 }}>
        <strong style={S.summaryTitle}>Ready when you are</strong>
        <span style={S.summarySub}>
          {TARGET_ROLES.find(r => r.value === preferences.targetRole)?.label} ·{' '}
          {GOALS.find(g => g.value === preferences.primaryGoal)?.label} ·{' '}
          {preferences.weeklyDays} days/week
        </span>
      </div>
    </div>
  </>
);

// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL STYLES — fonts + responsive overrides
// ═══════════════════════════════════════════════════════════════════════════
const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800;900&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');

    @keyframes obSpin      { to { transform: rotate(360deg); } }
    @keyframes obLivePulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
    @keyframes obScan      { 0% { transform:translateX(-100%); } 100% { transform:translateX(320%); } }

    *, *::before, *::after { box-sizing: border-box; }

    .ob-page input[type="range"] {
      -webkit-appearance: none;
      appearance: none;
      height: 6px;
      border-radius: 999px;
      background: ${C.border};
      outline: none;
    }
    .ob-page input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #fff;
      border: 3px solid ${C.blue500};
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(26,110,255,0.3);
    }
    .ob-page input[type="range"]::-moz-range-thumb {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #fff;
      border: 3px solid ${C.blue500};
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(26,110,255,0.3);
    }

    .ob-page button:focus-visible,
    .ob-page input:focus-visible,
    .ob-page select:focus-visible {
      outline: 2px solid ${C.blue500};
      outline-offset: 2px;
    }

    @media (prefers-reduced-motion: reduce) {
      .ob-page * { animation: none !important; transition: none !important; }
    }

    @media (max-width: 1020px) {
      .ob-hero-grid { grid-template-columns: 1fr !important; gap: 28px !important; }
    }
    @media (max-width: 760px) {
      .ob-strip-r { display: none !important; }
      .ob-role-grid { grid-template-columns: repeat(2, 1fr) !important; }
      .ob-goal-grid { grid-template-columns: repeat(2, 1fr) !important; }
      .ob-form-grid { grid-template-columns: 1fr !important; }
      .ob-step-nav { overflow-x: auto !important; }
      .ob-nav-footer { flex-direction: column !important; align-items: stretch !important; gap: 12px !important; }
    }
    @media (max-width: 480px) {
      .ob-page { padding: 14px 12px 60px !important; }
      .ob-card { padding: 18px !important; }
    }
  `}</style>
);

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════
const S = {
  page: {
    minHeight: '100vh',
    background: C.bg,
    backgroundImage: `radial-gradient(ellipse at 8% 0%, rgba(26,110,255,0.07) 0%, transparent 48%), radial-gradient(ellipse at 92% 10%, rgba(0,173,224,0.05) 0%, transparent 42%)`,
    padding: '24px 28px 80px',
    fontFamily: F.body,
  },
  container: {
    maxWidth: 1120,
    margin: '0 auto',
    transition: 'opacity 0.55s ease, transform 0.55s cubic-bezier(.16,1,.3,1)',
  },

  strip: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '9px 16px', marginBottom: 20, borderRadius: 10,
    background: C.card, border: `1px solid ${C.border}`,
    boxShadow: C.shadow,
  },
  stripL: { display: 'flex', alignItems: 'center', gap: 9 },
  stripR: { display: 'flex', alignItems: 'center', gap: 10 },
  liveDot: {
    width: 7, height: 7, borderRadius: '50%', background: C.green,
    animation: 'obLivePulse 2.4s ease-in-out infinite',
    boxShadow: `0 0 8px ${C.greenGlow}`,
  },
  mono: { fontFamily: F.mono, fontSize: 10.5, letterSpacing: '0.5px', color: C.muted },

  hero: {
    position: 'relative', overflow: 'hidden',
    padding: '36px 32px', marginBottom: 18, borderRadius: 24,
    background: `linear-gradient(135deg, ${C.blue900} 0%, ${C.blue700} 45%, ${C.blue600} 75%, ${C.cyan600} 100%)`,
    boxShadow: '0 24px 64px rgba(0,31,107,0.32)',
  },
  heroScan: {
    position: 'absolute', top: 0, left: 0, width: '25%', height: '100%',
    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)',
    animation: 'obScan 9s linear infinite',
  },
  heroGrid: {
    position: 'relative',
    display: 'grid', gridTemplateColumns: '260px 1fr', gap: 36, alignItems: 'center',
  },

  irsBlock: {},
  irsLabel: {
    fontFamily: F.mono, fontSize: 9.5, fontWeight: 600,
    letterSpacing: '1.4px', color: 'rgba(255,255,255,0.6)', marginBottom: 10,
  },
  irsNum: {
    fontFamily: F.display, fontSize: 62, fontWeight: 900, lineHeight: 1,
    color: '#fff', letterSpacing: '-2px',
  },
  irsMax: { fontSize: 20, fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: 0 },
  tierPill: {
    display: 'inline-flex', alignItems: 'center',
    marginTop: 12, padding: '6px 14px', borderRadius: 999,
    fontSize: 11.5, fontWeight: 700, letterSpacing: '0.3px',
  },
  irsBar: {
    position: 'relative', height: 6, marginTop: 14, borderRadius: 999,
    background: 'rgba(255,255,255,0.15)', overflow: 'hidden',
  },
  irsBarFill: {
    height: '100%', borderRadius: 999,
    background: `linear-gradient(90deg, ${C.blue200}, ${C.cyan400})`,
    transition: 'width 0.5s cubic-bezier(.16,1,.3,1)',
  },
  irsGapText: {
    marginTop: 10, fontSize: 11.5, lineHeight: 1.6,
    color: 'rgba(255,255,255,0.65)',
  },

  verdictBlock: {},
  eyebrow: {
    display: 'flex', alignItems: 'center', gap: 7,
    fontFamily: F.mono, fontSize: 10, fontWeight: 700,
    letterSpacing: '1.6px', color: 'rgba(255,255,255,0.7)', marginBottom: 12,
  },
  eyebrowDot: { width: 6, height: 6, borderRadius: '50%', background: C.cyan400 },
  heroH1: {
    margin: 0, fontFamily: F.display, fontSize: 28, fontWeight: 800,
    color: '#fff', lineHeight: 1.28, letterSpacing: '-0.4px', maxWidth: 640,
  },
  heroSub: { margin: '13px 0 0', fontSize: 14, lineHeight: 1.72, color: 'rgba(255,255,255,0.78)', maxWidth: 560 },

  stepNav: {
    display: 'flex', gap: 8, marginBottom: 18,
  },
  stepPill: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '10px 16px', borderRadius: 999,
    border: `1px solid ${C.border}`, background: C.card,
    color: C.muted, fontFamily: F.body, fontSize: 12.5, fontWeight: 700,
    cursor: 'pointer', whiteSpace: 'nowrap',
    transition: 'all 0.15s ease',
  },
  stepPillActive: {
    borderColor: C.blue500, background: C.blue50, color: C.blue700,
    boxShadow: `0 4px 14px rgba(26,110,255,0.14)`,
  },
  stepPillDone: {
    borderColor: C.borderMd, color: C.sub,
  },
  stepPillNum: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 20, height: 20, borderRadius: '50%',
    background: C.blue50, color: C.blue600,
    fontFamily: F.mono, fontSize: 10.5, fontWeight: 700, flexShrink: 0,
  },

  card: {
    background: C.card, border: `1px solid ${C.border}`,
    borderRadius: 20, padding: 28, boxShadow: C.shadow,
    marginBottom: 18,
  },
  stepHeader: { marginBottom: 22 },
  eyebrowDark: {
    fontFamily: F.mono, fontSize: 9.5, fontWeight: 700,
    letterSpacing: '1.5px', color: C.blue500, marginBottom: 6,
  },
  cardH2: { margin: 0, fontFamily: F.display, fontSize: 20, fontWeight: 800, color: C.text },
  cardSub: { margin: '7px 0 0', fontSize: 13, lineHeight: 1.65, color: C.sub, maxWidth: 560 },

  formGrid: {
    display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 14,
    marginBottom: 22,
  },
  field: { display: 'flex', flexDirection: 'column' },
  fieldFull: { gridColumn: '1 / -1' },
  fieldLabel: { marginBottom: 7, color: C.sub, fontSize: 12, fontWeight: 700 },
  input: {
    width: '100%', height: 46, padding: '0 14px',
    border: `1px solid ${C.borderMd}`, borderRadius: 11,
    background: C.cardAlt, color: C.text,
    fontFamily: F.body, fontSize: 13.5, outline: 'none',
  },
  select: {
    width: '100%', height: 46, padding: '0 14px',
    border: `1px solid ${C.borderMd}`, borderRadius: 11,
    background: C.cardAlt, color: C.text,
    fontFamily: F.body, fontSize: 13.5, outline: 'none',
  },

  groupBlock: { marginBottom: 22 },
  groupHead: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    gap: 10, marginBottom: 10,
  },
  groupTitle: { color: C.text, fontFamily: F.display, fontSize: 13.5, fontWeight: 800 },
  groupTag: { color: C.muted, fontFamily: F.mono, fontSize: 9.5, letterSpacing: '0.5px' },

  chipGrid: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  chip: {
    border: `1px solid ${C.border}`, background: C.card, color: C.sub,
    borderRadius: 999, padding: '9px 14px', cursor: 'pointer',
    fontFamily: F.body, fontSize: 12.5, fontWeight: 700,
  },
  chipActive: {
    borderColor: C.blue500, background: C.blue50, color: C.blue700,
    boxShadow: `0 4px 12px rgba(26,110,255,0.1)`,
  },

  // Dimension sliders (skills step)
  dimSliderList: { display: 'flex', flexDirection: 'column', gap: 18 },
  dimSliderRow: {
    padding: '14px 16px', borderRadius: 14,
    background: C.cardAlt, border: `1px solid ${C.border}`,
  },
  dimSliderMeta: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  dimSliderLeft: { display: 'flex', alignItems: 'center', gap: 11 },
  dimIcon: { fontSize: 18, width: 24, textAlign: 'center', flexShrink: 0 },
  dimName: { fontSize: 13.5, fontWeight: 700, color: C.text, display: 'block' },
  dimWeight: { fontSize: 10.5, color: C.muted, fontFamily: F.mono, display: 'block', marginTop: 2 },
  dimScore: { fontFamily: F.display, fontSize: 19, fontWeight: 800, minWidth: 36, textAlign: 'right' },
  rangeInput: { width: '100%', margin: '2px 0 8px' },
  dimTrackBg: { height: 5, borderRadius: 999, background: C.border, overflow: 'hidden' },
  dimTrackFill: { height: '100%', borderRadius: 999, transition: 'width 0.3s ease' },

  // Role cards
  roleGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 9 },
  roleCard: {
    border: `1px solid ${C.border}`, borderRadius: 14, background: C.card,
    padding: 13, textAlign: 'left', cursor: 'pointer',
  },
  roleCardActive: { borderColor: C.blue500, background: C.blue50 },
  roleIcon: {
    width: 34, height: 34, borderRadius: 10, background: C.cardAlt, color: C.blue500,
    display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 9,
    fontWeight: 900, fontSize: 15,
  },
  roleIconActive: { background: '#fff', color: C.blue600 },
  roleLabel: { display: 'block', color: C.text, fontFamily: F.display, fontSize: 12, fontWeight: 800 },

  // Goal cards
  goalGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 9 },
  goalCard: {
    border: `1px solid ${C.border}`, borderRadius: 14, background: C.card,
    padding: 13, textAlign: 'left', cursor: 'pointer',
  },
  goalCardActive: { borderColor: C.green, background: C.greenTint },
  goalIcon: { fontSize: 19 },
  goalLabel: { display: 'block', marginTop: 8, color: C.text, fontFamily: F.display, fontSize: 11, lineHeight: 1.35 },

  // Answer style
  answerStyleGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 9 },
  answerStyleCard: {
    border: `1px solid ${C.border}`, borderRadius: 14, background: C.card,
    padding: 14, textAlign: 'left', cursor: 'pointer',
  },
  answerStyleCardActive: { borderColor: C.blue500, background: C.blue50 },
  answerStyleDesc: { display: 'block', marginTop: 5, color: C.muted, fontSize: 11.5, lineHeight: 1.5 },

  // Cadence
  cadenceGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 9 },
  cadenceCard: {
    border: `1px solid ${C.border}`, borderRadius: 14, background: C.card,
    padding: 14, textAlign: 'center', cursor: 'pointer',
  },
  cadenceCardActive: { borderColor: C.blue500, background: C.blue50 },
  cadenceLabel: { display: 'block', color: C.text, fontFamily: F.display, fontSize: 15, fontWeight: 800 },
  cadenceSub: { display: 'block', marginTop: 3, color: C.muted, fontSize: 11, fontFamily: F.mono },

  summaryBox: {
    display: 'flex', alignItems: 'center', gap: 13,
    marginTop: 4, padding: 16, borderRadius: 15,
    border: `1px solid ${C.borderMd}`,
    background: `linear-gradient(135deg, ${C.blue50}, ${C.cyanTint})`,
  },
  summaryIcon: {
    width: 40, height: 40, borderRadius: 11, flexShrink: 0,
    background: '#fff', color: C.blue500,
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
  },
  summaryTitle: { display: 'block', color: C.text, fontFamily: F.display, fontSize: 13, fontWeight: 800 },
  summarySub: { display: 'block', marginTop: 3, color: C.sub, fontSize: 12 },

  navFooter: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 16, marginBottom: 18,
  },
  navFooterRight: { display: 'flex', alignItems: 'center', gap: 16 },
  navHint: { fontFamily: F.mono, fontSize: 10.5, color: C.faint },
  btnGhostDark: {
    border: `1px solid ${C.borderMd}`, borderRadius: 12,
    background: C.card, color: C.sub,
    padding: '12px 18px', fontSize: 13, fontWeight: 700,
    fontFamily: F.body, cursor: 'pointer',
  },
  btnPrimaryBlue: {
    border: 'none', borderRadius: 12,
    background: `linear-gradient(135deg, ${C.blue600}, ${C.blue500})`,
    color: '#fff', padding: '12px 22px',
    fontSize: 13.5, fontWeight: 800, fontFamily: F.body,
    cursor: 'pointer', boxShadow: `0 6px 20px rgba(26,110,255,0.28)`,
  },

  footerRow: {
    display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6,
    padding: '4px 4px 0', opacity: 0.5,
  },
};

export default Onboarding;