import { useState, useEffect } from 'react';

const Timer = ({ timeLimit, onTimeUp }) => {
  const [timeLeft, setTimeLeft] = useState(timeLimit);

  useEffect(() => {
    if (timeLeft <= 0) { onTimeUp(); return; }
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
    if (timeLeft > 60) return 'text-success';
    if (timeLeft > 30) return 'text-warning';
    return 'text-danger';
  };

  return (
    <div className={`text-2xl font-bold max-w-full min-w-0 sm:text-sm ${getColor()}`}>
      ⏱ {formatTime(timeLeft)}
    </div>
  );
};

export default Timer;