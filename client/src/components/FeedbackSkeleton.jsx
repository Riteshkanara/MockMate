const FeedbackSkeleton = () => (
  <div style= {{
    background: '#FFFFFF',
    border: '1.5px solid #E5E7EB',
    borderRadius: 16,
    padding: 24,
    marginTop: 16,
  }}>
    {/* Animated shimmer */}
    <style>{`
      @keyframes shimmer {
        0% { background-position: -468px 0 }
        100% { background-position: 468px 0 }
      }
      .shimmer {
        background: linear-gradient(to right, #F0F4FF 8%, #E8EEFF 18%, #F0F4FF 33%);
        background-size: 800px 104px;
        animation: shimmer 1.2s infinite linear;
        border-radius: 8px;
      }
        .skeleton {
  width: 100%;
  max-width: 100%;
  min-width: 0;
}
    `}</style>

    {/* Score circle placeholder */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
      <div className="shimmer" style={{ width: 80, height: 80, borderRadius: '50%' }} />
      <div style={{ flex: 1 }}>
        <div className="shimmer" style={{ height: 14, width: '60%', marginBottom: 8 }} />
        <div className="shimmer" style={{ height: 10, width: '40%' }} />
      </div>
    </div>

    {/* Feedback sections */}
    {[...Array(4)].map((_, i) => (
      <div key={i} style={{ marginBottom: 12 }}>
        <div className="shimmer" style={{ height: 10, width: '30%', marginBottom: 6 }} />
        <div className="shimmer" style={{ height: 14, width: '90%', marginBottom: 4 }} />
        <div className="shimmer" style={{ height: 14, width: '75%' }} />
      </div>
    ))}
  </div>
);

export default FeedbackSkeleton;