import type { ViewId } from '../types';

// ============================================================
// Formulario Único de Fiscalización (FUF) del DS N°44/2024
// Fuente: Subsecretaría de Previsión Social – FUF DS 44 del 2024
// https://previsionsocial.gob.cl/wp-content/uploads/2025/01/FUF-DS-44-DEL-2024.pdf
// El DS 44 entró en vigencia el 1 de febrero de 2025 y reemplazó a los DS 40 y DS 54.
// ============================================================

export type BloqueFufId =
  | 'sgsst'
  | 'miper'
  | 'programa'
  | 'informacion'
  | 'consulta'
  | 'emergencias'
  | 'coordinacion'
  | 'comite'
  | 'delegado'
  | 'departamento'
  | 'reglamento'
  | 'mapas'
  | 'vigilancia'
  | 'prescripcion'
  | 'investigacion'
  | 'registro';

export const BLOQUES_FUF: { id: BloqueFufId; titulo: string }[] = [
  { id: 'sgsst', titulo: 'Sistema de Gestión de la Seguridad y Salud en el Trabajo' },
  { id: 'miper', titulo: 'Identificación de peligros y evaluación de riesgos' },
  { id: 'programa', titulo: 'Programa de trabajo en prevención de riesgos laborales' },
  { id: 'informacion', titulo: 'Información y formación' },
  { id: 'consulta', titulo: 'Consulta y participación' },
  { id: 'emergencias', titulo: 'Riesgo grave e inminente y plan de gestión para emergencias, catástrofes o desastres' },
  { id: 'coordinacion', titulo: 'Coordinación y cooperación de la actividad preventiva' },
  { id: 'comite', titulo: 'Comités Paritarios de Higiene y Seguridad' },
  { id: 'delegado', titulo: 'Delegado de Seguridad y Salud en el Trabajo' },
  { id: 'departamento', titulo: 'Departamentos de Prevención de Riesgos' },
  { id: 'reglamento', titulo: 'Reglamentos Internos' },
  { id: 'mapas', titulo: 'Mapas de riesgos' },
  { id: 'vigilancia', titulo: 'Vigilancia del ambiente y de la salud' },
  { id: 'prescripcion', titulo: 'Traslado del puesto de trabajo y prescripción de medidas' },
  { id: 'investigacion', titulo: 'Investigación de las causas de accidentes del trabajo y enfermedades profesionales' },
  { id: 'registro', titulo: 'Registro de la actividad preventiva e indicadores de gestión' },
];

/** Condición de tamaño que activa el ítem (según nº de trabajadores) */
export type CondicionTamano = 'hasta25' | 'mas25' | 'entre10y25' | 'mas100' | 'hasta100';

export interface ItemFuf {
  n: number;
  bloque: BloqueFufId;
  texto: string;
  articulo: string;
  /** Evidencia que el formulario pide mostrar al fiscalizador */
  evidencia: string;
  tamano?: CondicionTamano;
  /** Materia entre las más sancionadas por la DT (informe de implementación del DS 44, feb–jul 2025) */
  sancion?: boolean;
  /** Módulo de la app donde vive (o vivirá) la evidencia */
  vista?: ViewId;
}

export const TAMANO_LABEL: Record<CondicionTamano, string> = {
  hasta25: 'hasta 25 trabajadores',
  mas25: 'más de 25 trabajadores',
  entre10y25: 'entre 10 y 25 trabajadores',
  mas100: 'más de 100 trabajadores',
  hasta100: 'hasta 100 trabajadores',
};

export const aplicaPorTamano = (c: CondicionTamano | undefined, trabajadores: number): boolean => {
  switch (c) {
    case 'hasta25':
      return trabajadores <= 25;
    case 'mas25':
      return trabajadores > 25;
    case 'entre10y25':
      return trabajadores >= 10 && trabajadores <= 25;
    case 'mas100':
      return trabajadores > 100;
    case 'hasta100':
      return trabajadores <= 100;
    default:
      return true;
  }
};

/**
 * Ítems cuya condición de tamaño no figura en el FUF, sino que se deduce de la estructura del decreto
 * (el comité existe solo con más de 25 trabajadores; el departamento, con más de 100).
 */
