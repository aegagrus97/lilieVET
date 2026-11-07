// Pantallas de acceso: entrar, crear cuenta, recuperar y cambiar contraseña.
import { html, DS, Icon, useState, quitarTitulo } from './lib.js';
import { api } from './api.js';
import { ir } from './shell.js';

function Marca() {
  return html`<section class="auth-brand" aria-hidden="false">
    <img src="img/lilievet-logo.svg" alt="LilieVET · Tu vet a domicilio" />
    <div class="row" style=${{ justifyContent: 'center' }}>
      <${DS.Character} who="liebe" size=${72} sticker />
      <${DS.Character} who="lilie" size=${66} sticker />
    </div>
    <div>
      <p class="claim">Un médico veterinario verificado, en tu casa.</p>
      <p class="claim-sub">Consultas a domicilio para perros y gatos en la Ciudad de México.</p>
    </div>
    <div class="auth-points">
      <div class="auth-point"><${Icon} name="shield" /><span>Revisamos la cédula profesional de cada médico veterinario antes de su primera consulta.</span></div>
      <div class="auth-point"><${Icon} name="wallet" /><span>Pagas en la app al agendar. El médico recibe su pago hasta que llega a tu casa.</span></div>
      <div class="auth-point"><${Icon} name="chat" /><span>Hablas con tu médico por el chat de la consulta. Tu número se queda privado.</span></div>
    </div>
  </section>`;
}

function Marco({ children }) {
  return html`<div class="auth">
    <${Marca} />
    <section class="auth-form"><div class="auth-card">
      <img class="auth-logo-m" src="img/lilievet-logo.svg" alt="LilieVET · Tu vet a domicilio" />
      ${children}
    </div></section>
  </div>`;
}

const conEnvio = (fn, setEnviando, setError) => async (e) => {
  e.preventDefault();
  setError(null); setEnviando(true);
  try { await fn(); } catch (err) { setError(err.message || 'Algo salió mal. Intenta de nuevo.'); }
  setEnviando(false);
};

export function Entrar() {
  const [correo, setCorreo] = useState('');
  const [pass, setPass] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const enviar = conEnvio(() => api.entrar(correo, pass), setEnviando, setError);
  return html`<${Marco}>
    <div><h1 class="titulo-2">Entra a tu cuenta</h1><p class="muted small" style=${{ marginTop: 4 }}>Tutores y médicos veterinarios entran aquí.</p></div>
    <form class="stack" onSubmit=${enviar} noValidate=${true}>
      <${DS.Field} label="Correo" type="email" autoComplete="email" required value=${correo} onChange=${(e) => setCorreo(e.target.value)} />
      <${DS.Field} label="Contraseña" type="password" autoComplete="current-password" required value=${pass} onChange=${(e) => setPass(e.target.value)} />
      ${error && html`<${DS.Notice} tone="error">${error}<//>`}
      <${DS.Button} type="submit" block disabled=${enviando || !correo || !pass}>${enviando ? 'Entrando…' : 'Entrar'}<//>
      <div class="spread small">
        <button type="button" class="linkish" onClick=${() => ir('recuperar')}>Olvidé mi contraseña</button>
      </div>
    </form>
    <div class="stack-sm" style=${{ paddingTop: 16, borderTop: '1px solid var(--line)' }}>
      <p class="small muted">¿Aún no tienes cuenta?</p>
      <${DS.Button} variant="secondary" block onClick=${() => ir('registro')}>Crear cuenta<//>
    </div>
  <//>`;
}

