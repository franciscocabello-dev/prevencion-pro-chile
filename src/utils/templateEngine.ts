import type { CompanyData, Trabajador } from '../types';
import { formatLongDate, todayISO } from './date';

export interface VariableDef {
  key: string;
  descripcion: string;
  ejemplo: string;
}

/** Variables soportadas por el editor de plantillas */
export const VARIABLES: VariableDef[] = [
  { key: 'NOMBRE_TRABAJADOR', descripcion: 'Nombre completo del trabajador', ejemplo: 'Juan Carlos Muñoz Díaz' },
  { key: 'RUT_TRABAJADOR', descripcion: 'RUT del trabajador', ejemplo: '12.345.678-5' },
  { key: 'CARGO', descripcion: 'Cargo del trabajador', ejemplo: 'Maestro panadero' },
  { key: 'AREA', descripcion: 'Área / centro de trabajo', ejemplo: 'Producción' },
  { key: 'FECHA_INGRESO', descripcion: 'Fecha de ingreso del trabajador', ejemplo: '1 de marzo de 2024' },
  { key: 'EMPRESA', descripcion: 'Razón social de la empresa', ejemplo: 'Empresa SpA' },
  { key: 'RUT_EMPRESA', descripcion: 'RUT de la empresa', ejemplo: '76.543.210-3' },
  { key: 'DIRECCION_EMPRESA', descripcion: 'Dirección y comuna', ejemplo: 'Av. Matta 1240, Santiago' },
  { key: 'MUTUALIDAD', descripcion: 'Organismo administrador Ley 16.744', ejemplo: 'ACHS' },
  { key: 'REPRESENTANTE_LEGAL', descripcion: 'Representante legal', ejemplo: 'Nombre Apellido' },
  { key: 'PREVENCIONISTA', descripcion: 'Experto en prevención', ejemplo: 'Nombre Apellido' },
  { key: 'RELATOR', descripcion: 'Quien emite / dicta el documento', ejemplo: 'Nombre Apellido' },
  { key: 'FECHA', descripcion: 'Fecha del documento (larga)', ejemplo: '17 de noviembre de 2026' },
  { key: 'TEMA', descripcion: 'Tema o materia', ejemplo: 'Uso de extintores' },
];

export interface ContextoPlantilla {
  company: CompanyData;
  trabajador?: Pick<Trabajador, 'nombre' | 'rut' | 'cargo' | 'area'> & { fechaIngreso?: string };
  relator?: string;
  fecha?: string;
  tema?: string;
  area?: string;
}

export const valoresVariables = (ctx: ContextoPlantilla): Record<string, string> => {
  const e = ctx.company.empresa;
  const t = ctx.trabajador;
  return {
    NOMBRE_TRABAJADOR: t?.nombre ?? 'los trabajadores firmantes',
    RUT_TRABAJADOR: t?.rut ?? '(ver registro de asistencia)',
    CARGO: t?.cargo ?? '(según registro)',
    AREA: ctx.area ?? t?.area ?? '',
    FECHA_INGRESO: t?.fechaIngreso ? formatLongDate(t.fechaIngreso) : '',
    EMPRESA: e.razonSocial || e.nombre,
    RUT_EMPRESA: e.rut,
    DIRECCION_EMPRESA: [e.direccion, e.comuna].filter(Boolean).join(', '),
    MUTUALIDAD: e.mutualidad,
    REPRESENTANTE_LEGAL: e.representanteLegal,
    PREVENCIONISTA: e.prevencionista,
    RELATOR: ctx.relator ?? '',
    FECHA: formatLongDate(ctx.fecha ?? todayISO()),
    TEMA: ctx.tema ?? '',
  };
};

const RE = /\{\{\s*([A-Z_]+)\s*\}\}/g;

/** Reemplaza {{VARIABLE}} por su valor; las desconocidas se dejan intactas */
export const renderPlantilla = (texto: string, ctx: ContextoPlantilla): string => {
  const v = valoresVariables(ctx);
  return texto.replace(RE, (m, key: string) => (key in v ? v[key] : m));
};

/** Variables usadas en el texto que no existen en el catálogo */
export const variablesDesconocidas = (texto: string): string[] => {
  const known = new Set(VARIABLES.map((x) => x.key));
  return [...new Set([...texto.matchAll(RE)].map((m) => m[1]).filter((k) => !known.has(k)))];
};
