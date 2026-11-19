import { describe, expect, it } from 'vitest';
import { EXERCISES_DB } from '../data/exercises';
import { exercisePhotoSrc } from './exercisePhotos';
import { foldSearchText, rankExercises } from './librarySearch';

const ids = (query: string, list = EXERCISES_DB) => rankExercises(list, query).map((exercise) => exercise.id);

describe('library search', () => {
  it('folds ё into е', () => {
    expect(foldSearchText('Своё тяжёлое')).toBe('свое тяжелое');
    expect(ids('свое тело').some((id) => EXERCISES_DB.find((exercise) => exercise.id === id)?.equipment.includes('bodyweight'))).toBe(true);
  });

  it('finds pull-ups from a one-letter typo and a partial word', () => {
    const typo = ids('падтягивания');
    expect(typo.slice(0, 6)).toEqual([
      'brk-scapular-pullup',
      'brk-negative-pullup',
      'brk-australian-row',
      'kb-band-assisted-pullup',
      'kb-chin-up',
      'kb-pull-up',
    ]);
    expect(ids('подтяг').slice(0, 6)).toContain('kb-pull-up');
  });

  it('finds the bar from турнек and does not put the mountain climber first', () => {
    const found = ids('турнек');
    expect(found.length).toBeGreaterThan(0);
    expect(found[0]).not.toBe('morn-slow-mountain-climber-incline');
    expect(
      found.slice(0, 5).some((id) => EXERCISES_DB.find((exercise) => exercise.id === id)?.equipment.includes('pullup-bar'))
    ).toBe(true);
    expect(found.slice(0, 8)).not.toContain('morn-slow-mountain-climber-incline');
  });

  it('ranks cat-cow and the kettlebell swing from close queries', () => {
    expect(ids('кошка-карова')[0]).toBe('morn-cat-cow-segmental');
    expect(ids('махи').slice(0, 5)).toContain('kb-swing-2h');
  });

  it('searches only inside the chip-filtered list', () => {
    const bands = EXERCISES_DB.filter((exercise) => exercise.equipment.includes('bands'));
    const found = ids('падтягивания', bands);
    expect(found).toContain('kb-band-assisted-pullup');
    expect(found).not.toContain('kb-pull-up');
  });

  it('rewrites a leftover jpg photo url to webp', () => {
    expect(exercisePhotoSrc('/exercises/cat-cow.jpg')).toBe('/exercises/cat-cow.webp');
    expect(exercisePhotoSrc('/exercises/cat-cow.webp')).toBe('/exercises/cat-cow.webp');
  });
});
