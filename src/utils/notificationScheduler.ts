import { DailyBreakSlot, ReminderSettings } from '../types/fitness';
import { getDefaultBreakSlots } from './workoutBuilder';

export function getNotificationPermissionStatus(): 'granted' | 'denied' | 'default' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  try {
    const perm = await Notification.requestPermission();
    return perm;
  } catch {
    return 'denied';
  }
}

export async function sendSystemNotification(
  title: string,
  options: NotificationOptions & { url?: string } = {}
): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission !== 'granted') return false;

  const { url, ...rest } = options;
  const notificationOptions: NotificationOptions & { vibrate?: number[] } = {
    icon: '/icon.svg',
    badge: '/icon.svg',
    vibrate: [150, 80, 150],
    data: {
      url: url || '/',
    },
    ...rest,
  };

  try {
    // Try via ServiceWorkerRegistration first (recommended for PWAs)
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && 'showNotification' in reg) {
        await reg.showNotification(title, notificationOptions);
        return true;
      }
    }
    // Fallback to desktop Notification constructor
    new Notification(title, notificationOptions);
    return true;
  } catch {
    return false;
  }
}

const NOTIFIED_KEYS = 'titan_notified_keys';
const LEGACY_NOTIFIED_KEY = 'titan_last_notified_key';
export const REMINDER_GRACE_MINUTES = 5;

export type ReminderKind = 'morning' | 'break' | 'kettlebell' | 'walking';

export interface ReminderAgendaItem {
  id: string;
  kind: ReminderKind;
  time: string;
  title: string;
  body: string;
  days: number[];
  url: string;
}

