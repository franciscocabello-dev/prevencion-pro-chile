import type { CompanyData, ResumenPeriodoVisita, Visita } from '../types';
import { evaluarFuf } from './cumplimientoDs44';
import { addDays, todayISO } from './date';

// ============================================================
// Visitas en terreno: resumen automático del período entre visitas,
// para el informe mensual que el prevencionista entrega a su cliente.
// ============================================================

/** Visitas ordenadas de la más reciente a la más antigua */
export const visitasOrdenadas = (c: CompanyData): Visita[] => [...(c.visitas ?? [])].sort((a, b) => b.fecha.localeCompare(a.fecha) || b.creadoEn.localeCompare(a.creadoEn));

/** Inicio del período: el día siguiente a la visita anterior, o 30 días atrás si es la primera */
export const inicioPeriodo = (c: CompanyData, fechaVisita: string): string => {
  const anterior = visitasOrdenadas(c).find((v) => v.fecha < fechaVisita);
  return anterior ? addDays(anterior.fecha, 1) : addDays(fechaVisita, -30);
};

const enRango = (fecha: string | undefined, desde: string, hasta: string) => !!fecha && fecha.slice(0, 10) >= desde && fecha.slice(0, 10) <= hasta;

export const resumenPeriodo = (c: CompanyData, desde: string, hasta: string): ResumenPeriodoVisita => {
  const charlas = c.charlas.filter((x) => enRango(x.fecha, desde, hasta));
  const inspecciones = c.inspecciones.filter((x) => x.estado === 'finalizada' && enRango(x.fecha, desde, hasta));
  const incidentes = c.incidentes.filter((x) => enRango(x.fecha, desde, hasta));
  const abiertos = c.hallazgos.filter((h) => h.estado !== 'cerrado');
  return {
    desde,
    hasta,
    charlas: charlas.length,
    asistencias: charlas.reduce((s, x) => s + x.asistentes.length, 0),
    inspecciones: inspecciones.length,
    cumplimientoInspecciones: inspecciones.length ? Math.round(inspecciones.reduce((s, x) => s + x.cumplimiento, 0) / inspecciones.length) : null,
    hallazgosNuevos: c.hallazgos.filter((h) => enRango(h.fechaDeteccion, desde, hasta)).length,
    hallazgosCerrados: c.hallazgos.filter((h) => h.estado === 'cerrado' && enRango(h.fechaCierre, desde, hasta)).length,
    hallazgosAbiertos: abiertos.length,
    hallazgosVencidos: abiertos.filter((h) => h.fechaCompromiso < hasta).length,
    incidentes: incidentes.length,
    accidentesCTP: incidentes.filter((i) => i.tipo === 'accidente_ctp').length,
    diasPerdidos: incidentes.reduce((s, i) => s + (i.diasPerdidos || 0), 0),
    ds44: evaluarFuf(c).resumen.porcentaje,
  };
};

/** Compromisos de la visita anterior que siguen pendientes (para revisarlos en la nueva) */
export const compromisosPorRevisar = (c: CompanyData, fechaVisita: string = todayISO()) => {
  const anterior = visitasOrdenadas(c).find((v) => v.fecha <= fechaVisita);
  return anterior ? anterior.compromisos.filter((k) => k.estado === 'pendiente') : [];
};

export const ESTADO_COMPROMISO_LABEL = { pendiente: 'Pendiente', cumplido: 'Cumplido', no_cumplido: 'No cumplido' } as const;
