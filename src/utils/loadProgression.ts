import { EXERCISES_DB } from '../data/exercises';
import { EffortMark, Exercise, LoadDirection, LoadRecord } from '../types/fitness';

/**
 * Load progression. Full rules: docs/LOAD_PROGRESSION.md
 *
 * One session moves a ladder by at most one step.
 * Two easy ratings in a row step up. 3 stays. 4 or 5 step down.
 * Pain always steps down and asks the user to rest.
 * A 16 kg beginner never gets an automatic jump to 24 kg.
 */

export type Effort = 1 | 2 | 3 | 4 | 5;

export interface Dose {
  exerciseId: string;
  reps: number | null;
  seconds: number;
  sets: number;
}

export interface Ladder {
  id: string;
  /** Plan rows with this id are rewritten when this ladder is the one being trained. */
  anchorId: string;
  steps: Dose[];
  baselineIndex: number;
}

export interface LoadDecision {
  index: number;
  direction: LoadDirection;
  reason: string;
}

export const PAIN_MESSAGE =
  'Нагрузка снижена. Если боль не проходит, отдохните и обратитесь к врачу.';

export const PULL_LADDER_ID = 'pull-up-chain';

/** Dead hang → scapular → negative → band-assisted → chin-up → pull-up. Doses stay beginner-sized. */
export const PULL_STEPS: Dose[] = [
  { exerciseId: 'brk-dead-hang', reps: null, seconds: 15, sets: 2 },
  { exerciseId: 'brk-dead-hang', reps: null, seconds: 20, sets: 2 },
  { exerciseId: 'brk-dead-hang', reps: null, seconds: 25, sets: 2 },
  { exerciseId: 'brk-dead-hang', reps: null, seconds: 30, sets: 2 },
  { exerciseId: 'brk-scapular-pullup', reps: 8, seconds: 40, sets: 3 },
  { exerciseId: 'brk-scapular-pullup', reps: 12, seconds: 45, sets: 3 },
  { exerciseId: 'brk-negative-pullup', reps: 2, seconds: 40, sets: 3 },
  { exerciseId: 'brk-negative-pullup', reps: 3, seconds: 50, sets: 3 },
  { exerciseId: 'kb-band-assisted-pullup', reps: 5, seconds: 50, sets: 3 },
  { exerciseId: 'kb-band-assisted-pullup', reps: 8, seconds: 55, sets: 3 },
  { exerciseId: 'kb-chin-up', reps: 3, seconds: 40, sets: 3 },
  { exerciseId: 'kb-chin-up', reps: 5, seconds: 45, sets: 3 },
  { exerciseId: 'kb-pull-up', reps: 3, seconds: 40, sets: 3 },
  { exerciseId: 'kb-pull-up', reps: 5, seconds: 45, sets: 3 },
  { exerciseId: 'kb-pull-up', reps: 8, seconds: 50, sets: 3 },
];

const PULL_IDS = new Set(PULL_STEPS.map((step) => step.exerciseId));

export function canMarkExercise(exercise: Exercise): boolean {
  return exercise.category === 'kettlebell' || PULL_IDS.has(exercise.id);
}

export function stepLoad(index: number, length: number, ratings: Pick<EffortMark, 'effort' | 'pain'>[]): LoadDecision {
  const max = Math.max(0, length - 1);
  const clamped = Math.min(max, Math.max(0, index));
  const latest = ratings[ratings.length - 1];
  if (!latest) {
    return { index: clamped, direction: 'same', reason: 'Пока без оценки' };
  }
  if (latest.pain) {
    if (clamped === 0) return { index: 0, direction: 'same', reason: PAIN_MESSAGE };
    return { index: clamped - 1, direction: 'down', reason: PAIN_MESSAGE };
  }
  if (latest.effort >= 4) {
    if (clamped === 0) {
      return { index: 0, direction: 'same', reason: latest.effort === 5 ? 'Тяжело, но легче уже некуда' : 'Чуть тяжело, оставляем минимум' };
    }
    return {
      index: clamped - 1,
      direction: 'down',
      reason: latest.effort === 5 ? 'Слишком тяжело — шаг назад' : 'Тяжеловато — чуть легче',
    };
  }
  if (latest.effort === 3) {
    return { index: clamped, direction: 'same', reason: 'В самый раз' };
  }
  const previous = ratings[ratings.length - 2];
  const previousEasy = Boolean(previous && !previous.pain && previous.effort <= 2);
  if (!previousEasy) {
    return { index: clamped, direction: 'same', reason: 'Легко. Ещё раз так же — добавим шаг' };
  }
  if (clamped >= max) {
    return { index: max, direction: 'same', reason: 'Легко, это потолок этой лестницы' };
  }
  return { index: clamped + 1, direction: 'up', reason: 'Два раза легко — плюс один шаг' };
}

