import { BriefcaseBusiness, CalendarCheck, ListChecks, Siren, FileCheck2, FileSignature, QrCode, AlertOctagon, BarChart3, ClipboardCheck, Cog, HardHat, Home, Megaphone, ShieldAlert, Stethoscope, Users, Wrench, type LucideIcon } from 'lucide-react';
import type { Rol, ViewId } from '../../types';
import { VISTA_INICIAL, VISTAS_POR_ROL } from '../../utils/permissions';

export interface NavItem {
  id: ViewId;
  label: string;
  short: string;
  icon: LucideIcon;
}

export const NAV: Record<ViewId, NavItem> = {
  inicio: { id: 'inicio', label: 'Inicio', short: 'Inicio', icon: Home },
  dashboard: { id: 'dashboard', label: 'Panel de la empresa', short: 'Panel', icon: BarChart3 },
  cartera: { id: 'cartera', label: 'Cartera de clientes', short: 'Cartera', icon: BriefcaseBusiness },
  visitas: { id: 'visitas', label: 'Visitas', short: 'Visitas', icon: CalendarCheck },
  programa: { id: 'programa', label: 'Programa de trabajo', short: 'Programa', icon: ListChecks },
  emergencias: { id: 'emergencias', label: 'Emergencias', short: 'Emergencias', icon: Siren },
  cumplimiento: { id: 'cumplimiento', label: 'Cumplimiento DS 44', short: 'DS 44', icon: FileCheck2 },
  charlas: { id: 'charlas', label: 'Charlas y ODI', short: 'Charlas', icon: Megaphone },
  inspecciones: { id: 'inspecciones', label: 'Inspecciones', short: 'Inspecciones', icon: ClipboardCheck },
  hallazgos: { id: 'hallazgos', label: 'Hallazgos', short: 'Hallazgos', icon: Wrench },
  incidentes: { id: 'incidentes', label: 'Incidentes', short: 'Incidentes', icon: AlertOctagon },
  epp: { id: 'epp', label: 'Control de EPP', short: 'EPP', icon: HardHat },
  iper: { id: 'iper', label: 'Matriz de riesgos', short: 'MIPER', icon: ShieldAlert },
  protocolos: { id: 'protocolos', label: 'Protocolos MINSAL', short: 'MINSAL', icon: Stethoscope },
  documentos: { id: 'documentos', label: 'Documentos', short: 'Documentos', icon: FileSignature },
  verificar: { id: 'verificar', label: 'Verificar documento', short: 'Verificar', icon: QrCode },
  trabajadores: { id: 'trabajadores', label: 'Trabajadores', short: 'Personal', icon: Users },
  configuracion: { id: 'configuracion', label: 'Configuración', short: 'Ajustes', icon: Cog },
};

/** Grupos de navegación: ordenan el menú por la forma de trabajar del prevencionista */
export const NAV_GROUPS: { titulo: string; ids: ViewId[] }[] = [
  { titulo: 'Clientes', ids: ['cartera', 'dashboard', 'visitas'] },
  { titulo: 'Cumplimiento', ids: ['cumplimiento', 'programa', 'iper', 'emergencias', 'protocolos'] },
  { titulo: 'Terreno', ids: ['inicio', 'charlas', 'inspecciones', 'hallazgos', 'incidentes', 'epp'] },
  { titulo: 'Administración', ids: ['trabajadores', 'documentos', 'configuracion'] },
];

export const navGroupsForRol = (rol: Rol): { titulo: string; items: NavItem[] }[] =>
  NAV_GROUPS.map((g) => ({ titulo: g.titulo, items: g.ids.filter((id) => VISTAS_POR_ROL[rol].includes(id)).map((id) => NAV[id]) })).filter((g) => g.items.length);

export const navForRol = (rol: Rol): NavItem[] => VISTAS_POR_ROL[rol].map((v) => NAV[v]);

/** Bottom Tab Bar móvil: Inicio · Charlas · Inspecciones · Hallazgos (+ Menú) */
export const bottomNavForRol = (rol: Rol): NavItem[] => {
  const inicio = VISTA_INICIAL[rol];
  // El prevencionista externo salta entre cartera y la empresa activa; el resto trabaja en terreno
  const ids: ViewId[] =
    rol === 'prevencionista' ? [inicio, 'dashboard', 'charlas', 'hallazgos'] : rol === 'gerencia' ? [inicio, 'hallazgos', 'programa', 'visitas'] : [inicio, 'charlas', 'inspecciones', 'hallazgos'];
  return ids.filter((id, i) => ids.indexOf(id) === i && VISTAS_POR_ROL[rol].includes(id)).map((id) => NAV[id]);
};
