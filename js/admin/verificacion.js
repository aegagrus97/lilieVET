// Panel · Verificación: cola de revisión, documentos de cada cuenta, decisiones e historial.
import { html, DS, Icon, useState, useEffect, OBJETO_VERIF, DECISION, DOC, ESTADO_VERIF, hace, fechaCorta, hora, diaRelativo,
  nombreCompleto, ordenarCola, capital, fechaLarga } from '../lib.js';
import { api } from '../api.js';
import { PageHead, Cargando, ErrorCarga, useDatos, useToast, ir } from '../shell.js';
import { EstadoVerif, useEnvio } from '../componentes.js';

const ROL = { tutor: 'Tutor', mvz: 'Médico veterinario' };
const TONO_DECISION = { aprobado: 'verificado', rechazado: 'error', info_requerida: 'pendiente', suspendido: 'error' };

// Qué revisar en cada caso
const GUIA = {
  ine_tutor: ['La selfie y la foto de la INE son la misma persona.', 'El nombre de la INE coincide con el de la cuenta.', 'La INE está vigente y se lee completa.'],
  alta_mvz: ['La selfie y la foto de la INE son la misma persona.', 'El nombre coincide en INE, cédula y cuenta.',
    'La cédula existe en el Registro Nacional de Profesionistas y es de Medicina Veterinaria y Zootecnia.', 'Si hay duda, videollamada o WhatsApp antes de aprobar.'],
  especialidad: ['El documento es de la especialidad elegida.', 'Está a nombre del médico veterinario.'],
  clabe: ['La CLABE del estado de cuenta es la misma que capturó.', 'El titular es el médico veterinario.'],
};
const EJEMPLO = {
  ine_tutor: 'La selfie salió borrosa, tómala con buena luz.',
  alta_mvz: 'La foto de tu cédula está cortada, súbela completa.',
  especialidad: 'El documento no muestra tu nombre, sube la cédula de especialidad.',
  clabe: 'El titular de la cuenta no coincide con tu nombre.',
};
const DOCS_DE = {
  ine_tutor: ['ine_frente', 'ine_reverso', 'selfie_ine'],
  alta_mvz: ['ine_frente', 'ine_reverso', 'selfie_ine', 'cedula'],
  especialidad: ['especialidad'],
  clabe: ['estado_cuenta'],
};

export function Verificacion({ sub, onConteos }) {
  if (sub) return html`<${DetalleCuenta} id=${sub} onConteos=${onConteos} />`;
  return html`<${Cola} />`;
}

// ───────── Cola ─────────
function Cola() {
  const [vista, setVista] = useState(() => (location.hash.includes('historial') ? 'historial' : 'cola'));
  const cola = useDatos(() => api.colaVerificacion(), []);
  const cambiar = (v) => { setVista(v); history.replaceState(null, '', '#/verificacion' + (v === 'historial' ? '?historial' : '')); };
  return html`<div class="page">
    <${PageHead} titulo="Verificación" sub="INE de tutores, altas de médicos veterinarios, especialidades y CLABE." />
    <div class="filtros" role="radiogroup" aria-label="Qué ver">
      <${DS.Chip} type="radio" name="vv" checked=${vista === 'cola'} onChange=${() => cambiar('cola')}>Por revisar${cola.datos ? ` (${cola.datos.length})` : ''}<//>
      <${DS.Chip} type="radio" name="vv" checked=${vista === 'historial'} onChange=${() => cambiar('historial')}>Historial<//>
    </div>
    ${vista === 'cola' ? html`<${TablaCola} st=${cola} />` : html`<${Historial} />`}
  </div>`;
}