function firstNumber(text?: string): number | null {
  const match = text?.match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function usesReps(exercise: Exercise): boolean {
  if (exercise.trackingMode === 'duration') return false;
  if (exercise.trackingMode === 'reps') return true;
  const text = exercise.defaultReps || '';
  if (/повтор|раз|мах/i.test(text)) return true;
  if (/сек|мин|удерж/i.test(text)) return false;
  return false;
}

function repCap(exercise: Exercise, base: number): number {
  const beginnerKb = exercise.equipment.includes('kb16');
  const ceiling = beginnerKb ? Math.min(base + 8, 16) : Math.min(base + 8, 20);
  return Math.max(base, ceiling);
}

export function buildLadder(exercise: Exercise): Ladder {
  if (PULL_IDS.has(exercise.id)) {
    const baselineIndex = PULL_STEPS.findIndex((step) => step.exerciseId === exercise.id);
    return {
      id: PULL_LADDER_ID,
      anchorId: exercise.id,
      steps: PULL_STEPS,
      baselineIndex: Math.max(0, baselineIndex),
    };
  }

  if (exercise.category === 'walking' || exercise.id.startsWith('walk-')) {
    const base = Math.max(180, exercise.defaultSeconds || 600);
    const steps: Dose[] = [];
    for (let delta = -180; delta <= 300; delta += 60) {
      steps.push({ exerciseId: exercise.id, reps: null, seconds: base + delta, sets: 1 });
    }
    return { id: `walk:${exercise.id}`, anchorId: exercise.id, steps, baselineIndex: 3 };
  }

  const sets = Math.max(1, exercise.defaultSets || 1);
  if (usesReps(exercise)) {
    const base = Math.max(3, firstNumber(exercise.defaultReps) || 8);
    const top = repCap(exercise, base);
    const steps: Dose[] = [];
    for (let reps = Math.max(3, base - 4); reps <= top; reps += 2) {
      steps.push({ exerciseId: exercise.id, reps, seconds: exercise.defaultSeconds || 45, sets });
    }
    if (exercise.category === 'kettlebell' && sets < 4) {
      steps.push({ exerciseId: exercise.id, reps: top, seconds: exercise.defaultSeconds || 45, sets: sets + 1 });
    }
    const baselineIndex = closestIndex(steps, (step) => (step.reps === base && step.sets === sets ? 0 : Math.abs((step.reps || 0) - base) + (step.sets === sets ? 0 : 10)));
    return { id: exercise.id, anchorId: exercise.id, steps, baselineIndex };
  }

  const base = Math.max(15, exercise.defaultSeconds || 30);
  const top = Math.min(90, base + 30);
  const steps: Dose[] = [];
  for (let seconds = Math.max(15, base - 15); seconds <= top; seconds += 5) {
    steps.push({ exerciseId: exercise.id, reps: null, seconds, sets: 1 });
  }
  const baselineIndex = closestIndex(steps, (step) => Math.abs(step.seconds - base));
  return { id: exercise.id, anchorId: exercise.id, steps, baselineIndex };
}

function closestIndex(steps: Dose[], distance: (step: Dose) => number): number {
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  steps.forEach((step, index) => {
    const value = distance(step);
    if (value < bestDistance) {
      best = index;
      bestDistance = value;
    }
  });
  return best;
}

export function formatDose(dose: Dose): string {
  if (dose.reps != null) {
    return `${dose.reps} повт. × ${dose.sets}`;
  }
  const minutes = Math.floor(dose.seconds / 60);
  const seconds = dose.seconds % 60;
  const clock = minutes > 0 ? `${minutes} мин${seconds ? ` ${seconds} с` : ''}` : `${dose.seconds} сек`;
  return dose.sets > 1 ? `${clock} × ${dose.sets}` : clock;
}

export function emptyLoads(): Record<string, LoadRecord> {
  return {};
}

function catalogById(catalog: Exercise[]): Map<string, Exercise> {
  return new Map(catalog.map((exercise) => [exercise.id, exercise]));
}

export function applySessionRatings(
  loads: Record<string, LoadRecord> | undefined,
  exercises: Exercise[],
  session: { effort: Effort; pain: boolean; at?: string; perExercise?: { exerciseId: string; effort: Effort }[] },
  catalog: Exercise[] = EXERCISES_DB
): Record<string, LoadRecord> {
  const next: Record<string, LoadRecord> = { ...(loads || {}) };
  const byId = catalogById(catalog);
  const per = new Map((session.perExercise || []).map((mark) => [mark.exerciseId, mark.effort]));
  const seenLadders = new Set<string>();

  for (const exercise of exercises) {
    const source = byId.get(exercise.id) || exercise;
    const ladder = buildLadder(source);
    if (seenLadders.has(ladder.id)) continue;
    seenLadders.add(ladder.id);
    const current = next[ladder.id];
    const owns = Boolean(current && current.anchorId === exercise.id);
    if (current && !owns && ladder.id === PULL_LADDER_ID && !per.has(exercise.id)) {
      continue;
    }
    const effort = per.get(exercise.id) || session.effort;
    const mark: EffortMark = { effort, pain: session.pain, at: session.at || new Date().toISOString() };
    const startIndex = owns ? current!.index : ladder.baselineIndex;
    const ratings = [...(owns ? current!.ratings : []), mark].slice(-8);
    const decision = stepLoad(startIndex, ladder.steps.length, ratings);
    next[ladder.id] = {
      ladderId: ladder.id,
      anchorId: exercise.id,
      index: decision.index,
      ratings,
      direction: decision.direction,
      reason: decision.reason,
    };
  }
  return next;
}

export interface AdjustedExercise {
  exercise: Exercise;
  direction: LoadDirection | null;
  reason: string;
  targetLabel: string;
  pain: boolean;
}

function withDose(exercise: Exercise, dose: Dose): Exercise {
  const label = formatDose(dose);
  return {
    ...exercise,
    defaultSeconds: dose.seconds,
    defaultSets: dose.sets,
    defaultReps: dose.reps != null ? `${dose.reps} повторов, ${dose.sets} подход(а)` : label,
  };
}

export function adjustExercises(
  exercises: Exercise[],
  loads: Record<string, LoadRecord> | undefined,
  catalog: Exercise[] = EXERCISES_DB
): AdjustedExercise[] {
  const byId = catalogById(catalog);
  return exercises.map((exercise) => {
    const source = byId.get(exercise.id) || exercise;
    const ladder = buildLadder(source);
    const record = loads?.[ladder.id];
    const tracksThis = Boolean(record && (record.anchorId === exercise.id || ladder.steps[record.index]?.exerciseId === exercise.id));
    if (!record || !tracksThis) {
      return {
        exercise,
        direction: null,
        reason: '',
        targetLabel: exercise.defaultReps || `${exercise.defaultSeconds} сек`,
        pain: false,
      };
    }
    const dose = ladder.steps[Math.min(ladder.steps.length - 1, Math.max(0, record.index))];
    const replacement = byId.get(dose.exerciseId) || exercise;
    const shaped = withDose(replacement.id === exercise.id ? exercise : { ...replacement, category: exercise.category }, dose);
    const last = record.ratings[record.ratings.length - 1];
    return {
      exercise: shaped,
      direction: record.direction,
      reason: record.reason,
      targetLabel: formatDose(dose),
      pain: Boolean(last?.pain),
    };
  });
}

export function loadSummaries(
  loads: Record<string, LoadRecord> | undefined,
  catalog: Exercise[] = EXERCISES_DB
): { id: string; title: string; targetLabel: string; direction: LoadDirection; reason: string; ratings: EffortMark[] }[] {
  if (!loads) return [];
  const byId = catalogById(catalog);
  return Object.values(loads)
    .map((record) => {
      const sample = catalog.find((exercise) => buildLadder(exercise).id === record.ladderId) || byId.get(record.anchorId);
      if (!sample) return null;
      const ladder = buildLadder(sample.id === record.anchorId ? sample : byId.get(record.anchorId) || sample);
      const dose = ladder.steps[Math.min(ladder.steps.length - 1, Math.max(0, record.index))];
      const shown = byId.get(dose.exerciseId);
      return {
        id: record.ladderId,
        title: shown?.titleRu || sample.titleRu,
        targetLabel: formatDose(dose),
        direction: record.direction,
        reason: record.reason,
        ratings: record.ratings,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
}
