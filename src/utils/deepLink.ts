import { EXERCISES_DB } from '../data/exercises';
import { Exercise, ExerciseCategory, UserState } from '../types/fitness';
import {
  generateBreakWorkout,
  generateKettlebellWorkout,
  generateMorningWorkout,
  generateWalkingWorkout,
} from './workoutBuilder';

export const START_ACTIONS = ['start_morning', 'start_break', 'start_kettlebell', 'start_walking'] as const;
export type StartAction = (typeof START_ACTIONS)[number];

export interface LaunchSession {
  title: string;
  category: ExerciseCategory;
  exercises: Exercise[];
  slotIdToComplete?: string;
}

export function parseStartAction(value: string | null): StartAction | null {
  if (!value) return null;
  return (START_ACTIONS as readonly string[]).includes(value) ? (value as StartAction) : null;
}

function minutesOfClock(value: string): number | null {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function buildSessionForAction(
  action: StartAction,
  userState: UserState,
  now = new Date(),
  noMatMode = false
): LaunchSession | null {
  if (action === 'start_morning') {
    const plan = generateMorningWorkout(userState.selectedDurationMorning || 10, undefined, noMatMode);
    return plan.exercises.length > 0 ? { title: plan.title, category: 'morning', exercises: plan.exercises } : null;
  }

  if (action === 'start_kettlebell') {
    const plan = generateKettlebellWorkout(userState.selectedKettlebellProgram || 'foundation-16');
    return plan.exercises.length > 0 ? { title: plan.title, category: 'kettlebell', exercises: plan.exercises } : null;
  }

  if (action === 'start_walking') {
    const plan = generateWalkingWorkout(
      userState.selectedWalkingProtocol || 'zone2',
      userState.selectedWalkingDuration || 20,
      userState.profile.currentWeightKg || 80
    );
    return plan.exercises.length > 0 ? { title: plan.title, category: 'walking', exercises: plan.exercises } : null;
  }

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  let closest: (typeof userState.breakSlots)[number] | null = null;
  let closestDelta = Number.POSITIVE_INFINITY;
  for (const slot of userState.breakSlots) {
    const enabled = userState.reminders.breakSlotsConfig?.[slot.id]?.enabled !== false;
    if (!enabled) continue;
    const slotMinutes = minutesOfClock(slot.timeLabel);
    if (slotMinutes === null) continue;
    const delta = Math.abs(slotMinutes - nowMinutes);
    if (delta < closestDelta) {
      closest = slot;
      closestDelta = delta;
    }
  }

  if (closest && closestDelta <= 40) {
    const resolved = closest.exerciseIds
      .map((id) => EXERCISES_DB.find((exercise) => exercise.id === id))
      .filter((exercise): exercise is Exercise => Boolean(exercise));
    if (resolved.length > 0) {
      return {
        title: `${closest.timeLabel} — ${closest.title}`,
        category: 'breaks',
        exercises: resolved,
        slotIdToComplete: closest.id,
      };
    }
  }

  const plan = generateBreakWorkout(userState.selectedDurationBreak || 5, 0);
  return plan.exercises.length > 0 ? { title: plan.title, category: 'breaks', exercises: plan.exercises } : null;
}
