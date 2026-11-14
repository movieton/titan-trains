import { EXERCISES_DB } from '../data/exercises';
import { DailyBreakSlot, Exercise, ExerciseCategory, MixGoal, MixStructure } from '../types/fitness';

export interface GeneratedWorkoutPlan {
  id: string;
  category: ExerciseCategory;
  title: string;
  subtitle: string;
  coachFocus: string;
  estimatedMinutes: number;
  estimatedKcal: number;
  exercises: Exercise[];
  walkingStats?: {
    estimatedSteps: number;
    estimatedDistanceKm: number;
    protocolBadge: string;
  };
}

export function getDayOfYearIndex(date = new Date()): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

export function getTodayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function generateMorningWorkout(
  durationMinutes: 10 | 15 | 20,
  daySeed = getDayOfYearIndex(),
  noMatMode = false
): GeneratedWorkoutPlan {
  const morningPool = EXERCISES_DB.filter((e) => e.category === 'morning');

  if (noMatMode) {
    // 100% Standing & Seated at bed/chair awakening pool (Zero Mat Required)
    const standingAwakeningIds = [
      'morn-palm-rub-face-neck-warm',
      'morn-physiological-sigh-huberman',
      'morn-neck-cars',
      'morn-shoulder-cars',
      'morn-wrist-elbow-cars-standing',
      'morn-crescent-side-stretch-standing',
      'morn-daoyin-meridian-patting',
      'morn-standing-pelvic-hula-warmup',
      'morn-soviet-radio-gym-chest-expand',
      'morn-toe-yoga-intrinsic-foot',
      'morn-lymph-calf-tibialis-pump', // strictly last
    ];

    const targetCount = durationMinutes === 10 ? 6 : durationMinutes === 15 ? 9 : 11;
    const selected = standingAwakeningIds.slice(0, targetCount);
    // ensure calf pump is always last
    const calfId = 'morn-lymph-calf-tibialis-pump';
    const finalIds = selected.filter((id) => id !== calfId);
    finalIds.push(calfId);

    const exercises = finalIds
      .map((id) => morningPool.find((e) => e.id === id))
      .filter((e): e is Exercise => Boolean(e));

    const totalKcal = exercises.reduce((acc, e) => acc + e.kcalEstimate, 0);

    return {
      id: `morning-nomat-${durationMinutes}-${daySeed}`,
      category: 'morning',
      title: `Утренняя Зарядка без коврика (${durationMinutes} мин)`,
      subtitle: 'Пробуждение у кровати • 100% Стоя • Суставная гимнастика CARs + Дыхание + Лимфодренаж',
      coachFocus:
        'Формат для быстрого старта прямо у постели: никакой возни с ковриком. Мягкий разогрев лица и шеи, суставные круги плеч и таза, раскрытие рёбер и тибиальный насос.',
      estimatedMinutes: durationMinutes,
      estimatedKcal: totalKcal,
      exercises,
    };
  }

  // Phase 1 (Lying on back/side — awakening CNS & pelvis)
  const phase1LyingIds = [
    'morn-pandiculation-full-body-stretch',
    'morn-diaphragm-rib-breath',
    'morn-pelvic-clock-tilts',
    'morn-book-openers-mat',
    'morn-tibetan-hormonal-lymph-rub',
  ];

  // Phase 2 (Quadruped / seated — spine & hip mobility)
  const phase2QuadrupedIds = [
    'morn-cat-cow-segmental',
    'morn-thread-the-needle',
    'morn-quadruped-rockbacks',
    'morn-90-90-hip-switches',
    'morn-child-pose-lat-walk',
  ];

  // Phase 3 (Standing — CARs, rib opening, lymphatic drainage)
  const phase3StandingIds = [
    'morn-palm-rub-face-neck-warm',
    'morn-neck-cars',
    'morn-shoulder-cars',
    'morn-crescent-side-stretch-standing',
    'morn-daoyin-meridian-patting',
    'morn-standing-pelvic-hula-warmup',
    'morn-lymph-calf-tibialis-pump', // Always last!
  ];

  const selectedIds: string[] = [];

  if (durationMinutes === 10) {
    // 7 exercises: 2 lying -> 3 quadruped/seated -> 2 standing
    selectedIds.push(phase1LyingIds[0], phase1LyingIds[1]);
    selectedIds.push(phase2QuadrupedIds[0], phase2QuadrupedIds[1], phase2QuadrupedIds[3]);
    selectedIds.push(phase3StandingIds[5], phase3StandingIds[6]);
  } else if (durationMinutes === 15) {
    // 11 exercises: 4 lying -> 4 quadruped/seated -> 3 standing
    selectedIds.push(
      phase1LyingIds[0],
      phase1LyingIds[1],
      phase1LyingIds[2],
      phase1LyingIds[3]
    );
    selectedIds.push(
      phase2QuadrupedIds[0],
      phase2QuadrupedIds[1],
      phase2QuadrupedIds[2],
      phase2QuadrupedIds[3]
    );
    selectedIds.push(
      phase3StandingIds[0],
      phase3StandingIds[1],
      phase3StandingIds[5],
      phase3StandingIds[6]
    );
  } else {
    // 20 minutes: all 17 exercises in strict 3-phase flow
    selectedIds.push(...phase1LyingIds);
    selectedIds.push(...phase2QuadrupedIds);
    selectedIds.push(...phase3StandingIds);
  }

  // Ensure strictly that the lymphatic calf pump is the final exercise
  const calfId = 'morn-lymph-calf-tibialis-pump';
  const filteredIds = selectedIds.filter((id) => id !== calfId);
  filteredIds.push(calfId);

  const exercises = filteredIds
    .map((id) => morningPool.find((e) => e.id === id))
    .filter((e): e is Exercise => Boolean(e));

  const totalKcal = exercises.reduce((acc, e) => acc + e.kcalEstimate, 0);

  return {
    id: `morning-${durationMinutes}-${daySeed}`,
    category: 'morning',
    title: `Утренняя Зарядка Титана (${durationMinutes} мин)`,
    subtitle: 'Потягивания (Пандикуляция) + Термический разогрев + Мобильность суставов + Декомпрессия',
    coachFocus:
      'Строгий вектор пробуждения: Лёжа на спине → Четвереньки и ТБС → Стоя суставная гимнастика CARs и лимфодренажный насос. Никакой силовой компрессии на холодные связки.',
    estimatedMinutes: durationMinutes,
    estimatedKcal: totalKcal,
    exercises,
  };
}

