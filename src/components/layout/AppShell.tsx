import { useEffect, useState, type ReactNode } from 'react';
import { Building2, ChevronDown, ChevronsLeft, ChevronsRight, Menu, Plus, ShieldCheck, UserCog, X, Download } from 'lucide-react';
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

function Brand({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-ok text-white">
        <ShieldCheck className="size-5" />
      </span>
      {!compact && (
        <div className="leading-tight">
          <p className="text-[15px] font-bold text-white">PrevenciónPro</p>
          <p className="text-[11px] font-medium tracking-wider text-slate-400 uppercase">Chile · SST</p>
        </div>
      )}
    </div>
  );
}

function SideNav({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const { rol, route, navigate } = useStore();
  return (
    <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
      {navForRol(rol).map((item) => {
        const active = route.view === item.id;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            title={collapsed ? item.label : undefined}
            onClick={() => {
              navigate(item.id);
              onNavigate?.();
            }}
            className={cx(
              'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors',
              active ? 'bg-white/10 text-white shadow-[inset_3px_0_0_#10B981]' : 'text-slate-300 hover:bg-white/5 hover:text-white',
              collapsed && 'justify-center px-0',
            )}
          >
            <Icon className={cx('size-5 shrink-0', active && 'text-ok')} />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </button>
        );
      })}
    </nav>
  );
}

