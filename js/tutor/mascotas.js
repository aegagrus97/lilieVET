// Mascotas del tutor (fase 4): lista, alta, perfil, antecedentes, cartilla, documentos e historia clínica.
import { html, React, DS, Icon, useState, edad, capital, fechaDia, hoyISO, ESPECIE, SEXO, TIPO_CARTILLA, DOC_MASCOTA, TIPO_CONSULTA } from '../lib.js';
import { api } from '../api.js';
import { PageHead, Cargando, ErrorCarga, useDatos, useToast, ir } from '../shell.js';
import { Seccion, useEnvio } from '../componentes.js';

export function Mascotas({ sub }) {
  if (sub === 'nueva') return html`<${AltaMascota} />`;
  if (sub) return html`<${DetalleMascota} id=${sub} />`;
  return html`<${ListaMascotas} />`;
}

const resumen = (m) => [ESPECIE[m.especie], m.raza, edad(m)].filter(Boolean).join(' · ');
const Volver = ({ a = 'mascotas', texto = 'Volver a mis mascotas' }) =>
  html`<div><button type="button" class="linkish volver" onClick=${() => ir(a)}><${Icon} name="back" /> ${texto}</button></div>`;

// ───────── Lista ─────────
function ListaMascotas() {
  const { cargando, datos, error, recargar } = useDatos(() => api.mascotas(), []);
  if (cargando) return html`<div class="page"><${Cargando} /></div>`;
  if (error) return html`<div class="page"><${ErrorCarga} error=${error} onReintentar=${recargar} /></div>`;

  if (!datos.length) {
    return html`<div class="page">
      <${PageHead} titulo="Mascotas" />
      <${DS.EmptyState} who="liebe" title="Todavía no registras a nadie"
        action=${html`<${DS.Button} block onClick=${() => ir('mascotas/nueva')}>Registrar mascota<//>`}>
        Cuéntame de tu perro o de tu gato. Con su perfil, el médico veterinario llega sabiendo lo que necesita.
      <//>
    </div>`;
  }

  return html`<div class="page">
    <${PageHead} titulo="Mascotas" sub=${datos.length === 1 ? '1 mascota registrada' : datos.length + ' mascotas registradas'}>
      <${DS.Button} onClick=${() => ir('mascotas/nueva')}>Registrar mascota<//>
    <//>
    <div class="only-m"><${DS.Button} block onClick=${() => ir('mascotas/nueva')}>Registrar mascota<//></div>
    <div class="grid-cards">
      ${datos.map((m) => html`<${DS.PetCard} key=${m.id} name=${m.nombre} species=${m.especie} photo=${m.foto}
        detail=${resumen(m)} badges=${[{ label: m.cartillaEstado.label, tone: m.cartillaEstado.tone }]}
        onClick=${() => ir('mascotas/' + m.id)} />`)}
    </div>
  </div>`;
}

// ───────── Formulario de datos (alta y edición) ─────────
const FORM_VACIO = { nombre: '', especie: 'perro', raza: '', sexo: '', esterilizado: '', fecha_nacimiento: '', anios: '', meses: '', peso_kg: '', senas: '' };

function aFormulario(m) {
  const am = m.edad_aprox_meses;
  return {
    nombre: m.nombre || '', especie: m.especie || 'perro', raza: m.raza || '', sexo: m.sexo || '',
    esterilizado: m.esterilizado == null ? '' : m.esterilizado ? 'si' : 'no',
    fecha_nacimiento: m.fecha_nacimiento || '',
    anios: am != null ? String(Math.floor(am / 12)) : '', meses: am != null ? String(am % 12) : '',
    peso_kg: m.peso_kg != null ? String(m.peso_kg) : '', senas: m.senas || '',
  };
}

function aDatos(f) {
  const sinFecha = !f.fecha_nacimiento && (f.anios !== '' || f.meses !== '');
  return {
    nombre: f.nombre.trim(), especie: f.especie, raza: f.raza.trim() || null, sexo: f.sexo || null,
    esterilizado: f.esterilizado === '' ? null : f.esterilizado === 'si',
    fecha_nacimiento: f.fecha_nacimiento || null,
    edad_aprox_meses: sinFecha ? Number(f.anios || 0) * 12 + Number(f.meses || 0) : null,
    peso_kg: f.peso_kg === '' ? null : Number(f.peso_kg),
    senas: f.senas.trim() || null,
  };
}

function revisar(f) {
  const e = {};
  const n = f.nombre.trim();
  if (!n) e.nombre = 'Escribe su nombre.';
  else if (n.length > 40) e.nombre = 'Máximo 40 caracteres.';
  if (f.fecha_nacimiento && f.fecha_nacimiento > hoyISO()) e.fecha_nacimiento = 'Esa fecha todavía no llega.';
  if (f.meses !== '' && Number(f.meses) > 11) e.meses = 'De 0 a 11.';
  if (f.peso_kg !== '' && !(Number(f.peso_kg) > 0 && Number(f.peso_kg) < 1000)) e.peso_kg = 'Escribe el peso en kilos.';
  return e;
}

function FormDatos({ inicial, onGuardar, textoBoton, onCancelar }) {
  const [f, setF] = useState(inicial);
  const [errores, setErrores] = useState({});
  const [envio, correr] = useEnvio();
  const set = (k) => (ev) => setF((x) => ({ ...x, [k]: ev.target.value }));

  const enviar = async (ev) => {
    ev.preventDefault();
    const e = revisar(f);
    setErrores(e);
    if (Object.keys(e).length) return;
    await correr(() => onGuardar(aDatos(f)));
  };

  return html`<form class="stack" onSubmit=${enviar} noValidate=${true}>
    <div class="field-row">
      <${DS.Field} label="Nombre" value=${f.nombre} onChange=${set('nombre')} error=${errores.nombre} maxLength=${40} />
      <${DS.Field} label="Especie" as="select" value=${f.especie} onChange=${set('especie')}
        options=${[{ value: 'perro', label: 'Perro' }, { value: 'gato', label: 'Gato' }]} />
    </div>
    <div class="field-row">
      <${DS.Field} label="Raza" value=${f.raza} onChange=${set('raza')} hint="Si es mestizo, escribe “Mestizo”." />
      <${DS.Field} label="Sexo" as="select" value=${f.sexo} onChange=${set('sexo')}
        options=${[{ value: '', label: 'No lo sé' }, { value: 'macho', label: 'Macho' }, { value: 'hembra', label: 'Hembra' }]} />
    </div>
    <div class="field-row">
      <${DS.Field} label="Fecha de nacimiento" type="date" max=${hoyISO()} value=${f.fecha_nacimiento}
        onChange=${set('fecha_nacimiento')} error=${errores.fecha_nacimiento} hint="Si no la sabes, déjala vacía y pon su edad aproximada." />
      <${DS.Field} label="¿Está esterilizado?" as="select" value=${f.esterilizado} onChange=${set('esterilizado')}
        options=${[{ value: '', label: 'No lo sé' }, { value: 'si', label: 'Sí' }, { value: 'no', label: 'No' }]} />
    </div>
    ${!f.fecha_nacimiento && html`<div class="field-row">
      <${DS.Field} label="Edad aproximada (años)" type="number" min="0" max="40" inputMode="numeric" value=${f.anios} onChange=${set('anios')} />
      <${DS.Field} label="y meses" type="number" min="0" max="11" inputMode="numeric" value=${f.meses} onChange=${set('meses')} error=${errores.meses} />
    </div>`}
    <${DS.Field} label="Peso (kg)" type="number" step="0.1" min="0" inputMode="decimal" value=${f.peso_kg}
      onChange=${set('peso_kg')} error=${errores.peso_kg} hint="El médico veterinario lo vuelve a pesar en la consulta." />
    <${DS.Field} label="Señas particulares (opcional)" as="textarea" rows=${2} value=${f.senas} onChange=${set('senas')}
      hint="Color, manchas, cicatrices: lo que ayuda a reconocerlo." />
    ${envio.error && html`<${DS.Notice} tone="error">${envio.error}<//>`}
    <div class="row">
      <${DS.Button} type="submit" disabled=${envio.enviando}>${envio.enviando ? 'Guardando…' : textoBoton}<//>
      ${onCancelar && html`<${DS.Button} variant="ghost" onClick=${onCancelar} disabled=${envio.enviando}>Cancelar<//>`}
    </div>
  </form>`;
}

// ───────── Alta ─────────
function AltaMascota() {
  const toast = useToast();
  const guardar = async (d) => {
    const id = await api.guardarMascota(null, d);
    toast(`Registramos a ${d.nombre}.`, { sparks: true });
    ir('mascotas/' + id);
  };
  return html`<div class="page page-narrow">
    <${Volver} />
    <${PageHead} titulo="Registrar mascota" sub="Con estos datos el médico veterinario llega preparado. Después puedes agregar su cartilla y sus documentos." keep=${true} />
    <section class="box"><${FormDatos} inicial=${FORM_VACIO} onGuardar=${guardar} textoBoton="Registrar" onCancelar=${() => ir('mascotas')} /></section>
  </div>`;
}

// ───────── Detalle ─────────
function DetalleMascota({ id }) {
  const { cargando, datos, error, recargar } = useDatos(() => api.mascota(id), [id]);
  if (cargando) return html`<div class="page"><${Cargando} /></div>`;
  if (error) return html`<div class="page"><${Volver} /><${ErrorCarga} error=${error} onReintentar=${recargar} /></div>`;

  return html`<div class="page page-ficha">
    <${Volver} />
    <${Cabecera} m=${datos} onCambio=${recargar} />
    <${Datos} m=${datos} onCambio=${recargar} />
    <${Antecedentes} m=${datos} onCambio=${recargar} />
    <${Cartilla} m=${datos} onCambio=${recargar} />
    <${Documentos} m=${datos} onCambio=${recargar} />
    <${Historia} m=${datos} />
  </div>`;
}

function Cabecera({ m, onCambio }) {
  const [foto, setFoto] = useState('');
  const elegir = async (ev) => {
    const file = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!file) return;
    setFoto('subiendo');
    try { await api.subirFotoMascota(m.id, file); setFoto(''); onCambio(); }
    catch (e) { setFoto(e.message || 'No se pudo subir la foto.'); }
  };
  const est = m.cartillaEstado;
  return html`<section class="box">
    <div class="foto-row ficha-head">
      <div class="lv-avatar foto-av" aria-hidden=${!m.foto}>
        ${m.foto ? html`<img src=${m.foto} alt=${'Foto de ' + m.nombre} />` : html`<${Icon} name="paw" />`}
      </div>
      <div class="stack-sm">
        <div class="row">
          <h1 class="titulo-2">${m.nombre}</h1>
          <${DS.Badge} tone=${est.tone}>${est.label}<//>
        </div>
        <span class="small muted">${resumen(m) || 'Sin datos todavía'}</span>
        <label class="lv-btn lv-btn-ghost lv-btn-sm foto-btn">
          <input class="sr-only" type="file" accept="image/*" onChange=${elegir} disabled=${foto === 'subiendo'} />
          ${foto === 'subiendo' ? 'Subiendo…' : m.foto ? 'Cambiar foto' : 'Subir foto'}
        </label>
        ${foto && foto !== 'subiendo' && html`<span class="small doc-error" role="alert">${foto}</span>`}
      </div>
      <${DS.Button} onClick=${() => ir('agendar')}>Agendar consulta<//>
    </div>
  </section>`;
}

function Datos({ m, onCambio }) {
  const toast = useToast();
  const [editando, setEditando] = useState(false);
  const [borrar, setBorrar] = useState(false);

  const guardar = async (d) => {
    await api.guardarMascota(m.id, d);
    toast('Guardamos los datos.');
    setEditando(false);
    onCambio();
  };
  const quitar = async () => { await api.borrarMascota(m.id); toast(`Quitamos a ${m.nombre} de tu lista.`); ir('mascotas'); };

  if (editando) {
    return html`<${Seccion} id="datos" titulo="Datos de ${m.nombre}">
      <${FormDatos} inicial=${aFormulario(m)} onGuardar=${guardar} textoBoton="Guardar" onCancelar=${() => setEditando(false)} />
    <//>`;
  }

  const filas = [
    ['Especie', ESPECIE[m.especie]],
    ['Raza', m.raza],
    ['Sexo', m.sexo ? SEXO[m.sexo] : null],
    ['Esterilizado', m.esterilizado == null ? null : m.esterilizado ? 'Sí' : 'No'],
    ['Edad', edad(m)],
    ['Nacimiento', m.fecha_nacimiento ? fechaDia(m.fecha_nacimiento) : null],
    ['Peso', m.peso_kg != null ? m.peso_kg + ' kg' : null],
    ['Señas', m.senas],
  ].filter(([, v]) => v);

  return html`<${Seccion} id="datos" titulo="Datos de ${m.nombre}"
      extra=${html`<${DS.Button} variant="ghost" size="sm" onClick=${() => setEditando(true)}>Editar<//>`}>
    <div class="stack">
      <dl class="datos">${filas.map(([k, v]) => html`<${React.Fragment} key=${k}><dt>${k}</dt><dd>${v}</dd><//>`)}</dl>
      ${borrar
        ? html`<${DS.Notice} tone="aviso" title=${'¿Quitar a ' + m.nombre + ' de tu lista?'}>
            Su historia clínica se conserva, pero ya no podrás agendar consultas para ${m.nombre}.
            <div class="row" style=${{ marginTop: 8 }}>
              <${DS.Button} variant="secondary" size="sm" onClick=${quitar}>Sí, quitar<//>
              <${DS.Button} variant="ghost" size="sm" onClick=${() => setBorrar(false)}>Cancelar<//>
            </div>
          <//>`
        : html`<div><button type="button" class="linkish" onClick=${() => setBorrar(true)}>Quitar de mi lista</button></div>`}
    </div>
  <//>`;
}

