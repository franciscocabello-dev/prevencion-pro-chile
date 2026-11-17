import type { ActividadPrograma, CompanyData, OrigenActividad, ProgramaTrabajo, RiesgoIPER } from '../types';
import { nivelVEP, type NivelRiesgo } from './indicators';
import { JERARQUIA_LABEL, JERARQUIA_ORDEN } from '../data/catalogos';
import { addDays, todayISO } from './date';
import { uid } from './id';

// ============================================================
// Programa de trabajo preventivo (DS 44, art. 8) generado desde la MIPER.
// Cada medida de control de los riesgos evaluados pasa a ser una actividad
// con responsable y plazo. Los plazos son sugerencias editables según el
// nivel de riesgo, no un criterio normativo.
// ============================================================

export const ORIGEN_LABEL: Record<OrigenActividad, string> = {
  miper: 'Medidas de control de la MIPER',
  alcohol_drogas: 'Prevención del consumo de alcohol y drogas',
  vida_saludable: 'Promoción de vida saludable',
  conduccion: 'Conducción segura',
  capacitacion: 'Capacitación',
  emergencia: 'Emergencias',
  evaluacion: 'Evaluación del programa',
  manual: 'Otras actividades',
};

export const ORIGEN_ORDEN: OrigenActividad[] = ['miper', 'capacitacion', 'emergencia', 'alcohol_drogas', 'vida_saludable', 'conduccion', 'manual', 'evaluacion'];

/** Plazo sugerido según nivel de riesgo (días desde la elaboración) */
export const PLAZO_SUGERIDO: Record<NivelRiesgo, number> = { Intolerable: 7, Importante: 30, Moderado: 90, Tolerable: 180 };

const ORDEN_NIVEL: Record<NivelRiesgo, number> = { Intolerable: 0, Importante: 1, Moderado: 2, Tolerable: 3 };

export const nivelRiesgo = (r: RiesgoIPER): NivelRiesgo => nivelVEP(r.probabilidad * r.consecuencia);

/** Fecha de la revisión de MIPER más reciente */
export const ultimaRevisionMiper = (c: CompanyData): string => c.iper.map((r) => r.fechaRevision).filter(Boolean).sort().pop() ?? '';

const actividadesDeRiesgo = (r: RiesgoIPER, base: string): ActividadPrograma[] => {
  const nivel = nivelRiesgo(r);
  const plazo = addDays(base, PLAZO_SUGERIDO[nivel]);
  const contexto = `${r.area} · ${r.tarea || r.proceso}: ${r.riesgo}`;
  if (!r.controles.length) {
    return [{ id: uid('act-'), origen: 'miper', riesgoId: r.id, nivel, descripcion: `Definir medidas de control para ${contexto}`, responsable: r.responsable, plazo, estado: 'pendiente', verificacion: '' }];
  }
  return [...r.controles]
    .sort((a, b) => JERARQUIA_ORDEN.indexOf(a.jerarquia) - JERARQUIA_ORDEN.indexOf(b.jerarquia))
    .map((k) => ({
      id: uid('act-'),
      origen: 'miper' as const,
      riesgoId: r.id,
      controlId: k.id,
      nivel,
      jerarquia: k.jerarquia,
      descripcion: `${k.descripcion} (${JERARQUIA_LABEL[k.jerarquia]} · ${contexto})`,
      responsable: r.responsable,
      plazo,
      estado: 'pendiente' as const,
      verificacion: '',
    }));
};

