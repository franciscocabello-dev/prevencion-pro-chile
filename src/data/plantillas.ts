import type { CategoriaPlantilla, PlantillaDocumento } from '../types';
import { todayISO } from '../utils/date';

export const CATEGORIA_PLANTILLA_LABEL: Record<CategoriaPlantilla, string> = {
  charla5: 'Charla 5 Min',
  epp: 'Entrega EPP',
  odi: 'ODI / Inducción',
  procedimiento: 'Procedimiento',
  amonestacion: 'Amonestación',
};

export const CATEGORIAS_PLANTILLA: CategoriaPlantilla[] = ['charla5', 'epp', 'odi', 'procedimiento', 'amonestacion'];

type Base = Omit<PlantillaDocumento, 'actualizada' | 'base'>;

const BASE: Base[] = [
  {
    id: 'pl-charla5',
    categoria: 'charla5',
    nombre: 'Charla 5 minutos estándar',
    titulo: 'Charla de 5 Minutos: {{TEMA}}',
    cuerpo:
      'En {{EMPRESA}}, área {{AREA}}, con fecha {{FECHA}}, el relator {{RELATOR}} dictó la charla de seguridad "{{TEMA}}".\n\n' +
      'Se revisaron los riesgos asociados a la tarea, las medidas preventivas y el uso correcto de los elementos de protección personal. ' +
      'Se recordó que toda condición o acción subestándar debe ser reportada de inmediato a la jefatura directa.\n\n' +
      'Los trabajadores firmantes declaran haber comprendido la información entregada.',
    firmaTrabajador: true,
    firmaEmisor: true,
  },
  {
    id: 'pl-epp',
    categoria: 'epp',
    nombre: 'Comprobante de entrega de EPP',
    titulo: 'Comprobante de Entrega de Elementos de Protección Personal',
    cuerpo:
      'Yo, {{NOMBRE_TRABAJADOR}}, RUT {{RUT_TRABAJADOR}}, cargo {{CARGO}}, declaro recibir de {{EMPRESA}} (RUT {{RUT_EMPRESA}}), en forma gratuita, ' +
      'los elementos de protección personal necesarios para el desempeño seguro de mis funciones en el área {{AREA}}, conforme al artículo 68 de la Ley 16.744 y al artículo 53 del DS 594.\n\n' +
      'Me comprometo a:\n' +
      '1. Usar permanentemente los EPP en las tareas que lo requieran.\n' +
      '2. Mantenerlos en buen estado de conservación e higiene.\n' +
      '3. Informar a mi jefatura cualquier deterioro, pérdida o mal funcionamiento para su reposición.\n' +
      '4. No prestarlos ni alterarlos.\n\n' +
      'Entrega: {{RELATOR}}. Fecha: {{FECHA}}.',
    firmaTrabajador: true,
    firmaEmisor: true,
  },
  {
    id: 'pl-odi',
    categoria: 'odi',
    nombre: 'ODI / Inducción de ingreso',
    titulo: 'Obligación de Informar los Riesgos Laborales (DS 44 Art. 15)',
    cuerpo:
      'En cumplimiento del artículo 15 del DS 44/2024, {{EMPRESA}} informa a {{NOMBRE_TRABAJADOR}}, RUT {{RUT_TRABAJADOR}}, quien se desempeñará como {{CARGO}} en el área {{AREA}} ' +
      'desde el {{FECHA_INGRESO}}, acerca de los riesgos que entrañan sus labores, las medidas preventivas y los métodos de trabajo correctos.\n\n' +
      'Riesgos informados: caídas a mismo y distinto nivel, sobreesfuerzos por manejo manual de cargas (Ley 20.949), golpes y cortes, contacto eléctrico, exposición a ruido, ' +
      'riesgos psicosociales y los propios de su puesto según la Matriz IPER vigente.\n\n' +
      'Se informa además el procedimiento ante accidentes del trabajo y de trayecto (organismo administrador: {{MUTUALIDAD}}), el plan de emergencia y evacuación, ' +
      'el Reglamento Interno de Orden, Higiene y Seguridad y el Protocolo de Prevención del Acoso Laboral, Sexual y Violencia en el Trabajo (Ley 21.643 – Ley Karin).\n\n' +
      'Inducción realizada por {{RELATOR}} el {{FECHA}}.',
    firmaTrabajador: true,
    firmaEmisor: true,
  },
  {
    id: 'pl-procedimiento',
    categoria: 'procedimiento',
    nombre: 'Toma de conocimiento de procedimiento',
    titulo: 'Toma de Conocimiento: Procedimiento de Trabajo Seguro – {{TEMA}}',
    cuerpo:
      'Yo, {{NOMBRE_TRABAJADOR}}, RUT {{RUT_TRABAJADOR}}, cargo {{CARGO}}, declaro haber recibido, leído y comprendido el Procedimiento de Trabajo Seguro "{{TEMA}}" ' +
      'de {{EMPRESA}}, aplicable al área {{AREA}}.\n\n' +
      'Me comprometo a cumplir cada uno de sus pasos, a utilizar los EPP indicados y a detener la tarea ante cualquier condición insegura, informando a mi supervisor.\n\n' +
      'Instruido por: {{RELATOR}}. Fecha: {{FECHA}}.',
    firmaTrabajador: true,
    firmaEmisor: true,
  },
  {
    id: 'pl-amonestacion',
    categoria: 'amonestacion',
    nombre: 'Amonestación escrita por incumplimiento de seguridad',
    titulo: 'Amonestación Escrita',
    cuerpo:
      'Señor(a) {{NOMBRE_TRABAJADOR}}\nRUT {{RUT_TRABAJADOR}} – {{CARGO}}\nPresente\n\n' +
      'Por medio de la presente, {{EMPRESA}} le comunica una amonestación escrita por haber incurrido en el siguiente incumplimiento a las normas de higiene y seguridad, ' +
      'constatado el {{FECHA}} en el área {{AREA}}:\n\n' +
      '{{TEMA}}\n\n' +
      'Esta conducta infringe el Reglamento Interno de Orden, Higiene y Seguridad (art. 153 y 154 del Código del Trabajo) y el artículo 67 de la Ley 16.744. ' +
      'Se le insta a dar estricto cumplimiento a las normas de seguridad; la reiteración podrá dar lugar a las sanciones que el Reglamento Interno contempla.\n\n' +
      'Copia de esta amonestación se remite a la Inspección del Trabajo y se archiva en su carpeta personal.\n\n' +
      'Emitida por: {{RELATOR}}.',
    firmaTrabajador: true,
    firmaEmisor: true,
  },
];

export const plantillasBase = (): PlantillaDocumento[] => BASE.map((p) => ({ ...p, actualizada: todayISO(), base: true }));
