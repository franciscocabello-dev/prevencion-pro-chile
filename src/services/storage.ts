import type { AppState } from '../types';
import { buildDemoCompanies, DEMO_PERFILES } from '../data/demoCompanies';

export const STORAGE_KEY = 'prevencionpro-chile:v1';
export const STATE_VERSION = 1;

export const createInitialState = (): AppState => ({
  version: STATE_VERSION,
  activeCompanyId: DEMO_PERFILES[0].id,
  rol: 'prevencionista',
  usuario: DEMO_PERFILES[0].empresa.prevencionista,
  companies: buildDemoCompanies(),
});

const isValidState = (s: unknown): s is AppState => {
  if (!s || typeof s !== 'object') return false;
  const o = s as Partial<AppState>;
  return typeof o.activeCompanyId === 'string' && typeof o.companies === 'object' && o.companies !== null && Object.keys(o.companies).length > 0 && typeof o.rol === 'string';
};

export const loadState = (): AppState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (isValidState(parsed)) {
        if (!parsed.companies[parsed.activeCompanyId]) parsed.activeCompanyId = Object.keys(parsed.companies)[0];
        return parsed;
      }
    }
  } catch (err) {
    console.warn('No se pudo leer el estado guardado', err);
  }
  return createInitialState();
};

export type SaveResult = { ok: true; bytes: number } | { ok: false; error: string };

export const saveState = (state: AppState): SaveResult => {
  try {
    const json = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, json);
    return { ok: true, bytes: json.length };
  } catch (err) {
    const quota = err instanceof DOMException && (err.name === 'QuotaExceededError' || err.code === 22);
    return {
      ok: false,
      error: quota
        ? 'Almacenamiento local lleno. Exporte un respaldo JSON y elimine registros antiguos o fotografías.'
        : 'No se pudo guardar en el dispositivo.',
    };
  }
};

export const storageUsage = (): number => {
  try {
    return (localStorage.getItem(STORAGE_KEY) ?? '').length;
  } catch {
    return 0;
  }
};

export const exportBackup = (state: AppState): void => {
  const blob = new Blob([JSON.stringify({ app: 'PrevenciónPro Chile', exportado: new Date().toISOString(), state }, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `respaldo-prevencionpro-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const parseBackup = async (file: File): Promise<AppState> => {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('El archivo no es un JSON válido.');
  }
  const candidate = (parsed as { state?: unknown })?.state ?? parsed;
  if (!isValidState(candidate)) throw new Error('El archivo no corresponde a un respaldo de PrevenciónPro Chile.');
  if (!candidate.companies[candidate.activeCompanyId]) candidate.activeCompanyId = Object.keys(candidate.companies)[0];
  return candidate;
};