function CompanySelector() {
  const { state, company, setActiveCompany, createCompany } = useStore();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [nombre, setNombre] = useState('');
  const [rubro, setRubro] = useState<Rubro>('servicios');
  const companies = Object.values(state.companies);

  return (
    <div className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex max-w-full min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-left hover:bg-slate-50"
      >
        <Building2 className="size-4 shrink-0 text-slate-500" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-navy">{company.empresa.nombre}</span>
          <span className="hidden truncate text-[11px] text-slate-500 sm:block">{RUBRO_LABEL[company.empresa.rubro]}</span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-slate-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 z-40 mt-1.5 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            <p className="border-b border-slate-100 px-3 py-2 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Rubro / Empresa</p>
            <div className="max-h-72 overflow-y-auto py-1">
              {companies.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setActiveCompany(c.id);
                    setOpen(false);
                  }}
                  className={cx('flex w-full items-start gap-2.5 px-3 py-2 text-left hover:bg-slate-50', c.id === company.id && 'bg-ok-50')}
                >
                  <span className={cx('mt-1.5 size-2 shrink-0 rounded-full', c.id === company.id ? 'bg-ok' : 'bg-slate-300')} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-navy">{c.empresa.nombre}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {RUBRO_LABEL[c.empresa.rubro]} {c.esDemo ? '· Demo' : '· Propia'}
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
              className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2.5 text-sm font-semibold text-navy hover:bg-slate-50"
            >
              <Plus className="size-4" /> Crear empresa propia desde cero
            </button>
          </div>
        </>
      )}
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
            <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
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
  const color: Record<Rol, string> = { prevencionista: 'bg-ok', gerencia: 'bg-sky-500', supervisor: 'bg-warn' };
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-lg bg-navy px-2.5 py-1.5 text-left text-white hover:bg-navy-700">
        <UserCog className="size-4 shrink-0" />
        <span className="hidden leading-tight sm:block">
          <span className="block text-[11px] text-slate-300">Perfil activo</span>
          <span className="block text-sm font-semibold">{ROL_CORTO[rol]}</span>
        </span>
        <span className={cx('size-2 rounded-full sm:hidden', color[rol])} />
        <ChevronDown className="size-4 shrink-0 text-slate-300" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute top-full right-0 z-40 mt-1.5 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            <p className="border-b border-slate-100 px-3 py-2 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Operar como</p>
            {roles.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setRol(r);
                  setOpen(false);
                }}
                className={cx('flex w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-slate-50', r === rol && 'bg-slate-50')}
              >
                <span className={cx('mt-1.5 size-2.5 shrink-0 rounded-full', color[r])} />
                <span>
                  <span className="block text-sm font-semibold text-navy">{ROL_LABEL[r]}</span>
                  <span className="block text-xs text-slate-500">
                    {r === 'prevencionista' ? 'Administración total y cierre legal' : r === 'gerencia' ? 'KPIs, costos y aprobación de planes' : 'Operación rápida móvil en terreno'}
                  </span>
                </span>
              </button>
            ))}
            <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
              Usuario: <b className="text-navy">{state.usuario}</b>
            </p>
          </div>
        </>
      )}
    </div>
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
  const [drawer, setDrawer] = useState(false);
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

  const bottom = bottomNavForRol(rol);

  return (
    <div className="min-h-dvh bg-surface">
      {/* Sidebar escritorio */}
      <aside className={cx('fixed inset-y-0 left-0 z-30 hidden flex-col bg-navy transition-[width] lg:flex', collapsed ? 'w-[72px]' : 'w-64')}>
        <div className={cx('flex h-16 items-center border-b border-white/10 px-4', collapsed && 'justify-center px-0')}>
          <Brand compact={collapsed} />
        </div>
        <SideNav collapsed={collapsed} />
        {installEvt && !collapsed && (
          <div className="px-3 pb-2">
            <button
              type="button"
              onClick={async () => {
                await installEvt.prompt();
                setInstallEvt(null);
              }}
              className="flex w-full items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-white/5"
            >
              <Download className="size-4" /> Instalar aplicación
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center justify-center gap-2 border-t border-white/10 py-3 text-xs font-medium text-slate-400 hover:text-white"
        >
          {collapsed ? <ChevronsRight className="size-4" /> : <><ChevronsLeft className="size-4" /> Contraer menú</>}
        </button>
      </aside>

      {/* Drawer móvil */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-navy/60" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-navy">
            <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
              <Brand />
              <button type="button" onClick={() => setDrawer(false)} className="rounded-lg p-2 text-slate-300 hover:bg-white/10" aria-label="Cerrar menú">
                <X className="size-5" />
              </button>
            </div>
            <SideNav collapsed={false} onNavigate={() => setDrawer(false)} />
            {installEvt && (
              <div className="p-3">
                <button
                  type="button"
                  onClick={async () => {
                    await installEvt.prompt();
                    setInstallEvt(null);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm font-medium text-slate-200"
                >
                  <Download className="size-4" /> Instalar aplicación
                </button>
              </div>
            )}
          </aside>
        </div>
      )}

      <div className={cx('transition-[padding]', collapsed ? 'lg:pl-[72px]' : 'lg:pl-64')}>
        {/* Cabecera */}
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur pt-[env(safe-area-inset-top)]">
          <div className="flex h-16 items-center gap-2 px-3 sm:gap-3 sm:px-5">
            <button type="button" onClick={() => setDrawer(true)} className="rounded-lg p-2 text-navy hover:bg-slate-100 lg:hidden" aria-label="Abrir menú">
              <Menu className="size-5" />
            </button>
            <div className="min-w-0 flex-1">
              <CompanySelector />
            </div>
            <RoleSelector />
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-3 pt-4 pb-28 sm:px-5 sm:pt-6 lg:pb-10">{children}</main>
      </div>

      {/* Barra inferior móvil */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-navy pb-[env(safe-area-inset-bottom)] lg:hidden">
        <div className="grid grid-cols-5">
          {bottom.map((item) => {
            const Icon = item.icon;
            const active = route.view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.id)}
                className={cx('flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold', active ? 'text-ok' : 'text-slate-400')}
              >
                <Icon className="size-5" />
                {item.short}
              </button>
            );
          })}
          <button type="button" onClick={() => setDrawer(true)} className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold text-slate-400">
            <Menu className="size-5" />
            Más
          </button>
        </div>
      </nav>
    </div>
  );
}
