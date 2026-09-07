import { useState } from 'react';

const AnswerBox = ({ onSubmit, onSkip, isSubmitted, question }) => {
  const [answer, setAnswer] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(null);

  const isObjective = question?.questionType === 'mcq' || question?.questionType === 'aptitude';
  const options = question?.options || [];

  const handleSubmit = () => {
    if (isObjective) {
      if (selectedIndex === null) return;
      onSubmit('', false, 0, selectedIndex);
    } else {
      if (answer.trim() === '') return;
      onSubmit(answer);
    }
  };

  return (
    <div className="bg-surface rounded-xl shadow-md p-6">
      {isObjective ? (
        <div className="flex flex-col gap-[10px] mb-4">
          {options.map((opt, i) => (
            <button
              key={i}
              type="button"
              disabled={isSubmitted}
              onClick={() => setSelectedIndex(i)}
              className={`text-left px-4 py-3 rounded-md border transition-all duration-fast text-sm font-medium
                disabled:cursor-not-allowed disabled:opacity-70
                ${selectedIndex === i
                  ? 'border-brand-500 border-2 bg-brand-50 text-brand-700 font-bold'
                  : 'border-border bg-surface text-text hover:border-border-md'
                }`}
            >
              <span className="font-bold mr-[10px]">{String.fromCharCode(65 + i)}.</span>
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
            className="w-full max-w-full min-h-[140px] sm:min-h-[120px] sm:text-sm border border-border rounded-lg p-3 text-text
              focus:outline-none focus:ring-2 focus:ring-brand-500 resize-vertical
              disabled:bg-surface-alt disabled:cursor-not-allowed"
          />
          <p className="text-sm text-text-muted mt-1 mb-4">
            {answer.trim().split(/\s+/).filter(Boolean).length} words
          </p>
        </>
      )}

      <div className="flex gap-3">
        <button
          onClick={handleSubmit}
          disabled={isSubmitted || (isObjective ? selectedIndex === null : answer.trim() === '')}
          className="flex-1 bg-brand-500 text-white py-3 rounded-lg font-bold
            hover:bg-brand-600 disabled:opacity-50 transition-all duration-base"
        >
          {isSubmitted ? 'Submitted' : 'Submit Answer'}
        </button>

        <button
          onClick={onSkip}
          disabled={isSubmitted}
          className="px-6 py-3 border border-border rounded-lg text-text-sub
            hover:bg-surface-alt disabled:opacity-50 transition-all duration-base"
        >
          Skip
        </button>
      </div>
    </div>
  );
};

export default AnswerBox;