export function getDefaultBreakSlots(): DailyBreakSlot[] {
  return [
    {
      id: 'slot-1100',
      timeLabel: '11:00',
      title: 'Потягивание в кресле + Разгрузка Шеи и Трапеции #1',
      focus: 'Офисное потягивание в замке, мягкая растяжка верхней трапеции и раскрытие груди',
      exerciseIds: ['brk-seated-overhead-interlace-reach', 'brk-neck-upper-trap-lateral-stretch', 'brk-doorway-pec-opener'],
      completedDates: [],
      skippedDates: [],
    },
    {
      id: 'slot-1330',
      timeLabel: '13:30',
      title: 'Разогрев Поясницы + Растяжка Таза «Цифра 4» #2',
      focus: 'Термическое растирание крестца ладонями, растяжка ягодиц на стуле и фейс-пул с резинкой',
      exerciseIds: ['brk-standing-sacrum-friction-rub', 'brk-seated-piriformis-figure4-stretch', 'brk-band-face-pull'],
      completedDates: [],
      skippedDates: [],
    },
    {
      id: 'slot-1600',
      timeLabel: '16:00',
      title: 'Тяга Резинки + Отжимания от стола #3',
      focus: 'Активация широчайших мышц, осанки и метаболический разгон наклонными отжиманиями',
      exerciseIds: ['brk-band-row-pulldown', 'brk-incline-desk-pushups', 'brk-seated-overhead-interlace-reach'],
      completedDates: [],
      skippedDates: [],
    },
    {
      id: 'slot-1800',
      timeLabel: '18:00',
      title: 'Вечернее Раскрытие Грудного Отдела и Шеи #4',
      focus: 'Снимаем осевую усталость позвоночника, прогреваем крестец и раскрываем грудь',
      exerciseIds: ['brk-doorway-pec-opener', 'brk-standing-sacrum-friction-rub', 'brk-neck-upper-trap-lateral-stretch'],
      completedDates: [],
      skippedDates: [],
    },
  ];
}

