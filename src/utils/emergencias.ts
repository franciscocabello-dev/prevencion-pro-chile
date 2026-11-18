import type { CompanyData, EscenarioEmergencia, PlanEmergencia, Simulacro } from '../types';
import { todayISO } from './date';

// ============================================================
// Emergencias y simulacros (DS 44, art. 19).
// ============================================================

export const ESCENARIO_LABEL: Record<EscenarioEmergencia, string> = {
  incendio: 'Incendio',
  sismo: 'Sismo',
  tsunami: 'Tsunami',
  fuga_gas: 'Fuga de gas',
  derrame: 'Derrame de sustancias',
  corte_energia: 'Corte de energía',
  inundacion: 'Inundación',
  otro: 'Otro',
};

export const planInicial = (c: CompanyData): PlanEmergencia => ({
  escenarios: ['incendio', 'sismo'],
  puntoEncuentro: '',
  telefonos: [
    { nombre: 'Ambulancia (SAMU)', numero: '131' },
    { nombre: 'Bomberos', numero: '132' },
    { nombre: 'Carabineros', numero: '133' },
    { nombre: `Organismo administrador (${c.empresa.mutualidad})`, numero: '' },
  ],
  brigada: [
    { rol: 'Coordinador de emergencia', nombre: '' },
    { rol: 'Líder de evacuación', nombre: '' },
    { rol: 'Brigadista de primeros auxilios', nombre: '' },
    { rol: 'Brigadista contra incendios', nombre: '' },
  ],
  actualizadoEn: todayISO(),
});

export const fmtSeg = (s: number): string => {
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return m ? `${m} min ${r.toString().padStart(2, '0')} s` : `${r} s`;
};

export const simulacrosOrdenados = (c: CompanyData): Simulacro[] => [...(c.simulacros ?? [])].sort((a, b) => b.fecha.localeCompare(a.fecha));

/** Días desde el último simulacro (null si nunca) */
export const diasDesdeSimulacro = (c: CompanyData): number | null => {
  const ult = simulacrosOrdenados(c)[0];
  return ult ? Math.round((Date.parse(todayISO()) - Date.parse(ult.fecha)) / 86_400_000) : null;
};

/** Faltan datos mínimos del plan */
export const faltantesPlan = (p: PlanEmergencia | undefined): string[] => {
  if (!p) return ['plan de emergencia'];
  const f: string[] = [];
  if (!p.escenarios.length) f.push('escenarios');
  if (!p.puntoEncuentro.trim()) f.push('punto de encuentro');
  if (p.brigada.some((b) => !b.nombre.trim())) f.push('integrantes de la brigada');
  if (p.telefonos.some((t) => !t.numero.trim())) f.push('teléfonos de emergencia');
  return f;
};
