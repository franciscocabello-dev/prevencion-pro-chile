import type {
  Asistente,
  Charla,
  CodigoProtocolo,
  CompanyData,
  ControlIPER,
  Criticidad,
  Empresa,
  EntregaEPP,
  Extintor,
  Hallazgo,
  Incidente,
  Inspeccion,
  Protocolo,
  RiesgoIPER,
  Trabajador,
  CategoriaEPP,
  JerarquiaControl,
  TipoIncidente,
} from '../types';
import { CATEGORIAS_EPP, CODIGOS_PROTOCOLO, PLANTILLAS, PROTOCOLOS_INFO, TEMAS_CHARLA } from './catalogos';
import { addDays, addMonths, todayISO } from '../utils/date';
import { makeRut } from '../utils/rut';

// ------------------------------------------------------------
// Generador de firma manuscrita sintética (PNG) para datos demo
// ------------------------------------------------------------
const signatureCache = new Map<string, string>();

export const fakeSignature = (name: string): string => {
  if (signatureCache.has(name)) return signatureCache.get(name)!;
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = 220;
  canvas.height = 80;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  let seed = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  ctx.strokeStyle = '#1e3a8a';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  let x = 15;
  let y = 45;
  ctx.moveTo(x, y);
  const strokes = 7 + Math.floor(rnd() * 5);
  for (let i = 0; i < strokes; i++) {
    const nx = x + 12 + rnd() * 18;
    const ny = 20 + rnd() * 40;
    ctx.bezierCurveTo(x + rnd() * 20, y - 30 * rnd(), nx - rnd() * 15, ny + 25 * rnd(), nx, ny);
    x = nx;
    y = ny;
  }
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(10 + rnd() * 20, 62);
  ctx.quadraticCurveTo(110, 55 + rnd() * 20, Math.min(210, x + 10), 60);
  ctx.stroke();
  const url = canvas.toDataURL('image/png');
  signatureCache.set(name, url);
  return url;
};

// ------------------------------------------------------------
// Perfil base para cada empresa demo
// ------------------------------------------------------------
interface Perfil {
  id: string;
  empresa: Empresa;
  areas: string[];
  supervisores: string[];
  trabajadores: [string, string, string][]; // nombre, cargo, area
  temas: string[]; // ids de TEMAS_CHARLA
  diasDesdeUltimoCTP: number;
  record: number;
  indicadores: { promedioTrabajadores: number; horasHombre: number; accidentesCTP: number; diasPerdidos: number };
  tasas: { adicional: number; siniestralidad: number; invalideces: number; remuneracion: number };
  incidentes: { tipo: TipoIncidente; diasAtras: number; area: number; desc: string; afectado?: number; dias?: number; parte?: string; estado: Incidente['estado']; investigar?: boolean }[];
  hallazgos: { desc: string; area: number; crit: Criticidad; diasAtras: number; plazo: number; estado: Hallazgo['estado']; plan: string; aprobado: boolean; origen?: Hallazgo['origen'] }[];
  iper: { area: number; proceso: string; tarea: string; peligro: string; riesgo: string; p: 1 | 2 | 4; c: 1 | 2 | 4; controles: [JerarquiaControl, string][]; rutinaria?: boolean }[];
  protocolos: Partial<Record<CodigoProtocolo, { aplica: boolean; completadas: number; expuestos: number; mesesAtras: number; obs: string }>>;
  extintores: { ubicacion: string; tipo: Extintor['tipo']; kg: number; diasVence: number }[];
  eppPorCargo: Record<string, CategoriaEPP[]>;
}

const supervisorDe = (p: Perfil, areaIdx: number) => p.supervisores[areaIdx % p.supervisores.length];

