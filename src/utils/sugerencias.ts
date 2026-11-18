import type { CompanyData, RiesgoIPER } from '../types';
import { TEMAS_CHARLA, JERARQUIA_LABEL, JERARQUIA_ORDEN } from '../data/catalogos';
import { nivelRiesgo } from './programa';
import type { NivelRiesgo } from './indicators';
import { todayISO } from './date';

// ============================================================
// Charlas sugeridas desde la MIPER: propone hablar de los riesgos
// más altos de la empresa que no se han tratado recientemente, con
// las medidas de control de su propia matriz. El contenido es un
// borrador: el relator lo revisa antes de dictar la charla.
// ============================================================

/** Cada cuántos días conviene volver a tratar un riesgo según su nivel */
export const FRECUENCIA_DIAS: Partial<Record<NivelRiesgo, number>> = { Intolerable: 7, Importante: 15, Moderado: 30 };
const ORDEN: Record<NivelRiesgo, number> = { Intolerable: 0, Importante: 1, Moderado: 2, Tolerable: 3 };

const VACIAS = new Set(['para', 'por', 'con', 'sin', 'del', 'las', 'los', 'una', 'uno', 'que', 'entre', 'sobre', 'desde', 'hasta', 'riesgo', 'riesgos', 'trabajo', 'carga', 'zona', 'area', 'área']);
const normalizar = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
const palabras = (s: string): Set<string> => new Set(normalizar(s).split(/[^a-z0-9ñ]+/).filter((w) => w.length >= 5 && !VACIAS.has(w)));
const comparten = (a: Set<string>, b: Set<string>) => [...a].some((w) => b.has(w) || [...b].some((x) => x.startsWith(w.slice(0, 6)) || w.startsWith(x.slice(0, 6))));

export interface SugerenciaCharla {
  riesgo: RiesgoIPER;
  nivel: NivelRiesgo;
  /** Días desde la última charla sobre este riesgo (null si nunca) */
  diasDesde: number | null;
  motivo: string;
  tema: string;
  contenido: string;
}

/** Charlas que tratan el riesgo: vinculadas explícitamente, o del mismo área con palabras en común */
const ultimaCharlaDe = (c: CompanyData, r: RiesgoIPER): string | null => {
  const clave = palabras(`${r.riesgo} ${r.peligro}`);
  const fechas = c.charlas.filter((x) => x.riesgoId === r.id || (x.area === r.area && comparten(clave, palabras(`${x.tema} ${x.contenido.slice(0, 300)}`)))).map((x) => x.fecha);
  return fechas.length ? fechas.sort().pop()! : null;
};

export const contenidoDesdeRiesgo = (r: RiesgoIPER): { tema: string; contenido: string } => {
  const nivel = nivelRiesgo(r);
  const tema = `${r.riesgo}${r.tarea ? ` en ${r.tarea.toLowerCase()}` : ''}`;
  const controles = [...r.controles].sort((a, b) => JERARQUIA_ORDEN.indexOf(a.jerarquia) - JERARQUIA_ORDEN.indexOf(b.jerarquia));
  const biblioteca = TEMAS_CHARLA.find((t) => comparten(palabras(`${r.riesgo} ${r.peligro}`), palabras(t.titulo)));
  const partes = [
    `Dónde: ${r.area}${r.tarea ? `, ${r.tarea}` : ''}${r.proceso ? ` (${r.proceso})` : ''}.`,
    `Peligro: ${r.peligro}. Riesgo: ${r.riesgo}. Nivel en nuestra matriz: ${nivel.toLowerCase()}.`,
    controles.length
      ? `Cómo nos protegemos:\n${controles.map((k) => `• ${k.descripcion} (${JERARQUIA_LABEL[k.jerarquia].toLowerCase()})`).join('\n')}`
      : 'Este riesgo aún no tiene medidas definidas: pida a los participantes que propongan cómo controlarlo y registre sus ideas.',
    'Si una medida no está disponible o no funciona, detenga la tarea y avise de inmediato a su supervisor.',
    ...(biblioteca ? [`Puntos clave: ${biblioteca.contenido}`] : []),
  ];
  return { tema: tema.charAt(0).toUpperCase() + tema.slice(1), contenido: partes.join('\n\n') };
};

export const sugerirCharlas = (c: CompanyData, max = 3): SugerenciaCharla[] => {
  const hoy = Date.parse(todayISO());
  return c.iper
    .map((r) => {
      const nivel = nivelRiesgo(r);
      const frecuencia = FRECUENCIA_DIAS[nivel];
      if (!frecuencia) return null;
      const ultima = ultimaCharlaDe(c, r);
      const diasDesde = ultima ? Math.round((hoy - Date.parse(ultima)) / 86_400_000) : null;
      if (diasDesde !== null && diasDesde < frecuencia) return null;
      const motivo = `Riesgo ${nivel.toLowerCase()} en ${r.area}. ${diasDesde === null ? 'Nunca se ha tratado en una charla.' : `Última charla hace ${diasDesde} días.`}`;
      return { riesgo: r, nivel, diasDesde, motivo, ...contenidoDesdeRiesgo(r) };
    })
    .filter((s): s is SugerenciaCharla => s !== null)
    .sort((a, b) => ORDEN[a.nivel] - ORDEN[b.nivel] || (b.diasDesde ?? 9999) - (a.diasDesde ?? 9999))
    .slice(0, max);
};
