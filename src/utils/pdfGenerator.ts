import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import type { Charla, CompanyData, DocumentoGenerado, EntregaEPP, Hallazgo, Incidente, Inspeccion, PlanEmergencia, PlantillaChecklist, ProgramaTrabajo, Trabajador, Visita } from '../types';
import { formatDateTime, hashCharla, hashFirma, payloadCharla, payloadDocumento, urlVerificacion } from './verification';
import { CATEGORIA_PLANTILLA_LABEL } from '../data/plantillas';
import { CONSECUENCIA_LABEL, JERARQUIA_LABEL, PROBABILIDAD_LABEL, PROTOCOLOS_INFO, RUBRO_LABEL, TIPO_CHARLA_LABEL, TIPO_INCIDENTE_LABEL } from '../data/catalogos';
import { formatDate, formatLongDate, todayISO } from './date';
import { calcularIndicadores, calcularTasas, calcularVEP, fmtCLP, fmtNum, nivelVEP } from './indicators';
import type { Alerta } from '../services/alerts';
import { ESTADO_LABEL, dotacionEmpresa, NIVEL_EVIDENCIA_LABEL, evaluarFuf, nivelPreparacion, resumenPorBloque } from './cumplimientoDs44';
import { TAMANO_LABEL } from '../data/fufDs44';
import { ESTADO_COMPROMISO_LABEL } from './visitas';
import { ESCENARIO_LABEL, FLUJO_ESPECIFICO, estimarEvacuacion, fmtSeg, simulacrosOrdenados } from './emergencias';
import { ESTADO_ACTIVIDAD_LABEL, ORIGEN_LABEL, ORIGEN_ORDEN, avancePrograma } from './programa';

// ------------------------------------------------------------
// Paleta corporativa
// ------------------------------------------------------------
type RGB = [number, number, number];
const NAVY: RGB = [15, 23, 42];
const SLATE: RGB = [100, 116, 139];
const LIGHT: RGB = [241, 245, 249];
const BORDER: RGB = [203, 213, 225];
const OK: RGB = [16, 185, 129];
const WARN: RGB = [245, 158, 11];
const CRIT: RGB = [239, 68, 68];

/** Las fuentes estándar de jsPDF usan WinAnsi: normalizamos caracteres fuera de rango */
const t = (s: unknown): string =>
  String(s ?? '')
    .replace(/[–—]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/•/g, '-')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/×/g, 'x')
    .replace(/…/g, '...')
    .replace(/[^\x00-\xFF]/g, '');

export interface Column<T> {
  header: string;
  width: number; // proporción relativa
  value?: (row: T, i: number) => string;
  image?: (row: T) => string | undefined;
  align?: 'left' | 'center' | 'right';
  color?: (row: T) => RGB | undefined;
}

export interface VerificacionPDF {
  url: string;
  sesionId: string;
  ts: string; // ISO fecha-hora exacta
  hash: string;
}

/** Dibuja un QR vectorial (nítido a cualquier escala) directamente en jsPDF */
const drawQR = (doc: jsPDF, text: string, x: number, y: number, size: number) => {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const n = qr.modules.size;
  const quiet = 2;
  const cell = size / (n + quiet * 2);
  doc.setFillColor(255, 255, 255);
  doc.rect(x, y, size, size, 'F');
  doc.setFillColor(0, 0, 0);
  for (let r = 0; r < n; r++) {
    let c = 0;
    while (c < n) {
      if (qr.modules.get(r, c)) {
        let run = 1;
        while (c + run < n && qr.modules.get(r, c + run)) run++;
        // pequeño solape evita líneas blancas por antialiasing del visor
        doc.rect(x + (quiet + c) * cell, y + (quiet + r) * cell, run * cell + 0.02, cell + 0.02, 'F');
        c += run;
      } else c++;
    }
  }
};

class PdfDoc {
  doc: jsPDF;
  y = 0;
  verificacion?: VerificacionPDF;
  readonly margin = 14;
  readonly pageW: number;
  readonly pageH: number;
  private readonly company: CompanyData;
  private readonly title: string;
  private readonly code: string;

  constructor(company: CompanyData, title: string, code: string, orientation: 'p' | 'l' = 'p', verificacion?: VerificacionPDF) {
    this.verificacion = verificacion;
    this.doc = new jsPDF({ orientation, unit: 'mm', format: 'letter' });
    this.pageW = this.doc.internal.pageSize.getWidth();
    this.pageH = this.doc.internal.pageSize.getHeight();
    this.company = company;
    this.title = title;
    this.code = code;
    this.header();
  }

  get contentW() {
    return this.pageW - this.margin * 2;
  }

  /** Límite inferior útil (el pie con QR ocupa más espacio) */
  get bottom() {
    return this.pageH - (this.verificacion ? 26 : 16);
  }

  header() {
    const d = this.doc;
    const e = this.company.empresa;
    d.setFillColor(...NAVY);
    d.rect(0, 0, this.pageW, 26, 'F');
    // Escudo / logo
    d.setFillColor(...OK);
    d.roundedRect(this.margin, 5, 16, 16, 2, 2, 'F');
    d.setFillColor(255, 255, 255);
    d.rect(this.margin + 7, 8, 2.2, 10, 'F');
    d.rect(this.margin + 3, 11.9, 10, 2.2, 'F');

    d.setTextColor(255, 255, 255);
    d.setFont('helvetica', 'bold');
    d.setFontSize(12);
    d.text(t(e.razonSocial || e.nombre), this.margin + 20, 10.5);
    d.setFont('helvetica', 'normal');
    d.setFontSize(8);
    d.text(t(`RUT ${e.rut || 'S/I'}  |  ${e.giro || RUBRO_LABEL[e.rubro]}`), this.margin + 20, 15);
    d.text(t(`${[e.direccion, e.comuna, e.region].filter(Boolean).join(', ')}  |  Organismo administrador: ${e.mutualidad}`), this.margin + 20, 19.2);

    d.setFont('helvetica', 'bold');
    d.setFontSize(8);
    d.text('PrevenciónPro Chile', this.pageW - this.margin, 10.5, { align: 'right' });
    d.setFont('helvetica', 'normal');
    d.text(t(this.code), this.pageW - this.margin, 15, { align: 'right' });
    d.text(t(`Emitido: ${formatDate(todayISO())}`), this.pageW - this.margin, 19.2, { align: 'right' });

    d.setTextColor(...NAVY);
    d.setFont('helvetica', 'bold');
    d.setFontSize(14);
    d.text(t(this.title), this.margin, 35);
    d.setDrawColor(...OK);
    d.setLineWidth(0.8);
    d.line(this.margin, 37.5, this.margin + 30, 37.5);
    this.y = 44;
  }

