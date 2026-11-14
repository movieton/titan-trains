import React from 'react';
import { CompletedSessionLog, DailyBreakSlot, ExerciseCategory } from '../types/fitness';
import { Flame, CheckCircle2, XCircle, TrendingUp, Award, Calendar, Zap } from 'lucide-react';

interface MotivationScalesPanelProps {
  category: ExerciseCategory;
  logs: CompletedSessionLog[];
  breakSlots: DailyBreakSlot[];
  startWeightKg: number;
  currentWeightKg: number;
  targetWeightKg: number;
  onQuickLogComplete?: () => void;
}

function getLast14DaysISO(): { iso: string; dayShort: string; dayNum: string }[] {
  const days = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'];
  const result: { iso: string; dayShort: string; dayNum: string }[] = [];
  const now = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    result.push({
      iso: `${y}-${m}-${day}`,
      dayShort: days[d.getDay()],
      dayNum: day,
    });
  }
  return result;
}

export const MotivationScalesPanel: React.FC<MotivationScalesPanelProps> = ({
  category,
  logs,
  breakSlots,
  startWeightKg,
  currentWeightKg,
  targetWeightKg,
}) => {
  const last14 = getLast14DaysISO();
  const todayISO = last14[last14.length - 1].iso;

  const categoryLogs = logs.filter((l) => l.category === category);
  const totalSessionsDone = categoryLogs.length;
  const totalKcalCategory = categoryLogs.reduce((acc, l) => acc + l.kcalBurned, 0);
  const totalWalkingSteps = categoryLogs.reduce((acc, l) => acc + (l.walkingSteps || 0), 0);
  const totalWalkingDistanceKm = Math.round(categoryLogs.reduce((acc, l) => acc + (l.distanceKm || 0), 0) * 10) / 10;

  // Calculate consecutive streak & success vs missed over last 14 days
  let completedDaysCount = 0;
  let missedDaysCount = 0;
  let currentStreak = 0;

  const dayStatuses = last14.map((dayObj, idx) => {
    const dDate = new Date(dayObj.iso + 'T12:00:00');
    const dayOfWeek = dDate.getDay();

    if (category === 'morning') {
      const done = categoryLogs.some((l) => l.dateISO === dayObj.iso);
      if (done) completedDaysCount++;
      else if (idx < 13) missedDaysCount++; // don't penalize today yet if still in progress
      return { ...dayObj, status: done ? ('done' as const) : idx === 13 ? ('pending' as const) : ('missed' as const) };
    }

    if (category === 'breaks') {
      const slotsDoneOnDay = breakSlots.filter((s) => s.completedDates.includes(dayObj.iso)).length;
      const slotsSkippedOnDay = breakSlots.filter((s) => s.skippedDates.includes(dayObj.iso)).length;
      const loggedBreak = categoryLogs.some((l) => l.dateISO === dayObj.iso);
      if (slotsDoneOnDay > 0 || loggedBreak) {
        completedDaysCount++;
        return { ...dayObj, status: 'done' as const };
      }
      if (slotsSkippedOnDay > 0 || idx < 13) {
        missedDaysCount++;
        return { ...dayObj, status: idx === 13 && slotsSkippedOnDay === 0 ? ('pending' as const) : ('missed' as const) };
      }
      return { ...dayObj, status: 'pending' as const };
    }

    if (category === 'walking') {
      const done = categoryLogs.some((l) => l.dateISO === dayObj.iso);
      if (done) {
        completedDaysCount++;
        return { ...dayObj, status: 'done' as const };
      }
      if (idx < 13) {
        missedDaysCount++;
        return { ...dayObj, status: 'missed' as const };
      }
      return { ...dayObj, status: 'pending' as const };
    }

    // Kettlebell: scheduled on Mon(1), Wed(3), Fri(5), Sat(6)
    const isScheduledKbDay = [1, 3, 5, 6].includes(dayOfWeek);
    const done = categoryLogs.some((l) => l.dateISO === dayObj.iso);
    if (done) {
      completedDaysCount++;
      return { ...dayObj, status: 'done' as const };
    }
    if (!isScheduledKbDay) {
      return { ...dayObj, status: 'rest' as const };
    }
    if (idx === 13) {
      return { ...dayObj, status: 'pending' as const };
    }
    missedDaysCount++;
    return { ...dayObj, status: 'missed' as const };
  });

  for (let i = dayStatuses.length - 1; i >= 0; i--) {
    const st = dayStatuses[i].status;
    if (st === 'done') {
      currentStreak++;
    } else if (st === 'rest' || (i === dayStatuses.length - 1 && st === 'pending')) {
      continue;
    } else {
      break;
    }
  }

  // For Today's breaks specifically
  const todayBreakDone = breakSlots.filter((s) => s.completedDates.includes(todayISO)).length;
  const todayBreakSkipped = breakSlots.filter((s) => s.skippedDates.includes(todayISO)).length;

  const totalActionableDays = Math.max(1, completedDaysCount + missedDaysCount);
  const successRatePercent = Math.round((completedDaysCount / totalActionableDays) * 100);
  const missedRatePercent = Math.max(0, 100 - successRatePercent);

  const weightLost = Math.max(0, Number((startWeightKg - currentWeightKg).toFixed(1)));
  const totalGoalToLose = Math.max(1, startWeightKg - targetWeightKg);
  const weightProgressPercent = Math.min(100, Math.max(8, Math.round((weightLost / totalGoalToLose) * 100)));

  return (
    <div className="space-y-4">
      {/* Three Core Motivational Scales (Success / Missed / Overall Progress) */}
      <div className="p-5 rounded-3xl bg-gradient-to-br from-slate-900 via-[#0E1526] to-slate-900 border border-slate-800 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-400">
              Мотивационный радар дисциплины
            </span>
            <h3 className="text-lg sm:text-xl font-black text-white">
              {category === 'morning' && 'Статистика и Серия Утренних Зарядок'}
              {category === 'breaks' && 'Дисциплина Рабочих Перерывов за ПК'}
              {category === 'walking' && 'Аэробный Прогресс: Walking Pad и Шаги'}
              {category === 'kettlebell' && 'Силовой Прогресс: Гири 16/24 кг и Калистеника'}
            </h3>
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-extrabold self-start">
            <Flame className="w-4 h-4 text-amber-400 fill-amber-400" />
            <span>Серия без срывов: {currentStreak} дн. подряд</span>
          </div>
        </div>

        {/* 1. Шкала Успеха vs 2. Шкала Пропусков */}
        <div className="grid sm:grid-cols-3 gap-3.5">
          {/* Scale 1: Шкала Прогресса (Уровень и Цель) */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/90 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-amber-400 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4" />
                1. Шкала Прогресса
              </span>
              <span className="font-extrabold text-white">
                {totalSessionsDone} сессий • {totalKcalCategory} ккал
              </span>
            </div>
            <div className="w-full h-3 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(15, totalSessionsDone * 12))}%` }}
              />
            </div>
            <div className="text-[11px] text-slate-400 flex justify-between">
              <span>Вес: {currentWeightKg} кг (старт {startWeightKg} кг)</span>
              <span className="text-amber-300 font-semibold">Цель: {targetWeightKg} кг ({weightProgressPercent}%)</span>
            </div>
          </div>

          {/* Scale 2: Шкала Успеха */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-emerald-500/30 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                2. Шкала Успеха
              </span>
              <span className="font-extrabold text-emerald-400">{successRatePercent}% выполнено</span>
            </div>
            <div className="w-full h-3 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                style={{ width: `${successRatePercent}%` }}
              />
            </div>
            <div className="text-[11px] text-slate-400 flex justify-between">
              <span>Успешных дней (14 дн.): {completedDaysCount}</span>
              {category === 'breaks' && (
                <span className="text-emerald-300 font-semibold">Сегодня слотов: {todayBreakDone}/4</span>
              )}
            </div>
          </div>

          {/* Scale 3: Шкала Пропусков */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-rose-500/30 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-rose-400 flex items-center gap-1.5">
                <XCircle className="w-4 h-4" />
                3. Шкала Пропусков
              </span>
              <span className="font-extrabold text-rose-400">{missedRatePercent}% пропущено</span>
            </div>
            <div className="w-full h-3 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-rose-600 to-pink-500 rounded-full transition-all duration-500"
                style={{ width: `${missedRatePercent}%` }}
              />
            </div>
            <div className="text-[11px] text-slate-400 flex justify-between">
              <span>Пропущено дней: {missedDaysCount}</span>
              {category === 'breaks' ? (
                <span className="text-rose-300 font-semibold">Пропущено сегодня: {todayBreakSkipped}</span>
              ) : (
                <span className="text-rose-300 font-semibold">Держим ниже 15%!</span>
              )}
            </div>
          </div>
        </div>

        {/* 14-Day Visual Consistency Timeline */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-300" />
              Хроника дисциплины за последние 14 дней:
            </span>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1 text-emerald-400">● Выполнено</span>
              <span className="flex items-center gap-1 text-rose-400">● Пропуск</span>
              {category === 'kettlebell' && <span className="flex items-center gap-1 text-slate-400">● День отдыха</span>}
            </div>
          </div>

          <div className="grid grid-cols-7 sm:grid-cols-14 gap-1.5">
            {dayStatuses.map((d) => (
              <div
                key={d.iso}
                className={`p-2 rounded-xl border text-center transition ${
                  d.status === 'done'
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                    : d.status === 'missed'
                    ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                    : d.status === 'rest'
                    ? 'bg-slate-900/60 border-slate-800 text-slate-500'
                    : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                }`}
              >
                <div className="text-[10px] font-bold opacity-80">{d.dayShort}</div>
                <div className="text-xs font-black mt-0.5">{d.dayNum}</div>
                <div className="text-[10px] mt-0.5">
                  {d.status === 'done' ? '✓' : d.status === 'missed' ? '✕' : d.status === 'rest' ? '–' : '•'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Dedicated Walking Pad Summary Banner (if in walking category) */}
      {category === 'walking' && totalSessionsDone > 0 && (
        <div className="grid grid-cols-3 gap-2 p-3.5 rounded-3xl bg-emerald-950/40 border border-emerald-500/30 text-center">
          <div className="p-2 rounded-2xl bg-slate-950/80 border border-emerald-500/20">
            <div className="text-[10px] font-bold text-slate-400 uppercase">Всего шагов</div>
            <div className="text-base sm:text-lg font-black text-emerald-300">
              {totalWalkingSteps.toLocaleString('ru-RU')}
            </div>
          </div>
          <div className="p-2 rounded-2xl bg-slate-950/80 border border-emerald-500/20">
            <div className="text-[10px] font-bold text-slate-400 uppercase">Дистанция</div>
            <div className="text-base sm:text-lg font-black text-white">{totalWalkingDistanceKm} км</div>
          </div>
          <div className="p-2 rounded-2xl bg-slate-950/80 border border-emerald-500/20">
            <div className="text-[10px] font-bold text-slate-400 uppercase">В среднем / сессия</div>
            <div className="text-base sm:text-lg font-black text-amber-300">
              {Math.round(totalWalkingSteps / totalSessionsDone).toLocaleString('ru-RU')} ш.
            </div>
          </div>
        </div>
      )}

      {/* Recent Completed Sessions History */}
      <div className="p-4 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <Award className="w-4 h-4 text-amber-400" />
            Журнал выполненных тренировок ({categoryLogs.length})
          </h4>
          <span className="text-xs text-slate-400">Всего сожжено в разделе: {totalKcalCategory} ккал</span>
        </div>

        {categoryLogs.length === 0 ? (
          <div className="p-6 text-center rounded-2xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-400">
            Запустите первую тренировку во вкладке «Сегодня», чтобы открыть счёт побед!
          </div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {categoryLogs.slice(0, 8).map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/80 border border-slate-800/90 text-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold">
                    ✓
                  </div>
                  <div>
                    <div className="font-bold text-white">{log.title}</div>
                    <div className="text-[11px] text-slate-400">
                      Дата: {log.dateISO} • {Math.round(log.durationSeconds / 60)} мин • Упражнений:{' '}
                      {log.exercisesCompleted}/{log.exercisesTotal}
                      {log.walkingSteps ? ` • 🚶 ${log.walkingSteps.toLocaleString('ru-RU')} шагов` : ''}
                      {log.distanceKm ? ` (${log.distanceKm} км)` : ''}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-extrabold text-amber-400 flex items-center gap-1 justify-end">
                    <Zap className="w-3.5 h-3.5" />
                    {log.kcalBurned} ккал
                  </div>
                  <div className="text-[10px] text-emerald-400">
                    Спина: {log.backComfort === 'tired' ? 'Усталость' : 'Комфорт 100%'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