const buildCompany = (p: Perfil): CompanyData => {
  const hoy = todayISO();
  let rutBase = 12_000_000 + (p.id.length * 731_117) % 7_000_000;

  const trabajadores: Trabajador[] = p.trabajadores.map(([nombre, cargo, area], i) => ({
    id: `${p.id}-w${i + 1}`,
    nombre,
    rut: makeRut((rutBase += 1_137_291) % 22_000_000 + 6_000_000),
    cargo,
    area,
    fechaIngreso: addDays(hoy, -(200 + i * 97)),
    activo: true,
  }));

  // -------- Charlas (distribuidas en los últimos 6 meses) --------
  const charlas: Charla[] = [];
  const temas = p.temas.map((id) => TEMAS_CHARLA.find((t) => t.id === id)!).filter(Boolean);
  const totalCharlas = 16;
  for (let i = 0; i < totalCharlas; i++) {
    const tema = temas[i % temas.length];
    const diasAtras = Math.round(i * 10.5) + (i % 3);
    const area = p.areas[i % p.areas.length];
    const relator = i % 4 === 0 ? p.empresa.prevencionista : supervisorDe(p, i);
    const delArea = trabajadores.filter((t) => t.area === area);
    const pool = delArea.length >= 3 ? delArea : trabajadores;
    const n = Math.min(pool.length, 3 + (i % 4));
    const asistentes: Asistente[] = pool.slice(0, n).map((t, k) => ({
      id: `${p.id}-c${i}-a${k}`,
      nombre: t.nombre,
      rut: t.rut,
      cargo: t.cargo,
      firma: fakeSignature(t.nombre),
    }));
    charlas.push({
      id: `${p.id}-ch${i + 1}`,
      tipo: i % 7 === 3 ? 'capacitacion' : i % 7 === 5 ? 'odi' : 'charla5',
      tema: tema.titulo,
      contenido: tema.contenido,
      fecha: addDays(hoy, -diasAtras),
      hora: `0${7 + (i % 3)}:${i % 2 ? '30' : '45'}`,
      duracionMin: i % 7 === 3 ? 60 : i % 7 === 5 ? 30 : 5,
      area,
      relator,
      cargoRelator: relator === p.empresa.prevencionista ? 'Experto en Prevención de Riesgos' : 'Supervisor',
      firmaRelator: fakeSignature(relator),
      asistentes,
      creadoPor: relator === p.empresa.prevencionista ? 'prevencionista' : 'supervisor',
    });
  }

  // -------- Incidentes --------
  const incidentes: Incidente[] = p.incidentes.map((inc, i) => {
    const afectado = inc.afectado !== undefined ? trabajadores[inc.afectado] : undefined;
    const fecha = addDays(hoy, -inc.diasAtras);
    const investigado = inc.investigar || inc.estado !== 'reportado';
    return {
      id: `${p.id}-inc${i + 1}`,
      folio: 1001 + i,
      tipo: inc.tipo,
      fecha,
      hora: `${10 + (i % 6)}:${i % 2 ? '15' : '40'}`,
      area: p.areas[inc.area],
      descripcion: inc.desc,
      reportadoPor: supervisorDe(p, inc.area),
      afectado: afectado?.nombre,
      rutAfectado: afectado?.rut,
      parteCuerpo: inc.parte,
      diasPerdidos: inc.dias ?? 0,
      estado: inc.estado,
      diatEmitida: inc.tipo.startsWith('accidente'),
      investigacion: investigado
        ? {
            porques: [
              'El trabajador no detectó la condición de riesgo a tiempo.',
              'La condición no estaba señalizada ni demarcada.',
              'No existía estándar de inspección diaria del área.',
              'El procedimiento no fue actualizado tras el cambio de layout.',
              inc.estado === 'cerrado' ? 'Falta de gestión del cambio en la planificación de la operación.' : '',
            ],
            causasInmediatas: { acciones: ['Adoptar posición inadecuada'], condiciones: ['Orden y aseo deficientes'] },
            causasBasicas: { personales: ['Falta de conocimiento'], trabajo: ['Estándares de trabajo inexistentes'] },
            medidas: [
              { id: `${p.id}-m${i}a`, descripcion: 'Instalar señalización y demarcación del área', jerarquia: 'ingenieria', responsable: supervisorDe(p, inc.area), fechaCompromiso: addDays(fecha, 10), estado: inc.estado === 'cerrado' ? 'cumplida' : 'pendiente' },
              { id: `${p.id}-m${i}b`, descripcion: 'Charla de reinstrucción al personal del área', jerarquia: 'administracion', responsable: p.empresa.prevencionista, fechaCompromiso: addDays(fecha, 5), estado: 'cumplida' },
            ],
            conclusion: inc.estado === 'cerrado' ? 'Se verifica implementación de medidas. Se cierra investigación.' : '',
            equipoInvestigador: `${p.empresa.prevencionista}, ${supervisorDe(p, inc.area)}, Comité Paritario`,
            fechaInicio: addDays(fecha, 1),
            cerradoPor: inc.estado === 'cerrado' ? p.empresa.prevencionista : undefined,
            fechaCierre: inc.estado === 'cerrado' ? addDays(fecha, 18) : undefined,
          }
        : undefined,
    };
  });

  // -------- Inspecciones --------
  const inspecciones: Inspeccion[] = [];
  const hallazgos: Hallazgo[] = [];
  PLANTILLAS.forEach((pl, pi) => {
    for (let k = 0; k < 3; k++) {
      const insId = `${p.id}-ins${pi}${k}`;
      const area = p.areas[(pi + k) % p.areas.length];
      const fecha = addDays(hoy, -(8 + k * 45 + pi * 11));
      const respuestas = pl.items.map((it, ii) => {
        const falla = (ii + k * 3 + pi) % 9 === 0;
        return { itemId: it.id, estado: (falla ? 'no_cumple' : ii % 11 === 5 ? 'na' : 'cumple') as 'cumple' | 'no_cumple' | 'na', observacion: falla ? 'Desviación detectada en terreno' : '' };
      });
      const aplicables = respuestas.filter((r) => r.estado !== 'na');
      const cumple = aplicables.filter((r) => r.estado === 'cumple').length;
      respuestas.forEach((r) => {
        if (r.estado === 'no_cumple') {
          const item = pl.items.find((i) => i.id === r.itemId)!;
          const hId = `${insId}-h${r.itemId}`;
          r.observacion = `No cumple: ${item.texto.toLowerCase()}`;
          (r as { hallazgoId?: string }).hallazgoId = hId;
          const cerrado = k > 0;
          hallazgos.push({
            id: hId,
            origen: 'inspeccion',
            origenId: insId,
            descripcion: `${item.texto} – no cumple (${pl.nombre})`,
            area,
            criticidad: (['alto', 'medio', 'bajo'] as Criticidad[])[(pi + k + hallazgos.length) % 3],
            responsable: supervisorDe(p, pi + k),
            fechaDeteccion: fecha,
            fechaCompromiso: addDays(fecha, 15),
            estado: cerrado ? 'cerrado' : 'abierto',
            planAccion: 'Corregir la desviación y verificar en próxima inspección.',
            planAprobado: cerrado,
            aprobadoPor: cerrado ? 'Gerencia de Operaciones' : undefined,
            fechaCierre: cerrado ? addDays(fecha, 12) : undefined,
            comentarioCierre: cerrado ? 'Corregido y verificado en terreno.' : undefined,
          });
        }
      });
      inspecciones.push({
        id: insId,
        plantillaId: pl.id,
        fecha,
        area,
        inspector: k === 0 ? p.empresa.prevencionista : supervisorDe(p, k),
        tarea: pl.id === 'ast' ? 'Mantención de equipo en altura' : undefined,
        equipoTrabajo: pl.id === 'ast' ? trabajadores.slice(0, 3).map((t) => t.nombre).join(', ') : undefined,
        respuestas,
        cumplimiento: aplicables.length ? Math.round((cumple / aplicables.length) * 100) : 100,
        firmaInspector: fakeSignature(k === 0 ? p.empresa.prevencionista : supervisorDe(p, k)),
        estado: 'finalizada',
      });
    }
  });

  p.hallazgos.forEach((h, i) => {
    const fecha = addDays(hoy, -h.diasAtras);
    hallazgos.push({
      id: `${p.id}-hm${i}`,
      origen: h.origen ?? 'manual',
      descripcion: h.desc,
      area: p.areas[h.area],
      criticidad: h.crit,
      responsable: supervisorDe(p, h.area),
      fechaDeteccion: fecha,
      fechaCompromiso: addDays(fecha, h.plazo),
      estado: h.estado,
      planAccion: h.plan,
      planAprobado: h.aprobado,
      aprobadoPor: h.aprobado ? 'Gerencia de Operaciones' : undefined,
      fechaCierre: h.estado === 'cerrado' ? addDays(fecha, Math.max(3, h.plazo - 2)) : undefined,
      comentarioCierre: h.estado === 'cerrado' ? 'Acción implementada y verificada.' : undefined,
    });
  });

  // -------- EPP --------
  const entregasEPP: EntregaEPP[] = [];
  trabajadores.forEach((t, ti) => {
    const cats = p.eppPorCargo[t.cargo] ?? p.eppPorCargo['*'] ?? ['Calzado de seguridad', 'Guantes'];
    cats.forEach((cat, ci) => {
      const info = CATEGORIAS_EPP.find((c) => c.categoria === cat)!;
      // Algunas entregas quedan vencidas o por vencer para poblar alertas
      const offset = (ti + ci) % 5 === 0 ? info.vidaUtilDias + 6 : (ti + ci) % 7 === 0 ? info.vidaUtilDias - 9 : Math.round(info.vidaUtilDias * 0.4);
      const fechaEntrega = addDays(hoy, -offset);
      entregasEPP.push({
        id: `${p.id}-epp${ti}-${ci}`,
        trabajadorId: t.id,
        categoria: cat,
        descripcion: cat,
        cantidad: cat === 'Guantes' ? 2 : 1,
        motivo: ci % 3 === 0 ? 'ingreso' : 'reposicion',
        fechaEntrega,
        fechaRenovacion: addDays(fechaEntrega, info.vidaUtilDias),
        entregadoPor: supervisorDe(p, ti),
        firma: fakeSignature(t.nombre),
      });
    });
  });

  // -------- IPER --------
  const iper: RiesgoIPER[] = p.iper.map((r, i) => ({
    id: `${p.id}-ip${i + 1}`,
    area: p.areas[r.area],
    proceso: r.proceso,
    tarea: r.tarea,
    rutinaria: r.rutinaria ?? true,
    peligro: r.peligro,
    riesgo: r.riesgo,
    probabilidad: r.p,
    consecuencia: r.c,
    controles: r.controles.map(([j, d], k): ControlIPER => ({ id: `${p.id}-ip${i}-c${k}`, jerarquia: j, descripcion: d })),
    responsable: supervisorDe(p, r.area),
    fechaRevision: addDays(hoy, -(30 + i * 9)),
  }));

  // -------- Protocolos MINSAL --------
  const protocolos: Protocolo[] = CODIGOS_PROTOCOLO.map((codigo) => {
    const cfg = p.protocolos[codigo] ?? { aplica: false, completadas: 0, expuestos: 0, mesesAtras: 0, obs: 'No aplica según evaluación cualitativa inicial.' };
    const info = PROTOCOLOS_INFO[codigo];
    const ultima = cfg.aplica ? addMonths(hoy, -cfg.mesesAtras) : '';
    return {
      codigo,
      aplica: cfg.aplica,
      responsable: p.empresa.prevencionista,
      ultimaEvaluacion: ultima,
      proximaEvaluacion: cfg.aplica ? addMonths(ultima, info.frecuenciaMeses) : '',
      trabajadoresExpuestos: cfg.expuestos,
      observaciones: cfg.obs,
      etapas: info.etapas.map((nombre, i) => ({ id: `${codigo}-${i}`, nombre, completada: i < cfg.completadas })),
    };
  });

  const extintores: Extintor[] = p.extintores.map((e, i) => ({
    id: `${p.id}-ext${i + 1}`,
    codigo: `EXT-${String(i + 1).padStart(3, '0')}`,
    ubicacion: e.ubicacion,
    tipo: e.tipo,
    capacidadKg: e.kg,
    fechaVencimiento: addDays(hoy, e.diasVence),
  }));

  return {
    id: p.id,
    esDemo: true,
    empresa: p.empresa,
    areas: p.areas,
    supervisores: p.supervisores,
    trabajadores,
    indicadores: { periodo: `Últimos 12 meses (a ${hoy.slice(0, 7)})`, ...p.indicadores },
    tasas: {
      cotizacionBasica: 0.9,
      cotizacionAdicionalDS110: p.tasas.adicional,
      cotizacionExtraordinaria: 0.03,
      tasaSiniestralidadDS67: p.tasas.siniestralidad,
      invalidecesYMuertes: p.tasas.invalideces,
      remuneracionImponibleMensual: p.tasas.remuneracion,
    },
    fechaUltimoAccidenteCTP: addDays(hoy, -p.diasDesdeUltimoCTP),
    recordDiasSinAccidentes: p.record,
    charlas,
    inspecciones,
    hallazgos,
    incidentes,
    entregasEPP,
    iper,
    protocolos,
    extintores,
  };
};