const CAMPOS_SALUD = [
  ['alergias', 'Alergias', 'Alimentos, medicamentos o picaduras. Si no le conoces ninguna, escribe “Ninguna conocida”.'],
  ['enfermedades', 'Enfermedades que tiene', 'Lo que un veterinario ya le diagnosticó.'],
  ['medicamentos_actuales', 'Medicamentos que toma hoy', 'Nombre, dosis y cada cuándo, si lo sabes.'],
  ['antecedentes', 'Antecedentes', 'Cirugías, accidentes o enfermedades que ya pasó.'],
  ['tratamientos_previos', 'Tratamientos anteriores', 'Lo que ya probaron y cómo le fue.'],
  ['notas_tutor', 'Lo que quieras contarnos', 'Carácter, miedos, cómo reacciona a las visitas.'],
];

function Antecedentes({ m, onCambio }) {
  const toast = useToast();
  const [editando, setEditando] = useState(false);
  const [f, setF] = useState(() => Object.fromEntries(CAMPOS_SALUD.map(([k]) => [k, m[k] || ''])));
  const [envio, correr] = useEnvio();
  const set = (k) => (ev) => setF((x) => ({ ...x, [k]: ev.target.value }));

  const guardar = async (ev) => {
    ev.preventDefault();
    const d = Object.fromEntries(CAMPOS_SALUD.map(([k]) => [k, f[k].trim() || null]));
    if (await correr(() => api.guardarMascota(m.id, d))) { toast('Guardamos la información de salud.'); setEditando(false); onCambio(); }
  };

  const llenos = CAMPOS_SALUD.filter(([k]) => m[k]);

  if (editando) {
    return html`<${Seccion} id="salud" titulo="Antecedentes y salud" sub="Solo lo ve el médico veterinario que atiende a ${m.nombre}.">
      <form class="stack" onSubmit=${guardar} noValidate=${true}>
        ${CAMPOS_SALUD.map(([k, label, hint]) => html`<${DS.Field} key=${k} label=${label} as="textarea" rows=${2} value=${f[k]} onChange=${set(k)} hint=${hint} />`)}
        ${envio.error && html`<${DS.Notice} tone="error">${envio.error}<//>`}
        <div class="row">
          <${DS.Button} type="submit" disabled=${envio.enviando}>${envio.enviando ? 'Guardando…' : 'Guardar'}<//>
          <${DS.Button} variant="ghost" onClick=${() => setEditando(false)} disabled=${envio.enviando}>Cancelar<//>
        </div>
      </form>
    <//>`;
  }

  return html`<${Seccion} id="salud" titulo="Antecedentes y salud"
      extra=${html`<${DS.Button} variant="ghost" size="sm" onClick=${() => setEditando(true)}>${llenos.length ? 'Editar' : 'Agregar'}<//>`}>
    ${llenos.length
      ? html`<dl class="datos">${llenos.map(([k, label]) => html`<${React.Fragment} key=${k}><dt>${label}</dt><dd>${m[k]}</dd><//>`)}</dl>`
      : html`<div class="vacio"><${Icon} name="info" /><div><b class="small">Todavía no hay nada aquí.</b>
          <p class="small muted">Alergias, enfermedades y medicamentos ayudan al médico veterinario desde la primera consulta.</p></div></div>`}
  <//>`;
}