function TablaCola({ st }) {
  if (st.cargando) return html`<${Cargando} />`;
  if (st.error) return html`<${ErrorCarga} error=${st.error} onReintentar=${st.recargar} />`;
  const filas = ordenarCola(st.datos);
  if (!filas.length) {
    return html`<section class="box"><div class="vacio"><${Icon} name="shield" /><div><b>No hay nada por revisar.</b>
      <p class="small muted">Cuando alguien envíe su INE, su alta o su CLABE, aparece aquí y te llega un correo.</p></div></div></section>`;
  }
  return html`<section class="box">
    <div class="table-wrap"><table class="table">
      <thead><tr><th>Nombre</th><th>Qué revisar</th><th>Enviado</th><th>Prioridad</th><th class="r"><span class="sr-only">Acción</span></th></tr></thead>
      <tbody>${filas.map((f) => html`<tr key=${f.cuenta_id + f.objeto} class="clic" onClick=${() => ir('verificacion/' + f.cuenta_id)}>
        <td data-label="Nombre"><span class="cell"><b>${nombreCompleto(f) || 'Sin nombre'}</b> <span class="muted small">· ${ROL[f.rol]}</span></span></td>
        <td data-label="Qué revisar">${OBJETO_VERIF[f.objeto]}</td>
        <td data-label="Enviado" class="muted nw">${hace(f.enviado_at)}</td>
        <td data-label="Prioridad" class="nw">${f.proxima_consulta
          ? html`<${DS.Badge} tone="pendiente">Consulta ${diaRelativo(f.proxima_consulta).toLowerCase()}, ${hora(f.proxima_consulta)}<//>`
          : html`<span class="muted small">Normal</span>`}</td>
        <td class="r"><${DS.Button} variant="secondary" size="sm" onClick=${(e) => { e.stopPropagation(); ir('verificacion/' + f.cuenta_id); }}>Revisar<//></td>
      </tr>`)}</tbody>
    </table></div>
    <p class="small muted" style=${{ marginTop: 12 }}>Primero van los tutores que ya tienen consulta agendada; después, lo más antiguo.</p>
  </section>`;
}

function Historial() {
  const { cargando, datos, error, recargar } = useDatos(() => api.historialRevisiones(), []);
  if (cargando) return html`<${Cargando} />`;
  if (error) return html`<${ErrorCarga} error=${error} onReintentar=${recargar} />`;
  if (!datos.length) return html`<section class="box"><p class="muted">Aún no hay decisiones.</p></section>`;
  return html`<section class="box"><div class="table-wrap"><table class="table">
    <thead><tr><th>Cuándo</th><th>Nombre</th><th>Qué</th><th>Decisión</th><th>Nota</th></tr></thead>
    <tbody>${datos.map((r) => html`<tr key=${r.id} class="clic" onClick=${() => ir('verificacion/' + r.cuenta_id)}>
      <td data-label="Cuándo" class="muted nw">${hace(r.created_at)}</td>
      <td data-label="Nombre"><span class="cell"><b>${nombreCompleto(r.cuenta)}</b></span></td>
      <td data-label="Qué">${OBJETO_VERIF[r.objeto]}</td>
      <td data-label="Decisión" class="nw"><${DS.Badge} tone=${TONO_DECISION[r.decision] || 'neutral'}>${DECISION[r.decision]}<//></td>
      <td data-label="Nota" class="small"><span class="cell">${r.nota || html`<span class="muted">—</span>`}</span></td>
    </tr>`)}</tbody>
  </table></div></section>`;
}

