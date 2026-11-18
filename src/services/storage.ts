import { APP_NAME } from '../config/brand';
import type { AppState, CompanyData, PlantillaDocumento } from '../types';
import { plantillasBase } from '../data/plantillas';
import { hashCharla, nuevoSesionId } from '../utils/verification';
import { buildDemoCompanies, DEMO_PERFILES } from '../data/demoCompanies';

export const STORAGE_KEY = 'prevencionpro-chile:v1';
export const STATE_VERSION = 2;

/** El DS 44 (vigente desde el 1-feb-2025) reemplazó a los DS 40 y DS 54: actualiza el texto de plantillas base ya guardadas */
const actualizarNormaPlantilla = (p: PlantillaDocumento): PlantillaDocumento => {
  if (!p.base) return p;
  if (!p.titulo.includes('DS 40') && !p.cuerpo.includes('DS 40')) return p;
  return {
    ...p,
    titulo: p.titulo.replace('DS 40 Art. 21', 'DS 44 Art. 15'),
    cuerpo: p.cuerpo.replace('artículo 21 del DS 40/1969', 'artículo 15 del DS 44/2024'),
  };
};

/** Migra datos guardados por versiones anteriores (v1 → v2: plantillas, documentos y sello de sesión) */
const migrateCompany = (c: CompanyData): CompanyData => ({
  ...c,
  plantillas: (Array.isArray(c.plantillas) && c.plantillas.length ? c.plantillas : plantillasBase()).map(actualizarNormaPlantilla),
  cumplimientoFuf: c.cumplimientoFuf ?? {},
  historialFuf: Array.isArray(c.historialFuf) ? c.historialFuf : [],
  visitas: Array.isArray(c.visitas) ? c.visitas : [],
  simulacros: Array.isArray(c.simulacros) ? c.simulacros : [],
  documentos: Array.isArray(c.documentos) ? c.documentos : [],
  charlas: (c.charlas ?? []).map((ch) => {
    if (ch.sesionId && ch.hash) return ch;
    const migrated = { ...ch, sesionId: ch.sesionId ?? nuevoSesionId(ch.fecha), cerradaEn: ch.cerradaEn ?? `${ch.fecha}T${ch.hora}:00` };
    return { ...migrated, hash: hashCharla(migrated) };
  }),
});

export const migrateState = (s: AppState): AppState => ({
  ...s,
  version: STATE_VERSION,
  firmasRelator: s.firmasRelator ?? {},
  companies: Object.fromEntries(Object.entries(s.companies).map(([k, c]) => [k, migrateCompany(c)])),
});

export const createInitialState = (): AppState => ({
  version: STATE_VERSION,
  activeCompanyId: DEMO_PERFILES[0].id,
  rol: 'prevencionista',
  usuario: DEMO_PERFILES[0].empresa.prevencionista,
  companies: buildDemoCompanies(),
  firmasRelator: {},
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
        return migrateState(parsed);
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
  const blob = new Blob([JSON.stringify({ app: APP_NAME, exportado: new Date().toISOString(), state }, null, 2)], {
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
  if (!isValidState(candidate)) throw new Error('El archivo no corresponde a un respaldo de la aplicación.');
  if (!candidate.companies[candidate.activeCompanyId]) candidate.activeCompanyId = Object.keys(candidate.companies)[0];
  return migrateState(candidate);
};
