import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import API_BASE from '../config/api.js';

// ─── Design tokens ─────────────────────────────────────────────────────────
const C = {
  canvas:   '#F0F4FF',
  surface:  '#FFFFFF',
  raised:   '#F5F8FF',

  ink:      '#0F172A',
  inkMid:   '#334155',
  inkSub:   '#64748B',
  inkFaint: '#94A3B8',

  border:   '#E2E8F0',
  borderMd: '#CBD5E1',

  blu50:  '#EFF6FF',
  blu100: '#DBEAFE',
  blu200: '#BFDBFE',
  blu400: '#60A5FA',
  blu500: '#3B82F6',
  blu600: '#2563EB',
  blu700: '#1D4ED8',
  blu900: '#1E3A8A',

  cya500: '#06B6D4',
  cya600: '#0891B2',

  emerald:   '#059669',
  emeraldBg: '#ECFDF5',
  amber:     '#D97706',
  amberBg:   '#FFFBEB',
  rose:      '#E11D48',
  roseBg:    '#FFF1F2',

  shadow:     '0 1px 4px rgba(15,23,42,0.06), 0 2px 12px rgba(15,23,42,0.04)',
  shadowMd:   '0 4px 24px rgba(15,23,42,0.10)',
  shadowBlue: '0 8px 32px rgba(37,99,235,0.18)',
  shadowInput:'0 0 0 3px rgba(59,130,246,0.15)',
};

const F = {
  display: "'Plus Jakarta Sans', 'Syne', sans-serif",
  body:    "'Inter', -apple-system, sans-serif",
  mono:    "'JetBrains Mono', 'Fira Code', monospace",
};

// ─── Static data ────────────────────────────────────────────────────────────
const BRANCHES = [
  { value: 'CSE', label: 'Computer Science (CSE)' },
  { value: 'IT',  label: 'Information Technology (IT)' },
  { value: 'ECE', label: 'Electronics & Communication (ECE)' },
  { value: 'EEE', label: 'Electrical Engineering (EEE)' },
  { value: 'ME',  label: 'Mechanical Engineering (ME)' },
  { value: 'CE',  label: 'Civil Engineering (CE)' },
];

const TIMELINES = [
  { value: 'immediate', label: '0–3 months',  sub: 'High urgency',   icon: '🔴' },
  { value: 'near',      label: '3–6 months',  sub: 'Moderate pace',  icon: '🟡' },
  { value: 'moderate',  label: '6–12 months', sub: 'Steady ramp',    icon: '🟢' },
  { value: 'relaxed',   label: '12+ months',  sub: 'Relaxed build',  icon: '🔵' },
];

const CODING_EXP = [
  { value: '<1',  label: '< 1 year',  desc: 'Just getting started' },
  { value: '1-2', label: '1–2 years', desc: 'Built a few projects' },
  { value: '2-3', label: '2–3 years', desc: 'Comfortable with DSA' },
  { value: '3+',  label: '3+ years',  desc: 'Strong foundation' },
];

const LANGUAGES = [
  { value: 'javascript', label: 'JavaScript', icon: '🟨' },
  { value: 'python',     label: 'Python',     icon: '🐍' },
  { value: 'java',       label: 'Java',       icon: '☕' },
  { value: 'cpp',        label: 'C++',        icon: '⚙️' },
  { value: 'other',      label: 'Other',      icon: '💻' },
];

const PRIMARY_GOALS = [
  { value: 'campus',     label: 'Campus placement',  icon: '🎓', desc: 'College placement drive' },
  { value: 'offcampus',  label: 'Off-campus job',    icon: '🚀', desc: 'Applying independently' },
  { value: 'internship', label: 'Internship',        icon: '💼', desc: 'Seasonal or part-time' },
  { value: 'upskill',    label: 'Skill & switch',    icon: '⚡', desc: 'Working, want better role' },
];

const TARGET_ROLES = [
  { value: 'sde',       label: 'Software Engineer', icon: '⌘',  color: '#3B82F6' },
  { value: 'frontend',  label: 'Frontend Dev',      icon: '◫',  color: '#8B5CF6' },
  { value: 'backend',   label: 'Backend Dev',       icon: '⚙',  color: '#0891B2' },
  { value: 'fullstack', label: 'Full Stack',        icon: '◆',  color: '#2563EB' },
  { value: 'data',      label: 'Data / Analytics',  icon: '◈',  color: '#059669' },
  { value: 'devops',    label: 'DevOps / Cloud',    icon: '☁',  color: '#D97706' },
];

const PACKAGE_TARGETS = [
  { value: '3-6',   label: '₹3–6 LPA',   tier: 1, desc: 'Service / off-campus',    col: C.inkFaint },
  { value: '6-12',  label: '₹6–12 LPA',  tier: 2, desc: 'Mid-tier product, MNCs',  col: C.amber   },
  { value: '12-20', label: '₹12–20 LPA', tier: 3, desc: 'Top product, FAANG-adj.', col: C.blu600  },
  { value: '20+',   label: '₹20+ LPA',   tier: 4, desc: 'FAANG, unicorn, remote',  col: C.emerald },
];

const COMPANIES = [
  { value: 'faang',   label: 'FAANG / Big Tech' },
  { value: 'unicorn', label: 'Unicorn startups' },
  { value: 'product', label: 'Mid-tier product' },
  { value: 'mnc',     label: 'IT MNCs (TCS / Infy)' },
  { value: 'service', label: 'Service companies' },
  { value: 'startup', label: 'Early-stage startup' },
];

const FOCUS_AREAS = [
  { key: 'arrays',        label: 'Arrays & Strings',          emoji: '📋' },
  { key: 'linkedList',    label: 'Linked Lists',              emoji: '🔗' },
  { key: 'trees',         label: 'Trees & BST',               emoji: '🌳' },
  { key: 'graphs',        label: 'Graphs & BFS/DFS',          emoji: '🕸️' },
  { key: 'dp',            label: 'Dynamic Programming',       emoji: '🧩' },
  { key: 'recursion',     label: 'Recursion & Backtracking',  emoji: '🔁' },
  { key: 'sorting',       label: 'Sorting & Searching',       emoji: '⚡' },
  { key: 'hashing',       label: 'Hashing & Heaps',           emoji: '🔑' },
  { key: 'os',            label: 'Operating Systems',         emoji: '💾' },
  { key: 'dbms',          label: 'DBMS & SQL',                emoji: '🗃️' },
  { key: 'networking',    label: 'Computer Networks',         emoji: '🌐' },
  { key: 'oop',           label: 'OOP & Design Patterns',     emoji: '🏗️' },
  { key: 'systemDesign',  label: 'System Design',             emoji: '⬡' },
  { key: 'behavioral',    label: 'HR / Behavioral',           emoji: '🤝' },
];

