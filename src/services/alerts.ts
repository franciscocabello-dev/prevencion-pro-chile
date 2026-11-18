import type { CompanyData, ViewId } from '../types';
import { daysFromToday, formatDate } from '../utils/date';
import { PROTOCOLOS_INFO } from '../data/catalogos';
import { evaluarFuf } from '../utils/cumplimientoDs44';
import { avancePrograma, programaDesfasado } from '../utils/programa';
import { diasDesdeSimulacro } from '../utils/emergencias';

export type NivelAlerta = 'critico' | 'advertencia';

export interface Alerta {
  id: string;
  nivel: NivelAlerta;
  categoria: 'Extintores' | 'Protocolos MINSAL' | 'Hallazgos' | 'EPP' | 'Investigaciones' | 'Planes de acción' | 'Cumplimiento DS 44' | 'Programa de trabajo' | 'Emergencias';
  titulo: string;
  detalle: string;
  vista: ViewId;
}

export const calcularAlertas = (c: CompanyData): Alerta[] => {
  const out: Alerta[] = [];

  c.extintores.forEach((e) => {
    const d = daysFromToday(e.fechaVencimiento);
    if (d < 0)
      out.push({ id: `ext-${e.id}`, nivel: 'critico', categoria: 'Extintores', titulo: `Extintor ${e.codigo} vencido`, detalle: `${e.ubicacion} · venció hace ${-d} días (${formatDate(e.fechaVencimiento)})`, vista: 'inspecciones' });
    else if (d <= 30)
      out.push({ id: `ext-${e.id}`, nivel: 'advertencia', categoria: 'Extintores', titulo: `Extintor ${e.codigo} por vencer`, detalle: `${e.ubicacion} · vence en ${d} días (${formatDate(e.fechaVencimiento)})`, vista: 'inspecciones' });
  });

  c.protocolos.forEach((p) => {
    if (!p.aplica) return;
    const avance = p.etapas.filter((e) => e.completada).length / Math.max(1, p.etapas.length);
    const venc = p.proximaEvaluacion ? daysFromToday(p.proximaEvaluacion) : -1;
    if (!p.ultimaEvaluacion || venc < 0)
      out.push({ id: `prot-${p.codigo}`, nivel: 'critico', categoria: 'Protocolos MINSAL', titulo: `${p.codigo}: evaluación ${p.ultimaEvaluacion ? 'vencida' : 'pendiente'}`, detalle: PROTOCOLOS_INFO[p.codigo].nombre, vista: 'protocolos' });
    else if (avance < 0.6)
      out.push({ id: `prot-${p.codigo}`, nivel: 'advertencia', categoria: 'Protocolos MINSAL', titulo: `${p.codigo}: implementación ${Math.round(avance * 100)}%`, detalle: 'Etapas del protocolo pendientes de implementación', vista: 'protocolos' });
    else if (venc <= 60)
      out.push({ id: `prot-${p.codigo}`, nivel: 'advertencia', categoria: 'Protocolos MINSAL', titulo: `${p.codigo}: reevaluación en ${venc} días`, detalle: `Próxima evaluación ${formatDate(p.proximaEvaluacion)}`, vista: 'protocolos' });
  });

  c.hallazgos
    .filter((h) => h.estado !== 'cerrado')
    .forEach((h) => {
      const d = daysFromToday(h.fechaCompromiso);
      if (h.criticidad === 'alto')
        out.push({ id: `hz-${h.id}`, nivel: 'critico', categoria: 'Hallazgos', titulo: 'Hallazgo crítico abierto', detalle: `${h.descripcion} · ${h.area} · ${d < 0 ? `vencido hace ${-d} días` : `vence en ${d} días`}`, vista: 'hallazgos' });
      else if (d < 0)
        out.push({ id: `hz-${h.id}`, nivel: 'advertencia', categoria: 'Hallazgos', titulo: 'Hallazgo con plazo vencido', detalle: `${h.descripcion} · resp. ${h.responsable}`, vista: 'hallazgos' });
      if (!h.planAprobado)
        out.push({ id: `plan-${h.id}`, nivel: 'advertencia', categoria: 'Planes de acción', titulo: 'Plan de acción pendiente de aprobación', detalle: h.descripcion, vista: 'hallazgos' });
    });

  const eppVencidos = c.entregasEPP.filter((e) => {
    const vigente = !c.entregasEPP.some((o) => o.trabajadorId === e.trabajadorId && o.categoria === e.categoria && o.fechaEntrega > e.fechaEntrega);
    return vigente && daysFromToday(e.fechaRenovacion) < 0;
  });
  if (eppVencidos.length)
    out.push({ id: 'epp-vencidos', nivel: 'advertencia', categoria: 'EPP', titulo: `${eppVencidos.length} EPP con renovación vencida`, detalle: 'Reponer elementos de protección personal según vida útil', vista: 'epp' });

  c.incidentes
    .filter((i) => i.estado !== 'cerrado' && i.tipo !== 'condicion_subestandar')
    .forEach((i) => {
      const d = -daysFromToday(i.fecha);
      if (i.tipo.startsWith('accidente') || d > 7)
        out.push({ id: `inv-${i.id}`, nivel: i.tipo === 'accidente_ctp' ? 'critico' : 'advertencia', categoria: 'Investigaciones', titulo: `Investigación abierta folio #${i.folio}`, detalle: `${i.descripcion.slice(0, 80)}… · hace ${d} días`, vista: 'incidentes' });
    });

  // Materias más sancionadas por la DT que el propio prevencionista marcó como «no cumple» en la autoevaluación DS 44
  const sancionadas = evaluarFuf(c).filas.filter((f) => f.estado === 'no_cumple' && f.item.sancion);
  if (sancionadas.length)
    out.push({
      id: 'fuf-sancion',
      nivel: 'critico',
      categoria: 'Cumplimiento DS 44',
      titulo: `Autoevaluación DS 44: ${sancionadas.length} sin cumplir`,
      detalle: `Ítems ${sancionadas.map((f) => f.item.n).join(', ')} del FUF (los más sancionados por la DT) marcados «no cumple»`,
      vista: 'cumplimiento',
    });

  // Programa de trabajo preventivo
  const av = avancePrograma(c.programa);
  if (av.vencidas)
    out.push({ id: 'prg-vencidas', nivel: 'advertencia', categoria: 'Programa de trabajo', titulo: `${av.vencidas} ${av.vencidas === 1 ? 'actividad vencida' : 'actividades vencidas'} del programa`, detalle: `Avance ${av.porcentaje}% (${av.realizadas} de ${av.total})`, vista: 'programa' });
  if (programaDesfasado(c))
    out.push({ id: 'prg-desfase', nivel: 'advertencia', categoria: 'Programa de trabajo', titulo: 'Programa desactualizado respecto de la MIPER', detalle: 'El DS 44 pide actualizarlo dentro de 30 días desde la revisión de la MIPER', vista: 'programa' });

  // Simulacro anual (DS 44, art. 19)
  const dSim = diasDesdeSimulacro(c);
  if (dSim === null || dSim > 365)
    out.push({ id: 'sim-anual', nivel: 'advertencia', categoria: 'Emergencias', titulo: dSim === null ? 'Sin simulacros registrados' : `Último simulacro hace ${dSim} días`, detalle: 'El DS 44 exige probar los planes de emergencia al menos una vez al año', vista: 'emergencias' });
  else if (dSim > 330)
    out.push({ id: 'sim-anual', nivel: 'advertencia', categoria: 'Emergencias', titulo: `Simulacro anual vence en ${365 - dSim} días`, detalle: 'Programe el próximo simulacro', vista: 'emergencias' });

  return out.sort((a, b) => (a.nivel === b.nivel ? 0 : a.nivel === 'critico' ? -1 : 1));
};
