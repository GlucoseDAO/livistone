/** Night is decided from the visitor’s local clock. Latitude is optional and never requested. */
export function nightFromDate(date: Date, latitude?: number): boolean {
  const hour = date.getHours() + date.getMinutes() / 60;
  if (latitude == null || !Number.isFinite(latitude)) return hour < 6.25 || hour >= 19.5;
  const start = Date.UTC(date.getFullYear(), 0, 0), doy = (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - start) / 86400000;
  const decl = 0.4093 * Math.sin(2 * Math.PI / 365 * (doy - 81));
  const arg = -Math.tan(latitude * Math.PI / 180) * Math.tan(decl);
  if (arg <= -1) return false;
  if (arg >= 1) return true;
  const half = Math.acos(Math.min(1, Math.max(-1, arg))) * 12 / Math.PI;
  return hour < 12 - half || hour >= 12 + half;
}

export function isNightNow(date = new Date()): boolean {
  return nightFromDate(date);
}

export type TimeOfDay = 'auto' | 'day' | 'night';
export function parseTimeOfDay(value: unknown): TimeOfDay { return value === 'day' || value === 'night' ? value : 'auto'; }
export function resolveNight(mode: TimeOfDay, date = new Date()): boolean { return mode === 'auto' ? isNightNow(date) : mode === 'night'; }
export function readTimeOfDay(): TimeOfDay { try { return parseTimeOfDay(localStorage.getItem('livistone-time-of-day')); } catch { return 'auto'; } }
export function saveTimeOfDay(mode: TimeOfDay): void { try { localStorage.setItem('livistone-time-of-day', mode); } catch { /* Lighting still works when storage is blocked. */ } }
