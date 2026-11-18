import type { Indicadores, TasasLegales } from '../types';

export interface ResultadoIndicadores {
  tasaAccidentabilidad: number;
  indiceFrecuencia: number;
  indiceGravedad: number;
  tasaSiniestralidad: number;
  promedioDiasPorAccidente: number;
}

const safe = (n: number) => (Number.isFinite(n) ? n : 0);

/** Indicadores legales: tasas de accidentabilidad (DS 44, arts. 73 a 75) y siniestralidad (DS 67) */
export const calcularIndicadores = (i: Indicadores): ResultadoIndicadores => ({
  // Tasa de Accidentabilidad = (Accidentes CTP / Promedio Trabajadores) × 100
  tasaAccidentabilidad: safe(i.promedioTrabajadores > 0 ? (i.accidentesCTP / i.promedioTrabajadores) * 100 : 0),
  // Índice de Frecuencia = (Accidentes CTP × 1.000.000) / HH trabajadas
  indiceFrecuencia: safe(i.horasHombre > 0 ? (i.accidentesCTP * 1_000_000) / i.horasHombre : 0),
  // Índice de Gravedad = (Días Perdidos × 1.000.000) / HH trabajadas
  indiceGravedad: safe(i.horasHombre > 0 ? (i.diasPerdidos * 1_000_000) / i.horasHombre : 0),
  // Tasa de Siniestralidad por Incapacidades Temporales (DS 67) = (Días Perdidos / Promedio Trabajadores) × 100
  tasaSiniestralidad: safe(i.promedioTrabajadores > 0 ? (i.diasPerdidos / i.promedioTrabajadores) * 100 : 0),
  promedioDiasPorAccidente: safe(i.accidentesCTP > 0 ? i.diasPerdidos / i.accidentesCTP : 0),
});

/**
 * Tabla del artículo 5° del DS 67/1999 (Ministerio del Trabajo): cotización adicional por
 * siniestralidad efectiva según la tasa de siniestralidad total. Cada fila es
 * [límite superior de la tasa, cotización adicional %]. Texto oficial:
 * https://isl.gob.cl/wp-content/uploads/2024/08/D.S-N-67.pdf
 * Verificada contra el decreto el 17-nov-2026; el decreto fue modificado por el DS 7/2021,
 * por lo que conviene reconfirmar si SUSESO publica una nueva tabla.
 */
const TABLA_DS67: Array<[number, number]> = [
  [32, 0], [64, 0.34], [96, 0.68], [128, 1.02], [160, 1.36], [192, 1.7], [224, 2.04], [272, 2.38], [320, 2.72],
  [368, 3.06], [416, 3.4], [464, 3.74], [512, 4.08], [560, 4.42], [630, 4.76], [700, 5.1], [770, 5.44],
  [840, 5.78], [910, 6.12], [980, 6.46],
];

export const cotizacionAdicionalDS67 = (tasaTotal: number): number => {
  // El decreto expresa los tramos en números enteros: se redondea la tasa antes de buscar el tramo
  const tasa = Math.round(tasaTotal);
  for (const [max, cot] of TABLA_DS67) if (tasa <= max) return cot;
  return 6.8; // 981 y más
};

export interface ResultadoTasas {
  tasaSiniestralidadTotal: number;
  adicionalDS67: number;
  totalDS110: number;
  totalDS67: number;
  costoMensualDS110: number;
  costoMensualDS67: number;
  diferenciaAnual: number;
}

export const calcularTasas = (t: TasasLegales): ResultadoTasas => {
  const tasaSiniestralidadTotal = t.tasaSiniestralidadDS67 + t.invalidecesYMuertes;
  const adicionalDS67 = cotizacionAdicionalDS67(tasaSiniestralidadTotal);
  const totalDS110 = t.cotizacionBasica + t.cotizacionAdicionalDS110 + t.cotizacionExtraordinaria;
  const totalDS67 = t.cotizacionBasica + adicionalDS67 + t.cotizacionExtraordinaria;
  const costoMensualDS110 = (t.remuneracionImponibleMensual * totalDS110) / 100;
  const costoMensualDS67 = (t.remuneracionImponibleMensual * totalDS67) / 100;
  return {
    tasaSiniestralidadTotal,
    adicionalDS67,
    totalDS110,
    totalDS67,
    costoMensualDS110,
    costoMensualDS67,
    diferenciaAnual: (costoMensualDS67 - costoMensualDS110) * 12,
  };
};

export const fmtNum = (n: number, dec = 2): string =>
  n.toLocaleString('es-CL', { minimumFractionDigits: dec, maximumFractionDigits: dec });

export const fmtCLP = (n: number): string =>
  n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

/** VEP = Probabilidad × Consecuencia (metodología IPER mutualidades) */
export const calcularVEP = (p: number, c: number): number => p * c;

export type NivelRiesgo = 'Tolerable' | 'Moderado' | 'Importante' | 'Intolerable';

export const nivelVEP = (vep: number): NivelRiesgo => {
  if (vep <= 2) return 'Tolerable';
  if (vep === 4) return 'Moderado';
  if (vep === 8) return 'Importante';
  return 'Intolerable';
};
