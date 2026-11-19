import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Exercise, ExerciseCategory, ActiveWorkoutBackup, isExerciseBilateral, getCleanQuickSteps } from '../types/fitness';
import { canMarkExercise, PAIN_MESSAGE } from '../utils/loadProgression';
import { BiomechanicalVisualizer } from './BiomechanicalVisualizer';
import { useWorkoutTimer } from '../hooks/useWorkoutTimer';
import { soundEngine } from '../utils/soundEngine';
import confetti from 'canvas-confetti';
import {
  X,
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  ShieldAlert,
  Volume2,
  VolumeX,
  Plus,
  Minus,
  Award,
  FastForward,
  Clock,
  ChevronDown,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Dumbbell,
  Info,
  Check,
  Zap,
  ArrowLeft,
} from 'lucide-react';

interface ActiveWorkoutModalProps {
  title: string;
  category: ExerciseCategory;
  exercises: Exercise[];
  slotIdToComplete?: string;
  soundEnabled: boolean;
  initialBackup?: ActiveWorkoutBackup | null;
  userWeightKg?: number;
  onToggleSound: () => void;
  onClose: () => void;
  onCompleteSession: (payload: {
    durationSeconds: number;
    exercisesCompleted: number;
    exercisesTotal: number;
    kcalBurned: number;
    backComfort: 'great' | 'normal' | 'tired';
    effort?: 1 | 2 | 3 | 4 | 5;
    pain?: boolean;
    effortNote?: string;
    exerciseEfforts?: { exerciseId: string; effort: 1 | 2 | 3 | 4 | 5 }[];
    walkingSteps?: number;
    distanceKm?: number;
  }) => void;
}

type WorkoutPhase = 'ready' | 'prep_countdown' | 'work' | 'rest_set' | 'transition_next' | 'finished';

const ACTIVE_BACKUP_STORAGE_KEY = 'titan_active_workout_backup';

function getQuickTags(exercise: Exercise): { label: string; icon: string }[] {
  if (exercise.quickTags && exercise.quickTags.length > 0) {
    return exercise.quickTags.map((t) => ({ label: t, icon: '⚡' }));
  }

  const tags: { label: string; icon: string }[] = [];

  if (exercise.id.includes('pandiculation') || exercise.id.includes('glute-bridge') || exercise.id.includes('curlup') || exercise.id.includes('dead-bug')) {
    tags.push({ label: 'Лёжа на спине', icon: '🛏️' });
  } else if (exercise.id.includes('cat-cow') || exercise.id.includes('birddog') || exercise.id.includes('needle') || exercise.id.includes('child-pose')) {
    tags.push({ label: 'На четвереньках / Коврик', icon: '🧘' });
  } else if (exercise.id.includes('seated') || exercise.id.includes('desk') || exercise.id.includes('chair')) {
    tags.push({ label: 'Сидя / У стола', icon: '🪑' });
  } else if (exercise.id.includes('standing') || exercise.id.includes('swing') || exercise.id.includes('squat') || exercise.id.includes('deadlift')) {
    tags.push({ label: 'Стоя на ногах', icon: '🧍' });
  }

  if (exercise.equipment.includes('kb16') || exercise.equipment.includes('kb24')) {
    tags.push({ label: exercise.recommendedWeight || 'С гирей', icon: '🏋️' });
  } else if (exercise.equipment.includes('bands')) {
    tags.push({ label: 'С фитнес-резинкой', icon: '🎗️' });
  } else {
    tags.push({ label: 'Без инвентаря', icon: '✨' });
  }

  tags.push({ label: 'Ровное дыхание', icon: '🌬️' });
  return tags;
}