// ============================================================
// 1) Pyme Manufacturera / Alimentaria – Panificadora
// ============================================================
const panificadora: Perfil = {
  id: 'demo-panificadora',
  empresa: {
    nombre: 'Panificadora Don Cayetano',
    razonSocial: 'Panificadora Don Cayetano SpA',
    rut: '76.543.210-3',
    rubro: 'manufactura',
    giro: 'Elaboración de productos de panadería y pastelería',
    direccion: 'Av. Matta 1240',
    comuna: 'Santiago',
    region: 'Metropolitana',
    mutualidad: 'ACHS',
    representanteLegal: 'Cayetano Fuentes Rojas',
    prevencionista: 'María José Contreras',
    registroSeremi: 'RM-PR-04512',
  },
  areas: ['Producción / Hornos', 'Amasado', 'Envasado', 'Bodega', 'Mantención'],
  supervisores: ['Luis Pereira Soto', 'Carolina Vidal Muñoz'],
  trabajadores: [
    ['Juan Carlos Muñoz Díaz', 'Maestro panadero', 'Producción / Hornos'],
    ['Pedro Antonio Ramírez Lagos', 'Hornero', 'Producción / Hornos'],
    ['Rosa Elena Tapia Vera', 'Ayudante de producción', 'Producción / Hornos'],
    ['Francisco Javier Núñez Pino', 'Amasador', 'Amasado'],
    ['Camila Andrea Rojas Fuentes', 'Ayudante de amasado', 'Amasado'],
    ['Héctor Manuel Salinas Bravo', 'Amasador', 'Amasado'],
    ['Daniela Paz Ortiz Cárdenas', 'Envasadora', 'Envasado'],
    ['Marcela Ivonne Gómez Riquelme', 'Envasadora', 'Envasado'],
    ['Jorge Luis Castillo Henríquez', 'Bodeguero', 'Bodega'],
    ['Ricardo Esteban Pavez Soto', 'Operador de grúa horquilla', 'Bodega'],
    ['Patricio Andrés Lillo Araya', 'Técnico de mantención', 'Mantención'],
  ],
  temas: ['t-hornos', 't-mmc', 't-extintores', 't-cortes', 't-loto', 't-orden', 't-electrico', 't-pausas', 't-grua', 't-emergencia', 't-psico', 't-ruido'],
  diasDesdeUltimoCTP: 47,
  record: 212,
  indicadores: { promedioTrabajadores: 38, horasHombre: 85_120, accidentesCTP: 2, diasPerdidos: 19 },
  tasas: { adicional: 2.55, siniestralidad: 48, invalideces: 0, remuneracion: 32_500_000 },
  incidentes: [
    { tipo: 'accidente_ctp', diasAtras: 47, area: 0, desc: 'Quemadura de segundo grado en antebrazo derecho al retirar bandeja del horno rotativo sin guante térmico largo.', afectado: 1, dias: 12, parte: 'Brazo', estado: 'cerrado' },
    { tipo: 'accidente_ctp', diasAtras: 160, area: 1, desc: 'Atrapamiento leve de dedos en sobadora al limpiar rodillos con equipo energizado.', afectado: 3, dias: 7, parte: 'Mano / Dedos', estado: 'cerrado' },
    { tipo: 'cuasi_accidente', diasAtras: 9, area: 3, desc: 'Caída de saco de harina de 25 kg desde rack de segundo nivel; nadie transitaba bajo la carga.', estado: 'en_investigacion', investigar: true },
    { tipo: 'condicion_subestandar', diasAtras: 3, area: 2, desc: 'Piso con derrame de aceite cerca de la selladora, sin señalización.', estado: 'reportado' },
    { tipo: 'accidente_stp', diasAtras: 25, area: 2, desc: 'Corte superficial en dedo índice con cuchillo de cartonero al abrir cajas.', afectado: 6, parte: 'Mano / Dedos', estado: 'en_investigacion' },
  ],
  hallazgos: [
    { desc: 'Sobadora N°2 sin guarda en zona de rodillos', area: 1, crit: 'alto', diasAtras: 6, plazo: 7, estado: 'abierto', plan: 'Fabricar e instalar guarda fija con interlock de seguridad.', aprobado: false },
    { desc: 'Rack de bodega sin placa de capacidad de carga', area: 3, crit: 'medio', diasAtras: 30, plazo: 20, estado: 'en_proceso', plan: 'Solicitar placas al proveedor y rotular cada nivel.', aprobado: true },
    { desc: 'Botiquín de envasado incompleto', area: 2, crit: 'bajo', diasAtras: 40, plazo: 10, estado: 'cerrado', plan: 'Reponer insumos y asignar responsable de revisión mensual.', aprobado: true },
    { desc: 'Extensión eléctrica con unión expuesta en zona de hornos', area: 0, crit: 'alto', diasAtras: 20, plazo: 5, estado: 'abierto', plan: 'Retirar extensión e instalar enchufe fijo industrial.', aprobado: true },
  ],
  iper: [
    { area: 0, proceso: 'Horneado', tarea: 'Carga y descarga de horno rotativo', peligro: 'Superficies calientes (>200 °C)', riesgo: 'Quemaduras', p: 4, c: 2, controles: [['ingenieria', 'Carro porta bandejas con manilla aislada'], ['epp', 'Guante térmico largo y delantal aluminizado']] },
    { area: 1, proceso: 'Amasado', tarea: 'Operación de sobadora', peligro: 'Partes móviles (rodillos)', riesgo: 'Atrapamiento de extremidades', p: 2, c: 4, controles: [['ingenieria', 'Guarda con interlock y parada de emergencia'], ['administracion', 'Procedimiento LOTO para limpieza']] },
    { area: 1, proceso: 'Amasado', tarea: 'Carga de harina a amasadora', peligro: 'Sacos de 25 kg', riesgo: 'Sobreesfuerzo / lumbago', p: 4, c: 2, controles: [['ingenieria', 'Alzador de sacos'], ['administracion', 'Capacitación MMC Ley 20.949']] },
    { area: 1, proceso: 'Amasado', tarea: 'Dosificación de harina', peligro: 'Polvo de harina en suspensión', riesgo: 'Asma ocupacional / rinitis', p: 2, c: 2, controles: [['ingenieria', 'Campana de extracción localizada'], ['epp', 'Mascarilla N95']] },
    { area: 2, proceso: 'Envasado', tarea: 'Sellado de bolsas', peligro: 'Movimientos repetitivos', riesgo: 'TMERT extremidades superiores', p: 2, c: 2, controles: [['administracion', 'Rotación de puestos cada 2 horas y pausas activas']] },
    { area: 3, proceso: 'Almacenamiento', tarea: 'Operación de grúa horquilla', peligro: 'Vehículo en movimiento', riesgo: 'Atropello / choque', p: 2, c: 4, controles: [['ingenieria', 'Demarcación de pasillos peatonales'], ['administracion', 'Operador con licencia clase D']] },
    { area: 4, proceso: 'Mantención', tarea: 'Reparación de tableros eléctricos', peligro: 'Energía eléctrica', riesgo: 'Contacto eléctrico / electrocución', p: 1, c: 4, controles: [['administracion', 'Sólo personal con licencia SEC'], ['epp', 'Guantes dieléctricos clase 0']] , rutinaria: false },
  ],
  protocolos: {
    TMERT: { aplica: true, completadas: 4, expuestos: 14, mesesAtras: 10, obs: 'Envasado presenta condición crítica en tarea de sellado manual.' },
    MMC: { aplica: true, completadas: 3, expuestos: 9, mesesAtras: 14, obs: 'Sacos de harina de 25 kg; evaluar alzador mecánico.' },
    PREXOR: { aplica: true, completadas: 2, expuestos: 6, mesesAtras: 22, obs: 'Dosimetría pendiente en zona de amasadoras.' },
    PSICOSOCIAL: { aplica: true, completadas: 5, expuestos: 38, mesesAtras: 8, obs: 'CEAL-SM aplicado; riesgo medio en dimensión carga de trabajo.' },
  },
  extintores: [
    { ubicacion: 'Zona hornos – muro norte', tipo: 'PQS ABC', kg: 10, diasVence: 12 },
    { ubicacion: 'Cocina / freidoras', tipo: 'Clase K', kg: 6, diasVence: 140 },
    { ubicacion: 'Tablero eléctrico general', tipo: 'CO2', kg: 5, diasVence: -4 },
    { ubicacion: 'Bodega de harina', tipo: 'PQS ABC', kg: 10, diasVence: 210 },
    { ubicacion: 'Envasado – acceso', tipo: 'PQS ABC', kg: 6, diasVence: 25 },
  ],
  eppPorCargo: {
    'Maestro panadero': ['Calzado de seguridad', 'Guantes', 'Ropa de trabajo'],
    Hornero: ['Calzado de seguridad', 'Guantes', 'Ropa de trabajo', 'Antiparras / Lentes'],
    Amasador: ['Calzado de seguridad', 'Respirador / Mascarilla', 'Protección auditiva'],
    'Operador de grúa horquilla': ['Calzado de seguridad', 'Chaleco reflectante', 'Guantes'],
    'Técnico de mantención': ['Calzado de seguridad', 'Guantes', 'Antiparras / Lentes', 'Protección auditiva'],
    '*': ['Calzado de seguridad', 'Guantes', 'Ropa de trabajo'],
  },
};

