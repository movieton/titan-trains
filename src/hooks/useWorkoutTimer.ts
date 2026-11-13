import { useState, useEffect, useRef, useCallback } from 'react';

export interface UseWorkoutTimerOptions {
  soundEnabled: boolean;
  onTick?: (secondsLeft: number) => void;
  onTimeZero: () => void;
}

export function useWorkoutTimer({ soundEnabled, onTick, onTimeZero }: UseWorkoutTimerOptions) {
  const [secondsLeft, setSecondsLeft] = useState<number>(60);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [targetEndTimestamp, setTargetEndTimestamp] = useState<number | null>(null);
  const [elapsedTotalSeconds, setElapsedTotalSeconds] = useState<number>(0);
  const [workStopwatchSeconds, setWorkStopwatchSeconds] = useState<number>(0);

  const wakeLockRef = useRef<any>(null);
  const workStartTimeRef = useRef<number | null>(null);
  const elapsedAnchorRef = useRef<number>(Date.now());
  const onTimeZeroRef = useRef(onTimeZero);
  onTimeZeroRef.current = onTimeZero;
  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;

  // --- Screen Wake Lock API ---
  const requestWakeLock = useCallback(async () => {
    if (typeof window === 'undefined' || !('wakeLock' in navigator)) return;
    try {
      if (!wakeLockRef.current) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      }
    } catch {
      // Safe fallback if permission denied or battery saver active
      wakeLockRef.current = null;
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
      } catch {
        // ignore
      }
      wakeLockRef.current = null;
    }
  }, []);

  // --- Start Timer (Delta-Time based) ---
  const startTimer = useCallback((seconds: number) => {
    const end = Date.now() + Math.max(0, seconds) * 1000;
    setTargetEndTimestamp(end);
    setSecondsLeft(Math.max(0, seconds));
    setIsRunning(true);
    workStartTimeRef.current = Date.now();
    setWorkStopwatchSeconds(0);
    elapsedAnchorRef.current = Date.now();
    requestWakeLock();
  }, [requestWakeLock]);

  // --- Start Stopwatch for Reps mode ---
  const startStopwatch = useCallback(() => {
    setTargetEndTimestamp(null);
    setIsRunning(true);
    workStartTimeRef.current = Date.now();
    setWorkStopwatchSeconds(0);
    elapsedAnchorRef.current = Date.now();
    requestWakeLock();
  }, [requestWakeLock]);

  // --- Pause ---
  const pauseTimer = useCallback(() => {
    if (targetEndTimestamp) {
      const remaining = Math.max(0, Math.ceil((targetEndTimestamp - Date.now()) / 1000));
      setSecondsLeft(remaining);
    }
    setTargetEndTimestamp(null);
    setIsRunning(false);
    releaseWakeLock();
  }, [targetEndTimestamp, releaseWakeLock]);

  // --- Resume ---
  const resumeTimer = useCallback(() => {
    if (secondsLeft > 0) {
      const end = Date.now() + secondsLeft * 1000;
      setTargetEndTimestamp(end);
    }
    setIsRunning(true);
    if (workStartTimeRef.current === null) {
      workStartTimeRef.current = Date.now() - workStopwatchSeconds * 1000;
    }
    elapsedAnchorRef.current = Date.now();
    requestWakeLock();
  }, [secondsLeft, workStopwatchSeconds, requestWakeLock]);

  // --- Toggle ---
  const toggleRunning = useCallback(() => {
    if (isRunning) {
      pauseTimer();
    } else {
      resumeTimer();
    }
  }, [isRunning, pauseTimer, resumeTimer]);

  // --- Adjust Countdown (+15s / -15s) ---
  const adjustSeconds = useCallback((deltaSeconds: number) => {
    setTargetEndTimestamp((prevEnd) => {
      if (prevEnd && isRunning) {
        const newEnd = prevEnd + deltaSeconds * 1000;
        const remaining = Math.max(1, Math.ceil((newEnd - Date.now()) / 1000));
        setSecondsLeft(remaining);
        return newEnd;
      }
      return null;
    });
    if (!isRunning) {
      setSecondsLeft((prev) => Math.max(5, prev + deltaSeconds));
    }
  }, [isRunning]);

  // --- Restore from Backup ---
  const restoreTimer = useCallback((state: {
    secondsLeft: number;
    targetEndTimestamp: number | null;
    elapsedTotalSeconds: number;
    isRunning: boolean;
  }) => {
    setElapsedTotalSeconds(state.elapsedTotalSeconds);
    if (state.targetEndTimestamp && state.isRunning) {
      const remaining = Math.max(0, Math.ceil((state.targetEndTimestamp - Date.now()) / 1000));
      setSecondsLeft(remaining);
      setTargetEndTimestamp(state.targetEndTimestamp);
      setIsRunning(true);
      requestWakeLock();
    } else {
      setSecondsLeft(state.secondsLeft);
      setTargetEndTimestamp(null);
      setIsRunning(false);
    }
  }, [requestWakeLock]);

  // --- Delta-Time 200ms Heartbeat ---
  useEffect(() => {
    if (!isRunning) {
      releaseWakeLock();
      return;
    }

    requestWakeLock();

    const intervalId = window.setInterval(() => {
      const now = Date.now();

      // Accumulate total session elapsed seconds
      const deltaElapsed = Math.floor((now - elapsedAnchorRef.current) / 1000);
      if (deltaElapsed >= 1) {
        setElapsedTotalSeconds((prev) => prev + deltaElapsed);
        elapsedAnchorRef.current = now;
      }

      // Track stopwatch for reps
      if (workStartTimeRef.current) {
        setWorkStopwatchSeconds(Math.floor((now - workStartTimeRef.current) / 1000));
      }

      // Countdown ticker if targetEndTimestamp is set
      if (targetEndTimestamp) {
        const remaining = Math.max(0, Math.ceil((targetEndTimestamp - now) / 1000));
        setSecondsLeft((current) => {
          if (current !== remaining) {
            onTickRef.current?.(remaining);
          }
          return remaining;
        });

        if (remaining <= 0) {
          setTargetEndTimestamp(null);
          onTimeZeroRef.current();
        }
      }
    }, 200);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isRunning, targetEndTimestamp, requestWakeLock, releaseWakeLock]);

  // --- Visibility Change Handler (Smartphone Screen Wake / Tab Switch) ---
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (isRunning) {
          requestWakeLock();
          // Instant sync against wall-clock time
          if (targetEndTimestamp) {
            const now = Date.now();
            const remaining = Math.max(0, Math.ceil((targetEndTimestamp - now) / 1000));
            setSecondsLeft(remaining);
            if (remaining <= 0) {
              setTargetEndTimestamp(null);
              onTimeZeroRef.current();
            }
          }
        }
      } else {
        // Tab went to background, lock will automatically release by OS
        releaseWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseWakeLock();
    };
  }, [isRunning, targetEndTimestamp, requestWakeLock, releaseWakeLock]);

  return {
    secondsLeft,
    setSecondsLeft,
    isRunning,
    setIsRunning,
    targetEndTimestamp,
    elapsedTotalSeconds,
    setElapsedTotalSeconds,
    workStopwatchSeconds,
    startTimer,
    startStopwatch,
    pauseTimer,
    resumeTimer,
    toggleRunning,
    adjustSeconds,
    restoreTimer,
  };
}
