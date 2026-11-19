import { describe, expect, it } from 'vitest';
import { Exercise } from '../types/fitness';
import { migrateUserState } from './userState';
import {
  PAIN_MESSAGE,
  PULL_LADDER_ID,
  adjustExercises,
  applySessionRatings,
  buildLadder,
  stepLoad,
} from './loadProgression';

const mark = (effort: 1 | 2 | 3 | 4 | 5, pain = false) => ({ effort, pain });

function fakeExercise(partial: Partial<Exercise> & Pick<Exercise, 'id'>): Exercise {
  return {
    category: 'kettlebell',
    subCategory: '',
    school: '',
    titleRu: partial.id,
    titleEn: partial.id,
    equipment: ['kb16'],
    muscleGroups: [],
    secondaryMuscles: [],
    spineSafety: 'mcgill-stabilization',
    spineNote: '',
    description: '',
    steps: ['a', 'b', 'c', 'd'],
    breathing: '',
    commonMistakes: [],
    defaultSeconds: 40,
    defaultReps: '8 повторений',
    defaultSets: 3,
    restSeconds: 60,
    kcalEstimate: 20,
    pose: 'kb-deadlift',
    ...partial,
  };
}

describe('stepLoad', () => {
  it('needs two easy ratings before a step up, and never moves more than one', () => {
    expect(stepLoad(2, 6, [mark(2)]).direction).toBe('same');
    const up = stepLoad(2, 6, [mark(2), mark(1)]);
    expect(up).toMatchObject({ index: 3, direction: 'up' });
    expect(Math.abs(up.index - 2)).toBe(1);
  });

  it('keeps a 3, eases a 4, and steps back on a 5', () => {
    expect(stepLoad(2, 6, [mark(3)])).toMatchObject({ index: 2, direction: 'same' });
    expect(stepLoad(2, 6, [mark(4)])).toMatchObject({ index: 1, direction: 'down' });
    expect(stepLoad(2, 6, [mark(5)])).toMatchObject({ index: 1, direction: 'down' });
  });

  it('steps back on pain even after easy marks, and stops at the floor', () => {
    const eased = stepLoad(2, 6, [mark(1), mark(1, true)]);
    expect(eased.direction).toBe('down');
    expect(eased.reason).toBe(PAIN_MESSAGE);
    expect(stepLoad(0, 6, [mark(5, true)]).index).toBe(0);
  });

  it('does not climb past the last step', () => {
    expect(stepLoad(5, 6, [mark(2), mark(2)]).index).toBe(5);
  });
});

describe('ladders and session application', () => {
  it('caps a 16 kg exercise and can add only one set at the top', () => {
    const ladder = buildLadder(fakeExercise({ id: 'kb-demo', defaultReps: '8 повторений', defaultSets: 3, equipment: ['kb16'] }));
    const reps = ladder.steps.map((step) => step.reps);
    expect(Math.max(...reps.filter((value): value is number => value != null))).toBeLessThanOrEqual(16);
    expect(ladder.steps[ladder.steps.length - 1].sets).toBe(4);
    expect(ladder.steps.filter((step) => step.sets === 4)).toHaveLength(1);
  });

  it('walks the pull-up chain one dose at a time', () => {
    const hang = fakeExercise({
      id: 'brk-dead-hang',
      category: 'breaks',
      equipment: ['pullup-bar'],
      defaultReps: '15–20 секунд',
      defaultSeconds: 20,
      trackingMode: 'duration',
    });
    let loads = applySessionRatings({}, [hang], { effort: 2, pain: false });
    expect(loads[PULL_LADDER_ID].index).toBe(0);
    loads = applySessionRatings(loads, [hang], { effort: 2, pain: false });
    expect(loads[PULL_LADDER_ID].index).toBe(1);
    expect(loads[PULL_LADDER_ID].direction).toBe('up');
    const shown = adjustExercises([hang], loads, [hang]);
    expect(shown[0].exercise.defaultSeconds).toBe(20);
    expect(shown[0].direction).toBe('up');
  });

  it('does not replace a harder pull with the hang the person is progressing', () => {
    const hang = fakeExercise({ id: 'brk-dead-hang', category: 'breaks', equipment: ['pullup-bar'], trackingMode: 'duration', defaultReps: '20 секунд' });
    const chin = fakeExercise({ id: 'kb-chin-up', equipment: ['pullup-bar'], defaultReps: '5 повторений', defaultSets: 3 });
    let loads = applySessionRatings({}, [hang], { effort: 2, pain: false });
    loads = applySessionRatings(loads, [hang], { effort: 2, pain: false });
    const adjusted = adjustExercises([chin], loads, [hang, chin]);
    expect(adjusted[0].exercise.id).toBe('kb-chin-up');
    expect(adjusted[0].direction).toBeNull();
  });

  it('keeps an old log when the profile is migrated', () => {
    const migrated = migrateUserState({
      logs: [{ id: 'kept', dateISO: '2026-11-01', category: 'morning', title: 'Зарядка', durationSeconds: 600, exercisesCompleted: 1, exercisesTotal: 1, kcalBurned: 10 }],
      profile: { name: 'Антон', age: 36, heightCm: 178, currentWeightKg: 100, targetWeightKg: 88, startWeightKg: 110, equipment: ['kb16'] },
    });
    expect(migrated.logs).toHaveLength(1);
    expect(migrated.loadProgress).toEqual({});
  });
});
