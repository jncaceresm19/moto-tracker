import AsyncStorage from '@react-native-async-storage/async-storage';

export type OilType = 'mineral' | 'semi_synthetic' | 'synthetic';

export interface OilChangeReminder {
  id: string;
  motorcycleId: string;
  oilType: OilType;
  kilometersAtService: number;
  serviceDate: string; // ISO date
  nextKmThreshold: number; // estimado — no tenemos tracking real post-cambio
  nextDateThreshold: string; // ISO date — este sí es confiable
  createdAt: string;
  dismissed: boolean;
}

const REMINDERS_KEY = 'oil_change_reminders';

// Interval definitions per oil type
const OIL_INTERVALS: Record<OilType, { km: number; months: number }> = {
  mineral: { km: 1750, months: 6 },          // midpoint of 1500-2000
  semi_synthetic: { km: 3500, months: 6 },   // midpoint of 3000-4000
  synthetic: { km: 5500, months: 12 },        // midpoint of 5000-6000
};

export function getOilInterval(type: OilType) {
  return OIL_INTERVALS[type];
}

function calculateNextThresholds(
  oilType: OilType,
  kilometersAtService: number,
  serviceDate: string
): { nextKmThreshold: number; nextDateThreshold: string } {
  const interval = OIL_INTERVALS[oilType];
  const date = new Date(serviceDate);
  date.setMonth(date.getMonth() + interval.months);

  return {
    nextKmThreshold: kilometersAtService + interval.km,
    nextDateThreshold: date.toISOString().split('T')[0],
  };
}

export async function createReminder(
  motorcycleId: string,
  oilType: OilType,
  kilometersAtService: number,
  serviceDate: string
): Promise<OilChangeReminder> {
  const { nextKmThreshold, nextDateThreshold } = calculateNextThresholds(oilType, kilometersAtService, serviceDate);

  const reminder: OilChangeReminder = {
    id: `reminder_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    motorcycleId,
    oilType,
    kilometersAtService,
    serviceDate,
    nextKmThreshold,
    nextDateThreshold,
    createdAt: new Date().toISOString(),
    dismissed: false,
  };

  const existing = await getReminders();
  existing.push(reminder);
  await AsyncStorage.setItem(REMINDERS_KEY, JSON.stringify(existing));
  return reminder;
}

export async function getReminders(): Promise<OilChangeReminder[]> {
  try {
    const stored = await AsyncStorage.getItem(REMINDERS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export async function getPendingReminders(motorcycleId: string): Promise<OilChangeReminder[]> {
  const all = await getReminders();
  return all.filter((r) => r.motorcycleId === motorcycleId && !r.dismissed);
}

/**
 * Check date-based reminders only — this is reliable.
 * Called on app open since we always know today's date.
 */
export async function getDueRemindersByDate(): Promise<OilChangeReminder[]> {
  const all = await getReminders();
  const today = new Date().toISOString().split('T')[0];

  return all.filter((r) => {
    if (r.dismissed) return false;
    return today >= r.nextDateThreshold;
  });
}

/**
 * Check km-based reminders — only works when we have current km.
 * Called when user visits motorcycle detail (where currentKilometers is loaded).
 * Note: this is ESTIMATED since we don't track km in real-time.
 */
export async function getDueRemindersByKm(currentKm: number): Promise<OilChangeReminder[]> {
  const all = await getReminders();
  return all.filter((r) => {
    if (r.dismissed) return false;
    return currentKm >= r.nextKmThreshold;
  });
}

/**
 * Combined check — used when we have both date and km info.
 * Returns reminders due by date OR by km.
 */
export async function getDueReminders(currentKm: number): Promise<OilChangeReminder[]> {
  const all = await getReminders();
  const today = new Date().toISOString().split('T')[0];

  return all.filter((r) => {
    if (r.dismissed) return false;
    const kmDue = currentKm >= r.nextKmThreshold;
    const dateDue = today >= r.nextDateThreshold;
    return kmDue || dateDue;
  });
}

export async function dismissReminder(reminderId: string): Promise<void> {
  const all = await getReminders();
  const updated = all.map((r) => (r.id === reminderId ? { ...r, dismissed: true } : r));
  await AsyncStorage.setItem(REMINDERS_KEY, JSON.stringify(updated));
}

export async function dismissReminderByMotorcycle(motorcycleId: string): Promise<void> {
  const all = await getReminders();
  const updated = all.map((r) => (r.motorcycleId === motorcycleId ? { ...r, dismissed: true } : r));
  await AsyncStorage.setItem(REMINDERS_KEY, JSON.stringify(updated));
}

export function getReminderMessage(reminder: OilChangeReminder, triggeredBy: 'date' | 'km' = 'date'): { title: string; body: string } {
  const typeLabels: Record<OilType, string> = {
    mineral: 'Mineral',
    semi_synthetic: 'Semi-sintético',
    synthetic: 'Sintético',
  };

  const kmEstimate = reminder.nextKmThreshold.toLocaleString();
  const dateStr = reminder.nextDateThreshold;

  if (triggeredBy === 'date') {
    return {
      title: '🔧 Recordatorio de Aceite',
      body: `Se cumplió el plazo para cambiar el aceite ${typeLabels[reminder.oilType]}. Tu último cambio fue el ${reminder.serviceDate} a los ${reminder.kilometersAtService.toLocaleString()} km.`,
    };
  }

  // triggered by km
  return {
    title: '🔧 Recordatorio de Aceite',
    body: `Alcanzaste los ${kmEstimate} km estimados para el próximo cambio de aceite ${typeLabels[reminder.oilType]}. Último cambio: ${reminder.serviceDate}.`,
  };
}
