const QuestionSkeleton = () => (
  <div className="animate-pulse space-y-4">
    <style> {`.question-skeleton {
  width: 100%;
  max-width: 100%;
  min-width: 0;
}.question-skeleton * {
  max-width: 100%;
}`}</style>
   
    {/* Question card skeleton */}
    <div className="bg-white border border-gray-200 rounded-2xl p-6">
      <div className="h-4 bg-gray-200 rounded w-24 mb-5"></div>
      

      <div className="h-6 bg-gray-200 rounded w-5/6 mb-3"></div>
      <div className="h-6 bg-gray-200 rounded w-4/6 mb-6"></div>

      <div className="flex gap-3">
        <div className="h-6 bg-gray-200 rounded-full w-20"></div>
        <div className="h-6 bg-gray-200 rounded-full w-24"></div>
      </div>
    </div>

    {/* Answer box skeleton */}
    <div className="bg-white border border-gray-200 rounded-2xl p-6">
      <div className="h-4 bg-gray-200 rounded w-28 mb-4"></div>

      <div className="h-32 bg-gray-200 rounded-xl mb-4"></div>

      <div className="flex justify-end gap-3">
        <div className="h-10 bg-gray-200 rounded-lg w-20"></div>
        <div className="h-10 bg-gray-200 rounded-lg w-32"></div>
      </div>
    </div>
  </div>
  
  
  
);


export default QuestionSkeleton;