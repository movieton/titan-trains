import { ReminderSettings } from '../types/fitness';

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

  const notificationOptions: NotificationOptions & { vibrate?: number[] } = {
    icon: '/icon.svg',
    badge: '/icon.svg',
    vibrate: [150, 80, 150],
    data: {
      url: options.url || '/',
    },
    ...options,
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

const LAST_NOTIFIED_KEY = 'titan_last_notified_key';

export function checkScheduledReminders(
  settings: ReminderSettings,
  onTrigger: (type: 'morning' | 'break' | 'kettlebell', title: string) => void
) {
  if (typeof window === 'undefined') return;

  const now = new Date();
  const currentDayOfWeek = now.getDay(); // 0 = ВС, 1 = ПН, ..., 6 = СБ
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const currentTimeStr = `${hours}:${minutes}`;
  const todayISO = now.toISOString().slice(0, 10);

  const lastNotified = localStorage.getItem(LAST_NOTIFIED_KEY) || '';

  // 1. Morning Routine Check
  const morningDays = settings.morningDays && settings.morningDays.length > 0 ? settings.morningDays : [1, 2, 3, 4, 5];
  if (settings.morningEnabled && morningDays.includes(currentDayOfWeek)) {
    if (currentTimeStr === (settings.morningTime || '08:30')) {
      const triggerKey = `morning_${todayISO}_${currentTimeStr}`;
      if (lastNotified !== triggerKey) {
        localStorage.setItem(LAST_NOTIFIED_KEY, triggerKey);
        sendSystemNotification('🌅 Время Утренней Зарядки!', {
          body: 'Разбудите суставы и запустите лимфу мягким 10-минутным комплексом.',
          url: '/?action=start_morning',
        });
        onTrigger('morning', 'Утренняя зарядка');
      }
    }
  }

  // 2. Break Slots Check
  const breaksDays = settings.breaksDays && settings.breaksDays.length > 0 ? settings.breaksDays : [1, 2, 3, 4, 5];
  if (settings.breaksEnabled && breaksDays.includes(currentDayOfWeek)) {
    const slots = [
      { id: 'slot-1100', defaultTime: '11:00', title: 'Шея, глаза и кисти' },
      { id: 'slot-1330', defaultTime: '13:30', title: 'Сосудистый насос и таз' },
      { id: 'slot-1600', defaultTime: '16:00', title: 'Анти-сутулость и грудь' },
      { id: 'slot-1800', defaultTime: '18:00', title: 'Сброс стресса и поясница' },
    ];

    slots.forEach((s) => {
      const cfg = settings.breakSlotsConfig?.[s.id];
      const enabled = cfg ? cfg.enabled : true;
      const targetTime = cfg ? cfg.time : s.defaultTime;

      if (enabled && currentTimeStr === targetTime) {
        const triggerKey = `break_${s.id}_${todayISO}_${currentTimeStr}`;
        if (lastNotified !== triggerKey) {
          localStorage.setItem(LAST_NOTIFIED_KEY, triggerKey);
          sendSystemNotification(`⚡ Офисный перерыв (${targetTime})`, {
            body: `Пора размяться! 3-минутный фокус: ${s.title}.`,
            url: '/?action=start_break',
          });
          onTrigger('break', s.title);
        }
      }
    });
  }

  // 3. Kettlebell Workout Check
  const kbDays = settings.kettlebellDays && settings.kettlebellDays.length > 0 ? settings.kettlebellDays : [1, 3, 5, 6];
  if (settings.kettlebellEnabled && kbDays.includes(currentDayOfWeek)) {
    if (currentTimeStr === (settings.kettlebellTime || '19:00')) {
      const triggerKey = `kb_${todayISO}_${currentTimeStr}`;
      if (lastNotified !== triggerKey) {
        localStorage.setItem(LAST_NOTIFIED_KEY, triggerKey);
        sendSystemNotification('🏋️ Время тренировки с Гирями!', {
          body: 'Сегодня по расписанию силовой протокол. Подготовьте гири и коврик.',
          url: '/?action=start_kettlebell',
        });
        onTrigger('kettlebell', 'Тренировка с гирями');
      }
    }
  }

  // 4. Walking Pad Check
  const walkingDays = settings.walkingDays && settings.walkingDays.length > 0 ? settings.walkingDays : [0, 1, 2, 3, 4, 5, 6];
  if (settings.walkingEnabled && walkingDays.includes(currentDayOfWeek)) {
    if (currentTimeStr === (settings.walkingTime || '14:30')) {
      const triggerKey = `walking_${todayISO}_${currentTimeStr}`;
      if (lastNotified !== triggerKey) {
        localStorage.setItem(LAST_NOTIFIED_KEY, triggerKey);
        sendSystemNotification('🚶 Время кардио на Walking Pad!', {
          body: '20 минут в Зоне 2: включите дорожку, разомните суставы и запустите жиросжигание.',
          url: '/?action=start_walking',
        });
        onTrigger('break', 'Прогулка на Walking Pad');
      }
    }
  }
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

export function generateCalendarICS(settings: ReminderSettings): string {
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
    const timeCode = formatIcsTime(settings.morningTime || '08:30');
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

    const defaultSlots = [
      { id: 'slot-1100', defaultTime: '11:00', title: 'Офисный перерыв: Шея, глаза и кисти' },
      { id: 'slot-1330', defaultTime: '13:30', title: 'Офисный перерыв: Сосудистый насос и таз' },
      { id: 'slot-1600', defaultTime: '16:00', title: 'Офисный перерыв: Анти-сутулость и грудь' },
      { id: 'slot-1800', defaultTime: '18:00', title: 'Офисный перерыв: Сброс стресса и поясница' },
    ];

    defaultSlots.forEach((slot, idx) => {
      const cfg = settings.breakSlotsConfig?.[slot.id];
      const enabled = cfg ? cfg.enabled : true;
      const timeStr = cfg ? cfg.time : slot.defaultTime;
      if (enabled) {
        const timeCode = formatIcsTime(timeStr);
        ics.push(
          'BEGIN:VEVENT',
          `UID:titan-break-${slot.id}-${idx}@lalo-app.com`,
          `DTSTAMP:${dtstamp}`,
          `DTSTART:${todayDateStr}${timeCode}`,
          `DURATION:PT5M`,
          `RRULE:FREQ=WEEKLY;BYDAY=${byDays}`,
          `SUMMARY:⚡ ${slot.title}`,
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
    const timeCode = formatIcsTime(settings.kettlebellTime || '19:00');
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

export function downloadCalendarICS(settings: ReminderSettings) {
  const icsData = generateCalendarICS(settings);
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