  footer() {
    const d = this.doc;
    const total = d.getNumberOfPages();
    const v = this.verificacion;
    for (let i = 1; i <= total; i++) {
      d.setPage(i);
      d.setDrawColor(...BORDER);
      d.setLineWidth(0.2);
      const lineY = this.pageH - (v ? 22 : 12);
      d.line(this.margin, lineY, this.pageW - this.margin, lineY);
      d.setFont('helvetica', 'normal');
      d.setFontSize(7);
      d.setTextColor(...SLATE);
      if (v) {
        const qrSize = 17;
        drawQR(d, v.url, this.pageW - this.margin - qrSize, lineY + 2, qrSize);
        d.setFont('helvetica', 'bold');
        d.setTextColor(...NAVY);
        d.text(t(`Sesión ${v.sesionId}`), this.margin, lineY + 5);
        d.setFont('helvetica', 'normal');
        d.setTextColor(...SLATE);
        d.text(t(`Cierre: ${formatDateTime(v.ts)}  |  Sello SHA-256: ${v.hash.slice(0, 32).toUpperCase()}`), this.margin, lineY + 9);
        d.text(t('Escanee el código QR para verificar la autenticidad e integridad de este documento.'), this.margin, lineY + 13);
        d.text(t('Generado por PrevenciónPro Chile conforme a Ley 16.744 y DS 44. Firma electrónica simple (Ley 19.799).'), this.margin, lineY + 17);
        d.text(`Página ${i} de ${total}`, this.pageW - this.margin - qrSize - 3, lineY + 17, { align: 'right' });
      } else {
        d.text(
          t(`Documento generado por PrevenciónPro Chile conforme a Ley 16.744 y DS 44. Firmas electrónicas simples capturadas en dispositivo (Ley 19.799).`),
          this.margin,
          this.pageH - 8,
        );
        d.text(`Página ${i} de ${total}`, this.pageW - this.margin, this.pageH - 8, { align: 'right' });
      }
    }
  }

  /** Bloque final de verificación: QR grande, sello y firma del relator */
  verificationBlock(relator: { nombre: string; cargo: string; firma?: string }, extra: [string, string][] = []) {
    const v = this.verificacion;
    if (!v) return;
    const d = this.doc;
    // Título + bloque + URL deben quedar juntos en la misma página
    this.ensure(70);
    this.section('Verificación y sello de la sesión');
    const top = this.y;
    const qr = 40;
    d.setDrawColor(...BORDER);
    d.setLineWidth(0.3);
    d.roundedRect(this.margin, top, this.contentW, qr + 4, 2, 2, 'S');
    drawQR(d, v.url, this.margin + 2, top + 2, qr);
    const x = this.margin + qr + 7;
    const colW = (this.pageW - this.margin - x) / 2;
    const kv: [string, string][] = [['ID de sesión', v.sesionId], ['Fecha y hora exacta de cierre', formatDateTime(v.ts)], ...extra];
    let yy = top + 6;
    kv.forEach(([k, val]) => {
      d.setFont('helvetica', 'bold');
      d.setFontSize(6.5);
      d.setTextColor(...SLATE);
      d.text(t(k.toUpperCase()), x, yy);
      d.setFont('helvetica', 'normal');
      d.setFontSize(8.5);
      d.setTextColor(...NAVY);
      d.text(t(val), x, yy + 3.8);
      yy += 8.6;
    });
    d.setFont('helvetica', 'bold');
    d.setFontSize(6.5);
    d.setTextColor(...SLATE);
    d.text('SELLO SHA-256 (CONTENIDO + FIRMAS)', x, yy);
    d.setFont('courier', 'normal');
    d.setFontSize(7);
    d.setTextColor(...NAVY);
    d.text(v.hash.slice(0, 32).toUpperCase(), x, yy + 3.6);
    d.text(v.hash.slice(32).toUpperCase(), x, yy + 7);
    // Firma del relator a la derecha
    const fx = x + colW + 4;
    d.setFont('helvetica', 'bold');
    d.setFontSize(6.5);
    d.setTextColor(...SLATE);
    d.text('FIRMA DEL RELATOR', fx, top + 6);
    if (relator.firma) {
      try {
        d.addImage(relator.firma, 'PNG', fx, top + 8, colW - 6, 18);
      } catch {
        /* firma ilegible */
      }
    }
    d.setDrawColor(...NAVY);
    d.line(fx, top + 28, fx + colW - 6, top + 28);
    d.setFont('helvetica', 'bold');
    d.setFontSize(8.5);
    d.setTextColor(...NAVY);
    d.text(t(relator.nombre), fx, top + 32);
    d.setFont('helvetica', 'normal');
    d.setFontSize(7.5);
    d.setTextColor(...SLATE);
    d.text(t(relator.cargo), fx, top + 35.5);
    d.text(t(`Huella firma: ${hashFirma(relator.firma ?? '')}`), fx, top + 39);
    this.y = top + qr + 8;
    d.setFont('helvetica', 'normal');
    d.setFontSize(6.5);
    d.setTextColor(...SLATE);
    const urlLines = d.splitTextToSize(t(`Verificación: ${v.url}`), this.contentW);
    d.text(urlLines.slice(0, 2), this.margin, this.y);
    this.y += 8;
  }

  ensure(h: number) {
    if (this.y + h > this.bottom) {
      this.doc.addPage();
      this.y = 16;
    }
  }

  section(title: string) {
    this.ensure(14);
    const d = this.doc;
    d.setFillColor(...LIGHT);
    d.rect(this.margin, this.y, this.contentW, 7, 'F');
    d.setFillColor(...NAVY);
    d.rect(this.margin, this.y, 1.4, 7, 'F');
    d.setFont('helvetica', 'bold');
    d.setFontSize(9.5);
    d.setTextColor(...NAVY);
    d.text(t(title.toUpperCase()), this.margin + 4, this.y + 4.9);
    this.y += 10;
  }

  /** Grilla de pares etiqueta / valor */
  keyValues(pairs: [string, string][], cols = 2) {
    const d = this.doc;
    const colW = this.contentW / cols;
    for (let i = 0; i < pairs.length; i += cols) {
      const row = pairs.slice(i, i + cols);
      const heights = row.map(([, v]) => d.setFontSize(9).splitTextToSize(t(v || '-'), colW - 4).length);
      const h = Math.max(...heights) * 4 + 6;
      this.ensure(h);
      row.forEach(([k, v], j) => {
        const x = this.margin + j * colW;
        d.setFont('helvetica', 'bold');
        d.setFontSize(7);
        d.setTextColor(...SLATE);
        d.text(t(k.toUpperCase()), x, this.y + 2);
        d.setFont('helvetica', 'normal');
        d.setFontSize(9);
        d.setTextColor(...NAVY);
        d.text(d.splitTextToSize(t(v || '-'), colW - 4), x, this.y + 6);
      });
      this.y += h;
    }
    this.y += 1;
  }

  paragraph(text: string, size = 9) {
    const d = this.doc;
    d.setFont('helvetica', 'normal');
    d.setFontSize(size);
    d.setTextColor(...NAVY);
    const lines = d.splitTextToSize(t(text || '-'), this.contentW);
    lines.forEach((line: string) => {
      this.ensure(5);
      d.text(line, this.margin, this.y + 3);
      this.y += size * 0.45;
    });
    this.y += 3;
  }

  bullets(items: string[]) {
    items.filter(Boolean).forEach((it) => this.paragraph(`- ${it}`));
  }

