import React, { useEffect, useMemo, useState } from 'react';
import {
  Exercise,
  ExerciseCategory,
  EquipmentId,
  SubView,
  UserState,
  ActiveWorkoutBackup,
  DailyBreakSlot,
  MixGoal,
  MixStructure,
} from './types/fitness';
import { EXERCISES_DB, KETTLEBELL_COMPLEXES_DB, KettlebellComplex } from './data/exercises';
import {
  generateBreakWorkout,
  generateKettlebellWorkout,
  generateMorningWorkout,
  generateWalkingWorkout,
  generateHybridMixWorkout,
  calculateWalkingMetrics,
  getDefaultBreakSlots,
  getTodayISO,
  KETTLEBELL_WEEKLY_SCHEDULE,
} from './utils/workoutBuilder';
import { MotivationScalesPanel } from './components/MotivationScalesPanel';
import { ExerciseDetailCard } from './components/ExerciseDetailCard';
import { ActiveWorkoutModal } from './components/ActiveWorkoutModal';
import { AccountAndSettingsModal } from './components/AccountAndSettingsModal';
import { soundEngine } from './utils/soundEngine';
import { useBreakReminderTimer } from './hooks/useBreakReminderTimer';
import { checkScheduledReminders } from './utils/notificationScheduler';
import {
  Sun,
  Monitor,
  Dumbbell,
  Footprints,
  Play,
  Pause,
  RotateCcw,
  BarChart3,
  Sparkles,
  BookOpen,
  Bell,
  Cloud,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  ShieldCheck,
  Clock,
  Flame,
  ExternalLink,
  Calendar,
  Scale,
  UserCheck,
  Layers,
} from 'lucide-react';

const STORAGE_KEY = 'titan_ultimate_fitness_state_v2';

function buildInitialUserState(): UserState {
  const getOffsetISO = (daysBack: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysBack);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const todayISO = getOffsetISO(0);
  const d1 = getOffsetISO(1);
  const d2 = getOffsetISO(2);
  const d3 = getOffsetISO(3);
  const d4 = getOffsetISO(4);
  const d6 = getOffsetISO(6);
  const d7 = getOffsetISO(7);
  const d8 = getOffsetISO(8);
  const d9 = getOffsetISO(9);
  const d10 = getOffsetISO(10);
  const d12 = getOffsetISO(12);
  const d13 = getOffsetISO(13);

  const defaultSlots = getDefaultBreakSlots();
  defaultSlots[0].completedDates = [d12, d10, d9, d8, d6, d4, d3, d2, d1];
  defaultSlots[1].completedDates = [d12, d10, d8, d6, d4, d3, d2, d1];
  defaultSlots[2].completedDates = [d9, d8, d4, d2, d1];
  defaultSlots[3].skippedDates = [d7, d4];

  const morningSeedDays = [d13, d12, d10, d9, d8, d7, d6, d4, d3, d2, d1];
  const kbSeedDays = [d12, d10, d8, d6, d3, d1];

  return {
    profile: {
      name: 'Антон',
      age: 36,
      heightCm: 178,
      startWeightKg: 110,
      currentWeightKg: 110,
      targetWeightKg: 88,
      equipment: ['kb16', 'kb24', 'bands', 'mat', 'bodyweight'],
      lowerBackGuard: true,
    },
    googleUser: null,
    weightHistory: [{ dateISO: todayISO, weightKg: 110, note: 'Старт трансформации TITAN' }],
    logs: [
      ...morningSeedDays.map((iso, idx) => ({
        id: `seed-morn-${idx}`,
        dateISO: iso,
        timestamp: `${iso}T08:15:00.000Z`,
        category: 'morning' as const,
        title: 'Утренняя Зарядка Титана (15 мин)',
        durationSeconds: 900,
        exercisesCompleted: 10,
        exercisesTotal: 10,
        kcalBurned: 148,
        backComfort: 'great' as const,
      })),
      ...kbSeedDays.map((iso, idx) => ({
        id: `seed-kb-${idx}`,
        dateISO: iso,
        timestamp: `${iso}T19:30:00.000Z`,
        category: 'kettlebell' as const,
        title:
          idx % 2 === 0
            ? 'Протокол А: Силовой Фундамент (16 кг + 24 кг)'
            : 'Протокол В: Метаболический Шторм & Instagram Flows (16 кг)',
        durationSeconds: 1560,
        exercisesCompleted: 6,
        exercisesTotal: 6,
        kcalBurned: 345,
        backComfort: 'great' as const,
      })),
      {
        id: 'seed-brk-1',
        dateISO: d1,
        timestamp: `${d1}T13:35:00.000Z`,
        category: 'breaks',
        title: 'Офисный Перерыв Анти-Гиподинамия (7 мин)',
        durationSeconds: 420,
        exercisesCompleted: 6,
        exercisesTotal: 6,
        kcalBurned: 88,
        backComfort: 'great',
      },
    ],
    breakSlots: defaultSlots,
    customMediaLinks: {},
    favoriteExerciseIds: ['kb-swing-2h', 'kb-sumo-deadlift-24', 'morn-mcgill-curlup', 'brk-couch-hip-flexor-lunge'],
    reminders: {
      morningEnabled: true,
      morningTime: '08:00',
      morningDays: [1, 2, 3, 4, 5],
      breaksEnabled: true,
      breaksIntervalMinutes: 90,
      breaksDays: [1, 2, 3, 4, 5],
      breaksStartHour: 10,
      breaksEndHour: 19,
      kettlebellEnabled: true,
      kettlebellTime: '19:30',
      kettlebellDays: [1, 3, 5, 6],
      soundEnabled: true,
    },
    selectedDurationMorning: 15,
    selectedDurationBreak: 7,
    selectedKettlebellProgram: 'foundation-16',
  };
}

