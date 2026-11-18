import { useMemo } from 'react';
import { Lightbulb, Megaphone } from 'lucide-react';
import { useStore } from '../../../services/store';
import { sugerirCharlas } from '../../../utils/sugerencias';
import { Badge, Button, Card } from '../../ui';

const NIVEL_TONE = { Intolerable: 'crit', Importante: 'crit', Moderado: 'warn', Tolerable: 'ok' } as const;

/** Charlas sugeridas a partir de los riesgos de la MIPER que no se han tratado recientemente */
export default function SugerenciasCharlas({ max = 3 }: { max?: number }) {
  const { company, navigate, can } = useStore();
  const sugerencias = useMemo(() => sugerirCharlas(company, max), [company, max]);

  if (!company.iper.length) return null;
  if (!sugerencias.length)
    return (
      <Card>
        <p className="flex items-center gap-2 text-sm text-slate-600">
          <Lightbulb className="size-4 shrink-0 text-ok" />
          Los riesgos importantes de la matriz tienen charlas recientes. Buen trabajo.
        </p>
      </Card>
    );

  return (
    <Card title="Charlas sugeridas" subtitle="Desde los riesgos de su matriz que no se han tratado hace un tiempo">
      <ul className="divide-y divide-slate-100">
        {sugerencias.map((s) => (
          <li key={s.riesgo.id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex items-start gap-3">
              <Lightbulb className="mt-0.5 size-5 shrink-0 text-warn" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-navy">{s.tema}</p>
                <p className="mt-0.5 text-xs text-slate-500">{s.motivo}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge tone={NIVEL_TONE[s.nivel]}>{s.nivel}</Badge>
                  {s.riesgo.controles.length > 0 && <span className="text-xs text-slate-500">{s.riesgo.controles.length} medidas de control para explicar</span>}
                </div>
              </div>
            </div>
            {can('crearCharla') && (
              <Button variant="secondary" size="sm" block className="mt-3" icon={<Megaphone className="size-4" />} onClick={() => navigate('charlas', { riesgo: s.riesgo.id })}>
                Preparar esta charla
              </Button>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-slate-500">El contenido se arma con las medidas de control de su matriz. Revíselo antes de dictar la charla.</p>
    </Card>
  );
}
