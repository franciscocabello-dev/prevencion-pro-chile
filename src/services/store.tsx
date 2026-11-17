import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppState, CompanyData, Rol, Rubro, ViewId } from '../types';
import { createInitialState, loadState, saveState } from './storage';
import { buildEmptyCompany } from '../data/demoCompanies';
import { uid } from '../utils/id';
import { can as canFn, VISTA_INICIAL, VISTAS_POR_ROL, type Permiso } from '../utils/permissions';

// ------------------------------------------------------------
// Toasts
// ------------------------------------------------------------
export interface Toast {
  id: string;
  tipo: 'ok' | 'error' | 'info';
  mensaje: string;
}

// ------------------------------------------------------------
// Navegación por hash (#/vista?param=1) – compatible con PWA offline
// ------------------------------------------------------------
interface Route {
  view: ViewId;
  params: URLSearchParams;
}

const parseHash = (): Route => {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  return { view: (path || '') as ViewId, params: new URLSearchParams(query) };
};

interface StoreValue {
  state: AppState;
  company: CompanyData;
  rol: Rol;
  route: Route;
  navigate: (view: ViewId, params?: Record<string, string>) => void;
  updateCompany: (fn: (c: CompanyData) => CompanyData) => void;
  setRol: (rol: Rol) => void;
  setUsuario: (nombre: string) => void;
  setActiveCompany: (id: string) => void;
  createCompany: (nombre: string, rubro: Rubro) => void;
  deleteCompany: (id: string) => void;
  resetDemo: () => void;
  replaceState: (s: AppState) => void;
  can: (p: Permiso) => boolean;
  toasts: Toast[];
  notify: (mensaje: string, tipo?: Toast['tipo']) => void;
  dismissToast: (id: string) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

const nombreUsuarioPorRol = (c: CompanyData, rol: Rol): string => {
  if (rol === 'prevencionista') return c.empresa.prevencionista || 'Prevencionista';
  if (rol === 'gerencia') return c.empresa.representanteLegal || 'Gerencia';
  return c.supervisores[0] || 'Supervisor';
};

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => loadState());
  const [route, setRoute] = useState<Route>(() => parseHash());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const firstSave = useRef(true);

  const notify = useCallback((mensaje: string, tipo: Toast['tipo'] = 'ok') => {
    const id = uid('t');
    setToasts((t) => [...t, { id, tipo, mensaje }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tipo === 'error' ? 6000 : 3200);
  }, []);

  const dismissToast = useCallback((id: string) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  // Persistencia automática en localStorage
  useEffect(() => {
    const res = saveState(state);
    if (!res.ok && !firstSave.current) notify(res.error, 'error');
    firstSave.current = false;
  }, [state, notify]);

  // Router
  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = useCallback((view: ViewId, params?: Record<string, string>) => {
    const q = params ? `?${new URLSearchParams(params).toString()}` : '';
    window.location.hash = `/${view}${q}`;
    window.scrollTo({ top: 0 });
  }, []);

  // Si la vista no está permitida para el rol, redirige a la vista inicial
  useEffect(() => {
    if (!VISTAS_POR_ROL[state.rol].includes(route.view)) {
      const params = Object.fromEntries(route.params.entries());
      const destino = VISTA_INICIAL[state.rol];
      const q = Object.keys(params).length ? `?${new URLSearchParams(params).toString()}` : '';
      window.history.replaceState(null, '', `#/${destino}${q}`);
      setRoute({ view: destino, params: route.params });
    }
  }, [route, state.rol]);

  const company = state.companies[state.activeCompanyId] ?? Object.values(state.companies)[0];

  const updateCompany = useCallback((fn: (c: CompanyData) => CompanyData) => {
    setState((s) => {
      const current = s.companies[s.activeCompanyId];
      if (!current) return s;
      return { ...s, companies: { ...s.companies, [s.activeCompanyId]: fn(current) } };
    });
  }, []);

  const setRol = useCallback((rol: Rol) => {
    setState((s) => ({ ...s, rol, usuario: nombreUsuarioPorRol(s.companies[s.activeCompanyId], rol) }));
  }, []);

  const setUsuario = useCallback((usuario: string) => setState((s) => ({ ...s, usuario })), []);

  const setActiveCompany = useCallback((id: string) => {
    setState((s) => (s.companies[id] ? { ...s, activeCompanyId: id, usuario: nombreUsuarioPorRol(s.companies[id], s.rol) } : s));
  }, []);

  const createCompany = useCallback(
    (nombre: string, rubro: Rubro) => {
      const id = uid('emp-');
      setState((s) => ({ ...s, activeCompanyId: id, companies: { ...s.companies, [id]: buildEmptyCompany(id, nombre, rubro) } }));
      notify(`Empresa "${nombre}" creada. Complete sus datos en Configuración.`);
    },
    [notify],
  );

  const deleteCompany = useCallback((id: string) => {
    setState((s) => {
      const rest = { ...s.companies };
      delete rest[id];
      if (Object.keys(rest).length === 0) return createInitialState();
      const activeCompanyId = s.activeCompanyId === id ? Object.keys(rest)[0] : s.activeCompanyId;
      return { ...s, companies: rest, activeCompanyId };
    });
  }, []);

  const resetDemo = useCallback(() => {
    setState((s) => {
      const fresh = createInitialState();
      // Conserva las empresas propias creadas por el usuario
      const propias = Object.fromEntries(Object.entries(s.companies).filter(([, c]) => !c.esDemo));
      return { ...fresh, rol: s.rol, companies: { ...fresh.companies, ...propias }, usuario: nombreUsuarioPorRol(fresh.companies[fresh.activeCompanyId], s.rol) };
    });
  }, []);

  const replaceState = useCallback((s: AppState) => setState(s), []);

  const can = useCallback((p: Permiso) => canFn(state.rol, p), [state.rol]);

  const value = useMemo<StoreValue>(
    () => ({
      state,
      company,
      rol: state.rol,
      route,
      navigate,
      updateCompany,
      setRol,
      setUsuario,
      setActiveCompany,
      createCompany,
      deleteCompany,
      resetDemo,
      replaceState,
      can,
      toasts,
      notify,
      dismissToast,
    }),
    [state, company, route, navigate, updateCompany, setRol, setUsuario, setActiveCompany, createCompany, deleteCompany, resetDemo, replaceState, can, toasts, notify, dismissToast],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore debe usarse dentro de StoreProvider');
  return ctx;
}
