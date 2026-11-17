import type { Rol, ViewId } from '../types';

export type Permiso =
  | 'editarIPER'
  | 'editarProtocolos'
  | 'editarCumplimiento'
  | 'editarTasas'
  | 'editarIndicadores'
  | 'cerrarInvestigacion'
  | 'investigar'
  | 'aprobarPlanes'
  | 'crearCharla'
  | 'crearInspeccion'
  | 'entregarEPP'
  | 'reportarIncidente'
  | 'gestionarHallazgos'
  | 'cerrarHallazgo'
  | 'exportarActas'
  | 'reporteEjecutivo'
  | 'gestionarTrabajadores'
  | 'gestionarExtintores'
  | 'configurarEmpresa'
  | 'eliminarRegistros'
  | 'editarPlantillas'
  | 'generarDocumentos';

const PERMISOS: Record<Rol, Permiso[]> = {
  prevencionista: [
    'editarIPER', 'editarProtocolos', 'editarCumplimiento', 'editarTasas', 'editarIndicadores', 'cerrarInvestigacion', 'investigar',
    'aprobarPlanes', 'crearCharla', 'crearInspeccion', 'entregarEPP', 'reportarIncidente', 'gestionarHallazgos',
    'cerrarHallazgo', 'exportarActas', 'reporteEjecutivo', 'gestionarTrabajadores', 'gestionarExtintores',
    'configurarEmpresa', 'eliminarRegistros', 'editarPlantillas', 'generarDocumentos',
  ],
  gerencia: ['aprobarPlanes', 'exportarActas', 'reporteEjecutivo', 'editarIndicadores', 'reportarIncidente'],
  supervisor: ['crearCharla', 'crearInspeccion', 'entregarEPP', 'reportarIncidente', 'gestionarHallazgos', 'exportarActas', 'generarDocumentos'],
};

export const can = (rol: Rol, p: Permiso): boolean => PERMISOS[rol].includes(p);

export const VISTAS_POR_ROL: Record<Rol, ViewId[]> = {
  prevencionista: ['cartera', 'dashboard', 'cumplimiento', 'charlas', 'documentos', 'inspecciones', 'hallazgos', 'incidentes', 'epp', 'iper', 'protocolos', 'trabajadores', 'configuracion'],
  gerencia: ['dashboard', 'cumplimiento', 'hallazgos', 'incidentes', 'charlas', 'documentos', 'inspecciones', 'epp', 'iper', 'protocolos', 'configuracion'],
  supervisor: ['inicio', 'charlas', 'documentos', 'inspecciones', 'incidentes', 'epp', 'hallazgos', 'configuracion'],
};

export const VISTA_INICIAL: Record<Rol, ViewId> = {
  prevencionista: 'cartera',
  gerencia: 'dashboard',
  supervisor: 'inicio',
};

export const ROL_LABEL: Record<Rol, string> = {
  prevencionista: 'Prevencionista de Riesgos',
  gerencia: 'Jefe de Área / Gerencia',
  supervisor: 'Supervisor en Terreno',
};

export const ROL_CORTO: Record<Rol, string> = {
  prevencionista: 'Prevencionista',
  gerencia: 'Gerencia',
  supervisor: 'Supervisor',
};

/** Vistas accesibles por enlace directo para cualquier rol, sin aparecer en el menú */
export const VISTAS_PUBLICAS: ViewId[] = ['verificar'];
