import { describe, expect, it } from 'vitest';
import { EXERCISES_DB } from '../data/exercises';
import { exerciseFacets, matchesExerciseQuery } from './exerciseMeta';
import { buildSessionForAction, parseStartAction } from './deepLink';
import { buildNativeNotificationSpecs } from './nativeReminders';
import { buildReminderAgenda, isDueNow } from './notificationScheduler';
import { findDroppedGeneratedExercises, findDuplicateExerciseIds, findUnresolvedPlanReferences } from './planIntegrity';
import { buildFreshUserState, mergeBreakSlots, migrateUserState } from './userState';
import { getDefaultBreakSlots } from './workoutBuilder';

describe('plan references', () => {
  it('resolves every built-in plan id, including the band row that used to be missing', () => {
    expect(findUnresolvedPlanReferences()).toEqual([]);
    expect(findDuplicateExerciseIds()).toEqual([]);
    expect(findDroppedGeneratedExercises()).toEqual([]);
    expect(EXERCISES_DB.some((exercise) => exercise.id === 'brk-band-row-pulldown')).toBe(true);
  });
});

describe('break schedule migration', () => {
  it('uses five clock times and keeps completion history from the old four slots', () => {
    const merged = mergeBreakSlots(
      [
        { id: 'slot-1100', timeLabel: '11:00', title: 'old', focus: '', exerciseIds: ['missing'], completedDates: ['2026-11-01'], skippedDates: [] },
        { id: 'slot-1330', timeLabel: '13:30', title: 'old', focus: '', exerciseIds: [], completedDates: ['2026-11-02'], skippedDates: ['2026-11-03'] },
        { id: 'slot-1600', timeLabel: '16:00', title: 'old', focus: '', exerciseIds: [], completedDates: [], skippedDates: [] },
        { id: 'slot-1800', timeLabel: '18:00', title: 'old', focus: '', exerciseIds: [], completedDates: ['2026-11-04'], skippedDates: [] },
      ],
      { 'slot-1600': { enabled: true, time: '16:10' } }
    );
    expect(merged.slots.map((slot) => slot.timeLabel)).toEqual(['11:30', '13:00', '14:30', '16:10', '17:30']);
    expect(merged.slots[0].completedDates).toEqual(['2026-11-01']);
    expect(merged.slots[1].skippedDates).toEqual(['2026-11-03']);
    expect(merged.slots[3].exerciseIds).toContain('brk-band-row-pulldown');
    expect(merged.slots[4].completedDates).toEqual(['2026-11-04']);
  });

  it('does not turn an existing save into a new empty profile', () => {
    const migrated = migrateUserState({
      profile: { name: 'Антон', age: 36, heightCm: 178, currentWeightKg: 110, targetWeightKg: 88, startWeightKg: 110, equipment: ['kb16'], lowerBackGuard: true },
      logs: [{ id: 'kept', dateISO: '2026-11-01' }],
      reminders: { morningTime: '07:15', kettlebellTime: '21:05', morningEnabled: true, breaksEnabled: true, kettlebellEnabled: true, soundEnabled: true },
    });
    expect(migrated.profile.onboarded).toBe(true);
    expect(migrated.logs).toHaveLength(1);
    expect(migrated.reminders.morningTime).toBe('07:15');
    expect(migrated.reminders.kettlebellTime).toBe('21:05');
    expect(migrated.profile.equipment).toContain('kb16');
  });

  it('moves untouched legacy defaults to 09:30 and 20:00', () => {
    const migrated = migrateUserState({
      reminders: { morningTime: '08:00', kettlebellTime: '19:30' },
      logs: [],
    });
    expect(migrated.reminders.morningTime).toBe('09:30');
    expect(migrated.reminders.kettlebellTime).toBe('20:00');
  });
});

describe('reminders', () => {
  it('builds the approved default clocks instead of 11:00 / 13:30 / 18:00', () => {
    const fresh = buildFreshUserState();
    const agenda = buildReminderAgenda(fresh.reminders, fresh.breakSlots);
    const times = agenda.map((item) => item.time);
    expect(times).toContain('09:30');
    expect(times).toContain('20:00');
    expect(times).toEqual(expect.arrayContaining(['11:30', '13:00', '14:30', '16:00', '17:30']));
    expect(times).not.toContain('11:00');
    expect(times).not.toContain('13:30');
    expect(times).not.toContain('18:00');
  });

  it('fires during the grace window and not a minute early', () => {
    expect(isDueNow(new Date('2026-11-19T11:30:20'), '11:30')).toBe(true);
    expect(isDueNow(new Date('2026-11-19T11:34:00'), '11:30')).toBe(true);
    expect(isDueNow(new Date('2026-11-19T11:36:00'), '11:30')).toBe(false);
    expect(isDueNow(new Date('2026-11-19T11:29:50'), '11:30')).toBe(false);
  });

  it('prepares native alarms for each selected weekday', () => {
    const slots = getDefaultBreakSlots();
    const specs = buildNativeNotificationSpecs(buildFreshUserState().reminders, slots);
    const breaks = specs.filter((spec) => spec.url.includes('start_break'));
    expect(breaks.length).toBe(5 * 5);
    expect(specs.some((spec) => spec.hour === 9 && spec.minute === 30)).toBe(true);
    expect(specs.some((spec) => spec.hour === 20 && spec.minute === 0)).toBe(true);
  });
});

describe('library and deep links', () => {
  it('marks the new pulling exercises and finds them by a synonym', () => {
    const pullUp = EXERCISES_DB.find((exercise) => exercise.id === 'kb-pull-up');
    const hang = EXERCISES_DB.find((exercise) => exercise.id === 'brk-dead-hang');
    const singleLeg = EXERCISES_DB.find((exercise) => exercise.id === 'kb-single-leg-deadlift-16');
    expect(pullUp?.equipment).toContain('pullup-bar');
    expect(exerciseFacets(pullUp!).pattern).toBe('Вертикальная тяга');
    expect(exerciseFacets(hang!).level).toBe(1);
    expect(exerciseFacets(singleLeg!).pattern).toBe('Шарнир');
    expect(matchesExerciseQuery(pullUp!, exerciseFacets(pullUp!), 'турник')).toBe(true);
    const climber = EXERCISES_DB.find((exercise) => exercise.id === 'morn-slow-mountain-climber-incline');
    expect(matchesExerciseQuery(climber!, exerciseFacets(climber!), 'турник')).toBe(false);
  });

  it('opens the screen named by a notification action', () => {
    expect(parseStartAction('start_walking')).toBe('start_walking');
    expect(parseStartAction('nope')).toBeNull();
    const state = buildFreshUserState();
    state.profile.onboarded = true;
    const morning = buildSessionForAction('start_morning', state, new Date('2026-11-19T09:30:00'));
    const pullBreak = buildSessionForAction('start_break', state, new Date('2026-11-19T14:32:00'));
    expect(morning?.category).toBe('morning');
    expect(morning && morning.exercises.length).toBeGreaterThan(0);
    expect(pullBreak?.slotIdToComplete).toBe('slot-1430');
    expect(pullBreak?.exercises.map((exercise) => exercise.id)).toContain('brk-dead-hang');
  });
});