export const TAMANO_DEDUCIDO: ReadonlySet<number> = new Set([31, 32, 33, 34, 35, 36, 37, 38, 42, 43]);

export const ITEMS_FUF: ItemFuf[] = [
  // --- Sistema de gestión ---
  { n: 1, bloque: 'sgsst', texto: 'Sistema de Gestión de SST con política, estructura organizacional, diagnóstico y planificación, evaluación o auditoría periódica y mejora continua', articulo: 'Arts. 22 inc. 1 y 64 inc. 1', evidencia: 'Documento del Sistema de Gestión de SST' },

  // --- MIPER ---
  { n: 2, bloque: 'miper', texto: 'MIPER que incluya todos los procesos, tareas y puestos de trabajo', articulo: 'Art. 7 inc. 1', evidencia: 'MIPER', vista: 'iper', sancion: true },
  { n: 3, bloque: 'miper', texto: 'MIPER que considere todos los agentes y factores de riesgo, incluido el enfoque de género', articulo: 'Art. 7 inc. 2', evidencia: 'MIPER', vista: 'iper', sancion: true },
  { n: 4, bloque: 'miper', texto: 'MIPER disponible en los lugares de trabajo e informada a trabajadores, comité, delegado, sindicatos y mandos', articulo: 'Art. 7 inc. 9', evidencia: 'Constancia de difusión', vista: 'charlas' },
  { n: 5, bloque: 'miper', texto: 'MIPER con identificación de peligros, evaluación de riesgos, nivel de riesgo y medidas de control y de emergencia', articulo: 'Art. 7 inc. 3', evidencia: 'MIPER', vista: 'iper' },
  { n: 6, bloque: 'miper', texto: 'MIPER con fecha de elaboración y revisión al menos anual, o ante cambios, accidentes o riesgos graves', articulo: 'Art. 7 inc. 9 y art. 64 inc. 2', evidencia: 'MIPER con fecha y registro de revisiones', vista: 'iper' },
  { n: 7, bloque: 'miper', texto: 'Empresas de hasta 25 trabajadores: evaluación de condiciones ambientales, psicosociales y ergonómicas con el instrumento de autoevaluación del organismo administrador', articulo: 'Art. 64 inc. 1', evidencia: 'Autoevaluación del organismo administrador', tamano: 'hasta25' },

  // --- Programa de trabajo preventivo, EPP ---
  { n: 8, bloque: 'programa', texto: 'Programa de trabajo preventivo elaborado o actualizado a partir de la MIPER dentro de 30 días corridos', articulo: 'Art. 8 inc. 1', evidencia: 'Programa con fecha de elaboración', vista: 'programa' },
  { n: 9, bloque: 'programa', texto: 'Programa por escrito y aprobado por el representante legal', articulo: 'Art. 8 inc. 1', evidencia: 'Programa firmado o aprobado', vista: 'programa' },
  { n: 10, bloque: 'programa', texto: 'Programa con medidas, plazos, responsables, promoción contra alcohol y drogas, vida saludable, conducción segura y fechas de modificación', articulo: 'Art. 8 incs. 1 a 3', evidencia: 'Programa', vista: 'programa' },
  { n: 11, bloque: 'programa', texto: 'Programa difundido a los trabajadores y copia enviada al Comité Paritario', articulo: 'Art. 8 inc. 3', evidencia: 'Constancia de difusión y de envío', vista: 'programa' },
  { n: 12, bloque: 'programa', texto: 'Información sobre riesgos y uso seguro de máquinas, manuales y procedimientos de trabajo seguro, con capacitación en su uso', articulo: 'Art. 10 incs. 1 y 2', evidencia: 'Fichas técnicas, procedimientos y registros de capacitación', vista: 'charlas' },
  { n: 13, bloque: 'programa', texto: 'Prelación de medidas que privilegie la protección colectiva sobre el uso de EPP', articulo: 'Art. 12', evidencia: 'Análisis de medidas y controles en la MIPER', vista: 'iper' },
  { n: 14, bloque: 'programa', texto: 'EPP entregados sin costo para el riesgo residual', articulo: 'Art. 13 inc. 1', evidencia: 'Registro de entrega de EPP', vista: 'epp' },
  { n: 15, bloque: 'programa', texto: 'EPP adecuados al riesgo', articulo: 'Art. 13 inc. 1', evidencia: 'Matriz de EPP y evaluación de riesgos', vista: 'epp' },
  { n: 16, bloque: 'programa', texto: 'EPP con certificación de calidad o registro en el ISP', articulo: 'Art. 13 inc. 2', evidencia: 'Certificados o registros ISP', vista: 'epp' },
  { n: 17, bloque: 'programa', texto: 'Procedimiento de uso, mantención, reposición o recambio de EPP', articulo: 'Art. 13 inc. 2', evidencia: 'Procedimiento escrito', vista: 'epp' },
  { n: 18, bloque: 'programa', texto: 'Capacitación en uso y mantención de EPP, de al menos 1 hora', articulo: 'Art. 13 inc. 3', evidencia: 'Registro del curso', vista: 'charlas' },
  { n: 19, bloque: 'programa', texto: 'Registro de capacitación en EPP con actividades, asistentes, relatores, evaluaciones y reforzamiento', articulo: 'Art. 13 inc. 4', evidencia: 'Registro de capacitación', vista: 'charlas' },
  { n: 20, bloque: 'programa', texto: 'Evaluación anual del cumplimiento y eficacia del programa, con medidas de mejora', articulo: 'Arts. 14 y 52', evidencia: 'Informe de evaluación anual', vista: 'programa' },

  // --- Información y formación ---
  { n: 21, bloque: 'informacion', texto: 'Información oportuna sobre riesgos, medidas preventivas y métodos de trabajo antes de iniciar labores y ante cambios', articulo: 'Art. 15 inc. 1', evidencia: 'Registros de información entregada', vista: 'charlas', sancion: true },
  { n: 22, bloque: 'informacion', texto: 'Contenido de la información: condiciones del lugar, riesgos, procedimientos, productos y emergencias', articulo: 'Arts. 15 inc. 3 y 19 inc. 1', evidencia: 'Documentos informativos firmados', vista: 'charlas' },
  { n: 23, bloque: 'informacion', texto: 'Capacitación en prevención con periodicidad definida (como máximo cada dos años), con enfoque de género y mínimo de 8 horas', articulo: 'Art. 16 inc. 1', evidencia: 'Programa y registros de capacitación', vista: 'charlas' },
  { n: 24, bloque: 'informacion', texto: 'Temas de capacitación: riesgos, enfermedades profesionales, medidas, prestaciones, centro asistencial, emergencias, señalética e incendios', articulo: 'Art. 16 inc. 1', evidencia: 'Contenidos de la capacitación', vista: 'charlas' },

  // --- Consulta y participación ---
  { n: 25, bloque: 'consulta', texto: 'Consulta y participación de trabajadores y representantes en la gestión preventiva, incluida la investigación de accidentes', articulo: 'Arts. 17 inc. 1, 37 inc. 2 n.° 4 y 71 inc. 1', evidencia: 'Actas de consulta y participación', vista: 'incidentes' },

  // --- Riesgo grave e inminente y emergencias ---
  { n: 26, bloque: 'emergencias', texto: 'Ante riesgo grave e inminente: informar a los trabajadores y suspender o evacuar la faena si no se controla', articulo: 'Art. 18 inc. 1', evidencia: 'Registro de comunicación y medidas adoptadas', vista: 'incidentes' },
  { n: 27, bloque: 'emergencias', texto: 'Planes de gestión, reducción y respuesta ante emergencias, catástrofes y eventos previsibles', articulo: 'Art. 19 inc. 1', evidencia: 'Planes de emergencia', vista: 'emergencias' },
  { n: 28, bloque: 'emergencias', texto: 'Simulacros o pruebas de los planes al menos una vez al año', articulo: 'Art. 19 inc. 1', evidencia: 'Registros de simulacros', vista: 'emergencias' },

  // --- Coordinación ---
  { n: 29, bloque: 'coordinacion', texto: 'Coordinación, cooperación e información mutua cuando concurren varias empresas o trabajadores independientes', articulo: 'Art. 20 inc. 1', evidencia: 'Actas o acuerdos de coordinación' },

  // --- Comité paritario ---
  { n: 30, bloque: 'comite', texto: 'Comité constituido donde trabajen más de 25 personas', articulo: 'Art. 23 inc. 1', evidencia: 'Acta de constitución', tamano: 'mas25' },
  { n: 31, bloque: 'comite', texto: 'Medidas para que los miembros electos sin curso de orientación lo realicen en el primer semestre', articulo: 'Art. 32 inc. 1', evidencia: 'Certificados de curso', tamano: 'mas25' },
  { n: 32, bloque: 'comite', texto: 'Acta de constitución registrada en la Dirección del Trabajo dentro de 15 días hábiles', articulo: 'Art. 36', evidencia: 'Comprobante de registro', tamano: 'mas25' },
  { n: 33, bloque: 'comite', texto: 'Facilidades y medidas para el funcionamiento del comité', articulo: 'Art. 37', evidencia: 'Registros de facilidades otorgadas', tamano: 'mas25' },
  { n: 34, bloque: 'comite', texto: 'Reuniones mensuales ordinarias y extraordinarias en los casos definidos', articulo: 'Art. 39 incs. 1 y 2', evidencia: 'Calendario y actas de reuniones', tamano: 'mas25' },
  { n: 35, bloque: 'comite', texto: 'Actas de reuniones con temas, acuerdos y plazos de cumplimiento', articulo: 'Arts. 39 inc. 4 y 42 inc. 1', evidencia: 'Actas', tamano: 'mas25' },
  { n: 36, bloque: 'comite', texto: 'Acuerdos comunicados por escrito a la empresa', articulo: 'Art. 42 inc. 2', evidencia: 'Comunicaciones escritas', tamano: 'mas25' },
  { n: 37, bloque: 'comite', texto: 'Entrega al comité de toda la documentación preventiva', articulo: 'Art. 46 inc. 3', evidencia: 'Constancia de entrega', tamano: 'mas25' },
  { n: 38, bloque: 'comite', texto: 'Cumplimiento de las funciones mínimas: instruir, vigilar, investigar accidentes, indicar medidas, promover capacitación e informar riesgos graves', articulo: 'Art. 47', evidencia: 'Actas, investigaciones e informes', tamano: 'mas25' },

  // --- Delegado SST ---
  { n: 39, bloque: 'delegado', texto: 'Entre 10 y 25 trabajadores: existencia de un delegado que participe en el sistema de gestión', articulo: 'Arts. 66 inc. 1, 64 y 37', evidencia: 'Designación o elección del delegado', tamano: 'entre10y25' },
  { n: 40, bloque: 'delegado', texto: 'Elección del delegado cada 2 años mediante asamblea, con acta', articulo: 'Art. 66 inc. 2', evidencia: 'Acta de asamblea', tamano: 'entre10y25' },

  // --- Departamento, encargado, registros ---
  { n: 41, bloque: 'departamento', texto: 'Departamento de Prevención con experto inscrito en la Seremi, si hay más de 100 trabajadores', articulo: 'Arts. 50 y 55 inc. 2', evidencia: 'Nombramiento e inscripción', tamano: 'mas100' },
  { n: 42, bloque: 'departamento', texto: 'Medios y personal suficientes para el departamento', articulo: 'Art. 51 inc. 1', evidencia: 'Presupuesto y asignación de personal', tamano: 'mas100' },
  { n: 43, bloque: 'departamento', texto: 'Cumplimiento de las funciones del departamento', articulo: 'Art. 52', evidencia: 'Planes, informes y actividades', tamano: 'mas100' },
  { n: 44, bloque: 'departamento', texto: 'Categoría y dedicación mínima del encargado según número de trabajadores y cotización', articulo: 'Arts. 54 y 55 inc. 1', evidencia: 'Contrato o designación y cálculo según dotación y cotización genérica' },
  { n: 45, bloque: 'departamento', texto: 'Registro de asistencia del encargado conforme al tiempo exigido', articulo: 'Art. 55 incs. 1 y 3', evidencia: 'Registro de asistencia' },
  { n: 46, bloque: 'departamento', texto: 'Registros de incidentes, accidentes, enfermedades, vigilancia de la salud y tasas estadísticas, diferenciados por sexo', articulo: 'Arts. 73 y 74', evidencia: 'Registros y estadísticas', vista: 'incidentes' },
  { n: 47, bloque: 'departamento', texto: 'Empresas sin departamento: registro de tasa de accidentabilidad, accidentes y enfermedades', articulo: 'Art. 75', evidencia: 'Registros estadísticos', tamano: 'hasta100', vista: 'dashboard' },
  { n: 48, bloque: 'departamento', texto: 'Encargado de gestión del riesgo, en empresas de hasta 100 trabajadores, capacitado por el organismo administrador', articulo: 'Art. 65 inc. 1', evidencia: 'Certificado de capacitación', tamano: 'hasta100' },

  // --- Reglamento interno ---
  { n: 49, bloque: 'reglamento', texto: 'Reglamento Interno de Higiene y Seguridad vigente, entregado gratuitamente e ingresado a la Dirección del Trabajo', articulo: 'Arts. 56 inc. 1 y 57 inc. 1', evidencia: 'Reglamento y comprobante de ingreso', sancion: true },
  { n: 50, bloque: 'reglamento', texto: 'Envío del reglamento con 30 días de anticipación a trabajadores, comité o delegado y sindicatos', articulo: 'Art. 57 inc. 2', evidencia: 'Constancias de envío' },
  { n: 51, bloque: 'reglamento', texto: 'Revisión del reglamento al menos una vez al año, con participación de los actores definidos', articulo: 'Art. 57 inc. 5', evidencia: 'Actas de revisión' },
  { n: 52, bloque: 'reglamento', texto: 'Contenido mínimo: preámbulo, disposiciones generales, obligaciones, prohibiciones y sanciones', articulo: 'Art. 58', evidencia: 'Reglamento' },

  // --- Mapas de riesgos ---
  { n: 53, bloque: 'mapas', texto: 'Mapas de riesgos visibles, con esquema del lugar y principales riesgos', articulo: 'Art. 62 incs. 1 y 2', evidencia: 'Mapas publicados' },

  // --- Vigilancia ---
  { n: 54, bloque: 'vigilancia', texto: 'Lugares con exposición incluidos en un programa de vigilancia ambiental', articulo: 'Art. 67 incs. 1 y 3', evidencia: 'Programa de vigilancia ambiental', vista: 'protocolos' },
  { n: 55, bloque: 'vigilancia', texto: 'Trabajadores expuestos incluidos en un programa de vigilancia de la salud y solicitud de incorporación', articulo: 'Art. 67 incs. 1, 3 y 5', evidencia: 'Programa y solicitud', vista: 'protocolos' },
  { n: 56, bloque: 'vigilancia', texto: 'Permiso para asistir a exámenes de control, con ese tiempo considerado como trabajado', articulo: 'Art. 68', evidencia: 'Autorizaciones y registros', vista: 'protocolos' },

  // --- Prescripción ---
  { n: 57, bloque: 'prescripcion', texto: 'Traslado de trabajadores con enfermedad profesional a un puesto sin el riesgo, sin pérdida de remuneración', articulo: 'Art. 69', evidencia: 'Resolución de traslado y registro de remuneraciones' },
  { n: 58, bloque: 'prescripcion', texto: 'Implementación de las medidas ordenadas por fiscalizadores, organismo administrador, departamento o comité', articulo: 'Art. 70', evidencia: 'Registro de implementación', vista: 'hallazgos' },

  // --- Investigación ---
  { n: 59, bloque: 'investigacion', texto: 'Investigación con enfoque de género de accidentes y enfermedades, con la metodología del organismo administrador', articulo: 'Art. 71', evidencia: 'Informes de investigación', vista: 'incidentes' },

  // --- Registro de la actividad preventiva ---
  { n: 60, bloque: 'registro', texto: 'Registro documental fidedigno de toda la gestión de riesgos, disponible para fiscalizadores y para el organismo administrador', articulo: 'Art. 72 inc. 1', evidencia: 'Archivo documental de la gestión preventiva', vista: 'documentos' },
];
