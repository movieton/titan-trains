import React, { useState, useMemo } from 'react';
import { Footprints, Sparkles, Play, Flame, Activity, ShieldCheck, HeartPulse, Shuffle, Dumbbell } from 'lucide-react';
import { Exercise, ExerciseCategory, MixGoal, MixStructure } from '../types/fitness';
import { generateWalkingWorkout, generateHybridMixWorkout } from '../utils/workoutBuilder';
import { soundEngine } from '../utils/soundEngine';

interface WalkingTabPanelProps {
  userWeightKg: number;
  onStartWorkout: (session: {
    title: string;
    category: ExerciseCategory;
    exercises: Exercise[];
  }) => void;
  onShowBanner: (message: string) => void;
}

export const WalkingTabPanel: React.FC<WalkingTabPanelProps> = ({
  userWeightKg = 110,
  onStartWorkout,
  onShowBanner,
}) => {
  const safeWeight = typeof userWeightKg === 'number' && !isNaN(userWeightKg) && userWeightKg >= 30 && userWeightKg <= 300
    ? userWeightKg
    : 110;

  // State for Block 1: Pure Walking Protocols
  const [selectedWalkingProtocol, setSelectedWalkingProtocol] = useState<'zone2' | 'intervals' | 'after_meal' | 'recovery'>('zone2');
  const [selectedWalkingDuration, setSelectedWalkingDuration] = useState<15 | 20 | 30 | 45>(20);

  // State for Block 2: Smart Hybrid Workout Mixer
  const [mixGoal, setMixGoal] = useState<MixGoal>('fatburn');
  const [mixStructure, setMixStructure] = useState<MixStructure>('walk_then_kb');
  const [mixDuration, setMixDuration] = useState<20 | 25 | 35 | 45>(35);
  const [mixIncludeBands, setMixIncludeBands] = useState(true);
  const [mixIncludeKettlebells, setMixIncludeKettlebells] = useState(true);

  // Current pure walking plan
  const walkingPlan = useMemo(() => {
    return generateWalkingWorkout(selectedWalkingProtocol, selectedWalkingDuration, safeWeight);
  }, [selectedWalkingProtocol, selectedWalkingDuration, safeWeight]);

  // Current hybrid mix plan
  const hybridPlan = useMemo(() => {
    return generateHybridMixWorkout({
      goal: mixGoal,
      structure: mixStructure,
      totalMinutes: mixDuration,
      includeBands: mixIncludeBands,
      includeKettlebells: mixIncludeKettlebells,
      userWeightKg: safeWeight,
    });
  }, [mixGoal, mixStructure, mixDuration, mixIncludeBands, mixIncludeKettlebells, safeWeight]);

  // 1-Tap Quick Start for Zone 2 (20 min)
  const handleInstantZone2Start = () => {
    soundEngine.playStartBell();
    const plan = generateWalkingWorkout('zone2', 20, safeWeight);
    onStartWorkout({
      title: plan.title,
      category: 'walking',
      exercises: plan.exercises,
    });
  };

  // Launch a specific protocol immediately
  const handleLaunchProtocol = (protoId: 'zone2' | 'intervals' | 'after_meal' | 'recovery') => {
    soundEngine.playStartBell();
    const plan = generateWalkingWorkout(protoId, selectedWalkingDuration, safeWeight);
    onStartWorkout({
      title: plan.title,
      category: 'walking',
      exercises: plan.exercises,
    });
  };

  // Saturday-aware auto-recommendation based on 7-day split
  const handleAutoRecommendMix = () => {
    soundEngine.playStartBell();
    const day = new Date().getDay(); // 0 = Sun, 1 = Mon, ..., 5 = Fri, 6 = Sat

    if (day === 0) {
      // Sunday: Full Rest & Active Recovery
      setMixGoal('recovery');
      setMixStructure('walking_only');
      setMixDuration(20);
      onShowBanner('✨ Воскресенье: Мягкое восстановительное кардио на Walking Pad (Зона 2, 20 мин).');
    } else if (day === 6) {
      // Saturday: Spine Armor after Friday heavy deadlift
      setMixGoal('recovery');
      setMixStructure('circuit_5_2');
      setMixDuration(20);
      onShowBanner('✨ Суббота: Декомпрессия после пятничной становой тяги (круговой микс 4 мин ходьбы + кор по МакГиллу).');
    } else if (day === 2 || day === 4) {
      // Tuesday / Thursday: Rest from heavy bells
      setMixGoal('fatburn');
      setMixStructure('walking_only');
      setMixDuration(35);
      onShowBanner('✨ День отдыха от гирь: 35 мин активного жиросжигания на дорожке в Зоне 2.');
    } else if (day === 1 || day === 5) {
      // Monday / Friday: Heavy lift days
      setMixGoal('strength_cardio');
      setMixStructure('walk_then_kb');
      setMixDuration(35);
      onShowBanner('✨ Силовой день: 12 мин разогрев на дорожке ➔ Силовой комплекс с гирями.');
    } else {
      // Wednesday: Push day
      setMixGoal('fatburn');
      setMixStructure('kb_then_walk');
      setMixDuration(35);
      onShowBanner('✨ Среда: Силовой блок на верх тела ➔ Кардио-финишер на дорожке.');
    }
  };

  return (
    <div className="space-y-6">
      {/* 1-Tap Instant Quick Launch Banner (Rule of 2 Taps) */}
      <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-emerald-950/80 via-slate-900/90 to-teal-950/80 border-2 border-emerald-500/50 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-black uppercase tracking-wider">
            <Sparkles className="w-3 h-3" />
            Быстрый старт в 1 клик
          </div>
          <h3 className="text-base sm:text-lg font-black text-white">
            Зона 2: Базовое жиросжигание (20 мин)
          </h3>
          <p className="text-xs text-slate-300">
            Оптимальный темп 5.2 км/ч для веса {safeWeight} кг • ~2 440 шагов • ~158 ккал
          </p>
        </div>

        <button
          type="button"
          onClick={handleInstantZone2Start}
          className="px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-emerald-500/25 active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer self-start sm:self-auto shrink-0"
        >
          <Play className="w-4 h-4 fill-current" />
          <span>Начать ходьбу сейчас</span>
        </button>
      </div>

      {/* BLOCK 1: FAST START WALKING PROTOCOLS */}
      <div className="p-5 rounded-3xl bg-slate-900/90 border border-emerald-500/30 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Footprints className="w-4 h-4" />
              Блок 1: Протоколы ходьбы на Walking Pad
            </span>
            <h3 className="text-lg sm:text-xl font-black text-white mt-0.5">
              Аэробная база без ударной нагрузки на суставы
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Вес {safeWeight} кг: ходьба 5.0–5.6 км/ч сжигает свободные жирные кислоты и защищает диски L4-S1.
            </p>
          </div>

          {/* Duration Selector: 15 / 20 / 30 / 45 min */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 self-start">
            {([15, 20, 30, 45] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setSelectedWalkingDuration(m)}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                  selectedWalkingDuration === m
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {m} мин
              </button>
            ))}
          </div>
        </div>

        {/* 4 Protocol Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            {
              id: 'zone2' as const,
              title: '1. Жиросжигание в Зоне 2',
              speed: '5.0 – 5.6 км/ч',
              badge: '🔥 Макс. окисление жиров',
              desc: 'Разговорный темп (ЧСС 110–125 уд). Идеально для утилизации висцерального жира без кортизола.',
            },
            {
              id: 'intervals' as const,
              title: '2. Спортивный темповый шаг',
              speed: '5.8 – 6.4 км/ч',
              badge: '⚡ Кардио-интервалы',
              desc: 'Чередование ускорений 6.0 км/ч с базовым шагом. Разгон VO2 Max и метаболизма на 24 часа.',
            },
            {
              id: 'after_meal' as const,
              title: '3. Сахарный насос после еды',
              speed: '4.8 – 5.3 км/ч',
              badge: '🩸 GLUT-4 утилизация',
              desc: 'Включение камбаловидной мышцы (Soleus) через 20 мин после еды: снижает пик глюкозы на 35%.',
            },
            {
              id: 'recovery' as const,
              title: '4. Восстановление спины',
              speed: '3.5 – 4.5 км/ч',
              badge: '🛡 Декомпрессия дисков',
              desc: 'Мягкий разгрузочный шаг для дней отдыха. Снимает отек и венозный застой после рабочего дня.',
            },
          ].map((proto) => {
            const isSel = selectedWalkingProtocol === proto.id;
            const dummyPlan = generateWalkingWorkout(proto.id, selectedWalkingDuration, safeWeight);
            return (
              <div
                key={proto.id}
                onClick={() => setSelectedWalkingProtocol(proto.id)}
                className={`p-4 rounded-2xl border transition cursor-pointer space-y-2.5 ${
                  isSel
                    ? 'bg-emerald-950/35 border-emerald-500/70 shadow-lg shadow-emerald-500/15'
                    : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-black text-white">{proto.title}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                    {proto.speed}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-snug">{proto.desc}</p>
                <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[11px] text-slate-400">
                  <span>🚶 ~{dummyPlan.walkingStats?.estimatedSteps} шагов</span>
                  <span>📏 ~{dummyPlan.walkingStats?.estimatedDistanceKm} км</span>
                  <span className="font-bold text-amber-400">~{dummyPlan.estimatedKcal} ккал</span>
                </div>

                {/* 1-Tap Launch Button Inside Card */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLaunchProtocol(proto.id);
                  }}
                  className="w-full py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 hover:border-emerald-500/50 text-emerald-300 text-xs font-black flex items-center justify-center gap-1.5 transition active:scale-98 cursor-pointer mt-1"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Старт ({selectedWalkingDuration} мин)</span>
                </button>
              </div>
            );
          })}
        </div>

        {/* Start Walking Button */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 text-xs text-slate-300">
            <span>Итог: <strong>{walkingPlan.estimatedMinutes} мин</strong></span>
            <span>•</span>
            <span>Шаги: <strong className="text-emerald-400">{walkingPlan.walkingStats?.estimatedSteps}</strong></span>
            <span>•</span>
            <span>Дистанция: <strong className="text-white">{walkingPlan.walkingStats?.estimatedDistanceKm} км</strong></span>
            <span>•</span>
            <span>Расход: <strong className="text-amber-400">{walkingPlan.estimatedKcal} ккал</strong></span>
          </div>

          <button
            type="button"
            onClick={() => {
              soundEngine.playStartBell();
              onStartWorkout({
                title: walkingPlan.title,
                category: 'walking',
                exercises: walkingPlan.exercises,
              });
            }}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20 active:scale-95 transition flex items-center gap-2 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Запустить выбранную ходьбу</span>
          </button>
        </div>
      </div>

      {/* BLOCK 2: SMART WORKOUT MIXER */}
      <div className="p-5 rounded-3xl bg-slate-900/90 border border-teal-500/30 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-extrabold uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
              <Shuffle className="w-4 h-4" />
              Блок 2: Умный Микшер (Дорожка + Гири + Резинки)
            </span>
            <h3 className="text-lg sm:text-xl font-black text-white mt-0.5">
              Комбинатор тренировок под самочувствие и день недели
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Гибридные протоколы: сжигают на 40% больше жира, сохраняя суставную безопасность.
            </p>
          </div>

          <button
            type="button"
            onClick={handleAutoRecommendMix}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/40 text-teal-300 text-xs font-black transition cursor-pointer self-start"
            title="Автоматический подбор оптимального микса под день недели и вес 110 кг"
          >
            <Sparkles className="w-3.5 h-3.5 text-teal-400" />
            <span>✨ Подобрать под день недели и вес</span>
          </button>
        </div>

        {/* 1. Goal Selector */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            1. Цель тренировки на сегодня:
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { id: 'fatburn' as const, label: '🔥 Жиросжигание' },
              { id: 'strength_cardio' as const, label: '💪 Сила + Кардио' },
              { id: 'recovery' as const, label: '🛡 Восстановление' },
              { id: 'glucose_control' as const, label: '🩸 Контроль сахара' },
            ].map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setMixGoal(g.id)}
                className={`py-2 px-3 rounded-xl text-xs font-extrabold transition cursor-pointer border ${
                  mixGoal === g.id
                    ? 'bg-teal-500 text-slate-950 border-teal-400 shadow-md shadow-teal-500/20'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        {/* 2. Structure Selector */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            2. Структура распределения нагрузки:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              {
                id: 'walking_only' as const,
                title: '🚶 Только дорожка',
                desc: 'Чистая аэробная работа без перегруза спины',
              },
              {
                id: 'walk_then_kb' as const,
                title: '🚶 ➔ 🏋️ Дорожка ➔ Гири',
                desc: 'Разминка на полотне ➔ силовой комплекс',
              },
              {
                id: 'kb_then_walk' as const,
                title: '🏋️ ➔ 🚶 Гири ➔ Дорожка',
                desc: 'Мобилизация жиров силой ➔ аэробный финишер',
              },
              {
                id: 'circuit_5_2' as const,
                title: '🔄 Круговой микс (4+1)',
                desc: 'Станции: 4 мин шаг + 1 мин сила/резина',
              },
            ].map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setMixStructure(s.id)}
                className={`p-3 rounded-xl text-left border transition cursor-pointer space-y-0.5 ${
                  mixStructure === s.id
                    ? 'bg-teal-950/40 border-teal-500/70 text-white shadow-md'
                    : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="text-xs font-black text-white">{s.title}</div>
                <div className="text-[11px] opacity-75">{s.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 3. Duration & Equipment Toggles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-800">
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              3. Общее время занятия:
            </span>
            <div className="flex items-center gap-2">
              {([20, 25, 35, 45] as const).map((dur) => (
                <button
                  key={dur}
                  type="button"
                  onClick={() => setMixDuration(dur)}
                  className={`flex-1 py-2 rounded-xl text-xs font-black transition cursor-pointer border ${
                    mixDuration === dur
                      ? 'bg-teal-500 text-slate-950 border-teal-400 shadow-md'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  {dur} минут
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              4. Дополнительный инвентарь:
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMixIncludeBands(!mixIncludeBands)}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-extrabold transition cursor-pointer border ${
                  mixIncludeBands
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                    : 'bg-slate-950 border-slate-800 text-slate-500 line-through'
                }`}
              >
                🎗️ Резинки
              </button>
              <button
                type="button"
                onClick={() => setMixIncludeKettlebells(!mixIncludeKettlebells)}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-extrabold transition cursor-pointer border ${
                  mixIncludeKettlebells
                    ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                    : 'bg-slate-950 border-slate-800 text-slate-500 line-through'
                }`}
              >
                🏋️ Гири 16/24 кг
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Preview of Generated Mix Plan */}
        <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="text-xs font-black text-white">{hybridPlan.title}</div>
              <div className="text-[11px] text-teal-400">{hybridPlan.subtitle}</div>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-emerald-400 font-bold">~{hybridPlan.walkingStats?.estimatedSteps} шагов</span>
              <span>•</span>
              <span className="text-amber-400 font-bold">~{hybridPlan.estimatedKcal} ккал</span>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-snug">{hybridPlan.coachFocus}</p>

          {/* Exercise list preview */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {hybridPlan.exercises.map((ex, idx) => (
              <span
                key={ex.id + idx}
                className="shrink-0 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 font-medium"
              >
                {idx + 1}. {ex.titleRu}
              </span>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              soundEngine.playStartBell();
              onStartWorkout({
                title: hybridPlan.title,
                category: 'walking',
                exercises: hybridPlan.exercises,
              });
            }}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-teal-500/20 active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Запустить Смикшированную Тренировку ({hybridPlan.estimatedMinutes} мин)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
