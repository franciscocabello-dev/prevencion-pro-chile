import type { CompanyData, RespuestaFuf, ViewId } from '../types';
import { BLOQUES_FUF, ITEMS_FUF, aplicaPorTamano, type BloqueFufId, type ItemFuf } from '../data/fufDs44';
import { addDays, daysFromToday, todayISO } from './date';
import { cleanRut } from './rut';
import type { Tone } from '../components/ui';

// ============================================================
// Autoevaluación DS 44: cruza las respuestas del prevencionista con la
// evidencia que la app ya tiene guardada (charlas, EPP, IPER, incidentes…).
// La app SUGIERE evidencia; el cumplimiento lo confirma siempre una persona.
// ============================================================

export type NivelEvidencia = 'completa' | 'parcial' | 'ninguna' | 'manual' | 'sin_modulo';

export interface Evidencia {
  nivel: NivelEvidencia;
  resumen: string;
  vista?: ViewId;
}

export type EstadoCumplimiento = 'cumple' | 'no_cumple' | 'na' | 'pendiente';

export interface FilaFuf {
  item: ItemFuf;
  /** El ítem aplica según el tamaño de la empresa (nº de trabajadores activos) */
  aplicaPorTamano: boolean;
  respuesta?: RespuestaFuf;
  estado: EstadoCumplimiento;
  evidencia: Evidencia;
}

export interface ResumenFuf {
  total: number;
  aplicables: number;
  cumple: number;
  noCumple: number;
  pendiente: number;
  na: number;
  /** % de ítems aplicables confirmados como «cumple» */
  porcentaje: number;
  /** Ítems aplicables con evidencia detectada en la app (completa o parcial) */
  conEvidencia: number;
  /** Ítems aplicables que la app no puede verificar y que aún no tienen módulo */
  sinModulo: number;
  /** Ítems entre los más sancionados que están marcados «no cumple» */
  sancionadosNoCumple: number;
}

const completa = (resumen: string, vista?: ViewId): Evidencia => ({ nivel: 'completa', resumen, vista });
const parcial = (resumen: string, vista?: ViewId): Evidencia => ({ nivel: 'parcial', resumen, vista });
const ninguna = (resumen: string, vista?: ViewId): Evidencia => ({ nivel: 'ninguna', resumen, vista });
const manual = (resumen: string, vista?: ViewId): Evidencia => ({ nivel: 'manual', resumen, vista });

const activos = (c: CompanyData) => c.trabajadores.filter((t) => t.activo);
const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;

/** Cobertura: de los trabajadores activos, cuántos figuran en el conjunto de RUT */
const cobertura = (c: CompanyData, ruts: Set<string>) => {
  const act = activos(c);
  return { con: act.filter((t) => ruts.has(cleanRut(t.rut))).length, total: act.length };
};

const EPP_RE = /\bEPP\b|protecci[oó]n personal/i;

type Detector = (c: CompanyData) => Evidencia;

