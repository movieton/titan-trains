import React, { useEffect, useState } from 'react';
import { PoseArchetype, ExerciseCategory } from '../types/fitness';
import { EXERCISE_PHOTO_HEIGHT, EXERCISE_PHOTO_WIDTH, exercisePhotoSrc } from '../utils/exercisePhotos';
import { ShieldCheck, ZoomIn, X, Activity } from 'lucide-react';

interface BiomechanicalVisualizerProps {
  exerciseId?: string;
  imageUrl?: string;
  pose: PoseArchetype;
  category: ExerciseCategory;
  title: string;
  muscleGroups?: string[];
  secondaryMuscles?: string[];
  compact?: boolean;
}

// 1:1 fallback mapping in case imageUrl is not populated on the object directly
export const VERIFIED_EXERCISE_PHOTO_MAP: Record<string, string> = {
  // Morning awakening & mobility exercises
  'morn-pandiculation-full-body-stretch': '/exercises/pandiculation-stretch.webp',
  'morn-palm-rub-face-neck-warm': '/exercises/palm-rub-warmup.webp',
  'morn-crescent-side-stretch-standing': '/exercises/crescent-side-stretch.webp',
  'morn-daoyin-meridian-patting': '/exercises/daoyin-patting.webp',
  'morn-standing-pelvic-hula-warmup': '/exercises/pelvic-hula-circles.webp',
  'morn-diaphragm-rib-breath': '/exercises/diaphragm-breath.webp',
  'morn-cat-cow-segmental': '/exercises/cat-cow.webp',
  'morn-thread-the-needle': '/exercises/thread-the-needle.webp',
  'morn-child-pose-lat-walk': '/exercises/child-pose.webp',
  'morn-glute-bridge-iso': '/exercises/glute-bridge.webp',
  'morn-mcgill-birddog': '/exercises/bird-dog.webp',
  'morn-mcgill-curlup': '/exercises/mcgill-curlup.webp',
  'morn-mcgill-sidebridge': '/exercises/side-plank.webp',
  'morn-dead-bug-core': '/exercises/dead-bug.webp',
  'morn-90-90-hip-switches': '/exercises/90-90-hips.webp',
  'morn-lymph-calf-tibialis-pump': '/exercises/calf-tibialis-pump.webp',
  'morn-band-pull-apart-wakeup': '/exercises/band-pull-apart.webp',
  'morn-primal-squat-pry': '/exercises/deep-squat-hold.webp',

  // Workday desk breaks
  'brk-seated-overhead-interlace-reach': '/exercises/seated-overhead-reach.webp',
  'brk-standing-sacrum-friction-rub': '/exercises/sacrum-friction-rub.webp',
  'brk-seated-piriformis-figure4-stretch': '/exercises/seated-piriformis-figure4.webp',
  'brk-piriformis-figure4': '/exercises/seated-piriformis-figure4.webp',
  'brk-neck-upper-trap-lateral-stretch': '/exercises/neck-lateral-stretch.webp',
  'brk-incline-desk-pushups': '/exercises/desk-pushup.webp',
  'brk-doorway-pec-opener': '/exercises/doorway-pec-stretch.webp',
  'brk-band-face-pull': '/exercises/band-face-pull.webp',
  'brk-band-row-pulldown': '/exercises/band-row-pulldown.webp',
  'band-row-pulldown': '/exercises/band-row-pulldown.webp',

  // Kettlebell & Strength complexes
  'kb-halo-16': '/exercises/kb-halo.webp',
  'kb-halo': '/exercises/kb-halo.webp',
  'kb-sumo-deadlift-24': '/exercises/kb-deadlift.webp',
  'kb-deadlift-sumo': '/exercises/kb-deadlift.webp',
  'kb-deadlift': '/exercises/kb-deadlift.webp',
  'kb-swing-2h': '/exercises/kb-swing-2h.webp',
  'kb-swing-classic': '/exercises/kb-swing-2h.webp',
  'kb-goblet-squat-16-24': '/exercises/kb-goblet-squat.webp',
  'kb-goblet-squat': '/exercises/kb-goblet-squat.webp',
  'kb-gorilla-row': '/exercises/kb-gorilla-row.webp',
  'kb-suitcase-carry': '/exercises/kb-suitcase-carry.webp',
  'kb-farmers-offset-walk': '/exercises/kb-farmers-walk.webp',
  'kb-farmers-walk': '/exercises/kb-farmers-walk.webp',
  'kb-half-kneeling-press': '/exercises/kb-half-kneeling-press.webp',
  'kb-floor-press': '/exercises/kb-floor-press.webp',
  'kb-tgu-16': '/exercises/kb-tgu.webp',
  'kb-tgu': '/exercises/kb-tgu.webp',
  'kb-romanian-deadlift': '/exercises/kb-deadlift.webp',
  'kb-around-world': '/exercises/kb-halo.webp',
  'kb-clean-squat-press-flow': '/exercises/kb-goblet-squat.webp',
  'kb-deadbug-pullover': '/exercises/dead-bug.webp',

  // Direct short ID aliases used across complexes
  'side-plank': '/exercises/side-plank.webp',
  'glute-bridge': '/exercises/glute-bridge.webp',
  'desk-pushup': '/exercises/desk-pushup.webp',
  'dead-bug': '/exercises/dead-bug.webp',
  'doorway-pec-stretch': '/exercises/doorway-pec-stretch.webp',
  'band-face-pull': '/exercises/band-face-pull.webp',
  'mcgill-curlup': '/exercises/mcgill-curlup.webp',
  'deep-squat-hold': '/exercises/deep-squat-hold.webp',
  'diaphragm-breath': '/exercises/diaphragm-breath.webp',
  'bird-dog': '/exercises/bird-dog.webp',
  'band-pull-apart': '/exercises/band-pull-apart.webp',
  'cat-cow': '/exercises/cat-cow.webp',
};