  table<T>(cols: Column<T>[], rows: T[], opts: { rowMinH?: number; imageH?: number; fontSize?: number } = {}) {
    const d = this.doc;
    const fs = opts.fontSize ?? 8;
    const totalW = cols.reduce((a, c) => a + c.width, 0);
    const widths = cols.map((c) => (c.width / totalW) * this.contentW);
    const drawHead = () => {
      this.ensure(9);
      d.setFillColor(...NAVY);
      d.rect(this.margin, this.y, this.contentW, 7, 'F');
      d.setFont('helvetica', 'bold');
      d.setFontSize(fs);
      d.setTextColor(255, 255, 255);
      let x = this.margin;
      cols.forEach((c, i) => {
        d.text(t(c.header), x + 1.8, this.y + 4.7);
        x += widths[i];
      });
      this.y += 7;
    };
    drawHead();
    if (!rows.length) {
      d.setFont('helvetica', 'italic');
      d.setFontSize(fs);
      d.setTextColor(...SLATE);
      d.text('Sin registros', this.margin + 2, this.y + 5);
      this.y += 8;
      return;
    }
    rows.forEach((row, ri) => {
      d.setFont('helvetica', 'normal');
      d.setFontSize(fs);
      const cells = cols.map((c, i) => (c.value ? d.splitTextToSize(t(c.value(row, ri)), widths[i] - 3.6) : []));
      const hasImg = cols.some((c) => c.image);
      const textH = Math.max(...cells.map((l) => l.length)) * fs * 0.42 + 4;
      const h = Math.max(opts.rowMinH ?? 7, textH, hasImg ? (opts.imageH ?? 12) + 3 : 0);
      if (this.y + h > this.bottom) {
        d.addPage();
        this.y = 16;
        drawHead();
        d.setFont('helvetica', 'normal');
        d.setFontSize(fs);
      }
      if (ri % 2 === 1) {
        d.setFillColor(248, 250, 252);
        d.rect(this.margin, this.y, this.contentW, h, 'F');
      }
      let x = this.margin;
      cols.forEach((c, i) => {
        const color = c.color?.(row);
        if (color) {
          d.setFillColor(...color);
          d.rect(x + 0.6, this.y + 0.6, widths[i] - 1.2, h - 1.2, 'F');
          d.setTextColor(255, 255, 255);
          d.setFont('helvetica', 'bold');
        } else {
          d.setTextColor(...NAVY);
          d.setFont('helvetica', 'normal');
        }
        if (c.image) {
          const src = c.image(row);
          if (src) {
            try {
              const ih = opts.imageH ?? 12;
              const iw = Math.min(widths[i] - 4, ih * 2.75);
              d.addImage(src, src.startsWith('data:image/png') ? 'PNG' : 'JPEG', x + 2, this.y + 1.5, iw, ih);
            } catch {
              d.text('[firma]', x + 2, this.y + 5);
            }
          } else {
            d.setTextColor(...CRIT);
            d.text('Sin firma', x + 2, this.y + 5);
          }
        } else {
          const align = c.align ?? 'left';
          const tx = align === 'center' ? x + widths[i] / 2 : align === 'right' ? x + widths[i] - 1.8 : x + 1.8;
          d.text(cells[i], tx, this.y + 4.5, { align });
        }
        x += widths[i];
      });
      d.setDrawColor(...BORDER);
      d.setLineWidth(0.15);
      d.line(this.margin, this.y + h, this.margin + this.contentW, this.y + h);
      this.y += h;
    });
    this.y += 4;
  }

  signatures(blocks: { label: string; name: string; image?: string }[]) {
    const d = this.doc;
    this.ensure(40);
    const w = this.contentW / blocks.length;
    blocks.forEach((b, i) => {
      const x = this.margin + i * w;
      if (b.image) {
        try {
          d.addImage(b.image, 'PNG', x + w / 2 - 25, this.y, 50, 18);
        } catch {
          /* firma no legible */
        }
      }
      d.setDrawColor(...NAVY);
      d.setLineWidth(0.3);
      d.line(x + 8, this.y + 21, x + w - 8, this.y + 21);
      d.setFont('helvetica', 'bold');
      d.setFontSize(8.5);
      d.setTextColor(...NAVY);
      d.text(t(b.name || '________________'), x + w / 2, this.y + 25.5, { align: 'center' });
      d.setFont('helvetica', 'normal');
      d.setFontSize(7.5);
      d.setTextColor(...SLATE);
      d.text(t(b.label), x + w / 2, this.y + 29.5, { align: 'center' });
    });
    this.y += 35;
  }

  image(src: string, maxW = 80, maxH = 60) {
    try {
      const props = this.doc.getImageProperties(src);
      const ratio = Math.min(maxW / props.width, maxH / props.height);
      const w = props.width * ratio;
      const h = props.height * ratio;
      this.ensure(h + 4);
      this.doc.addImage(src, props.fileType, this.margin, this.y, w, h);
      this.y += h + 4;
    } catch {
      this.paragraph('[Imagen no disponible]');
    }
  }

  kpiBoxes(items: { label: string; value: string; color: RGB }[]) {
    const d = this.doc;
    this.ensure(22);
    const gap = 3;
    const w = (this.contentW - gap * (items.length - 1)) / items.length;
    items.forEach((it, i) => {
      const x = this.margin + i * (w + gap);
      d.setFillColor(...LIGHT);
      d.roundedRect(x, this.y, w, 18, 1.5, 1.5, 'F');
      d.setFillColor(...it.color);
      d.rect(x, this.y, 1.4, 18, 'F');
      d.setFont('helvetica', 'normal');
      d.setFontSize(7);
      d.setTextColor(...SLATE);
      d.text(d.splitTextToSize(t(it.label.toUpperCase()), w - 6), x + 4, this.y + 4.5);
      d.setFont('helvetica', 'bold');
      d.setFontSize(13);
      d.setTextColor(...NAVY);
      d.text(t(it.value), x + 4, this.y + 15);
    });
    this.y += 23;
  }

  save(filename: string) {
    this.footer();
    this.doc.save(filename);
  }
}

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 40);

// ============================================================
// 1. Acta de Charla / Capacitación / ODI
// ============================================================
export const generarActaCharla = (company: CompanyData, ch: Charla) => {
  const titulo = ch.tipo === 'odi' ? 'Registro de Obligación de Informar (ODI)' : ch.tipo === 'capacitacion' ? 'Acta de Capacitación' : 'Acta de Charla de 5 Minutos';
  const hash = ch.hash ?? hashCharla(ch);
  const sesionId = ch.sesionId ?? ch.id;
  const verificacion: VerificacionPDF = { url: urlVerificacion(payloadCharla(company, { ...ch, hash })), sesionId, ts: ch.cerradaEn ?? `${ch.fecha}T${ch.hora}:00`, hash };
  const p = new PdfDoc(company, titulo, `Sesión ${sesionId}`, 'p', verificacion);
  p.section('Antecedentes de la actividad');
  p.keyValues(
    [
      ['Tipo de actividad', TIPO_CHARLA_LABEL[ch.tipo]],
      ['Fecha y hora', `${formatLongDate(ch.fecha)} - ${ch.hora} hrs`],
      ['Tema tratado', ch.tema],
      ['Duración', `${ch.duracionMin} minutos`],
      ['Área / Lugar', ch.area],
      ['N° de asistentes', String(ch.asistentes.length)],
      ['Relator', ch.relator],
      ['Cargo relator', ch.cargoRelator],
      ['Inicio de sesión', formatDateTime(ch.iniciadaEn)],
      ['Cierre de sesión', formatDateTime(ch.cerradaEn)],
    ],
    2,
  );
  p.section('Contenido tratado');
  p.paragraph(ch.contenido);
  if (ch.tipo === 'odi') {
    p.paragraph(
      'En cumplimiento del artículo 15 del DS 44/2024, el empleador informa oportuna y convenientemente a los trabajadores acerca de los riesgos que entrañan sus labores, las medidas preventivas y los métodos de trabajo correctos.',
      8,
    );
  }
  p.section('Tabla consolidada de firmantes');
  p.table(
    [
      { header: 'N°', width: 4, value: (_, i) => String(i + 1), align: 'center' },
      { header: 'Nombre completo', width: 23, value: (a) => a.nombre },
      { header: 'RUT', width: 12, value: (a) => a.rut },
      { header: 'Cargo', width: 13, value: (a) => a.cargo },
      { header: 'Firmado en', width: 13, value: (a) => formatDateTime(a.firmadoEn) },
      { header: 'Huella', width: 14, value: (a) => hashFirma(a.firma) },
      { header: 'Firma', width: 21, image: (a) => a.firma },
    ],
    ch.asistentes,
    { imageH: 10, rowMinH: 13, fontSize: 7.5 },
  );
  p.paragraph(
    'Los trabajadores firmantes declaran haber recibido y comprendido la información entregada, comprometiéndose a cumplir las medidas preventivas indicadas.',
    8,
  );
  p.verificationBlock({ nombre: ch.relator, cargo: ch.cargoRelator, firma: ch.firmaRelator }, [['Firmantes', `${ch.asistentes.length} trabajador(es) + relator`]]);
  p.save(`acta-${ch.tipo}-${ch.fecha}-${slug(ch.tema)}.pdf`);
};

