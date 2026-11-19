import { DailyBreakSlot, ReminderSettings } from '../types/fitness';

export interface NativeNotificationSpec {
  id: number;
  title: string;
  body: string;
  hour: number;
  minute: number;
  /** Capacitor ScheduleOn weekday: Sunday = 1 … Saturday = 7. */
  weekday: number;
  url: string;
  actionTypeId: 'WORKOUT';
}

export interface NativeSyncResult {
  mode: 'native' | 'web';
  scheduled: number;
  reason?: string;
}

const WEEKDAY_FROM_JS = [1, 2, 3, 4, 5, 6, 7];

function clockParts(value: string): { hour: number; minute: number } | null {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

function stableId(key: string): number {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 33 + key.charCodeAt(i)) % 2000000000;
  return hash + 1;
}

export function buildNativeNotificationSpecs(
  settings: ReminderSettings,
  slots: Pick<DailyBreakSlot, 'id' | 'timeLabel' | 'title'>[]
): NativeNotificationSpec[] {
  const specs: NativeNotificationSpec[] = [];
  const push = (
    key: string,
    title: string,
    body: string,
    time: string,
    days: number[],
    url: string
  ) => {
    const clock = clockParts(time);
    if (!clock) return;
    for (const jsDay of days) {
      if (jsDay < 0 || jsDay > 6) continue;
      specs.push({
        id: stableId(`${key}-${jsDay}-${time}`),
        title,
        body,
        hour: clock.hour,
        minute: clock.minute,
        weekday: WEEKDAY_FROM_JS[jsDay],
        url,
        actionTypeId: 'WORKOUT',
      });
    }
  };

  if (settings.morningEnabled) {
    push(
      'morning',
      'Утренняя зарядка',
      '10 минут мягкой разминки. Титан откроет комплекс.',
      settings.morningTime || '09:30',
      settings.morningDays?.length ? settings.morningDays : [1, 2, 3, 4, 5],
      '/?action=start_morning'
    );
  }

  if (settings.breaksEnabled) {
    const days = settings.breaksDays?.length ? settings.breaksDays : [1, 2, 3, 4, 5];
    for (const slot of slots) {
      const cfg = settings.breakSlotsConfig?.[slot.id];
      if (cfg && cfg.enabled === false) continue;
      push(
        slot.id,
        `Перерыв ${cfg?.time || slot.timeLabel}`,
        slot.title,
        cfg?.time || slot.timeLabel,
        days,
        '/?action=start_break'
      );
    }
  }

  if (settings.kettlebellEnabled) {
    push(
      'kettlebell',
      'Вечерняя тренировка',
      'Гиря и калистеника по расписанию.',
      settings.kettlebellTime || '20:00',
      settings.kettlebellDays?.length ? settings.kettlebellDays : [1, 3, 5],
      '/?action=start_kettlebell'
    );
  }

  if (settings.walkingEnabled) {
    push(
      'walking',
      'Ходьба',
      'Зона 2 на дорожке.',
      settings.walkingTime || '12:30',
      settings.walkingDays?.length ? settings.walkingDays : [1, 2, 3, 4, 5],
      '/?action=start_walking'
    );
  }

  return specs;
}

interface LocalNotificationsApi {
  requestPermissions: () => Promise<{ display: string }>;
  registerActionTypes: (options: unknown) => Promise<void>;
  getPending: () => Promise<{ notifications: { id: number }[] }>;
  cancel: (options: { notifications: { id: number }[] }) => Promise<void>;
  schedule: (options: { notifications: unknown[] }) => Promise<void>;
  addListener: (event: string, handler: (event: { actionId: string; notification: { extra?: { url?: string }; title?: string; body?: string } }) => void) => Promise<{ remove: () => void }>;
}

let listenerReady = false;

async function loadLocalNotifications(): Promise<LocalNotificationsApi | null> {
  const cap = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  if (!cap?.isNativePlatform?.()) return null;
  try {
    const specifier = '@capacitor/local-notifications';
    const mod = (await import(/* @vite-ignore */ specifier)) as {
      LocalNotifications: LocalNotificationsApi;
    };
    return mod.LocalNotifications;
  } catch {
    return null;
  }
}

/**
 * Schedules exact local notifications when the app runs inside Capacitor.
 * In a browser tab this returns immediately: the site cannot wake Android at 11:30.
 */
export async function syncNativeReminders(
  settings: ReminderSettings,
  slots: Pick<DailyBreakSlot, 'id' | 'timeLabel' | 'title'>[]
): Promise<NativeSyncResult> {
  const api = await loadLocalNotifications();
  if (!api) return { mode: 'web', scheduled: 0, reason: 'no-native-scheduler' };

  const permission = await api.requestPermissions();
  if (permission.display !== 'granted') {
    return { mode: 'native', scheduled: 0, reason: 'permission-denied' };
  }

  await api.registerActionTypes({
    types: [
      {
        id: 'WORKOUT',
        actions: [
          { id: 'start', title: 'Начать' },
          { id: 'snooze', title: 'Отложить 10 мин' },
        ],
      },
    ],
  });

  if (!listenerReady) {
    listenerReady = true;
    await api.addListener('localNotificationActionPerformed', (event) => {
      if (event.actionId === 'snooze') {
        const at = new Date(Date.now() + 10 * 60 * 1000);
        void api.schedule({
          notifications: [
            {
              id: stableId(`snooze-${at.toISOString()}`),
              title: event.notification.title || 'Титан',
              body: event.notification.body || 'Отложенное напоминание',
              schedule: { at, allowWhileIdle: true },
              actionTypeId: 'WORKOUT',
              extra: event.notification.extra,
            },
          ],
        });
        return;
      }
      const url = event.notification.extra?.url;
      if (url && typeof window !== 'undefined') window.location.assign(url);
    });
  }

  const pending = await api.getPending();
  if (pending.notifications.length > 0) {
    await api.cancel({ notifications: pending.notifications.map((item) => ({ id: item.id })) });
  }

  const specs = buildNativeNotificationSpecs(settings, slots);
  if (specs.length === 0) return { mode: 'native', scheduled: 0 };

  await api.schedule({
    notifications: specs.map((spec) => ({
      id: spec.id,
      title: spec.title,
      body: spec.body,
      actionTypeId: spec.actionTypeId,
      extra: { url: spec.url },
      schedule: {
        on: { weekday: spec.weekday, hour: spec.hour, minute: spec.minute },
        allowWhileIdle: true,
      },
    })),
  });

  return { mode: 'native', scheduled: specs.length };
}
