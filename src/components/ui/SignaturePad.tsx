import { useEffect, useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Eraser, PenLine, CheckCircle2 } from 'lucide-react';
import { cx } from './index';

interface Props {
  label?: string;
  value?: string;
  onChange: (dataUrl: string) => void;
  height?: number;
}

/**
 * Canvas de firma táctil (react-signature-canvas). Funciona con dedo, lápiz o mouse.
 * Emite un PNG en base64 al terminar cada trazo.
 */
export default function SignaturePad({ label = 'Firma', value, onChange, height = 160 }: Props) {
  const ref = useRef<SignatureCanvas | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [empty, setEmpty] = useState(!value);

  // Ajusta la resolución del canvas al ancho real del contenedor (pantallas retina)
  useEffect(() => {
    const resize = () => {
      const pad = ref.current;
      const canvas = pad?.getCanvas();
      if (!pad || !canvas || !wrap.current) return;
      const data = pad.isEmpty() ? null : pad.toDataURL();
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const w = wrap.current.clientWidth;
      canvas.width = w * ratio;
      canvas.height = height * ratio;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${height}px`;
      canvas.getContext('2d')?.scale(ratio, ratio);
      pad.clear();
      if (data) pad.fromDataURL(data, { width: w, height });
    };
    resize();
    if (value && ref.current?.isEmpty()) {
      ref.current.fromDataURL(value, { width: wrap.current?.clientWidth ?? 300, height });
    }
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height]);

  // Si el valor externo se limpia (nuevo asistente) limpiamos el canvas
  useEffect(() => {
    if (!value && ref.current && !ref.current.isEmpty()) {
      ref.current.clear();
      setEmpty(true);
    }
  }, [value]);

  const clear = () => {
    ref.current?.clear();
    setEmpty(true);
    onChange('');
  };

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
          <PenLine className="size-4" /> {label}
        </span>
        {!empty && (
          <span className="flex items-center gap-1 text-xs font-semibold text-ok-700">
            <CheckCircle2 className="size-3.5" /> Firmado
          </span>
        )}
      </div>
      <div ref={wrap} className={cx('paper relative overflow-hidden rounded-lg border-2', empty ? 'border-dashed border-slate-300' : 'border-ok')} style={{ height }}>
        <SignatureCanvas
          ref={ref}
          penColor="#0F172A"
          minWidth={1}
          maxWidth={2.6}
          clearOnResize={false}
          canvasProps={{ className: 'block touch-none', 'aria-label': label }}
          onEnd={() => {
            setEmpty(false);
            onChange(ref.current?.toDataURL('image/png') ?? '');
          }}
        />
        {empty && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-400 select-none">
            Firme aquí con el dedo o lápiz
          </span>
        )}
        <span className="pointer-events-none absolute right-4 bottom-8 left-4 border-b border-slate-300" />
      </div>
      <button type="button" onClick={clear} className="mt-1.5 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100">
        <Eraser className="size-3.5" /> Limpiar firma
      </button>
    </div>
  );
}