// Helper to check if a specific muscle group is active
function hasMuscle(list: string[] | undefined, keywords: string[]): boolean {
  if (!list || list.length === 0) return false;
  const str = list.join(' ').toLowerCase();
  return keywords.some((k) => str.includes(k.toLowerCase()));
}

export const BiomechanicalVisualizer: React.FC<BiomechanicalVisualizerProps> = ({
  exerciseId,
  imageUrl,
  category,
  title,
  muscleGroups = [],
  secondaryMuscles = [],
  compact = false,
}) => {
  // 1. Determine verified photo (direct imageUrl prop OR photoMap lookup)
  const verifiedPhoto = exercisePhotoSrc(imageUrl || (exerciseId ? VERIFIED_EXERCISE_PHOTO_MAP[exerciseId] : undefined));
  const [photoFailed, setPhotoFailed] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  useEffect(() => {
    setPhotoFailed(false);
  }, [verifiedPhoto]);
  const hasVerifiedPhoto = Boolean(verifiedPhoto) && !photoFailed;

  const categoryBadge =
    category === 'morning'
      ? { text: 'Утренняя Мобильность', border: 'border-amber-500/30', bg: 'bg-amber-500/10', color: 'text-amber-300' }
      : category === 'breaks'
      ? { text: 'Офисная Декомпрессия', border: 'border-cyan-500/30', bg: 'bg-cyan-500/10', color: 'text-cyan-300' }
      : category === 'walking'
      ? { text: 'Кардио Walking Pad', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', color: 'text-emerald-300' }
      : { text: 'Силовой Комплекс', border: 'border-rose-500/30', bg: 'bg-rose-500/10', color: 'text-rose-300' };

  // Helper for muscle coloring
  const getFill = (keywords: string[]) => {
    if (hasMuscle(muscleGroups, keywords)) return '#f97316'; // Primary active (orange)
    if (hasMuscle(secondaryMuscles, keywords)) return '#06b6d4'; // Stabilizer (cyan)
    return '#1e293b'; // Idle (slate-800)
  };

  const getStroke = (keywords: string[]) => {
    if (hasMuscle(muscleGroups, keywords)) return '#fb923c';
    if (hasMuscle(secondaryMuscles, keywords)) return '#22d3ee';
    return '#334155';
  };

  return (
    <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-gradient-to-b from-slate-900/95 to-[#0B101C]">
      {/* Top Bar */}
      {!compact && (
        <div className="flex items-center justify-between px-3.5 py-2 border-b border-slate-800/80 bg-slate-950/60 text-xs">
          <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Анатомический контроль • Нейтральная спина</span>
          </div>
          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${categoryBadge.border} ${categoryBadge.bg} ${categoryBadge.color}`}>
            {hasVerifiedPhoto ? 'Фото-инструкция (2 фазы)' : 'Анатомическая карта мышц'}
          </span>
        </div>
      )}

      {/* Main Visual Display */}
      {hasVerifiedPhoto && verifiedPhoto ? (
        // Mode 1: Authentic, Verified 2-Panel Photo Instruction
        <div className="relative group overflow-hidden bg-slate-950 flex flex-col items-center justify-center p-2">
          <div className="relative w-full rounded-xl overflow-hidden border border-slate-800 bg-slate-900/60 flex items-center justify-center">
            <img
              src={verifiedPhoto}
              alt={title}
              width={EXERCISE_PHOTO_WIDTH}
              height={EXERCISE_PHOTO_HEIGHT}
              decoding="async"
              className={`w-full h-auto object-cover cursor-pointer hover:scale-[1.01] transition-transform duration-300 ${
                compact ? 'max-h-[165px] sm:max-h-[210px]' : 'max-h-[230px] sm:max-h-[260px]'
              }`}
              onClick={() => setIsZoomed(true)}
              onError={() => setPhotoFailed(true)}
              loading="lazy"
            />

            {/* Phase 1 & Phase 2 Badges */}
            <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-950/85 backdrop-blur border border-slate-700/80 text-[10px] font-bold text-slate-200">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span>ФАЗА 1: Старт / Натяжение</span>
            </div>
            <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-950/85 backdrop-blur border border-emerald-500/40 text-[10px] font-bold text-emerald-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>ФАЗА 2: Пик / Выдох</span>
            </div>

            {/* Bottom Floating Bar */}
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none">
              <span className="px-2.5 py-1 rounded-full bg-slate-950/85 border border-slate-800 text-[10px] text-slate-300 backdrop-blur">
                🛡️ Защита нейтрали позвоночника
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsZoomed(true);
                }}
                className="pointer-events-auto p-1.5 rounded-full bg-slate-950/80 hover:bg-slate-800 text-slate-300 border border-slate-700 transition cursor-pointer"
                title="Увеличить фото"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        // Mode 2: Interactive High-Tech Vector Anatomical Silhouette (Front & Back Views)
        <div className={`${compact ? 'p-3' : 'p-4 sm:p-5'} flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900/80 to-[#0A0F1D]`}>
          <div className="w-full flex flex-row items-center justify-around gap-2 sm:gap-4 py-1">
            {/* FRONT VIEW (ANTERIOR) */}
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Спереди
              </span>
              <svg viewBox="0 0 100 180" className={`${compact ? 'w-20 h-32 sm:w-24 sm:h-36' : 'w-24 h-36 sm:w-28 sm:h-44'} drop-shadow-md`}>
                {/* Head */}
                <ellipse cx="50" cy="14" rx="9" ry="11" fill="#334155" stroke="#475569" strokeWidth="1" />
                {/* Neck */}
                <rect x="47" y="24" width="6" height="7" fill={getFill(['шея', 'трапец', 'скальп'])} stroke={getStroke(['шея', 'трапец'])} strokeWidth="1" rx="2" />

                {/* Shoulders / Deltoids Front */}
                <ellipse cx="32" cy="36" rx="6" ry="7" fill={getFill(['дельт', 'плеч'])} stroke={getStroke(['дельт', 'плеч'])} strokeWidth="1" />
                <ellipse cx="68" cy="36" rx="6" ry="7" fill={getFill(['дельт', 'плеч'])} stroke={getStroke(['дельт', 'плеч'])} strokeWidth="1" />

                {/* Pectorals (Chest) */}
                <path d="M 39 33 C 44 33, 49 35, 50 43 C 45 46, 38 46, 37 40 Z" fill={getFill(['грудн', 'pec'])} stroke={getStroke(['грудн', 'pec'])} strokeWidth="1" />
                <path d="M 61 33 C 56 33, 51 35, 50 43 C 55 46, 62 46, 63 40 Z" fill={getFill(['грудн', 'pec'])} stroke={getStroke(['грудн', 'pec'])} strokeWidth="1" />

                {/* Core / Abs (Rectus Abdominis) */}
                <rect x="44" y="47" width="12" height="24" rx="2" fill={getFill(['пресс', 'кор', 'брюш', 'поперечн', 'прямаямышца'])} stroke={getStroke(['пресс', 'кор', 'брюш'])} strokeWidth="1" />
                {/* Obliques */}
                <path d="M 38 47 L 43 47 L 43 71 L 39 67 Z" fill={getFill(['косые', 'кор', 'брюш'])} stroke={getStroke(['косые', 'кор'])} strokeWidth="1" />
                <path d="M 62 47 L 57 47 L 57 71 L 61 67 Z" fill={getFill(['косые', 'кор', 'брюш'])} stroke={getStroke(['косые', 'кор'])} strokeWidth="1" />

                {/* Biceps & Forearms Front */}
                <ellipse cx="27" cy="49" rx="4" ry="7" fill={getFill(['бицепс', 'руки', 'хват'])} stroke={getStroke(['бицепс', 'руки'])} strokeWidth="1" />
                <ellipse cx="73" cy="49" rx="4" ry="7" fill={getFill(['бицепс', 'руки', 'хват'])} stroke={getStroke(['бицепс', 'руки'])} strokeWidth="1" />
                <ellipse cx="24" cy="65" rx="3.5" ry="8" fill={getFill(['предплеч', 'хват'])} stroke={getStroke(['предплеч', 'хват'])} strokeWidth="1" />
                <ellipse cx="76" cy="65" rx="3.5" ry="8" fill={getFill(['предплеч', 'хват'])} stroke={getStroke(['предплеч', 'хват'])} strokeWidth="1" />

                {/* Pelvis / Hip Flexors */}
                <path d="M 40 73 L 60 73 L 56 82 L 44 82 Z" fill={getFill(['подвздошн', 'таз', 'psoas', 'сгибател'])} stroke={getStroke(['подвздошн', 'таз', 'psoas'])} strokeWidth="1" />

                {/* Quadriceps (Thighs Front) */}
                <ellipse cx="43" cy="100" rx="6.5" ry="17" fill={getFill(['квадрицепс', 'бедр', 'ноги'])} stroke={getStroke(['квадрицепс', 'бедр', 'ноги'])} strokeWidth="1" />
                <ellipse cx="57" cy="100" rx="6.5" ry="17" fill={getFill(['квадрицепс', 'бедр', 'ноги'])} stroke={getStroke(['квадрицепс', 'бедр', 'ноги'])} strokeWidth="1" />

                {/* Knees */}
                <circle cx="43" cy="120" r="3.5" fill="#334155" stroke="#475569" strokeWidth="1" />
                <circle cx="57" cy="120" r="3.5" fill="#334155" stroke="#475569" strokeWidth="1" />

                {/* Calves / Tibialis Front */}
                <ellipse cx="43" cy="142" rx="4.5" ry="16" fill={getFill(['тибиалис', 'tibialis', 'икронож', 'камбаловид', 'голен'])} stroke={getStroke(['тибиалис', 'икронож'])} strokeWidth="1" />
                <ellipse cx="57" cy="142" rx="4.5" ry="16" fill={getFill(['тибиалис', 'tibialis', 'икронож', 'камбаловид', 'голен'])} stroke={getStroke(['тибиалис', 'икронож'])} strokeWidth="1" />
                {/* Feet */}
                <ellipse cx="42" cy="164" rx="4" ry="4" fill="#334155" />
                <ellipse cx="58" cy="164" rx="4" ry="4" fill="#334155" />
              </svg>
            </div>

            {/* BACK VIEW (POSTERIOR) */}
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Сзади
              </span>
              <svg viewBox="0 0 100 180" className={`${compact ? 'w-20 h-32 sm:w-24 sm:h-36' : 'w-24 h-36 sm:w-28 sm:h-44'} drop-shadow-md`}>
                {/* Head */}
                <ellipse cx="50" cy="14" rx="9" ry="11" fill="#334155" stroke="#475569" strokeWidth="1" />

                {/* Trapezius / Upper Back */}
                <path d="M 44 24 L 56 24 L 62 33 L 50 46 L 38 33 Z" fill={getFill(['трапец', 'ромбовид', 'шея', 'верхспины'])} stroke={getStroke(['трапец', 'ромбовид'])} strokeWidth="1" />

                {/* Posterior Deltoids */}
                <ellipse cx="32" cy="36" rx="6" ry="7" fill={getFill(['задняядельта', 'дельт'])} stroke={getStroke(['задняядельта', 'дельт'])} strokeWidth="1" />
                <ellipse cx="68" cy="36" rx="6" ry="7" fill={getFill(['задняядельта', 'дельт'])} stroke={getStroke(['задняядельта', 'дельт'])} strokeWidth="1" />

                {/* Latissimus Dorsi (Lats) */}
                <path d="M 37 40 L 48 47 L 45 66 L 38 56 Z" fill={getFill(['широчайш', 'спин', 'lats'])} stroke={getStroke(['широчайш', 'спин'])} strokeWidth="1" />
                <path d="M 63 40 L 52 47 L 55 66 L 62 56 Z" fill={getFill(['широчайш', 'спин', 'lats'])} stroke={getStroke(['широчайш', 'спин'])} strokeWidth="1" />

                {/* Lower Back / Erector Spinae / QL */}
                <rect x="46" y="52" width="8" height="19" rx="2" fill={getFill(['поясниц', 'разгибател', 'ql', 'квадратнаямышца'])} stroke={getStroke(['поясниц', 'разгибател', 'ql'])} strokeWidth="1" />

                {/* Triceps Back */}
                <ellipse cx="26" cy="49" rx="4" ry="7" fill={getFill(['трицепс', 'руки'])} stroke={getStroke(['трицепс', 'руки'])} strokeWidth="1" />
                <ellipse cx="74" cy="49" rx="4" ry="7" fill={getFill(['трицепс', 'руки'])} stroke={getStroke(['трицепс', 'руки'])} strokeWidth="1" />
                <ellipse cx="23" cy="65" rx="3.5" ry="8" fill={getFill(['предплеч', 'хват'])} stroke={getStroke(['предплеч', 'хват'])} strokeWidth="1" />
                <ellipse cx="77" cy="65" rx="3.5" ry="8" fill={getFill(['предплеч', 'хват'])} stroke={getStroke(['предплеч', 'хват'])} strokeWidth="1" />

                {/* Gluteus Maximus / Glutes */}
                <ellipse cx="44" cy="80" rx="8" ry="9" fill={getFill(['ягодиц', 'glute', 'ягодичн', 'таз'])} stroke={getStroke(['ягодиц', 'glute'])} strokeWidth="1" />
                <ellipse cx="56" cy="80" rx="8" ry="9" fill={getFill(['ягодиц', 'glute', 'ягодичн', 'таз'])} stroke={getStroke(['ягодиц', 'glute'])} strokeWidth="1" />

                {/* Hamstrings (Back of Thighs) */}
                <ellipse cx="43" cy="101" rx="6.5" ry="16" fill={getFill(['бицепсбедра', 'hamstring', 'ноги'])} stroke={getStroke(['бицепсбедра', 'hamstring'])} strokeWidth="1" />
                <ellipse cx="57" cy="101" rx="6.5" ry="16" fill={getFill(['бицепсбедра', 'hamstring', 'ноги'])} stroke={getStroke(['бицепсбедра', 'hamstring'])} strokeWidth="1" />

                {/* Calves Back (Gastrocnemius & Soleus) */}
                <ellipse cx="43" cy="140" rx="5" ry="16" fill={getFill(['икронож', 'камбаловид', 'soleus', 'голен'])} stroke={getStroke(['икронож', 'камбаловид'])} strokeWidth="1" />
                <ellipse cx="57" cy="140" rx="5" ry="16" fill={getFill(['икронож', 'камбаловид', 'soleus', 'голен'])} stroke={getStroke(['икронож', 'камбаловид'])} strokeWidth="1" />
                {/* Feet Back */}
                <ellipse cx="42" cy="164" rx="4" ry="4" fill="#334155" />
                <ellipse cx="58" cy="164" rx="4" ry="4" fill="#334155" />
              </svg>
            </div>
          </div>

          {/* Interactive Legend & Muscle Highlights */}
          <div className="w-full mt-3 pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 font-bold text-amber-400">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shadow-sm shadow-orange-500/50" />
                <span>Целевые: {muscleGroups.slice(0, 2).join(', ') || 'Комплекс'}</span>
              </span>

              {secondaryMuscles.length > 0 && (
                <span className="inline-flex items-center gap-1.5 font-bold text-cyan-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 shadow-sm shadow-cyan-500/50" />
                  <span>Стабилизаторы: {secondaryMuscles.slice(0, 2).join(', ')}</span>
                </span>
              )}
            </div>

            <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
              <Activity className="w-3.5 h-3.5" />
              <span>Анатомический таргет</span>
            </span>
          </div>
        </div>
      )}

      {/* Fullscreen Zoom Modal */}
      {isZoomed && verifiedPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-4"
          onClick={() => setIsZoomed(false)}
        >
          <div className="relative max-w-4xl w-full bg-slate-900 rounded-3xl overflow-hidden border border-slate-700 p-2 shadow-2xl">
            <div className="flex items-center justify-between p-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <h4 className="text-sm font-bold text-white">{title} — 2-Фазовая Инструкция</h4>
              </div>
              <button
                type="button"
                onClick={() => setIsZoomed(false)}
                className="p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <img
              src={verifiedPhoto}
              alt={title}
              width={EXERCISE_PHOTO_WIDTH}
              height={EXERCISE_PHOTO_HEIGHT}
              decoding="async"
              className="w-full h-auto max-h-[75vh] object-contain rounded-xl mt-2"
            />
          </div>
        </div>
      )}
    </div>
  );
};