// ============================================================
// 1b. Documento desde plantilla (EPP, ODI, Procedimiento, Amonestación…)
// ============================================================
export const generarDocumentoPlantilla = (company: CompanyData, doc: DocumentoGenerado) => {
  const verificacion: VerificacionPDF = { url: urlVerificacion(payloadDocumento(company, doc)), sesionId: doc.sesionId, ts: doc.creadoEn, hash: doc.hash };
  const p = new PdfDoc(company, doc.titulo, `${CATEGORIA_PLANTILLA_LABEL[doc.categoria]} · ${doc.sesionId}`, 'p', verificacion);
  p.section('Identificación');
  p.keyValues([
    ['Trabajador', doc.trabajadorNombre],
    ['RUT', doc.trabajadorRut],
    ['Cargo', doc.trabajadorCargo],
    ['Área', doc.area],
    ['Emitido por', `${doc.emisor} (${doc.cargoEmisor})`],
    ['Fecha y hora', formatDateTime(doc.creadoEn)],
  ]);
  p.section(CATEGORIA_PLANTILLA_LABEL[doc.categoria]);
  doc.cuerpo.split(/\n{2,}/).forEach((par) => p.paragraph(par, 9.5));
  p.signatures([
    { label: `Trabajador · RUT ${doc.trabajadorRut}`, name: doc.trabajadorNombre, image: doc.firmaTrabajador || undefined },
    { label: doc.cargoEmisor, name: doc.emisor, image: doc.firmaEmisor || undefined },
  ]);
  p.verificationBlock({ nombre: doc.emisor, cargo: doc.cargoEmisor, firma: doc.firmaEmisor }, [['Firmante', `${doc.trabajadorNombre} · huella ${hashFirma(doc.firmaTrabajador)}`]]);
  p.save(`${doc.categoria}-${slug(doc.trabajadorNombre)}-${doc.creadoEn.slice(0, 10)}.pdf`);
};

// ============================================================
// 2. Informe de Inspección / Checklist / AST
// ============================================================
export const generarInformeInspeccion = (company: CompanyData, ins: Inspeccion, pl: PlantillaChecklist, hallazgos: Hallazgo[]) => {
  const p = new PdfDoc(company, `Informe: ${pl.nombre}`, `Inspección ${ins.id.slice(-8).toUpperCase()}`);
  p.section('Antecedentes');
  const kv: [string, string][] = [
    ['Fecha', formatLongDate(ins.fecha)],
    ['Área inspeccionada', ins.area],
    ['Inspector', ins.inspector],
    ['Normativa de referencia', pl.norma],
  ];
  if (ins.tarea) kv.push(['Tarea crítica', ins.tarea]);
  if (ins.equipoTrabajo) kv.push(['Equipo de trabajo', ins.equipoTrabajo]);
  p.keyValues(kv);
  const nc = ins.respuestas.filter((r) => r.estado === 'no_cumple').length;
  const c = ins.respuestas.filter((r) => r.estado === 'cumple').length;
  const na = ins.respuestas.filter((r) => r.estado === 'na').length;
  p.kpiBoxes([
    { label: '% Cumplimiento', value: `${ins.cumplimiento}%`, color: ins.cumplimiento >= 85 ? OK : ins.cumplimiento >= 70 ? WARN : CRIT },
    { label: 'Cumple', value: String(c), color: OK },
    { label: 'No cumple', value: String(nc), color: CRIT },
    { label: 'No aplica', value: String(na), color: SLATE },
  ]);
  p.section('Resultado por ítem');
  const rows = pl.items.map((it) => ({ it, r: ins.respuestas.find((x) => x.itemId === it.id) }));
  p.table(
    [
      { header: 'Sección', width: 18, value: (x) => x.it.seccion },
      { header: 'Ítem verificado', width: 45, value: (x) => `${x.it.texto}${x.it.referencia ? ` (${x.it.referencia})` : ''}` },
      {
        header: 'Estado',
        width: 12,
        align: 'center',
        value: (x) => (x.r?.estado === 'cumple' ? 'CUMPLE' : x.r?.estado === 'no_cumple' ? 'NO CUMPLE' : x.r?.estado === 'na' ? 'N/A' : '-'),
        color: (x) => (x.r?.estado === 'cumple' ? OK : x.r?.estado === 'no_cumple' ? CRIT : undefined),
      },
      { header: 'Observación', width: 25, value: (x) => x.r?.observacion || '' },
    ],
    rows,
    { fontSize: 7.5 },
  );
  if (hallazgos.length) {
    p.section('Hallazgos generados');
    p.table(
      [
        { header: 'Descripción', width: 40, value: (h) => h.descripcion },
        { header: 'Criticidad', width: 12, value: (h) => h.criticidad.toUpperCase(), color: (h) => (h.criticidad === 'alto' ? CRIT : h.criticidad === 'medio' ? WARN : OK), align: 'center' },
        { header: 'Responsable', width: 20, value: (h) => h.responsable },
        { header: 'Compromiso', width: 13, value: (h) => formatDate(h.fechaCompromiso) },
        { header: 'Estado', width: 12, value: (h) => h.estado.replace('_', ' ') },
      ],
      hallazgos,
    );
    hallazgos.filter((h) => h.foto).forEach((h) => {
      p.paragraph(`Evidencia: ${h.descripcion}`, 8);
      p.image(h.foto!, 70, 50);
    });
  }
  p.signatures([
    { label: 'Inspector', name: ins.inspector, image: ins.firmaInspector },
    { label: 'Jefe de Área', name: '' },
  ]);
  p.save(`inspeccion-${pl.id}-${ins.fecha}-${slug(ins.area)}.pdf`);
};