const DETECTORES: Record<number, Detector> = {
  2: (c) => {
    if (!c.iper.length) return ninguna('La matriz IPER no tiene riesgos registrados.', 'iper');
    if (!c.areas.length) return parcial(`${plural(c.iper.length, 'riesgo registrado', 'riesgos registrados')}; defina las áreas en Configuración para medir la cobertura.`, 'iper');
    const cubiertas = c.areas.filter((a) => c.iper.some((r) => r.area === a)).length;
    return cubiertas === c.areas.length
      ? completa(`Las ${c.areas.length} áreas tienen riesgos en la matriz (${c.iper.length} en total).`, 'iper')
      : parcial(`${cubiertas} de ${c.areas.length} áreas tienen riesgos en la matriz.`, 'iper');
  },
  5: (c) => {
    if (!c.iper.length) return ninguna('La matriz IPER no tiene riesgos registrados.', 'iper');
    const sin = c.iper.filter((r) => r.controles.length === 0).length;
    return sin === 0 ? completa(`Los ${c.iper.length} riesgos tienen medidas de control definidas.`, 'iper') : parcial(`${plural(sin, 'riesgo sin medidas de control', 'riesgos sin medidas de control')} de ${c.iper.length}.`, 'iper');
  },
  6: (c) => {
    if (!c.iper.length) return ninguna('La matriz IPER no tiene riesgos registrados.', 'iper');
    const limite = addDays(todayISO(), -365);
    const vigentes = c.iper.filter((r) => r.fechaRevision && r.fechaRevision >= limite).length;
    return vigentes === c.iper.length
      ? completa(`Los ${c.iper.length} riesgos fueron revisados en los últimos 12 meses.`, 'iper')
      : parcial(`${vigentes} de ${c.iper.length} riesgos revisados en los últimos 12 meses.`, 'iper');
  },
  12: (c) => {
    const cap = c.charlas.filter((x) => x.tipo === 'capacitacion').length;
    const proc = c.documentos.filter((d) => d.categoria === 'procedimiento').length;
    if (!cap && !proc) return ninguna('No hay capacitaciones ni procedimientos firmados registrados.', 'charlas');
    return cap && proc ? completa(`${plural(cap, 'capacitación', 'capacitaciones')} y ${plural(proc, 'procedimiento firmado', 'procedimientos firmados')}.`, 'charlas') : parcial(`${plural(cap, 'capacitación', 'capacitaciones')} y ${plural(proc, 'procedimiento firmado', 'procedimientos firmados')}; falta uno de los dos.`, 'charlas');
  },
  13: (c) => {
    if (!c.iper.length) return ninguna('La matriz IPER no tiene riesgos registrados.', 'iper');
    const conSuperior = c.iper.filter((r) => r.controles.some((k) => k.jerarquia !== 'epp')).length;
    return conSuperior === c.iper.length
      ? completa('Todos los riesgos tienen al menos un control distinto del EPP.', 'iper')
      : parcial(`${plural(c.iper.length - conSuperior, 'riesgo depende', 'riesgos dependen')} solo de EPP o no tiene controles.`, 'iper');
  },
  14: (c) => {
    if (!c.entregasEPP.length) return ninguna('No hay entregas de EPP registradas.', 'epp');
    // Las entregas referencian al trabajador por id
    const ids = new Set(c.entregasEPP.map((e) => e.trabajadorId));
    const total = activos(c).length;
    const conEntrega = activos(c).filter((t) => ids.has(t.id)).length;
    return conEntrega === total && total > 0
      ? completa(`Los ${total} trabajadores activos tienen entrega de EPP registrada.`, 'epp')
      : parcial(`${conEntrega} de ${total} trabajadores activos tienen entrega de EPP registrada.`, 'epp');
  },
  18: (c) => {
    const eppCaps = c.charlas.filter((x) => x.tipo === 'capacitacion' && EPP_RE.test(`${x.tema} ${x.contenido}`));
    if (!eppCaps.length) return ninguna('No hay capacitaciones de EPP registradas.', 'charlas');
    const largas = eppCaps.filter((x) => x.duracionMin >= 60).length;
    return largas ? completa(`${plural(largas, 'capacitación de EPP', 'capacitaciones de EPP')} de al menos 60 minutos.`, 'charlas') : parcial('Hay capacitaciones de EPP, pero ninguna alcanza los 60 minutos.', 'charlas');
  },
  19: (c) => {
    const eppCaps = c.charlas.filter((x) => x.tipo === 'capacitacion' && EPP_RE.test(`${x.tema} ${x.contenido}`));
    if (!eppCaps.length) return ninguna('No hay capacitaciones de EPP registradas.', 'charlas');
    const firmadas = eppCaps.filter((x) => x.asistentes.length > 0 && x.asistentes.every((a) => a.firma) && x.firmaRelator).length;
    return firmadas === eppCaps.length
      ? parcial(`${plural(firmadas, 'registro firmado', 'registros firmados')} con asistentes y relator; falta registrar evaluaciones y reforzamiento.`, 'charlas')
      : parcial(`${firmadas} de ${eppCaps.length} registros tienen todas las firmas.`, 'charlas');
  },
  21: (c) => {
    const ruts = new Set<string>();
    c.charlas.filter((x) => x.tipo === 'odi').forEach((x) => x.asistentes.forEach((a) => ruts.add(cleanRut(a.rut))));
    c.documentos.filter((d) => d.categoria === 'odi').forEach((d) => ruts.add(cleanRut(d.trabajadorRut)));
    if (ruts.size === 0) return ninguna('No hay ODI firmadas registradas.', 'charlas');
    const { con, total } = cobertura(c, ruts);
    return con === total && total > 0 ? completa(`Los ${total} trabajadores activos tienen ODI firmada.`, 'charlas') : parcial(`${con} de ${total} trabajadores activos tienen ODI firmada.`, 'charlas');
  },
  22: (c) => {
    const hay = c.charlas.some((x) => x.tipo === 'odi') || c.documentos.some((d) => d.categoria === 'odi');
    return hay
      ? parcial('Las ODI firmadas incluyen riesgos, medidas, procedimiento ante accidentes y emergencias; confirme que cubren los riesgos propios de cada puesto.', 'charlas')
      : ninguna('No hay ODI firmadas registradas.', 'charlas');
  },
  23: (c) => {
    const limite = addDays(todayISO(), -730);
    const minutos = new Map<string, number>();
    c.charlas
      .filter((x) => x.tipo === 'capacitacion' && x.fecha >= limite)
      .forEach((x) => x.asistentes.forEach((a) => minutos.set(cleanRut(a.rut), (minutos.get(cleanRut(a.rut)) ?? 0) + x.duracionMin)));
    const act = activos(c);
    if (!act.length) return manual('No hay trabajadores activos registrados.', 'trabajadores');
    const cumplen = act.filter((t) => (minutos.get(cleanRut(t.rut)) ?? 0) >= 480).length;
    if (cumplen === act.length) return completa(`Los ${act.length} trabajadores activos acumulan al menos 8 horas de capacitación en 24 meses.`, 'charlas');
    return cumplen > 0 ? parcial(`${cumplen} de ${act.length} trabajadores activos acumulan 8 horas de capacitación en 24 meses.`, 'charlas') : ninguna('Ningún trabajador activo acumula 8 horas de capacitación en los últimos 24 meses.', 'charlas');
  },
  25: (c) => {
    const n = c.incidentes.filter((i) => i.investigacion?.equipoInvestigador).length;
    return n ? parcial(`${plural(n, 'investigación con equipo investigador', 'investigaciones con equipo investigador')}; falta registrar actas de consulta.`, 'incidentes') : manual('La app no registra actas de consulta y participación.', 'incidentes');
  },
  46: (c) =>
    c.incidentes.length
      ? parcial(`${plural(c.incidentes.length, 'incidente registrado', 'incidentes registrados')}; faltan la segmentación por sexo y el registro de enfermedades profesionales.`, 'incidentes')
      : ninguna('No hay incidentes registrados (si no hubo, confírmelo manualmente).', 'incidentes'),
  47: (c) =>
    c.indicadores.promedioTrabajadores > 0
      ? parcial(`Tasa de accidentabilidad calculada (${c.indicadores.periodo}); falta el registro de enfermedades profesionales.`, 'dashboard')
      : ninguna('Complete los parámetros de indicadores en el Dashboard.', 'dashboard'),
  54: (c) => detectorProtocolos(c),
  55: (c) => detectorProtocolos(c),
  58: (c) => {
    if (!c.hallazgos.length) return ninguna('No hay hallazgos ni medidas registradas.', 'hallazgos');
    const cerrados = c.hallazgos.filter((h) => h.estado === 'cerrado').length;
    return cerrados === c.hallazgos.length ? completa(`Los ${cerrados} hallazgos están cerrados con evidencia.`, 'hallazgos') : parcial(`${cerrados} de ${c.hallazgos.length} hallazgos cerrados.`, 'hallazgos');
  },
  59: (c) => {
    const accidentes = c.incidentes.filter((i) => i.tipo.startsWith('accidente'));
    if (!accidentes.length) return manual('No hay accidentes registrados que investigar; confírmelo manualmente.', 'incidentes');
    const cerradas = accidentes.filter((i) => i.estado === 'cerrado' && i.investigacion).length;
    return cerradas === accidentes.length
      ? parcial(`${plural(cerradas, 'accidente investigado y cerrado', 'accidentes investigados y cerrados')}; confirme el enfoque de género y la metodología del organismo administrador.`, 'incidentes')
      : parcial(`${cerradas} de ${accidentes.length} accidentes investigados y cerrados.`, 'incidentes');
  },
  60: (c) => {
    const selladas = c.charlas.filter((x) => x.hash).length + c.documentos.filter((d) => d.hash).length;
    return selladas ? parcial(`${plural(selladas, 'acta con sello', 'actas con sello')} SHA-256 y QR de verificación; el registro completo exige además los demás ítems.`, 'documentos') : ninguna('No hay actas selladas registradas.', 'documentos');
  },
};