export function generateBreakWorkout(durationMinutes: 5 | 7 | 10, slotIndex = 0): GeneratedWorkoutPlan {
  const priorityPhotoIds = [
    'brk-seated-overhead-interlace-reach',
    'brk-neck-upper-trap-lateral-stretch',
    'brk-doorway-pec-opener',
    'brk-standing-sacrum-friction-rub',
    'brk-seated-piriformis-figure4-stretch',
    'brk-incline-desk-pushups',
    'brk-band-face-pull',
    'brk-band-row-pulldown',
  ];

  const pool = priorityPhotoIds
    .map((id) => EXERCISES_DB.find((e) => e.id === id))
    .filter((e): e is Exercise => Boolean(e));

  const count = durationMinutes === 5 ? 4 : durationMinutes === 7 ? 6 : 8;

  const exercises: Exercise[] = [];
  for (let i = 0; i < count; i++) {
    const ex = pool[(slotIndex * 3 + i) % pool.length];
    if (ex && !exercises.some((item) => item.id === ex.id)) {
      exercises.push(ex);
    }
  }

  const totalKcal = exercises.reduce((acc, e) => acc + e.kcalEstimate, 0);

  return {
    id: `break-${durationMinutes}-${slotIndex}`,
    category: 'breaks',
    title: `Офисный Перерыв Анти-Гиподинамия (${durationMinutes} мин)`,
    subtitle: 'Декомпрессия позвоночника + Раскрытие таза + Разгон застоя крови',
    coachFocus:
      'Каждые 90–120 минут за компьютером мы возвращаем поясницу в нейтраль, удлиняем подвздошно-поясничную мышцу и включаем мышечный насос ног.',
    estimatedMinutes: durationMinutes,
    estimatedKcal: totalKcal,
    exercises,
  };
}

export const KETTLEBELL_WEEKLY_SCHEDULE = [
  {
    dayNumber: 1,
    dayShort: 'ПН',
    dayName: 'Понедельник',
    type: 'kettlebell' as const,
    title: 'Силовой Фундамент: Тяга 24 кг + Присед + Спина',
    badge: 'Гири 16/24 кг • День А',
    focus: 'Тазобедренный шарнир, ягодицы, широчайшие и кор (без перегрузки поясницы)',
    programKey: 'foundation-16' as const,
    walkingTip: 'Опционально: 10–15 мин ходьбы на дорожке в Зоне 2 как финишер после гирь.',
  },
  {
    dayNumber: 2,
    dayShort: 'ВТ',
    dayName: 'Вторник',
    type: 'recovery' as const,
    title: 'Активное восстановление: Коврик + Резинки',
    badge: 'Разгрузка спины',
    focus: 'Только утренняя зарядка, рабочие перерывы и мягкая декомпрессия',
    programKey: 'spine-armor' as const,
    walkingTip: 'Рекомендовано 20–30 мин ходьбы на дорожке в Зоне 2 (5.0–5.4 км/ч) для сжигания жира и регенерации мышц.',
  },
  {
    dayNumber: 3,
    dayShort: 'СР',
    dayName: 'Среда',
    type: 'kettlebell' as const,
    title: 'Жиросжигающая Баллистика и Верх: Махи + Жимы + Проходки',
    badge: 'Гири 16/24 кг • День Б',
    focus: 'Метаболический отклик, плечевой пояс, грудные и анти-ротация кора',
    programKey: 'fatburn-flow' as const,
    walkingTip: 'Опционально: 12 мин ходьбы после махов для утилизации лактата.',
  },
  {
    dayNumber: 4,
    dayShort: 'ЧТ',
    dayName: 'Четверг',
    type: 'recovery' as const,
    title: 'Активное восстановление и Мобильность',
    badge: 'Восстановление ЦНС',
    focus: 'Фокус на шагах, осанке за компьютером и глубоком дыхании',
    programKey: 'spine-armor' as const,
    walkingTip: 'Рекомендовано: 20–25 мин ходьбы на дорожке + дыхательная гимнастика.',
  },
  {
    dayNumber: 5,
    dayShort: 'ПТ',
    dayName: 'Пятница',
    type: 'kettlebell' as const,
    title: 'Тяжёлая Атлетика и Проходки Титана (16 + 24 кг)',
    badge: 'Гири 16+24 кг • День В',
    focus: 'Румынская тяга 24 кг, Тяга Гориллы, Жим на коврике и Прогулка фермера 40 кг',
    programKey: 'power-24' as const,
    walkingTip: 'Опционально: 10 мин заминочного шага после тяжёлых гирь 24 кг.',
  },
  {
    dayNumber: 6,
    dayShort: 'СБ',
    dayName: 'Суббота',
    type: 'kettlebell' as const,
    title: 'Лёгкий технический день: Турецкий подъём 16 кг + Кор',
    badge: 'Техника 16 кг • Защита спины',
    focus: 'Турецкий подъём, жим на полу, пуловер и анти-ротация (без осевой перегрузки поясницы)',
    programKey: 'spine-armor' as const,
    walkingTip: 'Лёгкая прогулка 15–20 мин на дорожке в темпе 4.8 км/ч.',
  },
  {
    dayNumber: 0,
    dayShort: 'ВС',
    dayName: 'Воскресенье',
    type: 'recovery' as const,
    title: 'Полная перезагрузка и Стретчинг на коврике',
    badge: 'Отдых',
    focus: 'Суставная гимнастика и подготовка к новой неделе',
    programKey: 'spine-armor' as const,
    walkingTip: 'Рекомендовано 20–30 мин восстановительного шага 4.0–4.5 км/ч.',
  },
];

