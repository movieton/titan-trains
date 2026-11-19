import { Exercise, getCleanQuickSteps } from '../types/fitness';
import { BiomechanicalVisualizer } from './BiomechanicalVisualizer';
import { EQUIPMENT_LABELS, exerciseFacets } from '../utils/exerciseMeta';
import { Heart, Play, X } from 'lucide-react';

interface ExerciseDetailSheetProps {
  exercise: Exercise;
  isFavorite: boolean;
  onClose: () => void;
  onStart: (exercise: Exercise) => void;
  onToggleFavorite: (id: string) => void;
}

export function ExerciseDetailSheet({
  exercise,
  isFavorite,
  onClose,
  onStart,
  onToggleFavorite,
}: ExerciseDetailSheetProps) {
  const facets = exerciseFacets(exercise);
  const steps = getCleanQuickSteps(exercise);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <button
        type="button"
        aria-label="Закрыть карточку"
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="exercise-sheet-title"
        className="relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-[#0D1322] border border-slate-700 shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 px-4 py-3 bg-[#0D1322]/95 backdrop-blur border-b border-slate-800">
          <div>
            <p className="text-xs font-bold text-amber-300">
              {facets.pattern} · {facets.levelLabel} · ~{facets.durationMin} мин
            </p>
            <h2 id="exercise-sheet-title" className="text-lg font-black text-white leading-snug">
              {exercise.titleRu}
            </h2>
            <p className="text-xs text-slate-400">{exercise.titleEn}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="p-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <BiomechanicalVisualizer
            exerciseId={exercise.id}
            imageUrl={exercise.imageUrl}
            pose={exercise.pose}
            category={exercise.category}
            title={exercise.titleRu}
            muscleGroups={exercise.muscleGroups}
            secondaryMuscles={exercise.secondaryMuscles}
          />

          <div className="flex flex-wrap gap-1.5">
            <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200">
              {facets.bodyArea}
            </span>
            {exercise.equipment.map((id) => (
              <span key={id} className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs text-amber-200">
                {EQUIPMENT_LABELS[id] || id}
              </span>
            ))}
          </div>

          <p className="text-sm text-slate-200 leading-relaxed">{exercise.description}</p>

          <div className="space-y-2">
            <h3 className="text-xs font-extrabold uppercase tracking-wide text-amber-300">Как делать</h3>
            <ol className="space-y-2">
              {(exercise.steps?.length ? exercise.steps : steps).map((step, index) => (
                <li key={index} className="flex gap-2 text-sm text-slate-200">
                  <span className="w-6 h-6 shrink-0 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold flex items-center justify-center">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <details className="rounded-2xl bg-slate-900/80 border border-slate-800 p-3">
            <summary className="text-sm font-bold text-slate-100 cursor-pointer">Дыхание и ошибки</summary>
            <p className="text-sm text-cyan-100 mt-2">{exercise.breathing}</p>
            <ul className="mt-2 space-y-1 text-sm text-rose-100 list-disc pl-4">
              {exercise.commonMistakes.map((mistake) => (
                <li key={mistake}>{mistake}</li>
              ))}
            </ul>
          </details>

          <p className="text-sm text-emerald-100/90 rounded-2xl border border-emerald-500/30 bg-emerald-950/30 p-3">
            {exercise.spineNote}
          </p>

          {exercise.sourceUrl && (
            <a
              href={exercise.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-slate-400 underline"
            >
              Источник идеи движения
            </a>
          )}

          <div className="flex gap-2 pb-2">
            <button
              type="button"
              onClick={() => onStart(exercise)}
              className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black text-sm"
            >
              <Play className="w-4 h-4 fill-current" />
              Начать
            </button>
            <button
              type="button"
              aria-pressed={isFavorite}
              aria-label={isFavorite ? 'Убрать из избранного' : 'В избранное'}
              onClick={() => onToggleFavorite(exercise.id)}
              className={`px-4 rounded-2xl border ${
                isFavorite ? 'bg-rose-500/20 border-rose-400 text-rose-300' : 'bg-slate-900 border-slate-700 text-slate-300'
              }`}
            >
              <Heart className={`w-4 h-4 ${isFavorite ? 'fill-rose-400' : ''}`} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
