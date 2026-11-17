import { jsPDF } from 'jspdf';
import type { Charla, CompanyData, EntregaEPP, Hallazgo, Incidente, Inspeccion, PlantillaChecklist, Trabajador } from '../types';
import { CONSECUENCIA_LABEL, JERARQUIA_LABEL, PROBABILIDAD_LABEL, PROTOCOLOS_INFO, RUBRO_LABEL, TIPO_CHARLA_LABEL, TIPO_INCIDENTE_LABEL } from '../data/catalogos';
import { formatDate, formatLongDate, todayISO } from './date';
import { calcularIndicadores, calcularTasas, calcularVEP, fmtCLP, fmtNum, nivelVEP } from './indicators';
import type { Alerta } from '../services/alerts';

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

class PdfDoc {
  doc: jsPDF;
  y = 0;
  readonly margin = 14;
  readonly pageW: number;
  readonly pageH: number;
  private readonly company: CompanyData;
  private readonly title: string;
  private readonly code: string;

  constructor(company: CompanyData, title: string, code: string, orientation: 'p' | 'l' = 'p') {
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
    for (let i = 1; i <= total; i++) {
      d.setPage(i);
      d.setDrawColor(...BORDER);
      d.setLineWidth(0.2);
      d.line(this.margin, this.pageH - 12, this.pageW - this.margin, this.pageH - 12);
      d.setFont('helvetica', 'normal');
      d.setFontSize(7);
      d.setTextColor(...SLATE);
      d.text(
        t(`Documento generado por PrevenciónPro Chile conforme a Ley 16.744 y DS 40. Firmas electrónicas simples capturadas en dispositivo (Ley 19.799).`),
        this.margin,
        this.pageH - 8,
      );
      d.text(`Página ${i} de ${total}`, this.pageW - this.margin, this.pageH - 8, { align: 'right' });
    }
  }

  ensure(h: number) {
    if (this.y + h > this.pageH - 16) {
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
      if (this.y + h > this.pageH - 16) {
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
  const p = new PdfDoc(company, titulo, `Folio ${ch.id.slice(-8).toUpperCase()}`);
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
    ],
    2,
  );
  p.section('Contenido tratado');
  p.paragraph(ch.contenido);
  if (ch.tipo === 'odi') {
    p.paragraph(
      'En cumplimiento del artículo 21 del DS 40/1969, el empleador informa oportuna y convenientemente a los trabajadores acerca de los riesgos que entrañan sus labores, las medidas preventivas y los métodos de trabajo correctos.',
      8,
    );
  }
  p.section('Registro de asistencia y firmas');
  p.table(
    [
      { header: 'N°', width: 5, value: (_, i) => String(i + 1), align: 'center' },
      { header: 'Nombre completo', width: 30, value: (a) => a.nombre },
      { header: 'RUT', width: 15, value: (a) => a.rut },
      { header: 'Cargo', width: 20, value: (a) => a.cargo },
      { header: 'Firma', width: 30, image: (a) => a.firma },
    ],
    ch.asistentes,
    { imageH: 11, rowMinH: 14 },
  );
  p.paragraph(
    'Los trabajadores firmantes declaran haber recibido y comprendido la información entregada, comprometiéndose a cumplir las medidas preventivas indicadas.',
    8,
  );
  p.signatures([
    { label: `Relator - ${ch.cargoRelator}`, name: ch.relator, image: ch.firmaRelator },
    { label: 'Experto en Prevención de Riesgos', name: company.empresa.prevencionista, image: undefined },
  ]);
  p.save(`acta-${ch.tipo}-${ch.fecha}-${slug(ch.tema)}.pdf`);
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
  p.section('Indicadores legales de accidentabilidad (DS 40 / DS 67)');
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
