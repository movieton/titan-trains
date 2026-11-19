import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Exercise, ExerciseCategory, EquipmentId } from '../types/fitness';
import { KettlebellComplex } from '../data/exercises';
import { VERIFIED_EXERCISE_PHOTO_MAP } from './BiomechanicalVisualizer';
import { EQUIPMENT_LABELS, ExerciseFacets, exerciseFacets } from '../utils/exerciseMeta';
import { exercisePhotoSrc } from '../utils/exercisePhotos';
import { rankExercises } from '../utils/librarySearch';
import { Dumbbell, Heart, Play, Search } from 'lucide-react';

interface LibraryBrowserProps {
  exercises: Exercise[];
  category: ExerciseCategory;
  favoriteIds: string[];
  complexes: KettlebellComplex[];
  onCategoryChange: (category: ExerciseCategory) => void;
  onToggleFavorite: (id: string) => void;
  onOpen: (exercise: Exercise) => void;
  onStart: (exercise: Exercise) => void;
  onStartComplex: (complex: KettlebellComplex) => void;
}

const CATEGORY_CHIPS: { id: ExerciseCategory; label: string }[] = [
  { id: 'morning', label: 'Зарядка' },
  { id: 'breaks', label: 'Перерывы' },
  { id: 'walking', label: 'Ходьба' },
  { id: 'kettlebell', label: 'Гири' },
];

