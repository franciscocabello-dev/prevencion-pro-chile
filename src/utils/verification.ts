import type { Charla, CompanyData, DocumentoGenerado } from '../types';
import { sha256 } from './sha256';
import { uid } from './id';

/** Identificador de sesión legible: SES-AAAAMMDD-XXXXXX */
export const nuevoSesionId = (fechaISO: string): string => `SES-${fechaISO.replace(/-/g, '').slice(0, 8)}-${uid().slice(-6).toUpperCase()}`;

/** Sello SHA-256 sobre el contenido y TODAS las firmas de una charla */
export const hashCharla = (c: Pick<Charla, 'sesionId' | 'tipo' | 'tema' | 'contenido' | 'fecha' | 'hora' | 'relator' | 'firmaRelator' | 'asistentes' | 'cerradaEn'>): string =>
  sha256(
    JSON.stringify({
      s: c.sesionId,
      t: c.tipo,
      tema: c.tema,
      cont: c.contenido,
      f: `${c.fecha}T${c.hora}`,
      r: c.relator,
      fr: sha256(c.firmaRelator || ''),
      a: c.asistentes.map((a) => [a.rut, a.nombre, a.firmadoEn ?? '', sha256(a.firma || '')]),
      c: c.cerradaEn ?? '',
    }),
  );

export const hashDocumento = (d: Omit<DocumentoGenerado, 'hash'>): string =>
  sha256(JSON.stringify({ s: d.sesionId, t: d.titulo, b: d.cuerpo, w: d.trabajadorRut, e: d.emisor, c: d.creadoEn, ft: sha256(d.firmaTrabajador || ''), fe: sha256(d.firmaEmisor || '') }));

/** Hash corto de una firma individual para la tabla consolidada */
export const hashFirma = (dataUrl: string): string => (dataUrl ? sha256(dataUrl).slice(0, 12).toUpperCase() : '—');

// ------------------------------------------------------------
// Payload del QR: autocontenido para verificar incluso en otro dispositivo
// ------------------------------------------------------------
export interface PayloadQR {
  v: 1;
  id: string; // sesión
  k: 'charla' | 'doc';
  emp: string; // RUT empresa
  tit: string; // tema o título
  ts: string; // fecha-hora exacta de cierre
  rel: string; // relator / emisor
  n: number; // n° firmantes
  h: string; // hash (16 primeros caracteres)
}

const b64urlEncode = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlDecode = (s: string) => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return new TextDecoder().decode(Uint8Array.from(b, (ch) => ch.charCodeAt(0)));
};

export const encodePayload = (p: PayloadQR): string => b64urlEncode(JSON.stringify(p));

export const decodePayload = (s: string): PayloadQR | null => {
  try {
    const p = JSON.parse(b64urlDecode(s));
    return p && p.v === 1 && typeof p.id === 'string' ? (p as PayloadQR) : null;
  } catch {
    return null;
  }
};

const baseUrl = () => (typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : 'https://prevencionpro.cl/');

export const urlVerificacion = (p: PayloadQR): string => `${baseUrl()}#/verificar?d=${encodePayload(p)}`;

export const payloadCharla = (company: CompanyData, c: Charla): PayloadQR => ({
  v: 1,
  id: c.sesionId ?? c.id,
  k: 'charla',
  emp: company.empresa.rut,
  tit: c.tema.slice(0, 60),
  ts: c.cerradaEn ?? `${c.fecha}T${c.hora}`,
  rel: c.relator,
  n: c.asistentes.length,
  h: (c.hash ?? hashCharla(c)).slice(0, 16),
});

export const payloadDocumento = (company: CompanyData, d: DocumentoGenerado): PayloadQR => ({
  v: 1,
  id: d.sesionId,
  k: 'doc',
  emp: company.empresa.rut,
  tit: d.titulo.slice(0, 60),
  ts: d.creadoEn,
  rel: d.emisor,
  n: d.firmaTrabajador ? 1 : 0,
  h: d.hash.slice(0, 16),
});

export const formatDateTime = (iso?: string): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).replace(',', '');
};