const ANSWER_STYLES = [
  { value: 'explain', label: 'Think aloud',  icon: '💭', desc: 'Reason first, then code' },
  { value: 'code',    label: 'Code first',   icon: '⚡', desc: 'Implement fast, explain after' },
  { value: 'mixed',   label: 'Adaptive',     icon: '🎯', desc: 'MockMate picks per question' },
];

const DIFFICULTY_PREFS = [
  { value: 'easy',   label: 'Start easy',   icon: '🌱', desc: 'Build confidence, ramp slowly' },
  { value: 'medium', label: 'Balanced',     icon: '⚖️', desc: 'Mix of solvable + stretch' },
  { value: 'hard',   label: 'Throw me in',  icon: '🔥', desc: 'Hard from day one' },
];

const CADENCE = [
  { value: 2, label: '2 days/week', sub: 'Light',     dots: 2 },
  { value: 4, label: '4 days/week', sub: 'Steady',    dots: 4 },
  { value: 6, label: '6 days/week', sub: 'Intensive', dots: 6 },
];

const STEPS = [
  { key: 'profile', label: 'Your Profile',   short: 'Profile', icon: '🎓' },
  { key: 'goals',   label: 'Goals & Target', short: 'Goals',   icon: '🎯' },
  { key: 'focus',   label: 'Focus Areas',    short: 'Focus',   icon: '📌' },
  { key: 'style',   label: 'Training Style', short: 'Style',   icon: '⚙' },
];

// ─── Initial state ──────────────────────────────────────────────────────────
const INIT_PROFILE  = { college: '', branch: '', semester: '', cgpa: '', placementTimeline: 'near', codingExperience: '1-2', preferredLanguage: 'javascript' };
const INIT_GOALS    = { primaryGoal: 'campus', targetRole: 'sde', packageTarget: '6-12', targetCompanies: [] };
const INIT_FOCUS    = { weakAreas: [] };
const INIT_TRAINING = { answerStyle: 'mixed', difficultyPref: 'medium', weeklyDays: 4, projectUrl: '' };

