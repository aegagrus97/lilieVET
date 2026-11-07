// Datos de la cuenta que comparten tutor y médico veterinario.
import { html, DS, useState, quitarTitulo } from './lib.js';
import { api } from './api.js';
import { useToast } from './shell.js';
import { Seccion, useEnvio } from './componentes.js';

// Nombre, apellidos, celular y avisos. Con la identidad enviada o aprobada, el nombre ya no se edita aquí.
export function DatosPersonales({ perfil, onGuardado, bloqueado, conAvisos = true, titulo = 'Tus datos' }) {
  const toast = useToast();
  const [d, setD] = useState({ nombre: perfil.nombre, apellidos: perfil.apellidos, telefono: perfil.telefono || '',
    acepta_whatsapp: !!perfil.acepta_whatsapp, acepta_promos: !!perfil.acepta_promos });
  const [toque, setToque] = useState(false);
  const [envio, correr] = useEnvio();
  const set = (k) => (e) => setD({ ...d, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const errores = {
    nombre: !quitarTitulo(d.nombre) && 'Escribe tu nombre.',
    apellidos: !d.apellidos.trim() && 'Escribe tus apellidos.',
    telefono: !/^\d{10}$/.test(d.telefono.replace(/\D/g, '')) && 'Escribe tu celular a 10 dígitos.',
  };
  const err = (k) => (toque ? errores[k] || undefined : undefined);
  const guardar = async (e) => {
    e.preventDefault(); setToque(true);
    if (Object.values(errores).some(Boolean)) return;
    const cambios = { telefono: d.telefono.replace(/\D/g, '') };
    if (conAvisos) Object.assign(cambios, { acepta_whatsapp: d.acepta_whatsapp, acepta_promos: d.acepta_promos });
    if (!bloqueado) Object.assign(cambios, { nombre: quitarTitulo(d.nombre), apellidos: d.apellidos.trim() });
    if (await correr(() => api.guardarPerfil(cambios))) {
      if (!bloqueado && quitarTitulo(d.nombre) !== d.nombre.trim()) setD((x) => ({ ...x, nombre: quitarTitulo(x.nombre) }));
      toast('Guardamos tus datos.');
      onGuardado && onGuardado();
    }
  };
  return html`<${Seccion} id="datos" titulo=${titulo}>
    <form class="stack" onSubmit=${guardar} noValidate=${true}>
      <div class="field-row">
        <${DS.Field} label="Nombre" autoComplete="given-name" value=${d.nombre} onChange=${set('nombre')} error=${err('nombre')} disabled=${bloqueado} />
        <${DS.Field} label="Apellidos" autoComplete="family-name" value=${d.apellidos} onChange=${set('apellidos')} error=${err('apellidos')} disabled=${bloqueado} />
      </div>
      ${bloqueado
        ? html`<p class="small muted">Tu nombre ya está ligado a tu INE. Si hay un error, escríbenos a soporte y lo corregimos.</p>`
        : html`<p class="small muted">Como aparece en tu INE, sin títulos como “Dr.” o “Dra.”.</p>`}
      <${DS.Field} label="Celular" type="tel" inputMode="numeric" autoComplete="tel-national" value=${d.telefono} onChange=${set('telefono')} error=${err('telefono')}
        hint=${perfil.rol === 'tutor' ? 'No se lo mostramos al médico veterinario.' : 'No se lo mostramos al tutor.'} />
      ${conAvisos && html`<div class="stack-sm">
        <label class="check"><input type="checkbox" checked=${d.acepta_whatsapp} onChange=${set('acepta_whatsapp')} />
          <span>Quiero recibir la confirmación y el recordatorio de mis consultas por WhatsApp.</span></label>
        <label class="check"><input type="checkbox" checked=${d.acepta_promos} onChange=${set('acepta_promos')} />
          <span>Quiero recibir promociones de LilieVET.</span></label>
      </div>`}
      ${envio.error && html`<${DS.Notice} tone="error">${envio.error}<//>`}
      <div><${DS.Button} type="submit" variant="secondary" disabled=${envio.enviando}>${envio.enviando ? 'Guardando…' : 'Guardar cambios'}<//></div>
    </form>
  <//>`;
}

// Correo y contraseña
export function CambiarAcceso({ perfil }) {
  const toast = useToast();
  const [pass, setPass] = useState('');
  const [correo, setCorreo] = useState('');
  const [envioP, correrP] = useEnvio();
  const [envioC, correrC] = useEnvio();
  const cambiarPass = async (e) => {
    e.preventDefault();
    if (await correrP(() => api.nuevaContrasena(pass))) { setPass(''); toast('Cambiamos tu contraseña.'); }
  };
  const cambiarCorreo = async (e) => {
    e.preventDefault();
    if (await correrC(() => api.cambiarCorreo(correo))) { toast('Te mandamos un enlace a ' + correo.trim() + ' para confirmar el cambio.'); setCorreo(''); }
  };
  return html`<${Seccion} id="acceso" titulo="Correo y contraseña" sub=${'Entras con ' + (perfil.correo || 'tu correo')}>
    <div class="grid-acceso">
      <form class="stack-sm" onSubmit=${cambiarPass} noValidate=${true}>
        <${DS.Field} label="Nueva contraseña" type="password" autoComplete="new-password" value=${pass} onChange=${(e) => setPass(e.target.value)} hint="Al menos 8 caracteres." />
        ${envioP.error && html`<${DS.Notice} tone="error">${envioP.error}<//>`}
        <div><${DS.Button} type="submit" variant="secondary" size="sm" disabled=${pass.length < 8 || envioP.enviando}>${envioP.enviando ? 'Guardando…' : 'Cambiar contraseña'}<//></div>
      </form>
      <form class="stack-sm" onSubmit=${cambiarCorreo} noValidate=${true}>
        <${DS.Field} label="Nuevo correo" type="email" autoComplete="email" value=${correo} onChange=${(e) => setCorreo(e.target.value)} hint="Te mandamos un enlace para confirmarlo." />
        ${envioC.error && html`<${DS.Notice} tone="error">${envioC.error}<//>`}
        <div><${DS.Button} type="submit" variant="ghost" size="sm" disabled=${!/^\S+@\S+\.\S+$/.test(correo) || envioC.enviando}>${envioC.enviando ? 'Enviando…' : 'Cambiar correo'}<//></div>
      </form>
    </div>
  <//>`;
}
