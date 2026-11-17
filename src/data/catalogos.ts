import type {
  CategoriaEPP,
  CodigoProtocolo,
  JerarquiaControl,
  PlantillaChecklist,
  Rubro,
  TemaCharla,
  TipoCharla,
  TipoIncidente,
} from '../types';

export const RUBRO_LABEL: Record<Rubro, string> = {
  manufactura: 'Pyme Manufacturera / Alimentaria',
  agroindustria: 'Agroindustria & Packing',
  construccion: 'Construcción & Servicios Industriales',
  comercio: 'Comercio & Retail',
  servicios: 'Servicios / Oficinas',
  otro: 'Otro rubro',
};

export const TIPO_CHARLA_LABEL: Record<TipoCharla, string> = {
  charla5: 'Charla de 5 Minutos',
  capacitacion: 'Capacitación',
  odi: 'Obligación de Informar (ODI – DS 40 Art. 21)',
};

export const TIPO_INCIDENTE_LABEL: Record<TipoIncidente, string> = {
  cuasi_accidente: 'Cuasi-Accidente',
  condicion_subestandar: 'Condición Subestándar',
  accidente_stp: 'Accidente sin Tiempo Perdido',
  accidente_ctp: 'Accidente con Tiempo Perdido',
  accidente_trayecto: 'Accidente de Trayecto',
};

export const JERARQUIA_LABEL: Record<JerarquiaControl, string> = {
  eliminacion: 'Eliminación',
  sustitucion: 'Sustitución',
  ingenieria: 'Control de Ingeniería',
  administracion: 'Control Administrativo',
  epp: 'EPP',
};

export const JERARQUIA_ORDEN: JerarquiaControl[] = ['eliminacion', 'sustitucion', 'ingenieria', 'administracion', 'epp'];

export const CATEGORIAS_EPP: { categoria: CategoriaEPP; vidaUtilDias: number; norma: string }[] = [
  { categoria: 'Calzado de seguridad', vidaUtilDias: 365, norma: 'NCh 772' },
  { categoria: 'Guantes', vidaUtilDias: 30, norma: 'EN 388 / EN 420' },
  { categoria: 'Antiparras / Lentes', vidaUtilDias: 180, norma: 'ANSI Z87.1' },
  { categoria: 'Protección auditiva', vidaUtilDias: 90, norma: 'NCh 1331' },
  { categoria: 'Casco', vidaUtilDias: 730, norma: 'NCh 461' },
  { categoria: 'Ropa térmica', vidaUtilDias: 365, norma: 'EN 342' },
  { categoria: 'Arnés de seguridad', vidaUtilDias: 1825, norma: 'NCh 1258' },
  { categoria: 'Respirador / Mascarilla', vidaUtilDias: 90, norma: 'NCh 1284 / NIOSH' },
  { categoria: 'Chaleco reflectante', vidaUtilDias: 365, norma: 'NCh 3289' },
  { categoria: 'Ropa de trabajo', vidaUtilDias: 365, norma: 'Reglamento Interno' },
];

export const PARTES_CUERPO = ['Cabeza', 'Ojos', 'Cara', 'Cuello', 'Tronco / Espalda', 'Brazo', 'Mano / Dedos', 'Pierna', 'Pie', 'Múltiple', 'Sin lesión'];

export const LISTA_CAUSAS = {
  acciones: [
    'Operar equipos sin autorización',
    'No usar EPP o usarlo incorrectamente',
    'Adoptar posición inadecuada',
    'Usar equipo defectuoso',
    'No bloquear / no señalizar (LOTO)',
    'Operar a velocidad inadecuada',
    'Levantar carga en forma incorrecta',
    'Hacer mantención con equipo energizado',
  ],
  condiciones: [
    'Protecciones o resguardos inadecuados',
    'Equipos, herramientas o materiales defectuosos',
    'Espacio limitado para desenvolverse',
    'Orden y aseo deficientes',
    'Superficie resbaladiza / desnivel',
    'Iluminación deficiente',
    'Exposición a ruido sobre límite',
    'Sistema de advertencia insuficiente',
  ],
  personales: [
    'Capacidad física / fisiológica inadecuada',
    'Falta de conocimiento',
    'Falta de habilidad',
    'Tensión física o mental (fatiga)',
    'Motivación inadecuada',
  ],
  trabajo: [
    'Liderazgo y/o supervisión deficiente',
    'Ingeniería inadecuada',
    'Adquisiciones deficientes',
    'Mantenimiento deficiente',
    'Herramientas y equipos inadecuados',
    'Estándares de trabajo inexistentes',
    'Uso y desgaste',
  ],
};