// ───────── Cartilla ─────────
const CARTILLA_VACIA = { tipo: 'vacuna', producto: '', aplicada_el: '', proxima_el: '', lote: '', caducidad: '' };

function Cartilla({ m, onCambio }) {
  const toast = useToast();
  const [abierto, setAbierto] = useState(false);
  const [f, setF] = useState(CARTILLA_VACIA);
  const [errores, setErrores] = useState({});
  const [envio, correr] = useEnvio();
  const set = (k) => (ev) => setF((x) => ({ ...x, [k]: ev.target.value }));

  const agregar = async (ev) => {
    ev.preventDefault();
    const e = {};
    if (!f.producto.trim()) e.producto = 'Escribe qué le aplicaron.';
    if (!f.aplicada_el) e.aplicada_el = 'Pon la fecha.';
    else if (f.aplicada_el > hoyISO()) e.aplicada_el = 'Esa fecha todavía no llega.';
    if (f.proxima_el && f.aplicada_el && f.proxima_el < f.aplicada_el) e.proxima_el = 'El refuerzo va después.';
    setErrores(e);
    if (Object.keys(e).length) return;
    const d = {
      tipo: f.tipo, producto: f.producto.trim(), aplicada_el: f.aplicada_el,
      proxima_el: f.proxima_el || null, lote: f.lote.trim() || null, caducidad: f.caducidad || null,
    };
    if (await correr(() => api.agregarCartilla(m.id, d))) {
      toast('Agregamos el registro a la cartilla.', { sparks: true });
      setF(CARTILLA_VACIA); setAbierto(false); onCambio();
    }
  };

  const quitar = async (c) => { await api.borrarCartilla(c.id); toast('Quitamos ese registro.'); onCambio(); };
  const hoy = hoyISO();

  return html`<${Seccion} id="cartilla" titulo="Cartilla" sub="Vacunas y desparasitaciones."
      extra=${!abierto && html`<${DS.Button} variant="ghost" size="sm" onClick=${() => setAbierto(true)}>Agregar<//>`}>
    <div class="stack">
      ${abierto && html`<form class="stack" onSubmit=${agregar} noValidate=${true}>
        <div class="field-row">
          <${DS.Field} label="Tipo" as="select" value=${f.tipo} onChange=${set('tipo')}
            options=${[{ value: 'vacuna', label: 'Vacuna' }, { value: 'desparasitacion', label: 'Desparasitación' }]} />
          <${DS.Field} label="Qué le aplicaron" value=${f.producto} onChange=${set('producto')} error=${errores.producto}
            hint=${f.tipo === 'vacuna' ? 'Por ejemplo: triple felina, rabia.' : 'Interna o externa, y el producto.'} />
        </div>
        <div class="field-row">
          <${DS.Field} label="Fecha" type="date" max=${hoy} value=${f.aplicada_el} onChange=${set('aplicada_el')} error=${errores.aplicada_el} />
          <${DS.Field} label="Próximo refuerzo (opcional)" type="date" value=${f.proxima_el} onChange=${set('proxima_el')} error=${errores.proxima_el}
            hint="Te lo recordamos tres días antes." />
        </div>
        <div class="field-row">
          <${DS.Field} label="Lote (opcional)" value=${f.lote} onChange=${set('lote')} />
          <${DS.Field} label="Caducidad (opcional)" type="date" value=${f.caducidad} onChange=${set('caducidad')} />
        </div>
        ${envio.error && html`<${DS.Notice} tone="error">${envio.error}<//>`}
        <div class="row">
          <${DS.Button} type="submit" size="sm" disabled=${envio.enviando}>${envio.enviando ? 'Guardando…' : 'Agregar'}<//>
          <${DS.Button} variant="ghost" size="sm" onClick=${() => { setAbierto(false); setErrores({}); }} disabled=${envio.enviando}>Cancelar<//>
        </div>
        <p class="small muted">Lo que registres tú aparece como “según el tutor”. Lo que aplique el médico veterinario en una consulta se agrega solo.</p>
      </form>`}

      ${m.cartilla.length
        ? html`<ul class="hist">${m.cartilla.map((c) => html`<li key=${c.id}>
            <div class="spread">
              <b>${TIPO_CARTILLA[c.tipo]} · ${c.producto}</b>
              ${c.proxima_el && html`<${DS.Badge} tone=${c.proxima_el < hoy ? 'error' : 'neutral'}>
                ${c.proxima_el < hoy ? 'Refuerzo vencido' : 'Refuerzo ' + fechaDia(c.proxima_el)}<//>`}
            </div>
            <span class="small muted">
              ${fechaDia(c.aplicada_el)} · ${c.origen === 'mvz' ? 'Aplicada en LilieVET' : 'Según el tutor'}
              ${c.lote ? ' · Lote ' + c.lote : ''}
            </span>
            ${c.origen === 'tutor' && html`<div><button type="button" class="linkish" onClick=${() => quitar(c)}>Quitar</button></div>`}
          </li>`)}</ul>`
        : !abierto && html`<div class="vacio"><${Icon} name="info" /><div><b class="small">La cartilla está vacía.</b>
            <p class="small muted">Agrega lo que ya le hayan aplicado para que el médico veterinario sepa qué le toca.</p></div></div>`}
    </div>
  <//>`;
}

// ───────── Documentos ─────────
const pesoLegible = (b) => (b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');

function Documentos({ m, onCambio }) {
  const toast = useToast();
  const [tipo, setTipo] = useState('laboratorio');
  const [titulo, setTitulo] = useState('');
  const [archivo, setArchivo] = useState(null);
  const [envio, correr] = useEnvio();
  const [errorAbrir, setErrorAbrir] = useState(null);

  const elegir = (ev) => {
    const f = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (f) setArchivo(f);
  };

  const subir = async () => {
    if (await correr(() => api.subirDocumentoMascota(m.id, { tipo, titulo: titulo.trim() || DOC_MASCOTA[tipo] }, archivo))) {
      toast('Subimos el documento.');
      setArchivo(null); setTitulo('');
      onCambio();
    }
  };

  // El enlace se pide en el momento de abrir, así nunca se vence.
  // La pestaña se abre antes de pedirlo para que el navegador no la bloquee.
  const abrir = async (d) => {
    setErrorAbrir(null);
    const pestana = window.open('', '_blank');
    try {
      const url = await api.abrirDocumentoMascota(d.ruta);
      if (pestana) pestana.location.href = url; else window.location.href = url;
    } catch (e) {
      if (pestana) pestana.close();
      setErrorAbrir('No pudimos abrir ese documento. Intenta de nuevo.');
    }
  };

  return html`<${Seccion} id="documentos" titulo="Documentos" sub="Estudios, recetas y la cartilla física.">
    <div class="stack">
      <div class="row">
        <label class="lv-btn lv-btn-ghost lv-btn-sm foto-btn">
          <input class="sr-only" type="file" accept="image/*,application/pdf" onChange=${elegir} disabled=${envio.enviando} />
          ${archivo ? 'Cambiar archivo' : 'Elegir archivo'}
        </label>
        ${archivo
          ? html`<span class="small"><b>${archivo.name}</b> <span class="muted">· ${pesoLegible(archivo.size)}</span></span>`
          : html`<span class="small muted">Foto o PDF, hasta 10 MB.</span>`}
      </div>

      ${archivo && html`<div class="stack">
        <div class="field-row">
          <${DS.Field} label="Tipo" as="select" value=${tipo} onChange=${(e) => setTipo(e.target.value)}
            options=${Object.entries(DOC_MASCOTA).map(([value, label]) => ({ value, label }))} />
          <${DS.Field} label="Nombre (opcional)" value=${titulo} onChange=${(e) => setTitulo(e.target.value)}
            hint="Por ejemplo: “Biometría de marzo”." />
        </div>
        ${envio.error && html`<${DS.Notice} tone="error">${envio.error}<//>`}
        <div class="row">
          <${DS.Button} size="sm" onClick=${subir} disabled=${envio.enviando}>${envio.enviando ? 'Subiendo…' : 'Subir documento'}<//>
          <${DS.Button} variant="ghost" size="sm" onClick=${() => setArchivo(null)} disabled=${envio.enviando}>Cancelar<//>
        </div>
      </div>`}

      ${errorAbrir && html`<span class="small doc-error" role="alert">${errorAbrir}</span>`}

      ${m.documentos.length
        ? html`<ul class="hist">${m.documentos.map((d) => html`<li key=${d.id}>
            <div class="spread">
              <b>${d.titulo}</b>
              <button type="button" class="linkish" onClick=${() => abrir(d)}>Abrir</button>
            </div>
            <span class="small muted">${DOC_MASCOTA[d.tipo]} · ${fechaDia(d.created_at.slice(0, 10))}${d.mio ? '' : ' · lo subió tu médico veterinario'}</span>
          </li>`)}</ul>`
        : !archivo && html`<div class="vacio"><${Icon} name="doc" /><div><b class="small">Sin documentos.</b>
            <p class="small muted">Sube su cartilla física, estudios de laboratorio o recetas anteriores.</p></div></div>`}
      ${m.documentos.length > 0 && html`<p class="small muted">Estos documentos son privados: solo tú y el médico veterinario que atiende a ${m.nombre} pueden abrirlos.</p>`}
    </div>
  <//>`;
}

// ───────── Historia clínica ─────────
const CAMPOS_CLINICOS = [
  ['valoracion', 'Valoración'], ['diagnosticos', 'Diagnósticos'], ['indicaciones', 'Indicaciones'],
  ['tratamientos', 'Tratamientos'], ['recomendaciones', 'Recomendaciones'], ['seguimiento', 'Seguimiento'],
];

function Historia({ m }) {
  if (!m.historia.length) {
    return html`<${Seccion} id="historia" titulo="Historia clínica">
      <div class="vacio"><${Icon} name="doc" /><div><b class="small">Todavía no hay consultas.</b>
        <p class="small muted">Cuando ${m.nombre} tenga su primera consulta, aquí queda lo que el médico veterinario encontró.</p></div></div>
    <//>`;
  }
  return html`<${Seccion} id="historia" titulo="Historia clínica" sub=${m.historia.length === 1 ? '1 consulta' : m.historia.length + ' consultas'}>
    <ul class="hist">
      ${m.historia.map((c) => {
        const signos = [c.peso_kg != null ? c.peso_kg + ' kg' : null, c.temperatura_c != null ? c.temperatura_c + ' °C' : null].filter(Boolean);
        const campos = CAMPOS_CLINICOS.filter(([k]) => c[k]);
        return html`<li key=${c.reserva_id}>
          <div class="spread">
            <b>${capital(fechaDia(String(c.fecha).slice(0, 10)))} · ${TIPO_CONSULTA[c.tipo]}</b>
            ${c.version > 1 && html`<${DS.Badge}>Corregida<//>`}
          </div>
          <span class="small muted">${[c.medico, c.motivo].filter(Boolean).join(' · ')}${signos.length ? ' · ' + signos.join(' · ') : ''}</span>
          ${campos.length
            ? html`<details><summary class="linkish">Ver lo que encontró</summary>
                <dl class="datos" style=${{ marginTop: 8 }}>
                  ${campos.map(([k, label]) => html`<${React.Fragment} key=${k}><dt>${label}</dt><dd>${c[k]}</dd><//>`)}
                </dl></details>`
            : html`<span class="small muted">El médico veterinario todavía no captura la información clínica.</span>`}
        </li>`;
      })}
    </ul>
  <//>`;
}
