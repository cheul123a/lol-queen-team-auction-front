import { useState, useEffect, useCallback, useRef } from 'react';

export function useAuctionTimer(initialSeconds: number = 15) {
  const [timeLeft, setTimeLeft] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 이벤트 발생 시 무조건 n초부터 카운트다운 시작
  const startOrReset = useCallback((newSeconds: number = initialSeconds) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(newSeconds);
    setIsRunning(true);
  }, [initialSeconds]);

  const stop = useCallback(() => {
    setIsRunning(false);
    setTimeLeft(0);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  }, []);

  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            setIsRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, timeLeft]);

  // 남은 시간을 MM:SS 포맷으로 변환하는 헬퍼 함수
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return { m, s };
  };

  return { timeLeft, formattedTime: formatTime(timeLeft), startOrReset, stop };
}