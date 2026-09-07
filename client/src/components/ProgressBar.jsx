const ProgressBar = ({ current, total }) => {
  const percentage = (current / total) * 100;

  return (
    <div className="w-full max-w-full mb-6">
      <div className="flex justify-between mb-2">
        <span className="text-sm font-medium text-text-sub">
          Question {current} of {total}
        </span>
        <span className="text-sm font-medium text-brand-500">
          {Math.round(percentage)}%
        </span>
      </div>
      <div className="w-full bg-border rounded-full h-2">
        <div
          className="bg-brand-500 h-2 rounded-full transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;