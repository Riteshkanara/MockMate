// ─── Imports ────────────────────────────────────────────────
import { useState } from 'react';
import PropTypes from 'prop-types';
import { C, F } from '../../styles/token';
import Button from '../../components/Button';
import { getShareLink } from '../../Services/profileServices';

// ─── PropTypes ──────────────────────────────────────────────
ShareCard.propTypes = {
  name:         PropTypes.string.isRequired,
  irs:          PropTypes.number.isRequired,
  tier:         PropTypes.object.isRequired,
  strongest:    PropTypes.object,
  weakest:      PropTypes.object,
  percentile:   PropTypes.number,
  archetype:    PropTypes.object,
  sessions:     PropTypes.number.isRequired,
  streakDays:   PropTypes.number.isRequired,
  bestScore:    PropTypes.number.isRequired,
  averageScore: PropTypes.number.isRequired,
};

// ─── Component ──────────────────────────────────────────────
function ShareCard({ name, irs, tier, strongest, weakest, percentile, archetype, sessions, streakDays, bestScore, averageScore }) {
  const [copied, setCopied]           = useState(false);
  const [linkCopied, setLinkCopied]   = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError]     = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const shareText = `🎯 MockMate Readiness Report — ${name}

IRS Score: ${irs}/100 — ${tier.label} eligible
Best Session: ${bestScore}/100 · Average: ${averageScore}/100
Strongest: ${strongest?.label ?? '—'} · Weakest: ${weakest?.label ?? '—'}
Style: ${archetype?.label ?? '—'} · ${sessions} sessions logged${streakDays > 0 ? ` · ${streakDays}-day streak 🔥` : ''}${percentile ? ` · Top ${100 - percentile + 1}%` : ''}

Prepared with MockMate — AI mock interview platform`;

  const handleShare = async () => {
    try {
      if (navigator.share) { await navigator.share({ title: 'My MockMate Readiness Score', text: shareText }); }
      else { await navigator.clipboard.writeText(shareText); setCopied(true); setTimeout(() => setCopied(false), 2200); }
    } catch { /* user cancelled */ }
  };

  const handleCopyLink = async () => {
    setLinkLoading(true); setLinkError(false);
    try {
      const { slug } = await getShareLink();
      await navigator.clipboard.writeText(`${window.location.origin}/p/${slug}`);
      setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2200);
    } catch { setLinkError(true); setTimeout(() => setLinkError(false), 2200); }
    finally { setLinkLoading(false); }
  };

  const statPills = [
    { label: 'Best',     value: `${bestScore}/100`,    icon: '★', color: C.cyan400 },
    { label: 'Average',  value: `${averageScore}/100`, icon: '◌', color: 'rgba(255,255,255,0.75)' },
    { label: 'Sessions', value: sessions,              icon: '◎', color: 'rgba(255,255,255,0.75)' },
    ...(streakDays > 0 ? [{ label: 'Streak', value: `${streakDays}d`, icon: '🔥', color: C.amber }] : []),
    ...(percentile    ? [{ label: 'Rank',   value: `Top ${100 - percentile + 1}%`, icon: '↑', color: '#4ADE9C' }] : []),
  ];

  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      padding: '28px 30px', borderRadius: 20,
      background: `linear-gradient(135deg, ${C.blue900} 0%, ${C.blue700} 50%, ${C.cyan600} 100%)`,
      boxShadow: C.shadowLg, marginBottom: 18,
    }}>
      <div style={{ position: 'absolute', top: -90, right: -90, width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,200,240,0.16), transparent 68%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -60, left: -40, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.05), transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 700, letterSpacing: '1.4px', color: 'rgba(255,255,255,0.5)', marginBottom: 18, textTransform: 'uppercase' }}>
        ◈ shareable score card
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 28, flexWrap: 'wrap' }}>

        <div style={{ textAlign: 'center', flexShrink: 0, padding: '16px 20px', borderRadius: 16, background: 'rgba(255,255,255,0.09)', border: '1px solid rgba(255,255,255,0.16)', backdropFilter: 'blur(6px)', minWidth: 100 }}>
          <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: '0.8px', color: 'rgba(255,255,255,0.45)', marginBottom: 6, textTransform: 'uppercase' }}>IRS</div>
          <div style={{ fontFamily: F.display, fontSize: 54, fontWeight: 900, color: '#fff', lineHeight: 1, letterSpacing: '-2px' }}>{irs}</div>
          <div style={{ fontFamily: F.mono, fontSize: 9, color: 'rgba(255,255,255,0.38)', marginTop: 6 }}>/100</div>
          <div style={{ marginTop: 10, padding: '4px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)' }}>
            <div style={{ fontSize: 9.5, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap' }}>{tier.label}</div>
            <div style={{ fontFamily: F.mono, fontSize: 7.5, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>eligible</div>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 220 }}>
          <h2 style={{ margin: 0, fontFamily: F.display, fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: '-0.4px', lineHeight: 1.25 }}>
            {name} is interview-ready
          </h2>

          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {[
              { icon: '✦', label: 'STRONGEST', value: strongest?.label ?? '—', bg: 'rgba(74,222,156,0.12)', border: 'rgba(74,222,156,0.22)', iconColor: '#4ADE9C' },
              { icon: '▲', label: 'TO IMPROVE', value: weakest?.label ?? '—',  bg: 'rgba(255,107,107,0.10)', border: 'rgba(255,107,107,0.20)', iconColor: '#FF6B6B' },
              { icon: '◈', label: 'STYLE',      value: archetype?.label ?? '—', bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.12)', iconColor: C.cyan400 },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8, background: row.bg, border: `1px solid ${row.border}` }}>
                <span style={{ fontSize: 10, color: row.iconColor }}>{row.icon}</span>
                <div>
                  <div style={{ fontFamily: F.mono, fontSize: 7.5, color: 'rgba(255,255,255,0.38)', letterSpacing: '0.5px' }}>{row.label}</div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#fff', marginTop: 1 }}>{row.value}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
            {statPills.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 999, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
                <span style={{ fontSize: 9, color: p.color }}>{p.icon}</span>
                <span style={{ fontFamily: F.mono, fontSize: 8.5, color: 'rgba(255,255,255,0.45)' }}>{p.label}</span>
                <span style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 800, color: p.color }}>{p.value}</span>
              </div>
            ))}
          </div>

          {previewOpen && (
            <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 10, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.10)' }}>
              <div style={{ fontFamily: F.mono, fontSize: 8.5, color: 'rgba(255,255,255,0.35)', marginBottom: 7, letterSpacing: '0.5px' }}>SHARE PREVIEW</div>
              <pre style={{ margin: 0, fontFamily: F.mono, fontSize: 10.5, color: 'rgba(255,255,255,0.72)', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{shareText}</pre>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16, alignItems: 'center' }}>
            <Button variant="gradient" size="sm" onClick={handleShare}>
              {copied ? '✓ Copied' : 'Share your score'}
            </Button>
            <Button surface="dark" variant="secondary" size="sm" onClick={handleCopyLink} disabled={linkLoading}>
              {linkLoading ? 'Generating…' : linkError ? 'Try again' : linkCopied ? '✓ Link copied' : 'Copy profile link'}
            </Button>
            <button
              onClick={() => setPreviewOpen(p => !p)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: F.mono, fontSize: 9.5, color: 'rgba(255,255,255,0.38)', padding: '4px 2px', transition: 'color 0.15s ease' }}
              onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.7)'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.38)'}
            >
              {previewOpen ? 'hide preview ↑' : 'preview share text ↓'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ShareCard;