export const ActiveWorkoutModal: React.FC<ActiveWorkoutModalProps> = ({
  title,
  category,
  exercises,
  slotIdToComplete,
  soundEnabled,
  initialBackup,
  userWeightKg = 110,
  onToggleSound,
  onClose,
  onCompleteSession,
}) => {
  // Restore or default states (if interrupted during 3-2-1 prep countdown, safely return to ready screen)
  const [currentIndex, setCurrentIndex] = useState<number>(() => initialBackup?.currentIndex ?? 0);
  const [currentSet, setCurrentSet] = useState<number>(() => initialBackup?.currentSet ?? 1);
  const [phase, setPhase] = useState<WorkoutPhase>(() =>
    initialBackup?.phase && initialBackup.phase !== 'prep_countdown' ? initialBackup.phase : 'ready'
  );
  const [prepSecondsLeft, setPrepSecondsLeft] = useState<number>(3);
  const [completedCount, setCompletedCount] = useState<number>(() => initialBackup?.completedCount ?? 0);
  const [repCounter, setRepCounter] = useState<number>(() => {
    if (initialBackup?.repCounter) return initialBackup.repCounter;
    const ex = exercises[0];
    const match = ex?.defaultReps?.match(/\d+/);
    return match ? parseInt(match[0], 10) : 10;
  });
  const [backComfort, setBackComfort] = useState<'great' | 'normal' | 'tired'>('great');
  const [pain, setPain] = useState(false);
  const [effortNote, setEffortNote] = useState('');
  const [perEffort, setPerEffort] = useState<Record<string, 1 | 2 | 3 | 4 | 5>>({});
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const [autoResumeNotice, setAutoResumeNotice] = useState(false);
  const wasRunningBeforeSheetRef = useRef(false);
  const autoResumeNoticeTimeoutRef = useRef<number | null>(null);
  const [selectedWalkingSpeed, setSelectedWalkingSpeed] = useState<number>(() => initialBackup?.selectedWalkingSpeed ?? 5.0);
  const [accumulatedWalkingSteps, setAccumulatedWalkingSteps] = useState<number>(() => initialBackup?.accumulatedWalkingSteps ?? 0);
  const [accumulatedWalkingKcal, setAccumulatedWalkingKcal] = useState<number>(() => initialBackup?.accumulatedWalkingKcal ?? 0);
  const [segmentStartElapsed, setSegmentStartElapsed] = useState<number>(0);

  const safeWeightKg = useMemo(() => {
    return typeof userWeightKg === 'number' && !isNaN(userWeightKg) && userWeightKg >= 30 && userWeightKg <= 300
      ? userWeightKg
      : 110;
  }, [userWeightKg]);

  const currentExercise = exercises[currentIndex];
  const nextExercise = exercises[currentIndex + 1];
  const totalSetsForCurrent = category === 'kettlebell' ? currentExercise?.defaultSets || 3 : 1;
  const defaultTransitionSeconds = category === 'morning' ? 15 : category === 'breaks' ? 10 : 30;

  // Determine exercise tracking mode (reps vs duration)
  const isRepsMode = useMemo(() => {
    if (!currentExercise) return false;
    if (currentExercise.trackingMode === 'reps') return true;
    if (currentExercise.trackingMode === 'duration') return false;
    return Boolean(
      currentExercise.defaultReps && (
        currentExercise.category === 'kettlebell' ||
        currentExercise.defaultReps.toLowerCase().includes('повтор') ||
        currentExercise.defaultReps.toLowerCase().includes('мах')
      )
    );
  }, [currentExercise]);

  // Handle timer reaching zero
  const handleTimerZero = useCallback(() => {
    if (!currentExercise) return;

    if (phase === 'work') {
      if (currentSet < totalSetsForCurrent) {
        // Rest between sets of same exercise
        setPhase('rest_set');
        timer.startTimer(currentExercise.restSeconds || 30);
      } else {
        // Last set finished
        setCompletedCount((c) => c + 1);
        if (currentIndex + 1 < exercises.length) {
          setPhase('transition_next');
          timer.startTimer(defaultTransitionSeconds);
        } else {
          finishWorkout();
        }
      }
    } else if (phase === 'rest_set') {
      // Rest between sets expired -> start next set
      setCurrentSet((s) => s + 1);
      setPhase('work');
      if (isRepsMode) {
        timer.startStopwatch();
      } else {
        timer.startTimer(currentExercise.defaultSeconds);
      }
      if (soundEnabled) {
        soundEngine.playStartBell();
      }
    } else if (phase === 'transition_next') {
      // Transition pause expired -> automatically start next exercise!
      startNextExerciseWork();
    }
  }, [currentExercise, phase, currentSet, totalSetsForCurrent, currentIndex, exercises.length, isRepsMode, defaultTransitionSeconds, soundEnabled]);

  const isBilateral = useMemo(() => {
    return currentExercise ? isExerciseBilateral(currentExercise) : false;
  }, [currentExercise]);

  const sideSwitchFiredRef = useRef(false);

  useEffect(() => {
    sideSwitchFiredRef.current = false;
  }, [currentIndex, currentSet, phase]);

  // Hook timer
  const timer = useWorkoutTimer({
    soundEnabled,
    onTick: (left) => {
      // Bilateral equator switch
      if (
        phase === 'work' &&
        !isRepsMode &&
        currentExercise &&
        isExerciseBilateral(currentExercise)
      ) {
        const equator = Math.floor(currentExercise.defaultSeconds / 2);
        if (left <= equator && !sideSwitchFiredRef.current) {
          sideSwitchFiredRef.current = true;
          if (soundEnabled) {
            soundEngine.playSideSwitchBell();
          }
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            try {
              navigator.vibrate([150, 80, 150]);
            } catch {
              // ignore
            }
          }
        }
      }

      if (left <= 4 && left > 1 && soundEnabled) {
        soundEngine.playCountdownTick();
      }
      if (left === 1 && soundEnabled) {
        soundEngine.playStartBell();
      }
    },
    onTimeZero: handleTimerZero,
  });

  // Walking metrics calculation
  const isWalkingExercise = currentExercise?.category === 'walking';

  useEffect(() => {
    setSegmentStartElapsed(0);
    if (currentExercise?.targetSpeedKmh) {
      const match = currentExercise.targetSpeedKmh.match(/(\d+(?:\.\d+)?)/);
      if (match) {
        setSelectedWalkingSpeed(parseFloat(match[1]));
      }
    }
  }, [currentIndex]);

  const walkingCadence = useMemo(() => {
    if (selectedWalkingSpeed >= 6.0) return 134;
    if (selectedWalkingSpeed >= 5.5) return 128;
    if (selectedWalkingSpeed >= 5.0) return 122;
    if (selectedWalkingSpeed >= 4.5) return 112;
    return 105;
  }, [selectedWalkingSpeed]);

  const liveWalkingMet = useMemo(() => {
    if (selectedWalkingSpeed >= 6.0) return 5.2;
    if (selectedWalkingSpeed >= 5.5) return 4.6;
    if (selectedWalkingSpeed >= 5.0) return 4.0;
    if (selectedWalkingSpeed >= 4.5) return 3.4;
    return 3.0;
  }, [selectedWalkingSpeed]);

  const currentWalkElapsed = useMemo(() => {
    if (!isWalkingExercise || !currentExercise) return 0;
    return Math.max(0, currentExercise.defaultSeconds - timer.secondsLeft);
  }, [isWalkingExercise, currentExercise, timer.secondsLeft]);

  // Integral speed step accumulation
  const liveSegmentElapsed = Math.max(0, currentWalkElapsed - segmentStartElapsed);
  const liveSegmentSteps = Math.round((liveSegmentElapsed / 60) * walkingCadence);
  const liveSegmentKcal = Math.round(liveWalkingMet * safeWeightKg * (liveSegmentElapsed / 3600));

  const totalCalculatedSteps = accumulatedWalkingSteps + liveSegmentSteps;
  const totalCalculatedKcal = accumulatedWalkingKcal + liveSegmentKcal;
  const totalCalculatedDistanceKm = Math.round(((totalCalculatedSteps * 0.72) / 1000) * 100) / 100;

  const changeWalkingSpeed = useCallback(
    (newSpeed: number) => {
      const clamped = Math.min(6.5, Math.max(3.5, Math.round(newSpeed * 10) / 10));
      if (clamped === selectedWalkingSpeed) return;
      const segElapsed = Math.max(0, currentWalkElapsed - segmentStartElapsed);
      const segSteps = Math.round((segElapsed / 60) * walkingCadence);
      const segKcal = Math.round(liveWalkingMet * safeWeightKg * (segElapsed / 3600));

      setAccumulatedWalkingSteps((prev) => prev + segSteps);
      setAccumulatedWalkingKcal((prev) => prev + segKcal);
      setSegmentStartElapsed(currentWalkElapsed);
      setSelectedWalkingSpeed(clamped);
    },
    [selectedWalkingSpeed, currentWalkElapsed, segmentStartElapsed, walkingCadence, liveWalkingMet, safeWeightKg]
  );

  // Restore initial backup if provided
  useEffect(() => {
    if (initialBackup) {
      timer.restoreTimer({
        secondsLeft: initialBackup.secondsLeft,
        targetEndTimestamp: initialBackup.targetEndTimestamp,
        elapsedTotalSeconds: initialBackup.elapsedTotalSeconds,
        isRunning: Boolean(initialBackup.targetEndTimestamp),
      });
    } else if (exercises[0]) {
      timer.setSecondsLeft(exercises[0].defaultSeconds);
    }
  }, []);

  // Sync rep counter when exercise changes
  useEffect(() => {
    if (!currentExercise) return;
    const match = currentExercise.defaultReps?.match(/\d+/);
    if (match) {
      setRepCounter(parseInt(match[0], 10));
    }
    setIsBottomSheetOpen(false);
  }, [currentIndex]);

  // Persistence snapshot to localStorage
  useEffect(() => {
    if (phase === 'finished') {
      try {
        localStorage.removeItem(ACTIVE_BACKUP_STORAGE_KEY);
      } catch {
        // ignore
      }
      return;
    }

    const backup: ActiveWorkoutBackup = {
      activeSession: {
        title,
        category,
        exercises,
        slotIdToComplete,
      },
      currentIndex,
      currentSet,
      phase,
      secondsLeft: timer.secondsLeft,
      targetEndTimestamp: timer.targetEndTimestamp,
      elapsedTotalSeconds: timer.elapsedTotalSeconds,
      completedCount,
      repCounter,
      selectedWalkingSpeed,
      accumulatedWalkingSteps: totalCalculatedSteps,
      accumulatedWalkingKcal: totalCalculatedKcal,
      timestamp: Date.now(),
    };

    try {
      localStorage.setItem(ACTIVE_BACKUP_STORAGE_KEY, JSON.stringify(backup));
    } catch {
      // ignore
    }
  }, [
    title,
    category,
    exercises,
    slotIdToComplete,
    currentIndex,
    currentSet,
    phase,
    timer.secondsLeft,
    timer.targetEndTimestamp,
    timer.elapsedTotalSeconds,
    completedCount,
    repCounter,
    selectedWalkingSpeed,
    totalCalculatedSteps,
    totalCalculatedKcal,
  ]);

  // Start next exercise in active work
  const startNextExerciseWork = useCallback(() => {
    if (isWalkingExercise) {
      setAccumulatedWalkingSteps((prev) => prev + liveSegmentSteps);
      setAccumulatedWalkingKcal((prev) => prev + liveSegmentKcal);
      setSegmentStartElapsed(0);
    }
    if (currentIndex + 1 < exercises.length) {
      const nextIdx = currentIndex + 1;
      const nextEx = exercises[nextIdx];
      setCurrentIndex(nextIdx);
      setCurrentSet(1);
      setPhase('work');

      const nextIsReps = nextEx.trackingMode === 'reps' || (!nextEx.trackingMode && Boolean(
        nextEx.defaultReps && (
          nextEx.category === 'kettlebell' ||
          nextEx.defaultReps.toLowerCase().includes('повтор') ||
          nextEx.defaultReps.toLowerCase().includes('мах')
        )
      ));

      if (nextIsReps) {
        timer.startStopwatch();
      } else {
        timer.startTimer(nextEx.defaultSeconds);
      }

      setIsBottomSheetOpen(false);
      if (soundEnabled) {
        soundEngine.playStartBell();
      }
    } else {
      finishWorkout();
    }
  }, [currentIndex, exercises, soundEnabled, timer, isWalkingExercise, liveSegmentSteps, liveSegmentKcal]);

  // User starts workout immediately (without 3-2-1 countdown)
  const handleStartWorkImmediate = useCallback(() => {
    soundEngine.unlockAudio();
    setPhase('work');
    if (isRepsMode) {
      timer.startStopwatch();
    } else {
      timer.startTimer(currentExercise.defaultSeconds);
    }
    if (soundEnabled) {
      soundEngine.playStartBell();
    }
  }, [currentExercise, isRepsMode, soundEnabled, timer]);

  const startWorkRef = useRef(handleStartWorkImmediate);
  startWorkRef.current = handleStartWorkImmediate;

  // User clicks "Я готов, поехали!" -> 3-2-1-Gong prep countdown
  const handleStartPrepCountdown = useCallback(() => {
    soundEngine.unlockAudio();
    setPrepSecondsLeft(3);
    setPhase('prep_countdown');
    if (soundEnabled) {
      soundEngine.playCountdownTick();
    }
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(50);
      } catch {
        // ignore
      }
    }
  }, [soundEnabled]);

  const handleCancelPrepCountdown = useCallback(() => {
    setPhase('ready');
    setPrepSecondsLeft(3);
  }, []);

  // 3-2-1 countdown effect before starting exercise 1
  useEffect(() => {
    if (phase !== 'prep_countdown') return;

    const targetEnd = Date.now() + 3000;
    let lastShownSecond = 3;

    const intervalId = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((targetEnd - Date.now()) / 1000));
      if (remaining > 0 && remaining !== lastShownSecond) {
        lastShownSecond = remaining;
        setPrepSecondsLeft(remaining);
        if (soundEnabled) {
          soundEngine.playCountdownTick();
        }
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate(50);
          } catch {
            // ignore
          }
        }
      } else if (remaining <= 0) {
        window.clearInterval(intervalId);
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate([120, 60, 160]);
          } catch {
            // ignore
          }
        }
        startWorkRef.current();
      }
    }, 100);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [phase, soundEnabled]);

  // Clean up auto-resume banner timer on unmount
  useEffect(() => {
    return () => {
      if (autoResumeNoticeTimeoutRef.current) {
        window.clearTimeout(autoResumeNoticeTimeoutRef.current);
      }
    };
  }, []);

  // Explicit completion of a Reps Set (Thumb button)
  const handleCompleteRepsSet = useCallback(() => {
    if (soundEnabled) {
      soundEngine.playStartBell();
    }

    if (currentSet < totalSetsForCurrent) {
      // Enter rest between sets of same exercise
      setPhase('rest_set');
      timer.startTimer(currentExercise.restSeconds || 30);
    } else {
      // Exercise completed
      setCompletedCount((c) => c + 1);
      if (currentIndex + 1 < exercises.length) {
        setPhase('transition_next');
        timer.startTimer(defaultTransitionSeconds);
      } else {
        finishWorkout();
      }
    }
  }, [soundEnabled, currentSet, totalSetsForCurrent, currentExercise, currentIndex, exercises.length, defaultTransitionSeconds, timer]);

  const finishWorkout = useCallback(() => {
    setPhase('finished');
    timer.pauseTimer();
    try {
      localStorage.removeItem(ACTIVE_BACKUP_STORAGE_KEY);
    } catch {
      // ignore
    }
    if (soundEnabled) {
      soundEngine.playVictoryFanfare();
    }
    try {
      confetti({
        particleCount: 110,
        spread: 80,
        origin: { y: 0.6 },
      });
    } catch {
      // ignore
    }
  }, [soundEnabled, timer]);

  // Manual skip
  const handleManualSkip = useCallback(() => {
    if (phase === 'transition_next') {
      startNextExerciseWork();
    } else if (phase === 'ready' || phase === 'prep_countdown') {
      handleStartWorkImmediate();
    } else if (phase === 'rest_set') {
      setCurrentSet((s) => s + 1);
      setPhase('work');
      if (isRepsMode) {
        timer.startStopwatch();
      } else {
        timer.startTimer(currentExercise.defaultSeconds);
      }
    } else {
      // Skipping active set
      setCompletedCount((c) => c + 1);
      if (currentIndex + 1 < exercises.length) {
        setPhase('transition_next');
        timer.startTimer(defaultTransitionSeconds);
      } else {
        finishWorkout();
      }
    }
  }, [phase, startNextExerciseWork, handleStartWorkImmediate, isRepsMode, currentExercise, currentIndex, exercises.length, defaultTransitionSeconds, timer, finishWorkout]);

  // Open Bottom Sheet (Auto-pause if timer is running and remember state)
  const handleOpenBottomSheet = () => {
    wasRunningBeforeSheetRef.current = timer.isRunning;
    if (timer.isRunning) {
      timer.pauseTimer();
    }
    setIsBottomSheetOpen(true);
  };

  // Close Bottom Sheet (Auto-resume with soft tick if timer was running before opening)
  const handleCloseBottomSheet = useCallback(() => {
    setIsBottomSheetOpen(false);
    if (wasRunningBeforeSheetRef.current) {
      wasRunningBeforeSheetRef.current = false;
      if (phase === 'work' || phase === 'rest_set' || phase === 'transition_next') {
        timer.resumeTimer();
        if (soundEnabled) {
          soundEngine.playCountdownTick();
        }
        setAutoResumeNotice(true);
        if (autoResumeNoticeTimeoutRef.current) {
          window.clearTimeout(autoResumeNoticeTimeoutRef.current);
        }
        autoResumeNoticeTimeoutRef.current = window.setTimeout(() => {
          setAutoResumeNotice(false);
        }, 2500);
      }
    }
  }, [phase, soundEnabled, timer]);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (phase === 'ready') {
          handleStartPrepCountdown();
        } else if (phase === 'prep_countdown') {
          handleStartWorkImmediate();
        } else if (phase === 'work') {
          if (isRepsMode) {
            handleCompleteRepsSet();
          } else {
            timer.toggleRunning();
          }
        } else if (phase === 'transition_next') {
          startNextExerciseWork();
        }
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleManualSkip();
      } else if (e.code === 'Escape') {
        if (isBottomSheetOpen) {
          handleCloseBottomSheet();
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase, isRepsMode, isBottomSheetOpen, handleStartPrepCountdown, handleStartWorkImmediate, handleCompleteRepsSet, timer, startNextExerciseWork, handleManualSkip, handleCloseBottomSheet, onClose]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const totalKcal = exercises
    .slice(0, Math.max(1, completedCount))
    .reduce((acc, e) => acc + e.kcalEstimate * (category === 'kettlebell' ? e.defaultSets : 1), 0);

  if (!currentExercise) return null;

  const quickSteps = getCleanQuickSteps(currentExercise);
  const quickTags = getQuickTags(currentExercise);

  return (
    <div className="fixed inset-0 z-50 bg-[#060911]/95 backdrop-blur-xl flex flex-col overflow-y-auto">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-800/80 bg-[#090D16]/95 backdrop-blur-md">
        <div className="min-w-0 flex-1">
          <span
            className={`text-[11px] font-extrabold uppercase tracking-wider block ${
              phase === 'work' && !isRepsMode && !timer.isRunning
                ? 'text-amber-300'
                : 'text-amber-400'
            }`}
          >
            {phase === 'transition_next'
              ? 'Пауза и смена положения'
              : phase === 'rest_set'
              ? 'Отдых между подходами'
              : phase === 'ready'
              ? `Упражнение ${currentIndex + 1} из ${exercises.length} • Подготовка`
              : phase === 'prep_countdown'
              ? `Упражнение ${currentIndex + 1} из ${exercises.length} • Старт через ${prepSecondsLeft}`
              : phase === 'work' && !isRepsMode && !timer.isRunning
              ? `⏸ ПАУЗА — ВРЕМЯ НЕ ИДЁТ`
              : `Упражнение ${currentIndex + 1} из ${exercises.length} • В работе`}
          </span>
          <h2 className="text-sm sm:text-base font-extrabold text-white leading-tight">
            {title}
          </h2>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggleSound}
            className="p-2 rounded-xl bg-slate-800/90 text-slate-300 hover:text-white transition cursor-pointer"
            title={soundEnabled ? 'Выключить звук' : 'Включить звук'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800/90 text-slate-300 hover:text-white transition cursor-pointer"
            title="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 1. FINISHED SUMMARY SCREEN                               */}
      {/* ======================================================== */}
      {phase === 'finished' && (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900/90 border border-amber-500/30 rounded-3xl p-6 text-center space-y-6 shadow-2xl animate-fadeIn">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-tr from-amber-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Award className="w-9 h-9 text-slate-950" />
            </div>

            <div className="space-y-1">
              <h3 className="text-2xl font-black text-white">Тренировка Завершена!</h3>
              <p className="text-xs text-slate-300">
                Прекрасная работа по декомпрессии спины и набору силы.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-slate-950 border border-slate-800">
              <div>
                <div className="text-[10px] text-slate-400">Время</div>
                <div className="text-base font-black text-white">{formatTime(timer.elapsedTotalSeconds)}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">Выполнено</div>
                <div className="text-base font-black text-emerald-400">
                  {completedCount}/{exercises.length}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">Расход</div>
                <div className="text-base font-black text-amber-400">~{totalKcal} ккал</div>
              </div>
            </div>

            {/* Back Comfort Rating */}
            <div className="space-y-2 text-left">
              <label className="text-xs font-bold text-slate-300">Ощущения в пояснице после тренировки:</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'great', label: 'Отлично', icon: '🟢' },
                  { id: 'normal', label: 'Норма', icon: '🟡' },
                  { id: 'tired', label: 'Устала', icon: '🟠' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setBackComfort(item.id as any)}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center gap-1 cursor-pointer ${
                      backComfort === item.id
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {totalCalculatedSteps > 0 && (
              <div className="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 flex items-center justify-around text-center">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Шаги на дорожке</span>
                  <span className="text-base font-black text-emerald-400">🚶 {totalCalculatedSteps}</span>
                </div>
                <div className="w-px h-8 bg-slate-800" />
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Дистанция</span>
                  <span className="text-base font-black text-cyan-400">📏 {totalCalculatedDistanceKm} км</span>
                </div>
              </div>
            )}

            <div className="space-y-2 text-left">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-white">Насколько было тяжело?</span>
                <button
                  type="button"
                  aria-pressed={pain}
                  onClick={() => setPain((value) => !value)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                    pain ? 'bg-rose-500/20 border-rose-400 text-rose-200' : 'bg-slate-950 border-slate-700 text-slate-300'
                  }`}
                >
                  {pain ? 'Боль есть' : 'Без боли'}
                </button>
              </div>
              {pain && <p className="text-xs text-rose-200">{PAIN_MESSAGE}</p>}
              <p className="text-xs text-slate-400">1 слишком легко · 3 в самый раз · 5 слишком тяжело</p>
              <div className="grid grid-cols-5 gap-1.5">
                {([1, 2, 3, 4, 5] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-label={`Оценка ${value}`}
                    onClick={() => {
                      onCompleteSession({
                        durationSeconds: timer.elapsedTotalSeconds,
                        exercisesCompleted: completedCount,
                        exercisesTotal: exercises.length,
                        kcalBurned: totalKcal,
                        backComfort,
                        effort: value,
                        pain,
                        effortNote: effortNote.trim() || undefined,
                        exerciseEfforts: Object.entries(perEffort).map(([exerciseId, effort]) => ({ exerciseId, effort })),
                        walkingSteps: totalCalculatedSteps > 0 ? totalCalculatedSteps : undefined,
                        distanceKm: totalCalculatedDistanceKm > 0 ? totalCalculatedDistanceKm : undefined,
                      });
                      onClose();
                    }}
                    className="py-3 rounded-xl bg-amber-400 text-slate-950 font-black text-lg"
                  >
                    {value}
                  </button>
                ))}
              </div>
              <input
                value={effortNote}
                onChange={(event) => setEffortNote(event.target.value.slice(0, 140))}
                placeholder="Заметка, если нужно"
                className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white"
              />
              {exercises.some(canMarkExercise) && (
                <details className="text-xs text-slate-300">
                  <summary className="cursor-pointer font-bold text-slate-200">По упражнениям, если одно выбилось</summary>
                  <div className="mt-2 space-y-1.5">
                    {exercises.filter(canMarkExercise).map((exercise) => (
                      <div key={exercise.id} className="flex items-center justify-between gap-2">
                        <span className="truncate">{exercise.titleRu}</span>
                        <span className="flex gap-1 shrink-0">
                          {([
                            [2, 'Легко'],
                            [5, 'Тяжело'],
                          ] as const).map(([value, label]) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() =>
                                setPerEffort((current) => {
                                  const next = { ...current };
                                  if (next[exercise.id] === value) delete next[exercise.id];
                                  else next[exercise.id] = value;
                                  return next;
                                })
                              }
                              className={`px-2 py-1 rounded-lg border ${
                                perEffort[exercise.id] === value
                                  ? 'border-amber-400 text-amber-200'
                                  : 'border-slate-700 text-slate-400'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. TRANSITION & REST SCREENS (WITH QUICK +/- BUTTONS)    */}
      {/* ======================================================== */}
      {(phase === 'transition_next' || phase === 'rest_set') && (
        <div className="flex-1 flex flex-col p-3.5 sm:p-4 max-w-xl mx-auto w-full space-y-3 animate-fadeIn">
          {/* Compact Pause Timer Box (Shifts to explicit Amber/Rose when paused) */}
          <div
            className={`p-3.5 sm:p-4 rounded-3xl text-center w-full space-y-2.5 shadow-xl transition-colors ${
              timer.isRunning
                ? 'bg-slate-900/90 border border-cyan-500/40'
                : 'bg-rose-950/80 border-2 border-amber-400 shadow-rose-500/20'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              {timer.isRunning ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-300 text-[11px] font-bold uppercase tracking-wider">
                  <Clock className="w-3.5 h-3.5" />
                  {phase === 'rest_set' ? 'Отдых между подходами' : 'Пауза и смена позы'}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400 text-slate-950 text-[11px] font-black uppercase tracking-wider animate-pulse">
                  ⏸ ПАУЗА — ВРЕМЯ НЕ ИДЁТ
                </span>
              )}

              <div
                className={`text-3xl sm:text-4xl font-mono font-black ${
                  timer.isRunning ? 'text-cyan-300' : 'text-amber-300'
                }`}
              >
                00:{String(timer.secondsLeft).padStart(2, '0')}
              </div>
            </div>

            {!timer.isRunning && (
              <button
                type="button"
                onClick={timer.toggleRunning}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 font-black text-sm shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 animate-pulse cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Продолжить отсчёт</span>
              </button>
            )}

            {/* Quick Rest Adjustments: [-15с] [⏸/▶] [+15с] [Пропустить] */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => timer.adjustSeconds(-15)}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1 cursor-pointer min-h-[40px]"
                title="Убавить 15 секунд"
              >
                <Minus className="w-3.5 h-3.5" /> 15с
              </button>

              <button
                type="button"
                onClick={timer.toggleRunning}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold transition flex items-center gap-1 cursor-pointer min-h-[40px]"
                title={timer.isRunning ? 'Пауза' : 'Продолжить'}
              >
                {timer.isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                <span>{timer.isRunning ? 'Пауза' : 'Пуск'}</span>
              </button>

              <button
                type="button"
                onClick={() => timer.adjustSeconds(15)}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1 cursor-pointer min-h-[40px]"
                title="Добавить 15 секунд"
              >
                <Plus className="w-3.5 h-3.5" /> 15с
              </button>

              <button
                type="button"
                onClick={handleManualSkip}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black transition flex items-center gap-1.5 shadow cursor-pointer min-h-[40px]"
              >
                <span>Начать следующее</span>
                <FastForward className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Station Transition Safety Alert */}
          {phase === 'transition_next' && currentExercise?.category === 'walking' && nextExercise?.category !== 'walking' && (
            <div className="w-full rounded-3xl bg-amber-950/70 border-2 border-amber-500/80 p-3.5 space-y-1 shadow-xl text-left animate-fadeIn">
              <div className="flex items-center gap-2 text-amber-300 font-black text-xs uppercase tracking-wide">
                <span className="text-base">🛑</span>
                <span>Безопасная смена станции: Плавно остановите дорожку</span>
              </div>
              <p className="text-xs text-amber-100/90 leading-relaxed font-semibold">
                Нажмите «Стоп» на пульте Walking Pad, дождитесь полной остановки полотна и спокойно сойдите на коврик к снаряду.
              </p>
            </div>
          )}

          {phase === 'transition_next' && currentExercise?.category !== 'walking' && nextExercise?.category === 'walking' && (
            <div className="w-full rounded-3xl bg-emerald-950/70 border-2 border-emerald-500/80 p-3.5 space-y-1 shadow-xl text-left animate-fadeIn">
              <div className="flex items-center gap-2 text-emerald-300 font-black text-xs uppercase tracking-wide">
                <span className="text-base">🚶</span>
                <span>Переход на дорожку Walking Pad</span>
              </div>
              <p className="text-xs text-emerald-100/90 leading-relaxed font-semibold">
                Поставьте гирю на устойчивую поверхность, встаньте на полотно дорожки и включите стартовую скорость 4.0–4.5 км/ч.
              </p>
            </div>
          )}

          {/* Immediately visible Next Exercise Preview during transition_next */}
          {phase === 'transition_next' && nextExercise && (
            <div className="w-full rounded-3xl bg-slate-900/90 border border-slate-800 p-3.5 sm:p-4 space-y-3 shadow-lg">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-400">
                  Далее: Упражнение #{currentIndex + 2} из {exercises.length}
                </span>
                <span className="text-xs text-slate-300 font-bold shrink-0">
                  {nextExercise.defaultReps || `${nextExercise.defaultSeconds} сек`}
                </span>
              </div>

              <div>
                <h3 className="text-base sm:text-lg font-black text-white leading-snug">{nextExercise.titleRu}</h3>
              </div>

              <BiomechanicalVisualizer
                exerciseId={nextExercise.id}
                imageUrl={nextExercise.imageUrl}
                pose={nextExercise.pose}
                category={nextExercise.category}
                title={nextExercise.titleRu}
                muscleGroups={nextExercise.muscleGroups}
                secondaryMuscles={nextExercise.secondaryMuscles}
                compact={true}
              />

              {/* Full, Non-Truncated Movement Essence */}
              <div className="p-3 rounded-2xl bg-slate-950/85 border border-slate-800/80 space-y-1.5">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-400 block">
                  Суть следующего движения:
                </span>
                <ol className="space-y-1.5 text-sm text-slate-100">
                  {getCleanQuickSteps(nextExercise).map((step, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <span className="leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. READY STATE: INITIAL PREP BEFORE WORKOUT START        */}
      {/* ======================================================== */}
      {phase === 'ready' && (
        <div className="flex-1 flex flex-col justify-between max-w-xl mx-auto w-full animate-fadeIn">
          <div className="p-3.5 sm:p-4 space-y-3">
            <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/90 border border-slate-800/90 space-y-3.5 shadow-xl">
              {/* Top Badge & Duration */}
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Подготовка к 1-му упражнению
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs font-black text-white shrink-0">
                  {isRepsMode ? currentExercise.defaultReps : formatTime(timer.secondsLeft)}
                </span>
              </div>

              {/* Full Exercise Title */}
              <div>
                <h2 className="text-lg sm:text-2xl font-black text-white leading-snug">
                  {currentExercise.titleRu}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">{currentExercise.titleEn}</p>
              </div>

              {/* Visualizer Photo / Anatomical Map */}
              <BiomechanicalVisualizer
                exerciseId={currentExercise.id}
                imageUrl={currentExercise.imageUrl}
                pose={currentExercise.pose}
                category={currentExercise.category}
                title={currentExercise.titleRu}
                muscleGroups={currentExercise.muscleGroups}
                secondaryMuscles={currentExercise.secondaryMuscles}
                compact={true}
              />

              {/* Quick Action Tags */}
              <div className="flex flex-wrap gap-1.5">
                {quickTags.map((tag, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-semibold text-slate-300"
                  >
                    <span>{tag.icon}</span>
                    <span>{tag.label}</span>
                  </span>
                ))}
              </div>

              {/* Full, Readable Starting Position & Movement Cues (No truncation / line-clamp) */}
              <div className="p-3.5 rounded-2xl bg-slate-950/85 border border-slate-800/80 space-y-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-400 block">
                  Исходное положение и суть движения:
                </span>
                <ol className="space-y-2 text-sm sm:text-base text-slate-100">
                  {quickSteps.map((step, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <span className="leading-relaxed">
                        {i === 0 && (
                          <strong className="text-amber-300 font-bold">Старт: </strong>
                        )}
                        {step}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>

          {/* Sticky Bottom Thumb-Zone CTA Bar */}
          <div className="sticky bottom-0 z-20 bg-[#060911]/95 backdrop-blur-md border-t border-slate-800/80 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-2">
            <button
              type="button"
              onClick={handleStartPrepCountdown}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-base shadow-xl shadow-amber-500/30 flex items-center justify-center gap-2.5 transition transform active:scale-[0.99] cursor-pointer"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>Я готов, поехали!</span>
              <span className="px-2 py-0.5 rounded-lg bg-slate-950/20 text-xs font-extrabold">
                3–2–1
              </span>
            </button>

            <button
              type="button"
              onClick={handleStartWorkImmediate}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer min-h-[42px]"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Старт сразу без отсчёта</span>
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3.5. PREP COUNTDOWN STATE: 3 — 2 — 1 — GONG              */}
      {/* ======================================================== */}
      {phase === 'prep_countdown' && (
        <div className="flex-1 flex flex-col justify-between p-4 max-w-xl mx-auto w-full space-y-4 animate-fadeIn">
          <div className="space-y-4">
            {/* High-Contrast Floor-Readable Countdown */}
            <div className="p-6 rounded-3xl bg-gradient-to-b from-amber-950/60 to-slate-900/95 border-2 border-amber-500/60 text-center space-y-2 shadow-2xl shadow-amber-500/20">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-black uppercase tracking-wider">
                Займите исходное положение
              </span>
              <div
                key={prepSecondsLeft}
                className="text-7xl sm:text-8xl font-mono font-black text-amber-400 tracking-tight py-1 animate-pulse"
                aria-live="assertive"
              >
                {prepSecondsLeft}
              </div>
              <p className="text-xs sm:text-sm text-amber-100/90 font-semibold">
                После гонга начнётся отсчёт ({isRepsMode ? currentExercise.defaultReps : formatTime(currentExercise.defaultSeconds)})
              </p>
            </div>

            {/* Exercise Preview + Starting Position Reminder */}
            <div className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-3">
              <h3 className="text-base sm:text-lg font-black text-white leading-snug">
                {currentExercise.titleRu}
              </h3>

              <BiomechanicalVisualizer
                exerciseId={currentExercise.id}
                imageUrl={currentExercise.imageUrl}
                pose={currentExercise.pose}
                category={currentExercise.category}
                title={currentExercise.titleRu}
                muscleGroups={currentExercise.muscleGroups}
                secondaryMuscles={currentExercise.secondaryMuscles}
                compact={true}
              />

              {quickSteps[0] && (
                <div className="p-3 rounded-2xl bg-slate-950/90 border border-amber-500/30 text-sm sm:text-base text-slate-100 leading-relaxed">
                  <strong className="text-amber-400">Исходное положение: </strong>
                  {quickSteps[0]}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={handleCancelPrepCountdown}
              className="py-3.5 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Назад</span>
            </button>
            <button
              type="button"
              onClick={handleStartWorkImmediate}
              className="py-3.5 px-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Zap className="w-4 h-4" />
              <span>Начать сейчас</span>
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. ACTIVE WORK SCREEN (GLANCEABLE GYM UI)                */}
      {/* ======================================================== */}
      {phase === 'work' && (
        <div className="flex-1 p-3.5 sm:p-4 max-w-xl mx-auto w-full flex flex-col justify-between space-y-3.5 animate-fadeIn">
          <div className="space-y-3.5">
            {/* Auto-resume confirmation notice after closing Technique sheet */}
            {autoResumeNotice && (
              <div className="p-3 rounded-2xl bg-emerald-950/85 border border-emerald-400/60 text-emerald-200 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-lg animate-fadeIn">
                <Play className="w-4 h-4 fill-current text-emerald-400" />
                <span>Шторка закрыта — таймер автоматически продолжен!</span>
              </div>
            )}

            {/* High-Contrast Sticky Pause Status Bar whenever paused in duration mode */}
            {!isRepsMode && !timer.isRunning && !isBottomSheetOpen && (
              <div className="sticky top-[62px] z-20 px-3.5 py-2.5 rounded-2xl bg-rose-950/95 border-2 border-amber-400 shadow-2xl shadow-rose-500/30 flex items-center justify-between gap-2 animate-fadeIn">
                <div className="flex items-center gap-2 text-amber-300 font-black text-xs uppercase tracking-wide min-w-0">
                  <span className="text-base shrink-0">⏸</span>
                  <span className="leading-tight">Таймер на паузе</span>
                </div>
                <button
                  type="button"
                  onClick={timer.toggleRunning}
                  className="px-3 py-1.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-xs flex items-center gap-1 shadow shrink-0 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Старт</span>
                </button>
              </div>
            )}

            {/* Top Bar: Full Title (no truncate) & Set Counter */}
            <div className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-extrabold uppercase tracking-wider text-amber-400">
                  {currentExercise.category === 'kettlebell' ? 'Силовой сет' : 'Активная фаза'}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs font-black text-white">
                  {currentSet}/{totalSetsForCurrent}
                </span>
              </div>
              <h3 className="text-lg font-black text-white leading-snug">{currentExercise.titleRu}</h3>
            </div>

            {/* Visualizer (Photo or Anatomical Map) */}
            <BiomechanicalVisualizer
              exerciseId={currentExercise.id}
              imageUrl={currentExercise.imageUrl}
              pose={currentExercise.pose}
              category={currentExercise.category}
              title={currentExercise.titleRu}
              muscleGroups={currentExercise.muscleGroups}
              secondaryMuscles={currentExercise.secondaryMuscles}
              compact={true}
            />

            {/* ACTION BLOCK: Distinct REPS vs DURATION Mode */}
            {isRepsMode ? (
              // --- REPS MODE (No ticking countdown! Large Target + Stepper + Thumb Button) ---
              <div className="p-5 rounded-3xl bg-slate-900/90 border border-amber-500/30 text-center space-y-4 shadow-xl">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Цель на подход:
                  </span>
                  <div className="text-2xl font-black text-white leading-tight break-words px-1">
                    {currentExercise.defaultReps}
                  </div>
                  {isBilateral && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 mt-1 rounded-full bg-cyan-950/40 border border-cyan-500/30 text-cyan-300 text-xs font-bold">
                      <span>🔄</span>
                      <span>Двустороннее движение (повторите на обе стороны)</span>
                    </div>
                  )}
                </div>

                {/* Stepper Rep Counter & Subtle Stopwatch */}
                <div className="flex items-center justify-between px-3 py-2 rounded-2xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Счётчик:</span>
                    <button
                      type="button"
                      onClick={() => setRepCounter((c) => Math.max(1, c - 1))}
                      className="w-8 h-8 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 flex items-center justify-center font-bold cursor-pointer"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="font-mono font-black text-lg text-amber-400 w-8 text-center">
                      {repCounter}
                    </span>
                    <button
                      type="button"
                      onClick={() => setRepCounter((c) => c + 1)}
                      className="w-8 h-8 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 flex items-center justify-center font-bold cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">Под нагрузкой</span>
                    <span className="font-mono font-bold text-xs text-slate-300">
                      {formatTime(timer.workStopwatchSeconds)}
                    </span>
                  </div>
                </div>

                {/* HUGE THUMB-FRIENDLY BUTTON */}
                <button
                  type="button"
                  onClick={handleCompleteRepsSet}
                  className="w-full py-4.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-base sm:text-lg shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2.5 transition transform active:scale-[0.98] cursor-pointer"
                >
                  <Check className="w-6 h-6 stroke-[3]" />
                  <span>ПОДХОД ВЫПОЛНЕН ({repCounter} повт)</span>
                </button>
              </div>
            ) : (
              // --- DURATION MODE (Countdown Timer with Explicit Running vs Paused State) ---
              <div
                className={`p-4 sm:p-5 rounded-3xl text-center space-y-3 shadow-lg transition-colors ${
                  timer.isRunning
                    ? 'bg-slate-900/90 border border-slate-800'
                    : 'bg-rose-950/75 border-2 border-amber-400 shadow-2xl shadow-rose-500/25'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  {timer.isRunning ? (
                    <span className="text-emerald-400 font-extrabold flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                      ВРЕМЯ ИДЁТ
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-400 text-slate-950 font-black text-[11px] uppercase tracking-wider">
                      ⏸ ПАУЗА — ВРЕМЯ НЕ ИДЁТ
                    </span>
                  )}
                  <span className={`font-bold ${timer.isRunning ? 'text-slate-400' : 'text-amber-200'}`}>
                    Работа по таймеру
                  </span>
                </div>

                {/* Giant Timer Numbers */}
                <div
                  className={`text-5xl sm:text-6xl font-mono font-black tracking-tight ${
                    timer.isRunning ? 'text-white' : 'text-amber-300'
                  }`}
                >
                  {formatTime(timer.secondsLeft)}
                </div>

                {/* Prominent Pulsing Resume Button when Paused */}
                {!timer.isRunning && (
                  <button
                    type="button"
                    onClick={timer.toggleRunning}
                    className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 font-black text-sm sm:text-base shadow-xl shadow-emerald-500/30 flex items-center justify-center gap-2 animate-pulse cursor-pointer"
                  >
                    <Play className="w-5 h-5 fill-current" />
                    <span>Продолжить тренировку</span>
                  </button>
                )}

                {/* Walking Pad Speed Selector & Real-Time Stats */}
                {isWalkingExercise && (
                  <div className="p-3.5 sm:p-4 rounded-3xl bg-slate-950/95 border border-emerald-500/40 space-y-3 text-left shadow-2xl">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-black text-emerald-400 flex items-center gap-1.5">
                        <span className="text-base">🚶</span>
                        <span>Скорость полотна: {selectedWalkingSpeed.toFixed(1)} км/ч</span>
                      </span>
                      <span className="text-[11px] text-slate-400 font-bold">
                        {currentExercise.targetSpeedKmh ? `План: ${currentExercise.targetSpeedKmh}` : 'Зона 2'}
                      </span>
                    </div>

                    {/* Ergonomic Steppers + Quick Preset Chips (Thumb Zone friendly) */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => changeWalkingSpeed(selectedWalkingSpeed - 0.5)}
                        className="h-11 px-3 rounded-2xl bg-slate-900 border border-slate-700 text-slate-200 font-black text-xs sm:text-sm active:scale-95 transition flex items-center justify-center shrink-0 cursor-pointer hover:bg-slate-800"
                        aria-label="Уменьшить скорость на 0.5 км/ч"
                      >
                        – 0.5
                      </button>

                      <div className="flex-1 grid grid-cols-5 gap-1.5">
                        {[4.0, 4.5, 5.0, 5.5, 6.0].map((spd) => (
                          <button
                            key={spd}
                            type="button"
                            onClick={() => changeWalkingSpeed(spd)}
                            className={`h-11 rounded-2xl text-xs font-black transition cursor-pointer flex items-center justify-center ${
                              Math.abs(selectedWalkingSpeed - spd) < 0.05
                                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30 font-black scale-102'
                                : 'bg-slate-900/90 text-slate-400 border border-slate-800 hover:text-white'
                            }`}
                          >
                            {spd.toFixed(1)}
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => changeWalkingSpeed(selectedWalkingSpeed + 0.5)}
                        className="h-11 px-3 rounded-2xl bg-slate-900 border border-slate-700 text-slate-200 font-black text-xs sm:text-sm active:scale-95 transition flex items-center justify-center shrink-0 cursor-pointer hover:bg-slate-800"
                        aria-label="Увеличить скорость на 0.5 км/ч"
                      >
                        + 0.5
                      </button>
                    </div>

                    {/* Speed Safety Cue if >= 5.8 km/h */}
                    {selectedWalkingSpeed >= 5.8 && (
                      <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center gap-2 text-[11px] text-amber-300 font-bold">
                        <span>⚠️</span>
                        <span>Высокая скорость для компактной дорожки: контролируйте шаг и держите центр полотна!</span>
                      </div>
                    )}

                    {/* Live Walking Metrics Grid */}
                    <div className="grid grid-cols-4 gap-1.5 pt-1 border-t border-slate-800/80 text-center">
                      <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                        <div className="text-[9px] text-slate-400 uppercase font-bold">Шаги</div>
                        <div className="text-sm font-black text-white">{totalCalculatedSteps}</div>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                        <div className="text-[9px] text-slate-400 uppercase font-bold">Дистанция</div>
                        <div className="text-sm font-black text-emerald-400">{totalCalculatedDistanceKm} км</div>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                        <div className="text-[9px] text-slate-400 uppercase font-bold">Расход</div>
                        <div className="text-sm font-black text-amber-400">~{totalCalculatedKcal} ккал</div>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                        <div className="text-[9px] text-slate-400 uppercase font-bold">Каденс</div>
                        <div className="text-sm font-black text-cyan-400">{walkingCadence} /м</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Bilateral Split Badges */}
                {isBilateral && (
                  <div className="flex items-center justify-center gap-2 py-1">
                    <div
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                        timer.secondsLeft > Math.floor(currentExercise.defaultSeconds / 2)
                          ? 'bg-amber-500/25 text-amber-300 border border-amber-500/50 shadow-md shadow-amber-500/10 scale-105'
                          : 'bg-slate-800/60 text-slate-500 border border-slate-700/50 opacity-50'
                      }`}
                    >
                      <span>⬅️</span>
                      <span>СТОРОНА 1 (Левая / Первая)</span>
                    </div>
                    <div
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                        timer.secondsLeft <= Math.floor(currentExercise.defaultSeconds / 2)
                          ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/50 shadow-md shadow-emerald-500/10 scale-105 animate-pulse'
                          : 'bg-slate-800/60 text-slate-500 border border-slate-700/50 opacity-50'
                      }`}
                    >
                      <span>➡️</span>
                      <span>СТОРОНА 2 (Правая / Вторая)</span>
                    </div>
                  </div>
                )}

                {/* Controls */}
                <div className="flex items-center justify-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => timer.adjustSeconds(15)}
                    className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1 cursor-pointer min-h-[44px]"
                    title="Добавить 15 секунд"
                  >
                    <Plus className="w-3.5 h-3.5" /> 15с
                  </button>

                  {timer.isRunning && (
                    <button
                      type="button"
                      onClick={timer.toggleRunning}
                      className="p-4 rounded-2xl font-black shadow-lg transition cursor-pointer bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/25"
                      title="Пауза (Пробел)"
                      aria-label="Пауза"
                    >
                      <Pause className="w-6 h-6 fill-current" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleManualSkip}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer min-h-[44px]"
                    title="Завершить подход"
                  >
                    <span>Далее</span>
                    <SkipForward className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Full, Non-Truncated Quick Action Steps (Zero line-clamp / truncate) */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 block">
                Как выполнять (по шагам):
              </span>
              <div className="space-y-2 text-sm sm:text-base text-slate-100 font-medium">
                {quickSteps.map((step, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span className="leading-relaxed">{step}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom Button for Details Bottom Sheet */}
          <button
            type="button"
            onClick={handleOpenBottomSheet}
            className="w-full py-3 px-4 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-slate-300 hover:text-white flex items-center justify-center gap-2 transition cursor-pointer min-h-[46px]"
          >
            <Info className="w-4 h-4 text-cyan-400" />
            <span>ℹ️ Техника и защита спины</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. BOTTOM SHEET: FULL TECHNIQUE & SPINE SAFETY MODAL     */}
      {/* ======================================================== */}
      {isBottomSheetOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col justify-end">
          <div
            className="fixed inset-0"
            onClick={handleCloseBottomSheet}
          />
          <div className="relative z-10 w-full max-w-xl mx-auto bg-slate-900 border-t border-slate-700/80 rounded-t-3xl p-5 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto animate-slideUp">
            {/* Grab handle */}
            <div className="w-12 h-1.5 rounded-full bg-slate-700 mx-auto" />

            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">
                  Биомеханический гид
                </span>
                <h3 className="text-base sm:text-lg font-black text-white">{currentExercise.titleRu}</h3>
              </div>
              <button
                type="button"
                onClick={handleCloseBottomSheet}
                className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Spine Safety Callout */}
            <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-xs sm:text-sm text-emerald-200 leading-relaxed">
                <span className="font-bold text-emerald-400 uppercase tracking-wider block mb-0.5">
                  Защита нейтрали позвоночника:
                </span>
                {currentExercise.spineNote}
              </div>
            </div>

            {/* 4 Full Phases of Technique */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                Полная пошаговая техника (4 фазы):
              </span>
              <ol className="space-y-2 text-xs sm:text-sm text-slate-300">
                {currentExercise.steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Breathing */}
            <div className="p-3 rounded-2xl bg-cyan-950/30 border border-cyan-500/30 text-xs sm:text-sm text-cyan-200">
              <strong className="text-cyan-400">Паттерн дыхания: </strong>
              {currentExercise.breathing}
            </div>

            {/* Common Mistakes */}
            {currentExercise.commonMistakes && currentExercise.commonMistakes.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-rose-950/30 border border-rose-500/30 text-xs sm:text-sm text-rose-200 space-y-1.5">
                <span className="font-bold text-rose-400 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" /> Частые ошибки:
                </span>
                <ul className="list-disc list-inside space-y-1 text-slate-300 pl-1">
                  {currentExercise.commonMistakes.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </div>
            )}

            <button
              type="button"
              onClick={handleCloseBottomSheet}
              className={`w-full py-3.5 rounded-2xl font-black text-xs sm:text-sm transition cursor-pointer flex items-center justify-center gap-2 ${
                wasRunningBeforeSheetRef.current
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-lg'
                  : 'bg-slate-800 hover:bg-slate-700 text-white'
              }`}
            >
              {wasRunningBeforeSheetRef.current ? (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Вернуться и продолжить таймер</span>
                </>
              ) : (
                <span>Вернуться к упражнению</span>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