export function localDateISO(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function clockToMinutes(value: string): number | null {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** True from the scheduled minute through the grace window. Not before. */
export function isDueNow(now: Date, hhmm: string, graceMinutes = REMINDER_GRACE_MINUTES): boolean {
  const target = clockToMinutes(hhmm);
  if (target === null) return false;
  const current = now.getHours() * 60 + now.getMinutes();
  const delta = current - target;
  return delta >= 0 && delta <= graceMinutes;
}

export function buildReminderAgenda(
  settings: ReminderSettings,
  slots: Pick<DailyBreakSlot, 'id' | 'timeLabel' | 'title'>[] = getDefaultBreakSlots()
): ReminderAgendaItem[] {
  const items: ReminderAgendaItem[] = [];
  if (settings.morningEnabled) {
    items.push({
      id: 'morning',
      kind: 'morning',
      time: settings.morningTime || '09:30',
      title: 'Утренняя зарядка',
      body: 'Разбудите суставы мягким комплексом на 10 минут.',
      days: settings.morningDays?.length ? settings.morningDays : [1, 2, 3, 4, 5],
      url: '/?action=start_morning',
    });
  }
  if (settings.breaksEnabled) {
    const days = settings.breaksDays?.length ? settings.breaksDays : [1, 2, 3, 4, 5];
    for (const slot of slots) {
      const cfg = settings.breakSlotsConfig?.[slot.id];
      if (cfg && cfg.enabled === false) continue;
      const time = cfg?.time || slot.timeLabel;
      items.push({
        id: slot.id,
        kind: 'break',
        time,
        title: slot.title,
        body: `Пора размяться. Фокус: ${slot.title}.`,
        days,
        url: '/?action=start_break',
      });
    }
  }
  if (settings.kettlebellEnabled) {
    items.push({
      id: 'kettlebell',
      kind: 'kettlebell',
      time: settings.kettlebellTime || '20:00',
      title: 'Тренировка с гирей',
      body: 'Вечерний силовой протокол. Подготовьте гирю и место на полу.',
      days: settings.kettlebellDays?.length ? settings.kettlebellDays : [1, 3, 5, 6],
      url: '/?action=start_kettlebell',
    });
  }
  if (settings.walkingEnabled) {
    items.push({
      id: 'walking',
      kind: 'walking',
      time: settings.walkingTime || '12:30',
      title: 'Ходьба',
      body: 'Время шага в зоне 2.',
      days: settings.walkingDays?.length ? settings.walkingDays : [0, 1, 2, 3, 4, 5, 6],
      url: '/?action=start_walking',
    });
  }
  return items;
}

function readNotifiedKeys(): Set<string> {
  const keys = new Set<string>();
  try {
    const raw = JSON.parse(localStorage.getItem(NOTIFIED_KEYS) || '[]');
    if (Array.isArray(raw)) {
      for (const key of raw) if (typeof key === 'string') keys.add(key);
    }
  } catch {
    // ignore
  }
  const legacy = localStorage.getItem(LEGACY_NOTIFIED_KEY);
  if (legacy) keys.add(legacy);
  return keys;
}

function writeNotifiedKeys(keys: Set<string>) {
  const list = [...keys].slice(-40);
  localStorage.setItem(NOTIFIED_KEYS, JSON.stringify(list));
}

export function checkScheduledReminders(
  settings: ReminderSettings,
  slots: Pick<DailyBreakSlot, 'id' | 'timeLabel' | 'title'>[],
  onTrigger: (type: ReminderKind, title: string) => void,
  now = new Date()
) {
  if (typeof window === 'undefined') return;

  const todayISO = localDateISO(now);
  const notified = readNotifiedKeys();
  let changed = false;

  for (const item of buildReminderAgenda(settings, slots)) {
    if (!item.days.includes(now.getDay())) continue;
    if (!isDueNow(now, item.time)) continue;
    const triggerKey = `${item.kind}_${item.id}_${todayISO}_${item.time}`;
    if (notified.has(triggerKey)) continue;
    notified.add(triggerKey);
    changed = true;
    void sendSystemNotification(item.title, { body: item.body, url: item.url });
    onTrigger(item.kind, item.title);
  }

  if (changed) writeNotifiedKeys(notified);
}

// Convert day number (0=SU, 1=MO...) to iCalendar day code
function dayNumToIcsCode(num: number): string {
  const map: Record<number, string> = {
    0: 'SU',
    1: 'MO',
    2: 'TU',
    3: 'WE',
    4: 'TH',
    5: 'FR',
    6: 'SA',
  };
  return map[num] || 'MO';
}

function formatIcsTime(timeStr: string): string {
  const [h, m] = timeStr.split(':');
  return `T${(h || '08').padStart(2, '0')}${(m || '00').padStart(2, '0')}00`;
}

export function generateCalendarICS(
  settings: ReminderSettings,
  slots: Pick<DailyBreakSlot, 'id' | 'timeLabel' | 'title'>[] = getDefaultBreakSlots()
): string {
  const now = new Date();
  const dtstamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const todayDateStr = `${y}${m}${d}`;

  let ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TITAN Ultimate Fitness//Workout Schedule//RU',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:TITAN Тренировки и Перерывы',
    'X-WR-TIMEZONE:Europe/Moscow',
  ];

  // 1. Morning Routine Event
  if (settings.morningEnabled) {
    const morningDays = settings.morningDays && settings.morningDays.length > 0 ? settings.morningDays : [1, 2, 3, 4, 5];
    const byDays = morningDays.map(dayNumToIcsCode).join(',');
    const timeCode = formatIcsTime(settings.morningTime || '09:30');
    ics.push(
      'BEGIN:VEVENT',
      `UID:titan-morning-${todayDateStr}@lalo-app.com`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${todayDateStr}${timeCode}`,
      `DURATION:PT15M`,
      `RRULE:FREQ=WEEKLY;BYDAY=${byDays}`,
      'SUMMARY:🌅 Утренняя зарядка TITAN (10-15 мин)',
      'DESCRIPTION:Суставная разминка, декомпрессия позвоночника и лимфодренаж.',
      'BEGIN:VALARM',
      'TRIGGER:-PT0M',
      'ACTION:DISPLAY',
      'DESCRIPTION:Время утренней зарядки TITAN',
      'END:VALARM',
      'END:VEVENT'
    );
  }

  // 2. Break Slots Events
  if (settings.breaksEnabled) {
    const breaksDays = settings.breaksDays && settings.breaksDays.length > 0 ? settings.breaksDays : [1, 2, 3, 4, 5];
    const byDays = breaksDays.map(dayNumToIcsCode).join(',');

    slots.forEach((slot, idx) => {
      const cfg = settings.breakSlotsConfig?.[slot.id];
      const enabled = cfg ? cfg.enabled : true;
      const timeStr = cfg?.time || slot.timeLabel;
      if (enabled) {
        const timeCode = formatIcsTime(timeStr);
        ics.push(
          'BEGIN:VEVENT',
          `UID:titan-break-${slot.id}-${idx}@lalo-app.com`,
          `DTSTAMP:${dtstamp}`,
          `DTSTART:${todayDateStr}${timeCode}`,
          `DURATION:PT5M`,
          `RRULE:FREQ=WEEKLY;BYDAY=${byDays}`,
          `SUMMARY:⚡ Офисный перерыв: ${slot.title}`,
          'DESCRIPTION:Быстрая разминка анти-гиподинамия прямо за столом без коврика.',
          'BEGIN:VALARM',
          'TRIGGER:-PT0M',
          'ACTION:DISPLAY',
          'DESCRIPTION:Время перерыва TITAN',
          'END:VALARM',
          'END:VEVENT'
        );
      }
    });
  }

  // 3. Kettlebell Routine Event
  if (settings.kettlebellEnabled) {
    const kbDays = settings.kettlebellDays && settings.kettlebellDays.length > 0 ? settings.kettlebellDays : [1, 3, 5, 6];
    const byDays = kbDays.map(dayNumToIcsCode).join(',');
    const timeCode = formatIcsTime(settings.kettlebellTime || '20:00');
    ics.push(
      'BEGIN:VEVENT',
      `UID:titan-kettlebell-${todayDateStr}@lalo-app.com`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${todayDateStr}${timeCode}`,
      `DURATION:PT30M`,
      `RRULE:FREQ=WEEKLY;BYDAY=${byDays}`,
      'SUMMARY:🏋️ Тренировка с Гирями TITAN (16/24 кг)',
      'DESCRIPTION:Силовой фундамент, жиросжигающая баллистика и защита спины по стандарту StrongFirst.',
      'BEGIN:VALARM',
      'TRIGGER:-PT10M',
      'ACTION:DISPLAY',
      'DESCRIPTION:Через 10 минут тренировка с гирями TITAN',
      'END:VALARM',
      'END:VEVENT'
    );
  }

  // 4. Walking Pad Routine Event
  if (settings.walkingEnabled) {
    const walkingDays = settings.walkingDays && settings.walkingDays.length > 0 ? settings.walkingDays : [0, 1, 2, 3, 4, 5, 6];
    const byDays = walkingDays.map(dayNumToIcsCode).join(',');
    const timeCode = formatIcsTime(settings.walkingTime || '14:30');
    ics.push(
      'BEGIN:VEVENT',
      `UID:titan-walking-${todayDateStr}@lalo-app.com`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${todayDateStr}${timeCode}`,
      `DURATION:PT20M`,
      `RRULE:FREQ=WEEKLY;BYDAY=${byDays}`,
      'SUMMARY:🚶 Прогулка на Walking Pad TITAN (Зона 2)',
      'DESCRIPTION:Аэробное кардио в Зоне 2, ускорение метаболизма и утилизация глюкозы.',
      'BEGIN:VALARM',
      'TRIGGER:-PT5M',
      'ACTION:DISPLAY',
      'DESCRIPTION:Через 5 минут прогулка на Walking Pad',
      'END:VALARM',
      'END:VEVENT'
    );
  }

  ics.push('END:VCALENDAR');
  return ics.join('\r\n');
}

export function downloadCalendarICS(
  settings: ReminderSettings,
  slots: Pick<DailyBreakSlot, 'id' | 'timeLabel' | 'title'>[] = getDefaultBreakSlots()
) {
  const icsData = generateCalendarICS(settings, slots);
  const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'titan-workout-schedule.ics';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