// ------------------------------------------------------------
// Biblioteca de temas de Charla 5 Minutos por rubro
// ------------------------------------------------------------
export const TEMAS_CHARLA: TemaCharla[] = [
  {
    id: 't-extintores', titulo: 'Uso correcto de extintores', categoria: 'Emergencias', rubros: 'todos',
    contenido: 'Clases de fuego (A, B, C, D, K). Técnica PASO: Presionar/Tirar el seguro, Apuntar a la base, Apretar la manilla, Barrer de lado a lado. Ubicación de extintores en el área (DS 594 Art. 45-52). Distancia segura de 2 a 3 metros. Dar aviso inmediato y evacuar si el fuego no se controla en 30 segundos.',
  },
  {
    id: 't-mmc', titulo: 'Manejo Manual de Cargas (Ley 20.949)', categoria: 'Ergonomía', rubros: 'todos',
    contenido: 'Peso máximo: 25 kg hombres; 20 kg mujeres y menores de 18 años (Ley 20.949). Técnica correcta: pies separados, flexionar rodillas, espalda recta, carga pegada al cuerpo, no girar el tronco. Usar ayudas mecánicas (transpaletas, carros). Pedir ayuda para cargas voluminosas.',
  },
  {
    id: 't-loto', titulo: 'Bloqueo y etiquetado de energías (LOTO)', categoria: 'Energías peligrosas', rubros: ['manufactura', 'agroindustria', 'construccion'],
    contenido: 'Pasos: 1) Avisar a afectados; 2) Detener el equipo; 3) Aislar fuentes de energía (eléctrica, neumática, hidráulica, mecánica); 4) Instalar candado y tarjeta personal; 5) Liberar energía residual; 6) Verificar energía cero intentando arrancar. Cada trabajador instala su propio candado. Nunca retirar un candado ajeno.',
  },
  {
    id: 't-altura', titulo: 'Trabajo en altura física', categoria: 'Tareas críticas', rubros: ['construccion', 'agroindustria', 'manufactura'],
    contenido: 'Trabajo en altura: sobre 1,8 m. Uso obligatorio de arnés de cuerpo completo con doble cola y amortiguador (NCh 1258), conectado a punto de anclaje certificado sobre la cabeza. Inspección previa de andamios (tarjeta verde). Prohibido trabajar con viento fuerte o lluvia. Contar con permiso de trabajo y AST.',
  },
  {
    id: 't-electrico', titulo: 'Riesgo eléctrico', categoria: 'Energías peligrosas', rubros: 'todos',
    contenido: 'Sólo personal autorizado SEC interviene tableros. Tableros cerrados, señalizados y con diferencial. No usar extensiones dañadas ni enchufes sobrecargados. No operar equipos con manos mojadas. En caso de electrocución: cortar energía antes de tocar a la víctima.',
  },
  {
    id: 't-orden', titulo: 'Orden y aseo (Metodología 5S)', categoria: 'Condiciones generales', rubros: 'todos',
    contenido: 'Clasificar, Ordenar, Limpiar, Estandarizar y Disciplina. Vías de tránsito y evacuación despejadas (DS 594 Art. 8). Derrames limpiados de inmediato. Residuos en contenedores rotulados. Un lugar para cada cosa y cada cosa en su lugar.',
  },
  {
    id: 't-hornos', titulo: 'Prevención de quemaduras en hornos y superficies calientes', categoria: 'Proceso', rubros: ['manufactura'],
    contenido: 'Uso de guantes térmicos y delantal. No abrir hornos con el rostro de frente. Señalizar superficies calientes. Bandejas siempre con carro porta bandejas. Primeros auxilios: enfriar con agua corriente 10-20 min, no aplicar cremas ni pasta dental.',
  },
  {
    id: 't-cortes', titulo: 'Uso seguro de cuchillos y herramientas cortantes', categoria: 'Proceso', rubros: ['manufactura', 'agroindustria'],
    contenido: 'Cortar siempre en dirección contraria al cuerpo. Usar guante anticorte (malla) en la mano que sujeta. Herramientas afiladas: un cuchillo sin filo exige más fuerza. Guardar en fundas o porta cuchillos, nunca en bolsillos.',
  },
  {
    id: 't-grua', titulo: 'Tránsito seguro de grúas horquilla', categoria: 'Vehículos', rubros: ['agroindustria', 'manufactura', 'comercio'],
    contenido: 'Sólo operadores con licencia clase D y autorización interna. Check-list pre-uso diario. Velocidad máxima 10 km/h en bodega. Peatones: respetar pasillos demarcados y contacto visual con el operador. Nunca transitar bajo carga elevada.',
  },
  {
    id: 't-agroquimicos', titulo: 'Manejo seguro de agroquímicos y plaguicidas (DS 157)', categoria: 'Químicos', rubros: ['agroindustria'],
    contenido: 'Respetar período de reingreso señalado en etiqueta. Uso de traje impermeable, respirador con filtro, guantes de nitrilo y antiparras. Bodega de plaguicidas rotulada y ventilada. Lectura de Hoja de Datos de Seguridad (HDS – NCh 2245). Ducha y lavado posterior a la aplicación.',
  },
  {
    id: 't-frio', titulo: 'Trabajo en cámaras de frío y túneles', categoria: 'Ambiente térmico', rubros: ['agroindustria', 'manufactura'],
    contenido: 'Uso de ropa térmica completa (chaqueta, pantalón, gorro, guantes). Pausas de recuperación térmica según DS 594 Art. 99-102. Puertas con apertura interior y alarma de hombre atrapado. Evitar cambios bruscos de temperatura.',
  },
  {
    id: 't-uv', titulo: 'Radiación UV de origen solar (Ley 20.096)', categoria: 'Agentes físicos', rubros: ['agroindustria', 'construccion'],
    contenido: 'Índice UV sobre 6 exige medidas: bloqueador FPS 50+ cada 2 horas, legionario o jockey con cubrenuca, lentes con filtro UV, ropa manga larga. Hidratación permanente. Zonas de sombra para descanso entre 10:00 y 17:00 hrs.',
  },
  {
    id: 't-excavaciones', titulo: 'Excavaciones y zanjas', categoria: 'Tareas críticas', rubros: ['construccion'],
    contenido: 'Sobre 1,5 m de profundidad requiere entibación o talud. Material excavado a mínimo 60 cm del borde. Escalas de acceso cada 15 m. Barreras perimetrales y señalización nocturna. Revisión diaria por persona competente, especialmente tras lluvias.',
  },
  {
    id: 't-andamios', titulo: 'Montaje y uso de andamios', categoria: 'Tareas críticas', rubros: ['construccion'],
    contenido: 'Montaje por personal calificado según NCh 997/998. Base nivelada con placas base, plataformas completas con barandas a 1 m, rodapié y travesaño intermedio. Tarjeta verde (habilitado), roja (prohibido). No sobrecargar plataformas.',
  },
  {
    id: 't-silice', titulo: 'Exposición a sílice cristalina (PLANESI)', categoria: 'Agentes químicos', rubros: ['construccion', 'manufactura'],
    contenido: 'El polvo de sílice causa silicosis, enfermedad irreversible. Cortar con vía húmeda o aspiración localizada. Respirador con filtro P100 con prueba de ajuste. Prohibido barrer en seco o usar aire comprimido para limpiar ropa.',
  },
  {
    id: 't-ruido', titulo: 'Protección auditiva y PREXOR', categoria: 'Agentes físicos', rubros: 'todos',
    contenido: 'Sobre 85 dB(A) es obligatorio el uso de protector auditivo. Si debes alzar la voz para hablar a 1 metro, hay ruido peligroso. Insertar tapones correctamente (tirar la oreja hacia arriba y atrás). Participar en audiometrías de vigilancia.',
  },
  {
    id: 't-psico', titulo: 'Ley Karin: prevención del acoso y la violencia laboral', categoria: 'Psicosocial', rubros: 'todos',
    contenido: 'Ley 21.643 (Ley Karin) vigente desde agosto 2024. Define acoso laboral, sexual y violencia en el trabajo ejercida por terceros. Canales de denuncia confidenciales, procedimiento de investigación de 30 días y medidas de resguardo. Promover el buen trato y el respeto.',
  },
  {
    id: 't-atencion', titulo: 'Atención al público y manejo de clientes agresivos', categoria: 'Psicosocial', rubros: ['comercio', 'servicios'],
    contenido: 'Mantener la calma, tono de voz pausado, no confrontar. Llamar a supervisor o seguridad ante amenazas. Registrar el incidente. Protocolo de violencia externa (Ley Karin). Pausas activas y apoyo psicológico de la mutualidad.',
  },
  {
    id: 't-pausas', titulo: 'Pausas activas y prevención de TMERT', categoria: 'Ergonomía', rubros: 'todos',
    contenido: 'Realizar pausas de 5-10 minutos cada 2 horas en tareas repetitivas. Ejercicios de elongación de cuello, hombros, muñecas y espalda. Alternar tareas. Reportar molestias musculares tempranamente.',
  },
  {
    id: 't-emergencia', titulo: 'Plan de emergencia y evacuación (sismos)', categoria: 'Emergencias', rubros: 'todos',
    contenido: 'Durante el sismo: alejarse de ventanas y estanterías, protegerse junto a estructura sólida. Después: evacuar por vías señalizadas sin correr, no usar ascensores, dirigirse a la zona de seguridad y esperar el conteo del líder de evacuación.',
  },
];

