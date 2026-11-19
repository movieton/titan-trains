import { EquipmentId, Exercise, ExerciseLevel } from '../types/fitness';

export interface ExerciseFacets {
  level: ExerciseLevel;
  levelLabel: string;
  pattern: string;
  bodyArea: string;
  durationMin: number;
}

export const LEVEL_LABELS: Record<ExerciseLevel, string> = {
  1: 'Начальный',
  2: 'Средний',
  3: 'Продвинутый',
};

export const EQUIPMENT_LABELS: Record<EquipmentId, string> = {
  bodyweight: 'Своё тело',
  mat: 'Коврик',
  bands: 'Резинка',
  kb16: 'Гиря 16 кг',
  kb24: 'Гиря 24 кг',
  'walking-pad': 'Дорожка',
  'pullup-bar': 'Турник',
};

const PATTERN_RULES: { pattern: string; bodyArea: string; test: RegExp }[] = [
  { pattern: 'Кардио', bodyArea: 'Ноги', test: /walk|ходьб|дорожк|zone ?2|интервал/i },
  { pattern: 'Вертикальная тяга', bodyArea: 'Спина', test: /pull-?up|chin-?up|dead-?hang|scapular|подтяг|вис на|лопаточн/i },
  { pattern: 'Горизонтальная тяга', bodyArea: 'Спина', test: /row|pulldown|тяга|австрал|face pull|pull-apart|разведен/i },
  { pattern: 'Шарнир', bodyArea: 'Ягодицы', test: /swing|snatch|clean|deadlift|rdl|hinge|мах|станов|доброе утро|good morning|windmill|мельниц/i },
  { pattern: 'Присед', bodyArea: 'Ноги', test: /squat|присед|goblet|кубков/i },
  { pattern: 'Выпад', bodyArea: 'Ноги', test: /lunge|выпад|cossack|казак|split squat/i },
  { pattern: 'Жим', bodyArea: 'Плечи', test: /press|push-?up|отжим|жим|dip/i },
  { pattern: 'Переноска', bodyArea: 'Кор', test: /carry|farmer|suitcase|проходк|фермер/i },
  { pattern: 'Кор', bodyArea: 'Кор', test: /plank|dead-?bug|curl-?up|hollow|bird-?dog|side-?bridge|планк|жук|скруч/i },
  { pattern: 'Дыхание', bodyArea: 'Кор', test: /breath|sigh|дыха|diaphragm/i },
  { pattern: 'Растяжка', bodyArea: 'Всё тело', test: /stretch|stretch|пириф|figure-?4|flexor|вытяж|растяж|pandic|потяг/i },
  { pattern: 'Мобильность', bodyArea: 'Всё тело', test: /cars|cat-cow|кошка|mobility|90-90|thread|rockback|сустав/i },
  { pattern: 'Ноги', bodyArea: 'Ноги', test: /calf|soleus|tibialis|икр|голен|стоп/i },
  { pattern: 'Осанка', bodyArea: 'Шея', test: /neck|ше[яи]|chin tuck|trap/i },
];

function inferLevel(exercise: Exercise): ExerciseLevel {
  const text = `${exercise.id} ${exercise.titleEn} ${exercise.titleRu} ${exercise.subCategory}`.toLowerCase();
  if (/archer|renegade|snatch|long-cycle|kroc|bottoms-up|рывок|лучник|продвин/.test(text)) return 3;
  if (/assisted|negative|beginner|elevated|modified|нович|негатив|с возвыш/.test(text)) return 1;
  if (exercise.category === 'kettlebell') {
    const onlyHeavy = exercise.equipment.includes('kb24') && !exercise.equipment.includes('kb16');
    if (onlyHeavy || /tgu|turkish|get-up|complex|флоу/.test(text)) return 2;
    return 2;
  }
  return 1;
}

export function exerciseFacets(exercise: Exercise): ExerciseFacets {
  const text = `${exercise.id} ${exercise.titleRu} ${exercise.titleEn} ${exercise.subCategory} ${exercise.muscleGroups.join(' ')}`;
  const matched = PATTERN_RULES.find((rule) => rule.test.test(text));
  const level = exercise.level || inferLevel(exercise);
  const durationMin =
    exercise.durationMin ||
    Math.max(
      1,
      Math.round(
        (exercise.defaultSeconds * exercise.defaultSets + exercise.restSeconds * Math.max(0, exercise.defaultSets - 1)) / 60
      )
    );
  return {
    level,
    levelLabel: LEVEL_LABELS[level],
    pattern: exercise.pattern || matched?.pattern || (exercise.category === 'walking' ? 'Кардио' : 'Мобильность'),
    bodyArea: exercise.bodyArea || matched?.bodyArea || 'Всё тело',
    durationMin,
  };
}

const SYNONYM_GROUPS = [
  ['тяга', 'row', 'pulldown'],
  ['турник', 'pull-up', 'pullup', 'chin-up', 'chinup', 'вис на'],
  ['подтягиван', 'pull-up', 'pullup', 'chin-up', 'chinup'],
  ['мах', 'swing'],
  ['присед', 'squat', 'goblet'],
  ['резин', 'band'],
  ['гир', 'kettlebell'],
  ['станов', 'deadlift'],
  ['отжим', 'push-up', 'pushup'],
  ['жим', 'press'],
];

export function exerciseSearchText(exercise: Exercise, facets: ExerciseFacets): string {
  return [
    exercise.titleRu,
    exercise.titleEn,
    exercise.subCategory,
    exercise.school,
    exercise.description,
    ...exercise.muscleGroups,
    ...exercise.equipment.flatMap((id) => [id, EQUIPMENT_LABELS[id] || id]),
    facets.pattern,
    facets.bodyArea,
    facets.levelLabel,
  ]
    .join(' ')
    .toLowerCase();
}

export function queryTokens(raw: string): string[] {
  const q = raw.trim().toLowerCase();
  if (!q) return [];
  const tokens = [q];
  for (const group of SYNONYM_GROUPS) {
    if (group.some((word) => q.includes(word))) tokens.push(...group);
  }
  return tokens;
}

export function matchesExerciseQuery(exercise: Exercise, facets: ExerciseFacets, rawQuery: string): boolean {
  const tokens = queryTokens(rawQuery);
  if (tokens.length === 0) return true;
  const haystack = exerciseSearchText(exercise, facets);
  return tokens.some((token) => haystack.includes(token));
}
