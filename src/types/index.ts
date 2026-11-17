// ============================================================
// PrevenciónPro Chile – Modelo de dominio
// Normativa: Ley 16.744, DS 44 (reemplaza DS 40 y DS 54), DS 594, DS 67, DS 110, Ley 21.643, Protocolos MINSAL
// ============================================================

export type Rol = 'prevencionista' | 'gerencia' | 'supervisor';

export type Rubro = 'manufactura' | 'agroindustria' | 'construccion' | 'comercio' | 'servicios' | 'otro';

export type ViewId =
  | 'inicio'
  | 'cartera'
  | 'dashboard'
  | 'cumplimiento'
  | 'charlas'
  | 'inspecciones'
  | 'hallazgos'
  | 'incidentes'
  | 'epp'
  | 'iper'
  | 'protocolos'
  | 'trabajadores'
  | 'documentos'
  | 'verificar'
  | 'configuracion';

export type TemaVisual = 'industrial' | 'oscuro' | 'hse';

export interface Empresa {
  nombre: string;
  razonSocial: string;
  rut: string;
  rubro: Rubro;
  giro: string;
  direccion: string;
  comuna: string;
  region: string;
  mutualidad: 'ACHS' | 'Mutual de Seguridad CChC' | 'IST' | 'ISL';
  representanteLegal: string;
  prevencionista: string;
  registroSeremi: string;
}

export interface Trabajador {
  id: string;
  nombre: string;
  rut: string;
  cargo: string;
  area: string;
  fechaIngreso: string;
  activo: boolean;
}

/** Parámetros de cálculo de indicadores DS 44 (tasas de accidentabilidad) / DS 67 */
export interface Indicadores {
  periodo: string;
  promedioTrabajadores: number;
  horasHombre: number;
  accidentesCTP: number;
  diasPerdidos: number;
}

/** Tasas de cotización Ley 16.744 */
export interface TasasLegales {
  cotizacionBasica: number; // 0.90 %
  cotizacionAdicionalDS110: number; // según actividad económica
  cotizacionExtraordinaria: number; // Ley 19.578 / Ley 21.010 (referencial)
  tasaSiniestralidadDS67: number; // promedio 3 períodos (días perdidos x 100 / trab.)
  invalidecesYMuertes: number; // factor DS 67
  remuneracionImponibleMensual: number;
}

export type TipoCharla = 'charla5' | 'capacitacion' | 'odi';

export interface Asistente {
  id: string;
  nombre: string;
  rut: string;
  cargo: string;
  firma: string; // dataURL PNG
  firmadoEn?: string; // ISO fecha-hora exacta de la firma
}

export interface Charla {
  id: string;
  tipo: TipoCharla;
  tema: string;
  contenido: string;
  fecha: string; // ISO date
  hora: string;
  duracionMin: number;
  area: string;
  relator: string;
  cargoRelator: string;
  firmaRelator: string;
  asistentes: Asistente[];
  creadoPor: Rol;
  /** Datos de sesión y verificación (QR) */
  sesionId?: string;
  iniciadaEn?: string; // ISO
  cerradaEn?: string; // ISO
  hash?: string; // SHA-256 del contenido firmado
  plantillaId?: string;
}

// ------------------------------------------------------------
// Plantillas de documentos con variables dinámicas
// ------------------------------------------------------------
export type CategoriaPlantilla = 'charla5' | 'epp' | 'odi' | 'procedimiento' | 'amonestacion';

export interface PlantillaDocumento {
  id: string;
  categoria: CategoriaPlantilla;
  nombre: string;
  titulo: string;
  cuerpo: string; // admite {{VARIABLES}}
  firmaTrabajador: boolean;
  firmaEmisor: boolean;
  actualizada: string;
  base: boolean; // plantilla de sistema (restaurable)
}

export interface DocumentoGenerado {
  id: string;
  sesionId: string;
  plantillaId: string;
  categoria: CategoriaPlantilla;
  titulo: string;
  cuerpo: string; // ya renderizado
  trabajadorId?: string;
  trabajadorNombre: string;
  trabajadorRut: string;
  trabajadorCargo: string;
  area: string;
  emisor: string;
  cargoEmisor: string;
  firmaTrabajador: string;
  firmaEmisor: string;
  creadoEn: string; // ISO
  hash: string;
}

export interface TemaCharla {
  id: string;
  titulo: string;
  categoria: string;
  rubros: Rubro[] | 'todos';
  contenido: string;
}

export type EstadoItem = 'cumple' | 'no_cumple' | 'na';

export interface ItemChecklist {
  id: string;
  seccion: string;
  texto: string;
  referencia?: string;
}

export interface PlantillaChecklist {
  id: 'ds594' | 'maquinaria' | 'ast';
  nombre: string;
  descripcion: string;
  norma: string;
  items: ItemChecklist[];
}

export interface RespuestaItem {
  itemId: string;
  estado: EstadoItem | null;
  observacion: string;
  hallazgoId?: string;
}

export interface Inspeccion {
  id: string;
  plantillaId: PlantillaChecklist['id'];
  fecha: string;
  area: string;
  inspector: string;
  tarea?: string; // AST
  equipoTrabajo?: string; // AST
  respuestas: RespuestaItem[];
  cumplimiento: number; // %
  firmaInspector: string;
  estado: 'borrador' | 'finalizada';
}

export type Criticidad = 'alto' | 'medio' | 'bajo';
export type EstadoHallazgo = 'abierto' | 'en_proceso' | 'cerrado';