// ------------------------------------------------------------
// Plantillas de inspección
// ------------------------------------------------------------
export const PLANTILLAS: PlantillaChecklist[] = [
  {
    id: 'ds594',
    nombre: 'Checklist General DS 594',
    descripcion: 'Condiciones sanitarias y ambientales básicas en los lugares de trabajo.',
    norma: 'DS 594/1999 MINSAL',
    items: [
      { id: 'd1', seccion: 'Saneamiento básico', texto: 'Agua potable disponible para consumo e higiene', referencia: 'Art. 12' },
      { id: 'd2', seccion: 'Saneamiento básico', texto: 'Servicios higiénicos separados por sexo, limpios y en cantidad suficiente', referencia: 'Art. 21-23' },
      { id: 'd3', seccion: 'Saneamiento básico', texto: 'Vestidores y casilleros disponibles para el personal', referencia: 'Art. 27' },
      { id: 'd4', seccion: 'Saneamiento básico', texto: 'Comedor aislado de áreas de trabajo, con mesas, sillas y lavaplatos', referencia: 'Art. 28-29' },
      { id: 'd5', seccion: 'Prevención de incendios', texto: 'Extintores con carga vigente, señalizados y a no más de 1,30 m de altura', referencia: 'Art. 45-51' },
      { id: 'd6', seccion: 'Prevención de incendios', texto: 'Extintores accesibles, sin obstrucciones', referencia: 'Art. 47' },
      { id: 'd7', seccion: 'Vías de evacuación', texto: 'Vías de evacuación despejadas y señalizadas (NCh 2111)', referencia: 'Art. 37' },
      { id: 'd8', seccion: 'Vías de evacuación', texto: 'Puertas de emergencia abren hacia el exterior y sin llave', referencia: 'Art. 37' },
      { id: 'd9', seccion: 'Vías de evacuación', texto: 'Luces de emergencia operativas', referencia: 'Art. 37' },
      { id: 'd10', seccion: 'Instalaciones eléctricas', texto: 'Tableros eléctricos cerrados, rotulados y con protección diferencial', referencia: 'Art. 39 / NCh Elec 4' },
      { id: 'd11', seccion: 'Instalaciones eléctricas', texto: 'Cables y extensiones sin daños, sin uniones expuestas', referencia: 'Art. 39' },
      { id: 'd12', seccion: 'Condiciones ambientales', texto: 'Iluminación adecuada a la tarea (lux según Art. 103)', referencia: 'Art. 103' },
      { id: 'd13', seccion: 'Condiciones ambientales', texto: 'Ventilación suficiente, natural o mecánica', referencia: 'Art. 32-33' },
      { id: 'd14', seccion: 'Condiciones ambientales', texto: 'Ruido controlado o con protección auditiva sobre 85 dB(A)', referencia: 'Art. 74-75' },
      { id: 'd15', seccion: 'Orden y aseo', texto: 'Pisos limpios, sin derrames ni obstáculos', referencia: 'Art. 8' },
      { id: 'd16', seccion: 'Orden y aseo', texto: 'Residuos dispuestos en contenedores rotulados', referencia: 'Art. 18-20' },
      { id: 'd17', seccion: 'Sustancias peligrosas', texto: 'Productos químicos rotulados con HDS disponible (NCh 2245)', referencia: 'Art. 42' },
      { id: 'd18', seccion: 'Primeros auxilios', texto: 'Botiquín de primeros auxilios completo y accesible', referencia: 'Art. 115 Ley 16.744' },
    ],
  },
  {
    id: 'maquinaria',
    nombre: 'Checklist Maquinaria, Herramientas y Vehículos',
    descripcion: 'Estado de guardas, paradas de emergencia, grúas horquilla y herramientas eléctricas.',
    norma: 'DS 594 Art. 36-38 / Reglamento Interno',
    items: [
      { id: 'm1', seccion: 'Maquinaria fija', texto: 'Guardas y resguardos de partes móviles instalados y fijos' },
      { id: 'm2', seccion: 'Maquinaria fija', texto: 'Parada de emergencia (hongo rojo) operativa y accesible' },
      { id: 'm3', seccion: 'Maquinaria fija', texto: 'Sistema de bloqueo LOTO disponible (candados y tarjetas)' },
      { id: 'm4', seccion: 'Maquinaria fija', texto: 'Señalización de riesgos y zonas de operación demarcadas' },
      { id: 'm5', seccion: 'Maquinaria fija', texto: 'Conexión a tierra y cableado en buen estado' },
      { id: 'm6', seccion: 'Grúa horquilla', texto: 'Operador con licencia clase D y autorización vigente' },
      { id: 'm7', seccion: 'Grúa horquilla', texto: 'Check-list pre-uso del turno completado' },
      { id: 'm8', seccion: 'Grúa horquilla', texto: 'Alarma de retroceso, baliza y luces operativas' },
      { id: 'm9', seccion: 'Grúa horquilla', texto: 'Horquillas, cadenas y mástil sin fisuras ni deformaciones' },
      { id: 'm10', seccion: 'Grúa horquilla', texto: 'Cinturón de seguridad y extintor instalado' },
      { id: 'm11', seccion: 'Herramientas eléctricas', texto: 'Carcasa, cable y enchufe sin daños' },
      { id: 'm12', seccion: 'Herramientas eléctricas', texto: 'Guarda de disco en esmeriles angulares' },
      { id: 'm13', seccion: 'Herramientas manuales', texto: 'Mangos firmes, sin astillas ni fisuras' },
      { id: 'm14', seccion: 'Vehículos', texto: 'Revisión técnica y permiso de circulación vigentes' },
      { id: 'm15', seccion: 'Vehículos', texto: 'Neumáticos, frenos y luces en buen estado' },
    ],
  },
  {
    id: 'ast',
    nombre: 'Análisis Seguro de Trabajo (AST)',
    descripcion: 'Verificación previa a tareas críticas o no rutinarias.',
    norma: 'DS 40 Art. 21 / Procedimiento interno',
    items: [
      { id: 'a1', seccion: 'Planificación', texto: 'Procedimiento de trabajo seguro conocido por todo el equipo' },
      { id: 'a2', seccion: 'Planificación', texto: 'Permiso de trabajo emitido y firmado (altura, caliente, confinado)' },
      { id: 'a3', seccion: 'Planificación', texto: 'Trabajadores competentes y con aptitud física para la tarea' },
      { id: 'a4', seccion: 'Peligros', texto: 'Peligros de la tarea identificados y comunicados' },
      { id: 'a5', seccion: 'Peligros', texto: 'Energías peligrosas aisladas y bloqueadas' },
      { id: 'a6', seccion: 'Peligros', texto: 'Área de trabajo segregada y señalizada' },
      { id: 'a7', seccion: 'Peligros', texto: 'Condiciones climáticas aptas para la tarea' },
      { id: 'a8', seccion: 'Equipos', texto: 'Herramientas y equipos inspeccionados (código de color del mes)' },
      { id: 'a9', seccion: 'Equipos', texto: 'EPP específico disponible y en buen estado' },
      { id: 'a10', seccion: 'Emergencia', texto: 'Plan de rescate / emergencia definido y conocido' },
      { id: 'a11', seccion: 'Emergencia', texto: 'Medios de comunicación disponibles (radio, teléfono)' },
      { id: 'a12', seccion: 'Emergencia', texto: 'Extintor y botiquín en el lugar de la tarea' },
    ],
  },
];

