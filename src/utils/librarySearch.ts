import Fuse, { type IFuseOptions } from 'fuse.js/basic';
import { Exercise } from '../types/fitness';
import { EQUIPMENT_LABELS, exerciseFacets } from './exerciseMeta';

export function foldSearchText(value: string): string {
  return value.toLowerCase().replace(/ё/g, 'е');
}

interface SearchDoc {
  id: string;
  titleRu: string;
  titleEn: string;
  equipment: string;
  muscles: string;
  tags: string;
}

function toDoc(exercise: Exercise): SearchDoc {
  const facets = exerciseFacets(exercise);
  return {
    id: exercise.id,
    titleRu: foldSearchText(exercise.titleRu),
    titleEn: foldSearchText(exercise.titleEn),
    equipment: foldSearchText(
      exercise.equipment.map((id) => EQUIPMENT_LABELS[id] || id).join(' ')
    ),
    muscles: foldSearchText([...exercise.muscleGroups, ...exercise.secondaryMuscles].join(' ')),
    tags: foldSearchText(
      [
        exercise.subCategory,
        ...(exercise.quickTags || []),
        facets.pattern,
        facets.bodyArea,
        facets.levelLabel,
      ].join(' ')
    ),
  };
}

const FUSE_OPTIONS: IFuseOptions<SearchDoc> = {
  includeScore: true,
  ignoreLocation: true,
  threshold: 0.34,
  distance: 48,
  minMatchCharLength: 2,
  keys: [
    { name: 'titleRu', weight: 0.52 },
    { name: 'titleEn', weight: 0.22 },
    { name: 'equipment', weight: 0.12 },
    { name: 'tags', weight: 0.08 },
    { name: 'muscles', weight: 0.06 },
  ],
};

/**
 * Rank a chip-filtered list. Empty query keeps the incoming order.
 * ё/е are folded, and Fuse tolerates a typo or a partial word in the title.
 */
export function rankExercises(exercises: Exercise[], rawQuery: string): Exercise[] {
  const query = foldSearchText(rawQuery.trim());
  if (!query) return exercises;
  const fuse = new Fuse(exercises.map(toDoc), FUSE_OPTIONS);
  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  return fuse
    .search(query)
    .map((hit) => byId.get(hit.item.id))
    .filter((exercise): exercise is Exercise => Boolean(exercise));
}
