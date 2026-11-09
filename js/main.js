// Punto de entrada: sesión → perfil → vista (tutor, médico veterinario o Panel).
import { html, React, useState, useEffect, useCallback } from './lib.js';
import { api } from './api.js';
import { Layout, ToastProvider, useRuta, ir, Cargando, ErrorCarga, NAV } from './shell.js';
import { Entrar, Registro, Recuperar, NuevaContrasena, SinConfig } from './auth.js';
import { InicioTutor } from './tutor/inicio.js';
import { Mascotas } from './tutor/mascotas.js';
import { PerfilTutor } from './tutor/perfil.js';
import { HoyMvz } from './mvz/hoy.js';
import { AltaMvz, PerfilMvz } from './mvz/alta.js';
import { Agenda } from './mvz/agenda.js';
import { InicioAdmin } from './admin/inicio.js';
import { Verificacion } from './admin/verificacion.js';
import { Proximamente, MasAdmin, tituloDe } from './secciones.js';

// ───────── Tema: automático, claro u oscuro ─────────
function useTema() {
  const [tema, setTema] = useState(() => { try { return localStorage.getItem('lv-tema') || 'auto'; } catch (e) { return 'auto'; } });
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const aplicar = () => { document.documentElement.dataset.theme = tema === 'auto' ? (mq.matches ? 'dark' : 'light') : tema; };
    aplicar();
    mq.addEventListener('change', aplicar);
    try { localStorage.setItem('lv-tema', tema); } catch (e) { /* sin almacenamiento */ }
    return () => mq.removeEventListener('change', aplicar);
  }, [tema]);
  const siguiente = () => setTema((t) => ({ auto: 'light', light: 'dark', dark: 'auto' }[t]));
  return [tema, siguiente];
}

const mvzAprobado = (perfil) => perfil.rol === 'mvz' && perfil.extra?.estado === 'aprobado';

function Vista({ vista, seccion, sub, perfil, onPerfil, setConteos }) {
  if (vista === 'tutor') {
    if (seccion === 'inicio') return html`<${InicioTutor} perfil=${perfil} />`;
    if (seccion === 'mascotas') return html`<${Mascotas} key=${sub || 'lista'} sub=${sub} />`;
    if (seccion === 'perfil') return html`<${PerfilTutor} perfil=${perfil} onPerfil=${onPerfil} />`;
    return html`<${Proximamente} vista="tutor" id=${seccion} />`;
  }
  if (vista === 'mvz') {
    if (seccion === 'hoy') return mvzAprobado(perfil) ? html`<${HoyMvz} perfil=${perfil} />` : html`<${AltaMvz} perfil=${perfil} onPerfil=${onPerfil} />`;
    if (seccion === 'perfil') return html`<${PerfilMvz} perfil=${perfil} onPerfil=${onPerfil} />`;
    if (seccion === 'agenda') return html`<${Agenda} perfil=${perfil} onPerfil=${onPerfil} sub=${sub} />`;
    return html`<${Proximamente} vista="mvz" id=${seccion} />`;
  }
  if (seccion === 'inicio') return html`<${InicioAdmin} onConteos=${setConteos} />`;
  if (seccion === 'verificacion') return html`<${Verificacion} key=${sub || 'cola'} sub=${sub} onConteos=${setConteos} />`;
  if (seccion === 'mas') return html`<${MasAdmin} />`;
  return html`<${Proximamente} vista="admin" id=${seccion} />`;
}

function App() {
  const ruta = useRuta();
  const [seccion, sub] = ruta.split('/');
  const [tema, cambiarTema] = useTema();
  const [sesion, setSesion] = useState(undefined);
  const [perfil, setPerfil] = useState(null);
  const [errorPerfil, setErrorPerfil] = useState(null);
  const [vista, setVista] = useState(null);
  const [conteos, setConteos] = useState({});

  useEffect(() => {
    api.session().then(setSesion);
    return api.onAuth((s) => setSesion(s));
  }, []);

  // Vuelve a leer el perfil sin quitar la pantalla (después de guardar o enviar a revisión)
  const recargarPerfil = useCallback(() => api.perfil().then((p) => { setPerfil(p); return p; }), []);

  useEffect(() => {
    if (!sesion) { setPerfil(null); setVista(null); return; }
    setErrorPerfil(null);
    api.perfil().then((p) => {
      setPerfil(p);
      const v = p.es_admin ? 'admin' : p.rol;
      setVista(v);
      const valida = NAV[v].grupos.flatMap((g) => g.items).some((i) => i.id === seccion) || (v === 'admin' && seccion === 'mas');
      if (!valida) ir(NAV[v].grupos[0].items[0].id);
      if (v === 'admin') api.conteosAdmin().then(setConteos).catch(() => {});
    }).catch(setErrorPerfil);
  }, [sesion]);

  if (api.mode === 'sin_config') return html`<${SinConfig} />`;
  if (seccion === 'nueva-contrasena' && sesion) return html`<${NuevaContrasena} onListo=${() => ir('')} />`;
  if (sesion === undefined) return html`<${Cargando} />`;
  if (!sesion) {
    if (seccion === 'registro') return html`<${Registro} />`;
    if (seccion === 'recuperar') return html`<${Recuperar} />`;
    return html`<${Entrar} />`;
  }
  if (errorPerfil) return html`<div class="page"><${ErrorCarga} error=${errorPerfil} onReintentar=${() => setSesion({ ...sesion })} /></div>`;
  if (!perfil || !vista) return html`<${Cargando} texto="Preparando tu cuenta…" />`;

  const cambiarVista = perfil.es_admin && perfil.rol === 'mvz'
    ? () => { const v = vista === 'admin' ? 'mvz' : 'admin'; setVista(v); ir(NAV[v].grupos[0].items[0].id); }
    : null;
  const items = NAV[vista].grupos.flatMap((g) => g.items);
  const actual = items.some((i) => i.id === seccion) || seccion === 'mas' ? seccion : items[0].id;
  const titulo = vista === 'mvz' && actual === 'hoy' && !mvzAprobado(perfil) ? 'Tu alta' : tituloDe(vista, actual);
  const etiquetas = vista === 'mvz' && !mvzAprobado(perfil) ? { hoy: 'Tu alta' } : null;

  return html`<${Layout} vista=${vista} ruta=${actual} perfil=${perfil} conteos=${conteos} etiquetas=${etiquetas}
      titulo=${titulo} tema=${tema} onTema=${cambiarTema}
      onSalir=${() => api.salir()} onCambiarVista=${cambiarVista}>
    <${Vista} vista=${vista} seccion=${actual} sub=${actual === seccion ? sub : undefined} perfil=${perfil} onPerfil=${recargarPerfil} setConteos=${setConteos} />
  <//>`;
}

ReactDOM.createRoot(document.getElementById('root')).render(html`<${ToastProvider}><${App} /><//>`);

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