// ─── Main component ─────────────────────────────────────────────────────────
export default function Onboarding() {
  const [step, setStep]         = useState(0);
  const [profile, setProfile]   = useState(INIT_PROFILE);
  const [goals, setGoals]       = useState(INIT_GOALS);
  const [focus, setFocus]       = useState(INIT_FOCUS);
  const [training, setTraining] = useState(INIT_TRAINING);
  const [loading, setLoading]   = useState(false);
  const [mounted, setMounted]   = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  useEffect(() => {
    requestAnimationFrame(() => setTimeout(() => setMounted(true), 60));
  }, []);

  const profileValid = Boolean(
    profile.college.trim() &&
    profile.branch &&
    Number(profile.semester) >= 1 &&
    Number(profile.semester) <= 8
  );

  const advance = () => {
    if (step === 0 && !profileValid) {
      toast.error('College, branch, and semester are required.');
      return;
    }
    setStep(s => Math.min(STEPS.length - 1, s + 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const retreat = () => {
    setStep(s => Math.max(0, s - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const jumpTo = (i) => {
    if (i === 0 || profileValid) setStep(i);
    else toast.error('Complete your basic details first.');
  };

  const handleComplete = async () => {
    if (!profileValid) { setStep(0); return; }
    setLoading(true);
    const tid = toast.loading('Building your prep profile…');
    try {
      const token = localStorage.getItem('token');
      const payload = {
        college:           profile.college.trim(),
        branch:            profile.branch,
        semester:          Number(profile.semester),
        cgpa:              profile.cgpa ? Number(profile.cgpa) : null,
        placementTimeline: profile.placementTimeline,
        codingExperience:  profile.codingExperience,
        preferredLanguage: profile.preferredLanguage,

        primaryGoal:     goals.primaryGoal,
        targetRole:      goals.targetRole,
        packageTarget:   goals.packageTarget,
        targetCompanies: goals.targetCompanies,

        weakAreas: focus.weakAreas,

        answerStyle:    training.answerStyle,
        difficultyPref: training.difficultyPref,
        weeklyDays:     training.weeklyDays,
        projectUrl:     training.projectUrl,
      };

      const res = await fetch(`${API_BASE}/auth/onboarding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || data.message || 'Onboarding failed');
      }

      toast.dismiss(tid);
      toast.success("Profile ready — let's begin.");
      window.location.href = '/interview';
    } catch (err) {
      console.error('Onboarding failed:', err);
      toast.dismiss(tid);
      toast.error(err.message || 'Could not save your profile. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const activeKey = STEPS[step].key;
  const isLast    = step === STEPS.length - 1;
  const progress  = (step / (STEPS.length - 1)) * 100;

  return (
    <div style={S.page} className="ob-root">
      <GlobalStyles />

      <div style={S.bgBlob1} />
      <div style={S.bgBlob2} />

      <div style={{
        ...S.shell,
        opacity:   mounted ? 1 : 0,
        transform: mounted ? 'none' : 'translateY(16px)',
      }}>
        {/* ── Banner ─────────────────────────────────────────────────── */}
        <div style={S.banner}>
          <div style={S.bannerLeft}>
            <div style={S.bannerLogo}>
              <div style={S.bannerLogoMark}>M</div>
              <span style={S.bannerBrand}>MockMate</span>
            </div>
            <span style={S.bannerTag}>Interview Readiness Platform</span>
          </div>
          <div style={S.bannerRight}>
            <div style={S.bannerProgressText}>
              <span style={S.bannerStepLabel}>{STEPS[step].label}</span>
              <span style={S.bannerPct}>{Math.round(progress)}%</span>
            </div>
            <div style={S.bannerTrack}>
              <div style={{ ...S.bannerFill, width: `${progress}%` }} />
            </div>
          </div>
        </div>

        {/* ── Step nav ───────────────────────────────────────────────── */}
        <nav style={S.stepNav} className="ob-step-nav">
          {STEPS.map((s, i) => {
            const done   = i < step;
            const active = i === step;
            return (
              <button key={s.key} type="button" onClick={() => jumpTo(i)}
                style={{ ...S.stepTab, ...(active ? S.stepTabActive : done ? S.stepTabDone : {}) }}>
                <span style={{ ...S.stepBubble, ...(active ? S.stepBubbleActive : done ? S.stepBubbleDone : {}) }}>
                  {done ? '✓' : i + 1}
                </span>
                <span style={{ ...S.stepLabel, ...(active ? S.stepLabelActive : {}) }} className="ob-step-label">
                  {s.short}
                </span>
              </button>
            );
          })}
        </nav>

        {/* ── Step card ──────────────────────────────────────────────── */}
        <div style={S.card} className="ob-card">
          {activeKey === 'profile' && (
            <ProfileStep
              profile={profile} setProfile={setProfile}
              focusedField={focusedField} setFocusedField={setFocusedField}
            />
          )}
          {activeKey === 'goals' && (
            <GoalsStep goals={goals} setGoals={setGoals} />
          )}
          {activeKey === 'focus' && (
            <FocusStep focus={focus} setFocus={setFocus} />
          )}
          {activeKey === 'style' && (
            <TrainingStep
              training={training} setTraining={setTraining}
              profile={profile} goals={goals}
            />
          )}
        </div>

        {/* ── Nav footer ─────────────────────────────────────────────── */}
        <div style={S.navRow} className="ob-nav-row">
          <button type="button"
            style={{ ...S.btnBack, visibility: step === 0 ? 'hidden' : 'visible' }}
            onClick={retreat} disabled={loading}>
            ← Back
          </button>
          <div style={S.navRight}>
            <span style={S.navCount}>{step + 1} of {STEPS.length}</span>
            {!isLast ? (
              <button type="button" style={S.btnNext} onClick={advance}>
                Continue <span>→</span>
              </button>
            ) : (
              <button type="button"
                style={{ ...S.btnNext, ...(loading ? S.btnDisabled : {}) }}
                onClick={handleComplete} disabled={loading}>
                {loading
                  ? <><span style={S.spinner} /> Saving…</>
                  : <>Enter MockMate <span>→</span></>
                }
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 1 — PROFILE
// ═══════════════════════════════════════════════════════════════════════════
function ProfileStep({ profile, setProfile, focusedField, setFocusedField }) {
  const set = (k, v) => setProfile(p => ({ ...p, [k]: v }));

  return (
    <>
      <StepHeader
        eyebrow="Step 1 of 4"
        title="Your academic profile"
        sub="This calibrates question difficulty, urgency, and company filters to your actual situation."
      />

      {/* Academic fields */}
      <div style={S.formGrid} className="ob-form-grid">
        <FormField label="College / University" full required>
          <InputWrap focused={focusedField === 'college'} check={Boolean(profile.college.trim())}>
            <span style={S.iIcon}>🏫</span>
            <input type="text" value={profile.college}
              placeholder="e.g. CHARUSAT University"
              style={S.iInner}
              onFocus={() => setFocusedField('college')}
              onBlur={() => setFocusedField(null)}
              onChange={e => set('college', e.target.value)}
            />
          </InputWrap>
        </FormField>

        <FormField label="Branch / Stream" required>
          <InputWrap focused={focusedField === 'branch'}>
            <span style={S.iIcon}>📐</span>
            <select value={profile.branch} style={S.iSelect}
              onFocus={() => setFocusedField('branch')}
              onBlur={() => setFocusedField(null)}
              onChange={e => set('branch', e.target.value)}>
              <option value="">Select branch</option>
              {BRANCHES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
          </InputWrap>
        </FormField>

        <FormField label="Current semester" hint="1–8" required>
          <InputWrap focused={focusedField === 'semester'}>
            <span style={S.iIcon}>📅</span>
            <input type="number" min="1" max="8"
              value={profile.semester} placeholder="e.g. 6"
              style={S.iInner}
              onFocus={() => setFocusedField('semester')}
              onBlur={() => setFocusedField(null)}
              onChange={e => set('semester', e.target.value)}
            />
          </InputWrap>
        </FormField>

        <FormField label="CGPA" hint="Optional">
          <InputWrap focused={focusedField === 'cgpa'}>
            <span style={S.iIcon}>⭐</span>
            <input type="number" min="0" max="10" step="0.01"
              value={profile.cgpa} placeholder="e.g. 8.25"
              style={S.iInner}
              onFocus={() => setFocusedField('cgpa')}
              onBlur={() => setFocusedField(null)}
              onChange={e => set('cgpa', e.target.value)}
            />
          </InputWrap>
        </FormField>
      </div>

      {/* Coding experience */}
      <GroupBlock title="How long have you been coding?" tag="Pick one">
        <div style={S.expGrid}>
          {CODING_EXP.map(opt => {
            const active = profile.codingExperience === opt.value;
            return (
              <button key={opt.value} type="button"
                style={{ ...S.expCard, ...(active ? S.expCardActive : {}) }}
                onClick={() => set('codingExperience', opt.value)}>
                <strong style={{ ...S.expLabel, color: active ? C.blu700 : C.ink }}>{opt.label}</strong>
                <span style={{ ...S.expDesc, color: active ? C.blu500 : C.inkFaint }}>{opt.desc}</span>
                {active && <div style={S.activeBar} />}
              </button>
            );
          })}
        </div>
      </GroupBlock>

      {/* Preferred language */}
      <GroupBlock title="Primary coding language" tag="Pick one">
        <div style={S.langGrid}>
          {LANGUAGES.map(l => {
            const active = profile.preferredLanguage === l.value;
            return (
              <button key={l.value} type="button"
                style={{ ...S.langCard, ...(active ? S.langCardActive : {}) }}
                onClick={() => set('preferredLanguage', l.value)}>
                <span style={S.langEmoji}>{l.icon}</span>
                <span style={{ ...S.langLabel, color: active ? C.blu700 : C.ink }}>{l.label}</span>
              </button>
            );
          })}
        </div>
      </GroupBlock>

      {/* Placement timeline */}
      <GroupBlock title="When are your placements?" tag="Pick one">
        <div style={S.timelineGrid}>
          {TIMELINES.map(t => {
            const active = profile.placementTimeline === t.value;
            return (
              <button key={t.value} type="button"
                style={{ ...S.timelineCard, ...(active ? S.timelineCardActive : {}) }}
                onClick={() => set('placementTimeline', t.value)}>
                <span style={S.timelineEmoji}>{t.icon}</span>
                <strong style={{ ...S.timelineLabel, color: active ? C.blu600 : C.ink }}>{t.label}</strong>
                <span style={{ ...S.timelineSub, color: active ? C.blu500 : C.inkFaint }}>{t.sub}</span>
                {active && <div style={S.activeBar} />}
              </button>
            );
          })}
        </div>
      </GroupBlock>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 2 — GOALS
// ═══════════════════════════════════════════════════════════════════════════
function GoalsStep({ goals, setGoals }) {
  const set       = (k, v) => setGoals(p => ({ ...p, [k]: v }));
  const toggleArr = (k, v) => setGoals(p => {
    const cur = p[k] || [];
    return { ...p, [k]: cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v] };
  });

  return (
    <>
      <StepHeader
        eyebrow="Step 2 of 4"
        title="Goals & targets"
        sub="Your targets determine which company-specific question banks and difficulty curves MockMate pulls from."
      />

      <GroupBlock title="Primary goal" tag="Pick one">
        <div style={S.goalGrid} className="ob-goal-grid">
          {PRIMARY_GOALS.map(g => {
            const active = goals.primaryGoal === g.value;
            return (
              <button key={g.value} type="button"
                style={{ ...S.goalCard, ...(active ? S.goalCardActive : {}) }}
                onClick={() => set('primaryGoal', g.value)}>
                <span style={S.goalEmoji}>{g.icon}</span>
                <strong style={{ ...S.goalLabel, color: active ? C.blu700 : C.ink }}>{g.label}</strong>
                <span style={S.goalDesc}>{g.desc}</span>
                {active && <div style={S.goalCheck}>✓</div>}
              </button>
            );
          })}
        </div>
      </GroupBlock>

      <GroupBlock title="Target role" tag="Pick one">
        <div style={S.roleGrid} className="ob-role-grid">
          {TARGET_ROLES.map(r => {
            const active = goals.targetRole === r.value;
            return (
              <button key={r.value} type="button"
                style={{ ...S.roleCard, ...(active ? S.roleCardActive : {}) }}
                onClick={() => set('targetRole', r.value)}>
                <span style={{ ...S.roleIcon, color: active ? r.color : C.inkSub }}>{r.icon}</span>
                <span style={{ ...S.roleLabel, color: active ? r.color : C.ink }}>{r.label}</span>
                {active && <div style={{ ...S.activeBar, background: r.color }} />}
              </button>
            );
          })}
        </div>
      </GroupBlock>

      <GroupBlock title="Target package" tag="Pick one">
        <div style={S.pkgGrid}>
          {PACKAGE_TARGETS.map(p => {
            const active = goals.packageTarget === p.value;
            return (
              <button key={p.value} type="button"
                style={{
                  ...S.pkgCard,
                  ...(active ? { ...S.pkgCardActive, borderColor: p.col, background: `${p.col}10` } : {}),
                }}
                onClick={() => set('packageTarget', p.value)}>
                <div style={{ ...S.pkgTier, background: active ? p.col : C.border }}>T{p.tier}</div>
                <strong style={{ ...S.pkgLabel, color: active ? p.col : C.ink }}>{p.label}</strong>
                <span style={S.pkgDesc}>{p.desc}</span>
              </button>
            );
          })}
        </div>
      </GroupBlock>

      <GroupBlock title="Companies on your radar" tag="Select all that apply">
        <div style={S.chipGrid}>
          {COMPANIES.map(c => {
            const active = goals.targetCompanies.includes(c.value);
            return (
              <button key={c.value} type="button"
                style={{ ...S.chip, ...(active ? S.chipActive : {}) }}
                onClick={() => toggleArr('targetCompanies', c.value)}>
                {active && <span style={S.chipCheck}>✓</span>}
                {c.label}
              </button>
            );
          })}
        </div>
        <p style={S.chipHint}>Filters company-specific question banks in Company Specific mode.</p>
      </GroupBlock>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 3 — FOCUS AREAS
// ═══════════════════════════════════════════════════════════════════════════
function FocusStep({ focus, setFocus }) {
  const toggle = (key) => setFocus(p => {
    const cur = p.weakAreas || [];
    return { ...p, weakAreas: cur.includes(key) ? cur.filter(k => k !== key) : [...cur, key] };
  });

  const selected = focus.weakAreas || [];

  return (
    <>
      <StepHeader
        eyebrow="Step 3 of 4"
        title="Where do you want to focus?"
        sub="Selected topics appear 2× more often in your sessions. Pick everything you want to strengthen — there's no wrong answer."
      />

      <div style={S.focusGrid} className="ob-focus-grid">
        {FOCUS_AREAS.map(t => {
          const active = selected.includes(t.key);
          return (
            <button key={t.key} type="button"
              style={{ ...S.focusCard, ...(active ? S.focusCardActive : {}) }}
              onClick={() => toggle(t.key)}>
              <span style={S.focusEmoji}>{t.emoji}</span>
              <span style={{ ...S.focusLabel, color: active ? C.blu700 : C.ink }}>{t.label}</span>
              {active && (
                <div style={S.focusCheckmark}>✓</div>
              )}
            </button>
          );
        })}
      </div>

      {selected.length > 0 && (
        <div style={S.focusSummary}>
          <span style={S.focusSummaryIcon}>📌</span>
          <span style={S.focusSummaryText}>
            <strong>{selected.length}</strong> topic{selected.length !== 1 ? 's' : ''} selected —
            these will get boosted frequency in every session.
          </span>
        </div>
      )}

      <InfoBox icon="💡" title="Tip">
        You can change your focus areas at any time from Settings.
        Start with your honest weak spots for the fastest improvement.
      </InfoBox>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 4 — TRAINING STYLE
// ═══════════════════════════════════════════════════════════════════════════
function TrainingStep({ training, setTraining, profile, goals }) {
  const set = (k, v) => setTraining(p => ({ ...p, [k]: v }));

  const targetRole  = TARGET_ROLES.find(r => r.value === goals.targetRole)?.label ?? '';
  const primaryGoal = PRIMARY_GOALS.find(g => g.value === goals.primaryGoal)?.label ?? '';

  return (
    <>
      <StepHeader
        eyebrow="Step 4 of 4"
        badge="Final step"
        badgeColor={C.emerald}
        title="How do you want to train?"
        sub="Sets your default session experience. All of these can be changed from Settings at any time."
      />

      <GroupBlock title="How you answer best" tag="Pick one">
        <div style={S.triGrid}>
          {ANSWER_STYLES.map(opt => {
            const active = training.answerStyle === opt.value;
            return (
              <button key={opt.value} type="button"
                style={{ ...S.styleCard, ...(active ? S.styleCardActive : {}) }}
                onClick={() => set('answerStyle', opt.value)}>
                {active && <div style={S.styleTopBar} />}
                <span style={S.styleEmoji}>{opt.icon}</span>
                <strong style={{ ...S.styleLabel, color: active ? C.blu700 : C.ink }}>{opt.label}</strong>
                <span style={S.styleDesc}>{opt.desc}</span>
              </button>
            );
          })}
        </div>
      </GroupBlock>

      <GroupBlock title="Starting difficulty" tag="Pick one">
        <div style={S.triGrid}>
          {DIFFICULTY_PREFS.map(opt => {
            const active = training.difficultyPref === opt.value;
            return (
              <button key={opt.value} type="button"
                style={{ ...S.styleCard, ...(active ? S.styleCardActive : {}) }}
                onClick={() => set('difficultyPref', opt.value)}>
                {active && <div style={S.styleTopBar} />}
                <span style={S.styleEmoji}>{opt.icon}</span>
                <strong style={{ ...S.styleLabel, color: active ? C.blu700 : C.ink }}>{opt.label}</strong>
                <span style={S.styleDesc}>{opt.desc}</span>
              </button>
            );
          })}
        </div>
      </GroupBlock>

      <GroupBlock title="Weekly practice cadence" tag="Pick one">
        <div style={S.cadGrid}>
          {CADENCE.map(c => {
            const active = training.weeklyDays === c.value;
            return (
              <button key={c.value} type="button"
                style={{ ...S.cadCard, ...(active ? S.cadCardActive : {}) }}
                onClick={() => set('weeklyDays', c.value)}>
                <div style={S.cadDots}>
                  {[1, 2, 3, 4, 5, 6].map(d => (
                    <div key={d} style={{
                      ...S.cadDot,
                      background: d <= c.value ? (active ? C.blu500 : C.borderMd) : C.border,
                    }} />
                  ))}
                </div>
                <strong style={{ ...S.cadLabel, color: active ? C.blu600 : C.ink }}>{c.label}</strong>
                <span style={{ ...S.cadSub, color: active ? C.blu400 : C.inkFaint }}>{c.sub}</span>
              </button>
            );
          })}
        </div>
      </GroupBlock>

      {/* Optional GitHub / portfolio */}
      <GroupBlock title="Portfolio or GitHub URL" tag="Optional — helps the AI personalize project-defence questions">
        <div style={{ ...S.urlWrap, ...(training._urlFocused ? S.urlWrapFocused : {}) }}>
          <span style={S.iIcon}>🔗</span>
          <input
            type="url"
            value={training.projectUrl}
            placeholder="https://github.com/yourusername"
            style={S.iInner}
            onFocus={() => set('_urlFocused', true)}
            onBlur={() => set('_urlFocused', false)}
            onChange={e => set('projectUrl', e.target.value)}
          />
        </div>
      </GroupBlock>

      {/* Summary card */}
      <div style={S.summaryCard}>
        <div style={S.summaryHead}>
          <div style={S.summaryHeadLeft}>
            <div style={S.summaryBadge}>✦</div>
            <strong style={S.summaryTitle}>Your MockMate profile</strong>
          </div>
        </div>
        <div style={S.summaryDivider} />
        <div style={S.summaryGrid}>
          {[
            { label: 'Role',       val: targetRole },
            { label: 'Goal',       val: primaryGoal },
            { label: 'Package',    val: PACKAGE_TARGETS.find(p => p.value === goals.packageTarget)?.label },
            { label: 'Timeline',   val: TIMELINES.find(t => t.value === profile.placementTimeline)?.label },
            { label: 'Cadence',    val: `${training.weeklyDays} days/week` },
            { label: 'Difficulty', val: DIFFICULTY_PREFS.find(d => d.value === training.difficultyPref)?.label },
            { label: 'Language',   val: LANGUAGES.find(l => l.value === profile.preferredLanguage)?.label },
            { label: 'Style',      val: ANSWER_STYLES.find(a => a.value === training.answerStyle)?.label },
          ].map(row => (
            <div key={row.label} style={S.summaryItem}>
              <span style={S.summaryItemLabel}>{row.label}</span>
              <span style={S.summaryItemVal}>{row.val}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── Shared primitives ──────────────────────────────────────────────────────
function StepHeader({ eyebrow, badge, badgeColor = C.blu600, title, sub }) {
  return (
    <div style={S.stepHeader}>
      <div style={S.eyebrowRow}>
        <span style={S.eyebrow}>{eyebrow}</span>
        {badge && (
          <span style={{ ...S.eyebrowBadge, color: badgeColor, background: `${badgeColor}14`, borderColor: `${badgeColor}30` }}>
            {badge}
          </span>
        )}
      </div>
      <h2 style={S.cardH2}>{title}</h2>
      {sub && <p style={S.cardSub}>{sub}</p>}
    </div>
  );
}

function FormField({ label, hint, full, required, children }) {
  return (
    <div style={{ ...S.field, ...(full ? { gridColumn: '1 / -1' } : {}) }}>
      <label style={S.fieldLabel}>
        {label}
        {required && <span style={{ color: C.rose, marginLeft: 3 }}>*</span>}
        {hint && <span style={S.fieldHint}> · {hint}</span>}
      </label>
      {children}
    </div>
  );
}

function InputWrap({ focused, check, children }) {
  return (
    <div style={{ ...S.inputWrap, ...(focused ? S.inputWrapFocused : {}) }}>
      {children}
      {check && <span style={{ color: C.emerald, paddingRight: 12, fontSize: 14 }}>✓</span>}
    </div>
  );
}

function GroupBlock({ title, tag, children }) {
  return (
    <div style={S.group}>
      <div style={S.groupHead}>
        <strong style={S.groupTitle}>{title}</strong>
        {tag && <span style={S.groupTag}>{tag}</span>}
      </div>
      {children}
    </div>
  );
}

function InfoBox({ icon, title, children }) {
  return (
    <div style={S.infoBox}>
      <span style={{ fontSize: 15, flexShrink: 0 }}>{icon}</span>
      <div>
        {title && <strong style={{ fontSize: 12, fontWeight: 700, color: C.blu700 }}>{title} · </strong>}
        <span style={{ fontSize: 12, color: C.inkMid, lineHeight: 1.65 }}>{children}</span>
      </div>
    </div>
  );
}

// ─── Global styles ──────────────────────────────────────────────────────────
function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      body { background: ${C.canvas}; }

      .ob-root button:focus-visible,
      .ob-root input:focus-visible,
      .ob-root select:focus-visible {
        outline: 2px solid ${C.blu500}; outline-offset: 2px;
      }
      .ob-root select { -webkit-appearance: none; appearance: none; cursor: pointer; }
      .ob-root input::placeholder { color: ${C.inkFaint}; }

      @keyframes ob-spin { to { transform: rotate(360deg); } }

      @media (prefers-reduced-motion: reduce) {
        .ob-root * { transition: none !important; animation: none !important; }
      }

      /* Tablet */
      @media (max-width: 860px) {
        .ob-root { padding: 16px 16px 60px !important; }
        .ob-card { padding: 20px 18px !important; }
      }

      /* Mobile */
      @media (max-width: 600px) {
        .ob-step-label { display: none !important; }
        .ob-form-grid  { grid-template-columns: 1fr !important; }
        .ob-goal-grid  { grid-template-columns: repeat(2,1fr) !important; }
        .ob-role-grid  { grid-template-columns: repeat(2,1fr) !important; }
        .ob-focus-grid { grid-template-columns: repeat(2,1fr) !important; }
        .ob-nav-row    { flex-direction: column-reverse !important; gap: 10px !important; }
        .ob-step-nav   { overflow-x: auto !important; }
      }

      /* Very small */
      @media (max-width: 420px) {
        .ob-focus-grid { grid-template-columns: 1fr !important; }
      }
    `}</style>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────
const S = {
  page: {
    display: 'flex',
    justifyContent: 'center',
    minHeight: '100vh',
    background: C.canvas,
    backgroundImage: `
      radial-gradient(ellipse 700px 500px at -10% -10%, rgba(59,130,246,0.08) 0%, transparent 60%),
      radial-gradient(ellipse 600px 400px at 110% 110%, rgba(6,182,212,0.05) 0%, transparent 60%)
    `,
    padding: '24px 24px 80px',
    fontFamily: F.body,
    position: 'relative',
  },

  bgBlob1: {
    position: 'fixed', top: -120, left: -120,
    width: 400, height: 400, borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)',
    pointerEvents: 'none', zIndex: 0,
  },
  bgBlob2: {
    position: 'fixed', bottom: -80, right: -80,
    width: 320, height: 320, borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(6,182,212,0.05) 0%, transparent 70%)',
    pointerEvents: 'none', zIndex: 0,
  },

  shell: {
    width: '100%',
    maxWidth: 720,
    zIndex: 1,
    transition: 'opacity 0.5s ease, transform 0.5s cubic-bezier(.16,1,.3,1)',
  },

  // ── Banner ──
  banner: {
    background: `linear-gradient(135deg, ${C.blu700} 0%, ${C.blu600} 55%, ${C.cya600} 100%)`,
    borderRadius: 18,
    padding: '16px 22px',
    marginBottom: 14,
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16,
    boxShadow: C.shadowBlue,
    flexWrap: 'wrap',
  },
  bannerLeft: { display: 'flex', flexDirection: 'column', gap: 3 },
  bannerLogo: { display: 'flex', alignItems: 'center', gap: 8 },
  bannerLogoMark: {
    width: 28, height: 28, borderRadius: 7,
    background: 'rgba(255,255,255,0.2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontFamily: F.display, fontSize: 14, fontWeight: 800,
  },
  bannerBrand: { color: '#fff', fontFamily: F.display, fontSize: 17, fontWeight: 800, letterSpacing: '-0.3px' },
  bannerTag: { color: 'rgba(255,255,255,0.6)', fontSize: 10.5, fontFamily: F.mono },
  bannerRight: { display: 'flex', flexDirection: 'column', gap: 5, minWidth: 130 },
  bannerProgressText: { display: 'flex', justifyContent: 'space-between' },
  bannerStepLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: 600 },
  bannerPct: { color: '#fff', fontSize: 11, fontWeight: 700, fontFamily: F.mono },
  bannerTrack: { height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 999, overflow: 'hidden' },
  bannerFill: { height: '100%', borderRadius: 999, background: 'rgba(255,255,255,0.9)', transition: 'width 0.5s cubic-bezier(.16,1,.3,1)' },

  // ── Step nav ──
  stepNav: {
    display: 'flex', gap: 4, marginBottom: 14,
    background: C.surface, borderRadius: 14, padding: '5px',
    border: `1px solid ${C.border}`, boxShadow: C.shadow,
  },
  stepTab: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: '8px 10px', borderRadius: 10,
    border: 'none', background: 'none',
    color: C.inkFaint, fontFamily: F.body, fontSize: 12, fontWeight: 600,
    cursor: 'pointer', whiteSpace: 'nowrap',
    transition: 'all 0.18s ease',
  },
  stepTabActive: { background: C.blu50, color: C.blu600 },
  stepTabDone:   { color: C.inkSub },
  stepBubble: {
    width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
    background: C.raised, color: C.inkFaint,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 9, fontWeight: 700, fontFamily: F.mono,
    border: `1.5px solid ${C.border}`,
    transition: 'all 0.18s ease',
  },
  stepBubbleActive: { background: C.blu600, color: '#fff', borderColor: C.blu600 },
  stepBubbleDone:   { background: C.emeraldBg, color: C.emerald, borderColor: `${C.emerald}40`, fontSize: 11 },
  stepLabel: { fontSize: 12, fontWeight: 600 },
  stepLabelActive: { color: C.blu700 },

  // ── Card ──
  card: {
    background: C.surface, borderRadius: 20,
    border: `1px solid ${C.border}`, boxShadow: C.shadow,
    padding: '26px 26px 22px', marginBottom: 12,
  },

  // ── Step header ──
  stepHeader: { marginBottom: 24 },
  eyebrowRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 },
  eyebrow: { fontFamily: F.mono, fontSize: 9.5, fontWeight: 600, letterSpacing: '1.2px', color: C.blu500, textTransform: 'uppercase' },
  eyebrowBadge: { fontSize: 10, fontWeight: 700, fontFamily: F.mono, padding: '2px 8px', borderRadius: 999, border: '1px solid' },
  cardH2: { fontFamily: F.display, fontSize: 22, fontWeight: 800, color: C.ink, letterSpacing: '-0.4px', lineHeight: 1.25 },
  cardSub: { marginTop: 8, fontSize: 13.5, lineHeight: 1.7, color: C.inkMid, maxWidth: 580 },

  // ── Form ──
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 22 },
  field: { display: 'flex', flexDirection: 'column' },
  fieldLabel: { marginBottom: 7, fontSize: 12, fontWeight: 700, color: C.inkSub, letterSpacing: '0.2px' },
  fieldHint: { color: C.inkFaint, fontWeight: 400, fontSize: 11 },

  inputWrap: {
    display: 'flex', alignItems: 'center',
    height: 46, borderRadius: 11,
    border: `1.5px solid ${C.borderMd}`,
    background: C.raised, overflow: 'hidden',
    transition: 'border-color 0.18s ease, box-shadow 0.18s ease',
  },
  inputWrapFocused: { borderColor: C.blu500, boxShadow: C.shadowInput, background: C.surface },
  iIcon: { padding: '0 10px 0 12px', fontSize: 14, flexShrink: 0, color: C.inkFaint },
  iInner: {
    flex: 1, height: '100%',
    border: 'none', background: 'transparent',
    color: C.ink, fontFamily: F.body, fontSize: 13.5,
    outline: 'none', paddingRight: 12,
  },
  iSelect: {
    flex: 1, height: '100%',
    border: 'none', background: 'transparent',
    color: C.ink, fontFamily: F.body, fontSize: 13.5,
    outline: 'none', paddingRight: 12,
  },

  // ── URL field (same look as inputWrap but standalone) ──
  urlWrap: {
    display: 'flex', alignItems: 'center',
    height: 46, borderRadius: 11,
    border: `1.5px solid ${C.borderMd}`,
    background: C.raised, overflow: 'hidden',
    transition: 'border-color 0.18s ease, box-shadow 0.18s ease',
  },
  urlWrapFocused: { borderColor: C.blu500, boxShadow: C.shadowInput, background: C.surface },

  // ── Groups ──
  group: { marginBottom: 24 },
  groupHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 11 },
  groupTitle: { fontSize: 13.5, fontWeight: 700, color: C.ink },
  groupTag: { fontFamily: F.mono, fontSize: 9.5, letterSpacing: '0.4px', color: C.inkFaint, textTransform: 'uppercase' },

  // ── Shared active bar ──
  activeBar: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: C.blu500 },

  // ── Coding experience ──
  expGrid: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 },
  expCard: {
    border: `1.5px solid ${C.border}`, borderRadius: 13, background: C.raised,
    padding: '13px 10px', textAlign: 'center', cursor: 'pointer',
    display: 'flex', flexDirection: 'column', gap: 4,
    transition: 'all 0.16s ease', position: 'relative', overflow: 'hidden',
  },
  expCardActive: { borderColor: C.blu400, background: C.blu50, boxShadow: `0 0 0 1px ${C.blu200}` },
  expLabel: { fontSize: 13, fontWeight: 800 },
  expDesc:  { fontSize: 10.5, fontFamily: F.mono },

  // ── Language ──
  langGrid: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  langCard: {
    display: 'inline-flex', alignItems: 'center', gap: 7,
    border: `1.5px solid ${C.border}`, borderRadius: 10, background: C.raised,
    padding: '9px 14px', cursor: 'pointer',
    transition: 'all 0.16s ease',
  },
  langCardActive: { borderColor: C.blu400, background: C.blu50, boxShadow: `0 0 0 1px ${C.blu200}` },
  langEmoji: { fontSize: 15 },
  langLabel: { fontSize: 13, fontWeight: 700 },

  // ── Timeline ──
  timelineGrid: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 },
  timelineCard: {
    border: `1.5px solid ${C.border}`, borderRadius: 13, background: C.raised,
    padding: '14px 10px 12px', textAlign: 'center', cursor: 'pointer',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
    transition: 'all 0.16s ease', position: 'relative', overflow: 'hidden',
  },
  timelineCardActive: { borderColor: C.blu400, background: C.blu50, boxShadow: `0 0 0 1px ${C.blu200}` },
  timelineEmoji: { fontSize: 18 },
  timelineLabel: { fontSize: 12.5, fontWeight: 800, display: 'block' },
  timelineSub: { fontSize: 10.5, display: 'block', fontFamily: F.mono },

  // ── Goals ──
  goalGrid: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 },
  goalCard: {
    border: `1.5px solid ${C.border}`, borderRadius: 13, background: C.raised,
    padding: '14px 10px', textAlign: 'center', cursor: 'pointer',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
    transition: 'all 0.16s ease', position: 'relative',
  },
  goalCardActive: { borderColor: C.blu400, background: C.blu50, boxShadow: `0 0 0 1px ${C.blu200}` },
  goalEmoji: { fontSize: 22 },
  goalLabel: { fontSize: 12, fontWeight: 800 },
  goalDesc:  { fontSize: 10, color: C.inkFaint, lineHeight: 1.4 },
  goalCheck: {
    position: 'absolute', top: 7, right: 7,
    width: 16, height: 16, borderRadius: '50%',
    background: C.blu600, color: '#fff', fontSize: 9, fontWeight: 800,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },

  // ── Roles ──
  roleGrid: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 },
  roleCard: {
    border: `1.5px solid ${C.border}`, borderRadius: 13, background: C.raised,
    padding: '13px 10px', textAlign: 'center', cursor: 'pointer',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
    transition: 'all 0.16s ease', position: 'relative', overflow: 'hidden',
  },
  roleCardActive: { borderColor: C.blu300, background: C.blu50, boxShadow: `0 0 0 1px ${C.blu200}` },
  roleIcon: { fontSize: 20, fontWeight: 900, transition: 'color 0.16s ease' },
  roleLabel: { fontSize: 11.5, fontWeight: 700, transition: 'color 0.16s ease' },

  // ── Package ──
  pkgGrid: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 },
  pkgCard: {
    border: `1.5px solid ${C.border}`, borderRadius: 13, background: C.raised,
    padding: '13px 10px', textAlign: 'center', cursor: 'pointer',
    transition: 'all 0.16s ease',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
  },
  pkgCardActive: { boxShadow: `0 0 0 1px ${C.blu200}` },
  pkgTier: {
    width: 22, height: 22, borderRadius: 6,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 9, fontWeight: 800, color: '#fff', fontFamily: F.mono,
    transition: 'background 0.18s ease',
  },
  pkgLabel: { fontSize: 13, fontWeight: 800, transition: 'color 0.18s ease' },
  pkgDesc:  { fontSize: 10, color: C.inkFaint, lineHeight: 1.35 },

  // ── Chips ──
  chipGrid: { display: 'flex', flexWrap: 'wrap', gap: 7 },
  chip: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    border: `1.5px solid ${C.border}`, background: C.raised, color: C.inkMid,
    borderRadius: 999, padding: '8px 14px', cursor: 'pointer',
    fontFamily: F.body, fontSize: 12.5, fontWeight: 600,
    transition: 'all 0.14s ease',
  },
  chipActive: { borderColor: C.blu400, background: C.blu50, color: C.blu700 },
  chipCheck: { fontSize: 10, color: C.blu600, fontWeight: 800 },
  chipHint: { marginTop: 8, fontSize: 11, color: C.inkFaint },

  // ── Focus grid ──
  focusGrid: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 16 },
  focusCard: {
    border: `1.5px solid ${C.border}`, borderRadius: 13, background: C.raised,
    padding: '12px 12px', cursor: 'pointer',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
    textAlign: 'center', position: 'relative', overflow: 'hidden',
    transition: 'all 0.16s ease',
  },
  focusCardActive: { borderColor: C.blu400, background: C.blu50, boxShadow: `0 0 0 1px ${C.blu200}` },
  focusEmoji: { fontSize: 20 },
  focusLabel: { fontSize: 11.5, fontWeight: 700 },
  focusCheckmark: {
    position: 'absolute', top: 6, right: 6,
    width: 16, height: 16, borderRadius: '50%',
    background: C.blu600, color: '#fff', fontSize: 9, fontWeight: 800,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  focusSummary: {
    display: 'flex', gap: 8, alignItems: 'center',
    padding: '10px 14px', borderRadius: 10,
    background: C.blu50, border: `1px solid ${C.blu100}`,
    marginBottom: 14,
  },
  focusSummaryIcon: { fontSize: 14 },
  focusSummaryText: { fontSize: 12.5, color: C.inkMid },

  // ── Info box ──
  infoBox: {
    display: 'flex', gap: 10, alignItems: 'flex-start',
    padding: '12px 14px', borderRadius: 11,
    background: C.blu50, border: `1px solid ${C.blu100}`,
  },

  // ── Training style ──
  triGrid: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 },
  styleCard: {
    border: `1.5px solid ${C.border}`, borderRadius: 13, background: C.raised,
    padding: '15px 13px', textAlign: 'left', cursor: 'pointer',
    display: 'flex', flexDirection: 'column', gap: 5,
    transition: 'all 0.16s ease', position: 'relative', overflow: 'hidden',
  },
  styleCardActive: { borderColor: C.blu400, background: C.blu50, boxShadow: `0 0 0 1px ${C.blu200}` },
  styleTopBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: C.blu500 },
  styleEmoji: { fontSize: 20, marginBottom: 2 },
  styleLabel: { fontSize: 13, fontWeight: 800 },
  styleDesc:  { fontSize: 11.5, color: C.inkFaint, lineHeight: 1.55 },

  // ── Cadence ──
  cadGrid: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 },
  cadCard: {
    border: `1.5px solid ${C.border}`, borderRadius: 13, background: C.raised,
    padding: '15px 13px', textAlign: 'center', cursor: 'pointer',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
    transition: 'all 0.16s ease',
  },
  cadCardActive: { borderColor: C.blu400, background: C.blu50, boxShadow: `0 0 0 1px ${C.blu200}` },
  cadDots: { display: 'flex', gap: 4 },
  cadDot: { width: 8, height: 8, borderRadius: 2, transition: 'background 0.18s ease' },
  cadLabel: { fontSize: 13, fontWeight: 800 },
  cadSub:   { fontSize: 10.5, fontFamily: F.mono },

  // ── Summary card ──
  summaryCard: {
    marginTop: 8, padding: '16px 18px', borderRadius: 16,
    border: `1.5px solid ${C.blu200}`,
    background: `linear-gradient(135deg, ${C.blu50} 0%, rgba(224,242,254,0.4) 100%)`,
    boxShadow: `0 4px 16px rgba(37,99,235,0.08)`,
  },
  summaryHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  summaryHeadLeft: { display: 'flex', alignItems: 'center', gap: 9 },
  summaryBadge: {
    width: 26, height: 26, borderRadius: 7,
    background: `linear-gradient(135deg, ${C.blu600}, ${C.cya500})`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontSize: 12,
  },
  summaryTitle: { fontSize: 13.5, fontWeight: 800, color: C.ink, fontFamily: F.display },
  summaryDivider: { height: 1, background: C.blu100, marginBottom: 13 },
  summaryGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 18px' },
  summaryItem: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '5px 0', borderBottom: `1px solid ${C.blu100}`,
  },
  summaryItemLabel: { fontSize: 11.5, color: C.inkSub },
  summaryItemVal:   { fontSize: 12, fontWeight: 700, color: C.ink },

  // ── Nav row ──
  navRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  navRight: { display: 'flex', alignItems: 'center', gap: 12 },
  navCount: { fontFamily: F.mono, fontSize: 10.5, color: C.inkFaint },

  btnBack: {
    border: `1.5px solid ${C.borderMd}`, borderRadius: 10,
    background: C.surface, color: C.inkSub,
    padding: '11px 20px', fontSize: 13, fontWeight: 600,
    fontFamily: F.body, cursor: 'pointer',
    transition: 'all 0.14s ease',
  },
  btnNext: {
    display: 'inline-flex', alignItems: 'center', gap: 7,
    border: 'none', borderRadius: 10,
    background: `linear-gradient(135deg, ${C.blu600} 0%, ${C.blu700} 100%)`,
    color: '#fff',
    padding: '12px 22px', fontSize: 13.5, fontWeight: 700,
    fontFamily: F.body, cursor: 'pointer',
    boxShadow: `0 4px 14px rgba(37,99,235,0.30)`,
    transition: 'opacity 0.14s ease',
  },
  btnDisabled: { opacity: 0.65, cursor: 'not-allowed' },
  spinner: {
    display: 'inline-block',
    width: 14, height: 14, borderRadius: '50%',
    border: `2px solid rgba(255,255,255,0.3)`,
    borderTopColor: '#fff',
    animation: 'ob-spin 0.7s linear infinite',
  },
};