// ============================================================
// 2) Agroindustria & Packing Exportador
// ============================================================
const packing: Perfil = {
  id: 'demo-packing',
  empresa: {
    nombre: 'Frutícola Valle del Cachapoal',
    razonSocial: 'Exportadora Frutícola Valle del Cachapoal S.A.',
    rut: '96.812.450-1',
    rubro: 'agroindustria',
    giro: 'Packing y exportación de fruta fresca',
    direccion: 'Ruta H-30 Km 12, Parcela 8',
    comuna: 'Rengo',
    region: "O'Higgins",
    mutualidad: 'Mutual de Seguridad CChC',
    representanteLegal: 'Andrés Valenzuela Correa',
    prevencionista: 'Felipe Ignacio Sepúlveda',
    registroSeremi: 'VI-PR-01877',
  },
  areas: ['Recepción de fruta', 'Línea de proceso', 'Cámaras de frío', 'Despacho', 'Huerto / Cosecha', 'Bodega de agroquímicos'],
  supervisores: ['Claudia Soto Aravena', 'Rodrigo Figueroa Pinto', 'Ximena Leiva Cáceres'],
  trabajadores: [
    ['María Angélica Flores Toro', 'Seleccionadora', 'Línea de proceso'],
    ['Yesenia del Carmen Rojas Leiva', 'Embaladora', 'Línea de proceso'],
    ['Josefina Ignacia Pérez Morales', 'Embaladora', 'Línea de proceso'],
    ['Luis Alberto Campos Reyes', 'Operador de grúa horquilla', 'Despacho'],
    ['Sergio Iván Moya Gallardo', 'Operador de grúa horquilla', 'Cámaras de frío'],
    ['Manuel Jesús Arancibia Cid', 'Camarero (frío)', 'Cámaras de frío'],
    ['Carlos Eduardo Retamal Sanhueza', 'Recepcionista de fruta', 'Recepción de fruta'],
    ['Nelson Hernán Torres Vásquez', 'Paletizador', 'Despacho'],
    ['Gloria Estela Bustos Peña', 'Temporera cosechadora', 'Huerto / Cosecha'],
    ['Wilson Antonio Jara Molina', 'Temporero cosechador', 'Huerto / Cosecha'],
    ['Raúl Osvaldo Garrido Soto', 'Aplicador de agroquímicos', 'Bodega de agroquímicos'],
    ['Mónica Alejandra Lagos Ruiz', 'Control de calidad', 'Línea de proceso'],
  ],
  temas: ['t-grua', 't-frio', 't-agroquimicos', 't-uv', 't-mmc', 't-pausas', 't-cortes', 't-extintores', 't-loto', 't-orden', 't-emergencia', 't-psico', 't-electrico', 't-altura'],
  diasDesdeUltimoCTP: 18,
  record: 156,
  indicadores: { promedioTrabajadores: 214, horasHombre: 462_240, accidentesCTP: 9, diasPerdidos: 131 },
  tasas: { adicional: 2.04, siniestralidad: 72, invalideces: 0, remuneracion: 158_000_000 },
  incidentes: [
    { tipo: 'accidente_ctp', diasAtras: 18, area: 3, desc: 'Atrapamiento de pie de paletizador por rueda de grúa horquilla en maniobra de retroceso en andén 3.', afectado: 7, dias: 15, parte: 'Pie', estado: 'en_investigacion', investigar: true },
    { tipo: 'accidente_ctp', diasAtras: 75, area: 4, desc: 'Caída a mismo nivel de cosechadora en hilera con riego reciente; esguince de tobillo.', afectado: 8, dias: 10, parte: 'Pierna', estado: 'cerrado' },
    { tipo: 'accidente_trayecto', diasAtras: 120, area: 1, desc: 'Accidente en bus de acercamiento de temporeros; contusiones leves.', afectado: 1, dias: 4, parte: 'Múltiple', estado: 'cerrado' },
    { tipo: 'cuasi_accidente', diasAtras: 4, area: 2, desc: 'Puerta de cámara 4 se cerró con trabajador dentro; alarma de hombre atrapado no funcionó, abrió con manilla interior.', estado: 'reportado' },
    { tipo: 'cuasi_accidente', diasAtras: 12, area: 5, desc: 'Envase de plaguicida sin etiqueta encontrado fuera de bodega.', estado: 'en_investigacion', investigar: true },
    { tipo: 'condicion_subestandar', diasAtras: 2, area: 1, desc: 'Cinta transportadora de calibrado con guarda suelta.', estado: 'reportado' },
  ],
  hallazgos: [
    { desc: 'Alarma de hombre atrapado de cámara 4 inoperativa', area: 2, crit: 'alto', diasAtras: 4, plazo: 3, estado: 'abierto', plan: 'Reparar alarma y probar semanalmente todas las cámaras.', aprobado: false },
    { desc: 'Pasillo peatonal de despacho sin demarcación', area: 3, crit: 'alto', diasAtras: 16, plazo: 10, estado: 'en_proceso', plan: 'Pintar demarcación amarilla y barreras físicas en andenes.', aprobado: true },
    { desc: 'Falta sombreadero en zona de colación del huerto', area: 4, crit: 'medio', diasAtras: 35, plazo: 15, estado: 'abierto', plan: 'Instalar malla raschel 80% en área de 30 m².', aprobado: true },
    { desc: 'Ducha de emergencia de bodega de agroquímicos sin presión', area: 5, crit: 'alto', diasAtras: 50, plazo: 7, estado: 'cerrado', plan: 'Reparar válvula y probar mensualmente.', aprobado: true },
    { desc: 'Baños químicos en huerto sin lavamanos', area: 4, crit: 'medio', diasAtras: 60, plazo: 10, estado: 'cerrado', plan: 'Exigir al proveedor módulo con lavamanos (DS 594 Art. 24).', aprobado: true },
  ],
  iper: [
    { area: 1, proceso: 'Selección y embalaje', tarea: 'Selección de fruta en línea', peligro: 'Movimientos repetitivos', riesgo: 'TMERT extremidades superiores', p: 4, c: 2, controles: [['administracion', 'Rotación cada 2 horas y pausas activas'], ['ingenieria', 'Sillas ergonómicas regulables']] },
    { area: 1, proceso: 'Selección y embalaje', tarea: 'Limpieza de calibradora', peligro: 'Partes móviles de cintas', riesgo: 'Atrapamiento', p: 2, c: 4, controles: [['administracion', 'Procedimiento LOTO'], ['ingenieria', 'Guardas fijas']] , rutinaria: false },
    { area: 2, proceso: 'Frío', tarea: 'Ingreso y estiba en cámaras', peligro: 'Bajas temperaturas (-1 °C)', riesgo: 'Hipotermia / estrés térmico por frío', p: 2, c: 2, controles: [['epp', 'Ropa térmica completa'], ['administracion', 'Pausas de recuperación térmica']] },
    { area: 2, proceso: 'Frío', tarea: 'Uso de túneles de gasificación', peligro: 'Atmósfera con SO2', riesgo: 'Intoxicación', p: 1, c: 4, controles: [['ingenieria', 'Detectores de gas fijos'], ['epp', 'Máscara full face con filtro']] },
    { area: 3, proceso: 'Despacho', tarea: 'Carga de contenedores', peligro: 'Grúa horquilla en movimiento', riesgo: 'Atropello / atrapamiento', p: 4, c: 4, controles: [['ingenieria', 'Sensor de proximidad y cámara de retroceso'], ['administracion', 'Segregación de peatones']] },
    { area: 4, proceso: 'Cosecha', tarea: 'Cosecha manual en altura con escalera', peligro: 'Trabajo sobre escalera', riesgo: 'Caída de distinto nivel', p: 2, c: 2, controles: [['administracion', 'Escaleras tipo tijera de 3 patas certificadas']] },
    { area: 4, proceso: 'Cosecha', tarea: 'Labores al aire libre', peligro: 'Radiación UV solar', riesgo: 'Quemaduras / cáncer de piel', p: 4, c: 2, controles: [['epp', 'Bloqueador FPS50, legionario y lentes UV'], ['administracion', 'Publicación diaria del índice UV']] },
    { area: 5, proceso: 'Sanidad vegetal', tarea: 'Preparación de mezclas de plaguicidas', peligro: 'Sustancias tóxicas', riesgo: 'Intoxicación aguda', p: 2, c: 4, controles: [['sustitucion', 'Uso de productos de menor categoría toxicológica'], ['epp', 'Traje Tyvek, respirador y guantes nitrilo']] },
  ],
  protocolos: {
    TMERT: { aplica: true, completadas: 6, expuestos: 120, mesesAtras: 6, obs: 'Implementado en línea de embalaje.' },
    MMC: { aplica: true, completadas: 4, expuestos: 45, mesesAtras: 12, obs: 'Cajas de exportación de 8,2 kg; paletizado manual en revisión.' },
    PREXOR: { aplica: true, completadas: 1, expuestos: 30, mesesAtras: 28, obs: 'Evaluación vencida en sala de calibradoras – PRIORITARIO.' },
    PSICOSOCIAL: { aplica: true, completadas: 2, expuestos: 214, mesesAtras: 26, obs: 'CEAL-SM vencido. Protocolo Ley Karin publicado.' },
  },
  extintores: [
    { ubicacion: 'Línea de proceso – cabecera', tipo: 'PQS ABC', kg: 10, diasVence: 60 },
    { ubicacion: 'Sala de máquinas de frío', tipo: 'CO2', kg: 10, diasVence: 8 },
    { ubicacion: 'Andén de despacho 1', tipo: 'PQS ABC', kg: 10, diasVence: -15 },
    { ubicacion: 'Bodega de agroquímicos', tipo: 'PQS ABC', kg: 10, diasVence: 190 },
    { ubicacion: 'Carga de baterías grúas', tipo: 'CO2', kg: 5, diasVence: 22 },
    { ubicacion: 'Oficinas', tipo: 'PQS ABC', kg: 6, diasVence: 300 },
  ],
  eppPorCargo: {
    Seleccionadora: ['Calzado de seguridad', 'Guantes', 'Ropa de trabajo'],
    Embaladora: ['Calzado de seguridad', 'Guantes', 'Ropa de trabajo'],
    'Operador de grúa horquilla': ['Calzado de seguridad', 'Chaleco reflectante', 'Ropa térmica'],
    'Camarero (frío)': ['Calzado de seguridad', 'Ropa térmica', 'Guantes'],
    'Aplicador de agroquímicos': ['Respirador / Mascarilla', 'Guantes', 'Antiparras / Lentes', 'Ropa de trabajo'],
    'Temporera cosechadora': ['Calzado de seguridad', 'Guantes', 'Antiparras / Lentes'],
    'Temporero cosechador': ['Calzado de seguridad', 'Guantes', 'Antiparras / Lentes'],
    '*': ['Calzado de seguridad', 'Guantes', 'Chaleco reflectante'],
  },
};

