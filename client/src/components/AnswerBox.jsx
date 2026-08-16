import { useState } from 'react';

const AnswerBox = ({ onSubmit, onSkip, isSubmitted, question }) => {
  const [answer, setAnswer] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(null);

  const isObjective = question?.questionType === 'mcq' || question?.questionType === 'aptitude';
  const options = question?.options || [];

  const handleSubmit = () => {
    if (isObjective) {
      if (selectedIndex === null) return;
      onSubmit('', false, 0, selectedIndex); // pass answerIndex
    } else {
      if (answer.trim() === '') return;
      onSubmit(answer);
    }
  };

  return (
    <>
      <style>{`.answer-box textarea {
        width: 100%; max-width: 100%; min-height: 140px; resize: vertical;
      }
      @media (max-width: 480px) {
        .answer-box textarea { min-height: 120px; font-size: 14px; }
      }`}</style>

      <div className="bg-white rounded-xl shadow-md p-6">

        {isObjective ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {options.map((opt, i) => (
              <button
                key={i}
                type="button"
                disabled={isSubmitted}
                onClick={() => setSelectedIndex(i)}
                style={{
                  textAlign: 'left',
                  padding: '12px 16px',
                  borderRadius: 10,
                  border: selectedIndex === i
                    ? '2px solid #4338CA'
                    : '1.5px solid #E5E7EB',
                  background: selectedIndex === i ? '#EEF2FF' : '#fff',
                  color: selectedIndex === i ? '#4338CA' : '#0F0B24',
                  fontWeight: selectedIndex === i ? 700 : 500,
                  fontSize: 14,
                  cursor: isSubmitted ? 'not-allowed' : 'pointer',
                  opacity: isSubmitted ? 0.7 : 1,
                  transition: 'all 0.15s',
                }}
              >
                <span style={{ fontWeight: 700, marginRight: 10 }}>
                  {String.fromCharCode(65 + i)}.
                </span>
                {opt}
              </button>
            ))}
          </div>
        ) : (
          <>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type your answer here..."
              disabled={isSubmitted}
              rows={6}
              className="w-full border border-gray-300 rounded-lg p-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none disabled:bg-gray-100"
            />
            <p className="text-sm text-gray-400 mt-1 mb-4">
              {answer.trim().split(/\s+/).filter(Boolean).length} words
            </p>
          </>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={isSubmitted || (isObjective ? selectedIndex === null : answer.trim() === '')}
            className="flex-1 bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            {isSubmitted ? 'Submitted' : 'Submit Answer'}
          </button>

          <button
            onClick={onSkip}
            disabled={isSubmitted}
            className="px-6 py-3 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition"
          >
            Skip
          </button>
        </div>
      </div>
    </>
  );
};

export default AnswerBox;