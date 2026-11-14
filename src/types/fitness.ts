export type ExerciseCategory = 'morning' | 'breaks' | 'kettlebell' | 'walking';

export type SubView = 'progress' | 'today' | 'library';

export type EquipmentId = 'bodyweight' | 'mat' | 'bands' | 'kb16' | 'kb24' | 'walking-pad';

export type SpineSafetyLevel =
  | 'decompression' // Разгрузка и вытяжение позвоночника
  | 'mcgill-stabilization' // Нейтральная спина + анти-ротация / стабилизация кора
  | 'strict-hip-hinge'; // Строгий тазобедренный шарнир (работа ягодиц и бицепса бедра без округления поясницы)

export type PoseArchetype =
  | 'cat-cow'
  | 'mcgill-curlup'
  | 'bird-dog'
  | 'side-plank'
  | 'glute-bridge'
  | 'worlds-greatest-stretch'
  | 'thoracic-rotation'
  | '90-90-hips'
  | 'dead-bug'
  | 'band-pull-apart'
  | 'deep-squat-hold'
  | 'cossack-squat'
  | 'calf-tibialis-pump'
  | 'diaphragm-breath'
  | 'chin-tuck-wall-angel'
  | 'doorway-pec-stretch'
  | 'couch-hip-flexor'
  | 'piriformis-figure4'
  | 'desk-pushup'
  | 'band-face-pull'
  | 'soleus-pushup'
  | 'wall-sit'
  | 'standing-thoracic-ext'
  | 'kb-deadlift'
  | 'kb-swing-2h'
  | 'kb-goblet-squat'
  | 'kb-halo'
  | 'kb-suitcase-carry'
  | 'kb-farmers-walk'
  | 'kb-gorilla-row'
  | 'kb-floor-press'
  | 'kb-half-kneeling-press'
  | 'kb-clean-and-press'
  | 'kb-romanian-deadlift'
  | 'kb-tgu'
  | 'kb-around-world'
  | 'kb-complex-flow'
  | 'band-row-pulldown'
  | 'walking-steady'
  | 'walking-intervals'
  | 'walking-incline'
  | 'walking-bands';

export type ExerciseTrackingMode = 'reps' | 'duration';

export type MixGoal = 'fatburn' | 'strength_cardio' | 'recovery' | 'glucose_control';
export type MixStructure = 'walking_only' | 'walk_then_kb' | 'kb_then_walk' | 'circuit_5_2';

export interface Exercise {
  id: string;
  category: ExerciseCategory;
  subCategory: string;
  school: string; // e.g., "Stuart McGill Spine Lab", "Pavel Tsatsouline / StrongFirst RKC", "Kelly Starrett Desk Mobility", "Dan John Loaded Carries", "Zone 2 Walking Pad Protocol"
  titleRu: string;
  titleEn: string;
  equipment: EquipmentId[];
  recommendedWeight?: string; // e.g. "Гиря 16 кг (старт) → 24 кг (профи)"
  targetSpeedKmh?: string; // e.g. "5.0 – 5.6 км/ч"
  metValue?: number; // Метаболический эквивалент (kcal = MET * weightKg * durationHr)
  cadenceSpm?: number; // Шагов в минуту (для расчёта шагов и дистанции)
  muscleGroups: string[];
  secondaryMuscles: string[];
  spineSafety: SpineSafetyLevel;
  spineNote: string; // Специальная ремарка тренера для веса 110 кг и защиты поясницы
  description: string;
  imageUrl?: string; // Прямая ссылка на фотоинструкцию (/exercises/...)
  trackingMode?: ExerciseTrackingMode; // Режим отслеживания: 'reps' (повторения) или 'duration' (время)
  isBilateral?: boolean; // Асимметричное двустороннее упражнение (смена стороны на экваторе времени)
  quickSteps?: string[]; // 2-3 ультра-коротких тезисных шага для мгновенного старта без чтения простыней
  quickTags?: string[]; // Теги-акценты: исходная поза, тип дыхания, целевой фокус
  steps: [string, string, string, string]; // 4 четкие фазы движения
  breathing: string;
  commonMistakes: string[];
  defaultSeconds: number; // Для таймера (например, 45 сек работы)
  defaultReps?: string; // Например, "10-12 повторений" или "по 8 на сторону"
  defaultSets: number;
  restSeconds: number;
  kcalEstimate: number;
  pose: PoseArchetype;
  videoUrl?: string; // Встроенная демонстрация / ссылка на рилс или YouTube
  instagramRef?: string; // Привязка к подборке Reels пользователя
}

export interface GeneratedWorkoutPlan {
  title: string;
  category: ExerciseCategory;
  estimatedMinutes: number;
  estimatedKcal: number;
  coachFocus: string;
  exercises: Exercise[];
  walkingStats?: {
    estimatedSteps: number;
    estimatedDistanceKm: number;
    protocolBadge: string;
  };
}

export interface ActiveWorkoutBackup {
  activeSession: {
    title: string;
    category: ExerciseCategory;
    exercises: Exercise[];
    slotIdToComplete?: string;
  };
  currentIndex: number;
  currentSet: number;
  phase: 'ready' | 'prep_countdown' | 'work' | 'rest_set' | 'transition_next' | 'finished';
  secondsLeft: number;
  targetEndTimestamp: number | null;
  elapsedTotalSeconds: number;
  completedCount: number;
  repCounter: number;
  selectedWalkingSpeed?: number;
  accumulatedWalkingSteps?: number;
  accumulatedWalkingKcal?: number;
  timestamp: number; // Date.now() when saved
}