// ============================================================
// 3) Construcción & Servicios Industriales
// ============================================================
const constructora: Perfil = {
  id: 'demo-constructora',
  empresa: {
    nombre: 'Constructora Andes Sur',
    razonSocial: 'Constructora y Servicios Industriales Andes Sur Ltda.',
    rut: '77.215.880-7',
    rubro: 'construccion',
    giro: 'Obras civiles, montaje industrial y mantención',
    direccion: 'Calle Los Carrera 2850, Oficina 401',
    comuna: 'Concepción',
    region: 'Biobío',
    mutualidad: 'Mutual de Seguridad CChC',
    representanteLegal: 'Gonzalo Herrera Saavedra',
    prevencionista: 'Valentina Paz Muñoz',
    registroSeremi: 'VIII-PR-02391',
  },
  areas: ['Obra gruesa', 'Terminaciones', 'Montaje estructural', 'Excavaciones', 'Instalaciones eléctricas', 'Bodega / Pañol'],
  supervisores: ['Jaime Arriagada Toledo', 'Óscar Vergara Silva', 'Paula Sandoval Rivas'],
  trabajadores: [
    ['Cristián Alejandro Bustamante Ruiz', 'Maestro albañil', 'Obra gruesa'],
    ['Luis Fernando Quezada Parra', 'Jornal', 'Obra gruesa'],
    ['José Miguel Riquelme Ortega', 'Carpintero', 'Obra gruesa'],
    ['Eduardo Andrés Mella Fierro', 'Soldador calificado', 'Montaje estructural'],
    ['Marco Antonio Gutiérrez Lobos', 'Rigger', 'Montaje estructural'],
    ['Iván Patricio Sáez Navarro', 'Operador de retroexcavadora', 'Excavaciones'],
    ['Ramón Segundo Valdés Alarcón', 'Jornal', 'Excavaciones'],
    ['Felipe Andrés Tapia Zúñiga', 'Electricista SEC clase B', 'Instalaciones eléctricas'],
    ['Andrea Carolina Medina Vega', 'Pintora', 'Terminaciones'],
    ['Sebastián Ignacio Pizarro Lara', 'Ceramista', 'Terminaciones'],
    ['Hugo Antonio Cifuentes Rebolledo', 'Pañolero', 'Bodega / Pañol'],
    ['Diego Matías Herrera Fuentealba', 'Andamiero', 'Obra gruesa'],
  ],
  temas: ['t-altura', 't-andamios', 't-excavaciones', 't-silice', 't-electrico', 't-uv', 't-mmc', 't-orden', 't-extintores', 't-loto', 't-ruido', 't-emergencia', 't-psico', 't-pausas'],
  diasDesdeUltimoCTP: 104,
  record: 341,
  indicadores: { promedioTrabajadores: 86, horasHombre: 195_000, accidentesCTP: 3, diasPerdidos: 58 },
  tasas: { adicional: 2.55, siniestralidad: 61, invalideces: 0, remuneracion: 74_000_000 },
  incidentes: [
    { tipo: 'accidente_ctp', diasAtras: 104, area: 0, desc: 'Caída desde andamio de 2,4 m sin baranda intermedia; fractura de muñeca.', afectado: 11, dias: 35, parte: 'Brazo', estado: 'cerrado' },
    { tipo: 'accidente_ctp', diasAtras: 230, area: 2, desc: 'Proyección de partícula metálica en ojo izquierdo durante esmerilado.', afectado: 3, dias: 5, parte: 'Ojos', estado: 'cerrado' },
    { tipo: 'cuasi_accidente', diasAtras: 7, area: 2, desc: 'Caída de grillete desde 8 m durante izaje de viga; área segregada evitó lesiones.', estado: 'en_investigacion', investigar: true },
    { tipo: 'cuasi_accidente', diasAtras: 15, area: 3, desc: 'Desprendimiento de talud en zanja de 1,8 m sin entibación.', estado: 'en_investigacion', investigar: true },
    { tipo: 'condicion_subestandar', diasAtras: 1, area: 4, desc: 'Tablero provisorio de faena sin tapa ni diferencial.', estado: 'reportado' },
    { tipo: 'accidente_stp', diasAtras: 33, area: 1, desc: 'Golpe en mano con martillo durante colocación de cerámica.', afectado: 9, parte: 'Mano / Dedos', estado: 'cerrado' },
  ],
  hallazgos: [
    { desc: 'Andamio en eje C sin tarjeta de inspección', area: 0, crit: 'alto', diasAtras: 3, plazo: 2, estado: 'abierto', plan: 'Inspeccionar y rotular con tarjeta verde/roja antes de uso.', aprobado: false },
    { desc: 'Zanja de alcantarillado sin barreras perimetrales', area: 3, crit: 'alto', diasAtras: 15, plazo: 3, estado: 'en_proceso', plan: 'Instalar barreras New Jersey y señalización nocturna.', aprobado: true },
    { desc: 'Corte de cerámica en seco sin extracción (sílice)', area: 1, crit: 'alto', diasAtras: 22, plazo: 10, estado: 'abierto', plan: 'Adquirir cortadora con agua y respiradores P100.', aprobado: false },
    { desc: 'Pañol sin hoja de datos de seguridad de solventes', area: 5, crit: 'medio', diasAtras: 45, plazo: 15, estado: 'cerrado', plan: 'Solicitar HDS a proveedores y archivar en carpeta visible.', aprobado: true },
    { desc: 'Baños de faena sin mantención diaria', area: 0, crit: 'bajo', diasAtras: 10, plazo: 7, estado: 'en_proceso', plan: 'Exigir bitácora de limpieza al contratista sanitario.', aprobado: true },
  ],
  iper: [
    { area: 0, proceso: 'Obra gruesa', tarea: 'Trabajo en andamios sobre 1,8 m', peligro: 'Trabajo en altura', riesgo: 'Caída de distinto nivel', p: 2, c: 4, controles: [['ingenieria', 'Andamios certificados con barandas completas'], ['epp', 'Arnés con doble cola y absorbedor']] },
    { area: 0, proceso: 'Obra gruesa', tarea: 'Hormigonado de losas', peligro: 'Cemento / hormigón fresco', riesgo: 'Dermatitis de contacto', p: 2, c: 1, controles: [['epp', 'Guantes de nitrilo y botas de goma']] },
    { area: 2, proceso: 'Montaje', tarea: 'Izaje de estructuras con grúa', peligro: 'Carga suspendida', riesgo: 'Golpe / aplastamiento', p: 2, c: 4, controles: [['administracion', 'Plan de izaje y rigger certificado'], ['ingenieria', 'Segregación del radio de izaje']] , rutinaria: false },
    { area: 2, proceso: 'Montaje', tarea: 'Soldadura al arco', peligro: 'Radiación UV / humos metálicos', riesgo: 'Conjuntivitis / intoxicación', p: 4, c: 2, controles: [['ingenieria', 'Extracción localizada de humos'], ['epp', 'Careta fotosensible y respirador']] },
    { area: 3, proceso: 'Excavaciones', tarea: 'Excavación de zanjas > 1,5 m', peligro: 'Inestabilidad de taludes', riesgo: 'Sepultamiento', p: 2, c: 4, controles: [['ingenieria', 'Entibación metálica'], ['administracion', 'Inspección diaria por competente']] },
    { area: 1, proceso: 'Terminaciones', tarea: 'Corte de cerámica y hormigón', peligro: 'Polvo con sílice cristalina', riesgo: 'Silicosis', p: 4, c: 4, controles: [['ingenieria', 'Corte por vía húmeda'], ['epp', 'Respirador con filtro P100']] },
    { area: 4, proceso: 'Instalaciones', tarea: 'Conexión de tableros provisorios', peligro: 'Energía eléctrica', riesgo: 'Electrocución', p: 1, c: 4, controles: [['administracion', 'Electricista SEC y LOTO'], ['epp', 'Guantes dieléctricos']] },
    { area: 5, proceso: 'Logística', tarea: 'Descarga manual de materiales', peligro: 'Cargas sobre 25 kg', riesgo: 'Lesión lumbar', p: 2, c: 2, controles: [['ingenieria', 'Carros y transpaletas'], ['administracion', 'Capacitación MMC']] },
  ],
  protocolos: {
    MMC: { aplica: true, completadas: 5, expuestos: 40, mesesAtras: 9, obs: 'Implementado. Sacos de cemento de 25 kg.' },
    PREXOR: { aplica: true, completadas: 3, expuestos: 25, mesesAtras: 15, obs: 'Audiometrías al día en Mutual CChC.' },
    PLANESI: { aplica: true, completadas: 2, expuestos: 18, mesesAtras: 20, obs: 'Corte de cerámica en seco detectado; pendiente evaluación cuantitativa.' },
    PSICOSOCIAL: { aplica: true, completadas: 4, expuestos: 86, mesesAtras: 11, obs: 'Plan de intervención en ejecución.' },
    TMERT: { aplica: true, completadas: 1, expuestos: 12, mesesAtras: 30, obs: 'Lista de chequeo realizada sólo para ceramistas.' },
  },
  extintores: [
    { ubicacion: 'Instalación de faena – oficina', tipo: 'PQS ABC', kg: 6, diasVence: 95 },
    { ubicacion: 'Bodega de combustibles', tipo: 'PQS ABC', kg: 10, diasVence: -30 },
    { ubicacion: 'Grúa torre – cabina', tipo: 'PQS ABC', kg: 6, diasVence: 18 },
    { ubicacion: 'Taller de soldadura', tipo: 'CO2', kg: 10, diasVence: 5 },
    { ubicacion: 'Pañol', tipo: 'PQS ABC', kg: 10, diasVence: 150 },
  ],
  eppPorCargo: {
    'Soldador calificado': ['Casco', 'Calzado de seguridad', 'Guantes', 'Respirador / Mascarilla', 'Antiparras / Lentes'],
    Andamiero: ['Casco', 'Calzado de seguridad', 'Arnés de seguridad', 'Guantes'],
    Rigger: ['Casco', 'Calzado de seguridad', 'Arnés de seguridad', 'Chaleco reflectante'],
    Ceramista: ['Casco', 'Calzado de seguridad', 'Respirador / Mascarilla', 'Protección auditiva'],
    '*': ['Casco', 'Calzado de seguridad', 'Guantes', 'Antiparras / Lentes', 'Chaleco reflectante'],
  },
};

