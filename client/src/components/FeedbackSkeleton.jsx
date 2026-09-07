const FeedbackSkeleton = () => (
  <div className="w-full max-w-full min-w-0 bg-surface border border-border rounded-xl p-6 mt-4">
    <style>{`
      @keyframes shimmer {
        0%   { background-position: -468px 0 }
        100% { background-position:  468px 0 }
      }
      .mm-shimmer {
        background: linear-gradient(to right, var(--color-bg) 8%, var(--color-bg-deep) 18%, var(--color-bg) 33%);
        background-size: 800px 104px;
        animation: shimmer 1.2s infinite linear;
        border-radius: 8px;
      }
    `}</style>

    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
      <div className="mm-shimmer" style={{ width: 80, height: 80, borderRadius: '50%' }} />
      <div style={{ flex: 1 }}>
        <div className="mm-shimmer" style={{ height: 14, width: '60%', marginBottom: 8 }} />
        <div className="mm-shimmer" style={{ height: 10, width: '40%' }} />
      </div>
    </div>

    {[...Array(4)].map((_, i) => (
      <div key={i} style={{ marginBottom: 12 }}>
        <div className="mm-shimmer" style={{ height: 10, width: '30%', marginBottom: 6 }} />
        <div className="mm-shimmer" style={{ height: 14, width: '90%', marginBottom: 4 }} />
        <div className="mm-shimmer" style={{ height: 14, width: '75%' }} />
      </div>
    ))}
  </div>
);

export default FeedbackSkeleton;