export function generateKettlebellWorkout(
  program: 'foundation-16' | 'power-24' | 'fatburn-flow' | 'spine-armor'
): GeneratedWorkoutPlan {
  const kbPool = EXERCISES_DB.filter((e) => e.category === 'kettlebell');

  const programMap: Record<
    typeof program,
    {
      title: string;
      subtitle: string;
      coachFocus: string;
      minutes: number;
      ids: string[];
    }
  > = {
    'foundation-16': {
      title: 'Протокол А: Силовой Фундамент (16 кг + 24 кг)',
      subtitle: 'StrongFirst RKC + Безопасная биомеханика спины для 110 кг',
      coachFocus:
        'Начинаем с мобилизации плеч «Нимб 16 кг», затем включаем ягодицы и спину в становой тяге 24 кг, строим ноги в Кубковом приседе и укрепляем кор в проходке Чемодан.',
      minutes: 25,
      ids: [
        'kb-halo-16',
        'kb-sumo-deadlift-24',
        'kb-goblet-squat-16-24',
        'kb-gorilla-row',
        'kb-half-kneeling-press',
        'kb-suitcase-carry',
      ],
    },
    'power-24': {
      title: 'Протокол Б: Тяжёлая Броня (Акцент 24 кг + Оффсет 16+24 кг)',
      subtitle: 'Силовая гипертрофия спины, ягодиц и хвата без осевого перегруза',
      coachFocus:
        'Используем вашу гирю 24 кг в самых безопасных рычагах: тяга между стоп, румынская тяга, жим лёжа на коврике и легендарная асимметричная прогулка фермера 16+24 кг.',
      minutes: 30,
      ids: [
        'kb-halo-16',
        'kb-sumo-deadlift-24',
        'kb-rdl-24',
        'kb-floor-press',
        'kb-gorilla-row',
        'kb-farmers-offset-walk',
      ],
    },
    'fatburn-flow': {
      title: 'Протокол В: Метаболический Шторм & Instagram Flows (16 кг)',
      subtitle: 'Связки на всё тело + Махи гирей + Калистеника с резинкой',
      coachFocus:
        'Максимальный расход калорий и гормональный отклик без единого прыжка: двуручные махи, атлетический флоу Clean-Squat-Press, вращения вокруг корпуса и суперсет с резинкой.',
      minutes: 28,
      ids: [
        'kb-halo-16',
        'kb-swing-2h',
        'kb-clean-squat-press-flow',
        'kb-around-world',
        'kb-calisthenics-band-row-superset',
        'kb-deadbug-pullover',
      ],
    },
    'spine-armor': {
      title: 'Протокол Г: Железный Кор, Калистеника и Защита Поясницы',
      subtitle: 'Лёгкий технический день: Турецкий подъём + Коврик + Резинки',
      coachFocus:
        'Идеально для дней, когда спина устала после работы: упражнения лёжа на коврике, с одного колена и анти-ротационные удержания.',
      minutes: 22,
      ids: [
        'kb-halo-16',
        'kb-tgu-16',
        'kb-floor-press',
        'kb-deadbug-pullover',
        'kb-calisthenics-band-row-superset',
        'kb-suitcase-carry',
      ],
    },
  };

  const config = programMap[program];
  const exercises = config.ids
    .map((id) => kbPool.find((e) => e.id === id))
    .filter((e): e is Exercise => Boolean(e));

  const totalKcal = exercises.reduce((acc, e) => acc + e.kcalEstimate * e.defaultSets, 0);

  return {
    id: `kb-${program}`,
    category: 'kettlebell',
    title: config.title,
    subtitle: config.subtitle,
    coachFocus: config.coachFocus,
    estimatedMinutes: config.minutes,
    estimatedKcal: totalKcal,
    exercises,
  };
}

