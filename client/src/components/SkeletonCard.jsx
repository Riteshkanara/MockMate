/**
 * SkeletonCard — shimmer placeholder cards for loading states
 * ─────────────────────────────────────────────────────────────────────────
 * Much better UX than a spinner: users see the layout before content loads.
 *
 * Usage:
 *   <SkeletonCard lines={3} showAvatar />
 *   <SkeletonCard variant="wide" />
 */

const C = { bg: '#F0F4FF', bgDeep: '#E8EEFF', border: '#DDE5F7' };

const SkeletonLine = ({ width = '100%', height = 14, style = {} }) => (
  <div style={{
    width, height,
    borderRadius: 6,
    background: `linear-gradient(90deg, ${C.bgDeep} 25%, ${C.border} 50%, ${C.bgDeep} 75%)`,
    backgroundSize: '400px 100%',
    animation: 'mm-shimmer 1.4s ease-in-out infinite',
    ...style,
  }} />
);

const SkeletonCard = ({
  lines = 3,
  showAvatar = false,
  showIcon = false,
  variant = 'default', // 'default' | 'stat' | 'wide'
  style = {},
}) => {
  if (variant === 'stat') {
    return (
      <div style={{
        padding: '20px',
        borderRadius: 16,
        background: '#FFFFFF',
        border: `1px solid ${C.border}`,
        ...style,
      }}>
        <SkeletonLine width="60%" height={10} style={{ marginBottom: 12 }} />
        <SkeletonLine width="40%" height={36} style={{ marginBottom: 8 }} />
        <SkeletonLine width="80%" height={8} />
      </div>
    );
  }

  if (variant === 'wide') {
    return (
      <div style={{
        padding: '20px 24px',
        borderRadius: 16,
        background: '#FFFFFF',
        border: `1px solid ${C.border}`,
        display: 'flex', gap: 20, alignItems: 'center',
        ...style,
      }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: C.bgDeep, flexShrink: 0,
          backgroundSize: '400px 100%', animation: 'mm-shimmer 1.4s ease-in-out infinite',
          background: `linear-gradient(90deg, ${C.bgDeep} 25%, ${C.border} 50%, ${C.bgDeep} 75%)`,
        }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SkeletonLine width="40%" height={14} />
          <SkeletonLine width="70%" height={12} />
        </div>
        <SkeletonLine width={60} height={32} style={{ borderRadius: 8, flexShrink: 0 }} />
      </div>
    );
  }

  return (
    <div style={{
      padding: '20px',
      borderRadius: 16,
      background: '#FFFFFF',
      border: `1px solid ${C.border}`,
      ...style,
    }}>
      {(showAvatar || showIcon) && (
        <div style={{
          width: 40, height: 40, borderRadius: showAvatar ? '50%' : 10,
          marginBottom: 16,
          background: `linear-gradient(90deg, ${C.bgDeep} 25%, ${C.border} 50%, ${C.bgDeep} 75%)`,
          backgroundSize: '400px 100%',
          animation: 'mm-shimmer 1.4s ease-in-out infinite',
        }} />
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Array.from({ length: lines }, (_, i) => (
          <SkeletonLine
            key={i}
            width={i === lines - 1 ? '60%' : i % 2 === 0 ? '100%' : '85%'}
            height={i === 0 ? 16 : 12}
          />
        ))}
      </div>
    </div>
  );
};

export { SkeletonLine };
export default SkeletonCard;