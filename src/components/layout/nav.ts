import { BriefcaseBusiness, CalendarCheck, FileCheck2, FileSignature, QrCode, AlertOctagon, BarChart3, ClipboardCheck, Cog, HardHat, Home, Megaphone, ShieldAlert, Stethoscope, Users, Wrench, type LucideIcon } from 'lucide-react';
import type { Rol, ViewId } from '../../types';
import { VISTA_INICIAL, VISTAS_POR_ROL } from '../../utils/permissions';

export interface NavItem {
  id: ViewId;
  label: string;
  short: string;
  icon: LucideIcon;
}

export const NAV: Record<ViewId, NavItem> = {
  inicio: { id: 'inicio', label: 'Inicio Terreno', short: 'Inicio', icon: Home },
  dashboard: { id: 'dashboard', label: 'Dashboard Ejecutivo', short: 'Dashboard', icon: BarChart3 },
  cartera: { id: 'cartera', label: 'Cartera de clientes', short: 'Cartera', icon: BriefcaseBusiness },
  visitas: { id: 'visitas', label: 'Visitas e informes', short: 'Visitas', icon: CalendarCheck },
  cumplimiento: { id: 'cumplimiento', label: 'Cumplimiento DS 44', short: 'DS 44', icon: FileCheck2 },
  charlas: { id: 'charlas', label: 'Charlas, Capacitación y ODI', short: 'Charlas', icon: Megaphone },
  inspecciones: { id: 'inspecciones', label: 'Inspecciones y Checklists', short: 'Inspección', icon: ClipboardCheck },
  hallazgos: { id: 'hallazgos', label: 'Hallazgos y Planes de Acción', short: 'Hallazgos', icon: Wrench },
  incidentes: { id: 'incidentes', label: 'Incidentes e Investigación', short: 'Incidentes', icon: AlertOctagon },
  epp: { id: 'epp', label: 'Control de EPP', short: 'EPP', icon: HardHat },
  iper: { id: 'iper', label: 'Matriz IPER', short: 'IPER', icon: ShieldAlert },
  protocolos: { id: 'protocolos', label: 'Protocolos MINSAL', short: 'MINSAL', icon: Stethoscope },
  documentos: { id: 'documentos', label: 'Plantillas y Documentos', short: 'Docs', icon: FileSignature },
  verificar: { id: 'verificar', label: 'Verificar documento', short: 'Verificar', icon: QrCode },
  trabajadores: { id: 'trabajadores', label: 'Trabajadores', short: 'Personal', icon: Users },
  configuracion: { id: 'configuracion', label: 'Configuración', short: 'Config.', icon: Cog },
};

export const navForRol = (rol: Rol): NavItem[] => VISTAS_POR_ROL[rol].map((v) => NAV[v]);

/** Bottom Tab Bar móvil: Inicio · Charlas · Inspecciones · Hallazgos (+ Menú) */
export const bottomNavForRol = (rol: Rol): NavItem[] => {
  const inicio = VISTA_INICIAL[rol];
  return [{ ...NAV[inicio], short: inicio === 'cartera' ? 'Cartera' : 'Inicio' }, NAV.charlas, { ...NAV.inspecciones, short: 'Inspecciones' }, NAV.hallazgos].filter((i) => VISTAS_POR_ROL[rol].includes(i.id));
};