export function calculateWalkingMetrics(
  exercises: Exercise[],
  userWeightKg = 110,
  defaultSpeedKmh = 5.2
): {
  kcal: number;
  steps: number;
  distanceKm: number;
  totalDurationSeconds: number;
} {
  const safeWeight =
    typeof userWeightKg === 'number' && !isNaN(userWeightKg) && userWeightKg >= 30 && userWeightKg <= 300
      ? userWeightKg
      : 110;

  let totalDurationSeconds = 0;
  let totalKcal = 0;
  let totalSteps = 0;

  for (const ex of exercises) {
    const durSec = ex.defaultSeconds || 600;
    const durHours = durSec / 3600;
    totalDurationSeconds += durSec;

    // MET formula: kcal = MET * weightKg * hours
    const met = ex.metValue || (defaultSpeedKmh >= 5.8 ? 5.0 : defaultSpeedKmh >= 5.0 ? 4.3 : 3.2);
    totalKcal += Math.round(met * safeWeight * durHours);

    // Cadence: steps per minute
    const cadence = ex.cadenceSpm || (defaultSpeedKmh >= 5.8 ? 134 : defaultSpeedKmh >= 5.0 ? 122 : 105);
    totalSteps += Math.round((durSec / 60) * cadence);
  }

  const distanceKm = Math.round(((totalSteps * 0.72) / 1000) * 100) / 100;

  return {
    kcal: Math.max(1, totalKcal),
    steps: totalSteps,
    distanceKm,
    totalDurationSeconds,
  };
}