export interface Hallazgo {
  id: string;
  origen: 'inspeccion' | 'incidente' | 'manual';
  origenId?: string;
  descripcion: string;
  area: string;
  criticidad: Criticidad;
  responsable: string;
  fechaDeteccion: string;
  fechaCompromiso: string;
  foto?: string;
  estado: EstadoHallazgo;
  planAccion: string;
  planAprobado: boolean;
  aprobadoPor?: string;
  fechaCierre?: string;
  evidenciaCierre?: string;
  comentarioCierre?: string;
}

export type TipoIncidente = 'cuasi_accidente' | 'condicion_subestandar' | 'accidente_stp' | 'accidente_ctp' | 'accidente_trayecto';

export interface MedidaCorrectiva {
  id: string;
  descripcion: string;
  jerarquia: JerarquiaControl;
  responsable: string;
  fechaCompromiso: string;
  estado: 'pendiente' | 'cumplida';
}

export interface Investigacion {
  porques: string[];
  causasInmediatas: { acciones: string[]; condiciones: string[] };
  causasBasicas: { personales: string[]; trabajo: string[] };
  medidas: MedidaCorrectiva[];
  conclusion: string;
  equipoInvestigador: string;
  fechaInicio: string;
  cerradoPor?: string;
  fechaCierre?: string;
}

export interface Incidente {
  id: string;
  folio: number;
  tipo: TipoIncidente;
  fecha: string;
  hora: string;
  area: string;
  descripcion: string;
  reportadoPor: string;
  afectado?: string;
  rutAfectado?: string;
  parteCuerpo?: string;
  diasPerdidos: number;
  foto?: string;
  estado: 'reportado' | 'en_investigacion' | 'cerrado';
  investigacion?: Investigacion;
  diatEmitida: boolean;
}

export type CategoriaEPP =
  | 'Calzado de seguridad'
  | 'Guantes'
  | 'Antiparras / Lentes'
  | 'Protección auditiva'
  | 'Casco'
  | 'Ropa térmica'
  | 'Arnés de seguridad'
  | 'Respirador / Mascarilla'
  | 'Chaleco reflectante'
  | 'Ropa de trabajo';

export interface EntregaEPP {
  id: string;
  trabajadorId: string;
  categoria: CategoriaEPP;
  descripcion: string;
  cantidad: number;
  motivo: 'ingreso' | 'reposicion' | 'deterioro' | 'perdida';
  fechaEntrega: string;
  fechaRenovacion: string;
  entregadoPor: string;
  firma: string;
}

export type JerarquiaControl = 'eliminacion' | 'sustitucion' | 'ingenieria' | 'administracion' | 'epp';

export interface ControlIPER {
  id: string;
  jerarquia: JerarquiaControl;
  descripcion: string;
}

export interface RiesgoIPER {
  id: string;
  area: string;
  proceso: string;
  tarea: string;
  rutinaria: boolean;
  peligro: string;
  riesgo: string;
  probabilidad: 1 | 2 | 4;
  consecuencia: 1 | 2 | 4;
  controles: ControlIPER[];
  responsable: string;
  fechaRevision: string;
}

export type CodigoProtocolo = 'TMERT' | 'MMC' | 'PREXOR' | 'PLANESI' | 'PSICOSOCIAL';

export interface EtapaProtocolo {
  id: string;
  nombre: string;
  completada: boolean;
}

export interface Protocolo {
  codigo: CodigoProtocolo;
  aplica: boolean;
  responsable: string;
  ultimaEvaluacion: string;
  proximaEvaluacion: string;
  trabajadoresExpuestos: number;
  observaciones: string;
  etapas: EtapaProtocolo[];
}

/** Autoevaluación contra el FUF del DS 44: respuesta del prevencionista por ítem */
export type EstadoFuf = 'cumple' | 'no_cumple' | 'na';

export interface RespuestaFuf {
  estado: EstadoFuf;
  observacion: string;
  actualizadoEn: string; // ISO
  actualizadoPor: string;
}

/** Corte fechado de la autoevaluación DS 44, para mostrar el avance en el tiempo */
export interface CorteFuf {
  id: string;
  fecha: string; // YYYY-MM-DD
  porcentaje: number;
  cumple: number;
  noCumple: number;
  pendiente: number;
  aplicables: number;
  dotacion: number;
  creadoPor: string;
}

export interface Extintor {
  id: string;
  codigo: string;
  ubicacion: string;
  tipo: 'PQS ABC' | 'CO2' | 'Agua' | 'Clase K' | 'Espuma AFFF';
  capacidadKg: number;
  fechaVencimiento: string; // próxima mantención anual (NCh 2056)
}

export interface CompanyData {
  id: string;
  esDemo: boolean;
  empresa: Empresa;
  areas: string[];
  supervisores: string[];
  trabajadores: Trabajador[];
  indicadores: Indicadores;
  tasas: TasasLegales;
  fechaUltimoAccidenteCTP: string;
  recordDiasSinAccidentes: number;
  charlas: Charla[];
  inspecciones: Inspeccion[];
  hallazgos: Hallazgo[];
  incidentes: Incidente[];
  entregasEPP: EntregaEPP[];
  iper: RiesgoIPER[];
  protocolos: Protocolo[];
  extintores: Extintor[];
  plantillas: PlantillaDocumento[];
  documentos: DocumentoGenerado[];
  /** Respuestas de la autoevaluación DS 44, por número de ítem del FUF */
  cumplimientoFuf?: Record<string, RespuestaFuf>;
  /** Cortes guardados de la autoevaluación DS 44 (más antiguos primero) */
  historialFuf?: CorteFuf[];
}

export interface AppState {
  version: number;
  activeCompanyId: string;
  rol: Rol;
  usuario: string;
  companies: Record<string, CompanyData>;
  /** Firma de relator guardada por usuario (firma una sola vez) */
  firmasRelator?: Record<string, string>;
}