export function App() {
  const [userState, setUserState] = useState<UserState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const freshSlots = getDefaultBreakSlots();
        if (parsed.breakSlots && Array.isArray(parsed.breakSlots)) {
          parsed.breakSlots = freshSlots.map((fresh: DailyBreakSlot) => {
            const old = parsed.breakSlots.find((s: any) => s.id === fresh.id);
            return {
              ...fresh,
              completedDates: old?.completedDates || [],
              skippedDates: old?.skippedDates || [],
            };
          });
        } else {
          parsed.breakSlots = freshSlots;
        }
        return parsed;
      }
    } catch {
      // ignore
    }
    return buildInitialUserState();
  });

  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const initialCat = (params?.get('cat') as ExerciseCategory) || 'morning';
  const initialSub = (params?.get('sub') as SubView) || 'today';
  const initialModal = params?.get('modal');

  // Main bottom navbar pillar: 'morning' | 'breaks' | 'kettlebell'
  const [activeCategory, setActiveCategory] = useState<ExerciseCategory>(
    ['morning', 'breaks', 'kettlebell'].includes(initialCat) ? initialCat : 'morning'
  );
  // Sub-branch inside each pillar: 'today' | 'progress' | 'library'
  const [activeSubView, setActiveSubView] = useState<SubView>(
    ['today', 'progress', 'library'].includes(initialSub) ? initialSub : 'today'
  );

  // Library Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentId | 'all'>('all');
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);

  // Active Workout Backup Storage Key (Task 2)
  const ACTIVE_BACKUP_STORAGE_KEY = 'titan_active_workout_backup';

  // Check for unfinished active session backup on boot (under 3 hours old)
  const [workoutBackup, setWorkoutBackup] = useState<ActiveWorkoutBackup | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem('titan_active_workout_backup');
      if (!raw) return null;
      const data: ActiveWorkoutBackup = JSON.parse(raw);
      const maxAgeMs = 3 * 60 * 60 * 1000; // 3 hours
      if (data && data.timestamp && Date.now() - data.timestamp < maxAgeMs && data.activeSession) {
        return data;
      }
      localStorage.removeItem('titan_active_workout_backup');
    } catch {
      // ignore
    }
    return null;
  });

  const [activeSessionBackupToRestore, setActiveSessionBackupToRestore] = useState<ActiveWorkoutBackup | null>(null);

  // Active Workout Timer Modal
  const [activeSession, setActiveSession] = useState<{
    title: string;
    category: ExerciseCategory;
    exercises: Exercise[];
    slotIdToComplete?: string;
  } | null>(() => {
    if (initialModal === 'workout') {
      const plan = generateKettlebellWorkout('foundation-16');
      return {
        title: plan.title,
        category: 'kettlebell',
        exercises: plan.exercises,
      };
    }
    return null;
  });

  // Kettlebell Library Switcher: individual exercises vs 12 full complexes
  const [kettlebellLibMode, setKettlebellLibMode] = useState<'complexes' | 'exercises'>('complexes');
  // Settings / Google Account / Reminders Modal
  const [settingsOpen, setSettingsOpen] = useState(initialModal === 'settings');
  // Toast notification for reminders
  const [reminderBanner, setReminderBanner] = useState<string | null>(null);

  // Morning Workout: Mat vs Standing by Bed (No Mat)
  const [morningNoMatMode, setMorningNoMatMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('titan_no_mat_mode') === 'true';
    } catch {
      return false;
    }
  });

  // Work-Break Focus Timer (Delta-time countdown, presets, prompt)
  const breakTimer = useBreakReminderTimer();

  // Background 15-second PWA Reminder Scheduler
  useEffect(() => {
    const interval = setInterval(() => {
      checkScheduledReminders(userState.reminders, (_type, title) => {
        soundEngine.playStartBell();
        setReminderBanner(`🔔 Напоминание TITAN: ${title}`);
      });
    }, 15000);
    return () => clearInterval(interval);
  }, [userState.reminders]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userState));
    } catch {
      // ignore storage quota
    }
  }, [userState]);

  const todayISO = getTodayISO();

  // Generated Daily Plans
  const morningPlan = useMemo(
    () => generateMorningWorkout(userState.selectedDurationMorning, undefined, morningNoMatMode),
    [userState.selectedDurationMorning, morningNoMatMode]
  );

  const breakPlan = useMemo(
    () => generateBreakWorkout(userState.selectedDurationBreak),
    [userState.selectedDurationBreak]
  );

  const kettlebellPlan = useMemo(
    () => generateKettlebellWorkout(userState.selectedKettlebellProgram),
    [userState.selectedKettlebellProgram]
  );

  // Walking Pad & Smart Mixer States
  const [selectedWalkingProtocol, setSelectedWalkingProtocol] = useState<'zone2' | 'intervals' | 'after_meal' | 'recovery'>('zone2');
  const [selectedWalkingDuration, setSelectedWalkingDuration] = useState<15 | 20 | 30 | 45>(20);

  const [mixGoal, setMixGoal] = useState<MixGoal>('fatburn');
  const [mixStructure, setMixStructure] = useState<MixStructure>('walk_then_kb');
  const [mixDuration, setMixDuration] = useState<25 | 35 | 45>(35);
  const [mixIncludeBands, setMixIncludeBands] = useState<boolean>(true);
  const [mixIncludeKettlebells, setMixIncludeKettlebells] = useState<boolean>(true);

  // Walking & Hybrid Plans
  const walkingPlan = useMemo(
    () => generateWalkingWorkout(selectedWalkingProtocol, selectedWalkingDuration, userState.profile.currentWeightKg),
    [selectedWalkingProtocol, selectedWalkingDuration, userState.profile.currentWeightKg]
  );

  const hybridPlan = useMemo(
    () => generateHybridMixWorkout({
      goal: mixGoal,
      structure: mixStructure,
      totalMinutes: mixDuration,
      includeBands: mixIncludeBands,
      userWeightKg: userState.profile.currentWeightKg,
    }),
    [mixGoal, mixStructure, mixDuration, mixIncludeBands, userState.profile.currentWeightKg]
  );

  const handleAutoRecommendMix = () => {
    const day = new Date().getDay();
    if (day === 2 || day === 4 || day === 0) {
      setMixGoal('recovery');
      setMixStructure('walking_only');
      setMixDuration(25);
      setReminderBanner('✨ Рекомендация на день восстановления: мягкое кардио на дорожке в Зоне 2.');
    } else if (day === 1 || day === 5) {
      setMixGoal('strength_cardio');
      setMixStructure('walk_then_kb');
      setMixDuration(35);
      setReminderBanner('✨ Рекомендация на силовой день: Разогрев на дорожке ➔ Силовой блок с гирями.');
    } else {
      setMixGoal('fatburn');
      setMixStructure('kb_then_walk');
      setMixDuration(35);
      setReminderBanner('✨ Рекомендация на жиросжигающий день: Гири/махи ➔ Кардио-финишер на дорожке.');
    }
    soundEngine.playStartBell();
  };

  // Filtered Library Exercises for current tab
  const filteredLibraryExercises = useMemo(() => {
    return EXERCISES_DB.filter((ex) => {
      if (ex.category !== activeCategory) return false;
      if (selectedEquipment !== 'all' && !ex.equipment.includes(selectedEquipment)) return false;
      if (showOnlyFavorites && !userState.favoriteExerciseIds.includes(ex.id)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle =
          ex.titleRu.toLowerCase().includes(q) ||
          ex.titleEn.toLowerCase().includes(q) ||
          ex.subCategory.toLowerCase().includes(q) ||
          ex.school.toLowerCase().includes(q) ||
          ex.muscleGroups.some((m) => m.toLowerCase().includes(q));
        if (!matchTitle) return false;
      }
      return true;
    });
  }, [activeCategory, selectedEquipment, showOnlyFavorites, searchQuery, userState.favoriteExerciseIds]);

  const handleCompleteWorkoutSession = (payload: {
    durationSeconds: number;
    exercisesCompleted: number;
    exercisesTotal: number;
    kcalBurned: number;
    backComfort: 'great' | 'normal' | 'tired';
    walkingSteps?: number;
    distanceKm?: number;
  }) => {
    if (!activeSession) return;
    const newLog = {
      id: 'log-' + Date.now(),
      dateISO: todayISO,
      timestamp: new Date().toISOString(),
      category: activeSession.category,
      title: activeSession.title,
      durationSeconds: payload.durationSeconds,
      exercisesCompleted: payload.exercisesCompleted,
      exercisesTotal: payload.exercisesTotal,
      kcalBurned: payload.kcalBurned,
      weightKgAtSession: userState.profile.currentWeightKg,
      backComfort: payload.backComfort,
      walkingSteps: payload.walkingSteps,
      distanceKm: payload.distanceKm,
    };

    setUserState((prev) => {
      const updatedSlots = prev.breakSlots.map((slot) => {
        if (activeSession.slotIdToComplete && slot.id === activeSession.slotIdToComplete) {
          const completedDates = slot.completedDates.includes(todayISO)
            ? slot.completedDates
            : [...slot.completedDates, todayISO];
          const skippedDates = slot.skippedDates.filter((d) => d !== todayISO);
          return { ...slot, completedDates, skippedDates };
        }
        return slot;
      });

      return {
        ...prev,
        logs: [newLog, ...prev.logs],
        breakSlots: updatedSlots,
        googleUser: prev.googleUser
          ? { ...prev.googleUser, lastSyncedAt: new Date().toISOString() }
          : null,
      };
    });

    setActiveSession(null);
    setActiveSubView('progress');
  };

  const handleToggleBreakSlotStatus = (slotId: string, status: 'done' | 'skipped') => {
    setUserState((prev) => {
      const updatedSlots = prev.breakSlots.map((slot) => {
        if (slot.id !== slotId) return slot;
        if (status === 'done') {
          const completedDates = slot.completedDates.includes(todayISO)
            ? slot.completedDates.filter((d) => d !== todayISO)
            : [...slot.completedDates, todayISO];
          const skippedDates = slot.skippedDates.filter((d) => d !== todayISO);
          return { ...slot, completedDates, skippedDates };
        } else {
          const skippedDates = slot.skippedDates.includes(todayISO)
            ? slot.skippedDates.filter((d) => d !== todayISO)
            : [...slot.skippedDates, todayISO];
          const completedDates = slot.completedDates.filter((d) => d !== todayISO);
          return { ...slot, completedDates, skippedDates };
        }
      });
      return { ...prev, breakSlots: updatedSlots };
    });
  };

  const triggerTestReminder = () => {
    soundEngine.playStartBell();
    const msg =
      activeCategory === 'morning'
        ? '☀️ Время Утренней Зарядки Титана (15 мин)! Смазываем суставы и включаем кор по МакГиллу.'
        : activeCategory === 'breaks'
        ? '💻 Перерыв от работы за Mac (7 мин)! Растяните подвздошно-поясничную мышцу и сделайте 15 тяг резинки.'
        : activeCategory === 'walking'
        ? '🚶 Время шагов на Walking Pad! Запустите дорожку на 4.8–5.5 км/ч для мягкого жиросжигания.'
        : '🔥 Вечерняя тренировка с гирями 16/24 кг и калистеникой! Время сжечь 350 ккал.';
    setReminderBanner(msg);
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('TITAN 110→88 — Напоминание Тренера', { body: msg });
      } catch {
        // ignore
      }
    }
  };

  // Current Pillar Accent Styling
  const pillarMeta = {
    morning: {
      title: '1. Утренняя Зарядка',
      subtitle: '10–20 минут после пробуждения • Декомпрессия спины и пробуждение суставов',
      badge: 'Утро • 08:00',
      gradient: 'from-amber-500/20 via-orange-500/10 to-transparent',
      accentText: 'text-amber-400',
      buttonBg: 'from-amber-500 to-orange-500 text-slate-950',
    },
    breaks: {
      title: '2. Перерывы на Работе',
      subtitle: '5–10 минут каждые 90 мин за ПК • Разгон крови, осанка и защита поясницы',
      badge: 'Офис / Mac • 4 слота в день',
      gradient: 'from-cyan-500/20 via-sky-500/10 to-transparent',
      accentText: 'text-cyan-400',
      buttonBg: 'from-cyan-400 to-teal-500 text-slate-950',
    },
    walking: {
      title: '3. Кардио на Дорожке & Умный Микшер',
      subtitle: 'Аэробное жиросжигание в Зоне 2, утилизация сахара и гибридные миксы с гирями',
      badge: 'Walking Pad • Зона 2 • Микшер',
      gradient: 'from-emerald-500/20 via-teal-500/10 to-transparent',
      accentText: 'text-emerald-400',
      buttonBg: 'from-emerald-400 to-teal-500 text-slate-950',
    },
    kettlebell: {
      title: '4. Гири 16/24 кг & Калистеника',
      subtitle: 'Силовые и жиросжигающие комплексы по расписанию • Гири 16/24 кг + Резинки + Коврик',
      badge: 'Сила • ПН / СР / ПТ / СБ',
      gradient: 'from-rose-500/25 via-red-500/10 to-transparent',
      accentText: 'text-rose-400',
      buttonBg: 'from-rose-500 to-amber-500 text-white',
    },
  }[activeCategory];

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 pb-28">
      {/* Top Sticky App Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-[#090D16]/90 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 via-rose-500 to-red-600 flex items-center justify-center shadow-lg shadow-amber-500/20 font-black text-white text-sm tracking-tighter">
              24KG
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black tracking-tight text-white">
                  TITAN <span className="text-amber-400">110→88</span>
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold">
                  <ShieldCheck className="w-3 h-3" /> Защита спины L4-S1
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                36 лет • 178 см • Текущий вес:{' '}
                <strong className="text-white">{userState.profile.currentWeightKg} кг</strong> • Инвентарь: 16/24 кг + Резинки + Коврик
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={triggerTestReminder}
              className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-amber-400 transition"
              title="Проверить напоминание тренера"
            >
              <Bell className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition ${
                userState.googleUser
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-200'
              }`}
            >
              {userState.googleUser ? (
                <>
                  <UserCheck className="w-4 h-4 text-emerald-400" />
                  <span className="hidden sm:inline">{userState.googleUser.email.split('@')[0]}</span>
                  <span className="sm:hidden">Google ✓</span>
                </>
              ) : (
                <>
                  <Cloud className="w-4 h-4 text-cyan-400" />
                  <span>Google Вход & Вес</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Reminder Toast Notification */}
      {reminderBanner && (
        <div className="max-w-5xl mx-auto px-4 pt-3">
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/20 via-rose-500/20 to-cyan-500/20 border border-amber-500/40 flex items-center justify-between gap-3 text-xs text-amber-200 shadow-lg">
            <div className="flex items-center gap-2.5">
              <Bell className="w-4 h-4 text-amber-400 shrink-0 animate-bounce" />
              <span className="font-semibold">{reminderBanner}</span>
            </div>
            <button
              type="button"
              onClick={() => setReminderBanner(null)}
              className="px-2.5 py-1 rounded-lg bg-slate-900/80 text-slate-300 hover:text-white font-bold"
            >
              Ок
            </button>
          </div>
        </div>
      )}

      {/* Main Content Container */}
      <main className="max-w-5xl mx-auto px-4 pt-4 space-y-5">
        {/* Pillar Hero Banner & 3 Sub-Branches Selector (Прогресс | Сегодня | Библиотека) */}
        <section
          className={`p-5 rounded-3xl bg-gradient-to-br ${pillarMeta.gradient} border border-slate-800/90 space-y-4`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-900/90 border border-slate-700 text-[11px] font-bold text-slate-300">
                <Clock className="w-3 h-3 text-amber-400" />
                {pillarMeta.badge}
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white mt-1.5">{pillarMeta.title}</h2>
              <p className="text-xs sm:text-sm text-slate-300 mt-0.5">{pillarMeta.subtitle}</p>
            </div>

            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="self-start inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white"
            >
              <Scale className="w-3.5 h-3.5 text-amber-400" />
              <span>Вес: {userState.profile.currentWeightKg} кг → {userState.profile.targetWeightKg} кг</span>
            </button>
          </div>

          {/* 3 Sub-Branches inside each bottom tab as requested: Прогресс | Сегодня | Библиотека */}
          <div className="grid grid-cols-3 gap-2 p-1.5 rounded-2xl bg-slate-950/90 border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveSubView('progress')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-extrabold transition ${
                activeSubView === 'progress'
                  ? `bg-gradient-to-r ${pillarMeta.buttonBg} shadow-md`
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <BarChart3 className="w-4 h-4 shrink-0" />
              <span>Прогресс</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubView('today')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-extrabold transition ${
                activeSubView === 'today'
                  ? `bg-gradient-to-r ${pillarMeta.buttonBg} shadow-md`
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>
                {activeCategory === 'morning'
                  ? 'Зарядка на сегодня'
                  : activeCategory === 'breaks'
                  ? 'Сегодня'
                  : activeCategory === 'walking'
                  ? 'Дорожка и Микшер'
                  : 'Сборник на день'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubView('library')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-extrabold transition ${
                activeSubView === 'library'
                  ? `bg-gradient-to-r ${pillarMeta.buttonBg} shadow-md`
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <BookOpen className="w-4 h-4 shrink-0" />
              <span>
                Библиотека ({EXERCISES_DB.filter((e) => e.category === activeCategory).length})
              </span>
            </button>
          </div>
        </section>

        {/* ===================================================================
            SUB-VIEW 1: ПРОГРЕСС (Progress, Streak, Success & Missed Scales)
           =================================================================== */}
        {activeSubView === 'progress' && (
          <MotivationScalesPanel
            category={activeCategory}
            logs={userState.logs}
            breakSlots={userState.breakSlots}
            startWeightKg={userState.profile.startWeightKg}
            currentWeightKg={userState.profile.currentWeightKg}
            targetWeightKg={userState.profile.targetWeightKg}
          />
        )}

        {/* ===================================================================
            SUB-VIEW 2: СЕГОДНЯ (Daily Generated Complexes & Schedule)
           =================================================================== */}
        {activeSubView === 'today' && (
          <div className="space-y-5">
            {/* CATEGORY A: MORNING WORKOUT BUILDER */}
            {activeCategory === 'morning' && (
              <div className="space-y-4">
                <div className="p-5 rounded-3xl bg-slate-900/90 border border-amber-500/30 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <span className="text-xs font-extrabold uppercase tracking-wider text-amber-400">
                        Ежедневный утренний комплекс (собран из библиотеки)
                      </span>
                      <h3 className="text-xl font-black text-white mt-0.5">{morningPlan.title}</h3>
                      <p className="text-xs text-slate-300 mt-1">{morningPlan.coachFocus}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 self-start">
                      {/* Mode: Mat vs No Mat (Standing by bed) */}
                      <div className="flex items-center gap-1 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
                        <button
                          type="button"
                          onClick={() => {
                            setMorningNoMatMode(false);
                            localStorage.setItem('titan_no_mat_mode', 'false');
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                            !morningNoMatMode
                              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          🧘 С ковриком
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMorningNoMatMode(true);
                            localStorage.setItem('titan_no_mat_mode', 'true');
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                            morningNoMatMode
                              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          🛏 Без коврика (стоя)
                        </button>
                      </div>

                      {/* Duration Selector: 10 / 15 / 20 min */}
                      <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
                        {([10, 15, 20] as const).map((min) => (
                          <button
                            key={min}
                            type="button"
                            onClick={() =>
                              setUserState((prev) => ({ ...prev, selectedDurationMorning: min }))
                            }
                            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                              userState.selectedDurationMorning === min
                                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            {min} мин
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
                    <div className="flex items-center gap-4 text-xs text-slate-300">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-amber-400" /> {morningPlan.exercises.length} упражнений подряд
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Flame className="w-4 h-4 text-orange-400" /> ~{morningPlan.estimatedKcal} ккал
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setActiveSession({
                          title: morningPlan.title,
                          category: 'morning',
                          exercises: morningPlan.exercises,
                        })
                      }
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/20 transition"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>Запустить Зарядку с Таймером ({morningPlan.estimatedMinutes} мин)</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {morningPlan.exercises.map((ex, idx) => (
                    <ExerciseDetailCard
                      key={ex.id}
                      exercise={ex}
                      index={idx}
                      isFavorite={userState.favoriteExerciseIds.includes(ex.id)}
                      onStartSingleExercise={(single) =>
                        setActiveSession({
                          title: single.titleRu,
                          category: 'morning',
                          exercises: [single],
                        })
                      }
                      onToggleFavorite={(id) =>
                        setUserState((prev) => ({
                          ...prev,
                          favoriteExerciseIds: prev.favoriteExerciseIds.includes(id)
                            ? prev.favoriteExerciseIds.filter((f) => f !== id)
                            : [...prev.favoriteExerciseIds, id],
                        }))
                      }
                    />
                  ))}
                </div>
              </div>
            )}

            {/* CATEGORY B: WORKDAY DESK BREAKS */}
            {activeCategory === 'breaks' && (
              <div className="space-y-5">
                {/* 1. Work-Break Focus Timer Widget */}
                <div className="p-5 rounded-3xl bg-gradient-to-br from-cyan-950/40 via-slate-900 to-slate-950 border border-cyan-500/40 space-y-4 shadow-xl">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                        <span className="text-xs font-black uppercase tracking-wider text-cyan-300">
                          Фокус-таймер непрерывной работы за ПК
                        </span>
                      </div>
                      <h3 className="text-xl font-black text-white mt-0.5">
                        Интервал глубокого фокуса и отдыха
                      </h3>
                      <p className="text-xs text-slate-300 mt-0.5">
                        Установите комфортное время работы — по сигналу Titan мягко напомнит встать и размяться.
                      </p>
                    </div>

                    {/* Timer Display & Controls */}
                    <div className="flex items-center gap-3 bg-slate-950/80 px-4 py-2 rounded-2xl border border-slate-800 self-start sm:self-auto">
                      <div className="text-3xl font-mono font-black text-cyan-400 tracking-tight">
                        {breakTimer.formattedRemaining}
                      </div>
                      <div className="flex items-center gap-1.5 border-l border-slate-800 pl-3">
                        <button
                          type="button"
                          onClick={breakTimer.isRunning ? breakTimer.pauseTimer : breakTimer.resumeTimer}
                          className="p-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black transition cursor-pointer shadow-md shadow-cyan-500/20"
                          title={breakTimer.isRunning ? 'Пауза' : 'Старт'}
                        >
                          {breakTimer.isRunning ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                        </button>
                        <button
                          type="button"
                          onClick={breakTimer.resetTimer}
                          className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                          title="Сброс таймера"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Interval Presets */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80">
                    <span className="text-xs font-semibold text-slate-400 mr-1">Интервалы:</span>
                    {[45, 60, 90, 120].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => breakTimer.startTimer(m)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                          breakTimer.intervalMinutes === m && breakTimer.isRunning
                            ? 'bg-cyan-400 text-slate-950 shadow-md shadow-cyan-400/20 font-black'
                            : 'bg-slate-950 text-slate-300 border border-slate-800 hover:text-white hover:bg-slate-800'
                        }`}
                      >
                        {m} мин
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={breakTimer.triggerTest10Sec}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition cursor-pointer ml-auto"
                      title="Быстрый тест сигнала и уведомления через 10 секунд"
                    >
                      ⚡ Тест 10 сек
                    </button>
                  </div>
                </div>

                {/* 2. Scheduled Workday Break Slots (Done vs Skipped tracking) */}
                <div className="p-5 rounded-3xl bg-slate-900/90 border border-cyan-500/30 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-extrabold uppercase tracking-wider text-cyan-400">
                        Расписание перерывов за компьютером на сегодня
                      </span>
                      <h3 className="text-xl font-black text-white mt-0.5">
                        Чек-лист активности во время работы (5–10 мин)
                      </h3>
                      <p className="text-xs text-slate-300 mt-0.5">
                        Отмечайте выполненные слоты или запускайте 5-минутный таймер прямо у рабочего стола.
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 self-start">
                      {([5, 7, 10] as const).map((min) => (
                        <button
                          key={min}
                          type="button"
                          onClick={() =>
                            setUserState((prev) => ({ ...prev, selectedDurationBreak: min }))
                          }
                          className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition ${
                            userState.selectedDurationBreak === min
                              ? 'bg-cyan-400 text-slate-950'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {min} мин
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3">
                    {userState.breakSlots.map((slot) => {
                      const isDone = slot.completedDates.includes(todayISO);
                      const isSkipped = slot.skippedDates.includes(todayISO);
                      const slotExercises = slot.exerciseIds
                        .map((id) => EXERCISES_DB.find((e) => e.id === id))
                        .filter((e): e is Exercise => Boolean(e));

                      return (
                        <div
                          key={slot.id}
                          className={`p-4 rounded-2xl border transition ${
                            isDone
                              ? 'bg-emerald-950/25 border-emerald-500/40'
                              : isSkipped
                              ? 'bg-rose-950/20 border-rose-500/35'
                              : 'bg-slate-950/80 border-slate-800'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="px-2.5 py-0.5 rounded-lg bg-cyan-500/20 text-cyan-300 font-mono font-bold text-xs">
                              ⏰ {slot.timeLabel}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleToggleBreakSlotStatus(slot.id, 'done')}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                                  isDone
                                    ? 'bg-emerald-500 text-slate-950'
                                    : 'bg-slate-800 text-slate-300 hover:bg-emerald-500/20 hover:text-emerald-300'
                                }`}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>{isDone ? 'Выполнено' : 'Сделал'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleBreakSlotStatus(slot.id, 'skipped')}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                                  isSkipped
                                    ? 'bg-rose-500 text-white'
                                    : 'bg-slate-800 text-slate-400 hover:bg-rose-500/20 hover:text-rose-300'
                                }`}
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Пропуск</span>
                              </button>
                            </div>
                          </div>

                          <h4 className="text-sm font-extrabold text-white mt-2">{slot.title}</h4>
                          <p className="text-xs text-slate-400 mt-0.5">{slot.focus}</p>

                          <button
                            type="button"
                            onClick={() =>
                              setActiveSession({
                                title: `${slot.timeLabel} — ${slot.title}`,
                                category: 'breaks',
                                exercises: slotExercises.length > 0 ? slotExercises : breakPlan.exercises,
                                slotIdToComplete: slot.id,
                              })
                            }
                            className="mt-3 w-full py-2.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 font-extrabold text-xs flex items-center justify-center gap-1.5 transition"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>Запустить этот перерыв по таймеру (3 упр.)</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between flex-wrap gap-3">
                    <span className="text-xs text-slate-300">
                      Полный сборник на сегодня ({breakPlan.exercises.length} упражнений • {breakPlan.estimatedMinutes} мин)
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveSession({
                          title: breakPlan.title,
                          category: 'breaks',
                          exercises: breakPlan.exercises,
                        })
                      }
                      className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-cyan-400 to-teal-500 text-slate-950 font-black text-xs shadow-lg"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>Запустить Полный Перерыв ({breakPlan.estimatedMinutes} мин)</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {breakPlan.exercises.map((ex: Exercise, idx: number) => (
                    <ExerciseDetailCard
                      key={ex.id}
                      exercise={ex}
                      index={idx}
                      isFavorite={userState.favoriteExerciseIds.includes(ex.id)}
                      onStartSingleExercise={(single) =>
                        setActiveSession({
                          title: single.titleRu,
                          category: 'breaks',
                          exercises: [single],
                        })
                      }
                      onToggleFavorite={(id) =>
                        setUserState((prev) => ({
                          ...prev,
                          favoriteExerciseIds: prev.favoriteExerciseIds.includes(id)
                            ? prev.favoriteExerciseIds.filter((f) => f !== id)
                            : [...prev.favoriteExerciseIds, id],
                        }))
                      }
                    />
                  ))}
                </div>
              </div>
            )}

            {/* CATEGORY C: WALKING PAD & SMART HYBRID MIXER */}
            {activeCategory === 'walking' && (
              <div className="space-y-6">
                {/* BLOCK 1: FAST START WALKING PROTOCOLS */}
                <div className="p-5 rounded-3xl bg-slate-900/90 border border-emerald-500/30 space-y-4 shadow-xl">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                        <Footprints className="w-4 h-4" />
                        Блок 1: Протоколы ходьбы на Walking Pad
                      </span>
                      <h3 className="text-xl font-black text-white mt-0.5">
                        Аэробная база без ударной нагрузки на суставы
                      </h3>
                      <p className="text-xs text-slate-300 mt-0.5">
                        Вес {userState.profile.currentWeightKg} кг: ходьба 5.0–5.6 км/ч сжигает свободные жирные кислоты и защищает диски L4-S1.
                      </p>
                    </div>

                    {/* Duration Selector: 15 / 20 / 30 / 45 min */}
                    <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 self-start">
                      {([15, 20, 30, 45] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setSelectedWalkingDuration(m)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                            selectedWalkingDuration === m
                              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {m} мин
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 4 Protocol Cards Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      {
                        id: 'zone2' as const,
                        title: '1. Жиросжигание в Зоне 2',
                        speed: '5.0 – 5.6 км/ч',
                        badge: '🔥 Макс. окисление жиров',
                        desc: 'Разговорный темп (ЧСС 110–125 уд). Идеально для утилизации висцерального жира без кортизола.',
                      },
                      {
                        id: 'intervals' as const,
                        title: '2. Спортивный темповый шаг',
                        speed: '5.8 – 6.4 км/ч',
                        badge: '⚡ Кардио-интервалы',
                        desc: 'Чередование ускорений 6.0 км/ч с ЗCross-training темпом. Разгон VO2 Max и метаболизма на 24 часа.',
                      },
                      {
                        id: 'after_meal' as const,
                        title: '3. Сахарный насос после еды',
                        speed: '4.8 – 5.3 км/ч',
                        badge: '🩸 GLUT-4 утилизация',
                        desc: 'Включение камбаловидной мышцы (Soleus) через 20 мин после еды: снижает пик глюкозы на 35%.',
                      },
                      {
                        id: 'recovery' as const,
                        title: '4. Восстановление спины',
                        speed: '3.5 – 4.5 км/ч',
                        badge: '🛡 Декомпрессия дисков',
                        desc: 'Мягкий разгрузочный шаг для дней отдыха. Снимает отек и венозный застой после рабочего дня.',
                      },
                    ].map((proto) => {
                      const isSel = selectedWalkingProtocol === proto.id;
                      const dummyPlan = generateWalkingWorkout(proto.id, selectedWalkingDuration, userState.profile.currentWeightKg);
                      return (
                        <div
                          key={proto.id}
                          onClick={() => setSelectedWalkingProtocol(proto.id)}
                          className={`p-4 rounded-2xl border transition cursor-pointer space-y-2.5 ${
                            isSel
                              ? 'bg-emerald-950/30 border-emerald-500/60 shadow-lg shadow-emerald-500/10'
                              : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-black text-white">{proto.title}</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                              {proto.speed}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 leading-snug">{proto.desc}</p>
                          <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[11px] text-slate-400">
                            <span>🚶 ~{dummyPlan.walkingStats?.estimatedSteps} шагов</span>
                            <span>📏 ~{dummyPlan.walkingStats?.estimatedDistanceKm} км</span>
                            <span className="font-bold text-amber-400">~{dummyPlan.estimatedKcal} ккал</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Start Walking Button */}
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3 text-xs text-slate-300">
                      <span>Итог: <strong>{walkingPlan.estimatedMinutes} мин</strong></span>
                      <span>•</span>
                      <span>Шаги: <strong className="text-emerald-400">{walkingPlan.walkingStats?.estimatedSteps}</strong></span>
                      <span>•</span>
                      <span>Дистанция: <strong className="text-cyan-400">{walkingPlan.walkingStats?.estimatedDistanceKm} км</strong></span>
                      <span>•</span>
                      <span>Расход: <strong className="text-amber-400">~{walkingPlan.estimatedKcal} ккал</strong></span>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setActiveSession({
                          title: walkingPlan.title,
                          category: 'walking',
                          exercises: walkingPlan.exercises,
                        })
                      }
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/20 transition cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>Запустить Протокол на Дорожке ({walkingPlan.estimatedMinutes} мин)</span>
                    </button>
                  </div>
                </div>

                {/* BLOCK 2: SMART WORKOUT MIXER */}
                <div className="p-5 rounded-3xl bg-slate-900/90 border border-teal-500/30 space-y-4 shadow-xl">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-extrabold uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4" />
                        Блок 2: Умный Микшер «Дорожка + Гири / Резинки»
                      </span>
                      <h3 className="text-xl font-black text-white mt-0.5">
                        Конструктор гибридных кардио-силовых тренировок
                      </h3>
                      <p className="text-xs text-slate-300 mt-0.5">
                        Совмещайте аэробную работу на дорожке с силовым фундаментом под текущий день и цели.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleAutoRecommendMix}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/40 text-teal-300 text-xs font-black transition cursor-pointer self-start"
                      title="Автоматический подбор оптимального микса под день недели и вес 110 кг"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                      <span>✨ Подобрать под день недели и вес</span>
                    </button>
                  </div>

                  {/* 1. Goal Selector */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      1. Цель тренировки на сегодня:
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { id: 'fatburn' as const, label: '🔥 Жиросжигание' },
                        { id: 'strength_cardio' as const, label: '💪 Сила + Кардио' },
                        { id: 'recovery' as const, label: '🛡 Восстановление' },
                        { id: 'glucose_control' as const, label: '🩸 Контроль сахара' },
                      ].map((g) => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => setMixGoal(g.id)}
                          className={`py-2 px-3 rounded-xl text-xs font-extrabold transition cursor-pointer border ${
                            mixGoal === g.id
                              ? 'bg-teal-500 text-slate-950 border-teal-400 shadow-md shadow-teal-500/20'
                              : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                          }`}
                        >
                          {g.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 2. Structure Selector */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      2. Структура занятия:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[
                        {
                          id: 'walk_then_kb' as const,
                          label: '🚶➔🏋️ Ходьба ➔ Сила с гирями',
                          hint: '12 мин разогрева на дорожке + силовой блок (Присед, Тяга, Жим)',
                        },
                        {
                          id: 'kb_then_walk' as const,
                          label: '🏋️➔🚶 Гири ➔ Кардио-финишер',
                          hint: 'Мобилизация жирных кислот махами 16 кг ➔ 15 мин ходьбы в Зоне 2',
                        },
                        {
                          id: 'circuit_5_2' as const,
                          label: '🔄 Круговой микс 4+1 (Без скуки)',
                          hint: 'Раунды: 4 мин бодрый шаг ➔ 1 упражнение с гирей/резинкой (3-4 круга)',
                        },
                        {
                          id: 'walking_only' as const,
                          label: '🚶 Только дорожка для ходьбы',
                          hint: 'Чистая непрерывная кардио-сессия без отягощений в Зоне 2',
                        },
                      ].map((st) => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => setMixStructure(st.id)}
                          className={`p-3 rounded-xl text-left border transition cursor-pointer space-y-0.5 ${
                            mixStructure === st.id
                              ? 'bg-teal-950/40 border-teal-500/70 shadow-md shadow-teal-500/10'
                              : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className={`text-xs font-black ${mixStructure === st.id ? 'text-teal-300' : 'text-slate-300'}`}>
                            {st.label}
                          </div>
                          <div className="text-[11px] text-slate-400">{st.hint}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 3. Duration & Equipment */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-400 uppercase">Общее время:</span>
                      <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                        {([25, 35, 45] as const).map((dur) => (
                          <button
                            key={dur}
                            type="button"
                            onClick={() => setMixDuration(dur)}
                            className={`px-3 py-1 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                              mixDuration === dur
                                ? 'bg-teal-500 text-slate-950'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            {dur} мин
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                        <input
                          type="checkbox"
                          checked={mixIncludeKettlebells}
                          onChange={(e) => setMixIncludeKettlebells(e.target.checked)}
                          className="w-4 h-4 rounded text-teal-500 bg-slate-950 border-slate-700"
                        />
                        <span>Гири 16/24 кг</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                        <input
                          type="checkbox"
                          checked={mixIncludeBands}
                          onChange={(e) => setMixIncludeBands(e.target.checked)}
                          className="w-4 h-4 rounded text-teal-500 bg-slate-950 border-slate-700"
                        />
                        <span>Фитнес-резинки</span>
                      </label>
                    </div>
                  </div>

                  {/* Hybrid Plan Preview & Launch Button */}
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-400">
                          {hybridPlan.walkingStats?.protocolBadge || 'Гибридный микс'}
                        </span>
                        <h4 className="text-base font-black text-white">{hybridPlan.title}</h4>
                        <p className="text-xs text-slate-300 mt-0.5">{hybridPlan.coachFocus}</p>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-300 shrink-0">
                        {hybridPlan.walkingStats?.estimatedSteps ? (
                          <span className="font-bold text-emerald-400">🚶 {hybridPlan.walkingStats.estimatedSteps} шагов</span>
                        ) : null}
                        <span className="font-bold text-amber-400">🔥 ~{hybridPlan.estimatedKcal} ккал</span>
                      </div>
                    </div>

                    {/* Exercise Chain Preview Chips */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {hybridPlan.exercises.map((ex, idx) => (
                        <span
                          key={`${ex.id}-${idx}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300"
                        >
                          <span className="text-teal-400 font-bold">{idx + 1}.</span>
                          <span className="truncate max-w-[150px] sm:max-w-xs">{ex.titleRu}</span>
                          <span className="text-slate-500 font-mono">({ex.defaultSeconds}с)</span>
                        </span>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setActiveSession({
                          title: hybridPlan.title,
                          category: 'walking',
                          exercises: hybridPlan.exercises,
                        })
                      }
                      className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-teal-400 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 text-slate-950 font-black text-sm shadow-xl shadow-teal-500/20 flex items-center justify-center gap-2 cursor-pointer transition"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>Начать гибридную тренировку ({hybridPlan.estimatedMinutes} мин)</span>
                    </button>
                  </div>
                </div>

                {/* Exercise detail cards for walking protocols */}
                <div className="space-y-3">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 px-1">
                    Биомеханика шага и разминка протоколов:
                  </h4>
                  {walkingPlan.exercises.map((ex, idx) => (
                    <ExerciseDetailCard
                      key={`${ex.id}-${idx}`}
                      exercise={ex}
                      index={idx}
                      isFavorite={userState.favoriteExerciseIds.includes(ex.id)}
                      onStartSingleExercise={(single) =>
                        setActiveSession({
                          title: single.titleRu,
                          category: 'walking',
                          exercises: [single],
                        })
                      }
                      onToggleFavorite={(id) =>
                        setUserState((prev) => ({
                          ...prev,
                          favoriteExerciseIds: prev.favoriteExerciseIds.includes(id)
                            ? prev.favoriteExerciseIds.filter((f) => f !== id)
                            : [...prev.favoriteExerciseIds, id],
                        }))
                      }
                    />
                  ))}
                </div>
              </div>
            )}

            {/* CATEGORY D: KETTLEBELLS (16kg / 24kg), BANDS & CALISTHENICS */}
            {activeCategory === 'kettlebell' && (
              <div className="space-y-5">
                {/* Weekly Schedule by Days */}
                <div className="p-5 rounded-3xl bg-slate-900/90 border border-rose-500/30 space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <span className="text-xs font-extrabold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        Недельное расписание Тренера (Гири 16/24 кг + Восстановление)
                      </span>
                      <h3 className="text-lg sm:text-xl font-black text-white mt-0.5">
                        Чередование силовых дней и разгрузки поясницы
                      </h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-7 gap-2">
                    {KETTLEBELL_WEEKLY_SCHEDULE.map((dayItem) => {
                      const isToday = new Date().getDay() === dayItem.dayNumber;
                      const isSelected = userState.selectedKettlebellProgram === dayItem.programKey;
                      return (
                        <button
                          key={dayItem.dayShort}
                          type="button"
                          onClick={() =>
                            setUserState((prev) => ({
                              ...prev,
                              selectedKettlebellProgram: dayItem.programKey,
                            }))
                          }
                          className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                            isSelected
                              ? 'bg-rose-500/20 border-rose-500 text-white shadow-lg'
                              : isToday
                              ? 'bg-amber-500/15 border-amber-500/50 text-slate-100'
                              : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="text-xs font-black">{dayItem.dayShort}</span>
                            {isToday && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 text-[9px] font-black">
                                СЕГОДНЯ
                              </span>
                            )}
                          </div>
                          <div className="mt-2">
                            <div
                              className={`text-[10px] font-bold ${
                                dayItem.type === 'kettlebell' ? 'text-rose-400' : 'text-emerald-400'
                              }`}
                            >
                              {dayItem.badge}
                            </div>
                            <div className="text-[11px] font-semibold text-slate-200 line-clamp-2 mt-0.5">
                              {dayItem.title}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* 4 Kettlebell Protocol Switcher */}
                  <div className="grid sm:grid-cols-4 gap-2 pt-2">
                    {[
                      { id: 'foundation-16', label: 'День А: База 16/24 кг' },
                      { id: 'fatburn-flow', label: 'День Б: Жиросжигание & Flow' },
                      { id: 'power-24', label: 'День В: Тяжёлая Сила 24 кг' },
                      { id: 'spine-armor', label: 'День Г: Коврик & Резинки' },
                    ].map((prog) => (
                      <button
                        key={prog.id}
                        type="button"
                        onClick={() =>
                          setUserState((prev) => ({
                            ...prev,
                            selectedKettlebellProgram: prog.id as UserState['selectedKettlebellProgram'],
                          }))
                        }
                        className={`py-2.5 px-3 rounded-xl text-xs font-extrabold border transition ${
                          userState.selectedKettlebellProgram === prog.id
                            ? 'bg-gradient-to-r from-rose-500 to-amber-500 border-transparent text-white'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {prog.label}
                      </button>
                    ))}
                  </div>

                  {/* Selected Day Workout Summary & Launch */}
                  <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h4 className="text-base font-black text-white">{kettlebellPlan.title}</h4>
                      <p className="text-xs text-slate-300">{kettlebellPlan.coachFocus}</p>
                      <div className="flex items-center gap-4 text-xs text-amber-400 font-bold pt-1">
                        <span>⏱ ~{kettlebellPlan.estimatedMinutes} мин</span>
                        <span>🔥 ~{kettlebellPlan.estimatedKcal} ккал</span>
                        <span>🏋️ {kettlebellPlan.exercises.length} упражнений</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setActiveSession({
                          title: kettlebellPlan.title,
                          category: 'kettlebell',
                          exercises: kettlebellPlan.exercises,
                        })
                      }
                      className="shrink-0 inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-gradient-to-r from-rose-500 to-amber-500 hover:opacity-95 text-white font-black text-sm shadow-xl shadow-rose-500/25 transition"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>Начать Тренировку с Гирей</span>
                    </button>
                  </div>
                </div>

                {/* Exercises in Today's Kettlebell Complex */}
                <div className="space-y-3">
                  {kettlebellPlan.exercises.map((ex, idx) => (
                    <ExerciseDetailCard
                      key={ex.id}
                      exercise={ex}
                      index={idx}
                      isFavorite={userState.favoriteExerciseIds.includes(ex.id)}
                      onStartSingleExercise={(single) =>
                        setActiveSession({
                          title: single.titleRu,
                          category: 'kettlebell',
                          exercises: [single],
                        })
                      }
                      onToggleFavorite={(id) =>
                        setUserState((prev) => ({
                          ...prev,
                          favoriteExerciseIds: prev.favoriteExerciseIds.includes(id)
                            ? prev.favoriteExerciseIds.filter((f) => f !== id)
                            : [...prev.favoriteExerciseIds, id],
                        }))
                      }
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===================================================================
            SUB-VIEW 3: БИБЛИОТЕКА (Complete Exercise Library + Instagram Vault)
           =================================================================== */}
        {activeSubView === 'library' && (
          <div className="space-y-5">
            {/* Search & Equipment Filter Bar */}
            <div className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Поиск по названию, мышцам, школе (McGill, StrongFirst, махи, поясница)..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setShowOnlyFavorites((v) => !v)}
                  className={`px-4 py-2.5 rounded-2xl border text-xs font-bold transition ${
                    showOnlyFavorites
                      ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  ♥ Избранные
                </button>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0 mr-1" />
                {(activeCategory === 'morning'
                  ? [
                      { id: 'all', label: 'Вся утренняя зарядка' },
                      { id: 'bodyweight', label: 'Собственный вес (без инвентаря)' },
                      { id: 'mat', label: 'Коврик для йоги' },
                      { id: 'bands', label: 'Фитнес-резинка' },
                    ]
                  : activeCategory === 'breaks'
                  ? [
                      { id: 'all', label: 'Все офисные перерывы' },
                      { id: 'bodyweight', label: 'Стол / Стул / Стена' },
                      { id: 'bands', label: 'Фитнес-резинка' },
                    ]
                  : activeCategory === 'walking'
                  ? [
                      { id: 'all', label: 'Вся ходьба на дорожке' },
                      { id: 'walking-pad', label: 'Walking Pad' },
                      { id: 'bands', label: 'С фитнес-резинкой' },
                    ]
                  : [
                      { id: 'all', label: 'Все силовые и гири' },
                      { id: 'kb16', label: 'Гиря 16 кг' },
                      { id: 'kb24', label: 'Гиря 24 кг' },
                      { id: 'bands', label: 'Тяжёлая резина' },
                      { id: 'bodyweight', label: 'Калистеника / Вес тела' },
                      { id: 'mat', label: 'Коврик' },
                    ]
                ).map((eq) => (
                  <button
                    key={eq.id}
                    type="button"
                    onClick={() => setSelectedEquipment(eq.id as EquipmentId | 'all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                      selectedEquipment === eq.id
                        ? 'bg-amber-500 text-slate-950 shadow'
                        : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {eq.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Kettlebell Library: Switch between 12 Curated Complexes vs All 69 Individual Exercises */}
            {activeCategory === 'kettlebell' && (
              <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-950 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setKettlebellLibMode('complexes')}
                  className={`flex-1 py-2 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 ${
                    kettlebellLibMode === 'complexes'
                      ? 'bg-rose-500 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Dumbbell className="w-3.5 h-3.5" />
                  <span>12 Готовых Комплексов</span>
                </button>
                <button
                  type="button"
                  onClick={() => setKettlebellLibMode('exercises')}
                  className={`flex-1 py-2 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 ${
                    kettlebellLibMode === 'exercises'
                      ? 'bg-rose-500 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Все упражнения поштучно ({filteredLibraryExercises.length})</span>
                </button>
              </div>
            )}

            {/* View A: 12 Full Training Complexes with step-by-step workouts */}
            {activeCategory === 'kettlebell' && kettlebellLibMode === 'complexes' && (
              <div className="space-y-4">
                <div className="p-4 rounded-3xl bg-slate-900/90 border border-rose-500/30">
                  <h3 className="text-sm font-extrabold text-white">
                    12 Готовых Программ с Гирями и Калистеникой
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Каждый комплекс сбалансирован по мышцам-антагонистам, защищает поясницу и запускается в таймере с паузами.
                  </p>
                </div>

                <div className="space-y-3.5">
                  {KETTLEBELL_COMPLEXES_DB.map((cplx) => (
                    <div
                      key={cplx.id}
                      className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-3.5 hover:border-slate-700 transition"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[11px] font-extrabold">
                              Комплекс #{cplx.number}
                            </span>
                            <span className="text-xs text-slate-400 font-semibold">
                              {cplx.rounds} раунда • отдых {cplx.restBetweenRoundsSeconds} сек
                            </span>
                          </div>
                          <h4 className="text-base font-extrabold text-white mt-1">
                            {cplx.title}
                          </h4>
                          <p className="text-xs text-amber-300/90 mt-0.5 font-medium">
                            Фокус: {cplx.focus}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            const cplxExercises = cplx.exercises
                              .map((item) => EXERCISES_DB.find((e) => e.id === item.exerciseId))
                              .filter((e): e is Exercise => Boolean(e));
                            setActiveSession({
                              title: cplx.title,
                              category: 'kettlebell',
                              exercises: cplxExercises.length > 0 ? cplxExercises : [EXERCISES_DB[0]],
                            });
                          }}
                          className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-white font-extrabold text-xs shadow-lg shadow-rose-500/20 transition"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Запустить тренировку по комплексу</span>
                        </button>
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed">
                        {cplx.description}
                      </p>

                      {/* Exercises inside complex */}
                      <div className="space-y-2 pt-2 border-t border-slate-800">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          Упражнения в одном раунде:
                        </div>
                        <div className="grid sm:grid-cols-3 gap-2">
                          {cplx.exercises.map((item, i) => (
                            <div
                              key={item.exerciseId + i}
                              className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-1"
                            >
                              <div className="flex items-center justify-between text-xs font-bold text-white">
                                <span>{i + 1}. {item.titleRu}</span>
                              </div>
                              <div className="text-[11px] text-amber-400 font-semibold">{item.reps}</div>
                              <div className="text-[10px] text-slate-400 leading-snug">{item.coachTip}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* View B: Individual Exercise Cards List (for Morning, Breaks, or Kettlebell Single mode) */}
            {(activeCategory !== 'kettlebell' || kettlebellLibMode === 'exercises') && (
              filteredLibraryExercises.length > 0 ? (
                <div className="space-y-3">
                  {filteredLibraryExercises.map((ex, idx) => (
                    <ExerciseDetailCard
                      key={ex.id}
                      exercise={ex}
                      index={idx}
                      isFavorite={userState.favoriteExerciseIds.includes(ex.id)}
                      onStartSingleExercise={(single) =>
                        setActiveSession({
                          title: single.titleRu,
                          category: single.category,
                          exercises: [single],
                        })
                      }
                      onToggleFavorite={(id) =>
                        setUserState((prev) => ({
                          ...prev,
                          favoriteExerciseIds: prev.favoriteExerciseIds.includes(id)
                            ? prev.favoriteExerciseIds.filter((f) => f !== id)
                            : [...prev.favoriteExerciseIds, id],
                        }))
                      }
                    />
                  ))}
                </div>
              ) : (
                <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 text-center flex flex-col items-center justify-center space-y-3 my-4">
                  <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-center text-slate-400">
                    <Search className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-white">Упражнения не найдены</h4>
                    <p className="text-xs text-slate-400 max-w-sm mt-1">
                      {searchQuery
                        ? `По запросу «${searchQuery}» ничего не найдено в текущей категории.`
                        : 'В выбранной категории нет упражнений с активными фильтрами.'}
                    </p>
                  </div>
                  {(searchQuery || selectedEquipment !== 'all' || showOnlyFavorites) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedEquipment('all');
                        setShowOnlyFavorites(false);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition shadow-sm"
                    >
                      <span>Сбросить все фильтры и поиск</span>
                    </button>
                  )}
                </div>
              )
            )}
          </div>
        )}
      </main>

      {/* Bottom Sticky Navbar: 1. Зарядка | 2. Перерывы | 3. Ходьба | 4. Гири */}
      <nav
        aria-label="Главное меню категорий"
        className="fixed bottom-0 inset-x-0 z-40 border-t border-slate-800/90 bg-[#090D16]/95 backdrop-blur-xl"
      >
        <div className="max-w-xl mx-auto px-3 sm:px-4 py-2 grid grid-cols-4 gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveCategory('morning');
              setSelectedEquipment('all');
            }}
            className={`flex flex-col items-center justify-center py-2 px-1 sm:px-3 rounded-2xl transition ${
              activeCategory === 'morning'
                ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300 shadow-lg'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sun className="w-5 h-5" />
            <span className="text-xs font-extrabold mt-1">Зарядка</span>
            <span className="text-[10px] opacity-75">10–20 мин</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveCategory('breaks');
              setSelectedEquipment('all');
            }}
            className={`flex flex-col items-center justify-center py-2 px-1 sm:px-3 rounded-2xl transition ${
              activeCategory === 'breaks'
                ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 shadow-lg'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Monitor className="w-5 h-5" />
            <span className="text-xs font-extrabold mt-1">Перерывы</span>
            <span className="text-[10px] opacity-75">5–10 мин</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveCategory('walking');
              setSelectedEquipment('all');
            }}
            className={`flex flex-col items-center justify-center py-2 px-1 sm:px-3 rounded-2xl transition ${
              activeCategory === 'walking'
                ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 shadow-lg'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Footprints className="w-5 h-5" />
            <span className="text-xs font-extrabold mt-1">Ходьба</span>
            <span className="text-[10px] opacity-75">Walking Pad</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveCategory('kettlebell');
              setSelectedEquipment('all');
            }}
            className={`flex flex-col items-center justify-center py-2 px-1 sm:px-3 rounded-2xl transition ${
              activeCategory === 'kettlebell'
                ? 'bg-rose-500/20 border border-rose-500/40 text-rose-300 shadow-lg'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Dumbbell className="w-5 h-5" />
            <span className="text-xs font-extrabold mt-1">Гири</span>
            <span className="text-[10px] opacity-75">16/24 кг</span>
          </button>
        </div>
      </nav>

      {/* Unfinished Workout Recovery Banner (Task 2) */}
      {workoutBackup && !activeSession && (
        <div className="fixed top-4 left-4 right-4 z-50 max-w-lg mx-auto bg-slate-900/95 border-2 border-amber-500/70 rounded-3xl p-4 sm:p-5 shadow-2xl backdrop-blur-xl animate-fadeIn space-y-3.5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0 text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400">
                Защита прогресса от перезагрузки
              </span>
              <h4 className="text-sm sm:text-base font-extrabold text-white">
                Обнаружена незавершенная тренировка
              </h4>
              <p className="text-xs text-slate-300">
                «{workoutBackup.activeSession.title}» • Упражнение {workoutBackup.currentIndex + 1} из {workoutBackup.activeSession.exercises.length}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setActiveSession(workoutBackup.activeSession);
                setActiveSessionBackupToRestore(workoutBackup);
                setWorkoutBackup(null);
              }}
              className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Продолжить тренировку</span>
            </button>

            <button
              type="button"
              onClick={() => {
                try {
                  localStorage.removeItem(ACTIVE_BACKUP_STORAGE_KEY);
                } catch {
                  // ignore
                }
                setWorkoutBackup(null);
              }}
              className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white font-bold text-xs transition cursor-pointer"
            >
              Сбросить
            </button>
          </div>
        </div>
      )}

      {/* Active Workout Timer & Step-by-Step Player Modal */}
      {activeSession && (
        <ActiveWorkoutModal
          title={activeSession.title}
          category={activeSession.category}
          exercises={activeSession.exercises}
          slotIdToComplete={activeSession.slotIdToComplete}
          initialBackup={activeSessionBackupToRestore}
          userWeightKg={userState.profile.currentWeightKg}
          soundEnabled={userState.reminders.soundEnabled}
          onToggleSound={() =>
            setUserState((prev) => ({
              ...prev,
              reminders: { ...prev.reminders, soundEnabled: !prev.reminders.soundEnabled },
            }))
          }
          onClose={() => {
            setActiveSession(null);
            setActiveSessionBackupToRestore(null);
          }}
          onCompleteSession={(payload) => {
            handleCompleteWorkoutSession(payload);
            setActiveSession(null);
            setActiveSessionBackupToRestore(null);
            try {
              localStorage.removeItem(ACTIVE_BACKUP_STORAGE_KEY);
            } catch {
              // ignore
            }
          }}
        />
      )}

      {/* Account (Google Sync), Weight Tracker, Reminders & APK Modal */}
      {settingsOpen && (
        <AccountAndSettingsModal
          userState={userState}
          onClose={() => setSettingsOpen(false)}
          onConnectGoogle={(googleProfile) =>
            setUserState((prev) => ({ ...prev, googleUser: googleProfile }))
          }
          onDisconnectGoogle={() =>
            setUserState((prev) => ({ ...prev, googleUser: null }))
          }
          onUpdateWeight={(newWeightKg) =>
            setUserState((prev) => ({
              ...prev,
              profile: { ...prev.profile, currentWeightKg: newWeightKg },
              weightHistory: [
                ...prev.weightHistory,
                { dateISO: todayISO, weightKg: newWeightKg },
              ],
            }))
          }
          onUpdateReminders={(reminders) =>
            setUserState((prev) => ({ ...prev, reminders }))
          }
          onImportState={(imported) => setUserState(imported)}
          onTriggerTestNotification={triggerTestReminder}
        />
      )}
      {/* Work-Break Prompt Modal Overlay */}
      {breakTimer.showPrompt && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-[#0D1322] border-2 border-cyan-500/60 p-6 space-y-5 shadow-2xl text-center animate-fadeIn">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-tr from-cyan-500 to-teal-400 flex items-center justify-center shadow-lg shadow-cyan-500/25 animate-bounce">
              <Sparkles className="w-9 h-9 text-slate-950" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-black text-white">Время разгрузить спину и глаза!</h3>
              <p className="text-xs text-slate-300">
                Вы непрерывно работали за компьютером. 3–5 минут лёгкой разминки предотвратят спазм трапеций и застой в тазу.
              </p>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  breakTimer.dismissPrompt();
                  setActiveSession({
                    title: breakPlan.title,
                    category: 'breaks',
                    exercises: breakPlan.exercises,
                  });
                }}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-400 to-teal-400 hover:from-cyan-300 hover:to-teal-300 text-slate-950 font-black text-sm shadow-xl shadow-cyan-500/25 flex items-center justify-center gap-2 cursor-pointer transition"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Начать перерыв сейчас ({userState.selectedDurationBreak} мин)</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => breakTimer.snooze(10)}
                  className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer"
                >
                  ⏱ Отложить на 10 мин
                </button>
                <button
                  type="button"
                  onClick={breakTimer.dismissPrompt}
                  className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-bold transition cursor-pointer"
                >
                  ✕ Пропустить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default App;