export function generateWalkingWorkout(
  protocol: 'zone2' | 'intervals' | 'after_meal' | 'recovery',
  durationMinutes: 15 | 20 | 30 | 45 = 20,
  userWeightKg = 110
): GeneratedWorkoutPlan {
  const walkingPool = EXERCISES_DB.filter((e) => e.category === 'walking');
  const warmup = walkingPool.find((e) => e.id === 'walk-warmup-pace') || walkingPool[0];
  const steady = walkingPool.find((e) => e.id === 'walk-zone2-steady') || walkingPool[1];
  const power = walkingPool.find((e) => e.id === 'walk-power-stride') || walkingPool[2];
  const postmeal = walkingPool.find((e) => e.id === 'walk-postmeal-glucose') || walkingPool[3];
  const cooldown = walkingPool.find((e) => e.id === 'walk-cooldown-recovery') || walkingPool[5];

  let exercises: Exercise[] = [];
  let title = '';
  let subtitle = '';
  let coachFocus = '';
  let badge = '';

  if (protocol === 'zone2') {
    title = `Жиросжигание в Зоне 2 (${durationMinutes} мин)`;
    subtitle = `Аэробный непрерывный шаг 5.0–5.6 км/ч с мягким входом и заминкой`;
    coachFocus = `Разговорный темп в Зоне 2 (110–125 уд/мин). Максимальное окисление жиров без разрушения мышц и без осевого давления на поясницу.`;
    badge = 'Зона 2 • 5.2 км/ч';

    const warmupSec = 180;
    const cooldownSec = 120;
    const mainSec = Math.max(300, durationMinutes * 60 - warmupSec - cooldownSec);

    exercises = [
      { ...warmup, defaultSeconds: warmupSec },
      { ...steady, defaultSeconds: mainSec },
      { ...cooldown, defaultSeconds: cooldownSec },
    ];
  } else if (protocol === 'intervals') {
    title = `Интервальный темповый шаг (${durationMinutes} мин)`;
    subtitle = `Чередование силовых интервалов 6.0 км/ч и Зоны 2`;
    coachFocus = `Разгоняет метаболизм на 24 часа, тренирует кардиореспираторную выносливость сердца и сжигает на 30% больше калорий без ударов по коленям.`;
    badge = 'Интервалы • 6.0 км/ч';

    const warmupSec = 180;
    const cooldownSec = 120;
    const middleTotalSec = Math.max(300, durationMinutes * 60 - warmupSec - cooldownSec);
    const cycleSec = 240; // 2 min power + 2 min steady
    const cyclesCount = Math.max(1, Math.round(middleTotalSec / cycleSec));

    exercises = [{ ...warmup, defaultSeconds: warmupSec }];
    for (let i = 0; i < cyclesCount; i++) {
      exercises.push({
        ...power,
        id: `walk-power-stride-${i + 1}`,
        titleRu: `Интервал ${i + 1}: Спортивный шаг 6.0 км/ч`,
        defaultSeconds: 120,
      });
      exercises.push({
        ...steady,
        id: `walk-zone2-steady-${i + 1}`,
        titleRu: `Восстановление ${i + 1}: Шаг в Зоне 2 (5.2 км/ч)`,
        defaultSeconds: 120,
      });
    }
    exercises.push({ ...cooldown, defaultSeconds: cooldownSec });
  } else if (protocol === 'after_meal') {
    title = `Постпрандиальный «Сахарный насос» (${durationMinutes} мин)`;
    subtitle = `Снижение пика глюкозы и защита от вечерней сонливости`;
    coachFocus = `Всего 15 минут ходьбы после еды включают транспортеры GLUT-4 в камбаловидных мышцах (Soleus), снижая пик глюкозы в крови на 35%.`;
    badge = 'После еды • GLUT-4';

    const warmupSec = 120;
    const mainSec = Math.max(300, durationMinutes * 60 - warmupSec);
    exercises = [
      { ...warmup, defaultSeconds: warmupSec },
      { ...postmeal, defaultSeconds: mainSec },
    ];
  } else {
    // recovery
    title = `Восстановительный шаг для спины (${durationMinutes} мин)`;
    subtitle = `Мягкая разгрузка поясничного отдела и запуск лимфы`;
    coachFocus = `Идеально для дней отдыха и разгрузки после рабочего дня за компьютером: декомпрессия позвоночника и снятие отечности в ногах.`;
    badge = 'Восстановление спины';

    const halfSec = Math.floor((durationMinutes * 60) / 2);
    exercises = [
      { ...warmup, defaultSeconds: halfSec },
      { ...cooldown, defaultSeconds: durationMinutes * 60 - halfSec },
    ];
  }

  const metrics = calculateWalkingMetrics(exercises, userWeightKg);

  return {
    id: `walking-${protocol}-${durationMinutes}m`,
    category: 'walking',
    title,
    subtitle,
    coachFocus,
    estimatedMinutes: durationMinutes,
    estimatedKcal: metrics.kcal,
    exercises,
    walkingStats: {
      estimatedSteps: metrics.steps,
      estimatedDistanceKm: metrics.distanceKm,
      protocolBadge: badge,
    },
  };
}

