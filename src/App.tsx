import { useEffect, useMemo, useRef, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import {
  Exercise,
  ExerciseCategory,
  SubView,
  UserState,
  ActiveWorkoutBackup,
} from './types/fitness';
import { EXERCISES_DB, KETTLEBELL_COMPLEXES_DB, KettlebellComplex } from './data/exercises';
import {
  generateBreakWorkout,
  generateKettlebellWorkout,
  generateMorningWorkout,
  getTodayISO,
  KETTLEBELL_WEEKLY_SCHEDULE,
} from './utils/workoutBuilder';
import { MotivationScalesPanel } from './components/MotivationScalesPanel';
import { WalkingTabPanel } from './components/WalkingTabPanel';
import { ExerciseDetailCard } from './components/ExerciseDetailCard';
import { ActiveWorkoutModal } from './components/ActiveWorkoutModal';
import { AccountAndSettingsModal } from './components/AccountAndSettingsModal';
import { LibraryBrowser } from './components/LibraryBrowser';
import { ExerciseDetailSheet } from './components/ExerciseDetailSheet';
import { OnboardingFlow } from './components/OnboardingFlow';
import { soundEngine } from './utils/soundEngine';
import { useBreakReminderTimer } from './hooks/useBreakReminderTimer';
import { checkScheduledReminders } from './utils/notificationScheduler';
import { buildSessionForAction, parseStartAction } from './utils/deepLink';
import { loadUserState, migrateUserState, requestPersistentStorage, STORAGE_KEY } from './utils/userState';
import { syncNativeReminders } from './utils/nativeReminders';
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
  CheckCircle2,
  XCircle,
  Clock,
  Flame,
  Calendar,
  Scale,
  Settings,
} from 'lucide-react';

const CATEGORIES: ExerciseCategory[] = ['morning', 'breaks', 'walking', 'kettlebell'];

interface NavSnap {
  titan: true;
  category: ExerciseCategory;
  view: SubView;
  settings: boolean;
  sheet: string | null;
  workout: boolean;
}

