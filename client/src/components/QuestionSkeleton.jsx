const QuestionSkeleton = () => (
  <div className="animate-pulse space-y-4 w-full max-w-full min-w-0">
    <div className="bg-surface border border-border rounded-2xl p-6">
      <div className="h-4 bg-bg-deep rounded w-24 mb-5" />
      <div className="h-6 bg-bg-deep rounded w-5/6 mb-3" />
      <div className="h-6 bg-bg-deep rounded w-4/6 mb-6" />
      <div className="flex gap-3">
        <div className="h-6 bg-bg-deep rounded-full w-20" />
        <div className="h-6 bg-bg-deep rounded-full w-24" />
      </div>
    </div>

    <div className="bg-surface border border-border rounded-2xl p-6">
      <div className="h-4 bg-bg-deep rounded w-28 mb-4" />
      <div className="h-32 bg-bg-deep rounded-xl mb-4" />
      <div className="flex justify-end gap-3">
        <div className="h-10 bg-bg-deep rounded-lg w-20" />
        <div className="h-10 bg-bg-deep rounded-lg w-32" />
      </div>
    </div>
  </div>
);

export default QuestionSkeleton;