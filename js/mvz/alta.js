// Alta del médico veterinario: datos, identidad, cédula, especialidad y depósitos.
// Mientras no esté aprobado, "Hoy" muestra este asistente o el estado de su solicitud. Sin personajes.
import { html, DS, Icon, useState, useEffect, quitarTitulo, clabeValida, bancoDeClabe } from '../lib.js';
import { api } from '../api.js';
import { PageHead, useToast, useDatos, ir } from '../shell.js';
import { Seccion, SubirDocumento, EstadoVerif, NotaRevision, useEnvio } from '../componentes.js';
import { CambiarAcceso as CambiarAccesoMvz } from '../cuenta.js';

const bloqueadoAlta = (estado) => ['pendiente', 'en_revision', 'aprobado', 'suspendido'].includes(estado);
const enRevision = (e) => ['pendiente', 'en_revision', 'aprobado'].includes(e);

// ───────── Datos profesionales ─────────
export function DatosProfesionales({ perfil, onGuardado, enPaso, onSiguiente }) {
  const toast = useToast();
  const x = perfil.extra;
  const fijo = bloqueadoAlta(x.estado);
  const [d, setD] = useState({ nombre: perfil.nombre, apellidos: perfil.apellidos, telefono: perfil.telefono || '', cedula: x.cedula || '', bio: x.bio || '' });
  const [foto, setFoto] = useState(api.fotoUrl(x.foto_path));
  const [subiendoFoto, setSubiendoFoto] = useState(null);
  const [toque, setToque] = useState(false);
  const [envio, correr] = useEnvio();
  const set = (k) => (e) => setD({ ...d, [k]: e.target.value });
  const errores = {
    nombre: !quitarTitulo(d.nombre) && 'Escribe tu nombre.',
    apellidos: !d.apellidos.trim() && 'Escribe tus apellidos.',
    telefono: !/^\d{10}$/.test(d.telefono.replace(/\D/g, '')) && 'Escribe tu celular a 10 dígitos.',
    cedula: !/^\d{5,8}$/.test(d.cedula.trim()) && 'Escribe el número de tu cédula profesional (solo números).',
  };
  const err = (k) => (toque ? errores[k] || undefined : undefined);
  const guardar = async (e) => {
    e.preventDefault(); setToque(true);
    if (Object.values(errores).some(Boolean)) return;
    const ok = await correr(async () => {
      const p = { telefono: d.telefono.replace(/\D/g, '') };
      if (!fijo) Object.assign(p, { nombre: quitarTitulo(d.nombre), apellidos: d.apellidos.trim() });
      await api.guardarPerfil(p);
      const m = { bio: d.bio.trim() };
      if (!fijo) m.cedula = d.cedula.trim();
      await api.guardarMvz(m);
    });
    if (ok) {
      onGuardado && await onGuardado();
      if (enPaso) onSiguiente(); else toast('Guardamos tus datos.');
    }
  };
  const elegirFoto = async (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = '';
    if (!f) return;
    setSubiendoFoto('subiendo');
    try { const ruta = await api.subirFoto(f); setFoto(api.fotoUrl(ruta)); setSubiendoFoto(null); onGuardado && onGuardado(); }
    catch (er) { setSubiendoFoto(er.message || 'No se pudo subir la foto.'); }
  };
  const iniciales = ((d.nombre || ' ')[0] + (d.apellidos || ' ')[0]).toUpperCase();

  return html`<form class="stack" onSubmit=${guardar} noValidate=${true}>
    <div class="foto-row">
      <div class="lv-avatar foto-av">${foto ? html`<img src=${foto} alt="Tu foto de perfil" />` : iniciales}</div>
      <div class="stack-sm">
        <b class="small">Foto de perfil (opcional)</b>
        <span class="small muted">Los tutores la ven al agendar. De frente y con buena luz.</span>
        <label class="lv-btn lv-btn-ghost lv-btn-sm foto-btn">
          <input class="sr-only" type="file" accept="image/*" onChange=${elegirFoto} disabled=${subiendoFoto === 'subiendo'} />
          ${subiendoFoto === 'subiendo' ? 'Subiendo…' : foto ? 'Cambiar foto' : 'Subir foto'}
        </label>
        ${subiendoFoto && subiendoFoto !== 'subiendo' && html`<span class="small doc-error" role="alert">${subiendoFoto}</span>`}
      </div>
    </div>
    <div class="field-row">
      <${DS.Field} label="Nombre" autoComplete="given-name" value=${d.nombre} onChange=${set('nombre')} error=${err('nombre')} disabled=${fijo} />
      <${DS.Field} label="Apellidos" autoComplete="family-name" value=${d.apellidos} onChange=${set('apellidos')} error=${err('apellidos')} disabled=${fijo} />
    </div>
    <p class="small muted">${fijo ? 'Tu nombre y tu cédula ya están en revisión o aprobados. Para corregirlos escribe a soporte.'
      : 'Como aparecen en tu INE y en tu cédula. En LilieVET los médicos veterinarios aparecen solo con su nombre, sin “Dr.” ni “Dra.”.'}</p>
    <div class="field-row">
      <${DS.Field} label="Número de cédula profesional" inputMode="numeric" value=${d.cedula} onChange=${set('cedula')} error=${err('cedula')} disabled=${fijo} />
      <${DS.Field} label="Celular" type="tel" inputMode="numeric" autoComplete="tel-national" value=${d.telefono} onChange=${set('telefono')} error=${err('telefono')} hint="No se lo mostramos al tutor." />
    </div>
    <${DS.Field} as="textarea" rows=${3} label="Cómo te presentas (opcional)" value=${d.bio} onChange=${set('bio')} maxLength=${400}
      hint="Una o dos frases para los tutores: experiencia, en qué te enfocas." />
    ${envio.error && html`<${DS.Notice} tone="error">${envio.error}<//>`}
    <div class="row">
      <${DS.Button} type="submit" variant=${enPaso ? 'primary' : 'secondary'} disabled=${envio.enviando}>${envio.enviando ? 'Guardando…' : enPaso ? 'Guardar y seguir' : 'Guardar cambios'}<//>
    </div>
  </form>`;
}

// ───────── Especialidad ─────────
export function Especialidad({ perfil, onGuardado, enPaso, onSiguiente, onAtras, subidos, onSubido }) {
  const toast = useToast();
  const x = perfil.extra;
  const { datos: lista } = useDatos(() => api.especialidades(), []);
  const [tiene, setTiene] = useState(x.especialidad_id != null);
  const [esp, setEsp] = useState(x.especialidad_id ? String(x.especialidad_id) : '');
  const [cambiar, setCambiar] = useState(false);
  const [envio, correr] = useEnvio();
  const fija = enRevision(x.estado_especialidad) && !cambiar;
  const nota = perfil.verif.notas.especialidad;

  const guardar = async (mandar) => {
    if (tiene && !esp) return correr(async () => { throw new Error('Elige tu especialidad.'); });
    const ok = await correr(async () => {
      const nueva = tiene ? Number(esp) : null;
      if (nueva !== (x.especialidad_id ?? null)) await api.guardarMvz({ especialidad_id: nueva });
      if (mandar) await api.enviarVerificacion('especialidad');
    });
    if (ok) {
      setCambiar(false);
      onGuardado && await onGuardado();
      if (enPaso) onSiguiente(); else toast(mandar ? 'Enviamos tu especialidad a revisión.' : 'Guardamos tu especialidad.');
    }
  };

  if (fija) {
    return html`<div class="stack">
      <div class="spread"><div><b>${x.especialidades?.nombre}</b><div class="small muted">${x.estado_especialidad === 'aprobado' ? 'Los tutores pueden agendar contigo consultas de especialidad.' : 'La estamos revisando.'}</div></div>
        <${EstadoVerif} estado=${x.estado_especialidad} /></div>
      <div><${DS.Button} variant="ghost" size="sm" onClick=${() => setCambiar(true)}>Cambiar especialidad<//></div>
    </div>`;
  }

  const puedeMandar = !enPaso && x.estado !== 'sin_enviar' && tiene && esp && subidos.especialidad && !['pendiente', 'en_revision'].includes(x.estado_especialidad);
  return html`<div class="stack">
    <${NotaRevision} nota=${nota} estado=${x.estado_especialidad} />
    ${cambiar && html`<${DS.Notice} tone="info">Si cambias de especialidad, la revisamos de nuevo antes de mostrarla a los tutores.<//>`}
    <div class="role-pick" role="radiogroup" aria-label="Especialidad">
      <${DS.OptionCard} name="esp" size="sm" title="Consulta general" description="No tengo especialidad" checked=${!tiene} onChange=${() => setTiene(false)} />
      <${DS.OptionCard} name="esp" size="sm" title="Tengo especialidad" description="Con cédula o diploma" checked=${tiene} onChange=${() => setTiene(true)} />
    </div>
    ${tiene && html`<div class="stack">
      <${DS.Field} as="select" label="Especialidad" value=${esp} onChange=${(e) => setEsp(e.target.value)}
        options=${[{ value: '', label: lista ? 'Elige una' : 'Cargando…' }, ...(lista || []).map((l) => ({ value: String(l.id), label: l.nombre }))]} />
      <div class="docs"><${SubirDocumento} tipo="especialidad" subido=${subidos.especialidad} onSubido=${(r) => onSubido('especialidad', r)} /></div>
      <p class="small muted">Podrás cobrar consultas de especialidad (desde $1,000) cuando la aprobemos. Si no aparece la tuya, escríbenos.</p>
    </div>`}
    ${envio.error && html`<${DS.Notice} tone="error">${envio.error}<//>`}
    <div class="row">
      ${enPaso && html`<${DS.Button} variant="ghost" onClick=${onAtras}>Atrás<//>`}
      ${enPaso
        ? html`<${DS.Button} onClick=${() => guardar(false)} disabled=${envio.enviando || (tiene && (!esp || !subidos.especialidad))}>${envio.enviando ? 'Guardando…' : 'Seguir'}<//>`
        : html`<${DS.Button} variant="secondary" onClick=${() => guardar(!!puedeMandar)} disabled=${envio.enviando || (tiene && !esp)}>
            ${envio.enviando ? 'Guardando…' : puedeMandar ? 'Enviar a revisión' : 'Guardar'}<//>`}
      ${cambiar && html`<${DS.Button} variant="ghost" onClick=${() => setCambiar(false)}>Cancelar<//>`}
    </div>
    ${!enPaso && x.estado === 'sin_enviar' && tiene && html`<p class="small muted">Se envía junto con tu solicitud de alta.</p>`}
  </div>`;
}

// ───────── Depósitos (CLABE) ─────────
export function Depositos({ perfil, onGuardado, enPaso, onSiguiente, onAtras, subidos, onSubido }) {
  const toast = useToast();
  const x = perfil.extra;
  const [d, setD] = useState({ clabe: x.clabe || '', banco: x.banco || '', titular_clabe: x.titular_clabe || nombreDe(perfil), rfc: x.rfc || '' });
  const [cambiar, setCambiar] = useState(false);
  const [toque, setToque] = useState(false);
  const [envio, correr] = useEnvio();
  const fija = enRevision(x.estado_clabe) && !cambiar;
  const nota = perfil.verif.notas.clabe;
  const set = (k) => (e) => {
    const v = e.target.value;
    setD((s) => {
      const n = { ...s, [k]: k === 'clabe' ? v.replace(/\D/g, '').slice(0, 18) : k === 'rfc' ? v.toUpperCase() : v };
      if (k === 'clabe' && n.clabe.length >= 3 && (!s.banco || s.banco === bancoDeClabe(s.clabe))) n.banco = bancoDeClabe(n.clabe) || s.banco;
      return n;
    });
  };
  const errores = {
    clabe: !clabeValida(d.clabe) && (d.clabe.length === 18 ? 'Revisa la CLABE: el último dígito no coincide.' : 'La CLABE tiene 18 dígitos.'),
    banco: !d.banco.trim() && 'Escribe el banco.',
    titular_clabe: !d.titular_clabe.trim() && 'Escribe el nombre del titular.',
    rfc: d.rfc && !/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(d.rfc.trim()) && 'Revisa el RFC (13 caracteres para persona física).',
  };
  const err = (k) => (toque ? errores[k] || undefined : undefined);
  const valido = !Object.values(errores).some(Boolean);

  const guardar = async (mandar) => {
    setToque(true);
    if (!valido) return;
    const ok = await correr(async () => {
      const m = { clabe: d.clabe, banco: d.banco.trim(), titular_clabe: d.titular_clabe.trim(), rfc: d.rfc.trim() || null };
      if (m.clabe !== x.clabe || m.banco !== x.banco || m.titular_clabe !== x.titular_clabe || m.rfc !== (x.rfc || null)) await api.guardarMvz(m);
      if (mandar) await api.enviarVerificacion('clabe');
    });
    if (ok) {
      setCambiar(false);
      onGuardado && await onGuardado();
      if (enPaso) onSiguiente(); else toast(mandar ? 'Enviamos tu CLABE a revisión.' : 'Guardamos tus datos de depósito.');
    }
  };

  if (fija) {
    return html`<div class="stack">
      <div class="spread"><div><b class="num">${x.banco} · •••• ${String(x.clabe || '').slice(-4)}</b><div class="small muted">A nombre de ${x.titular_clabe}</div></div>
        <${EstadoVerif} estado=${x.estado_clabe} /></div>
      <div><${DS.Button} variant="ghost" size="sm" onClick=${() => setCambiar(true)}>Cambiar CLABE<//></div>
    </div>`;
  }

  const puedeMandar = !enPaso && x.estado !== 'sin_enviar' && subidos.estado_cuenta;
  return html`<div class="stack">
    <${NotaRevision} nota=${nota} estado=${x.estado_clabe} />
    ${cambiar && html`<${DS.Notice} tone="info">Si cambias tu CLABE la revisamos de nuevo. Tus depósitos esperan hasta que la aprobemos.<//>`}
    <div class="field-row">
      <${DS.Field} label="CLABE" inputMode="numeric" autoComplete="off" value=${d.clabe} onChange=${set('clabe')} error=${err('clabe')} hint="18 dígitos. Te depositamos por SPEI." />
      <${DS.Field} label="Banco" value=${d.banco} onChange=${set('banco')} error=${err('banco')} />
    </div>
    <div class="field-row">
      <${DS.Field} label="Titular de la cuenta" value=${d.titular_clabe} onChange=${set('titular_clabe')} error=${err('titular_clabe')} hint="Debe ser a tu nombre." />
      <${DS.Field} label="RFC (opcional)" value=${d.rfc} onChange=${set('rfc')} error=${err('rfc')} maxLength=${13} />
    </div>
    <div class="docs"><${SubirDocumento} tipo="estado_cuenta" subido=${subidos.estado_cuenta} onSubido=${(r) => onSubido('estado_cuenta', r)} /></div>
    ${envio.error && html`<${DS.Notice} tone="error">${envio.error}<//>`}
    <div class="row">
      ${enPaso && html`<${DS.Button} variant="ghost" onClick=${onAtras}>Atrás<//>`}
      ${enPaso
        ? html`<${DS.Button} onClick=${() => guardar(false)} disabled=${envio.enviando}>${envio.enviando ? 'Guardando…' : 'Seguir'}<//>
               <${DS.Button} variant="ghost" onClick=${onSiguiente}>Lo hago después<//>`
        : html`<${DS.Button} variant="secondary" onClick=${() => guardar(!!puedeMandar)} disabled=${envio.enviando}>
            ${envio.enviando ? 'Guardando…' : puedeMandar ? 'Guardar y enviar a revisión' : 'Guardar'}<//>`}
      ${cambiar && html`<${DS.Button} variant="ghost" onClick=${() => setCambiar(false)}>Cancelar<//>`}
    </div>
    ${!enPaso && x.estado === 'sin_enviar' && html`<p class="small muted">Se envía junto con tu solicitud de alta.</p>`}
  </div>`;
}
const nombreDe = (p) => `${p.nombre} ${p.apellidos}`.trim();
const clabeCompleta = (x) => clabeValida(x.clabe) && x.banco && x.titular_clabe;

// ───────── Asistente de alta ─────────
const PASOS = ['Tus datos', 'Identidad', 'Cédula', 'Especialidad', 'Depósitos', 'Revisa y envía'];

function Asistente({ perfil, onPerfil, inicio = 1, onListo }) {
  const toast = useToast();
  const [paso, setPaso] = useState(inicio);
  const [subidos, setSubidos] = useState(perfil.verif.subidos);
  const [envio, correr] = useEnvio();
  const x = perfil.extra;
  const onSubido = (t, r) => setSubidos((s) => ({ ...s, [t]: r }));
  const ir_ = (n) => { setPaso(n); window.scrollTo(0, 0); };
  const sig = () => ir_(paso + 1);
  const atras = () => ir_(paso - 1);
  const nota = perfil.verif.notas.alta_mvz;
  const docsId = ['ine_frente', 'ine_reverso', 'selfie_ine'];

  const lista = [
    ['Datos y número de cédula', !!(/^\d{5,8}$/.test(x.cedula || '') && perfil.nombre && perfil.apellidos), 1],
    ['INE (frente y reverso) y selfie', docsId.every((t) => subidos[t]), 2],
    ['Cédula profesional escaneada', !!subidos.cedula, 3],
    x.especialidad_id ? ['Especialidad y su documento', subidos.especialidad ? x.especialidades?.nombre || 'Elegida' : false, 4, false] : ['Especialidad', 'Consulta general', 4, true],
    ['CLABE para tus depósitos', clabeCompleta(x) && subidos.estado_cuenta ? `${x.banco} · •••• ${x.clabe.slice(-4)}` : 'La completas después', 5, true],
  ];
  const listoParaEnviar = lista.every(([, ok, , opcional]) => ok || opcional);

  const enviar = async () => {
    const ok = await correr(async () => {
      await api.enviarVerificacion('alta_mvz');
      const avisos = [];
      if (x.especialidad_id && subidos.especialidad && ['sin_enviar', 'info_requerida'].includes(x.estado_especialidad)) {
        try { await api.enviarVerificacion('especialidad'); } catch (e) { avisos.push('especialidad: ' + e.message); }
      }
      if (clabeCompleta(x) && subidos.estado_cuenta && ['sin_enviar', 'info_requerida'].includes(x.estado_clabe)) {
        try { await api.enviarVerificacion('clabe'); } catch (e) { avisos.push('CLABE: ' + e.message); }
      }
      return avisos;
    });
    if (ok) {
      toast('Recibimos tu solicitud. Te avisamos por correo.');
      if (Array.isArray(ok) && ok.length) toast('Revisa en tu perfil: ' + ok.join(' · '), { tone: 'info' });
      await onPerfil();
      onListo && onListo();
    }
  };

  return html`<div class="page page-narrow">
    <${PageHead} keep titulo=${x.estado === 'info_requerida' ? 'Corrige tu solicitud' : 'Completa tu alta'}
      sub="Revisamos cada solicitud antes de que recibas consultas. Toma unos 10 minutos." />
    <${DS.Steps} total=${PASOS.length} current=${paso} label=${PASOS[paso - 1]} />
    ${paso === 1 && html`<${NotaRevision} nota=${nota} estado=${x.estado} />`}
    <section class="box">
      ${paso === 1 && html`<div class="stack"><h2 class="section-title">Tus datos</h2>
        <${DatosProfesionales} perfil=${perfil} onGuardado=${onPerfil} enPaso onSiguiente=${sig} /></div>`}

      ${paso === 2 && html`<div class="stack"><div><h2 class="section-title">Tu identidad</h2>
          <p class="small muted" style=${{ marginTop: 4 }}>Fotos claras, sin reflejos. Solo el equipo de LilieVET las ve; los tutores nunca.</p></div>
        <div class="docs">${docsId.map((t) => html`<${SubirDocumento} key=${t} tipo=${t} subido=${subidos[t]} onSubido=${(r) => onSubido(t, r)} />`)}</div>
        <div class="row"><${DS.Button} variant="ghost" onClick=${atras}>Atrás<//>
          <${DS.Button} onClick=${sig} disabled=${!docsId.every((t) => subidos[t])}>Seguir<//></div></div>`}

      ${paso === 3 && html`<div class="stack"><div><h2 class="section-title">Tu cédula profesional</h2>
          <p class="small muted" style=${{ marginTop: 4 }}>La comparamos con el Registro Nacional de Profesionistas. Puede que te pidamos una videollamada breve o te escribamos por WhatsApp.</p></div>
        <div class="docs"><${SubirDocumento} tipo="cedula" subido=${subidos.cedula} onSubido=${(r) => onSubido('cedula', r)} /></div>
        <div class="row"><${DS.Button} variant="ghost" onClick=${atras}>Atrás<//>
          <${DS.Button} onClick=${sig} disabled=${!subidos.cedula}>Seguir<//></div></div>`}

      ${paso === 4 && html`<div class="stack"><h2 class="section-title">¿Tienes especialidad?</h2>
        <${Especialidad} perfil=${perfil} onGuardado=${onPerfil} enPaso onSiguiente=${sig} onAtras=${atras} subidos=${subidos} onSubido=${onSubido} /></div>`}

      ${paso === 5 && html`<div class="stack"><div><h2 class="section-title">¿Dónde te depositamos?</h2>
          <p class="small muted" style=${{ marginTop: 4 }}>Te pagamos por SPEI cuando cierras cada consulta. Puedes completarlo después, pero sin CLABE aprobada no podemos depositarte.</p></div>
        <${Depositos} perfil=${perfil} onGuardado=${onPerfil} enPaso onSiguiente=${sig} onAtras=${atras} subidos=${subidos} onSubido=${onSubido} /></div>`}

      ${paso === 6 && html`<div class="stack"><h2 class="section-title">Revisa y envía</h2>
        <ul class="checklist">${lista.map(([txt, ok, n, opcional]) => html`<li key=${n} class=${ok ? 'ok' : opcional ? 'opt' : 'falta'}>
          <${Icon} name=${ok ? 'check' : opcional ? 'info' : 'alert'} />
          <div><b>${txt}</b>${typeof ok === 'string' ? html`<span class="small muted">${ok}</span>` : !ok && !opcional ? html`<span class="small doc-error">Falta</span>` : null}</div>
          <button type="button" class="linkish" onClick=${() => ir_(n)}>Editar</button>
        </li>`)}</ul>
        ${envio.error && html`<${DS.Notice} tone="error">${envio.error}<//>`}
        <div class="row"><${DS.Button} variant="ghost" onClick=${atras}>Atrás<//>
          <${DS.Button} onClick=${enviar} disabled=${!listoParaEnviar || envio.enviando}>${envio.enviando ? 'Enviando…' : x.estado === 'info_requerida' ? 'Enviar de nuevo' : 'Enviar solicitud'}<//></div>
        <p class="small muted">Al enviar confirmas que los datos y documentos son tuyos y están vigentes.</p></div>`}
    </section>
  </div>`;
}

// ───────── Estado de la solicitud ─────────
function EstadoSolicitud({ perfil, onCorregir }) {
  const x = perfil.extra;
  const filas = [
    ['alta_mvz', 'Identidad y cédula', x.estado],
    ...(x.especialidad_id ? [['especialidad', `Especialidad: ${x.especialidades?.nombre || ''}`, x.estado_especialidad]] : []),
    ['clabe', 'CLABE para tus depósitos', x.estado_clabe],
  ];
  const titulo = { pendiente: 'Tu solicitud está en revisión', en_revision: 'Tu solicitud está en revisión', info_requerida: 'Hay algo que corregir', rechazado: 'No pudimos aprobar tu solicitud', suspendido: 'Tu cuenta está suspendida' }[x.estado];
  return html`<div class="page page-narrow">
    <${PageHead} keep titulo=${titulo} sub=${x.estado === 'pendiente' ? 'Te avisamos por correo en cuanto la revisemos.' : null} />
    <${NotaRevision} nota=${perfil.verif.notas.alta_mvz} estado=${x.estado} />
    <section class="box">
      <ul class="checklist">${filas.map(([obj, txt, est]) => html`<li key=${obj} class=${est === 'aprobado' ? 'ok' : ''}>
        <${Icon} name=${est === 'aprobado' ? 'check' : est === 'sin_enviar' ? 'info' : est === 'info_requerida' || est === 'rechazado' ? 'alert' : 'clock'} />
        <div><b>${txt}</b>${est === 'sin_enviar' && obj === 'clabe' ? html`<span class="small muted">Complétala en tu perfil para recibir depósitos.</span>` : null}</div>
        <${EstadoVerif} estado=${est} />
      </li>`)}</ul>
    </section>
    ${['pendiente', 'en_revision'].includes(x.estado) && html`<${DS.Notice} tone="info" title="Cómo revisamos.">
      Comparamos tu INE con tu selfie y tu cédula con el Registro Nacional de Profesionistas. Puede que te pidamos una videollamada breve o te escribamos por WhatsApp.<//>`}
    <div class="row">
      ${x.estado === 'info_requerida' && html`<${DS.Button} onClick=${onCorregir}>Corregir mi solicitud<//>`}
      <${DS.Button} variant="secondary" onClick=${() => ir('perfil')}>Ir a mi perfil<//>
    </div>
    <section class="box box-tight soon">
      <${Icon} name="info" />
      <div><b class="small">Cuando te aprobemos</b>
        <ul class="small"><li>Configuras tu alcaldía, horario y precios (fase 5).</li><li>Tus bloques de 2 horas aparecen a los tutores de tu alcaldía.</li></ul></div>
    </section>
  </div>`;
}

export function AltaMvz({ perfil, onPerfil }) {
  const [corrigiendo, setCorrigiendo] = useState(false);
  const e = perfil.extra.estado;
  if (e === 'sin_enviar' || (e === 'info_requerida' && corrigiendo)) {
    return html`<${Asistente} perfil=${perfil} onPerfil=${onPerfil} onListo=${() => setCorrigiendo(false)} />`;
  }
  return html`<${EstadoSolicitud} perfil=${perfil} onCorregir=${() => setCorrigiendo(true)} />`;
}

// ───────── Perfil del médico veterinario ─────────
export function PerfilMvz({ perfil, onPerfil }) {
  const [subidos, setSubidos] = useState(perfil.verif.subidos);
  useEffect(() => setSubidos(perfil.verif.subidos), [perfil]);
  const onSubido = (t, r) => setSubidos((s) => ({ ...s, [t]: r }));
  const x = perfil.extra;
  return html`<div class="page">
    <${PageHead} titulo="Perfil" sub=${perfil.correo}>
      ${x.estado !== 'aprobado' && html`<${DS.Button} variant="secondary" onClick=${() => ir('hoy')}>Ver mi solicitud<//>`}
    <//>
    <div class="grid-2">
      <div class="stack">
        <${Seccion} id="profesional" titulo="Datos profesionales" extra=${html`<${EstadoVerif} estado=${x.estado} />`}>
          <${DatosProfesionales} perfil=${perfil} onGuardado=${onPerfil} />
        <//>
        <${Seccion} id="especialidad" titulo="Especialidad">
          <${Especialidad} perfil=${perfil} onGuardado=${onPerfil} subidos=${subidos} onSubido=${onSubido} />
        <//>
        <${Seccion} id="depositos" titulo="Depósitos" sub="Te pagamos por SPEI a esta cuenta.">
          <${Depositos} perfil=${perfil} onGuardado=${onPerfil} subidos=${subidos} onSubido=${onSubido} />
        <//>
      </div>
      <aside class="stack" aria-label="Acceso y lo que viene">
        <${CambiarAccesoMvz} perfil=${perfil} />
        <section class="box box-tight soon">
          <${Icon} name="info" />
          <div><b class="small">Llegan después</b>
            <ul class="small"><li>Alcaldía, horario y precios (fase 5)</li><li>Catálogo de vacunas y desparasitantes (fase 5)</li><li>Datos fiscales (fase 9)</li></ul></div>
        </section>
      </aside>
    </div>
  </div>`;
}
