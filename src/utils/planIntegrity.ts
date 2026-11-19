import { EXERCISES_DB, KETTLEBELL_COMPLEXES_DB } from '../data/exercises';
import {
  BREAK_PRIORITY_IDS,
  KETTLEBELL_PROGRAM_IDS,
  generateBreakWorkout,
  generateKettlebellWorkout,
  generateMorningWorkout,
  getDefaultBreakSlots,
  morningPlanIds,
} from './workoutBuilder';

const WALKING_PLAN_IDS = [
  'walk-warmup-pace',
  'walk-zone2-steady',
  'walk-power-stride',
  'walk-postmeal-glucose',
  'walk-cooldown-recovery',
];

const HYBRID_PLAN_IDS = [
  'kb-goblet-squat-16-24',
  'kb-gorilla-row',
  'kb-half-kneeling-press',
  'kb-farmers-offset-walk',
  'kb-swing-2h',
  'kb-deadbug-pullover',
  'kb-halo-16',
  'kb-calisthenics-band-row-superset',
];

export interface PlanReference {
  source: string;
  id: string;
}

export function collectPlanReferences(): PlanReference[] {
  const refs: PlanReference[] = [];
  const push = (source: string, ids: string[]) => {
    for (const id of ids) refs.push({ source, id });
  };

  for (const minutes of [10, 15, 20] as const) {
    push(`morning ${minutes}`, morningPlanIds(minutes, false));
    push(`morning ${minutes} no-mat`, morningPlanIds(minutes, true));
  }
  push('break priority', BREAK_PRIORITY_IDS);
  for (const slot of getDefaultBreakSlots()) push(`slot ${slot.id}`, slot.exerciseIds);
  for (const [program, ids] of Object.entries(KETTLEBELL_PROGRAM_IDS)) push(`kettlebell ${program}`, ids);
  push('walking', WALKING_PLAN_IDS);
  push('hybrid', HYBRID_PLAN_IDS);
  for (const complex of KETTLEBELL_COMPLEXES_DB) {
    push(
      `complex ${complex.id}`,
      complex.exercises.map((item) => item.exerciseId)
    );
  }
  return refs;
}

export function findUnresolvedPlanReferences(): string[] {
  const known = new Set(EXERCISES_DB.map((exercise) => exercise.id));
  return collectPlanReferences()
    .filter((ref) => !known.has(ref.id))
    .map((ref) => `${ref.source}: ${ref.id}`);
}

export function findDuplicateExerciseIds(): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const exercise of EXERCISES_DB) {
    if (seen.has(exercise.id)) dupes.add(exercise.id);
    seen.add(exercise.id);
  }
  return [...dupes];
}

/** Generators used to drop unknown ids. The built plan must keep every requested id. */
export function findDroppedGeneratedExercises(): string[] {
  const problems: string[] = [];
  for (const minutes of [10, 15, 20] as const) {
    for (const noMat of [false, true]) {
      const ids = morningPlanIds(minutes, noMat);
      const plan = generateMorningWorkout(minutes, 1, noMat);
      if (plan.exercises.length !== ids.length) {
        problems.push(`morning ${minutes} noMat=${noMat}: ${plan.exercises.length}/${ids.length}`);
      }
    }
  }
  for (const program of Object.keys(KETTLEBELL_PROGRAM_IDS) as (keyof typeof KETTLEBELL_PROGRAM_IDS)[]) {
    const plan = generateKettlebellWorkout(program);
    const expected = KETTLEBELL_PROGRAM_IDS[program].length;
    if (plan.exercises.length !== expected) {
      problems.push(`${program}: ${plan.exercises.length}/${expected}`);
    }
  }
  for (const slot of getDefaultBreakSlots()) {
    const resolved = slot.exerciseIds.filter((id) => EXERCISES_DB.some((exercise) => exercise.id === id));
    if (resolved.length !== slot.exerciseIds.length) {
      problems.push(`${slot.id}: ${resolved.length}/${slot.exerciseIds.length}`);
    }
  }
  const breakPlan = generateBreakWorkout(10, 0);
  if (breakPlan.exercises.length < 4) problems.push(`break generator too short: ${breakPlan.exercises.length}`);
  return problems;
}