// ============================================================
// 3. Informe de Investigación de Incidente
// ============================================================
export const generarInformeInvestigacion = (company: CompanyData, inc: Incidente) => {
  const p = new PdfDoc(company, 'Informe de Investigación de Incidente', `Folio #${inc.folio}`);
  p.section('1. Antecedentes del evento');
  p.keyValues([
    ['Tipo de evento', TIPO_INCIDENTE_LABEL[inc.tipo]],
    ['Fecha y hora', `${formatLongDate(inc.fecha)} - ${inc.hora} hrs`],
    ['Área', inc.area],
    ['Reportado por', inc.reportadoPor],
    ['Trabajador afectado', inc.afectado ? `${inc.afectado} (${inc.rutAfectado ?? 's/RUT'})` : 'No aplica'],
    ['Parte del cuerpo', inc.parteCuerpo || 'No aplica'],
    ['Días perdidos', String(inc.diasPerdidos)],
    ['DIAT emitida', inc.diatEmitida ? 'Sí' : 'No'],
  ]);
  p.section('2. Descripción');
  p.paragraph(inc.descripcion);
  if (inc.foto) p.image(inc.foto, 80, 55);
  const inv = inc.investigacion;
  if (inv) {
    p.section('3. Análisis: metodología 5 Porqués');
    inv.porques.forEach((q, i) => q && p.paragraph(`¿Por qué ${i + 1}? ${q}`));
    p.section('4. Causas inmediatas');
    p.keyValues([
      ['Acciones subestándar', inv.causasInmediatas.acciones.join('; ') || 'No identificadas'],
      ['Condiciones subestándar', inv.causasInmediatas.condiciones.join('; ') || 'No identificadas'],
    ], 1);
    p.section('5. Causas básicas');
    p.keyValues([
      ['Factores personales', inv.causasBasicas.personales.join('; ') || 'No identificados'],
      ['Factores del trabajo', inv.causasBasicas.trabajo.join('; ') || 'No identificados'],
    ], 1);
    p.section('6. Medidas correctivas');
    p.table(
      [
        { header: 'Medida', width: 40, value: (m) => m.descripcion },
        { header: 'Jerarquía', width: 16, value: (m) => JERARQUIA_LABEL[m.jerarquia] },
        { header: 'Responsable', width: 20, value: (m) => m.responsable },
        { header: 'Plazo', width: 12, value: (m) => formatDate(m.fechaCompromiso) },
        { header: 'Estado', width: 12, value: (m) => (m.estado === 'cumplida' ? 'Cumplida' : 'Pendiente'), color: (m) => (m.estado === 'cumplida' ? OK : WARN), align: 'center' },
      ],
      inv.medidas,
    );
    p.section('7. Conclusión y cierre');
    p.keyValues([
      ['Equipo investigador', inv.equipoInvestigador],
      ['Inicio investigación', formatDate(inv.fechaInicio)],
      ['Estado', inc.estado === 'cerrado' ? `Cerrada el ${formatDate(inv.fechaCierre)} por ${inv.cerradoPor}` : 'En investigación'],
    ]);
    p.paragraph(inv.conclusion || 'Investigación en curso.');
  }
  p.signatures([
    { label: 'Experto en Prevención de Riesgos', name: company.empresa.prevencionista },
    { label: 'Jefatura directa', name: inc.reportadoPor },
    { label: 'Comité Paritario', name: '' },
  ]);
  p.save(`investigacion-folio-${inc.folio}.pdf`);
};

// ============================================================
// 4. Ficha de Entrega de EPP (Art. 53 DS 594 / Art. 68 Ley 16.744)
// ============================================================
export const generarFichaEPP = (company: CompanyData, trabajador: Trabajador, entregas: EntregaEPP[]) => {
  const p = new PdfDoc(company, 'Registro de Entrega de Elementos de Protección Personal', `Trabajador ${trabajador.rut}`);
  p.section('Datos del trabajador');
  p.keyValues([
    ['Nombre', trabajador.nombre],
    ['RUT', trabajador.rut],
    ['Cargo', trabajador.cargo],
    ['Área', trabajador.area],
  ]);
  p.paragraph(
    'De acuerdo al artículo 68 de la Ley 16.744 y artículo 53 del DS 594, el empleador proporciona gratuitamente los elementos de protección personal. El trabajador se compromete a usarlos y mantenerlos en buen estado, informando su deterioro para reposición.',
    8,
  );
  p.section('Historial de entregas');
  p.table(
    [
      { header: 'Fecha', width: 12, value: (e) => formatDate(e.fechaEntrega) },
      { header: 'Elemento', width: 24, value: (e) => `${e.categoria}${e.descripcion && e.descripcion !== e.categoria ? ` - ${e.descripcion}` : ''}` },
      { header: 'Cant.', width: 6, value: (e) => String(e.cantidad), align: 'center' },
      { header: 'Motivo', width: 11, value: (e) => e.motivo },
      { header: 'Renovación', width: 12, value: (e) => formatDate(e.fechaRenovacion) },
      { header: 'Entregado por', width: 15, value: (e) => e.entregadoPor },
      { header: 'Firma recepción', width: 20, image: (e) => e.firma },
    ],
    [...entregas].sort((a, b) => b.fechaEntrega.localeCompare(a.fechaEntrega)),
    { imageH: 10, rowMinH: 13 },
  );
  p.save(`epp-${slug(trabajador.nombre)}.pdf`);
};

// ============================================================
// 5. Matriz IPER
// ============================================================
export const generarMatrizIPER = (company: CompanyData) => {
  const p = new PdfDoc(company, 'Matriz de Identificación de Peligros y Evaluación de Riesgos (IPER)', `${company.iper.length} riesgos evaluados`, 'l');
  p.paragraph('Metodología: VEP (Valor Esperado de la Pérdida) = Probabilidad x Consecuencia. Escala P y C: 1, 2, 4. Nivel: 1-2 Tolerable · 4 Moderado · 8 Importante · 16 Intolerable.', 8);
  const color = (v: number): RGB => (v >= 16 ? CRIT : v >= 8 ? [234, 88, 12] : v >= 4 ? WARN : OK);
  p.table(
    [
      { header: 'Área / Proceso', width: 14, value: (r) => `${r.area} / ${r.proceso}` },
      { header: 'Tarea', width: 16, value: (r) => `${r.tarea}${r.rutinaria ? '' : ' (NR)'}` },
      { header: 'Peligro', width: 13, value: (r) => r.peligro },
      { header: 'Riesgo', width: 13, value: (r) => r.riesgo },
      { header: 'P', width: 4, value: (r) => String(r.probabilidad), align: 'center' },
      { header: 'C', width: 4, value: (r) => String(r.consecuencia), align: 'center' },
      { header: 'VEP', width: 10, value: (r) => `${calcularVEP(r.probabilidad, r.consecuencia)} ${nivelVEP(calcularVEP(r.probabilidad, r.consecuencia))}`, color: (r) => color(calcularVEP(r.probabilidad, r.consecuencia)), align: 'center' },
      { header: 'Medidas de control (jerarquía)', width: 30, value: (r) => r.controles.map((c) => `[${JERARQUIA_LABEL[c.jerarquia]}] ${c.descripcion}`).join('\n') },
      { header: 'Responsable', width: 11, value: (r) => r.responsable },
    ],
    [...company.iper].sort((a, b) => calcularVEP(b.probabilidad, b.consecuencia) - calcularVEP(a.probabilidad, a.consecuencia)),
    { fontSize: 7 },
  );
  p.paragraph(`Probabilidad: ${Object.values(PROBABILIDAD_LABEL).join(', ')}. Consecuencia: ${Object.values(CONSECUENCIA_LABEL).join(', ')}. NR = tarea no rutinaria.`, 7);
  p.signatures([
    { label: 'Experto en Prevención de Riesgos', name: company.empresa.prevencionista },
    { label: 'Representante Legal', name: company.empresa.representanteLegal },
  ]);
  p.save(`matriz-iper-${slug(company.empresa.nombre)}.pdf`);
};

