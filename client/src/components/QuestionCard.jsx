
const QuestionCard = ({ question, topic, difficulty }) => {

  // YOUR LOGIC: difficulty color
  const getDifficultyColor = () => {
    if (difficulty === 'easy') return 'bg-green-100 text-green-700';
    if (difficulty === 'medium') return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-700';
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
    <div className="bg-white rounded-xl shadow-md p-6 mb-6">

      {/* Top row: topic + difficulty badges */}
      <div className="flex gap-3 mb-4">

        {/* Topic badge */}
        <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-sm font-medium">
          {topic}
        </span>

        {/* Difficulty badge */}
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getDifficultyColor()}`}>
          {difficulty}
        </span>

      </div>

      {/* Question text */}
      <p className="text-gray-800 text-lg font-medium leading-relaxed">
        {question}
      </p>

    </div>
    </>
  );
};

export default QuestionCard;