export interface CompletedSessionLog {
  id: string;
  dateISO: string; // YYYY-MM-DD
  timestamp: string;
  category: ExerciseCategory;
  title: string;
  durationSeconds: number;
  exercisesCompleted: number;
  exercisesTotal: number;
  kcalBurned: number;
  weightKgAtSession?: number;
  rpe?: number; // 1-10 субъективная тяжесть
  backComfort?: 'great' | 'normal' | 'tired'; // Мониторинг состояния поясницы
  walkingSteps?: number;
  distanceKm?: number;
}

export interface DailyBreakSlot {
  id: string;
  timeLabel: string; // "11:00", "13:00", "15:30", "17:30", "19:30"
  title: string;
  focus: string;
  exerciseIds: string[];
  completedDates: string[]; // Массив YYYY-MM-DD когда этот слот выполнен
  skippedDates: string[]; // Массив YYYY-MM-DD когда слот отмечен как пропущенный
}

export interface WeightEntry {
  dateISO: string;
  weightKg: number;
  waistCm?: number;
  note?: string;
}

export interface ReminderSettings {
  morningEnabled: boolean;
  morningTime: string; // "08:30"
  morningDays: number[]; // [1, 2, 3, 4, 5] (0 = ВС, 1 = ПН, ..., 6 = СБ)
  breaksEnabled: boolean;
  breaksIntervalMinutes: number; // 90
  breaksStartHour: number; // 10
  breaksEndHour: number; // 19
  breaksDays: number[]; // [1, 2, 3, 4, 5]
  breakSlotsConfig?: Record<string, { enabled: boolean; time: string }>; // slot-id -> { enabled, time }
  kettlebellEnabled: boolean;
  kettlebellTime: string; // "19:00"
  kettlebellDays: number[]; // [1, 3, 5, 6]
  walkingEnabled?: boolean;
  walkingTime?: string; // "14:00" или "20:00"
  walkingDays?: number[]; // [0, 1, 2, 3, 4, 5, 6]
  soundEnabled: boolean;
}

/**
 * Extracts 2-3 complete, non-truncated action sentences for the workout player and cards.
 * Never slices mid-word or cuts off after a single period when a step has multiple cues.
 */
export function getCleanQuickSteps(ex?: Exercise | null): string[] {
  if (!ex) return [];
  if (ex.quickSteps && ex.quickSteps.length > 0) {
    return ex.quickSteps
      .slice(0, 3)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return (ex.steps || [])
    .slice(0, 3)
    .map((step) => step.replace(/^(Шаг|Фаза)\s*\d+[:.-]\s*/i, '').trim())
    .filter(Boolean);
}

export function isExerciseBilateral(ex?: Exercise | null): boolean {
  if (!ex) return false;
  if (typeof ex.isBilateral === 'boolean') return ex.isBilateral;
  const text = [
    ex.titleRu || '',
    ex.titleEn || '',
    ex.defaultReps || '',
    ...(ex.quickSteps || []),
    ...(ex.steps || []),
  ]
    .join(' ')
    .toLowerCase();
  return (
    text.includes('на каждую сторону') ||
    text.includes('на сторону') ||
    text.includes('на каждую ногу') ||
    text.includes('на ногу') ||
    text.includes('на каждую руку') ||
    text.includes('на руку') ||
    text.includes('на каждый бок') ||
    text.includes('на бок') ||
    text.includes('влево и вправо') ||
    text.includes('вправо и влево') ||
    text.includes('по 30 с на сторону') ||
    text.includes('по 25 с на сторону') ||
    text.includes('по 20 с на сторону') ||
    text.includes('по 30 секунд на каждую') ||
    text.includes('по 20 секунд на каждую') ||
    text.includes('single-arm') ||
    text.includes('одной рукой') ||
    text.includes('одной ногой') ||
    text.includes('на одной ноге') ||
    text.includes('с одного колена')
  );
}

export interface GoogleUserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  connectedAt: string;
  lastSyncedAt: string;
  syncMode: 'google-cloud' | 'local-plus-backup';
}

export interface UserState {
  profile: {
    name: string;
    age: number;
    heightCm: number;
    startWeightKg: number;
    currentWeightKg: number;
    targetWeightKg: number;
    equipment: EquipmentId[];
    lowerBackGuard: boolean;
  };
  googleUser: GoogleUserProfile | null;
  weightHistory: WeightEntry[];
  logs: CompletedSessionLog[];
  breakSlots: DailyBreakSlot[];
  customMediaLinks: Record<string, string>; // exerciseId -> custom video/GIF/Instagram URL
  favoriteExerciseIds: string[];
  reminders: ReminderSettings;
  selectedDurationMorning: 10 | 15 | 20;
  selectedDurationBreak: 5 | 7 | 10;
  selectedKettlebellProgram: 'foundation-16' | 'power-24' | 'fatburn-flow' | 'spine-armor';
  selectedWalkingProtocol?: 'zone2' | 'intervals' | 'after_meal' | 'recovery';
  selectedWalkingDuration?: 15 | 20 | 30 | 45;
  selectedMixGoal?: MixGoal;
  selectedMixStructure?: MixStructure;
  selectedMixDuration?: 25 | 35 | 45;
}
