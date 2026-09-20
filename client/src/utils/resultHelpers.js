import { useState, useEffect } from "react";
import { C } from "../styles/token";

const GRADE_MAP = [
  { min: 90, grade: "S", glyph: "◆", desc: "Elite",          accent: C.violet, tint: C.violetTint, glow: C.violet },
  { min: 80, grade: "A", glyph: "▲", desc: "Strong",         accent: C.green,  tint: C.greenTint,  glow: C.green  },
  { min: 70, grade: "B", glyph: "●", desc: "Solid",          accent: C.blue500,tint: C.blue50,     glow: C.blue500},
  { min: 60, grade: "C", glyph: "■", desc: "Developing",     accent: C.amber,  tint: C.amberTint,  glow: C.amber  },
  { min:  0, grade: "D", glyph: "▼", desc: "Needs Practice", accent: C.red,    tint: C.redTint,    glow: C.red    },
];

const clamp = (v, min = 0, max = 100) =>
  Math.max(min, Math.min(max, Number.isFinite(Number(v)) ? Number(v) : 0));

const getGrade = (s) => GRADE_MAP.find(g => s >= g.min) || GRADE_MAP[GRADE_MAP.length - 1];

export const useSequentialReveal = () => {
  const [flags, setFlags] = useState({ arc: false, grade: false, stats: false, caption: false, actions: false });
  useEffect(() => {
    const timers = [
      setTimeout(() => setFlags(f => ({ ...f, arc:     true })),   80),
      setTimeout(() => setFlags(f => ({ ...f, grade:   true })),  500),
      setTimeout(() => setFlags(f => ({ ...f, stats:   true })),  720),
      setTimeout(() => setFlags(f => ({ ...f, caption: true })),  920),
      setTimeout(() => setFlags(f => ({ ...f, actions: true })), 1080),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);
  return flags;
};

export const revealStyle = {
  fadeUp: (visible, delay = 0) => ({ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(18px)", transition: `opacity 0.55s cubic-bezier(.16,1,.3,1) ${delay}ms, transform 0.55s cubic-bezier(.16,1,.3,1) ${delay}ms` }),
  dropIn: (visible) => ({ opacity: visible ? 1 : 0, transform: visible ? "translateY(0) scale(1)" : "translateY(-14px) scale(0.88)", transition: "opacity 0.42s cubic-bezier(.16,1,.3,1), transform 0.42s cubic-bezier(.16,1,.3,1)" }),
  slideUp: (visible, index = 0) => ({ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(12px)", transition: `opacity 0.38s ease ${index * 60}ms, transform 0.38s cubic-bezier(.16,1,.3,1) ${index * 60}ms` }),
  fade: (visible, delay = 0) => ({ opacity: visible ? 1 : 0, transition: `opacity 0.5s ease ${delay}ms` }),
};


export const useGradeColorMoment = (score) => {
  const [momentActive, setMomentActive] = useState(true);
  const grade = getGrade(clamp(score));
  useEffect(() => { const t = setTimeout(() => setMomentActive(false), 1400); return () => clearTimeout(t); }, []);
  return { momentActive, grade };
};