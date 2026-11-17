// Utilidades RUT chileno (Módulo 11)

export const cleanRut = (rut: string): string => rut.replace(/[^0-9kK]/g, '').toUpperCase();

export const computeDV = (body: string): string => {
  let sum = 0;
  let mul = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const res = 11 - (sum % 11);
  if (res === 11) return '0';
  if (res === 10) return 'K';
  return String(res);
};

/** Formatea progresivamente mientras se escribe: 12.345.678-9 */
export const formatRut = (value: string): string => {
  const clean = cleanRut(value).slice(0, 9);
  if (clean.length <= 1) return clean;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  const withDots = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${withDots}-${dv}`;
};

export const validateRut = (rut: string): boolean => {
  const clean = cleanRut(rut);
  if (clean.length < 8 || clean.length > 9) return false;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  if (!/^\d+$/.test(body)) return false;
  return computeDV(body) === dv;
};

/** Genera un RUT válido a partir de un número base (para datos demo) */
export const makeRut = (body: number): string => formatRut(`${body}${computeDV(String(body))}`);