// ============================================================
// 6. Reporte Ejecutivo Gerencial
// ============================================================
export const generarReporteEjecutivo = (company: CompanyData, alertas: Alerta[], diasSinCTP: number) => {
  const p = new PdfDoc(company, 'Reporte Ejecutivo de Seguridad y Salud en el Trabajo', company.indicadores.periodo);
  const ind = calcularIndicadores(company.indicadores);
  const tasas = calcularTasas(company.tasas);
  p.section('Indicadores legales de accidentabilidad (DS 44 / DS 67)');
  p.kpiBoxes([
    { label: 'Días sin accidentes CTP', value: String(diasSinCTP), color: OK },
    { label: 'Tasa de accidentabilidad', value: `${fmtNum(ind.tasaAccidentabilidad)}%`, color: ind.tasaAccidentabilidad > 3 ? CRIT : ind.tasaAccidentabilidad > 1.5 ? WARN : OK },
    { label: 'Índice de frecuencia', value: fmtNum(ind.indiceFrecuencia), color: NAVY },
    { label: 'Índice de gravedad', value: fmtNum(ind.indiceGravedad, 1), color: NAVY },
  ]);
  p.keyValues([
    ['Promedio de trabajadores', String(company.indicadores.promedioTrabajadores)],
    ['Horas-hombre trabajadas', company.indicadores.horasHombre.toLocaleString('es-CL')],
    ['Accidentes CTP', String(company.indicadores.accidentesCTP)],
    ['Días perdidos', String(company.indicadores.diasPerdidos)],
    ['Tasa de siniestralidad (DS 67)', fmtNum(ind.tasaSiniestralidad)],
    ['Récord histórico sin accidentes', `${Math.max(company.recordDiasSinAccidentes, diasSinCTP)} días`],
  ], 3);
  p.section('Cotización Ley 16.744');
  p.keyValues([
    ['Cotización vigente (DS 110)', `${fmtNum(tasas.totalDS110)}%`],
    ['Cotización proyectada (DS 67)', `${fmtNum(tasas.totalDS67)}%`],
    ['Costo mensual vigente', fmtCLP(tasas.costoMensualDS110)],
    ['Impacto anual proyectado', `${tasas.diferenciaAnual >= 0 ? '+' : ''}${fmtCLP(tasas.diferenciaAnual)}`],
  ], 2);

  const abiertos = company.hallazgos.filter((h) => h.estado !== 'cerrado');
  const cerrados = company.hallazgos.length - abiertos.length;
  const inspProm = company.inspecciones.length ? Math.round(company.inspecciones.reduce((a, i) => a + i.cumplimiento, 0) / company.inspecciones.length) : 0;
  p.section('Gestión preventiva');
  p.kpiBoxes([
    { label: 'Charlas / capacitaciones', value: String(company.charlas.length), color: OK },
    { label: 'Inspecciones (cumpl. prom.)', value: `${company.inspecciones.length} (${inspProm}%)`, color: inspProm >= 85 ? OK : WARN },
    { label: 'Hallazgos abiertos / cerrados', value: `${abiertos.length} / ${cerrados}`, color: abiertos.length ? WARN : OK },
    { label: 'Incidentes reportados', value: String(company.incidentes.length), color: NAVY },
  ]);

  p.section('Cumplimiento por supervisor');
  const sup = company.supervisores.map((s) => {
    const hs = company.hallazgos.filter((h) => h.responsable === s);
    const cer = hs.filter((h) => h.estado === 'cerrado').length;
    return { s, charlas: company.charlas.filter((c) => c.relator === s).length, insp: company.inspecciones.filter((i) => i.inspector === s).length, hs: hs.length, cer, pct: hs.length ? Math.round((cer / hs.length) * 100) : 100 };
  });
  p.table(
    [
      { header: 'Supervisor', width: 30, value: (r) => r.s },
      { header: 'Charlas', width: 12, value: (r) => String(r.charlas), align: 'center' },
      { header: 'Inspecciones', width: 14, value: (r) => String(r.insp), align: 'center' },
      { header: 'Hallazgos asignados', width: 16, value: (r) => String(r.hs), align: 'center' },
      { header: 'Cerrados', width: 12, value: (r) => String(r.cer), align: 'center' },
      { header: '% Cierre', width: 12, value: (r) => `${r.pct}%`, color: (r) => (r.pct >= 80 ? OK : r.pct >= 50 ? WARN : CRIT), align: 'center' },
    ],
    sup,
  );

  p.section('Protocolos MINSAL');
  p.table(
    [
      { header: 'Protocolo', width: 40, value: (x) => PROTOCOLOS_INFO[x.codigo].nombre },
      { header: 'Aplica', width: 8, value: (x) => (x.aplica ? 'Sí' : 'No'), align: 'center' },
      { header: 'Avance', width: 10, value: (x) => (x.aplica ? `${Math.round((x.etapas.filter((e) => e.completada).length / x.etapas.length) * 100)}%` : '-'), align: 'center' },
      { header: 'Próxima evaluación', width: 14, value: (x) => formatDate(x.proximaEvaluacion) },
      { header: 'Expuestos', width: 10, value: (x) => String(x.trabajadoresExpuestos), align: 'center' },
    ],
    company.protocolos,
  );

  p.section('Alertas críticas y vencimientos');
  p.table(
    [
      { header: 'Nivel', width: 10, value: (a) => (a.nivel === 'critico' ? 'CRÍTICO' : 'ALERTA'), color: (a) => (a.nivel === 'critico' ? CRIT : WARN), align: 'center' },
      { header: 'Categoría', width: 15, value: (a) => a.categoria },
      { header: 'Detalle', width: 60, value: (a) => `${a.titulo}: ${a.detalle}` },
    ],
    alertas.slice(0, 25),
    { fontSize: 7.5 },
  );
  p.signatures([
    { label: 'Experto en Prevención de Riesgos', name: company.empresa.prevencionista },
    { label: 'Gerencia / Representante Legal', name: company.empresa.representanteLegal },
  ]);
  p.save(`reporte-ejecutivo-${slug(company.empresa.nombre)}-${todayISO()}.pdf`);
};

