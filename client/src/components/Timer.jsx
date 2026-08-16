import { useState, useEffect } from 'react';

const Timer = ({ timeLimit, onTimeUp }) => {
  const [timeLeft, setTimeLeft] = useState(timeLimit);

  // Countdown
  useEffect(() => {
    if (timeLeft <= 0) {
      onTimeUp();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => Math.max(prev - 1, 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, onTimeUp]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;

    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const getColor = () => {
    if (timeLeft > 60) return 'text-green-600';
    if (timeLeft > 30) return 'text-yellow-500';
    return 'text-red-600';
  };

  return (
    <>
      <style>{`
        .timer {
          max-width: 100%;
          min-width: 0;
        }

        @media (max-width: 480px) {
          .timer {
            font-size: 14px !important;
          }
        }
      `}</style>

      <div className={`timer text-2xl font-bold ${getColor()}`}>
        ⏱ {formatTime(timeLeft)}
      </div>
    </>
  );
};

export default Timer;