const QuestionCard = ({ question, topic, difficulty }) => {

  // YOUR LOGIC: difficulty color
  const getDifficultyColor = () => {
    if (difficulty === 'easy') return 'bg-success-tint text-success';
    if (difficulty === 'medium') return 'bg-warning-tint text-warning';
    return 'bg-danger-tint text-danger';
  };

  return (
    <> 
    <style> {`.question-card {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow-wrap: anywhere;
}

.question-card * {
  max-width: 100%;
}

@media (max-width: 480px) {
  .question-card {
    padding: 16px !important;
  }

  .question-card h1,
  .question-card h2,
  .question-card h3 {
    font-size: 20px !important;
  }
}`}</style>
    <div className="question-card bg-surface rounded-md shadow-md p-6 mb-6">

      {/* Top row: topic + difficulty badges */}
      <div className="flex gap-3 mb-4">

        {/* Topic badge */}
        <span className="bg-brand-50 text-brand-600 px-3 py-1 rounded-full text-sm font-medium font-body">
          {topic}
        </span>

        {/* Difficulty badge */}
        <span className={`px-3 py-1 rounded-full text-sm font-medium font-body ${getDifficultyColor()}`}>
          {difficulty}
        </span>

      </div>

      {/* Question text */}
      <p className="text-text text-lg font-medium leading-relaxed font-display">
        {question}
      </p>

    </div>
    </>
  );
};

export default QuestionCard;