// ============================================================
// 7. Autoevaluación de cumplimiento DS 44 (FUF)
// ============================================================
export const generarInformeCumplimientoDS44 = (company: CompanyData) => {
  const { filas, resumen } = evaluarFuf(company);
  const nivel = nivelPreparacion(resumen);
  const p = new PdfDoc(company, 'Autoevaluación de cumplimiento DS 44/2024', todayISO(), 'l');
  p.paragraph(
    'Autoevaluación interna según el Formulario Único de Fiscalización (FUF) del DS 44/2024, vigente desde el 1 de febrero de 2025. No constituye una fiscalización ni reemplaza el criterio del experto en prevención. Cada ítem fue confirmado por la persona que firma este informe; la evidencia detectada en la aplicación es solo una referencia.',
    8,
  );
  p.section('Resumen');
  p.kpiBoxes([
    { label: 'Ítems confirmados «cumple»', value: `${resumen.cumple} de ${resumen.aplicables}`, color: nivel.tone === 'ok' ? OK : nivel.tone === 'warn' ? WARN : CRIT },
    { label: 'Porcentaje de preparación', value: `${resumen.porcentaje}%`, color: NAVY },
    { label: 'No cumple', value: String(resumen.noCumple), color: resumen.noCumple ? CRIT : OK },
    { label: 'Pendientes de evaluar', value: String(resumen.pendiente), color: resumen.pendiente ? WARN : OK },
  ]);
  p.keyValues(
    [
      ['Dotación considerada (trabajadores)', String(dotacionEmpresa(company))],
      ['Ítems que no aplican', String(resumen.na)],
      ['Materias más sancionadas con «no cumple»', String(resumen.sancionadosNoCumple)],
      ['Lectura', nivel.label],
    ],
    2,
  );
  p.section('Avance por bloque del FUF');
  p.table(
    [
      { header: 'Bloque', width: 50, value: (b) => b.titulo },
      { header: 'Aplicables', width: 10, value: (b) => String(b.aplicables), align: 'center' },
      { header: 'Cumple', width: 8, value: (b) => String(b.cumple), align: 'center' },
      { header: 'No cumple', width: 9, value: (b) => String(b.noCumple), align: 'center', color: (b) => (b.noCumple ? CRIT : undefined) },
      { header: 'Pendiente', width: 9, value: (b) => String(b.pendiente), align: 'center' },
      { header: '%', width: 7, value: (b) => (b.aplicables ? `${b.porcentaje}%` : '-'), align: 'center' },
    ],
    resumenPorBloque(filas),
  );
  p.section('Detalle por ítem');
  p.table(
    [
      { header: 'N°', width: 4, value: (f) => String(f.item.n), align: 'center' },
      { header: 'Requisito', width: 44, value: (f) => `${f.item.texto}${f.item.sancion ? ' [materia más sancionada por la DT]' : ''}` },
      { header: 'Artículo', width: 12, value: (f) => `${f.item.articulo}${f.item.tamano ? ` (${TAMANO_LABEL[f.item.tamano]})` : ''}` },
      { header: 'Estado', width: 9, value: (f) => ESTADO_LABEL[f.estado], align: 'center', color: (f) => (f.estado === 'cumple' ? OK : f.estado === 'no_cumple' ? CRIT : f.estado === 'pendiente' ? WARN : SLATE) },
      { header: 'Evidencia en la aplicación', width: 28, value: (f) => `${NIVEL_EVIDENCIA_LABEL[f.evidencia.nivel]}: ${f.evidencia.resumen}` },
      { header: 'Observación', width: 20, value: (f) => f.respuesta?.observacion ?? '' },
    ],
    filas,
    { fontSize: 7 },
  );
  const cortes = company.historialFuf ?? [];
  if (cortes.length) {
    p.section('Historial de cortes');
    p.table(
      [
        { header: 'Fecha', width: 14, value: (c) => formatDate(c.fecha) },
        { header: 'Preparación', width: 14, value: (c) => `${c.porcentaje}%`, align: 'center' },
        { header: 'Cumple', width: 12, value: (c) => `${c.cumple} de ${c.aplicables}`, align: 'center' },
        { header: 'No cumple', width: 12, value: (c) => String(c.noCumple), align: 'center' },
        { header: 'Pendiente', width: 12, value: (c) => String(c.pendiente), align: 'center' },
        { header: 'Dotación', width: 10, value: (c) => String(c.dotacion), align: 'center' },
        { header: 'Registrado por', width: 26, value: (c) => c.creadoPor },
      ],
      [...cortes].reverse(),
    );
  }
  p.signatures([
    { label: 'Experto en Prevención de Riesgos', name: company.empresa.prevencionista },
    { label: 'Gerencia / Representante Legal', name: company.empresa.representanteLegal },
  ]);
  p.save(`autoevaluacion-ds44-${slug(company.empresa.nombre)}-${todayISO()}.pdf`);
};

// ============================================================
// 8. Informe de visita en terreno (informe mensual al cliente)
// ============================================================
export const generarInformeVisita = (company: CompanyData, v: Visita, ds44Anterior: number | null) => {
  const r = v.resumen;
  const p = new PdfDoc(company, 'Informe de visita de prevención de riesgos', formatDate(v.fecha));
  p.keyValues(
    [
      ['Fecha de la visita', `${formatDate(v.fecha)} · ${v.horaInicio}${v.horaFin ? ` a ${v.horaFin}` : ''}`],
      ['Período informado', `${formatDate(r.desde)} al ${formatDate(r.hasta)}`],
      ['Prevencionista', v.prevencionista],
      ['Recibido por', `${v.recibidoPor}${v.cargoRecibe ? ` (${v.cargoRecibe})` : ''}`],
    ],
    2,
  );
  p.section('Resumen de la gestión del período');
  p.kpiBoxes([
    { label: 'Cumplimiento DS 44', value: `${r.ds44}%${ds44Anterior !== null && r.ds44 !== ds44Anterior ? ` (${r.ds44 > ds44Anterior ? '+' : ''}${r.ds44 - ds44Anterior} pts)` : ''}`, color: r.ds44 >= 90 ? OK : r.ds44 >= 60 ? WARN : CRIT },
    { label: 'Hallazgos abiertos', value: String(r.hallazgosAbiertos), color: r.hallazgosVencidos ? CRIT : r.hallazgosAbiertos ? WARN : OK },
    { label: 'Accidentes con tiempo perdido', value: String(r.accidentesCTP), color: r.accidentesCTP ? CRIT : OK },
    { label: 'Charlas realizadas', value: String(r.charlas), color: NAVY },
  ]);
  p.keyValues(
    [
      ['Asistencias a charlas y capacitaciones', String(r.asistencias)],
      ['Inspecciones finalizadas', `${r.inspecciones}${r.cumplimientoInspecciones !== null ? ` (cumplimiento promedio ${r.cumplimientoInspecciones}%)` : ''}`],
      ['Hallazgos nuevos / cerrados', `${r.hallazgosNuevos} / ${r.hallazgosCerrados}`],
      ['Hallazgos con plazo vencido', String(r.hallazgosVencidos)],
      ['Incidentes reportados', String(r.incidentes)],
      ['Días perdidos por accidentes', String(r.diasPerdidos)],
    ],
    2,
  );
  if (v.actividades.trim()) {
    p.section('Actividades realizadas en la visita');
    p.paragraph(v.actividades);
  }
  if (v.revisionAnterior.length) {
    p.section('Revisión de compromisos de la visita anterior');
    p.table(
      [
        { header: 'Compromiso', width: 50, value: (k) => k.descripcion },
        { header: 'Responsable', width: 20, value: (k) => k.responsable },
        { header: 'Plazo', width: 14, value: (k) => formatDate(k.plazo), align: 'center' },
        { header: 'Estado', width: 16, value: (k) => ESTADO_COMPROMISO_LABEL[k.estado], align: 'center', color: (k) => (k.estado === 'cumplido' ? OK : k.estado === 'no_cumplido' ? CRIT : WARN) },
      ],
      v.revisionAnterior,
    );
  }
  p.section('Compromisos acordados');
  if (v.compromisos.length) {
    p.table(
      [
        { header: 'Compromiso', width: 56, value: (k) => k.descripcion },
        { header: 'Responsable', width: 26, value: (k) => k.responsable },
        { header: 'Plazo', width: 18, value: (k) => formatDate(k.plazo), align: 'center' },
      ],
      v.compromisos,
    );
  } else {
    p.paragraph('No se acordaron compromisos nuevos en esta visita.');
  }
  if (v.observaciones.trim()) {
    p.section('Observaciones');
    p.paragraph(v.observaciones);
  }
  p.signatures([
    { label: 'Prevencionista', name: v.prevencionista, image: v.firmaPrevencionista || undefined },
    { label: v.cargoRecibe || 'Recibe conforme', name: v.recibidoPor, image: v.firmaRecibe || undefined },
  ]);
  p.save(`informe-visita-${slug(company.empresa.nombre)}-${v.fecha}.pdf`);
};

