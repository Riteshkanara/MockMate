const FeedbackCard = ({
  feedback,
  onNext,
  onRetry,
  isLast,
  isRetrying
}) => {
  const aiAvailable = feedback?.aiAvailable !== false;

  return (
    <>
    <style> { `.feedback-card {
  width: 100%;
  min-width: 0;
  overflow-wrap: anywhere;
}

@media (max-width: 600px) {
  .feedback-card {
    padding: 16px !important;
  }
}`}</style>
    <div className="bg-white rounded-xl shadow-md p-6 mt-6">

      {/* Score */}
      <div className="text-center mb-6">
        {aiAvailable && feedback?.score !== null ? (
          <>
            <span className="text-5xl font-bold text-indigo-600">
              {feedback.score}
            </span>

            <span className="text-2xl text-gray-400">
              /100
            </span>
          </>
        ) : (
          <span className="text-xl font-semibold text-gray-500">
            AI evaluation unavailable
          </span>
        )}
      </div>

      {/* AI unavailable message */}
     {!aiAvailable && (
  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
    <p className="text-sm font-bold text-yellow-700 mb-1">
      ⚠️ AI Evaluation Unavailable
    </p>

    <p className="text-sm text-yellow-800 mb-4">
      Your answer was submitted and saved successfully.
      Gemini is currently unavailable, so we could not
      generate feedback for this answer.
    </p>

    <button
  onClick={onRetry}
  disabled={!onRetry || isRetrying}
  className="w-full bg-yellow-600 text-white py-2.5 rounded-lg font-semibold hover:bg-yellow-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
>
  {isRetrying
    ? '⏳ Retrying AI Evaluation...'
    : '🔄 Retry AI Evaluation'}
</button>
  </div>
)}



      {/* AI feedback */}
      {aiAvailable && (
        <>
          {/* What you did well */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-3">
            <p className="text-sm font-bold text-green-700 mb-1">
              What you did well
            </p>

            <p className="text-green-800">
              {feedback.good || 'No feedback available.'}
            </p>
          </div>

          {/* What was missing */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-3">
            <p className="text-sm font-bold text-red-700 mb-1">
              What was missing
            </p>

            <p className="text-red-800">
              {feedback.missing || 'No feedback available.'}
            </p>
          </div>

          {/* Ideal answer hint */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-3">
            <p className="text-sm font-bold text-yellow-700 mb-1">
              Ideal answer hint
            </p>

            <p className="text-yellow-800">
              {feedback.idealHint || 'No hint available.'}
            </p>
          </div>

          {/* Sample answer */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-3">
            <p className="text-sm font-bold text-indigo-700 mb-1">
              Sample answer
            </p>

            <p className="text-indigo-800">
              {feedback.sampleAnswer || 'No sample answer available.'}
            </p>
          </div>

          {/* Improvement tip */}
          <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4 mb-6">
            <p className="text-sm font-bold text-cyan-700 mb-1">
              Improvement tip
            </p>

            <p className="text-cyan-800">
              {feedback.tip || 'No improvement tip available.'}
            </p>
          </div>
        </>
      )}

      Next button
      <button
        onClick={onNext}
        className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 transition"
      >
        {isLast ? 'See Final Result' : 'Next Question'}
      </button>

    </div>
    </>
  );
};

export default FeedbackCard;