import type { Charla, CompanyData } from '../types';
import { formatDate } from './date';
import { formatDateTime, hashFirma } from './verification';
import { TIPO_CHARLA_LABEL } from '../data/catalogos';

const cell = (v: unknown) => {
  const s = String(v ?? '');
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV con BOM UTF-8 y separador ';' (Excel en configuración regional es-CL lo abre directo) */
const toCSV = (rows: unknown[][]) => '﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n');

const download = (content: string, filename: string) => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const HEAD = ['Sesión', 'Tipo', 'Fecha', 'Hora', 'Tema', 'Área', 'Relator', 'N°', 'Nombre', 'RUT', 'Cargo', 'Firmado en', 'Huella firma', 'Hash acta'];

const filas = (c: Charla) =>
  c.asistentes.map((a, i) => [
    c.sesionId ?? c.id,
    TIPO_CHARLA_LABEL[c.tipo],
    formatDate(c.fecha),
    c.hora,
    c.tema,
    c.area,
    c.relator,
    i + 1,
    a.nombre,
    a.rut,
    a.cargo,
    formatDateTime(a.firmadoEn),
    hashFirma(a.firma),
    (c.hash ?? '').slice(0, 16).toUpperCase(),
  ]);

export const exportarAsistenciaCSV = (company: CompanyData, c: Charla) =>
  download(toCSV([[`${company.empresa.razonSocial} - RUT ${company.empresa.rut}`], HEAD, ...filas(c)]), `asistencia-${c.sesionId ?? c.id}.csv`);

export const exportarTodasCSV = (company: CompanyData, charlas: Charla[]) =>
  download(toCSV([[`${company.empresa.razonSocial} - RUT ${company.empresa.rut}`], HEAD, ...charlas.flatMap(filas)]), `asistencia-consolidada-${company.empresa.nombre.replace(/\W+/g, '-').toLowerCase()}.csv`);
