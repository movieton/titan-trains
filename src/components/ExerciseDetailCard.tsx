import React, { useState } from 'react';
import { Exercise } from '../types/fitness';
import { BiomechanicalVisualizer } from './BiomechanicalVisualizer';
import {
  Play,
  ShieldCheck,
  Clock,
  Flame,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Heart,
  Dumbbell,
} from 'lucide-react';

interface ExerciseDetailCardProps {
  exercise: Exercise;
  index?: number;
  isFavorite?: boolean;
  onStartSingleExercise: (exercise: Exercise) => void;
  onToggleFavorite?: (exerciseId: string) => void;
}

const EQUIPMENT_LABELS: Record<string, string> = {
  bodyweight: 'Своё тело',
  mat: 'Коврик для йоги',
  bands: 'Фитнес-резинка',
  kb16: 'Гиря 16 кг',
  kb24: 'Гиря 24 кг',
};

export const ExerciseDetailCard: React.FC<ExerciseDetailCardProps> = ({
  exercise,
  index,
  isFavorite,
  onStartSingleExercise,
  onToggleFavorite,
}) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-3xl bg-slate-900/90 border border-slate-800/90 hover:border-slate-700/90 transition-all overflow-hidden shadow-lg">
      <div className="p-4 sm:p-5 space-y-4">
        {/* Top Metadata Row */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {typeof index === 'number' && (
                <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[11px] font-extrabold">
                  #{index + 1}
                </span>
              )}
              <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[11px] font-semibold">
                {exercise.subCategory}
              </span>
            </div>

            <h3 className="text-base sm:text-lg font-extrabold text-white leading-snug">
              {exercise.titleRu}
            </h3>
            <p className="text-xs text-slate-400 font-medium">{exercise.titleEn}</p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {onToggleFavorite && (
              <button
                type="button"
                onClick={() => onToggleFavorite(exercise.id)}
                className={`w-10 h-10 rounded-xl border transition flex items-center justify-center shrink-0 ${
                  isFavorite
                    ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                    : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
                }`}
                title="В избранное"
              >
                <Heart className={`w-4 h-4 ${isFavorite ? 'fill-rose-400' : ''}`} />
              </button>
            )}

            <button
              type="button"
              onClick={() => onStartSingleExercise(exercise)}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 h-10 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-extrabold text-xs shadow-md shadow-amber-500/15 transition shrink-0"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Таймер ({exercise.defaultSeconds}с)</span>
            </button>
          </div>
        </div>

        {/* Visual Demonstration (Verified Photos + Interactive Anatomical Muscle Map) */}
        <BiomechanicalVisualizer
          exerciseId={exercise.id}
          imageUrl={exercise.imageUrl}
          pose={exercise.pose}
          category={exercise.category}
          title={exercise.titleRu}
          muscleGroups={exercise.muscleGroups}
          secondaryMuscles={exercise.secondaryMuscles}
        />

        {/* Quick 3-Step Action Summary */}
        <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-1.5">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-400 block">
            Суть движения:
          </span>
          <div className="space-y-1 text-xs text-slate-200">
            {exercise.steps.slice(0, 3).map((s, i) => {
              const clean = s.replace(/^(Шаг|Фаза)\s*\d+[:.-]\s*/i, '').trim();
              const firstSentence = clean.split(/[.!?]/)[0].trim();
              return (
                <div key={i} className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="leading-snug">{firstSentence}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pills: Equipment, Muscles, Timer, Sets */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {exercise.equipment.map((eq) => (
            <span
              key={eq}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-semibold text-amber-300"
            >
              <Dumbbell className="w-3 h-3" />
              {EQUIPMENT_LABELS[eq] || eq}
            </span>
          ))}

          {exercise.muscleGroups.map((m) => (
            <span
              key={m}
              className="px-2.5 py-1 rounded-lg bg-cyan-950/40 border border-cyan-500/30 text-[11px] font-medium text-cyan-300"
            >
              {m}
            </span>
          ))}

          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-300">
            <Clock className="w-3 h-3 text-emerald-400" />
            {exercise.defaultReps || `${exercise.defaultSeconds} сек`} • {exercise.defaultSets} подход(а)
          </span>

          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-amber-300">
            <Flame className="w-3 h-3" /> ~{exercise.kcalEstimate} ккал
          </span>
        </div>

        {/* Description & Spine Safety Callout */}
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{exercise.description}</p>

        <div className="p-3 rounded-2xl bg-emerald-950/25 border border-emerald-500/30 flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-xs text-emerald-200/90 leading-relaxed">
            <strong className="text-emerald-400">Биомеханика и защита спины: </strong>
            {exercise.spineNote}
          </div>
        </div>

        {/* Expandable Step-by-Step + Mistakes */}
        <div className="pt-1 flex items-center justify-between border-t border-slate-800/80">
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 hover:text-amber-300 py-1.5 transition"
          >
            {expanded ? (
              <>
                <ChevronUp className="w-4 h-4" />
                <span>Скрыть пошаговую технику и разбор ошибок</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                <span>Пошаговая техника (4 фазы), дыхание и ошибки</span>
              </>
            )}
          </button>
        </div>

        {expanded && (
          <div className="space-y-3 pt-2 border-t border-slate-800/60 animate-fadeIn">
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Как выполнять правильно (по фазам):
              </div>
              <ol className="space-y-2 text-xs text-slate-300">
                {exercise.steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="p-3 rounded-xl bg-cyan-950/25 border border-cyan-500/25 text-xs text-cyan-200">
              <strong className="text-cyan-400">Паттерн дыхания: </strong>
              {exercise.breathing}
            </div>

            <div className="p-3 rounded-xl bg-rose-950/25 border border-rose-500/25 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-rose-400">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Частые ошибки (чего избегать):</span>
              </div>
              <ul className="list-disc list-inside text-xs text-rose-200/90 space-y-1">
                {exercise.commonMistakes.map((mistake, idx) => (
                  <li key={idx}>{mistake}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
