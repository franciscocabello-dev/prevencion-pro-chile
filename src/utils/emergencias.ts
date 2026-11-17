import type { CompanyData, EscenarioEmergencia, PlanEmergencia, Simulacro } from '../types';
import { todayISO } from './date';
import { uid } from './id';

// ============================================================
// Emergencias y simulacros (DS 44, art. 19).
// La estimación de tiempo de evacuación usa un modelo hidráulico
// simplificado y conservador. Es referencial: no reemplaza un estudio
// de evacuación ni la verificación en un simulacro real.
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

/** Flujo específico de personas por metro de ancho efectivo por segundo (valor de referencia usual) */
export const FLUJO_ESPECIFICO = 1.3;
/** Se descuentan 15 cm por lado del ancho de la salida (capa límite) */
const DESCUENTO_BORDE = 0.3;

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
  zonas: [{ id: uid('zn-'), nombre: 'Zona principal', ocupantes: Math.max(1, c.trabajadores.filter((t) => t.activo).length), distancia: 30 }],
  salidas: [{ id: uid('sal-'), nombre: 'Salida principal', ancho: 1.2 }],
  tiempoAlarmaSeg: 60,
  velocidad: 1.0,
  actualizadoEn: todayISO(),
});

export interface EstimacionEvacuacion {
  ocupantes: number;
  anchoEfectivo: number;
  /** Tiempo de desplazamiento de la zona más lejana */
  desplazamientoSeg: number;
  /** Tiempo para que todos pasen por las salidas */
  flujoSeg: number;
  alarmaSeg: number;
  totalSeg: number;
  porZona: { id: string; nombre: string; ocupantes: number; desplazamientoSeg: number }[];
  /** Zona que define el tiempo de desplazamiento */
  zonaCritica: string | null;
}

export const estimarEvacuacion = (p: PlanEmergencia): EstimacionEvacuacion | null => {
  const zonas = p.zonas.filter((z) => z.ocupantes > 0 && z.distancia > 0);
  const anchoEfectivo = p.salidas.reduce((s, x) => s + Math.max(0, x.ancho - DESCUENTO_BORDE), 0);
  if (!zonas.length || anchoEfectivo <= 0 || p.velocidad <= 0) return null;
  const v = p.velocidad;
  const porZona = zonas.map((z) => ({ id: z.id, nombre: z.nombre, ocupantes: z.ocupantes, desplazamientoSeg: Math.round(z.distancia / v) }));
  const critica = porZona.reduce((a, b) => (b.desplazamientoSeg > a.desplazamientoSeg ? b : a));
  const ocupantes = zonas.reduce((s, z) => s + z.ocupantes, 0);
  const flujoSeg = Math.round(ocupantes / (FLUJO_ESPECIFICO * anchoEfectivo));
  // Conservador: se suman desplazamiento y paso por salidas (en la realidad se traslapan en parte)
  const totalSeg = p.tiempoAlarmaSeg + critica.desplazamientoSeg + flujoSeg;
  return { ocupantes, anchoEfectivo: Math.round(anchoEfectivo * 100) / 100, desplazamientoSeg: critica.desplazamientoSeg, flujoSeg, alarmaSeg: p.tiempoAlarmaSeg, totalSeg, porZona, zonaCritica: critica.nombre };
};

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
  if (!estimarEvacuacion(p)) f.push('zonas y salidas');
  return f;
};
