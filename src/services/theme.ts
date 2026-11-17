import { useCallback, useEffect, useState } from 'react';
import type { TemaVisual } from '../types';

export const THEME_KEY = 'prevencionpro-chile:tema';

export const TEMAS: { id: TemaVisual; nombre: string; descripcion: string; muestra: [string, string, string, string] }[] = [
  { id: 'industrial', nombre: 'Industrial Slate', descripcion: 'Alto contraste para lectura diurna en terreno y oficina.', muestra: ['#FFFFFF', '#F8FAFC', '#059669', '#DC2626'] },
  { id: 'oscuro', nombre: 'Modo Oscuro Terreno', descripcion: 'Para cámaras de frío, turnos nocturnos y baja luminosidad. Reduce el encandilamiento.', muestra: ['#111113', '#09090B', '#10B981', '#EF4444'] },
  { id: 'hse', nombre: 'Verde Seguridad HSE', descripcion: 'Identidad corporativa HSE en verde seguridad (NCh 1410).', muestra: ['#064E3B', '#F6FAF8', '#059669', '#DC2626'] },
];

const THEME_COLOR: Record<TemaVisual, string> = { industrial: '#FFFFFF', oscuro: '#09090B', hse: '#FFFFFF' };

const isTema = (v: unknown): v is TemaVisual => v === 'industrial' || v === 'oscuro' || v === 'hse';

export const leerTema = (): TemaVisual => {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return isTema(v) ? v : 'industrial';
  } catch {
    return 'industrial';
  }
};

export const aplicarTema = (t: TemaVisual) => {
  const root = document.documentElement;
  root.dataset.theme = t;
  root.style.colorScheme = t === 'oscuro' ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[t]);
};

export function useTema() {
  const [tema, setTemaState] = useState<TemaVisual>(leerTema);
  useEffect(() => aplicarTema(tema), [tema]);
  const setTema = useCallback((t: TemaVisual) => {
    try {
      localStorage.setItem(THEME_KEY, t);
    } catch {
      /* almacenamiento no disponible: el tema aplica sólo a esta sesión */
    }
    setTemaState(t);
  }, []);
  return { tema, setTema };
}