function detectorProtocolos(c: CompanyData): Evidencia {
  const aplican = c.protocolos.filter((p) => p.aplica);
  if (!aplican.length) return manual('Ningún protocolo MINSAL está marcado como aplicable; confirme que no hay trabajadores expuestos.', 'protocolos');
  const vigentes = aplican.filter((p) => p.ultimaEvaluacion && p.proximaEvaluacion && daysFromToday(p.proximaEvaluacion) >= 0).length;
  return vigentes === aplican.length ? completa(`Los ${aplican.length} protocolos aplicables tienen evaluación vigente.`, 'protocolos') : parcial(`${vigentes} de ${aplican.length} protocolos aplicables con evaluación vigente.`, 'protocolos');
}

const evidenciaPorDefecto = (item: ItemFuf): Evidencia =>
  item.vista ? manual('La app no puede verificar este ítem: confírmelo y conserve la evidencia.', item.vista) : { nivel: 'sin_modulo', resumen: 'Aún no hay un módulo en la app para este ítem.' };

export const detectarEvidencia = (item: ItemFuf, c: CompanyData): Evidencia => (DETECTORES[item.n] ? DETECTORES[item.n](c) : evidenciaPorDefecto(item));

export const evaluarFuf = (c: CompanyData): { filas: FilaFuf[]; resumen: ResumenFuf } => {
  const trabajadores = activos(c).length;
  const respuestas = c.cumplimientoFuf ?? {};
  const filas: FilaFuf[] = ITEMS_FUF.map((item) => {
    const respuesta = respuestas[String(item.n)];
    const aplica = aplicaPorTamano(item.tamano, trabajadores);
    const estado: EstadoCumplimiento = respuesta ? respuesta.estado : aplica ? 'pendiente' : 'na';
    return { item, aplicaPorTamano: aplica, respuesta, estado, evidencia: detectarEvidencia(item, c) };
  });
  const aplicables = filas.filter((f) => f.estado !== 'na');
  const cumple = aplicables.filter((f) => f.estado === 'cumple').length;
  const resumen: ResumenFuf = {
    total: filas.length,
    aplicables: aplicables.length,
    cumple,
    noCumple: aplicables.filter((f) => f.estado === 'no_cumple').length,
    pendiente: aplicables.filter((f) => f.estado === 'pendiente').length,
    na: filas.length - aplicables.length,
    porcentaje: aplicables.length ? Math.round((cumple / aplicables.length) * 100) : 0,
    conEvidencia: aplicables.filter((f) => f.evidencia.nivel === 'completa' || f.evidencia.nivel === 'parcial').length,
    sinModulo: aplicables.filter((f) => f.evidencia.nivel === 'sin_modulo').length,
    sancionadosNoCumple: aplicables.filter((f) => f.estado === 'no_cumple' && f.item.sancion).length,
  };
  return { filas, resumen };
};

