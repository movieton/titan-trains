import {
  DailyBreakSlot,
  EquipmentId,
  LoadRecord,
  ReminderSettings,
  TrainingGoal,
  UserState,
} from '../types/fitness';
import {
  DEFAULT_EVENING_TIME,
  DEFAULT_MORNING_TIME,
  getDefaultBreakSlots,
  LEGACY_BREAK_SLOT_MAP,
  LEGACY_EVENING_TIMES,
  LEGACY_MORNING_TIMES,
} from './workoutBuilder';

export const STORAGE_KEY = 'titan_ultimate_fitness_state_v2';

const EQUIPMENT_IDS: EquipmentId[] = ['bodyweight', 'mat', 'bands', 'kb16', 'kb24', 'walking-pad', 'pullup-bar'];
const GOALS: TrainingGoal[] = ['tone', 'fatloss', 'strength', 'mobility'];

export function defaultReminderSettings(): ReminderSettings {
  const slots = getDefaultBreakSlots();
  const breakSlotsConfig: NonNullable<ReminderSettings['breakSlotsConfig']> = {};
  for (const slot of slots) {
    breakSlotsConfig[slot.id] = { enabled: true, time: slot.timeLabel };
  }
  return {
    morningEnabled: true,
    morningTime: DEFAULT_MORNING_TIME,
    morningDays: [1, 2, 3, 4, 5],
    breaksEnabled: true,
    breaksIntervalMinutes: 90,
    breaksStartHour: 11,
    breaksEndHour: 18,
    breaksDays: [1, 2, 3, 4, 5],
    breakSlotsConfig,
    kettlebellEnabled: true,
    kettlebellTime: DEFAULT_EVENING_TIME,
    kettlebellDays: [1, 3, 5, 6],
    walkingEnabled: false,
    walkingTime: '12:30',
    walkingDays: [1, 2, 3, 4, 5],
    soundEnabled: true,
  };
}

export function buildFreshUserState(): UserState {
  return {
    profile: {
      name: '',
      age: 0,
      heightCm: 0,
      startWeightKg: 0,
      currentWeightKg: 0,
      targetWeightKg: 0,
      equipment: ['bodyweight', 'kb16', 'pullup-bar'],
      lowerBackGuard: true,
      onboarded: false,
      goal: 'fatloss',
    },
    googleUser: null,
    weightHistory: [],
    logs: [],
    breakSlots: getDefaultBreakSlots(),
    customMediaLinks: {},
    favoriteExerciseIds: [],
    loadProgress: {},
    reminders: defaultReminderSettings(),
    selectedDurationMorning: 10,
    selectedDurationBreak: 5,
    selectedKettlebellProgram: 'foundation-16',
    selectedWalkingProtocol: 'zone2',
    selectedWalkingDuration: 20,
  };
}

