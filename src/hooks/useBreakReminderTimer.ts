import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { soundEngine } from '../utils/soundEngine';
import { sendSystemNotification } from '../utils/notificationScheduler';

const BREAK_TIMER_STORAGE_KEY = 'titan_break_timer_target';
const BREAK_TIMER_PRESET_KEY = 'titan_break_timer_preset';

export interface UseBreakReminderTimerOptions {
  soundEnabled?: boolean;
  onTriggerBreak?: () => void;
}

export function useBreakReminderTimer({
  soundEnabled = true,
  onTriggerBreak,
}: UseBreakReminderTimerOptions = {}) {
  const [presetMinutes, setPresetMinutes] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(BREAK_TIMER_PRESET_KEY);
      return saved ? parseInt(saved, 10) : 60;
    } catch {
      return 60;
    }
  });

  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [totalSeconds, setTotalSeconds] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isPromptOpen, setIsPromptOpen] = useState<boolean>(false);

  const targetEndRef = useRef<number | null>(null);
  const timerFiredRef = useRef<boolean>(false);

  // --- Start timer with custom minutes or seconds ---
  const startTimer = useCallback((minutes: number) => {
    const secs = Math.max(10, Math.round(minutes * 60));
    const target = Date.now() + secs * 1000;
    targetEndRef.current = target;
    timerFiredRef.current = false;
    setTotalSeconds(secs);
    setRemainingSeconds(secs);
    setIsRunning(true);
    setIsPromptOpen(false);
    setPresetMinutes(minutes);

    try {
      localStorage.setItem(BREAK_TIMER_STORAGE_KEY, String(target));
      localStorage.setItem(BREAK_TIMER_PRESET_KEY, String(minutes));
    } catch {
      // ignore
    }
  }, []);

  // --- 10-second test button ---
  const startTest10s = useCallback(() => {
    const secs = 10;
    const target = Date.now() + secs * 1000;
    targetEndRef.current = target;
    timerFiredRef.current = false;
    setTotalSeconds(secs);
    setRemainingSeconds(secs);
    setIsRunning(true);
    setIsPromptOpen(false);

    try {
      localStorage.setItem(BREAK_TIMER_STORAGE_KEY, String(target));
    } catch {
      // ignore
    }
  }, []);

  // --- Pause ---
  const pauseTimer = useCallback(() => {
    setIsRunning(false);
    targetEndRef.current = null;
    try {
      localStorage.removeItem(BREAK_TIMER_STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  // --- Resume ---
  const resumeTimer = useCallback(() => {
    if (remainingSeconds <= 0) return;
    const target = Date.now() + remainingSeconds * 1000;
    targetEndRef.current = target;
    timerFiredRef.current = false;
    setIsRunning(true);
    try {
      localStorage.setItem(BREAK_TIMER_STORAGE_KEY, String(target));
    } catch {
      // ignore
    }
  }, [remainingSeconds]);

  // --- Reset ---
  const resetTimer = useCallback(() => {
    setIsRunning(false);
    setRemainingSeconds(0);
    setTotalSeconds(0);
    targetEndRef.current = null;
    timerFiredRef.current = false;
    setIsPromptOpen(false);
    try {
      localStorage.removeItem(BREAK_TIMER_STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  // --- Snooze (e.g. 10 minutes) ---
  const snooze = useCallback((mins = 10) => {
    startTimer(mins);
  }, [startTimer]);

  // --- Dismiss Prompt ---
  const dismissPrompt = useCallback(() => {
    setIsPromptOpen(false);
    resetTimer();
  }, [resetTimer]);

  // --- Handle Time Zero Trigger ---
  const triggerTimeZero = useCallback(() => {
    if (timerFiredRef.current) return;
    timerFiredRef.current = true;
    setIsRunning(false);
    targetEndRef.current = null;
    setRemainingSeconds(0);
    setIsPromptOpen(true);

    try {
      localStorage.removeItem(BREAK_TIMER_STORAGE_KEY);
    } catch {
      // ignore
    }

    if (soundEnabled) {
      soundEngine.playStartBell();
    }

    sendSystemNotification('⚡ Пора размяться! (Рабочий перерыв)', {
      body: 'Время для 3-минутного анти-гиподинамия перерыва. Снимите застой в шее и пояснице.',
      url: '/?action=start_break',
    });
  }, [soundEnabled]);

  // --- Restore from localStorage on mount ---
  useEffect(() => {
    try {
      const savedTarget = localStorage.getItem(BREAK_TIMER_STORAGE_KEY);
      if (savedTarget) {
        const target = parseInt(savedTarget, 10);
        const diff = Math.ceil((target - Date.now()) / 1000);
        if (diff > 0) {
          targetEndRef.current = target;
          setRemainingSeconds(diff);
          setTotalSeconds((prev) => (prev > 0 ? prev : diff));
          setIsRunning(true);
        } else {
          localStorage.removeItem(BREAK_TIMER_STORAGE_KEY);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // --- Delta-Time 500ms ticker ---
  useEffect(() => {
    if (!isRunning) return;

    const interval = window.setInterval(() => {
      if (targetEndRef.current) {
        const remaining = Math.max(0, Math.ceil((targetEndRef.current - Date.now()) / 1000));
        setRemainingSeconds(remaining);
        if (remaining <= 0) {
          triggerTimeZero();
        }
      }
    }, 500);

    return () => clearInterval(interval);
  }, [isRunning, triggerTimeZero]);

  // --- Wall-clock sync on tab visibility change ---
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && targetEndRef.current) {
        const remaining = Math.max(0, Math.ceil((targetEndRef.current - Date.now()) / 1000));
        setRemainingSeconds(remaining);
        if (remaining <= 0) {
          triggerTimeZero();
        }
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [triggerTimeZero]);

  const formattedRemaining = useMemo(() => {
    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, [remainingSeconds]);

  return {
    remainingSeconds,
    totalSeconds,
    isRunning,
    isPromptOpen,
    showPrompt: isPromptOpen,
    presetMinutes,
    intervalMinutes: presetMinutes,
    startTimer,
    startTest10s,
    triggerTest10Sec: startTest10s,
    pauseTimer,
    resumeTimer,
    resetTimer,
    snooze,
    dismissPrompt,
    onTriggerBreak,
    formattedRemaining,
  };
}
