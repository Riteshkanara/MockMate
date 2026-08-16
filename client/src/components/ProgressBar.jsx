const ProgressBar = ({ current, total }) => {
  const percentage = (current / total) *100;

  return (
    <>  
    <style> {`.progress-container {
  width: 100%;
  max-width: 100%;
}

.progress-track {
  width: 100%;
  max-width: 100%;
}

.progress-fill {
  max-width: 100%;
}`}</style>
    <div className="w-full mb-6">
      
      {/* Question count text */}
      <div className="flex justify-between mb-2">
        <span className="text-sm font-medium text-gray-600">
          Question {current} of {total}
        </span>
        <span className="text-sm font-medium text-indigo-600">
          {Math.round(percentage)}%
        </span>
      </div>

      {/* Progress bar background */}
      <div className="w-full bg-gray-200 rounded-full h-2">
        
        {/* Progress bar fill */}
        <div
          className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>

    </div>
    </>
  );
};
export default ProgressBar;