// ------------------------------------------------------------
// Protocolos MINSAL
// ------------------------------------------------------------
export const PROTOCOLOS_INFO: Record<CodigoProtocolo, { nombre: string; norma: string; descripcion: string; frecuenciaMeses: number; etapas: string[] }> = {
  TMERT: {
    nombre: 'TMERT – Trastornos Musculoesqueléticos de Extremidades Superiores',
    norma: 'Res. Exenta N° 804/2011 MINSAL',
    descripcion: 'Identificación y evaluación de factores de riesgo de tareas repetitivas de extremidades superiores.',
    frecuenciaMeses: 36,
    etapas: ['Lista de chequeo inicial (identificación)', 'Evaluación de condición crítica', 'Evaluación avanzada (OCRA / Strain Index)', 'Implementación de medidas', 'Capacitación a expuestos', 'Re-evaluación'],
  },
  MMC: {
    nombre: 'MMC – Manejo Manual de Cargas (Ley del Saco)',
    norma: 'Ley 20.949 / DS 63 / Guía Técnica MMC',
    descripcion: 'Evaluación de levantamiento, descenso, transporte, empuje y arrastre de cargas.',
    frecuenciaMeses: 36,
    etapas: ['Identificación de tareas con MMC', 'Evaluación (MAC / ISO 11228)', 'Plan de medidas de control', 'Capacitación técnica de levantamiento', 'Verificación de límites 25/20 kg'],
  },
  PREXOR: {
    nombre: 'PREXOR – Exposición Ocupacional a Ruido',
    norma: 'Res. Exenta N° 1029/2011 MINSAL',
    descripcion: 'Vigilancia ambiental y de la salud de trabajadores expuestos a ruido sobre 82 dB(A).',
    frecuenciaMeses: 24,
    etapas: ['Evaluación cualitativa', 'Evaluación cuantitativa (dosimetría)', 'Programa de vigilancia de la salud (audiometrías)', 'Programa de conservación auditiva', 'Medidas de control de ingeniería'],
  },
  PLANESI: {
    nombre: 'PLANESI – Exposición a Sílice',
    norma: 'Res. Exenta N° 268/2015 MINSAL',
    descripcion: 'Plan Nacional de Erradicación de la Silicosis: evaluación ambiental y vigilancia radiológica.',
    frecuenciaMeses: 24,
    etapas: ['Identificación de fuentes de sílice', 'Evaluación cuantitativa ambiental', 'Vigilancia médica (radiografía OIT)', 'Medidas de control (vía húmeda, extracción)', 'Programa de protección respiratoria'],
  },
  PSICOSOCIAL: {
    nombre: 'Riesgo Psicosocial (CEAL-SM/SUSESO) y Ley Karin',
    norma: 'Res. Exenta N° 1433/2017 MINSAL / Ley 21.643',
    descripcion: 'Evaluación de riesgos psicosociales con CEAL-SM y protocolo de prevención del acoso y violencia (Ley Karin).',
    frecuenciaMeses: 24,
    etapas: ['Constitución Comité de Aplicación', 'Sensibilización y difusión', 'Aplicación cuestionario CEAL-SM', 'Análisis y plan de intervención', 'Protocolo Ley Karin y canal de denuncias', 'Reevaluación'],
  },
};

export const CODIGOS_PROTOCOLO: CodigoProtocolo[] = ['TMERT', 'MMC', 'PREXOR', 'PLANESI', 'PSICOSOCIAL'];

export const PROBABILIDAD_LABEL: Record<1 | 2 | 4, string> = { 1: 'Baja (1)', 2: 'Media (2)', 4: 'Alta (4)' };
export const CONSECUENCIA_LABEL: Record<1 | 2 | 4, string> = {
  1: 'Ligeramente dañino (1)',
  2: 'Dañino (2)',
  4: 'Extremadamente dañino (4)',
};

export const REGIONES = [
  'Arica y Parinacota', 'Tarapacá', 'Antofagasta', 'Atacama', 'Coquimbo', 'Valparaíso', 'Metropolitana',
  "O'Higgins", 'Maule', 'Ñuble', 'Biobío', 'La Araucanía', 'Los Ríos', 'Los Lagos', 'Aysén', 'Magallanes',
];