// ============================================================
// 9. Programa de trabajo preventivo (DS 44, art. 8)
// ============================================================
export const generarProgramaTrabajo = (company: CompanyData, pr: ProgramaTrabajo) => {
  const av = avancePrograma(pr);
  const p = new PdfDoc(company, `Programa de trabajo preventivo ${pr.anio}`, formatDate(pr.elaboradoEn), 'l');
  p.paragraph('Programa elaborado a partir de la Matriz de Identificación de Peligros y Evaluación de Riesgos (MIPER), conforme al artículo 8 del DS 44/2024. Los plazos de las medidas se fijaron según el nivel de riesgo evaluado.', 8);
  p.keyValues(
    [
      ['Elaborado el', formatDate(pr.elaboradoEn)],
      ['MIPER base (última revisión)', pr.miperBase ? formatDate(pr.miperBase) : 'Sin fecha'],
      ['Aprobado por', pr.aprobadoEn ? `${pr.aprobadoPor}${pr.cargoAprueba ? ` (${pr.cargoAprueba})` : ''}, ${formatDate(pr.aprobadoEn)}` : 'Pendiente de aprobación'],
      ['Difusión', `${pr.difundidoEn ? `A trabajadores: ${formatDate(pr.difundidoEn)}` : 'A trabajadores: pendiente'}${pr.enviadoComiteEn ? ` · Comité paritario: ${formatDate(pr.enviadoComiteEn)}` : ''}`],
      ['Avance', `${av.porcentaje}% (${av.realizadas} de ${av.total} actividades realizadas)`],
      ['Actividades vencidas', String(av.vencidas)],
    ],
    2,
  );
  for (const origen of ORIGEN_ORDEN) {
    const acts = pr.actividades.filter((a) => a.origen === origen);
    if (!acts.length) continue;
    p.section(ORIGEN_LABEL[origen]);
    p.table(
      [
        { header: 'Actividad o medida', width: 46, value: (a) => a.descripcion },
        { header: 'Nivel', width: 10, value: (a) => a.nivel ?? '-', align: 'center', color: (a) => (a.nivel === 'Intolerable' || a.nivel === 'Importante' ? CRIT : a.nivel === 'Moderado' ? WARN : undefined) },
        { header: 'Responsable', width: 16, value: (a) => a.responsable },
        { header: 'Plazo', width: 10, value: (a) => formatDate(a.plazo), align: 'center' },
        { header: 'Estado', width: 9, value: (a) => ESTADO_ACTIVIDAD_LABEL[a.estado], align: 'center', color: (a) => (a.estado === 'realizada' ? OK : a.plazo < todayISO() ? CRIT : undefined) },
        { header: 'Verificación', width: 9, value: (a) => (a.fechaRealizada ? formatDate(a.fechaRealizada) : '') },
      ],
      acts,
      { fontSize: 7 },
    );
  }
  if (pr.modificaciones.length) {
    p.section('Registro de modificaciones');
    p.bullets(pr.modificaciones.map((m) => `${formatDate(m.fecha)}: ${m.motivo}`));
  }
  p.signatures([
    { label: 'Elaborado por: Experto en Prevención de Riesgos', name: company.empresa.prevencionista },
    { label: pr.cargoAprueba || 'Aprobado por: Representante Legal', name: pr.aprobadoPor || company.empresa.representanteLegal, image: pr.firmaAprobacion || undefined },
  ]);
  p.save(`programa-trabajo-${pr.anio}-${slug(company.empresa.nombre)}.pdf`);
};

// ============================================================
// 10. Plan de emergencia y simulacros (DS 44, art. 19)
// ============================================================
export const generarPlanEmergencia = (company: CompanyData, plan: PlanEmergencia) => {
  const est = estimarEvacuacion(plan);
  const p = new PdfDoc(company, 'Plan de emergencia y evacuación', formatDate(plan.actualizadoEn));
  p.keyValues(
    [
      ['Escenarios considerados', plan.escenarios.map((e) => ESCENARIO_LABEL[e]).join(', ') || 'Sin definir'],
      ['Punto de encuentro', plan.puntoEncuentro || 'Sin definir'],
      ['Actualizado el', formatDate(plan.actualizadoEn)],
      ['Simulacros registrados', String((company.simulacros ?? []).length)],
    ],
    2,
  );
  p.section('Teléfonos de emergencia');
  p.table(
    [
      { header: 'Servicio', width: 60, value: (t) => t.nombre },
      { header: 'Número', width: 40, value: (t) => t.numero || '(completar)' },
    ],
    plan.telefonos,
  );
  p.section('Brigada de emergencia');
  p.table(
    [
      { header: 'Rol', width: 50, value: (b) => b.rol },
      { header: 'Nombre', width: 50, value: (b) => b.nombre || '(completar)' },
    ],
    plan.brigada,
  );
  p.section('Zonas y salidas');
  p.table(
    [
      { header: 'Zona', width: 50, value: (z) => z.nombre },
      { header: 'Ocupantes', width: 25, value: (z) => String(z.ocupantes), align: 'center' },
      { header: 'Distancia a salida (m)', width: 25, value: (z) => String(z.distancia), align: 'center' },
    ],
    plan.zonas,
  );
  p.table(
    [
      { header: 'Salida', width: 60, value: (s) => s.nombre },
      { header: 'Ancho libre (m)', width: 40, value: (s) => s.ancho.toLocaleString('es-CL'), align: 'center' },
    ],
    plan.salidas,
  );
  if (est) {
    p.section('Estimación referencial del tiempo de evacuación');
    p.kpiBoxes([
      { label: 'Tiempo total estimado', value: fmtSeg(est.totalSeg), color: NAVY },
      { label: 'Alarma y reacción', value: fmtSeg(est.alarmaSeg), color: SLATE },
      { label: `Desplazamiento (${est.zonaCritica})`, value: fmtSeg(est.desplazamientoSeg), color: SLATE },
      { label: 'Paso por salidas', value: fmtSeg(est.flujoSeg), color: SLATE },
    ]);
    p.paragraph(
      `Modelo simplificado y conservador: tiempo de alarma + desplazamiento de la zona más lejana a ${plan.velocidad.toLocaleString('es-CL')} m/s + paso de ${est.ocupantes} personas por ${est.anchoEfectivo.toLocaleString('es-CL')} m de ancho efectivo a ${FLUJO_ESPECIFICO.toLocaleString('es-CL')} personas por metro por segundo. Es una referencia para planificar; el tiempo real se mide en el simulacro.`,
      8,
    );
  }
  const sims = simulacrosOrdenados(company);
  if (sims.length) {
    p.section('Historial de simulacros');
    p.table(
      [
        { header: 'Fecha', width: 14, value: (s) => formatDate(s.fecha) },
        { header: 'Escenario', width: 18, value: (s) => `${ESCENARIO_LABEL[s.escenario]}${s.conAviso ? '' : ' (sin aviso)'}` },
        { header: 'Participantes', width: 14, value: (s) => String(s.participantes), align: 'center' },
        { header: 'Tiempo real', width: 14, value: (s) => fmtSeg(s.tiempoRealSeg), align: 'center' },
        { header: 'Estimado', width: 14, value: (s) => (s.tiempoEstimadoSeg !== null ? fmtSeg(s.tiempoEstimadoSeg) : '-'), align: 'center' },
        { header: 'Mejoras', width: 26, value: (s) => (s.mejoras.length ? s.mejoras.join('; ') : 'Sin observaciones') },
      ],
      sims,
      { fontSize: 7 },
    );
  }
  p.signatures([
    { label: 'Experto en Prevención de Riesgos', name: company.empresa.prevencionista },
    { label: 'Representante Legal', name: company.empresa.representanteLegal },
  ]);
  p.save(`plan-emergencia-${slug(company.empresa.nombre)}.pdf`);
};