/** Actividades que el art. 8 exige además de las medidas de la MIPER */
const actividadesObligatorias = (c: CompanyData, anio: number, base: string, responsable: string): ActividadPrograma[] => {
  const fin = `${anio}-12-15`;
  const act = (origen: OrigenActividad, descripcion: string, plazo: string): ActividadPrograma => ({ id: uid('act-'), origen, descripcion, responsable, plazo, estado: 'pendiente', verificacion: '' });
  const usaVehiculos = c.iper.some((r) => /veh[ií]cul|conduc|grúa|grua|horquilla|camión|camion|tránsito|transito/i.test(`${r.peligro} ${r.riesgo} ${r.tarea}`));
  return [
    act('capacitacion', 'Capacitación anual de al menos 8 horas en riesgos del puesto, medidas preventivas y emergencias, con enfoque de género (art. 16)', addDays(base, 120)),
    act('capacitacion', 'Capacitación en uso y mantención de EPP, de al menos 1 hora (art. 13)', addDays(base, 60)),
    act('emergencia', 'Simulacro anual de emergencia y evaluación del plan de emergencias (art. 19)', addDays(base, 150)),
    act('alcohol_drogas', 'Actividad de promoción para prevenir el consumo de alcohol y drogas', addDays(base, 90)),
    act('vida_saludable', 'Actividad de promoción de estilos de vida y alimentación saludable', addDays(base, 180)),
    ...(usaVehiculos ? [act('conduccion', 'Actividad de conducción segura y riesgos de tránsito', addDays(base, 120))] : []),
    act('evaluacion', 'Evaluación anual del cumplimiento y eficacia del programa, con medidas de mejora (art. 14)', fin),
  ];
};

export const generarPrograma = (c: CompanyData, anio = new Date().getFullYear()): ProgramaTrabajo => {
  const base = todayISO();
  const responsable = c.empresa.prevencionista || c.empresa.representanteLegal;
  const riesgos = [...c.iper].sort((a, b) => ORDEN_NIVEL[nivelRiesgo(a)] - ORDEN_NIVEL[nivelRiesgo(b)]);
  return {
    id: uid('prg-'),
    anio,
    elaboradoEn: base,
    miperBase: ultimaRevisionMiper(c),
    actividades: [...riesgos.flatMap((r) => actividadesDeRiesgo(r, base)), ...actividadesObligatorias(c, anio, base, responsable)],
    modificaciones: [],
  };
};

/**
 * Agrega al programa las medidas de riesgos o controles nuevos de la MIPER (sin tocar lo ya planificado)
 * y deja constancia de la modificación. Devuelve el programa y cuántas actividades se agregaron.
 */
export const actualizarDesdeMiper = (c: CompanyData, p: ProgramaTrabajo): { programa: ProgramaTrabajo; agregadas: number } => {
  const base = todayISO();
  const existentes = new Set(p.actividades.filter((a) => a.origen === 'miper').map((a) => `${a.riesgoId}|${a.controlId ?? ''}`));
  const nuevas = c.iper.flatMap((r) => actividadesDeRiesgo(r, base)).filter((a) => !existentes.has(`${a.riesgoId}|${a.controlId ?? ''}`));
  // Si un riesgo ya tenía la actividad "definir medidas" y ahora tiene controles, se mantiene: la cierra el prevencionista
  if (!nuevas.length) return { programa: { ...p, miperBase: ultimaRevisionMiper(c) }, agregadas: 0 };
  return {
    programa: {
      ...p,
      miperBase: ultimaRevisionMiper(c),
      actividades: [...p.actividades, ...nuevas],
      modificaciones: [...p.modificaciones, { fecha: base, motivo: `Actualización desde la MIPER: ${nuevas.length} ${nuevas.length === 1 ? 'medida nueva' : 'medidas nuevas'}` }],
    },
    agregadas: nuevas.length,
  };
};

export interface AvancePrograma {
  total: number;
  realizadas: number;
  enCurso: number;
  vencidas: number;
  porcentaje: number;
}

export const avancePrograma = (p: ProgramaTrabajo | undefined): AvancePrograma => {
  const acts = p?.actividades ?? [];
  const hoy = todayISO();
  const realizadas = acts.filter((a) => a.estado === 'realizada').length;
  return {
    total: acts.length,
    realizadas,
    enCurso: acts.filter((a) => a.estado === 'en_curso').length,
    vencidas: acts.filter((a) => a.estado !== 'realizada' && a.plazo < hoy).length,
    porcentaje: acts.length ? Math.round((realizadas / acts.length) * 100) : 0,
  };
};

export const ESTADO_ACTIVIDAD_LABEL = { pendiente: 'Pendiente', en_curso: 'En curso', realizada: 'Realizada' } as const;

/** El programa está desfasado si la MIPER se revisó después de su base */
export const programaDesfasado = (c: CompanyData): boolean => !!c.programa && ultimaRevisionMiper(c) > c.programa.miperBase;
