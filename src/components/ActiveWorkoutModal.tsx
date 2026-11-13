import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Exercise, ExerciseCategory, ActiveWorkoutBackup, isExerciseBilateral } from '../types/fitness';
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
    walkingSteps?: number;
    distanceKm?: number;
  }) => void;
}

type WorkoutPhase = 'ready' | 'work' | 'rest_set' | 'transition_next' | 'finished';

const ACTIVE_BACKUP_STORAGE_KEY = 'titan_active_workout_backup';

// Extract max 2-3 ultra-short action bullets (up to 45 chars each)
function getCleanQuickSteps(exercise: Exercise): string[] {
  if (exercise.quickSteps && exercise.quickSteps.length > 0) {
    return exercise.quickSteps.slice(0, 3).map((s) => (s.length > 50 ? s.slice(0, 47) + '...' : s));
  }
  return exercise.steps.slice(0, 3).map((step) => {
    const clean = step.replace(/^(Шаг|Фаза)\s*\d+[:.-]\s*/i, '').trim();
    const firstSentence = clean.split(/[.!?]/)[0].trim();
    return firstSentence.length > 48 ? firstSentence.slice(0, 45) + '...' : firstSentence;
  });
}

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
  // Restore or default states
  const [currentIndex, setCurrentIndex] = useState<number>(() => initialBackup?.currentIndex ?? 0);
  const [currentSet, setCurrentSet] = useState<number>(() => initialBackup?.currentSet ?? 1);
  const [phase, setPhase] = useState<WorkoutPhase>(() => initialBackup?.phase ?? 'ready');
  const [completedCount, setCompletedCount] = useState<number>(() => initialBackup?.completedCount ?? 0);
  const [repCounter, setRepCounter] = useState<number>(() => {
    if (initialBackup?.repCounter) return initialBackup.repCounter;
    const ex = exercises[0];
    const match = ex?.defaultReps?.match(/\d+/);
    return match ? parseInt(match[0], 10) : 10;
  });
  const [backComfort, setBackComfort] = useState<'great' | 'normal' | 'tired'>('great');
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const [selectedWalkingSpeed, setSelectedWalkingSpeed] = useState<number>(5.0);
  const [accumulatedWalkingSteps, setAccumulatedWalkingSteps] = useState(0);

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
    if (currentExercise?.targetSpeedKmh) {
      const match = currentExercise.targetSpeedKmh.match(/(\d+(?:\.\d+)?)/);
      if (match) {
        setSelectedWalkingSpeed(parseFloat(match[1]));
      }
    }
  }, [currentExercise]);

  const walkingCadence = useMemo(() => {
    if (selectedWalkingSpeed >= 6.0) return 134;
    if (selectedWalkingSpeed >= 5.5) return 128;
    if (selectedWalkingSpeed >= 5.0) return 122;
    if (selectedWalkingSpeed >= 4.5) return 112;
    return 105;
  }, [selectedWalkingSpeed]);

  const currentWalkElapsed = useMemo(() => {
    if (!isWalkingExercise || !currentExercise) return 0;
    return Math.max(0, currentExercise.defaultSeconds - timer.secondsLeft);
  }, [isWalkingExercise, currentExercise, timer.secondsLeft]);

  const liveWalkingSteps = useMemo(() => {
    return Math.round((currentWalkElapsed / 60) * walkingCadence);
  }, [currentWalkElapsed, walkingCadence]);

  const totalCalculatedSteps = useMemo(() => {
    return accumulatedWalkingSteps + liveWalkingSteps;
  }, [accumulatedWalkingSteps, liveWalkingSteps]);

  const totalCalculatedDistanceKm = useMemo(() => {
    return Math.round(((totalCalculatedSteps * 0.72) / 1000) * 100) / 100;
  }, [totalCalculatedSteps]);

  const liveWalkingMet = useMemo(() => {
    if (selectedWalkingSpeed >= 6.0) return 5.2;
    if (selectedWalkingSpeed >= 5.5) return 4.6;
    if (selectedWalkingSpeed >= 5.0) return 4.0;
    if (selectedWalkingSpeed >= 4.5) return 3.4;
    return 3.0;
  }, [selectedWalkingSpeed]);

  const liveWalkingKcal = useMemo(() => {
    return Math.round(liveWalkingMet * userWeightKg * (currentWalkElapsed / 3600));
  }, [liveWalkingMet, userWeightKg, currentWalkElapsed]);

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
  ]);

  // Start next exercise in active work
  const startNextExerciseWork = useCallback(() => {
    if (isWalkingExercise) {
      setAccumulatedWalkingSteps((prev) => prev + liveWalkingSteps);
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
  }, [currentIndex, exercises, soundEnabled, timer, isWalkingExercise, liveWalkingSteps]);

  // User starts workout on exercise 1
  const handleStartWork = useCallback(() => {
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
    } else if (phase === 'ready') {
      handleStartWork();
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
  }, [phase, startNextExerciseWork, handleStartWork, isRepsMode, currentExercise, currentIndex, exercises.length, defaultTransitionSeconds, timer, finishWorkout]);

  // Open Bottom Sheet (Auto-pause if duration mode)
  const handleOpenBottomSheet = () => {
    if (phase === 'work' && !isRepsMode && timer.isRunning) {
      timer.pauseTimer();
    }
    setIsBottomSheetOpen(true);
  };

  // Close Bottom Sheet
  const handleCloseBottomSheet = () => {
    setIsBottomSheetOpen(false);
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (phase === 'ready') {
          handleStartWork();
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
  }, [phase, isRepsMode, isBottomSheetOpen, handleStartWork, handleCompleteRepsSet, timer, startNextExerciseWork, handleManualSkip, onClose]);

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
      <div className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 border-b border-slate-800/80 bg-[#090D16]/95 backdrop-blur-md">
        <div>
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-400">
            {phase === 'transition_next'
              ? 'Пауза и смена положения'
              : phase === 'ready'
              ? `Упражнение ${currentIndex + 1} из ${exercises.length} • Ознакомление`
              : `Упражнение ${currentIndex + 1} из ${exercises.length} • В работе`}
          </span>
          <h2 className="text-sm sm:text-base font-extrabold text-white truncate max-w-[220px] sm:max-w-md">
            {title}
          </h2>
        </div>

        <div className="flex items-center gap-2">
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

            <button
              type="button"
              onClick={() => {
                onCompleteSession({
                  durationSeconds: timer.elapsedTotalSeconds,
                  exercisesCompleted: completedCount,
                  exercisesTotal: exercises.length,
                  kcalBurned: totalKcal,
                  backComfort,
                  walkingSteps: totalCalculatedSteps > 0 ? totalCalculatedSteps : undefined,
                  distanceKm: totalCalculatedDistanceKm > 0 ? totalCalculatedDistanceKm : undefined,
                });
                onClose();
              }}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/25 transition cursor-pointer"
            >
              Зафиксировать результат в шкалах
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. TRANSITION & REST SCREENS (WITH QUICK +/- BUTTONS)    */}
      {/* ======================================================== */}
      {(phase === 'transition_next' || phase === 'rest_set') && (
        <div className="flex-1 flex flex-col items-center justify-center p-4 max-w-xl mx-auto w-full space-y-4 animate-fadeIn">
          {/* Pause Timer Box */}
          <div className="p-5 rounded-3xl bg-slate-900/90 border border-cyan-500/40 text-center w-full space-y-3 shadow-xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 text-xs font-bold uppercase tracking-wider">
              <Clock className="w-3.5 h-3.5" />
              {phase === 'rest_set' ? 'Отдых между подходами' : 'Пауза и смена положения'} • {timer.secondsLeft} сек
            </span>

            <div className="text-4xl sm:text-5xl font-mono font-black text-cyan-300">
              00:{String(timer.secondsLeft).padStart(2, '0')}
            </div>

            <p className="text-xs text-slate-300">
              {phase === 'rest_set'
                ? `Восстановите дыхание перед подходом ${currentSet + 1} из ${totalSetsForCurrent}.`
                : 'Отдышитесь и ознакомьтесь со следующим упражнением.'}
            </p>

            {/* Quick Rest Adjustments: [-15с] [+15с] [Пропустить] */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => timer.adjustSeconds(-15)}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                title="Убавить 15 секунд"
              >
                <Minus className="w-3.5 h-3.5" /> 15 сек
              </button>

              <button
                type="button"
                onClick={() => timer.adjustSeconds(15)}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                title="Добавить 15 секунд"
              >
                <Plus className="w-3.5 h-3.5" /> 15 сек
              </button>

              <button
                type="button"
                onClick={handleManualSkip}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black transition flex items-center gap-1.5 shadow cursor-pointer"
              >
                <span>Пропустить отдых</span>
                <FastForward className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Preview for next exercise during transition_next */}
          {phase === 'transition_next' && nextExercise && (
            <div className="w-full rounded-3xl bg-slate-900/90 border border-slate-800 p-4 sm:p-5 space-y-3.5 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-400">
                  Далее: Упражнение #{currentIndex + 2} из {exercises.length}
                </span>
                <span className="text-xs text-slate-400 font-bold">
                  {nextExercise.defaultReps || `${nextExercise.defaultSeconds} сек`}
                </span>
              </div>

              <div>
                <h3 className="text-base sm:text-lg font-black text-white">{nextExercise.titleRu}</h3>
                <p className="text-xs text-slate-400">{nextExercise.titleEn}</p>
              </div>

              <BiomechanicalVisualizer
                exerciseId={nextExercise.id}
                imageUrl={nextExercise.imageUrl}
                pose={nextExercise.pose}
                category={nextExercise.category}
                title={nextExercise.titleRu}
                muscleGroups={nextExercise.muscleGroups}
                secondaryMuscles={nextExercise.secondaryMuscles}
              />

              {/* 2-3 Short Quick Steps */}
              <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-1">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-400 block">
                  Суть движения:
                </span>
                <ol className="space-y-1 text-xs sm:text-sm text-slate-200">
                  {getCleanQuickSteps(nextExercise).map((step, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <span className="leading-snug">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="p-2 rounded-xl bg-cyan-950/30 border border-cyan-500/30 text-center text-xs text-cyan-300 font-medium">
                ⚡ Упражнение начнётся автоматически через <strong>{timer.secondsLeft} сек</strong>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. READY STATE: INITIAL PREP BEFORE WORKOUT START        */}
      {/* ======================================================== */}
      {phase === 'ready' && (
        <div className="flex-1 p-4 max-w-xl mx-auto w-full space-y-4 animate-fadeIn">
          <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800/90 space-y-4 shadow-xl">
            {/* Top Badge & Number */}
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Ознакомление перед стартом
              </span>
              <span className="text-xs font-bold text-slate-400">
                {currentExercise.defaultReps || `${timer.secondsLeft} сек`}
              </span>
            </div>

            {/* Exercise Title */}
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">
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

            {/* 2-3 Short Punchy Action Steps */}
            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-400 block">
                Суть движения:
              </span>
              <ol className="space-y-1.5 text-sm sm:text-base text-slate-200">
                {quickSteps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span className="leading-snug">{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Giant Start Button */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleStartWork}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-base shadow-xl shadow-amber-500/30 flex items-center justify-center gap-2.5 transition transform active:scale-[0.99] cursor-pointer"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>
                  НАЧАТЬ ТРЕНИРОВКУ {isRepsMode ? `(${currentExercise.defaultReps})` : `(${formatTime(timer.secondsLeft)})`}
                </span>
              </button>

              <p className="text-[11px] text-center text-slate-400 pt-1">
                Старт по кнопке или клавише <strong>Пробел</strong>. Далее упражнения будут сменяться <strong>автоматически</strong> после перерывов.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. ACTIVE WORK SCREEN (GLANCEABLE GYM UI)                */}
      {/* ======================================================== */}
      {phase === 'work' && (
        <div className="flex-1 p-4 max-w-xl mx-auto w-full flex flex-col justify-between space-y-4 animate-fadeIn">
          <div className="space-y-4">
            {/* Top Bar: Title & Set Counter */}
            <div className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
              <div className="space-y-0.5 max-w-[280px] sm:max-w-md">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400">
                  {currentExercise.category === 'kettlebell' ? 'Силовой сет' : 'Активная фаза'}
                </span>
                <h3 className="text-base sm:text-lg font-black text-white truncate">{currentExercise.titleRu}</h3>
              </div>
              <div className="px-3 py-1 rounded-xl bg-slate-800 border border-slate-700 text-xs font-black text-white shrink-0">
                Сет {currentSet}/{totalSetsForCurrent}
              </div>
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
            />

            {/* ACTION BLOCK: Distinct REPS vs DURATION Mode */}
            {isRepsMode ? (
              // --- REPS MODE (No ticking countdown! Large Target + Stepper + Thumb Button) ---
              <div className="p-5 rounded-3xl bg-slate-900/90 border border-amber-500/30 text-center space-y-4 shadow-xl">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Цель на подход:
                  </span>
                  <div className="text-3xl sm:text-4xl font-black text-white tracking-tight">
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
              // --- DURATION MODE (Countdown Timer) ---
              <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 text-center space-y-3 shadow-lg">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="text-amber-400 font-extrabold flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                    ВЫПОЛНЕНИЕ
                  </span>
                  <span className="font-bold">Работа по таймеру</span>
                </div>

                {/* Giant Timer Numbers */}
                <div className="text-5xl sm:text-6xl font-mono font-black tracking-tight text-white">
                  {formatTime(timer.secondsLeft)}
                </div>

                {/* Walking Pad Speed Selector & Real-Time Stats */}
                {isWalkingExercise && (
                  <div className="p-3.5 rounded-2xl bg-slate-950/90 border border-emerald-500/40 space-y-2.5 text-left">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-extrabold text-emerald-400 flex items-center gap-1.5">
                        <span>🚶</span>
                        <span>Скорость дорожки: {selectedWalkingSpeed.toFixed(1)} км/ч</span>
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {currentExercise.targetSpeedKmh ? `Цель: ${currentExercise.targetSpeedKmh}` : 'Зона 2'}
                      </span>
                    </div>

                    {/* Interactive Speed Selector */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                      {[4.0, 4.5, 5.0, 5.5, 6.0].map((spd) => (
                        <button
                          key={spd}
                          type="button"
                          onClick={() => setSelectedWalkingSpeed(spd)}
                          className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-black transition cursor-pointer ${
                            selectedWalkingSpeed === spd
                              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/25 scale-105'
                              : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                          }`}
                        >
                          {spd.toFixed(1)}
                        </button>
                      ))}
                      <span className="text-[10px] text-slate-500 font-bold shrink-0">км/ч</span>
                    </div>

                    {/* Live Walking Metrics Grid */}
                    <div className="grid grid-cols-4 gap-1.5 pt-1 border-t border-slate-800/80 text-center">
                      <div className="p-1.5 rounded-xl bg-slate-900/80 border border-slate-800">
                        <div className="text-[9px] text-slate-400 uppercase font-bold">Шаги</div>
                        <div className="text-sm font-black text-white">{totalCalculatedSteps}</div>
                      </div>
                      <div className="p-1.5 rounded-xl bg-slate-900/80 border border-slate-800">
                        <div className="text-[9px] text-slate-400 uppercase font-bold">Дистанция</div>
                        <div className="text-sm font-black text-emerald-400">{totalCalculatedDistanceKm} км</div>
                      </div>
                      <div className="p-1.5 rounded-xl bg-slate-900/80 border border-slate-800">
                        <div className="text-[9px] text-slate-400 uppercase font-bold">Расход</div>
                        <div className="text-sm font-black text-amber-400">~{liveWalkingKcal} ккал</div>
                      </div>
                      <div className="p-1.5 rounded-xl bg-slate-900/80 border border-slate-800">
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
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                    title="Добавить 15 секунд"
                  >
                    <Plus className="w-3.5 h-3.5" /> 15с
                  </button>

                  <button
                    type="button"
                    onClick={timer.toggleRunning}
                    className="p-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow-lg shadow-amber-500/25 transition cursor-pointer"
                    title={timer.isRunning ? 'Пауза (Пробел)' : 'Продолжить (Пробел)'}
                  >
                    {timer.isRunning ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current" />}
                  </button>

                  <button
                    type="button"
                    onClick={handleManualSkip}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                    title="Завершить подход"
                  >
                    <span>Далее</span>
                    <SkipForward className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* 2-3 Short Quick Action Steps (Clean & Legible text-sm sm:text-base) */}
            <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 block">
                Акцент движения:
              </span>
              <div className="space-y-1.5 text-sm sm:text-base text-slate-200 font-medium">
                {quickSteps.map((step, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span className="leading-snug">{step}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom Button for Details Bottom Sheet */}
          <button
            type="button"
            onClick={handleOpenBottomSheet}
            className="w-full py-2.5 px-4 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-slate-300 hover:text-white flex items-center justify-center gap-2 transition cursor-pointer"
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
              className="w-full py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition cursor-pointer"
            >
              Вернуться к упражнению
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
