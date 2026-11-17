import type { ReactElement } from 'react';
import { StoreProvider, useStore } from './services/store';
import AppShell from './components/layout/AppShell';
import { Toasts } from './components/ui';
import type { ViewId } from './types';
import Dashboard from './components/modules/dashboard/Dashboard';
import Cartera from './components/modules/cartera/Cartera';
import Visitas from './components/modules/visitas/Visitas';
import Programa from './components/modules/programa/Programa';
import Cumplimiento from './components/modules/cumplimiento/Cumplimiento';
import Charlas from './components/modules/charlas/Charlas';
import Inspecciones from './components/modules/inspecciones/Inspecciones';
import Hallazgos from './components/modules/hallazgos/Hallazgos';
import Incidentes from './components/modules/incidentes/Incidentes';
import EPP from './components/modules/epp/EPP';
import IPER from './components/modules/iper/IPER';
import Protocolos from './components/modules/protocolos/Protocolos';
import Trabajadores from './components/modules/trabajadores/Trabajadores';
import Configuracion from './components/modules/configuracion/Configuracion';
import SupervisorHome from './components/modules/supervisor/SupervisorHome';
import Documentos from './components/modules/documentos/Documentos';
import Verificar from './components/modules/verificar/Verificar';

const VIEWS: Record<ViewId, () => ReactElement> = {
  inicio: SupervisorHome,
  cartera: Cartera,
  dashboard: Dashboard,
  cumplimiento: Cumplimiento,
  visitas: Visitas,
  programa: Programa,
  charlas: Charlas,
  inspecciones: Inspecciones,
  hallazgos: Hallazgos,
  incidentes: Incidentes,
  epp: EPP,
  iper: IPER,
  protocolos: Protocolos,
  documentos: Documentos,
  verificar: Verificar,
  trabajadores: Trabajadores,
  configuracion: Configuracion,
};

function Router() {
  const { route, company, rol } = useStore();
  const View = VIEWS[route.view];
  // La key fuerza el reinicio del estado local al cambiar de empresa o rol
  return View ? <View key={`${company.id}-${rol}`} /> : null;
}

export default function App() {
  return (
    <StoreProvider>
      <AppShell>
        <Router />
      </AppShell>
      <Toasts />
    </StoreProvider>
  );
}