function Chip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border ${
        active ? 'bg-amber-400 text-slate-950 border-amber-300' : 'bg-slate-950 text-slate-300 border-slate-700'
      }`}
    >
      {label}
    </button>
  );
}

function photoFor(exercise: Exercise): string | undefined {
  return exercisePhotoSrc(exercise.imageUrl || VERIFIED_EXERCISE_PHOTO_MAP[exercise.id]);
}

export function LibraryBrowser({
  exercises,
  category,
  favoriteIds,
  complexes,
  onCategoryChange,
  onToggleFavorite,
  onOpen,
  onStart,
  onStartComplex,
}: LibraryBrowserProps) {
  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState('');
  const [equipment, setEquipment] = useState<EquipmentId | 'all'>('all');
  const [pattern, setPattern] = useState('all');
  const [bodyArea, setBodyArea] = useState('all');
  const [level, setLevel] = useState<0 | 1 | 2 | 3>(0);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [listMode, setListMode] = useState<'exercises' | 'complexes'>('exercises');

  useEffect(() => {
    setShowAll(false);
    setEquipment('all');
    setPattern('all');
    setBodyArea('all');
    setLevel(0);
  }, [category]);

  const scoped = useMemo(() => {
    const base = showAll ? exercises : exercises.filter((exercise) => exercise.category === category);
    return base.map((exercise) => ({ exercise, facets: exerciseFacets(exercise) }));
  }, [exercises, category, showAll]);

  const patternOptions = useMemo(() => unique(scoped.map((item) => item.facets.pattern)), [scoped]);
  const bodyOptions = useMemo(() => unique(scoped.map((item) => item.facets.bodyArea)), [scoped]);
  const equipmentOptions = useMemo(() => {
    const ids = new Set<EquipmentId>();
    for (const item of scoped) for (const id of item.exercise.equipment) ids.add(id);
    return [...ids];
  }, [scoped]);

  const chipScoped = scoped.filter(({ exercise, facets }) => {
    if (equipment !== 'all' && !exercise.equipment.includes(equipment)) return false;
    if (pattern !== 'all' && facets.pattern !== pattern) return false;
    if (bodyArea !== 'all' && facets.bodyArea !== bodyArea) return false;
    if (level !== 0 && facets.level !== level) return false;
    if (favoritesOnly && !favoriteIds.includes(exercise.id)) return false;
    return true;
  });
  const facetsById = new Map(chipScoped.map((item) => [item.exercise.id, item.facets]));
  const filtered = rankExercises(
    chipScoped.map((item) => item.exercise),
    query
  ).map((exercise) => ({
    exercise,
    facets: facetsById.get(exercise.id) || exerciseFacets(exercise),
  }));

  const filtersActive =
    Boolean(query) || equipment !== 'all' || pattern !== 'all' || bodyArea !== 'all' || level !== 0 || favoritesOnly || showAll;

  return (
    <div id="library" className="space-y-3">
      <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-3 space-y-3">
        <label className="relative block">
          <span className="sr-only">Поиск упражнения</span>
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск: турник, мах, кошка — можно с опечаткой"
            className="w-full pl-9 pr-3 py-2.5 rounded-2xl bg-slate-950 border border-slate-700 text-sm text-white"
          />
        </label>

        <ChipRow label="Раздел">
          {CATEGORY_CHIPS.map((chip) => (
            <Chip
              key={chip.id}
              label={chip.label}
              active={!showAll && category === chip.id}
              onClick={() => {
                setShowAll(false);
                onCategoryChange(chip.id);
              }}
            />
          ))}
          <Chip label="Все" active={showAll} onClick={() => setShowAll(true)} />
        </ChipRow>

        <ChipRow label="Инвентарь">
          <Chip label="Любой" active={equipment === 'all'} onClick={() => setEquipment('all')} />
          {equipmentOptions.map((id) => (
            <Chip
              key={id}
              label={EQUIPMENT_LABELS[id] || id}
              active={equipment === id}
              onClick={() => setEquipment(id)}
            />
          ))}
        </ChipRow>

        <ChipRow label="Паттерн">
          <Chip label="Любой" active={pattern === 'all'} onClick={() => setPattern('all')} />
          {patternOptions.map((item) => (
            <Chip key={item} label={item} active={pattern === item} onClick={() => setPattern(item)} />
          ))}
        </ChipRow>

        <ChipRow label="Зона">
          <Chip label="Любая" active={bodyArea === 'all'} onClick={() => setBodyArea('all')} />
          {bodyOptions.map((item) => (
            <Chip key={item} label={item} active={bodyArea === item} onClick={() => setBodyArea(item)} />
          ))}
        </ChipRow>

        <ChipRow label="Уровень">
          <Chip label="Любой" active={level === 0} onClick={() => setLevel(0)} />
          <Chip label="Начальный" active={level === 1} onClick={() => setLevel(1)} />
          <Chip label="Средний" active={level === 2} onClick={() => setLevel(2)} />
          <Chip label="Продвинутый" active={level === 3} onClick={() => setLevel(3)} />
          <Chip label="Избранное" active={favoritesOnly} onClick={() => setFavoritesOnly((value) => !value)} />
        </ChipRow>

        <div className="flex items-center justify-between gap-2 text-xs text-slate-300">
          <span>
            {filtered.length} из {scoped.length}
          </span>
          {filtersActive && (
            <button
              type="button"
              className="font-bold text-amber-300"
              onClick={() => {
                setQuery('');
                setEquipment('all');
                setPattern('all');
                setBodyArea('all');
                setLevel(0);
                setFavoritesOnly(false);
                setShowAll(false);
              }}
            >
              Сбросить
            </button>
          )}
        </div>
      </div>

      {category === 'kettlebell' && !showAll && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setListMode('exercises')}
            className={`py-2 rounded-2xl text-xs font-extrabold ${
              listMode === 'exercises' ? 'bg-rose-500 text-white' : 'bg-slate-900 text-slate-300 border border-slate-700'
            }`}
          >
            Упражнения
          </button>
          <button
            type="button"
            onClick={() => setListMode('complexes')}
            className={`py-2 rounded-2xl text-xs font-extrabold ${
              listMode === 'complexes' ? 'bg-rose-500 text-white' : 'bg-slate-900 text-slate-300 border border-slate-700'
            }`}
          >
            Комплексы ({complexes.length})
          </button>
        </div>
      )}

      {category === 'kettlebell' && !showAll && listMode === 'complexes' ? (
        <div className="space-y-2">
          {complexes.map((complex) => (
            <div key={complex.id} className="rounded-2xl bg-slate-900 border border-slate-800 p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-rose-300 font-bold">Комплекс {complex.number}</p>
                  <h3 className="text-sm font-extrabold text-white">{complex.title}</h3>
                  <p className="text-xs text-slate-400 mt-1">{complex.focus}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onStartComplex(complex)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500 text-white text-xs font-bold"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Запустить
              </button>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 text-center">
          <p className="text-sm font-bold text-white">Ничего не нашлось</p>
          <p className="text-xs text-slate-400 mt-1">Смените фильтр или сбросьте поиск.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map(({ exercise, facets }) => (
            <li key={exercise.id}>
              <ExerciseRow
                exercise={exercise}
                facets={facets}
                favorite={favoriteIds.includes(exercise.id)}
                onOpen={() => onOpen(exercise)}
                onStart={() => onStart(exercise)}
                onToggleFavorite={() => onToggleFavorite(exercise.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ChipRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <div className="flex gap-1.5 overflow-x-auto pb-1">{children}</div>
    </div>
  );
}

function ExerciseRow({
  exercise,
  facets,
  favorite,
  onOpen,
  onStart,
  onToggleFavorite,
}: {
  exercise: Exercise;
  facets: ExerciseFacets;
  favorite: boolean;
  onOpen: () => void;
  onStart: () => void;
  onToggleFavorite: () => void;
}) {
  const photo = photoFor(exercise);
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-slate-900 border border-slate-800 p-2">
      <button type="button" onClick={onOpen} className="flex items-center gap-3 min-w-0 flex-1 text-left">
        {photo ? (
          <img
            src={photo}
            alt=""
            width={56}
            height={56}
            loading="lazy"
            decoding="async"
            className="w-14 h-14 rounded-xl object-cover bg-slate-950 shrink-0"
          />
        ) : (
          <span className="w-14 h-14 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0 text-slate-500">
            <Dumbbell className="w-5 h-5" />
          </span>
        )}
        <span className="min-w-0">
          <span className="block text-sm font-bold text-white leading-snug">{exercise.titleRu}</span>
          <span className="block text-xs text-slate-400 mt-0.5 truncate">
            {facets.pattern} · {exercise.equipment.map((id) => EQUIPMENT_LABELS[id] || id).slice(0, 2).join(', ')} · {facets.levelLabel}
          </span>
        </span>
      </button>
      <button
        type="button"
        aria-label={favorite ? 'Убрать из избранного' : 'В избранное'}
        aria-pressed={favorite}
        onClick={onToggleFavorite}
        className={`p-2 rounded-xl ${favorite ? 'text-rose-300' : 'text-slate-500'}`}
      >
        <Heart className={`w-4 h-4 ${favorite ? 'fill-rose-400' : ''}`} />
      </button>
      <button
        type="button"
        aria-label={`Начать ${exercise.titleRu}`}
        onClick={onStart}
        className="p-2 rounded-xl bg-amber-500 text-slate-950"
      >
        <Play className="w-4 h-4 fill-current" />
      </button>
    </div>
  );
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'ru'));
}
