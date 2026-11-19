import { useState } from 'react';
import { EquipmentId, TrainingGoal, UserState } from '../types/fitness';
import { EQUIPMENT_LABELS } from '../utils/exerciseMeta';
import { buildFreshUserState, defaultReminderSettings } from '../utils/userState';
import { getDefaultBreakSlots, getTodayISO } from '../utils/workoutBuilder';

interface OnboardingFlowProps {
  onComplete: (state: UserState) => void;
}

const GOALS: { id: TrainingGoal; label: string; hint: string }[] = [
  { id: 'fatloss', label: 'Тонус и вес', hint: 'Зарядка, перерывы и короткие силовые' },
  { id: 'strength', label: 'Сила', hint: 'Гиря и турник с запасом на технику' },
  { id: 'mobility', label: 'Спина и подвижность', hint: 'Больше разгрузки, меньше баллистики' },
  { id: 'tone', label: 'Держать форму', hint: 'Регулярность важнее объёма' },
];

const EQUIPMENT: EquipmentId[] = ['kb16', 'kb24', 'pullup-bar', 'bands', 'mat', 'bodyweight', 'walking-pad'];

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [target, setTarget] = useState('');
  const [goal, setGoal] = useState<TrainingGoal>('fatloss');
  const [equipment, setEquipment] = useState<EquipmentId[]>(['kb16', 'pullup-bar', 'bodyweight']);
  const [morningTime, setMorningTime] = useState('09:30');
  const [eveningTime, setEveningTime] = useState('20:00');
  const [breakTimes, setBreakTimes] = useState(() => getDefaultBreakSlots().map((slot) => slot.timeLabel));
  const [error, setError] = useState('');

  const slots = getDefaultBreakSlots();

  const toggleEquipment = (id: EquipmentId) => {
    setEquipment((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const nextFromBody = () => {
    const ageN = Number(age);
    const heightN = Number(height);
    const weightN = Number(weight);
    const targetN = Number(target || weight);
    if (!Number.isFinite(ageN) || ageN < 14 || ageN > 90) {
      setError('Укажите возраст от 14 до 90.');
      return;
    }
    if (!Number.isFinite(heightN) || heightN < 120 || heightN > 230) {
      setError('Укажите рост в сантиметрах.');
      return;
    }
    if (!Number.isFinite(weightN) || weightN < 35 || weightN > 250) {
      setError('Укажите вес от 35 до 250 кг.');
      return;
    }
    if (!Number.isFinite(targetN) || targetN < 35 || targetN > 250) {
      setError('Укажите целевой вес.');
      return;
    }
    setError('');
    setStep(1);
  };

  const finish = () => {
    if (equipment.length === 0) {
      setError('Выберите хотя бы один вариант инвентаря.');
      setStep(1);
      return;
    }
    const ageN = Number(age);
    const heightN = Number(height);
    const weightN = Number(weight);
    const targetN = Number(target || weight);
    const fresh = buildFreshUserState();
    const breakSlots = slots.map((slot, index) => ({ ...slot, timeLabel: breakTimes[index] || slot.timeLabel }));
    const reminders = defaultReminderSettings();
    reminders.morningTime = morningTime;
    reminders.kettlebellTime = eveningTime;
    reminders.breakSlotsConfig = Object.fromEntries(
      breakSlots.map((slot) => [slot.id, { enabled: true, time: slot.timeLabel }])
    );
    const today = getTodayISO();
    onComplete({
      ...fresh,
      profile: {
        name: name.trim() || 'Титан',
        age: ageN,
        heightCm: heightN,
        startWeightKg: weightN,
        currentWeightKg: weightN,
        targetWeightKg: targetN,
        equipment,
        lowerBackGuard: true,
        onboarded: true,
        goal,
      },
      weightHistory: [{ dateISO: today, weightKg: weightN, note: 'Старт' }],
      breakSlots,
      reminders,
    });
  };

  return (
    <div id="onboarding" className="min-h-screen bg-[#090D16] text-slate-100 px-4 py-8">
      <div className="max-w-md mx-auto space-y-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-amber-300">Титан · шаг {step + 1} из 3</p>
          <h1 className="text-2xl font-black mt-1">Соберём профиль под вас</h1>
          <p className="text-sm text-slate-400 mt-1">
            Прогресс остаётся на этом устройстве. Демо-тренировки и вход через Google не подставляются.
          </p>
        </div>

        <div className="flex gap-1.5" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <span key={index} className={`h-1.5 flex-1 rounded-full ${index <= step ? 'bg-amber-400' : 'bg-slate-800'}`} />
          ))}
        </div>

        {error && <p className="text-sm text-rose-300">{error}</p>}

        {step === 0 && (
          <div className="space-y-3">
            <Field label="Как к вам обращаться" value={name} onChange={setName} placeholder="Необязательно" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Возраст" value={age} onChange={setAge} inputMode="numeric" placeholder="36" />
              <Field label="Рост, см" value={height} onChange={setHeight} inputMode="numeric" placeholder="178" />
              <Field label="Вес, кг" value={weight} onChange={setWeight} inputMode="decimal" placeholder="90" />
              <Field label="Цель, кг" value={target} onChange={setTarget} inputMode="decimal" placeholder="80" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {GOALS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setGoal(item.id)}
                  className={`text-left p-3 rounded-2xl border ${
                    goal === item.id ? 'border-amber-400 bg-amber-500/15' : 'border-slate-800 bg-slate-900'
                  }`}
                >
                  <span className="block text-sm font-bold">{item.label}</span>
                  <span className="block text-xs text-slate-400 mt-0.5">{item.hint}</span>
                </button>
              ))}
            </div>
            <button type="button" onClick={nextFromBody} className="w-full py-3 rounded-2xl bg-amber-400 text-slate-950 font-black">
              Дальше
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm text-slate-300">Что есть под рукой? Турник и гиря 16 кг уже отмечены, лишнее можно снять.</p>
            <div className="space-y-2">
              {EQUIPMENT.map((id) => {
                const on = equipment.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleEquipment(id)}
                    className={`w-full flex items-center justify-between px-3 py-3 rounded-2xl border text-sm font-bold ${
                      on ? 'border-amber-400 bg-amber-500/15 text-white' : 'border-slate-800 bg-slate-900 text-slate-300'
                    }`}
                  >
                    <span>{EQUIPMENT_LABELS[id]}</span>
                    <span>{on ? 'Есть' : 'Нет'}</span>
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setStep(0)} className="py-3 rounded-2xl bg-slate-800 font-bold">
                Назад
              </button>
              <button
                type="button"
                onClick={() => {
                  if (equipment.length === 0) {
                    setError('Выберите хотя бы один вариант инвентаря.');
                    return;
                  }
                  setError('');
                  setStep(2);
                }}
                className="py-3 rounded-2xl bg-amber-400 text-slate-950 font-black"
              >
                Дальше
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p className="text-sm text-slate-300">Эти часы можно поменять. Пока приложение открыто, Титан напомнит. При закрытом — через календарь.</p>
            <label className="block text-sm">
              <span className="text-slate-300">Зарядка</span>
              <input type="time" value={morningTime} onChange={(event) => setMorningTime(event.target.value)} className="mt-1 w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2" />
            </label>
            <div className="space-y-2">
              {slots.map((slot, index) => (
                <label key={slot.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-slate-300">{slot.title}</span>
                  <input
                    type="time"
                    value={breakTimes[index]}
                    onChange={(event) =>
                      setBreakTimes((current) => current.map((value, i) => (i === index ? event.target.value : value)))
                    }
                    className="rounded-xl bg-slate-950 border border-slate-700 px-3 py-2"
                  />
                </label>
              ))}
            </div>
            <label className="block text-sm">
              <span className="text-slate-300">Вечерняя тренировка</span>
              <input type="time" value={eveningTime} onChange={(event) => setEveningTime(event.target.value)} className="mt-1 w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2" />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setStep(1)} className="py-3 rounded-2xl bg-slate-800 font-bold">
                Назад
              </button>
              <button type="button" onClick={finish} className="py-3 rounded-2xl bg-amber-400 text-slate-950 font-black">
                Начать
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: 'numeric' | 'decimal' | 'text';
}) {
  return (
    <label className="block text-sm">
      <span className="text-slate-300">{label}</span>
      <input
        value={value}
        inputMode={inputMode}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-white"
      />
    </label>
  );
}
