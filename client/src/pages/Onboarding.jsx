import { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import API_BASE from '../config/api.js';

const C = {
  bg:           "#FFFFFF",
  bgSubtle:     "#F8F9FF",
  bgSection:    "#F0F4FF",
  text:         "#0F0B24",
  textSub:      "#64748B",
  textMuted:    "#9CA3AF",
  border:       "#E5E7EB",
  borderIndigo: "#C7D2FE",
  indigo:       "#4338CA",
  indigoHover:  "#3730A3",
  indigoTint:   "#EEF2FF",
  orange:       "#F97316",
  green:        "#059669",
  shadowCard:   "0 2px 20px rgba(67,56,202,0.08), 0 1px 4px rgba(0,0,0,0.04)",
};

const COMPANIES = ['TCS', 'Infosys', 'Wipro', 'Zoho', 'Razorpay', 'FAANG'];
const WEAK_AREAS = ['DSA', 'System Design', 'DBMS', 'OS', 'OOP', 'HR'];
const BRANCHES = [
  { value: 'CSE', label: 'Computer Science (CSE)' },
  { value: 'IT', label: 'Information Technology (IT)' },
  { value: 'ECE', label: 'Electronics (ECE)' },
  { value: 'CE', label: 'Civil Engineering (CE)' },
  { value: 'ME', label: 'Mechanical Engineering (ME)' },
  { value: 'EEE', label: 'Electrical (EEE)' },
];

const Onboarding = () => {
  const [formData, setFormData] = useState({
    college: '',
    branch: '',
    semester: '',
    targetCompanies: [],
    weakAreas: []
  });
 const [loading, setLoading] = useState(false);

const handleSubmit = async () => {
  setLoading(true);

  try {
    const token = localStorage.getItem('token');

    await axios.post(
      `${API_BASE}/auth/onboarding`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    toast.success('Profile saved!');
    window.location.href = '/interview';
  } catch {
    toast.error('Failed to save. Try again.');
  } finally {
    setLoading(false);
  }
};

  const toggle = (key, value) => {
    const arr = formData[key];
    setFormData({
      ...formData,
      [key]: arr.includes(value) ? arr.filter(x => x !== value) : [...arr, value]
    });
  };

  const inputStyle = {
    width: '100%',
    border: `1.5px solid ${C.border}`,
    borderRadius: 10,
    padding: '12px 14px',
    fontFamily: "'Inter', sans-serif",
    fontSize: 14, color: C.text,
    outline: 'none',
    transition: 'border-color 0.2s',
    background: C.bg,
  };

  const chipStyle = (active) => ({
    padding: '8px 16px',
    borderRadius: 99,
    border: `1.5px solid ${active ? C.indigo : C.border}`,
    background: active ? C.indigoTint : C.bg,
    color: active ? C.indigo : C.textSub,
    fontFamily: "'Inter', sans-serif",
    fontSize: 13, fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s',
  });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        input:focus, select:focus { border-color: ${C.indigo} !important; }

        @media (max-width: 640px) {
  .onboarding-container {
    padding: 24px 16px !important;
  }

  .onboarding-card {
    padding: 24px 18px !important;
    border-radius: 14px !important;
  }

  .onboarding-title {
    font-size: 26px !important;
  }

  .onboarding-actions {
    flex-direction: column !important;
  }

  .onboarding-actions button {
    width: 100% !important;
  }

  .onboarding-form {
    width: 100% !important;
  }
}

@media (max-width: 400px) {
  .onboarding-container {
    padding: 18px 12px !important;
  }

  .onboarding-card {
    padding: 20px 14px !important;
  }
}
      `}</style>

      <div style={{
        minHeight: '100vh',
        background: C.bgSubtle,
        display: 'flex', alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px'
      }}>
        <div style={{ width: '100%', maxWidth: 520 }}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: 28, fontWeight: 800,
              color: C.text, marginBottom: 4,
              letterSpacing: '-0.5px'
            }}>
              Mock<span style={{ color: C.indigo }}>Mate</span>
            </div>
            <p style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 15, color: C.textSub
            }}>
              Tell us about yourself to personalize your prep
            </p>
          </div>

          {/* Form card */}
          <div style={{
            background: C.bg,
            border: `1.5px solid ${C.border}`,
            borderRadius: 20,
            padding: '32px',
            boxShadow: C.shadowCard
          }}>

            {/* College */}
            <div style={{ marginBottom: 20 }}>
              <label style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 12, fontWeight: 700,
                color: C.indigo, letterSpacing: '0.8px',
                textTransform: 'uppercase', display: 'block',
                marginBottom: 8
              }}>
                College
              </label>
              <input
                type="text"
                placeholder="e.g. CHARUSAT, IIT Delhi, VIT"
                value={formData.college}
                onChange={e => setFormData({ ...formData, college: e.target.value })}
                style={inputStyle}
                required
              />
            </div>

            {/* Branch + Semester row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div>
                <label style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 12, fontWeight: 700,
                  color: C.indigo, letterSpacing: '0.8px',
                  textTransform: 'uppercase', display: 'block', marginBottom: 8
                }}>
                  Branch
                </label>
                <select
                  value={formData.branch}
                  onChange={e => setFormData({ ...formData, branch: e.target.value })}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                  required
                >
                  <option value="">Select branch</option>
                  {BRANCHES.map(b => (
                    <option key={b.value} value={b.value}>{b.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 12, fontWeight: 700,
                  color: C.indigo, letterSpacing: '0.8px',
                  textTransform: 'uppercase', display: 'block', marginBottom: 8
                }}>
                  Semester
                </label>
                <input
                  type="number"
                  min="1" max="8"
                  placeholder="1 – 8"
                  value={formData.semester}
                  onChange={e => setFormData({ ...formData, semester: e.target.value })}
                  style={inputStyle}
                  required
                />
              </div>
            </div>

            {/* Target companies */}
            <div style={{ marginBottom: 20 }}>
              <label style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 12, fontWeight: 700,
                color: C.indigo, letterSpacing: '0.8px',
                textTransform: 'uppercase', display: 'block', marginBottom: 10
              }}>
                Target Companies
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {COMPANIES.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggle('targetCompanies', c)}
                    style={chipStyle(formData.targetCompanies.includes(c))}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Weak areas */}
            <div style={{ marginBottom: 28 }}>
              <label style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 12, fontWeight: 700,
                color: C.indigo, letterSpacing: '0.8px',
                textTransform: 'uppercase', display: 'block', marginBottom: 10
              }}>
                Weak Areas
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {WEAK_AREAS.map(a => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => toggle('weakAreas', a)}
                    style={chipStyle(formData.weakAreas.includes(a))}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={loading || !formData.college || !formData.branch || !formData.semester || Number(formData.semester) < 1 || Number(formData.semester) > 8}
              style={{
                width: '100%',
                background: loading ? C.textMuted : C.indigo,
                border: 'none', color: '#fff',
                fontFamily: "'Inter', sans-serif",
                fontSize: 15, fontWeight: 700,
                padding: '14px',
                borderRadius: 12,
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 18px rgba(67,56,202,0.28)',
                transition: 'all 0.18s',
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = C.indigoHover; }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.background = C.indigo; }}
            >
              {loading ? 'Saving...' : 'Continue to MockMate →'}
            </button>

          </div>
        </div>
      </div>
    </>
  );
};

export default Onboarding;