export function generateHybridMixWorkout(params: {
  goal: MixGoal;
  structure: MixStructure;
  totalMinutes: 20 | 25 | 35 | 45;
  includeBands: boolean;
  includeKettlebells?: boolean;
  userWeightKg: number;
}): GeneratedWorkoutPlan {
  const { goal, structure, totalMinutes, includeBands, userWeightKg } = params;

  if (structure === 'walking_only') {
    const walkingProtocol =
      goal === 'glucose_control'
        ? 'after_meal'
        : goal === 'recovery'
        ? 'recovery'
        : goal === 'fatburn'
        ? 'zone2'
        : 'intervals';
    return generateWalkingWorkout(
      walkingProtocol,
      (totalMinutes === 25 ? 20 : totalMinutes === 35 ? 30 : 45) as 20 | 30 | 45,
      userWeightKg
    );
  }

  const walkingPool = EXERCISES_DB.filter((e) => e.category === 'walking');
  const kbPool = EXERCISES_DB.filter((e) => e.category === 'kettlebell');

  const warmupWalk = walkingPool.find((e) => e.id === 'walk-warmup-pace') || walkingPool[0];
  const zone2Walk = walkingPool.find((e) => e.id === 'walk-zone2-steady') || walkingPool[1];
  const cooldownWalk = walkingPool.find((e) => e.id === 'walk-cooldown-recovery') || walkingPool[5];

  const gobletSquat = kbPool.find((e) => e.id === 'kb-goblet-squat-16-24') || kbPool[0];
  const gorillaRow = kbPool.find((e) => e.id === 'kb-gorilla-row') || kbPool[1];
  const halfPress = kbPool.find((e) => e.id === 'kb-half-kneeling-press') || kbPool[2];
  const farmersWalk = kbPool.find((e) => e.id === 'kb-farmers-offset-walk') || kbPool[3];
  const swing = kbPool.find((e) => e.id === 'kb-swing-2h') || kbPool[4];
  const deadbug = kbPool.find((e) => e.id === 'kb-deadbug-pullover') || kbPool[5];
  const halo = kbPool.find((e) => e.id === 'kb-halo-16') || kbPool[6];
  const bandSuperset = kbPool.find((e) => e.id === 'kb-calisthenics-band-row-superset') || kbPool[7];

  let exercises: Exercise[] = [];
  let title = '';
  let subtitle = '';
  let coachFocus = '';
  let badge = '';

  if (structure === 'walk_then_kb') {
    title = `Разогрев на дорожке ➔ Сила с гирями (${totalMinutes} мин)`;
    subtitle = `12 мин аэробной подготовки + мощный силовой блок на спину и ноги`;
    coachFocus = `Ходьба в Зоне 2 разогревает суставы и связки, после чего силовые движения с гирями выполняются с идеальной техникой и нулевым риском травм.`;
    badge = 'Ходьба ➔ Гири';

    const walkDurationSec = 720; // 12 min
    exercises = [
      { ...warmupWalk, defaultSeconds: 180 },
      { ...zone2Walk, defaultSeconds: walkDurationSec - 180 },
      gobletSquat,
      gorillaRow,
      halfPress,
      farmersWalk,
    ];
    if (includeBands) {
      exercises.push(bandSuperset);
    }
  } else if (structure === 'kb_then_walk') {
    title = `Силовая мобилизация ➔ Кардио-финишер (${totalMinutes} мин)`;
    subtitle = `Гири/Резинки мобилизуют жирные кислоты ➔ 15 мин ходьбы сжигают их`;
    coachFocus = `Силовой блок с гирями 16 кг и резинками стимулирует выброс жирных кислот в кровоток, а последующая ходьба на дорожке полностью окисляет их.`;
    badge = 'Гири ➔ Финишер на дорожке';

    const walkDurationSec = totalMinutes >= 35 ? 1080 : 720;
    exercises = [
      halo,
      swing,
      ...(includeBands ? [bandSuperset] : []),
      deadbug,
      { ...zone2Walk, defaultSeconds: walkDurationSec - 120 },
      { ...cooldownWalk, defaultSeconds: 120 },
    ];
  } else {
    // circuit_5_2
    title = `Круговой микс «Станции: Дорожка + Сила» (${totalMinutes} мин)`;
    subtitle = `Чередование 4 мин бодрой ходьбы и 1 силового упражнения (без скуки)`;
    coachFocus = `Идеальный динамичный формат: вы не стоите на месте и не скучаете. Пульс остается ровным, а мышцы получают мощную силовую нагрузку.`;
    badge = 'Круговой микс 4+1';

    const rounds = totalMinutes === 45 ? 4 : totalMinutes === 35 ? 3 : 2;
    exercises = [{ ...warmupWalk, defaultSeconds: 120 }];

    const strengthPool = [gobletSquat, gorillaRow, swing, includeBands ? bandSuperset : halfPress];

    for (let r = 0; r < rounds; r++) {
      exercises.push({
        ...zone2Walk,
        id: `walk-circuit-round-${r + 1}`,
        titleRu: `Раунд ${r + 1}: Бодрый шаг 5.2 км/ч (4 мин)`,
        defaultSeconds: 240,
      });
      exercises.push(strengthPool[r % strengthPool.length]);
    }
    exercises.push({ ...cooldownWalk, defaultSeconds: 120 });
  }

  const walkingParts = exercises.filter((e) => e.category === 'walking');
  const walkingMetrics = calculateWalkingMetrics(walkingParts, userWeightKg);
  const kbParts = exercises.filter((e) => e.category !== 'walking');
  const kbKcal = kbParts.reduce((acc, e) => acc + e.kcalEstimate * e.defaultSets, 0);

  return {
    id: `hybrid-${structure}-${goal}-${totalMinutes}m`,
    category: 'walking',
    title,
    subtitle,
    coachFocus,
    estimatedMinutes: totalMinutes,
    estimatedKcal: walkingMetrics.kcal + kbKcal,
    exercises,
    walkingStats: {
      estimatedSteps: walkingMetrics.steps,
      estimatedDistanceKm: walkingMetrics.distanceKm,
      protocolBadge: badge,
    },
  };
}
