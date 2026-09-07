const BADGE_META = {
  first_interview: { label: 'First Interview',   icon: '🎯',     desc: 'Completed your first mock' },
  streak_3:        { label: 'Getting Started',    icon: '🔥',     desc: '3-day streak' },
  streak_7:        { label: 'Consistent',         icon: '🔥🔥',   desc: '7-day streak' },
  streak_14:       { label: 'Dedicated',          icon: '🔥🔥🔥', desc: '14-day streak' },
  streak_30:       { label: 'Placement Ready',    icon: '👑',     desc: '30-day streak' },
  streak_60:       { label: 'Interview Machine',  icon: '⚡',     desc: '60-day streak' },
  score_90:        { label: 'Score 90+',          icon: '🏆',     desc: 'Scored 90+ in a session' },
  sessions_50:     { label: '50 Interviews',      icon: '💪',     desc: 'Completed 50 sessions' },
};

const ALL_BADGES = Object.keys(BADGE_META);

const BadgeCard = ({ earnedBadges = [] }) => {
  const earnedSet = new Set(earnedBadges);

  return (
    <div className="w-full min-w-0 bg-surface rounded-xl shadow-md p-6 sm:p-[14px]">
      <h2 className="text-lg font-bold text-text mb-1">Badges</h2>
      <p className="text-xs text-text-muted mb-5">
        {earnedBadges.length}/{ALL_BADGES.length} earned
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {ALL_BADGES.map((id) => {
          const meta = BADGE_META[id];
          const earned = earnedSet.has(id);
          return (
            <div
              key={id}
              className={`flex flex-col items-center text-center p-3 rounded-xl border transition ${
                earned
                  ? 'bg-brand-50 border-brand-100'
                  : 'bg-surface-alt border-border opacity-40 grayscale'
              }`}
              title={earned ? meta.desc : `Locked — ${meta.desc}`}
            >
              <span className="text-2xl mb-1">{meta.icon}</span>
              <span className={`text-xs font-semibold ${earned ? 'text-brand-700' : 'text-text-muted'}`}>
                {meta.label}
              </span>
              <span className="text-xs text-text-muted mt-0.5 leading-tight">
                {meta.desc}
              </span>
              {!earned && <span className="text-xs text-text-faint mt-1">🔒</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BadgeCard;