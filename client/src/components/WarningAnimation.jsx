import { DotLottieReact } from '@lottiefiles/dotlottie-react';

// Split out of ErrorBoundary so the ~160 kB Lottie runtime is only downloaded
// if a crash screen is actually shown, instead of on every first page load.
const WarningAnimation = () => (
  <DotLottieReact
    src="/warning.json"
    loop
    autoplay
    className="w-40 h-40 mx-auto mb-6"
  />
);

export default WarningAnimation;
