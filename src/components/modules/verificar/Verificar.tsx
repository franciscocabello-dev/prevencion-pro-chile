import { useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { CheckCircle2, Clock, HelpCircle, QrCode, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useStore } from '../../../services/store';
import { decodePayload, formatDateTime, hashCharla, hashDocumento, urlVerificacion, type PayloadQR } from '../../../utils/verification';
import { Button, Card, Field, Input, PageHeader, cx } from '../../ui';

type Resultado =
  | { estado: 'valido'; detalle: string }
  | { estado: 'alterado'; detalle: string }
  | { estado: 'en_curso'; detalle: string }
  | { estado: 'no_local'; detalle: string };

/**
 * Verificación de actas por QR. El QR es autocontenido (sesión, fecha/hora, relator,
 * n° firmantes y prefijo del sello SHA-256): se puede leer en cualquier equipo; la
 * validación criptográfica completa se hace donde exista el registro (o su respaldo JSON).
 */
export default function Verificar() {
  const { state, route, navigate } = useStore();
  const [entrada, setEntrada] = useState('');
  const payload = useMemo(() => {
    const d = route.params.get('d');
    return d ? decodePayload(d) : null;
  }, [route]);

  const resultado = useMemo((): Resultado | null => {
    if (!payload) return null;
    if (payload.h === 'EN-CURSO') return { estado: 'en_curso', detalle: 'QR de una sesión todavía abierta. El acta definitiva tendrá su propio QR sellado.' };
    for (const c of Object.values(state.companies)) {
      const ch = c.charlas.find((x) => x.sesionId === payload.id);
      if (ch) {
        const actual = hashCharla(ch);
        return actual === ch.hash && actual.startsWith(payload.h)
          ? { estado: 'valido', detalle: `Acta registrada en ${c.empresa.nombre}. El contenido y las ${ch.asistentes.length + 1} firmas coinciden con el sello.` }
          : { estado: 'alterado', detalle: 'El registro existe, pero su contenido o firmas no coinciden con el sello del QR.' };
      }
      const doc = c.documentos.find((x) => x.sesionId === payload.id);
      if (doc) {
        const actual = hashDocumento(doc);
        return actual === doc.hash && actual.startsWith(payload.h)
          ? { estado: 'valido', detalle: `Documento registrado en ${c.empresa.nombre}. Contenido y firmas íntegros.` }
          : { estado: 'alterado', detalle: 'El documento existe, pero fue modificado después de firmarse.' };
      }
    }
    return { estado: 'no_local', detalle: 'Los datos del QR son legibles, pero este equipo no tiene el registro. Verifique en el dispositivo de la empresa o importando su respaldo JSON.' };
  }, [payload, state.companies]);

  const abrir = () => {
    const m = entrada.match(/[?&]d=([A-Za-z0-9_-]+)/);
    if (m) navigate('verificar', { d: m[1] });
  };

  const UI = {
    valido: { icon: ShieldCheck, cls: 'bg-ok-50 text-ok-800 ring-ok/30', title: 'Documento auténtico e íntegro' },
    alterado: { icon: ShieldAlert, cls: 'bg-crit-50 text-crit-800 ring-crit/30', title: 'Documento ALTERADO' },
    en_curso: { icon: Clock, cls: 'bg-warn-50 text-warn-800 ring-warn/40', title: 'Sesión en curso' },
    no_local: { icon: HelpCircle, cls: 'bg-sky-50 text-sky-800 ring-sky-300/50', title: 'Registro no disponible en este equipo' },
  } as const;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Verificar documento" subtitle="Validación del QR impreso en actas y documentos firmados" icon={<QrCode className="size-6" />} />
      {!payload ? (
        <Card>
          <p className="mb-3 text-sm text-slate-600">Escanee el QR del acta con la cámara del teléfono, o pegue aquí el enlace de verificación:</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Field label="Enlace de verificación" className="flex-1">
              <Input value={entrada} onChange={(e) => setEntrada(e.target.value)} placeholder="https://…/#/verificar?d=…" />
            </Field>
            <Button className="sm:self-end" disabled={!/[?&]d=/.test(entrada)} onClick={abrir}>
              Verificar
            </Button>
          </div>
        </Card>
      ) : (
        <Detalle payload={payload} resultado={resultado!} ui={UI} />
      )}
    </div>
  );
}

function Detalle({ payload, resultado, ui }: { payload: PayloadQR; resultado: Resultado; ui: Record<Resultado['estado'], { icon: typeof ShieldCheck; cls: string; title: string }> }) {
  const u = ui[resultado.estado];
  const Icon = u.icon;
  const filas: [string, string][] = [
    ['ID de sesión', payload.id],
    ['Tipo', payload.k === 'charla' ? 'Acta de charla / capacitación' : 'Documento individual'],
    ['Título / tema', payload.tit],
    ['RUT empresa', payload.emp || '—'],
    ['Relator / emisor', payload.rel],
    ['Fecha y hora exacta', formatDateTime(payload.ts)],
    ['Firmantes', String(payload.n)],
    ['Sello SHA-256 (prefijo)', payload.h.toUpperCase()],
  ];
  return (
    <div className="space-y-4">
      <div className={cx('flex items-start gap-3 rounded-2xl p-4 ring-1', u.cls)}>
        <Icon className="size-8 shrink-0" />
        <div>
          <p className="text-lg font-bold">{u.title}</p>
          <p className="text-sm">{resultado.detalle}</p>
        </div>
      </div>
      <Card bodyClass="p-0">
        <dl className="divide-y divide-slate-100">
          {filas.map(([k, v]) => (
            <div key={k} className="flex flex-wrap gap-x-4 px-4 py-2.5 text-sm">
              <dt className="w-44 shrink-0 text-slate-500">{k}</dt>
              <dd className="min-w-0 flex-1 font-medium break-words text-navy">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <div className="flex items-center gap-3 text-xs text-slate-500">
        <span className="paper rounded p-1">
          <QRCodeSVG value={urlVerificacion(payload)} size={56} />
        </span>
        <span className="flex items-center gap-1">
          <CheckCircle2 className="size-3.5" /> Datos decodificados del QR. La firma electrónica simple se rige por la Ley 19.799.
        </span>
      </div>
    </div>
  );
}
