// Armazón: rutas, avisos breves (Toast), menú lateral en escritorio y pestañas en celular.
import { html, DS, Icon, useState, useEffect, useCallback, createContext, useContext } from './lib.js';

// ───────── Rutas con # (funcionan en GitHub Pages sin configurar nada) ─────────
export function useRuta() {
  const leer = () => (location.hash.replace(/^#\/?/, '').split('?')[0] || '');
  const [ruta, setRuta] = useState(leer);
  useEffect(() => {
    const f = () => { setRuta(leer()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return ruta;
}
export const ir = (r) => { location.hash = '#/' + r; };

// ───────── Toast: confirmaciones breves que se van solas a los 4 s ─────────
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }) {
  const [lista, setLista] = useState([]);
  const mostrar = useCallback((texto, opts = {}) => {
    const id = Math.random().toString(36).slice(2);
    setLista((l) => [...l, { id, texto, ...opts }]);
    setTimeout(() => setLista((l) => l.filter((t) => t.id !== id)), 4000);
  }, []);
  return html`<${ToastCtx.Provider} value=${mostrar}>
    ${children}
    <div class="toasts">${lista.map((t) => html`<${DS.Toast} key=${t.id} tone=${t.tone} sparks=${t.sparks}>${t.texto}<//>`)}</div>
  <//>`;
}

// ───────── Navegación por perfil ─────────
export const NAV = {
  tutor: {
    etiqueta: null,
    grupos: [{ items: [
      { id: 'inicio', label: 'Inicio', icon: 'home' },
      { id: 'mascotas', label: 'Mascotas', icon: 'paw' },
      { id: 'agendar', label: 'Agendar', icon: 'plus', featured: true },
      { id: 'consultas', label: 'Consultas', icon: 'cal' },
      { id: 'perfil', label: 'Perfil', icon: 'user' },
    ] }],
    tabs: ['inicio', 'mascotas', 'agendar', 'consultas', 'perfil'],
  },
  mvz: {
    etiqueta: 'Médico veterinario',
    grupos: [{ items: [
      { id: 'hoy', label: 'Hoy', icon: 'home' },
      { id: 'agenda', label: 'Agenda', icon: 'cal' },
      { id: 'pagos', label: 'Pagos', icon: 'wallet' },
      { id: 'perfil', label: 'Perfil', icon: 'user' },
    ] }],
    tabs: ['hoy', 'agenda', 'pagos', 'perfil'],
  },
  admin: {
    etiqueta: 'Panel de LilieVET',
    grupos: [
      { titulo: 'Operación', items: [
        { id: 'inicio', label: 'Inicio', icon: 'home' },
        { id: 'verificacion', label: 'Verificación', icon: 'shield', count: 'porRevisar' },
        { id: 'reservas', label: 'Reservas', icon: 'cal' },
        { id: 'soporte', label: 'Soporte', icon: 'chat' },
      ] },
      { titulo: 'Personas', items: [
        { id: 'tutores', label: 'Tutores', icon: 'users' },
        { id: 'medicos', label: 'Médicos veterinarios', icon: 'paw' },
      ] },
      { titulo: 'Negocio', items: [
        { id: 'finanzas', label: 'Finanzas', icon: 'wallet' },
        { id: 'metricas', label: 'Métricas', icon: 'chart' },
      ] },
      { titulo: 'Control', items: [
        { id: 'seguridad', label: 'Seguridad', icon: 'doc' },
        { id: 'avisos', label: 'Avisos', icon: 'bell' },
        { id: 'parametros', label: 'Parámetros', icon: 'settings' },
      ] },
    ],
    tabs: ['inicio', 'verificacion', 'reservas', 'finanzas', 'mas'],
    extraTabs: { mas: { id: 'mas', label: 'Más', icon: 'menu' } },
  },
};
export const todasLasSecciones = (vista) => NAV[vista].grupos.flatMap((g) => g.items);

// Íconos que la TabBar del sistema ya trae; los demás se le pasan como nodo SVG
const DS_ICONOS = new Set(['home', 'paw', 'plus', 'cal', 'user', 'inbox', 'route', 'chat', 'check', 'info', 'alert', 'dog', 'cat', 'pin', 'clock', 'wallet']);

// ───────── Layout ─────────
export function Layout({ vista, ruta, perfil, conteos = {}, etiquetas, titulo, onSalir, onCambiarVista, tema, onTema, children }) {
  const nav = NAV[vista];
  const items = todasLasSecciones(vista).map((i) => (etiquetas && etiquetas[i.id] ? { ...i, label: etiquetas[i.id] } : i));
  const tabItems = nav.tabs.map((id) => {
    const it = items.find((i) => i.id === id) || nav.extraTabs?.[id];
    const icon = DS_ICONOS.has(it.icon) ? it.icon : html`<${Icon} name=${it.icon} />`;
    return { id: it.id, label: it.label, icon, featured: it.featured, badge: it.count && conteos[it.count] ? conteos[it.count] : undefined };
  });
  const actual = items.some((i) => i.id === ruta) || nav.extraTabs?.[ruta] ? ruta : items[0].id;
  const nombre = `${perfil.nombre} ${perfil.apellidos}`.trim();
  const iniciales = ((perfil.nombre || ' ')[0] + (perfil.apellidos || ' ')[0]).toUpperCase();
  const temaTxt = { auto: 'Tema automático', light: 'Tema claro', dark: 'Tema oscuro' }[tema];

  return html`<div class="app">
    <aside class="side" aria-label="Menú principal">
      <a class="side-logo" href=${'#/' + items[0].id} aria-label="LilieVET, inicio">
        <img class="full" src="img/lilievet-logo.svg" alt="LilieVET · Tu vet a domicilio" />
        <img class="mini" src="img/lilievet-corazon.svg" alt="" style=${{ display: 'none' }} />
      </a>
      ${nav.etiqueta && html`<div class="side-role"><${DS.Badge}>${nav.etiqueta}<//></div>`}
      <nav class="side-nav">
        ${nav.grupos.map((g, gi) => html`<div key=${gi} role="group" aria-label=${g.titulo || 'Secciones'}>
          ${g.titulo && html`<div class="side-group">${g.titulo}</div>`}
          ${g.items.map((i0) => items.find((x) => x.id === i0.id)).map((it) => html`<a key=${it.id} class="side-link" href=${'#/' + it.id} title=${it.label}
              aria-current=${actual === it.id ? 'page' : undefined}>
            <${Icon} name=${it.icon} /><span>${it.label}</span>
            ${it.count && conteos[it.count] ? html`<b class="count" aria-label=${conteos[it.count] + ' pendientes'}>${conteos[it.count]}</b>` : null}
          </a>`)}
        </div>`)}
      </nav>
      <div class="side-foot">
        ${onCambiarVista && html`<button class="side-link" type="button" onClick=${onCambiarVista} title=${vista === 'admin' ? 'Ver como médico veterinario' : 'Volver al Panel'}>
          <${Icon} name="swap" /><span>${vista === 'admin' ? 'Ver como médico veterinario' : 'Volver al Panel'}</span></button>`}
        <div class="who">
          <div class="lv-avatar" aria-hidden="true">${iniciales}</div>
          <div class="who-txt"><b>${nombre}</b><span>${perfil.correo || ''}</span></div>
        </div>
        <div class="side-tools">
          <button class="tool" type="button" onClick=${onTema} title=${temaTxt} aria-label=${temaTxt}><${Icon} name="moon" /><span>${{ auto: 'Automático', light: 'Claro', dark: 'Oscuro' }[tema]}</span></button>
          <button class="tool" type="button" onClick=${onSalir} title="Cerrar sesión" aria-label="Cerrar sesión"><${Icon} name="logout" /><span>Salir</span></button>
        </div>
      </div>
    </aside>

    <div class="main">
      <header class="topbar">
        <img src="img/lilievet-corazon.svg" alt="LilieVET" />
        <h1>${titulo}</h1>
        ${onCambiarVista && html`<button class="topbar-btn" type="button" onClick=${onCambiarVista} aria-label=${vista === 'admin' ? 'Ver como médico veterinario' : 'Volver al Panel'}><${Icon} name="swap" /></button>`}
        <button class="topbar-btn" type="button" onClick=${onTema} aria-label=${temaTxt}><${Icon} name="moon" /></button>
        <button class="topbar-btn" type="button" onClick=${onSalir} aria-label="Cerrar sesión"><${Icon} name="logout" /></button>
      </header>
      <main id="contenido">${children}</main>
      <div class="tabs"><${DS.TabBar} items=${tabItems} current=${actual} onSelect=${(id) => ir(id)} label="Secciones" /></div>
    </div>
  </div>`;
}

// Encabezado de página (en celular lo reemplaza la barra superior)
export function PageHead({ titulo, sub, children, keep }) {
  return html`<div class=${'page-head' + (keep ? ' keep' : '')}>
    <div><h1 class="titulo-1">${titulo}</h1>${sub && html`<p class="sub">${sub}</p>`}</div>
    ${children && html`<div class="page-head-actions">${children}</div>`}
  </div>`;
}

export function Cargando({ texto = 'Cargando…' }) {
  return html`<div class="loading" role="status"><div style=${{ textAlign: 'center' }}>
    <img src="img/lilievet-corazon.svg" alt="" /><p class="small" style=${{ marginTop: 12 }}>${texto}</p></div></div>`;
}

export function ErrorCarga({ error, onReintentar }) {
  return html`<${DS.Notice} tone="error" title="No pudimos cargar esta sección.">
    ${error?.message || ''} ${onReintentar && html`<button class="linkish" type="button" onClick=${onReintentar}>Intentar de nuevo</button>`}
  <//>`;
}

// Carga datos con estado de espera y error
export function useDatos(fn, deps = []) {
  const [st, setSt] = useState({ cargando: true, datos: null, error: null });
  const cargar = useCallback(() => {
    setSt((s) => ({ ...s, cargando: true, error: null }));
    fn().then((datos) => setSt({ cargando: false, datos, error: null }))
      .catch((error) => setSt({ cargando: false, datos: null, error }));
  }, deps);
  useEffect(() => { cargar(); }, [cargar]);
  return { ...st, recargar: cargar };
}