export function Registro() {
  const codigoUrl = new URLSearchParams(location.hash.split('?')[1] || '').get('codigo') || '';
  const [d, setD] = useState({ rol: 'tutor', nombre: '', apellidos: '', correo: '', telefono: '', password: '', codigo: codigoUrl, terminos: false, acepta_whatsapp: false, acepta_promos: false });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [toque, setToque] = useState(false);
  const set = (k) => (e) => setD({ ...d, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const errores = {
    nombre: !quitarTitulo(d.nombre) && 'Escribe tu nombre.',
    apellidos: !d.apellidos.trim() && 'Escribe tus apellidos.',
    correo: !/^\S+@\S+\.\S+$/.test(d.correo) && 'Escribe un correo válido.',
    telefono: !/^\d{10}$/.test(d.telefono.replace(/\D/g, '')) && 'Escribe tu celular a 10 dígitos.',
    password: d.password.length < 8 && 'Usa al menos 8 caracteres.',
    terminos: !d.terminos && 'Acepta los términos para continuar.',
  };
  const valido = !Object.values(errores).some(Boolean);
  const err = (k) => (toque ? errores[k] || undefined : undefined);

  const enviar = async (e) => {
    e.preventDefault(); setToque(true);
    if (!valido) return;
    await conEnvio(() => api.registrar({ ...d, nombre: quitarTitulo(d.nombre), telefono: d.telefono.replace(/\D/g, '') }), setEnviando, setError)(e);
  };

  return html`<${Marco}>
    <div><h1 class="titulo-2">Crea tu cuenta</h1><p class="muted small" style=${{ marginTop: 4 }}>Toma un par de minutos.</p></div>
    <form class="stack" onSubmit=${enviar} noValidate=${true}>
      <div class="role-pick" role="radiogroup" aria-label="Tipo de cuenta">
        <${DS.OptionCard} name="rol" size="sm" title="Soy tutor" description="Tengo perro o gato" checked=${d.rol === 'tutor'} onChange=${() => setD({ ...d, rol: 'tutor' })} />
        <${DS.OptionCard} name="rol" size="sm" title="Soy médico veterinario" description="Quiero dar consultas" checked=${d.rol === 'mvz'} onChange=${() => setD({ ...d, rol: 'mvz' })} />
      </div>
      <div class="field-row">
        <${DS.Field} label="Nombre" autoComplete="given-name" value=${d.nombre} onChange=${set('nombre')} error=${err('nombre')} />
        <${DS.Field} label="Apellidos" autoComplete="family-name" value=${d.apellidos} onChange=${set('apellidos')} error=${err('apellidos')} />
      </div>
      <${DS.Field} label="Correo" type="email" autoComplete="email" value=${d.correo} onChange=${set('correo')} error=${err('correo')} />
      <${DS.Field} label="Celular" type="tel" inputMode="numeric" autoComplete="tel-national" value=${d.telefono} onChange=${set('telefono')} error=${err('telefono')}
        hint=${d.rol === 'tutor' ? 'Para avisarte de tus consultas. No se lo mostramos al médico veterinario.' : 'Para avisarte de tus consultas. No se lo mostramos al tutor.'} />
      <${DS.Field} label="Contraseña" type="password" autoComplete="new-password" value=${d.password} onChange=${set('password')} error=${err('password')} hint="Al menos 8 caracteres." />
      ${d.rol === 'tutor' && html`<${DS.Field} label="Código de invitación (opcional)" value=${d.codigo} onChange=${set('codigo')} hint="Si alguien te invitó, recibes $100 de descuento en tu primera consulta." />`}
      ${d.rol === 'mvz' && html`<p class="small muted" style=${{ marginTop: -8 }}>Tu nombre como aparece en tu cédula, sin “Dr.” ni “Dra.”.</p>`}
      ${d.rol === 'mvz' && html`<${DS.Notice} tone="info">Después de crear tu cuenta completas tu alta: INE, una selfie con ella, tu cédula profesional y, si quieres, tu especialidad y tu CLABE. Revisamos cada solicitud antes de que recibas consultas.<//>`}
      <div class="stack-sm">
        <label class="check"><input type="checkbox" checked=${d.terminos} onChange=${set('terminos')} />
          <span>Acepto los <a href="#/terminos" target="_blank">Términos y condiciones</a> y el <a href="#/privacidad" target="_blank">Aviso de privacidad</a>.</span></label>
        ${err('terminos') && html`<small class="small" style=${{ color: 'var(--danger)', fontWeight: 500 }}>${errores.terminos}</small>`}
        <label class="check"><input type="checkbox" checked=${d.acepta_whatsapp} onChange=${set('acepta_whatsapp')} />
          <span>Quiero recibir la confirmación y el recordatorio de mis consultas por WhatsApp.</span></label>
        <label class="check"><input type="checkbox" checked=${d.acepta_promos} onChange=${set('acepta_promos')} />
          <span>Quiero recibir promociones de LilieVET.</span></label>
      </div>
      ${error && html`<${DS.Notice} tone="error">${error}<//>`}
      <${DS.Button} type="submit" block disabled=${enviando}>${enviando ? 'Creando tu cuenta…' : 'Crear cuenta'}<//>
    </form>
    <p class="small muted">¿Ya tienes cuenta? <button type="button" class="linkish" onClick=${() => ir('entrar')}>Entra aquí</button></p>
  <//>`;
}

export function Recuperar() {
  const [correo, setCorreo] = useState('');
  const [listo, setListo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const enviar = conEnvio(async () => { await api.recuperar(correo); setListo(true); }, setEnviando, setError);
  return html`<${Marco}>
    <div><h1 class="titulo-2">Recupera tu contraseña</h1><p class="muted small" style=${{ marginTop: 4 }}>Te mandamos un enlace a tu correo para crear una nueva.</p></div>
    ${listo
      ? html`<${DS.Notice} tone="exito" title="Listo.">Si ${correo} tiene una cuenta, en unos minutos te llega el enlace. Revisa también tu carpeta de spam.<//>`
      : html`<form class="stack" onSubmit=${enviar} noValidate=${true}>
          <${DS.Field} label="Correo" type="email" autoComplete="email" value=${correo} onChange=${(e) => setCorreo(e.target.value)} />
          ${error && html`<${DS.Notice} tone="error">${error}<//>`}
          <${DS.Button} type="submit" block disabled=${enviando || !correo}>${enviando ? 'Enviando…' : 'Enviar enlace'}<//>
        </form>`}
    <p class="small"><button type="button" class="linkish" onClick=${() => ir('entrar')}>Volver a entrar</button></p>
  <//>`;
}

export function NuevaContrasena({ onListo }) {
  const [pass, setPass] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const enviar = conEnvio(async () => { await api.nuevaContrasena(pass); onListo && onListo(); }, setEnviando, setError);
  return html`<${Marco}>
    <div><h1 class="titulo-2">Crea tu nueva contraseña</h1></div>
    <form class="stack" onSubmit=${enviar} noValidate=${true}>
      <${DS.Field} label="Nueva contraseña" type="password" autoComplete="new-password" value=${pass} onChange=${(e) => setPass(e.target.value)} hint="Al menos 8 caracteres." />
      ${error && html`<${DS.Notice} tone="error">${error}<//>`}
      <${DS.Button} type="submit" block disabled=${enviando || pass.length < 8}>${enviando ? 'Guardando…' : 'Guardar contraseña'}<//>
    </form>
  <//>`;
}

export function SinConfig() {
  return html`<${Marco}>
    <div><h1 class="titulo-2">Falta conectar Supabase</h1>
      <p class="muted small" style=${{ marginTop: 4 }}>Pega la Project URL y la clave publishable de tu proyecto en <b>config.js</b> y recarga la página. Los pasos están en LEEME.md.</p></div>
    <${DS.Notice} tone="info">Mientras tanto puedes revisar el diseño con datos de ejemplo. No se guarda nada.<//>
    <div class="stack-sm">
      <${DS.Button} block onClick=${() => { location.href = '?demo=tutor#/inicio'; }}>Ver muestra: tutor<//>
      <${DS.Button} variant="secondary" block onClick=${() => { location.href = '?demo=mvz#/hoy'; }}>Ver muestra: médico veterinario<//>
      <${DS.Button} variant="secondary" block onClick=${() => { location.href = '?demo=admin#/inicio'; }}>Ver muestra: Panel<//>
    </div>
  <//>`;
}
