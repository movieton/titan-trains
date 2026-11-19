import React, { useState } from 'react';
import { ReminderSettings, UserState } from '../types/fitness';
import {
  X,
  Cloud,
  Bell,
  Smartphone,
  Download,
  Upload,
  CheckCircle2,
  ShieldCheck,
  Scale,
  LogOut,
  ExternalLink,
  Calendar,
} from 'lucide-react';
import {
  getNotificationPermissionStatus,
  requestNotificationPermission,
  downloadCalendarICS,
  sendSystemNotification,
} from '../utils/notificationScheduler';

interface AccountAndSettingsModalProps {
  userState: UserState;
  onClose: () => void;
  onDisconnectGoogle: () => void;
  onUpdateWeight: (newWeightKg: number) => void;
  onUpdateReminders: (reminders: ReminderSettings) => void;
  onUpdateBreakSlot: (slotId: string, patch: { timeLabel?: string; enabled?: boolean }) => void;
  onAddBreakSlot: () => void;
  onRemoveBreakSlot: (slotId: string) => void;
  onImportState: (imported: UserState) => void;
  onTriggerTestNotification: () => void;
}

export const AccountAndSettingsModal: React.FC<AccountAndSettingsModalProps> = ({
  userState,
  onClose,
  onDisconnectGoogle,
  onUpdateWeight,
  onUpdateReminders,
  onUpdateBreakSlot,
  onAddBreakSlot,
  onRemoveBreakSlot,
  onImportState,
  onTriggerTestNotification,
}) => {
  const [activeTab, setActiveTab] = useState<'google' | 'reminders' | 'weight' | 'apk'>('reminders');
  const [weightInput, setWeightInput] = useState(String(userState.profile.currentWeightKg || ''));
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'default'>(
    getNotificationPermissionStatus()
  );

  const handleRequestPermission = async () => {
    const res = await requestNotificationPermission();
    setPermissionStatus(res);
    if (res === 'granted') {
      setStatusBanner('Уведомления разрешены. Они приходят, только пока Титан открыт.');
      sendSystemNotification('Титан', {
        body: 'Пока приложение открыто, напоминания в выбранные часы будут показаны.',
      });
    } else {
      setStatusBanner('Разрешение на уведомления отклонено или заблокировано в настройках браузера.');
    }
  };

  const DAYS_LIST = [
    { id: 1, label: 'ПН' },
    { id: 2, label: 'ВТ' },
    { id: 3, label: 'СР' },
    { id: 4, label: 'ЧТ' },
    { id: 5, label: 'ПТ' },
    { id: 6, label: 'СБ' },
    { id: 0, label: 'ВС' },
  ];

  const toggleDay = (current: number[] | undefined, dayId: number, defaultDays: number[]): number[] => {
    const list = current && current.length > 0 ? [...current] : [...defaultDays];
    const idx = list.indexOf(dayId);
    if (idx > -1) {
      if (list.length === 1) return list;
      list.splice(idx, 1);
    } else {
      list.push(dayId);
      list.sort((a, b) => a - b);
    }
    return list;
  };

  const bmi = (
    userState.profile.currentWeightKg /
    Math.pow(userState.profile.heightCm / 100, 2)
  ).toFixed(1);

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(userState, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `titan-fitness-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusBanner('Резервная копия прогресса скачана!');
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = String(reader.result);
        const parsed = JSON.parse(raw);
        
        // Strict Schema & Boundary Validation
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new Error('Root must be an object');
        }
        
        const { profile, logs, weightHistory, favoriteExerciseIds } = parsed;
        if (!profile || typeof profile !== 'object') {
          throw new Error('Profile missing');
        }

        const currentW = Number(profile.currentWeightKg);
        const targetW = Number(profile.targetWeightKg);
        const height = Number(profile.heightCm);

        if (isNaN(currentW) || currentW < 30 || currentW > 300) {
          throw new Error('Invalid currentWeightKg');
        }
        if (isNaN(targetW) || targetW < 30 || targetW > 300) {
          throw new Error('Invalid targetWeightKg');
        }
        if (isNaN(height) || height < 100 || height > 250) {
          throw new Error('Invalid heightCm');
        }

        if (!Array.isArray(logs)) {
          throw new Error('Logs must be an array');
        }

        // Safe Sanitized State Construction
        const validatedState: UserState = {
          ...userState,
          profile: {
            ...userState.profile,
            name: typeof profile.name === 'string' ? profile.name.slice(0, 60) : userState.profile.name,
            currentWeightKg: currentW,
            targetWeightKg: targetW,
            heightCm: height,
            lowerBackGuard: Boolean(profile.lowerBackGuard),
          },
          logs: logs.filter((l) => l && typeof l === 'object' && typeof l.id === 'string' && typeof l.dateISO === 'string'),
          weightHistory: Array.isArray(weightHistory)
            ? weightHistory.filter((w) => w && typeof w === 'object' && !isNaN(Number(w.weightKg)))
            : userState.weightHistory,
          favoriteExerciseIds: Array.isArray(favoriteExerciseIds)
            ? favoriteExerciseIds.filter((id) => typeof id === 'string')
            : userState.favoriteExerciseIds,
        };

        onImportState(validatedState);
        setStatusBanner('Прогресс успешно проверен и восстановлен из резервной копии!');
      } catch (err) {
        setStatusBanner('Ошибка: неверный формат файла или повреждённая структура данных.');
      }
    };
    reader.readAsText(file);
  };

  const requestBrowserNotificationPermission = async () => {
    if ('Notification' in window) {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        onTriggerTestNotification();
        setStatusBanner('Push-уведомления разрешены! Тестовое напоминание отправлено.');
      } else {
        onTriggerTestNotification();
        setStatusBanner('Включены встроенные звуковые и экранные напоминания внутри приложения.');
      }
    } else {
      onTriggerTestNotification();
      setStatusBanner('Тестовое напоминание отправлено!');
    }
  };

  return (
    <div id="settings-panel" className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-3xl bg-[#0D1322] border border-slate-800 shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/70">
          <div>
            <h2 className="text-lg font-extrabold text-white">Настройки</h2>
            <p className="text-xs text-slate-400">
              Напоминания, вес и резервная копия на этом устройстве
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-4 gap-1 p-2 bg-slate-950/90 border-b border-slate-800 text-xs font-bold">
          {[
            { id: 'google', label: 'Данные', icon: Cloud },
            { id: 'reminders', label: 'Часы', icon: Bell },
            { id: 'weight', label: 'Профиль', icon: Scale },
            { id: 'apk', label: 'Сборка', icon: Smartphone },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl transition ${
                  activeTab === tab.id
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {statusBanner && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{statusBanner}</span>
          </div>
        )}

        <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {activeTab === 'google' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                <h3 className="text-sm font-bold text-white">Прогресс хранится только здесь</h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Входа через Google нет, и облако ничего не синхронизирует. Журнал, вес и расписание лежат в памяти браузера на этом устройстве. Чтобы перенести их, скачайте JSON и загрузите его на другом телефоне.
                </p>
              </div>
              {userState.googleUser && (
                <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/40 space-y-3">
                  <p className="text-sm text-amber-100">
                    Старая метка «{userState.googleUser.email || userState.googleUser.displayName}» не связана с Google. Синхронизации не было.
                  </p>
                  <button
                    type="button"
                    onClick={onDisconnectGoogle}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-bold"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Убрать метку
                  </button>
                </div>
              )}

              {/* Cloud Backup & Restore JSON */}
              <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Мгновенный перенос базы прогресса (Mac ⇄ Домен ⇄ Android APK)
                </h4>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleExportJSON}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-400" />
                    <span>Скачать резервную копию (.JSON)</span>
                  </button>
                  <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer transition">
                    <Upload className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Загрузить слепок прогресса</span>
                    <input type="file" accept=".json" onChange={handleFileImport} className="hidden" />
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'reminders' && (
            <div className="space-y-4">
              {/* PWA Browser Permission Status Card */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
                <div className="flex items-center gap-2.5">
                  <Bell className="w-4 h-4 text-amber-400 shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-slate-200 block">Статус Push-уведомлений:</span>
                    <span className="text-[11px] text-slate-400">PWA оповещения и фоновые напоминания</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-1 rounded-full text-[11px] font-black ${
                      permissionStatus === 'granted'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : permissionStatus === 'denied'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {permissionStatus === 'granted'
                      ? '✅ Включены'
                      : permissionStatus === 'denied'
                      ? '🚫 Заблокированы'
                      : '⚠️ Не активны'}
                  </span>
                  {permissionStatus !== 'granted' && (
                    <button
                      type="button"
                      onClick={handleRequestPermission}
                      className="px-3 py-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold transition cursor-pointer"
                    >
                      Включить
                    </button>
                  )}
                </div>
              </div>

              {/* 1. Morning Routine Card */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-white flex items-center gap-2">
                      <span>🌅</span>
                      <span>1. Утренняя зарядка (пробуждение)</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">Разминка 10–20 мин на коврике или стоя у кровати</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={userState.reminders.morningTime || '09:30'}
                      onChange={(e) =>
                        onUpdateReminders({ ...userState.reminders, morningTime: e.target.value })
                      }
                      className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-bold text-amber-400"
                    />
                    <input
                      type="checkbox"
                      checked={userState.reminders.morningEnabled}
                      onChange={(e) =>
                        onUpdateReminders({ ...userState.reminders, morningEnabled: e.target.checked })
                      }
                      className="w-4 h-4 rounded text-amber-500 bg-slate-950 border-slate-700"
                    />
                  </div>
                </div>

                {/* Days of Week Multi-select */}
                <div className="pt-2 border-t border-slate-800/80">
                  <div className="text-[11px] font-semibold text-slate-400 mb-1.5">Дни недели для зарядки:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {DAYS_LIST.map((d) => {
                      const activeDays = userState.reminders.morningDays || [1, 2, 3, 4, 5];
                      const isSel = activeDays.includes(d.id);
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => {
                            const updated = toggleDay(userState.reminders.morningDays, d.id, [1, 2, 3, 4, 5]);
                            onUpdateReminders({ ...userState.reminders, morningDays: updated });
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                            isSel
                              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                              : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
                          }`}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 2. Work Breaks & Focus Timer Card */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-white flex items-center gap-2">
                      <span>⚡</span>
                      <span>2. Офисные перерывы во время работы за ПК</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">3–5 мин разгрузки спины, шеи, глаз и таза</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={userState.reminders.breaksEnabled}
                    onChange={(e) =>
                      onUpdateReminders({ ...userState.reminders, breaksEnabled: e.target.checked })
                    }
                    className="w-4 h-4 rounded text-cyan-500 bg-slate-950 border-slate-700"
                  />
                </div>

                {/* Days of Week for Breaks */}
                <div className="pt-2 border-t border-slate-800/80">
                  <div className="text-[11px] font-semibold text-slate-400 mb-1.5">Рабочие дни:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {DAYS_LIST.map((d) => {
                      const activeDays = userState.reminders.breaksDays || [1, 2, 3, 4, 5];
                      const isSel = activeDays.includes(d.id);
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => {
                            const updated = toggleDay(userState.reminders.breaksDays, d.id, [1, 2, 3, 4, 5]);
                            onUpdateReminders({ ...userState.reminders, breaksDays: updated });
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                            isSel
                              ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                              : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
                          }`}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 space-y-2">
                  <div className="text-xs font-semibold text-slate-300">Время перерывов</div>
                  <div className="space-y-2">
                    {userState.breakSlots.map((slot) => {
                      const cfg = userState.reminders.breakSlotsConfig?.[slot.id];
                      const isEnabled = cfg ? cfg.enabled : true;
                      const slotTime = cfg?.time || slot.timeLabel;
                      return (
                        <div
                          key={slot.id}
                          className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-950 border border-slate-800/80"
                        >
                          <span className="text-xs font-medium text-slate-200 min-w-0 truncate">{slot.title}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <input
                              type="time"
                              aria-label={`Время: ${slot.title}`}
                              value={slotTime}
                              onChange={(e) => onUpdateBreakSlot(slot.id, { timeLabel: e.target.value, enabled: isEnabled })}
                              className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-xs font-mono text-cyan-300"
                            />
                            <input
                              type="checkbox"
                              aria-label={`Включить ${slot.title}`}
                              checked={isEnabled}
                              onChange={(e) => onUpdateBreakSlot(slot.id, { timeLabel: slotTime, enabled: e.target.checked })}
                              className="w-4 h-4 rounded text-cyan-500 bg-slate-900 border-slate-700"
                            />
                            {slot.id.startsWith('slot-custom-') && (
                              <button
                                type="button"
                                onClick={() => onRemoveBreakSlot(slot.id)}
                                className="text-xs text-slate-400 px-1"
                                aria-label={`Удалить ${slot.title}`}
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={onAddBreakSlot}
                    className="text-xs font-bold text-cyan-300"
                  >
                    Добавить перерыв
                  </button>
                </div>
              </div>

              {/* 3. Kettlebells Routine Card */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-white flex items-center gap-2">
                      <span>🏋️</span>
                      <span>3. Гири (16/24 кг) и Калистеника</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">Силовые протоколы StrongFirst (ПН, СР, ПТ, СБ)</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={userState.reminders.kettlebellTime || '20:00'}
                      onChange={(e) =>
                        onUpdateReminders({ ...userState.reminders, kettlebellTime: e.target.value })
                      }
                      className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-bold text-rose-400"
                    />
                    <input
                      type="checkbox"
                      checked={userState.reminders.kettlebellEnabled}
                      onChange={(e) =>
                        onUpdateReminders({ ...userState.reminders, kettlebellEnabled: e.target.checked })
                      }
                      className="w-4 h-4 rounded text-rose-500 bg-slate-950 border-slate-700"
                    />
                  </div>
                </div>

                {/* Days of Week for Kettlebells */}
                <div className="pt-2 border-t border-slate-800/80">
                  <div className="text-[11px] font-semibold text-slate-400 mb-1.5">Силовые дни:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {DAYS_LIST.map((d) => {
                      const activeDays = userState.reminders.kettlebellDays || [1, 3, 5, 6];
                      const isSel = activeDays.includes(d.id);
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => {
                            const updated = toggleDay(userState.reminders.kettlebellDays, d.id, [1, 3, 5, 6]);
                            onUpdateReminders({ ...userState.reminders, kettlebellDays: updated });
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                            isSel
                              ? 'bg-rose-500 text-slate-950 shadow-md shadow-rose-500/20'
                              : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
                          }`}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 4. Walking Pad Routine Card */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-white flex items-center gap-2">
                      <span>🚶</span>
                      <span>4. Прогулка на дорожке (Walking Pad / Зона 2)</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">Аэробное кардио 20–30 мин после обеда или в дни отдыха</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={userState.reminders.walkingTime || '14:30'}
                      onChange={(e) =>
                        onUpdateReminders({ ...userState.reminders, walkingTime: e.target.value })
                      }
                      className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-bold text-emerald-400"
                    />
                    <input
                      type="checkbox"
                      checked={Boolean(userState.reminders.walkingEnabled)}
                      onChange={(e) =>
                        onUpdateReminders({ ...userState.reminders, walkingEnabled: e.target.checked })
                      }
                      className="w-4 h-4 rounded text-emerald-500 bg-slate-950 border-slate-700"
                    />
                  </div>
                </div>

                {/* Days of Week for Walking */}
                <div className="pt-2 border-t border-slate-800/80">
                  <div className="text-[11px] font-semibold text-slate-400 mb-1.5">Дни для ходьбы на дорожке:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {DAYS_LIST.map((d) => {
                      const activeDays = userState.reminders.walkingDays || [0, 1, 2, 3, 4, 5, 6];
                      const isSel = activeDays.includes(d.id);
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => {
                            const updated = toggleDay(userState.reminders.walkingDays, d.id, [0, 1, 2, 3, 4, 5, 6]);
                            onUpdateReminders({ ...userState.reminders, walkingDays: updated });
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                            isSel
                              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                              : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
                          }`}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-amber-950/20 border border-amber-500/30 text-sm text-amber-100 leading-relaxed">
                Браузер показывает напоминание, только пока Титан открыт. Закрытую PWA Android замораживает, и сайт сам не проснётся в 11:30. Надёжный путь при закрытом приложении — файл календаря ниже. Точные уведомления в фоне готовятся в Android-сборке через Capacitor, это описано во вкладке PWA.
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    downloadCalendarICS(userState.reminders, userState.breakSlots);
                    setStatusBanner('Файл titan-workout-schedule.ics скачан! Импортируйте его в Apple/Google Calendar на Mac/iPhone/Android.');
                  }}
                  className="w-full py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-lg"
                >
                  <Calendar className="w-4 h-4 text-cyan-400" />
                  <span>📅 Добавить расписание в Календарь (.ics)</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    await handleRequestPermission();
                    onTriggerTestNotification();
                  }}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg transition cursor-pointer"
                >
                  <Bell className="w-4 h-4" />
                  <span>Проверить Push / Звуковое Напоминание Сейчас</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'weight' && (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
                  <div className="text-xs text-slate-400">Стартовый вес ({userState.profile.age || '—'} лет, {userState.profile.heightCm || '—'} см)</div>
                  <div className="text-xl font-black text-white mt-0.5">{userState.profile.startWeightKg} кг</div>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-900 border border-emerald-500/40">
                  <div className="text-xs text-emerald-400">Текущий вес (ИМТ {bmi})</div>
                  <div className="text-xl font-black text-emerald-400 mt-0.5">{userState.profile.currentWeightKg} кг</div>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-900 border border-amber-500/40">
                  <div className="text-xs text-amber-400">Целевой ориентир</div>
                  <div className="text-xl font-black text-amber-400 mt-0.5">{userState.profile.targetWeightKg} кг</div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <label className="text-xs font-bold text-slate-300 block">
                  Зафиксировать утреннее взвешивание (кг):
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.1"
                    value={weightInput}
                    onChange={(e) => setWeightInput(e.target.value)}
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm font-bold text-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const val = parseFloat(weightInput);
                      if (!isNaN(val) && val > 40 && val < 250) {
                        onUpdateWeight(val);
                        setStatusBanner(`Новый вес ${val} кг записан в дневник трансформации!`);
                      }
                    }}
                    className="px-5 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-extrabold text-xs"
                  >
                    Обновить вес
                  </button>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 flex items-start gap-2.5 text-xs text-emerald-200">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong>Инвентарь:</strong> {userState.profile.equipment.join(', ') || 'не выбран'}.
                  {userState.profile.goal ? ` Цель: ${userState.profile.goal}.` : ''} Защита поясницы{' '}
                  {userState.profile.lowerBackGuard ? 'включена' : 'выключена'}.
                </div>
              </div>
            </div>
          )}

          {activeTab === 'apk' && (
            <div className="space-y-3 text-xs text-slate-300">
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-amber-400" />
                  <span>1. Установка PWA в 1 клик (на Android / iPhone / Mac)</span>
                </h4>
                <p className="text-slate-400 leading-relaxed">
                  Приложение уже оснащено <code>manifest.webmanifest</code> и <code>Service Worker</code>. При открытии вашего будущего домена в Chrome на Android нажмите <strong>«Установить приложение»</strong> — оно появится на рабочем столе смартфона без адресной строки браузера.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
                  <ExternalLink className="w-4 h-4 text-cyan-400" />
                  <span>2. Сборка нативного Android `.APK` (после тестирований)</span>
                </h4>
                <p className="text-slate-300 leading-relaxed">
                  Сайт не умеет будить телефон в заданный час. Для этого нужна оболочка Capacitor и Local Notifications: точные будильники, кнопки «Начать» и «Отложить 10 мин». Код расписания уже лежит в <code>src/utils/nativeReminders.ts</code> и включается только внутри нативного приложения. Шаги сборки — в <code>docs/CAPACITOR_NOTIFICATIONS.md</code>.
                </p>
                <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-amber-300 overflow-x-auto">
                  {`npm install @capacitor/core @capacitor/cli @capacitor/local-notifications @capacitor/android\nnpm run build\nnpx cap add android\nnpx cap sync android`}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