export function App() {
  const [userState, setUserState] = useState<UserState>(() => loadUserState());

  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const initialCat = (params?.get('cat') as ExerciseCategory) || 'morning';
  const initialSub = (params?.get('sub') as SubView) || 'today';
  const initialModal = params?.get('modal');

  // Main bottom navbar pillar: 'morning' | 'breaks' | 'kettlebell'
  const [activeCategory, setActiveCategory] = useState<ExerciseCategory>(
    CATEGORIES.includes(initialCat) ? initialCat : 'morning'
  );
  // Sub-branch inside each pillar: 'today' | 'progress' | 'library'
  const [activeSubView, setActiveSubView] = useState<SubView>(
    ['today', 'progress', 'library'].includes(initialSub) ? initialSub : 'today'
  );

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

  // Settings / reminders modal
  const [settingsOpen, setSettingsOpen] = useState(initialModal === 'settings');
  const [openExerciseId, setOpenExerciseId] = useState<string | null>(null);
  // Toast notification for reminders
  const [reminderBanner, setReminderBanner] = useState<string | null>(null);
  const pendingAction = useRef(parseStartAction(params?.get('action') || null));
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

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
    if (!userState.profile.onboarded) return;
    const interval = setInterval(() => {
      checkScheduledReminders(userState.reminders, userState.breakSlots, (_type, title) => {
        soundEngine.playStartBell();
        setReminderBanner(`Напоминание: ${title}. Оно сработало, потому что Титан открыт.`);
      });
    }, 15000);
    return () => clearInterval(interval);
  }, [userState.reminders, userState.breakSlots, userState.profile.onboarded]);

  useEffect(() => {
    if (!userState.profile.onboarded) return;
    void syncNativeReminders(userState.reminders, userState.breakSlots);
  }, [userState.reminders, userState.breakSlots, userState.profile.onboarded]);

  useEffect(() => {
    if (!userState.profile.onboarded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userState));
    } catch {
      // ignore storage quota
    }
    requestPersistentStorage();
  }, [userState]);

  const navState = (patch: Partial<NavSnap> = {}): NavSnap => ({
    titan: true,
    category: patch.category ?? activeCategory,
    view: patch.view ?? activeSubView,
    settings: patch.settings ?? false,
    sheet: patch.sheet === undefined ? null : patch.sheet,
    workout: patch.workout ?? false,
  });

  useEffect(() => {
    const onPop = (event: PopStateEvent) => {
      const snap = event.state as NavSnap | null;
      if (!snap?.titan) return;
      setActiveCategory(snap.category);
      setActiveSubView(snap.view);
      setSettingsOpen(Boolean(snap.settings));
      setOpenExerciseId(snap.sheet);
      if (!snap.workout) {
        setActiveSession(null);
        setActiveSessionBackupToRestore(null);
      }
    };
    window.addEventListener('popstate', onPop);
    const base = navState();
    if (settingsOpen) {
      history.replaceState({ ...base, settings: false }, '');
      history.pushState({ ...base, settings: true }, '');
    } else {
      history.replaceState(base, '');
    }
    return () => window.removeEventListener('popstate', onPop);
    // History root is captured once so the first Android Back stays inside the app.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!userState.profile.onboarded || !pendingAction.current) return;
    const action = pendingAction.current;
    pendingAction.current = null;
    const session = buildSessionForAction(action, userState, new Date(), morningNoMatMode);
    const url = new URL(window.location.href);
    url.searchParams.delete('action');
    const nextUrl = `${url.pathname}${url.search}`;
    if (!session) {
      history.replaceState(history.state, '', nextUrl);
      return;
    }
    setActiveCategory(session.category);
    setActiveSubView('today');
    setActiveSession({
      title: session.title,
      category: session.category,
      exercises: session.exercises,
      slotIdToComplete: session.slotIdToComplete,
    });
    const base: NavSnap = {
      titan: true,
      category: session.category,
      view: 'today',
      settings: false,
      sheet: null,
      workout: false,
    };
    history.replaceState(base, '', nextUrl);
    history.pushState({ ...base, workout: true }, '', nextUrl);
    // Launch the notification target once, after the profile exists.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userState.profile.onboarded]);

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
      badge: `Офис • ${userState.breakSlots.length} слотов в день`,
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

  const openExercise = EXERCISES_DB.find((exercise) => exercise.id === openExerciseId) || null;

  const updateBreakSlot = (slotId: string, patch: { timeLabel?: string; enabled?: boolean }) => {
    setUserState((prev) => {
      const breakSlots = prev.breakSlots.map((slot) =>
        slot.id === slotId ? { ...slot, timeLabel: patch.timeLabel || slot.timeLabel } : slot
      );
      const slot = breakSlots.find((item) => item.id === slotId);
      return {
        ...prev,
        breakSlots,
        reminders: {
          ...prev.reminders,
          breakSlotsConfig: {
            ...prev.reminders.breakSlotsConfig,
            [slotId]: {
              enabled: patch.enabled ?? prev.reminders.breakSlotsConfig?.[slotId]?.enabled ?? true,
              time: slot?.timeLabel || '12:00',
            },
          },
        },
      };
    });
  };

  const addBreakSlot = () => {
    const id = `slot-custom-${Date.now()}`;
    setUserState((prev) => ({
      ...prev,
      breakSlots: [
        ...prev.breakSlots,
        {
          id,
          timeLabel: '15:00',
          title: 'Дополнительный перерыв',
          focus: 'Короткая разгрузка, которую вы сами поставили в расписание',
          exerciseIds: ['brk-doorway-pec-opener', 'brk-neck-upper-trap-lateral-stretch', 'brk-dead-hang'],
          completedDates: [],
          skippedDates: [],
        },
      ],
      reminders: {
        ...prev.reminders,
        breakSlotsConfig: {
          ...prev.reminders.breakSlotsConfig,
          [id]: { enabled: true, time: '15:00' },
        },
      },
    }));
  };

  const removeBreakSlot = (slotId: string) => {
    if (!slotId.startsWith('slot-custom-')) return;
    setUserState((prev) => {
      const breakSlotsConfig = { ...prev.reminders.breakSlotsConfig };
      delete breakSlotsConfig[slotId];
      return {
        ...prev,
        breakSlots: prev.breakSlots.filter((slot) => slot.id !== slotId),
        reminders: { ...prev.reminders, breakSlotsConfig },
      };
    });
  };

  if (!userState.profile.onboarded) {
    return (
      <OnboardingFlow
        onComplete={(next) => {
          setUserState(next);
          requestPersistentStorage();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 pb-28">
      {needRefresh && (
        <div className="sticky top-0 z-50 bg-amber-400 text-slate-950 px-4 py-2 flex items-center justify-between gap-3 text-sm font-bold">
          <span>Доступно обновление Титана</span>
          <button type="button" className="underline" onClick={() => updateServiceWorker(true)}>
            Обновить
          </button>
          <button type="button" aria-label="Скрыть" onClick={() => setNeedRefresh(false)}>
            ✕
          </button>
        </div>
      )}
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
                  TITAN{' '}
                  <span className="text-amber-400">
                    {userState.profile.currentWeightKg || '—'}→{userState.profile.targetWeightKg || '—'}
                  </span>
                </h1>
              </div>
              <p className="text-xs text-slate-400">
                {userState.profile.name ? `${userState.profile.name} · ` : ''}
                {userState.profile.currentWeightKg ? `${userState.profile.currentWeightKg} кг` : 'Профиль не заполнен'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={triggerTestReminder}
              aria-label="Проверить напоминание"
              className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-amber-400 transition"
            >
              <Bell className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                setSettingsOpen(true);
                history.pushState(navState({ settings: true }), '');
              }}
              aria-label="Открыть настройки"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-200"
            >
              <Settings className="w-4 h-4 text-amber-300" />
              <span>Настройки</span>
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
        {activeSubView !== 'library' && (
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
              onClick={() => {
                setSettingsOpen(true);
                history.pushState(navState({ settings: true }), '');
              }}
              className="self-start inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white"
            >
              <Scale className="w-3.5 h-3.5 text-amber-400" />
              <span>Вес: {userState.profile.currentWeightKg} кг → {userState.profile.targetWeightKg} кг</span>
            </button>
          </div>

          <div className="flex gap-1.5 overflow-x-auto">
            {(
              [
                ['morning', 'Зарядка'],
                ['breaks', 'Перерывы'],
                ['walking', 'Ходьба'],
                ['kettlebell', 'Гири'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  if (id === activeCategory) return;
                  setActiveCategory(id);
                  history.pushState(navState({ category: id }), '');
                }}
                className={`px-3 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap ${
                  activeCategory === id ? `bg-gradient-to-r ${pillarMeta.buttonBg}` : 'bg-slate-950 text-slate-300 border border-slate-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </section>
        )}

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
                            <span>Запустить этот перерыв ({slotExercises.length || 3})</span>
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
              <WalkingTabPanel
                userWeightKg={userState.profile.currentWeightKg}
                onStartWorkout={(session) => {
                  setActiveSession({
                    title: session.title,
                    category: session.category,
                    exercises: session.exercises,
                  });
                }}
                onShowBanner={(msg) => {
                  setReminderBanner(msg);
                }}
              />
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

        {activeSubView === 'library' && (
          <LibraryBrowser
            exercises={EXERCISES_DB}
            category={activeCategory}
            favoriteIds={userState.favoriteExerciseIds}
            complexes={KETTLEBELL_COMPLEXES_DB}
            onCategoryChange={(cat) => {
              if (cat === activeCategory) return;
              setActiveCategory(cat);
              history.pushState(navState({ category: cat, view: 'library' }), '');
            }}
            onToggleFavorite={(id) =>
              setUserState((prev) => ({
                ...prev,
                favoriteExerciseIds: prev.favoriteExerciseIds.includes(id)
                  ? prev.favoriteExerciseIds.filter((f) => f !== id)
                  : [...prev.favoriteExerciseIds, id],
              }))
            }
            onOpen={(exercise) => {
              setOpenExerciseId(exercise.id);
              history.pushState(navState({ view: 'library', sheet: exercise.id }), '');
            }}
            onStart={(exercise) => {
              setActiveSession({
                title: exercise.titleRu,
                category: exercise.category,
                exercises: [exercise],
              });
              history.pushState(navState({ workout: true, view: 'library' }), '');
            }}
            onStartComplex={(complex) => {
              const cplxExercises = complex.exercises
                .map((item) => EXERCISES_DB.find((e) => e.id === item.exerciseId))
                .filter((e): e is Exercise => Boolean(e));
              setActiveSession({
                title: complex.title,
                category: 'kettlebell',
                exercises: cplxExercises,
              });
              history.pushState(navState({ workout: true }), '');
            }}
          />
        )}
      </main>

      <nav aria-label="Разделы" className="fixed bottom-0 inset-x-0 z-40 border-t border-slate-800/90 bg-[#090D16]/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-xl mx-auto px-2 py-2 grid grid-cols-4 gap-1">
          {(
            [
              ['today', 'Сегодня', Sparkles],
              ['library', 'Библиотека', BookOpen],
              ['progress', 'Прогресс', BarChart3],
              ['settings', 'Настройки', Settings],
            ] as const
          ).map(([id, label, Icon]) => {
            const active = id === 'settings' ? settingsOpen : activeSubView === id && !settingsOpen;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  if (id === 'settings') {
                    setSettingsOpen(true);
                    history.pushState(navState({ settings: true }), '');
                    return;
                  }
                  if (activeSubView === id && !settingsOpen) return;
                  setActiveSubView(id);
                  setSettingsOpen(false);
                  history.pushState(navState({ view: id, settings: false, sheet: null }), '');
                }}
                className={`flex flex-col items-center justify-center py-2 rounded-2xl text-xs font-extrabold ${
                  active ? 'bg-amber-500/20 text-amber-200 border border-amber-500/40' : 'text-slate-400'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="mt-1">{label}</span>
              </button>
            );
          })}
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
            const state = history.state as NavSnap | null;
            if (state?.workout) {
              history.back();
              return;
            }
            setActiveSession(null);
            setActiveSessionBackupToRestore(null);
          }}
          onCompleteSession={(payload) => {
            handleCompleteWorkoutSession(payload);
            setActiveSession(null);
            setActiveSessionBackupToRestore(null);
            history.replaceState(navState({ view: 'progress', workout: false, sheet: null, settings: false }), '');
            try {
              localStorage.removeItem(ACTIVE_BACKUP_STORAGE_KEY);
            } catch {
              // ignore
            }
          }}
        />
      )}

      {openExercise && (
        <ExerciseDetailSheet
          exercise={openExercise}
          isFavorite={userState.favoriteExerciseIds.includes(openExercise.id)}
          onClose={() => {
            const state = history.state as NavSnap | null;
            if (state?.sheet) {
              history.back();
              return;
            }
            setOpenExerciseId(null);
          }}
          onStart={(exercise) => {
            setOpenExerciseId(null);
            setActiveSession({
              title: exercise.titleRu,
              category: exercise.category,
              exercises: [exercise],
            });
            history.replaceState(navState({ sheet: null, workout: true }), '');
          }}
          onToggleFavorite={(id) =>
            setUserState((prev) => ({
              ...prev,
              favoriteExerciseIds: prev.favoriteExerciseIds.includes(id)
                ? prev.favoriteExerciseIds.filter((item) => item !== id)
                : [...prev.favoriteExerciseIds, id],
            }))
          }
        />
      )}

      {/* Settings, weight and reminders */}
      {settingsOpen && (
        <AccountAndSettingsModal
          userState={userState}
          onClose={() => {
            const state = history.state as NavSnap | null;
            if (state?.settings) {
              history.back();
              return;
            }
            setSettingsOpen(false);
          }}
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
          onUpdateBreakSlot={updateBreakSlot}
          onAddBreakSlot={addBreakSlot}
          onRemoveBreakSlot={removeBreakSlot}
          onImportState={(imported) => setUserState(migrateUserState(imported))}
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