export const DEMO_PERFILES = [panificadora, packing, constructora];

export const buildDemoCompanies = (): Record<string, CompanyData> => {
  const out: Record<string, CompanyData> = {};
  DEMO_PERFILES.forEach((p) => {
    out[p.id] = buildCompany(p);
  });
  return out;
};

/** Empresa vacía para que el usuario la configure desde cero */
export const buildEmptyCompany = (id: string, nombre: string, rubro: Empresa['rubro']): CompanyData => {
  const hoy = todayISO();
  return {
    id,
    esDemo: false,
    empresa: {
      nombre,
      razonSocial: nombre,
      rut: '',
      rubro,
      giro: '',
      direccion: '',
      comuna: '',
      region: 'Metropolitana',
      mutualidad: 'ACHS',
      representanteLegal: '',
      prevencionista: '',
      registroSeremi: '',
    },
    areas: ['Administración', 'Operaciones'],
    supervisores: [],
    trabajadores: [],
    indicadores: { periodo: `Año ${hoy.slice(0, 4)}`, promedioTrabajadores: 0, horasHombre: 0, accidentesCTP: 0, diasPerdidos: 0 },
    tasas: { cotizacionBasica: 0.9, cotizacionAdicionalDS110: 0, cotizacionExtraordinaria: 0.03, tasaSiniestralidadDS67: 0, invalidecesYMuertes: 0, remuneracionImponibleMensual: 0 },
    fechaUltimoAccidenteCTP: hoy,
    recordDiasSinAccidentes: 0,
    charlas: [],
    inspecciones: [],
    hallazgos: [],
    incidentes: [],
    entregasEPP: [],
    iper: [],
    protocolos: CODIGOS_PROTOCOLO.map((codigo) => ({
      codigo,
      aplica: false,
      responsable: '',
      ultimaEvaluacion: '',
      proximaEvaluacion: '',
      trabajadoresExpuestos: 0,
      observaciones: '',
      etapas: PROTOCOLOS_INFO[codigo].etapas.map((nombre, i) => ({ id: `${codigo}-${i}`, nombre, completada: false })),
    })),
    extintores: [],
  };
};