// ───────── Detalle de una cuenta ─────────
function DetalleCuenta({ id, onConteos }) {
  const { cargando, datos, error, recargar } = useDatos(() => api.cuentaParaRevisar(id), [id]);
  if (cargando) return html`<div class="page"><${Cargando} texto="Abriendo documentos…" /></div>`;
  if (error) return html`<div class="page"><${Volver} /><${ErrorCarga} error=${error} onReintentar=${recargar} /></div>`;
  const { perfil: p, tutor, mvz, docs, revisiones, fotoUrl } = datos;

  const piezas = tutor
    ? [['ine_tutor', tutor.estado_ine]]
    : [['alta_mvz', mvz.estado], ...(mvz.especialidad_id || mvz.estado_especialidad !== 'sin_enviar' ? [['especialidad', mvz.estado_especialidad]] : []), ['clabe', mvz.estado_clabe]];
  const pendientes = piezas.filter(([, e]) => ['pendiente', 'en_revision'].includes(e));
  const tel = (p.telefono || '').replace(/\D/g, '');
  const ultimo = {};
  docs.forEach((d) => { if (!ultimo[d.tipo]) ultimo[d.tipo] = d; });
  const anteriores = (t) => docs.filter((d) => d.tipo === t).length - 1;
  const tiposDocs = Object.keys(DOC).filter((t) => ultimo[t]);

  const alDecidir = () => { recargar(); api.conteosAdmin().then(onConteos).catch(() => {}); };

  return html`<div class="page">
    <${Volver} />
    <div class="persona">
      <div class="lv-avatar persona-av">${fotoUrl ? html`<img src=${fotoUrl} alt="" />` : ((p.nombre || ' ')[0] + (p.apellidos || ' ')[0]).toUpperCase()}</div>
      <div class="persona-txt">
        <h1 class="titulo-2">${nombreCompleto(p)}</h1>
        <div class="row small muted">
          <span>${ROL[p.rol]}</span><span>·</span><span>Cuenta creada ${fechaCorta(p.created_at)}</span>
          ${p.suspendido && html`<${DS.Badge} tone="error">Suspendida<//>`}
        </div>
      </div>
      <div class="persona-acc">
        ${tel && html`<a class="lv-btn lv-btn-ghost lv-btn-sm" href=${'https://wa.me/52' + tel} target="_blank" rel="noopener"><${Icon} name="chat" /> WhatsApp</a>`}
        ${p.correo && html`<a class="lv-btn lv-btn-ghost lv-btn-sm" href=${'mailto:' + p.correo}>Correo</a>`}
      </div>
    </div>

    <div class="grid-rev">
      <div class="stack">
        <section class="box" aria-labelledby="t-docs">
          <div class="box-head"><h2 id="t-docs">Documentos</h2><span class="small muted">Se abren 10 minutos. Queda registrado que los viste.</span></div>
          ${tiposDocs.length === 0 ? html`<p class="muted">Aún no sube documentos.</p>` : html`<div class="galeria">
            ${tiposDocs.map((t) => html`<${DocVista} key=${t} doc=${ultimo[t]} anteriores=${anteriores(t)} />`)}
          </div>`}
        </section>
        <${Datos} p=${p} mvz=${mvz} tutor=${tutor} />
      </div>

      <div class="stack">
        ${pendientes.length === 0 && html`<section class="box"><div class="vacio"><${Icon} name="check" /><div><b>Nada pendiente en esta cuenta.</b>
          <p class="small muted">${piezas.map(([o, e]) => `${OBJETO_VERIF[o]}: ${ESTADO_VERIF[e][1].toLowerCase()}`).join(' · ')}</p></div></div></section>`}
        ${pendientes.map(([obj], i) => html`<${Decision} key=${obj} principal=${i === 0} cuenta=${p} objeto=${obj} faltan=${DOCS_DE[obj].filter((t) => !ultimo[t])} onListo=${alDecidir} />`)}
        <section class="box" aria-labelledby="t-hist">
          <div class="box-head"><h2 id="t-hist">Decisiones anteriores</h2></div>
          ${revisiones.length === 0 ? html`<p class="small muted">Ninguna todavía.</p>` : html`<ul class="hist">
            ${revisiones.map((r) => html`<li key=${r.id}>
              <div class="spread"><b class="small">${OBJETO_VERIF[r.objeto]}</b><${DS.Badge} tone=${TONO_DECISION[r.decision] || 'neutral'}>${DECISION[r.decision]}<//></div>
              ${r.nota && html`<p class="small">${r.nota}</p>`}
              <span class="small muted">${capital(fechaLarga(r.created_at))}, ${hora(r.created_at)}${r.revisor ? ' · ' + nombreCompleto(r.revisor) : ''}</span>
            </li>`)}
          </ul>`}
        </section>
      </div>
    </div>
  </div>`;
}

const Volver = () => html`<div><button type="button" class="linkish volver" onClick=${() => ir('verificacion')}><${Icon} name="back" /> Volver a la cola</button></div>`;

function DocVista({ doc, anteriores }) {
  const d = DOC[doc.tipo];
  const pdf = doc.tipo_mime === 'application/pdf' || /\.pdf($|\?)/i.test(doc.ruta || '');
  const heic = /hei[cf]/i.test(doc.tipo_mime || '');
  return html`<figure class=${'docv' + (doc.tipo === 'selfie_ine' ? ' docv-selfie' : '')}>
    <a href=${doc.url} target="_blank" rel="noopener" class="docv-img" aria-label=${'Abrir ' + d.titulo + ' en tamaño completo'}>
      ${pdf || heic ? html`<span class="docv-pdf"><${Icon} name="doc" /><span>${pdf ? 'PDF' : 'Foto HEIC'}: ábrelo para verlo</span></span>`
        : html`<img src=${doc.url} alt=${d.titulo} loading="lazy" />`}
    </a>
    <figcaption><b class="small">${d.titulo}</b><span class="small muted">${hace(doc.created_at)}${anteriores > 0 ? ` · ${anteriores} ${anteriores === 1 ? 'versión anterior' : 'versiones anteriores'}` : ''}</span></figcaption>
  </figure>`;
}

function Datos({ p, mvz, tutor }) {
  const toast = useToast();
  const copiar = async (t) => { try { await navigator.clipboard.writeText(t); toast('Copiado.'); } catch (e) { /* sin portapapeles */ } };
  return html`<section class="box" aria-labelledby="t-datos">
    <div class="box-head"><h2 id="t-datos">Datos de la cuenta</h2></div>
    <dl class="datos">
      <dt>Correo</dt><dd>${p.correo || '—'}</dd>
      <dt>Celular</dt><dd class="num">${p.telefono || '—'}</dd>
      ${tutor && html`<dt>INE</dt><dd><${EstadoVerif} estado=${tutor.estado_ine} /></dd>`}
      ${mvz && html`
        <dt>Cédula</dt><dd><span class="num">${mvz.cedula || '—'}</span>
          ${mvz.cedula && html` <button type="button" class="linkish" onClick=${() => copiar(mvz.cedula)}>Copiar</button>
          · <a href="https://www.cedulaprofesional.sep.gob.mx/" target="_blank" rel="noopener">Buscar en el Registro Nacional de Profesionistas</a>`}</dd>
        <dt>Especialidad</dt><dd>${mvz.especialidades?.nombre || 'Consulta general'}</dd>
        <dt>CLABE</dt><dd>${mvz.clabe ? html`<span class="num">${mvz.clabe}</span><br /><span class="small muted">${mvz.banco} · ${mvz.titular_clabe}</span>` : '—'}</dd>
        ${mvz.rfc && html`<dt>RFC</dt><dd class="num">${mvz.rfc}</dd>`}
        ${mvz.bio && html`<dt>Se presenta</dt><dd class="small">${mvz.bio}</dd>`}`}
    </dl>
  </section>`;
}

function Decision({ cuenta, objeto, faltan, onListo, principal }) {
  const toast = useToast();
  const [nota, setNota] = useState('');
  const [clave, setClave] = useState('');
  const [envio, correr, limpiar] = useEnvio();
  const pideClave = ['ine_tutor', 'alta_mvz'].includes(objeto);
  const claveOk = /^[A-Z]{6}[0-9]{8}[HM][0-9]{3}$/.test(clave.replace(/\s/g, '').toUpperCase());
  const decidir = async (decision) => {
    limpiar();
    if (decision !== 'aprobado' && !nota.trim()) {
      return correr(async () => { throw new Error('Escribe una nota: la persona la ve en la app y en el correo.'); });
    }
    const ok = await correr(() => api.decidir(cuenta.id, objeto, decision, nota.trim(), pideClave && decision === 'aprobado' ? clave : null));
    if (ok) {
      const verbo = { aprobado: 'Aprobaste', rechazado: 'Rechazaste', info_requerida: 'Pediste corregir' }[decision];
      toast(`${verbo}: ${OBJETO_VERIF[objeto].toLowerCase()} de ${cuenta.nombre}.`);
      onListo();
    }
  };
  return html`<section class="box decision" aria-labelledby=${'t-' + objeto}>
    <div class="box-head"><h2 id=${'t-' + objeto}>${OBJETO_VERIF[objeto]}</h2><${EstadoVerif} estado="pendiente" /></div>
    <div class="stack">
      ${faltan.length > 0 && html`<${DS.Notice} tone="error">Falta: ${faltan.map((t) => DOC[t].titulo).join(', ')}.<//>`}
      <ul class="guia">${GUIA[objeto].map((g) => html`<li key=${g}>${g}</li>`)}</ul>
      ${pideClave && html`<${DS.Field} label="Clave de elector de la INE" value=${clave} onChange=${(e) => setClave(e.target.value.toUpperCase())}
        maxLength=${22} autoComplete="off" spellCheck=${false}
        hint="18 caracteres, al frente de la INE. Solo se guarda una huella para evitar que la misma INE abra otra cuenta." />`}
      <${DS.Field} as="textarea" rows=${2} label="Nota para la persona" value=${nota} onChange=${(e) => setNota(e.target.value)}
        hint=${'Obligatoria si pides corregir o rechazas. Ejemplo: “' + EJEMPLO[objeto] + '”'} />
      ${envio.error && html`<${DS.Notice} tone="error">${envio.error}<//>`}
      <div class="row">
        <${DS.Button} variant=${principal ? 'primary' : 'secondary'} onClick=${() => decidir('aprobado')} disabled=${envio.enviando || faltan.length > 0 || (pideClave && !claveOk)}>Aprobar<//>
        <${DS.Button} variant="secondary" onClick=${() => decidir('info_requerida')} disabled=${envio.enviando}>Pedir corrección<//>
        <${DS.Button} variant="ghost" onClick=${() => decidir('rechazado')} disabled=${envio.enviando}>Rechazar<//>
      </div>
    </div>
  </section>`;
}