export const resumenPorBloque = (filas: FilaFuf[]): { id: BloqueFufId; titulo: string; filas: FilaFuf[]; aplicables: number; cumple: number; noCumple: number; pendiente: number; porcentaje: number }[] =>
  BLOQUES_FUF.map((b) => {
    const fs = filas.filter((f) => f.item.bloque === b.id);
    const aplicables = fs.filter((f) => f.estado !== 'na');
    const cumple = aplicables.filter((f) => f.estado === 'cumple').length;
    return {
      id: b.id,
      titulo: b.titulo,
      filas: fs,
      aplicables: aplicables.length,
      cumple,
      noCumple: aplicables.filter((f) => f.estado === 'no_cumple').length,
      pendiente: aplicables.filter((f) => f.estado === 'pendiente').length,
      porcentaje: aplicables.length ? Math.round((cumple / aplicables.length) * 100) : 100,
    };
  });

/** Lectura del nivel de preparación (autoevaluación, no es un dictamen) */
export const nivelPreparacion = (r: ResumenFuf): { tone: Tone; label: string } => {
  if (r.noCumple > 0 && r.porcentaje < 60) return { tone: 'crit', label: 'Preparación baja' };
  if (r.pendiente > 0 && r.cumple === 0) return { tone: 'neutral', label: 'Sin evaluar' };
  if (r.porcentaje >= 90 && r.noCumple === 0) return { tone: 'ok', label: 'Preparación alta' };
  if (r.porcentaje >= 60) return { tone: 'warn', label: 'Preparación parcial' };
  return { tone: 'crit', label: 'Preparación baja' };
};

export const ESTADO_LABEL: Record<EstadoCumplimiento, string> = {
  cumple: 'Cumple',
  no_cumple: 'No cumple',
  na: 'No aplica',
  pendiente: 'Pendiente',
};

export const NIVEL_EVIDENCIA_LABEL: Record<NivelEvidencia, string> = {
  completa: 'Evidencia detectada',
  parcial: 'Evidencia parcial',
  ninguna: 'Sin registros',
  manual: 'Verificación manual',
  sin_modulo: 'Sin módulo en la app',
};
