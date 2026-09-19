// — WeaknessRadar — all 6 dimension bars, sorted weakest-first
import { useMemo, memo } from "react";
import PropTypes from "prop-types";
import {
  C, F,
  DIM_META,
  scoreColor,
  Eyebrow,
  LightCard,
} from "./coachShared";

export const WeaknessRadar = memo(({ analyticsData, navigate }) => {
  const dimProfile = useMemo(() => {
    const apiProfile = analyticsData?.dimensionProfile ?? [];
    return DIM_META.map((meta) => {
      const d = apiProfile.find((x) => x.key === meta.key);
      return { ...meta, score: d?.score ?? 0, hasData: d?.hasData ?? false, answeredCount: d?.answeredCount ?? 0 };
    });
  }, [analyticsData]);

  const sorted = useMemo(() => [...dimProfile].sort((a, b) => {
    if (!a.hasData && b.hasData)  return 1;
    if (a.hasData && !b.hasData)  return -1;
    return a.score - b.score;
  }), [dimProfile]);

  return (
    <LightCard style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        <div>
          <Eyebrow color={C.blue500}>🧪 DIMENSION HEALTH</Eyebrow>
          <h2 style={{ margin: 0, fontFamily: F.display, fontSize: 18, fontWeight: 800, color: C.text }}>All 6 dimensions at a glance</h2>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: C.sub }}>Sorted weakest first — that's what matters.</p>
        </div>
        <button onClick={() => navigate("/interview")} style={{ border: "none", borderRadius: 10, background: `linear-gradient(135deg, ${C.blue600}, ${C.blue500})`, color: "#fff", padding: "9px 18px", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: F.body, boxShadow: "0 4px 14px rgba(26,110,255,0.25)" }}>
          Drill weakest →
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
        {sorted.map((dim, i) => {
          const col       = dim.hasData ? scoreColor(dim.score) : C.faint;
          const isWeakest = i === 0 && dim.hasData;

          if (!dim.hasData) return (
            <div key={dim.key} style={{ padding: "18px 20px", borderRadius: 16, background: "rgba(0,0,0,0.02)", border: `1.5px dashed ${C.border}`, display: "flex", flexDirection: "column", gap: 10, opacity: 0.72 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18, opacity: 0.5 }}>{dim.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.sub }}>{dim.label}</div>
                    <div style={{ fontFamily: F.mono, fontSize: 8.5, color: C.muted }}>{Math.round(dim.weight * 100)}% IRS weight</div>
                  </div>
                </div>
                <span style={{ fontFamily: F.display, fontSize: 22, fontWeight: 900, color: C.faint }}>—</span>
              </div>
              <div style={{ height: 8, borderRadius: 999, background: C.border, border: `1px dashed ${C.borderMd}` }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, color: C.muted, fontWeight: 500 }}>No practice data yet</span>
                <button onClick={() => navigate("/interview")} style={{ border: `1px solid ${C.blue500}`, borderRadius: 7, background: `${C.blue500}10`, color: C.blue500, padding: "4px 10px", fontSize: 10.5, fontWeight: 700, cursor: "pointer", fontFamily: F.body }}>
                  Start practicing →
                </button>
              </div>
            </div>
          );

          const status =
            dim.score >= 80 ? { label: "✓ Strong",      color: C.green,   bg: `${C.green}12`   } :
            dim.score >= 60 ? { label: "→ Developing",  color: C.blue500, bg: `${C.blue500}12` } :
                              { label: "↑ Focus needed", color: C.orange,  bg: `${C.orange}12`  };

          return (
            <div key={dim.key} style={{ borderRadius: 16, background: isWeakest ? `${col}06` : C.cardAlt, border: `1.5px solid ${isWeakest ? col + "35" : C.border}`, overflow: "hidden", position: "relative" }}>
              {isWeakest && <div style={{ height: 3, background: `linear-gradient(90deg, ${col}, ${col}44)` }} />}
              <div style={{ padding: "16px 18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{dim.icon}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{dim.label}</div>
                      <div style={{ fontFamily: F.mono, fontSize: 8.5, color: C.muted }}>{Math.round(dim.weight * 100)}% IRS weight</div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontFamily: F.display, fontSize: 26, fontWeight: 900, color: col, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{dim.score}</span>
                    <div style={{ fontFamily: F.mono, fontSize: 8, color: C.faint, marginTop: 2 }}>/100</div>
                  </div>
                </div>
                <div style={{ position: "relative", marginBottom: 10 }}>
                  <div style={{ height: 8, borderRadius: 999, background: C.border, overflow: "visible", position: "relative" }}>
                    <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${dim.score}%`, borderRadius: 999, background: `linear-gradient(90deg, ${C.amber}cc, ${col})`, transition: "width 1.1s cubic-bezier(.16,1,.3,1)" }} />
                    <div style={{ position: "absolute", top: -4, left: "60%", width: 2, height: 16, background: C.blue500, borderRadius: 999, transform: "translateX(-50%)", opacity: 0.5 }} />
                  </div>
                  <div style={{ position: "absolute", top: 12, left: "60%", transform: "translateX(-50%)", fontFamily: F.mono, fontSize: 7.5, color: C.blue500, fontWeight: 700, whiteSpace: "nowrap", opacity: 0.7 }}>60</div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
                  <span style={{ padding: "3px 9px", borderRadius: 999, background: status.bg, color: status.color, fontSize: 10.5, fontWeight: 700, fontFamily: F.body }}>{status.label}</span>
                  <span style={{ fontFamily: F.mono, fontSize: 9, color: C.muted, marginLeft: "auto" }}>{dim.answeredCount} Q answered</span>
                </div>
                {isWeakest && (
                  <div style={{ marginTop: 10, padding: "5px 10px", borderRadius: 8, background: `${col}12`, border: `1px solid ${col}30`, fontFamily: F.mono, fontSize: 8.5, fontWeight: 800, color: col, letterSpacing: "0.6px", textAlign: "center" }}>
                    ⚠ HIGHEST PRIORITY — drill this dimension first
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </LightCard>
  );
});

WeaknessRadar.propTypes = {
  analyticsData: PropTypes.object,
  navigate:      PropTypes.func.isRequired,
};