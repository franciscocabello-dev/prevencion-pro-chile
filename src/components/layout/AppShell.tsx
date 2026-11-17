import { useEffect, useState, type ReactNode } from 'react';
import { Building2, Check, ChevronDown, ChevronsLeft, ChevronsRight, Download, LayoutGrid, Plus, ShieldCheck, UserRound } from 'lucide-react';
import { useStore } from '../../services/store';
import { bottomNavForRol, navForRol } from './nav';
import { RUBRO_LABEL } from '../../data/catalogos';
import { ROL_CORTO, ROL_LABEL } from '../../utils/permissions';
import type { Rol, Rubro } from '../../types';
import { Button, Field, Input, Modal, Select, cx } from '../ui';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const ROL_DOT: Record<Rol, string> = { prevencionista: 'bg-ok', gerencia: 'bg-slate-500', supervisor: 'bg-warn' };
const ROL_DESC: Record<Rol, string> = {
  prevencionista: 'Administración total y cierre legal',
  gerencia: 'KPIs, costos y aprobación de planes',
  supervisor: 'Operación rápida móvil en terreno',
};

function Brand({ compact }: { compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-navy text-white">
        <ShieldCheck className="size-[18px]" strokeWidth={2.25} />
      </span>
      {!compact && (
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-semibold text-navy">PrevenciónPro</p>
          <p className="text-[10px] font-medium tracking-[0.12em] text-slate-500 uppercase">Chile · SST</p>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------
// Menú de dropdown genérico (popover anclado, ancho acotado a la pantalla)
// ------------------------------------------------------------
function Popover({ open, onClose, align, children }: { open: boolean; onClose: () => void; align: 'left' | 'right'; children: ReactNode }) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className={cx('absolute top-full z-40 mt-1.5 w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-lg border border-slate-200 bg-white', align === 'left' ? 'left-0' : 'right-0')}>
        {children}
      </div>
    </>
  );
}

function CompanySelector() {
  const { state, company, setActiveCompany, createCompany } = useStore();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [nombre, setNombre] = useState('');
  const [rubro, setRubro] = useState<Rubro>('servicios');

  return (
    <div className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-11 w-full max-w-xs min-w-0 items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 text-left hover:border-slate-300"
      >
        <Building2 className="size-4 shrink-0 text-slate-500" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm leading-tight font-semibold text-navy">{company.empresa.nombre}</span>
          <span className="block truncate text-[11px] leading-tight text-slate-500">{RUBRO_LABEL[company.empresa.rubro]}</span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-slate-400" />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} align="left">
        <p className="border-b border-slate-200 px-3 py-2 text-[11px] font-semibold tracking-[0.06em] text-slate-500 uppercase">Centro de trabajo</p>
        <div className="max-h-72 overflow-y-auto py-1">
          {Object.values(state.companies).map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setActiveCompany(c.id);
                setOpen(false);
              }}
              className="flex min-h-11 w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-slate-50"
            >
              <span className="flex size-4 shrink-0 items-center justify-center">{c.id === company.id && <Check className="size-4 text-ok" />}</span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-navy">{c.empresa.nombre}</span>
                <span className="block truncate text-xs text-slate-500">
                  {RUBRO_LABEL[c.empresa.rubro]} · {c.esDemo ? 'Demo' : 'Propia'}
                </span>
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setCreating(true);
          }}
          className="flex min-h-11 w-full items-center gap-2 border-t border-slate-200 px-3 text-sm font-semibold text-navy hover:bg-slate-50"
        >
          <Plus className="size-4" /> Crear empresa propia
        </button>
      </Popover>
      {creating && (
        <Modal
          title="Nueva empresa"
          onClose={() => setCreating(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setCreating(false)}>
                Cancelar
              </Button>
              <Button
                disabled={!nombre.trim()}
                onClick={() => {
                  createCompany(nombre.trim(), rubro);
                  setCreating(false);
                  setNombre('');
                }}
              >
                Crear empresa
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <Field label="Nombre de fantasía" required>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Maestranza Los Aromos" autoFocus />
            </Field>
            <Field label="Rubro" hint="Define los temas de charla sugeridos y plantillas por defecto.">
              <Select value={rubro} onChange={(e) => setRubro(e.target.value as Rubro)} options={Object.entries(RUBRO_LABEL).map(([value, label]) => ({ value, label }))} />
            </Field>
            <p className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              La empresa se crea vacía. Complete RUT, mutualidad, áreas, supervisores y trabajadores en <b>Configuración</b> y <b>Trabajadores</b>.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}

function RoleSelector() {
  const { rol, setRol, state } = useStore();
  const [open, setOpen] = useState(false);
  const roles: Rol[] = ['prevencionista', 'gerencia', 'supervisor'];
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Perfil activo: ${ROL_LABEL[rol]}`}
        className="flex h-11 items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 hover:border-slate-300"
      >
        <span className="relative">
          <UserRound className="size-[18px] text-slate-600" />
          <span className={cx('absolute -right-0.5 -bottom-0.5 size-2 rounded-full ring-2 ring-white', ROL_DOT[rol])} />
        </span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-[11px] text-slate-500">Perfil</span>
          <span className="block text-sm font-semibold text-navy">{ROL_CORTO[rol]}</span>
        </span>
        <ChevronDown className="hidden size-4 text-slate-400 sm:block" />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} align="right">
        <p className="border-b border-slate-200 px-3 py-2 text-[11px] font-semibold tracking-[0.06em] text-slate-500 uppercase">Operar como</p>
        {roles.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => {
              setRol(r);
              setOpen(false);
            }}
            className="flex min-h-12 w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-slate-50"
          >
            <span className={cx('size-2 shrink-0 rounded-full', ROL_DOT[r])} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-navy">{ROL_LABEL[r]}</span>
              <span className="block text-xs text-slate-500">{ROL_DESC[r]}</span>
            </span>
            {r === rol && <Check className="size-4 shrink-0 text-ok" />}
          </button>
        ))}
        <p className="border-t border-slate-200 px-3 py-2 text-xs text-slate-500">
          Usuario: <b className="text-navy">{state.usuario}</b>
        </p>
      </Popover>
    </div>
  );
}

function SideNav({ collapsed }: { collapsed: boolean }) {
  const { rol, route, navigate } = useStore();
  return (
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3" aria-label="Navegación principal">
      {navForRol(rol).map((item) => {
        const active = route.view === item.id;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            title={collapsed ? item.label : undefined}
            aria-current={active ? 'page' : undefined}
            onClick={() => navigate(item.id)}
            className={cx(
              'flex h-10 w-full items-center gap-3 rounded-md px-3 text-left text-sm transition-colors',
              active ? 'bg-slate-100 font-semibold text-navy' : 'text-slate-600 hover:bg-slate-50 hover:text-navy',
              collapsed && 'justify-center px-0',
            )}
          >
            <Icon className={cx('size-[18px] shrink-0', active ? 'text-navy' : 'text-slate-400')} strokeWidth={active ? 2.25 : 2} />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </button>
        );
      })}
    </nav>
  );
}

const MENU_LABEL: Partial<Record<string, string>> = {
  inicio: 'Inicio',
  cartera: 'Cartera de clientes',
  dashboard: 'Dashboard',
  charlas: 'Charlas y ODI',
  documentos: 'Documentos',
  inspecciones: 'Inspecciones',
  hallazgos: 'Hallazgos',
  incidentes: 'Incidentes',
  epp: 'Control EPP',
  iper: 'Matriz IPER',
  protocolos: 'Protocolos MINSAL',
  trabajadores: 'Trabajadores',
  configuracion: 'Configuración',
};

/** Menú completo en bottom sheet (móvil), al alcance del pulgar */
function MenuSheet({ onClose, installEvt, onInstall }: { onClose: () => void; installEvt: BeforeInstallPromptEvent | null; onInstall: () => void }) {
  const { rol, route, navigate } = useStore();
  return (
    <Modal title="Menú" onClose={onClose}>
      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200">
        {navForRol(rol).map((item) => {
          const Icon = item.icon;
          const active = route.view === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                navigate(item.id);
                onClose();
              }}
              className={cx('flex min-h-[84px] min-w-0 flex-col items-center justify-center gap-1.5 bg-white px-1.5 py-3 text-center', active && 'bg-slate-50')}
            >
              <Icon className={cx('size-5', active ? 'text-navy' : 'text-slate-500')} strokeWidth={active ? 2.25 : 2} />
              <span className={cx('line-clamp-2 text-xs leading-tight', active ? 'font-semibold text-navy' : 'text-slate-600')}>{MENU_LABEL[item.id] ?? item.short}</span>
            </button>
          );
        })}
        {/* Completa la última fila para que la grilla no muestre celdas grises */}
        {Array.from({ length: (3 - (navForRol(rol).length % 3)) % 3 }).map((_, i) => (
          <span key={`f${i}`} className="bg-white" aria-hidden />
        ))}
      </div>
      {installEvt && (
        <Button block variant="secondary" className="mt-3" icon={<Download className="size-4" />} onClick={onInstall}>
          Instalar aplicación
        </Button>
      )}
    </Modal>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const { rol, route, navigate } = useStore();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('ppc:sidebar') === '1';
    } catch {
      return false;
    }
  });
  const [menu, setMenu] = useState(false);
  const [installEvt, setInstallEvt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('ppc:sidebar', collapsed ? '1' : '0');
    } catch {
      /* sin almacenamiento */
    }
  }, [collapsed]);

  useEffect(() => {
    const h = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);

  const install = async () => {
    if (!installEvt) return;
    await installEvt.prompt();
    setInstallEvt(null);
  };

  const tabs = bottomNavForRol(rol);
  const enTabs = tabs.some((t) => t.id === route.view);

  return (
    <div className="min-h-dvh w-full max-w-full overflow-x-clip bg-surface">
      {/* Barra lateral (escritorio ≥1024px) */}
      <aside className={cx('fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-slate-200 bg-white transition-[width] lg:flex', collapsed ? 'w-[64px]' : 'w-60')}>
        <div className={cx('flex h-14 items-center border-b border-slate-200 px-4', collapsed && 'justify-center px-0')}>
          <Brand compact={collapsed} />
        </div>
        <SideNav collapsed={collapsed} />
        {installEvt && !collapsed && (
          <div className="px-2 pb-2">
            <Button block size="sm" variant="secondary" icon={<Download className="size-4" />} onClick={install}>
              Instalar aplicación
            </Button>
          </div>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex h-11 items-center justify-center gap-2 border-t border-slate-200 text-xs font-medium text-slate-500 hover:text-navy"
          aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
        >
          {collapsed ? (
            <ChevronsRight className="size-4" />
          ) : (
            <>
              <ChevronsLeft className="size-4" /> Contraer
            </>
          )}
        </button>
      </aside>

      <div className={cx('min-w-0 transition-[padding]', collapsed ? 'lg:pl-[64px]' : 'lg:pl-60')}>
        {/* Cabecera: en móvil marca + centro de trabajo (flexible) + perfil (fijo) */}
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white pt-[env(safe-area-inset-top)]">
          <div className="flex h-14 min-w-0 items-center gap-2 px-3 sm:gap-3 sm:px-5">
            <span className="lg:hidden">
              <Brand compact />
            </span>
            <div className="min-w-0 flex-1">
              <CompanySelector />
            </div>
            <RoleSelector />
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl min-w-0 px-3 pt-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:px-5 sm:pt-6 lg:pb-10">{children}</main>
      </div>

      {/* Bottom Tab Bar (móvil y tablet) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Navegación inferior">
        <div className="grid h-16 grid-cols-5">
          {tabs.map((item) => {
            const Icon = item.icon;
            const active = route.view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => navigate(item.id)}
                className={cx('relative flex min-w-0 flex-col items-center justify-center gap-1 px-0.5', active ? 'text-navy' : 'text-slate-500')}
              >
                {active && <span className="absolute inset-x-4 top-0 h-0.5 rounded-b bg-navy" />}
                <Icon className="size-[22px]" strokeWidth={active ? 2.25 : 1.9} />
                <span className={cx('w-full truncate text-center text-[11px] leading-none', active ? 'font-semibold' : 'font-medium')}>{item.short}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setMenu(true)}
            aria-haspopup="dialog"
            className={cx('relative flex min-w-0 flex-col items-center justify-center gap-1', !enTabs || menu ? 'text-navy' : 'text-slate-500')}
          >
            {!enTabs && <span className="absolute inset-x-4 top-0 h-0.5 rounded-b bg-navy" />}
            <LayoutGrid className="size-[22px]" strokeWidth={!enTabs ? 2.25 : 1.9} />
            <span className={cx('text-[11px] leading-none', !enTabs ? 'font-semibold' : 'font-medium')}>Menú</span>
          </button>
        </div>
      </nav>

      {menu && <MenuSheet onClose={() => setMenu(false)} installEvt={installEvt} onInstall={install} />}
    </div>
  );
}