function asNumber(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function normalizeClock(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, '0')}:${match[2]}`;
}

export function mergeBreakSlots(
  savedSlots: unknown,
  savedConfig: ReminderSettings['breakSlotsConfig'] | undefined
): { slots: DailyBreakSlot[]; breakSlotsConfig: NonNullable<ReminderSettings['breakSlotsConfig']> } {
  const defaults = getDefaultBreakSlots();
  const saved = Array.isArray(savedSlots) ? (savedSlots as DailyBreakSlot[]) : [];
  const consumed = new Set<string>();

  const slots = defaults.map((fresh) => {
    const legacy = Object.entries(LEGACY_BREAK_SLOT_MAP).find(([, mapping]) => mapping.nextId === fresh.id);
    const legacyId = legacy?.[0];
    const legacyTime = legacy?.[1].legacyTime;
    const savedSlot =
      saved.find((slot) => slot && slot.id === fresh.id) ||
      (legacyId ? saved.find((slot) => slot && slot.id === legacyId) : undefined);
    if (savedSlot?.id) consumed.add(savedSlot.id);

    const cfg = savedConfig?.[fresh.id] || (legacyId ? savedConfig?.[legacyId] : undefined);
    let time = fresh.timeLabel;
    const cfgTime = normalizeClock(cfg?.time);
    if (cfgTime && cfgTime !== legacyTime) time = cfgTime;
    else if (
      savedSlot &&
      savedSlot.id === fresh.id &&
      normalizeClock(savedSlot.timeLabel) &&
      savedSlot.timeLabel !== legacyTime &&
      savedSlot.timeLabel !== fresh.timeLabel
    ) {
      time = savedSlot.timeLabel;
    }

    return {
      ...fresh,
      timeLabel: normalizeClock(time) || fresh.timeLabel,
      completedDates: asStringList(savedSlot?.completedDates),
      skippedDates: asStringList(savedSlot?.skippedDates),
    };
  });

  for (const extra of saved) {
    if (!extra || typeof extra.id !== 'string') continue;
    if (consumed.has(extra.id) || extra.id in LEGACY_BREAK_SLOT_MAP) continue;
    if (!extra.id.startsWith('slot-custom-')) continue;
    const cfg = savedConfig?.[extra.id];
    slots.push({
      id: extra.id,
      timeLabel: normalizeClock(cfg?.time || extra.timeLabel) || '15:00',
      title: typeof extra.title === 'string' && extra.title.trim() ? extra.title : 'Дополнительный перерыв',
      focus: typeof extra.focus === 'string' && extra.focus.trim() ? extra.focus : 'Короткая разгрузка за столом',
      exerciseIds:
        Array.isArray(extra.exerciseIds) && extra.exerciseIds.length > 0
          ? extra.exerciseIds.filter((id): id is string => typeof id === 'string')
          : ['brk-doorway-pec-opener', 'brk-neck-upper-trap-lateral-stretch'],
      completedDates: asStringList(extra.completedDates),
      skippedDates: asStringList(extra.skippedDates),
    });
  }

  const breakSlotsConfig: NonNullable<ReminderSettings['breakSlotsConfig']> = {};
  for (const slot of slots) {
    const legacy = Object.entries(LEGACY_BREAK_SLOT_MAP).find(([, mapping]) => mapping.nextId === slot.id);
    const prev = savedConfig?.[slot.id] || (legacy ? savedConfig?.[legacy[0]] : undefined);
    breakSlotsConfig[slot.id] = {
      enabled: prev ? prev.enabled !== false : true,
      time: slot.timeLabel,
    };
  }

  return { slots, breakSlotsConfig };
}

function sanitizeEquipment(value: unknown, fallback: EquipmentId[]): EquipmentId[] {
  if (!Array.isArray(value)) return fallback;
  const picked = value.filter((id): id is EquipmentId => EQUIPMENT_IDS.includes(id as EquipmentId));
  return picked.length > 0 ? picked : fallback;
}

function sanitizeLoadProgress(value: unknown): Record<string, LoadRecord> {
  if (!value || typeof value !== 'object') return {};
  const out: Record<string, LoadRecord> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object') continue;
    const record = raw as Partial<LoadRecord>;
    if (typeof record.ladderId !== 'string' || typeof record.anchorId !== 'string') continue;
    const index = Math.max(0, Math.floor(asNumber(record.index, 0)));
    const ratings = Array.isArray(record.ratings)
      ? record.ratings
          .filter((mark) => mark && typeof mark === 'object')
          .map((mark) => {
            const effort = Math.round(asNumber((mark as { effort?: unknown }).effort, 3));
            return {
              effort: Math.min(5, Math.max(1, effort)) as 1 | 2 | 3 | 4 | 5,
              pain: Boolean((mark as { pain?: unknown }).pain),
              at: typeof (mark as { at?: unknown }).at === 'string' ? (mark as { at: string }).at : '',
            };
          })
          .slice(-8)
      : [];
    const direction = record.direction === 'up' || record.direction === 'down' ? record.direction : 'same';
    out[key] = {
      ladderId: record.ladderId,
      anchorId: record.anchorId,
      index,
      ratings,
      direction,
      reason: typeof record.reason === 'string' ? record.reason.slice(0, 180) : '',
    };
  }
  return out;
}

export function migrateUserState(raw: unknown): UserState {
  const fresh = buildFreshUserState();
  if (!raw || typeof raw !== 'object') return fresh;
  const data = raw as Partial<UserState>;
  const profile = (data.profile || {}) as Partial<UserState['profile']>;
  const remindersIn = (data.reminders || {}) as Partial<ReminderSettings>;
  const mergedSlots = mergeBreakSlots(data.breakSlots, remindersIn.breakSlotsConfig);

  const morningTime = normalizeClock(remindersIn.morningTime);
  const eveningTime = normalizeClock(remindersIn.kettlebellTime);

  const reminders: ReminderSettings = {
    ...fresh.reminders,
    ...remindersIn,
    morningTime: !morningTime || LEGACY_MORNING_TIMES.includes(morningTime) ? DEFAULT_MORNING_TIME : morningTime,
    kettlebellTime: !eveningTime || LEGACY_EVENING_TIMES.includes(eveningTime) ? DEFAULT_EVENING_TIME : eveningTime,
    morningDays: Array.isArray(remindersIn.morningDays) && remindersIn.morningDays.length ? remindersIn.morningDays : fresh.reminders.morningDays,
    breaksDays: Array.isArray(remindersIn.breaksDays) && remindersIn.breaksDays.length ? remindersIn.breaksDays : fresh.reminders.breaksDays,
    kettlebellDays:
      Array.isArray(remindersIn.kettlebellDays) && remindersIn.kettlebellDays.length
        ? remindersIn.kettlebellDays
        : fresh.reminders.kettlebellDays,
    breakSlotsConfig: mergedSlots.breakSlotsConfig,
    soundEnabled: remindersIn.soundEnabled !== false,
  };

  const goal = GOALS.includes(profile.goal as TrainingGoal) ? (profile.goal as TrainingGoal) : undefined;

  return {
    ...fresh,
    ...data,
    profile: {
      name: typeof profile.name === 'string' ? profile.name : 'Титан',
      age: asNumber(profile.age, 36),
      heightCm: asNumber(profile.heightCm, 178),
      startWeightKg: asNumber(profile.startWeightKg, asNumber(profile.currentWeightKg, 110)),
      currentWeightKg: asNumber(profile.currentWeightKg, 110),
      targetWeightKg: asNumber(profile.targetWeightKg, 88),
      equipment: sanitizeEquipment(profile.equipment, fresh.profile.equipment),
      lowerBackGuard: profile.lowerBackGuard !== false,
      onboarded: true,
      goal,
    },
    googleUser:
      data.googleUser && typeof data.googleUser === 'object'
        ? { ...data.googleUser, syncMode: 'local-plus-backup' }
        : null,
    logs: Array.isArray(data.logs) ? data.logs : [],
    weightHistory: Array.isArray(data.weightHistory) ? data.weightHistory : [],
    favoriteExerciseIds: asStringList(data.favoriteExerciseIds),
    loadProgress: sanitizeLoadProgress(data.loadProgress),
    customMediaLinks: data.customMediaLinks && typeof data.customMediaLinks === 'object' ? data.customMediaLinks : {},
    breakSlots: mergedSlots.slots,
    reminders,
    selectedDurationMorning: data.selectedDurationMorning || fresh.selectedDurationMorning,
    selectedDurationBreak: data.selectedDurationBreak || fresh.selectedDurationBreak,
    selectedKettlebellProgram: data.selectedKettlebellProgram || fresh.selectedKettlebellProgram,
  };
}

export function loadUserState(): UserState {
  if (typeof localStorage === 'undefined') return buildFreshUserState();
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return buildFreshUserState();
    return migrateUserState(JSON.parse(saved));
  } catch {
    return buildFreshUserState();
  }
}

export function requestPersistentStorage(): void {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return;
  navigator.storage.persist().catch(() => {
    // The browser may refuse. Export to JSON remains the backup.
  });
}
