// Agenda del médico veterinario (fase 5): calendario por semana, horario semanal, días bloqueados,
// precios, "mismo día" y catálogo de vacunas y desparasitantes. Sin personajes (de colega a colega).
import {
  html, DS, Icon, useState, useMemo, useEffect, money, hoyISO, capital, fechaDiaLarga, TIPO_CONSULTA, ESTADO_RESERVA,
  DIAS_SEMANA, DIAS_CORTOS, sumarDias, diaSemana, lunesDe, hhmm, horaNum, dosDig, isoDe, numDia, mesCorto,
  bloquesDelDia, nBloques, recibe, TIPO_PRODUCTO, ESPECIE_PRODUCTO, OCUPA_BLOQUE, hora,
} from '../lib.js';
import { api } from '../api.js';
import { PageHead, Cargando, ErrorCarga, useDatos, useToast, ir } from '../shell.js';
import { Seccion, useEnvio } from '../componentes.js';

const PESTANAS = [
  ['calendario', 'Calendario'],
  ['horario', 'Horario semanal'],
  ['dias', 'Días bloqueados'],
  ['precios', 'Precios y catálogo'],
];
const SEMANAS_ADELANTE = 8;
const TIPO_CORTO = { general: 'General', especialidad: 'Especializada', vacunacion: 'Vacunación' };
const MAX_DIAS_BLOQUEO = 60;

export function Agenda({ perfil, onPerfil, sub }) {
  const pestana = PESTANAS.some(([id]) => id === sub) ? sub : 'calendario';
  const { cargando, datos, error, recargar } = useDatos(() => api.miAgenda(), []);

  if (cargando && !datos) return html`<div class="page"><${Cargando} /></div>`;
  if (error) return html`<div class="page"><${ErrorCarga} error=${error} onReintentar=${recargar} /></div>`;

  const vis = visibilidad(perfil, datos);
  const props = { perfil, onPerfil, datos, recargar };
  return html`<div class="page">
    <${PageHead} titulo="Agenda" sub=${vis.resumen} />
    <div class="filtros" role="radiogroup" aria-label="Partes de tu agenda">
      ${PESTANAS.map(([id, label]) => html`<${DS.Chip} key=${id} type="radio" name="ag" checked=${pestana === id}
        onChange=${() => ir(id === 'calendario' ? 'agenda' : 'agenda/' + id)}>${label}<//>`)}
    </div>
    ${pestana === 'calendario' && html`<${Calendario} ...${props} vis=${vis} />`}
    ${pestana === 'horario' && html`<${Horario} ...${props} />`}
    ${pestana === 'dias' && html`<${DiasBloqueados} ...${props} />`}
    ${pestana === 'precios' && html`<${Precios} ...${props} />`}
  </div>`;
}

// ¿Ya lo pueden encontrar los tutores? Lo mismo que revisa bloques_disponibles en la base.
function visibilidad(perfil, datos) {
  const x = perfil.extra || {};
  const activos = datos.catalogo.filter((p) => p.activo);
  const pasos = [
    { id: 'alta', ok: x.estado === 'aprobado', txt: 'Tu alta está aprobada', falta: 'Tu alta todavía no está aprobada', ir: 'hoy', boton: 'Ver mi solicitud' },
    { id: 'dias', ok: datos.dias.length > 0, txt: `Atiendes ${datos.dias.length} ${datos.dias.length === 1 ? 'día' : 'días'} a la semana`, falta: 'Elige qué días atiendes, en qué alcaldía y a qué hora', ir: 'agenda/horario', boton: 'Poner horario' },
    { id: 'precio', ok: x.precio_general != null || activos.length > 0, txt: 'Tienes precio de consulta o productos de vacunación', falta: 'Pon tu precio de consulta general o agrega vacunas a tu catálogo', ir: 'agenda/precios', boton: 'Poner precios' },
  ];
  const alcaldias = [...new Set(datos.dias.map((d) => nombreAlcaldia(datos, d.alcaldia_id)))];
  const lista = pasos.every((p) => p.ok);
  const resumen = lista
    ? `Los tutores ven tus bloques en ${unir(alcaldias)}.`
    : 'Todavía no apareces a los tutores.';
  const ofrece = [
    x.precio_general != null && 'consulta general',
    x.precio_especialidad != null && x.estado_especialidad === 'aprobado' && 'consulta especializada',
    activos.length > 0 && 'vacunación y desparasitación',
  ].filter(Boolean);
  return { pasos, lista, resumen, alcaldias, ofrece };
}
const unir = (xs) => (xs.length <= 1 ? xs.join('') : xs.slice(0, -1).join(', ') + ' y ' + xs[xs.length - 1]);
const nombreAlcaldia = (datos, id) => datos.alcaldias.find((a) => a.id === Number(id))?.nombre || '';

// ═════════ Calendario ═════════
function Calendario({ perfil, datos, recargar, vis }) {
  const hoy = hoyISO();
  const [semana, setSemana] = useState(0);
  const desde = sumarDias(lunesDe(hoy), semana * 7);
  const hasta = sumarDias(desde, 6);
  const cons = useDatos(() => api.consultasMvz(desde, hasta), [desde]);
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(desde, i));
  const titulo = numDia(desde) + (mesCorto(desde) !== mesCorto(hasta) ? ' de ' + mesCorto(desde) : '') + ' al ' + numDia(hasta) + ' de ' + mesCorto(hasta);

  return html`<div class="stack">
    ${!vis.lista && html`<${Pendientes} pasos=${vis.pasos} />`}
    ${vis.lista && html`<${DS.Notice} tone="exito" title=${`Ofreces ${unir(vis.ofrece)}.`}>
      Los tutores de ${unir(vis.alcaldias)} pueden reservar tus bloques libres. Cuando alguien paga, el bloque se ocupa y te avisamos por correo.
    <//>`}

    <section class="box" aria-labelledby="t-sem">
      <div class="box-head cal-head">
        <h2 id="t-sem">Semana del ${titulo}</h2>
        <div class="row cal-nav">
          ${semana !== 0 && html`<${DS.Button} variant="ghost" size="sm" onClick=${() => setSemana(0)}>Esta semana<//>`}
          <button class="tool cal-flecha" type="button" disabled=${semana === 0} onClick=${() => setSemana((s) => s - 1)} aria-label="Semana anterior"><${Icon} name="back" /></button>
          <button class="tool cal-flecha" type="button" disabled=${semana >= SEMANAS_ADELANTE} onClick=${() => setSemana((s) => s + 1)} aria-label="Semana siguiente"><span class="flip"><${Icon} name="back" /></span></button>
        </div>
      </div>
      ${cons.error ? html`<${ErrorCarga} error=${cons.error} onReintentar=${cons.recargar} />` : html`
        <div class=${'semana' + (cons.cargando ? ' cargando' : '')} aria-busy=${cons.cargando}>
          ${dias.map((iso) => html`<${Dia} key=${iso} iso=${iso} hoy=${hoy} perfil=${perfil} datos=${datos}
            consultas=${(cons.datos || []).filter((c) => isoDe(c.inicia_at) === iso)} onCambio=${recargar} />`)}
        </div>`}
      <div class="leyenda small muted" aria-hidden="true">
        <span><i class="ley ley-libre"></i>Libre</span><span><i class="ley ley-res"></i>Reservado</span><span><i class="ley ley-off"></i>No disponible</span>
      </div>
    </section>
  </div>`;
}

function Pendientes({ pasos }) {
  return html`<section class="box" aria-labelledby="t-pend">
    <div class="box-head"><div><h2 id="t-pend">Para aparecer a los tutores</h2>
      <p class="small muted" style=${{ marginTop: 2 }}>Cuando completes esto, tus bloques libres se ofrecen solos.</p></div></div>
    <ul class="checklist">
      ${pasos.map((p) => html`<li key=${p.id} class=${p.ok ? 'ok' : 'falta'}>
        <${Icon} name=${p.ok ? 'check' : 'info'} />
        <div><span>${p.ok ? p.txt : p.falta}</span></div>
        ${p.ok ? html`<${DS.Badge} tone="verificado">Listo<//>` : html`<${DS.Button} size="sm" variant="secondary" onClick=${() => ir(p.ir)}>${p.boton}<//>`}
      </li>`)}
    </ul>
  </section>`;
}

function Dia({ iso, hoy, perfil, datos, consultas, onCambio }) {
  const toast = useToast();
  const [envio, correr] = useEnvio();
  const conf = datos.dias.find((d) => d.dia_semana === diaSemana(iso));
  const bloqueo = datos.bloqueados.find((b) => b.dia === iso);
  const pasado = iso < hoy;
  const esHoy = iso === hoy;
  const mismoDia = !!perfil.extra?.acepta_mismo_dia;
  const horas = datos.params.horas_bloque || 2;
  const ocupan = consultas.filter((c) => OCUPA_BLOQUE.has(c.estado));
  const activas = consultas.filter((c) => ['confirmada', 'en_domicilio'].includes(c.estado));
  const limite = Date.now() + 30 * 6e4;

  // Bloques del horario, más consultas que quedaron fuera (por ejemplo, de un horario anterior)
  const filas = bloquesDelDia(iso, conf, horas).map((b) => {
    const c = ocupan.find((x) => new Date(x.inicia_at) < b.fin && new Date(x.termina_at) > b.ini);
    return { ...b, consulta: c };
  });
  ocupan.filter((c) => !filas.some((f) => f.consulta === c)).forEach((c) => {
    filas.push({ ini: new Date(c.inicia_at), fin: new Date(c.termina_at), desde: hora(c.inicia_at), hasta: hora(c.termina_at), consulta: c });
  });
  filas.sort((a, b) => a.ini - b.ini);

  const bloquear = async () => {
    if (await correr(() => api.bloquearDias([iso], null))) { toast(`Bloqueaste el ${fechaDiaLarga(iso)}.`); onCambio(); }
  };
  const desbloquear = async () => {
    if (await correr(() => api.desbloquearDia(iso))) { toast(`Volviste a abrir el ${fechaDiaLarga(iso)}.`); onCambio(); }
  };

  const etiqueta = `${DIAS_SEMANA[diaSemana(iso) - 1]} ${numDia(iso)} de ${mesCorto(iso)}`;
  return html`<article class=${'cal-dia' + (esHoy ? ' es-hoy' : '') + (pasado ? ' pasado' : '')} aria-label=${etiqueta}>
    <header class="cal-dia-head">
      <div class="cal-fecha"><span class="small muted">${DIAS_CORTOS[diaSemana(iso) - 1]}</span><b class="num">${numDia(iso)}</b>${esHoy && html`<${DS.Badge} tone="nuevo">Hoy<//>`}</div>
      <span class="small cal-donde">${bloqueo ? 'Día bloqueado' : conf ? nombreAlcaldia(datos, conf.alcaldia_id) : 'No atiendes'}</span>
    </header>
    <div class="cal-bloques">
      ${bloqueo && !ocupan.length ? html`<p class="small muted cal-nota">${bloqueo.motivo || 'No recibes consultas este día.'}</p>` : null}
      ${(!bloqueo || ocupan.length > 0) && filas.map((f) => {
        if (f.consulta) {
          const c = f.consulta;
          const [tono, txt] = ESTADO_RESERVA[c.estado] || ['neutral', c.estado];
          return html`<div key=${f.desde} class="blk blk-res" title=${[TIPO_CONSULTA[c.tipo], c.motivo].filter(Boolean).join(' · ')}>
            <span class="blk-h num">${f.desde}–${f.hasta}</span>
            <b>${c.mascota_nombre}</b>
            <span class="small">${TIPO_CORTO[c.tipo]}${c.colonia ? ' · ' + c.colonia : ''}</span>
            <${DS.Badge} tone=${tono}>${txt}<//>
          </div>`;
        }
        if (bloqueo) return null;
        const ya = f.ini.getTime() <= limite;
        const sinMismoDia = !ya && esHoy && !mismoDia;
        return html`<div key=${f.desde} class=${'blk ' + (ya || sinMismoDia ? 'blk-off' : 'blk-libre')}>
          <span class="blk-h num">${f.desde}–${f.hasta}</span>
          <span class="small">${ya ? 'Ya pasó' : sinMismoDia ? 'No aceptas el mismo día' : esHoy ? 'Libre · mismo día' : 'Libre'}</span>
        </div>`;
      })}
    </div>
    ${!pasado && (conf || bloqueo) && html`<footer class="cal-dia-pie">
      ${bloqueo
        ? html`<button type="button" class="linkish" onClick=${desbloquear} disabled=${envio.enviando}>${envio.enviando ? 'Abriendo…' : 'Volver a abrir'}</button>`
        : activas.length === 0 && html`<button type="button" class="linkish" onClick=${bloquear} disabled=${envio.enviando}>${envio.enviando ? 'Bloqueando…' : 'Bloquear día'}</button>`}
      ${envio.error && html`<span class="small doc-error" role="alert">${envio.error}</span>`}
    </footer>`}
  </article>`;
}

// ═════════ Horario semanal ═════════
const HORAS_INICIO = Array.from({ length: 15 }, (_, i) => i + 6); // 6:00 a 20:00
const aFila = (d) => (d
  ? { activo: true, alcaldia_id: String(d.alcaldia_id), ini: horaNum(d.hora_inicio), fin: horaNum(d.hora_fin) }
  : { activo: false, alcaldia_id: '', ini: 9, fin: 15 });

function Horario({ datos, recargar }) {
  const toast = useToast();
  const horas = datos.params.horas_bloque || 2;
  const inicial = useMemo(() => DIAS_SEMANA.map((_, i) => aFila(datos.dias.find((d) => d.dia_semana === i + 1))), [datos]);
  const [filas, setFilas] = useState(inicial);
  useEffect(() => setFilas(inicial), [inicial]);
  const [errores, setErrores] = useState({});
  const [envio, correr] = useEnvio();
  const cambiado = JSON.stringify(filas) !== JSON.stringify(inicial);

  const set = (i, cambios) => setFilas((fs) => fs.map((f, j) => {
    if (j !== i) return f;
    const n = { ...f, ...cambios };
    if (n.fin - n.ini < horas || (n.fin - n.ini) % horas) n.fin = Math.min(22, n.ini + Math.max(horas, Math.floor((n.fin - n.ini) / horas) * horas));
    if (n.fin > 22) n.fin = n.ini + Math.floor((22 - n.ini) / horas) * horas;
    return n;
  }));
  const copiarATodos = (i) => {
    const o = filas[i];
    setFilas((fs) => fs.map((f) => (f.activo ? { ...f, alcaldia_id: o.alcaldia_id, ini: o.ini, fin: o.fin } : f)));
    toast(`Copiaste el horario del ${DIAS_SEMANA[i].toLowerCase()} a tus demás días.`, { tone: 'info' });
  };

  const guardar = async (ev) => {
    ev.preventDefault();
    const e = {};
    filas.forEach((f, i) => { if (f.activo && !f.alcaldia_id) e[i] = 'Elige la alcaldía.'; });
    setErrores(e);
    if (Object.keys(e).length) return;
    const activos = filas.map((f, i) => ({ f, d: i + 1 })).filter(({ f }) => f.activo)
      .map(({ f, d }) => ({ dia_semana: d, alcaldia_id: Number(f.alcaldia_id), hora_inicio: dosDig(f.ini) + ':00', hora_fin: dosDig(f.fin) + ':00' }));
    if (await correr(() => api.guardarHorario(activos))) { toast('Guardamos tu horario.'); recargar(); }
  };

  const totalBloques = filas.reduce((a, f) => a + (f.activo ? nBloques(f.ini, f.fin, horas) : 0), 0);
  const alcs = [{ value: '', label: 'Elige…' }, ...datos.alcaldias.map((a) => ({ value: String(a.id), label: a.nombre }))];

  return html`<form class="grid-2" onSubmit=${guardar} noValidate=${true}>
    <section class="box" aria-labelledby="t-hor">
      <div class="box-head"><div><h2 id="t-hor">Horario semanal</h2>
        <p class="small muted" style=${{ marginTop: 2 }}>${totalBloques ? `${totalBloques} bloques de ${horas} horas a la semana.` : 'Marca los días que atiendes.'}</p></div></div>
      <div class="horario">
        ${filas.map((f, i) => {
          const finOps = [];
          for (let h = f.ini + horas; h <= 22; h += horas) finOps.push({ value: String(h), label: dosDig(h) + ':00' });
          const n = nBloques(f.ini, f.fin, horas);
          return html`<div key=${i} class=${'hor-fila' + (f.activo ? '' : ' off')}>
            <label class="check hor-dia"><input type="checkbox" checked=${f.activo} onChange=${(e) => set(i, { activo: e.target.checked })} />
              <b>${DIAS_SEMANA[i]}</b></label>
            ${f.activo ? html`
              <${DS.Field} className="hor-alc" label="Alcaldía" as="select" value=${f.alcaldia_id} options=${alcs}
                onChange=${(e) => set(i, { alcaldia_id: e.target.value })} error=${errores[i]} />
              <${DS.Field} className="hor-h" label="De" as="select" value=${String(f.ini)}
                options=${HORAS_INICIO.filter((h) => h + horas <= 22).map((h) => ({ value: String(h), label: dosDig(h) + ':00' }))}
                onChange=${(e) => set(i, { ini: Number(e.target.value) })} />
              <${DS.Field} className="hor-h" label="A" as="select" value=${String(f.fin)} options=${finOps}
                onChange=${(e) => set(i, { fin: Number(e.target.value) })} />
              <div class="hor-res small">
                <span class="muted">${n} ${n === 1 ? 'bloque' : 'bloques'}: ${Array.from({ length: n }, (_, k) => `${f.ini + k * horas}–${f.ini + (k + 1) * horas}`).join(' · ')}</span>
                ${filas.filter((x) => x.activo).length > 1 && html`<button type="button" class="linkish" onClick=${() => copiarATodos(i)}>Copiar a mis demás días</button>`}
              </div>`
            : html`<span class="small muted hor-no">No atiendes</span>`}
          </div>`;
        })}
      </div>
      ${envio.error && html`<${DS.Notice} tone="error" title="No se guardó tu horario.">${envio.error}.<//>`}
      <div class="row" style=${{ marginTop: 'var(--espacio-4)' }}>
        <${DS.Button} type="submit" disabled=${envio.enviando || !cambiado}>${envio.enviando ? 'Guardando…' : 'Guardar horario'}<//>
        ${cambiado && html`<${DS.Button} variant="ghost" onClick=${() => { setFilas(inicial); setErrores({}); }} disabled=${envio.enviando}>Deshacer cambios<//>`}
      </div>
    </section>
    <aside class="stack" aria-label="Cómo funciona">
      <${DS.Notice} tone="info" title="Una alcaldía por día.">Así no pierdes tiempo en traslados. Puedes atender una alcaldía distinta cada día.<//>
      <section class="box box-tight">
        <ul class="guia">
          <li>Cada consulta ocupa un bloque de ${horas} horas, con el traslado incluido.</li>
          <li>Los bloques se generan solos con tu horario; tú no tienes que publicar nada.</li>
          <li>Los tutores reservan hasta 30 minutos antes de que empiece un bloque.</li>
          <li>Si ya tienes una consulta pagada un día, no puedes quitar ese día ni cambiar su alcaldía hasta que pase. Si es urgente, escribe a soporte.</li>
          <li>Para no atender un día en particular (vacaciones, un congreso), usa <a href="#/agenda/dias">Días bloqueados</a>.</li>
        </ul>
      </section>
    </aside>
  </form>`;
}

// ═════════ Días bloqueados ═════════
function DiasBloqueados({ datos, recargar }) {
  const toast = useToast();
  const hoy = hoyISO();
  const [f, setF] = useState({ desde: '', hasta: '', motivo: '' });
  const [err, setErr] = useState({});
  const [envio, correr] = useEnvio();
  const [quitando, setQuitando] = useState(null);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const atiende = new Set(datos.dias.map((d) => d.dia_semana));

  const enviar = async (ev) => {
    ev.preventDefault();
    const e = {};
    if (!f.desde) e.desde = 'Elige el día.';
    else if (f.desde < hoy) e.desde = 'Ese día ya pasó.';
    if (f.hasta && f.desde && f.hasta < f.desde) e.hasta = 'Debe ser el mismo día o después.';
    const dias = [];
    if (!Object.keys(e).length) {
      for (let d = f.desde; d <= (f.hasta || f.desde); d = sumarDias(d, 1)) dias.push(d);
      if (dias.length > MAX_DIAS_BLOQUEO) e.hasta = `Máximo ${MAX_DIAS_BLOQUEO} días seguidos.`;
    }
    if (f.motivo.length > 120) e.motivo = 'Máximo 120 caracteres.';
    setErr(e);
    if (Object.keys(e).length) return;
    if (await correr(() => api.bloquearDias(dias, f.motivo.trim()))) {
      toast(dias.length === 1 ? `Bloqueaste el ${fechaDiaLarga(dias[0])}.` : `Bloqueaste ${dias.length} días.`);
      setF({ desde: '', hasta: '', motivo: '' });
      recargar();
    }
  };
  const quitar = async (dia, todos) => {
    setQuitando(dia);
    try {
      for (const d of todos || [dia]) await api.desbloquearDia(d);
      toast(todos ? `Volviste a abrir ${todos.length} días.` : `Volviste a abrir el ${fechaDiaLarga(dia)}.`);
      recargar();
    }
    catch (e) { toast(e.message, { tone: 'info' }); }
    finally { setQuitando(null); }
  };

  // Rangos seguidos con el mismo motivo se muestran juntos
  const grupos = [];
  datos.bloqueados.forEach((b) => {
    const g = grupos[grupos.length - 1];
    if (g && g.motivo === b.motivo && sumarDias(g.hasta, 1) === b.dia) { g.hasta = b.dia; g.dias.push(b.dia); }
    else grupos.push({ desde: b.dia, hasta: b.dia, motivo: b.motivo, dias: [b.dia] });
  });

  return html`<div class="grid-2">
    <section class="box" aria-labelledby="t-bloq">
      <div class="box-head"><div><h2 id="t-bloq">Próximos días bloqueados</h2>
        <p class="small muted" style=${{ marginTop: 2 }}>Esos días no se ofrece ningún bloque, aunque estén en tu horario.</p></div></div>
      ${grupos.length === 0
        ? html`<p class="muted">No tienes días bloqueados. Úsalo para vacaciones, congresos o cualquier día que no puedas atender.</p>`
        : html`<ul class="hist">${grupos.map((g) => html`<li key=${g.desde}>
            <div class="spread">
              <div class="stack-sm" style=${{ gap: 2 }}>
                <b class="small">${g.dias.length === 1 ? capital(fechaDiaLarga(g.desde)) : `Del ${fechaDiaLarga(g.desde)} al ${fechaDiaLarga(g.hasta)}`}
                  <span class="muted"> · ${g.dias.length === 1 ? DIAS_SEMANA[diaSemana(g.desde) - 1].toLowerCase() : g.dias.length + ' días'}</span></b>
                ${g.motivo && html`<span class="small muted">${g.motivo}</span>`}
                ${g.dias.length === 1 && !atiende.has(diaSemana(g.desde)) && html`<span class="small muted">Ese día de la semana no atiendes de todos modos.</span>`}
              </div>
              <${DS.Button} size="sm" variant="ghost" disabled=${quitando === g.desde}
                onClick=${() => quitar(g.desde, g.dias.length > 1 ? g.dias : null)}>${quitando === g.desde ? 'Abriendo…' : g.dias.length > 1 ? 'Abrir todos' : 'Volver a abrir'}<//>
            </div>
            ${g.dias.length > 1 && html`<div class="row" style=${{ gap: 'var(--espacio-2)' }}>
              ${g.dias.map((d) => html`<button key=${d} type="button" class="dia-chip" disabled=${quitando === d} onClick=${() => quitar(d)}
                aria-label=${'Volver a abrir el ' + fechaDiaLarga(d)}>${DIAS_CORTOS[diaSemana(d) - 1]} ${numDia(d)} <${Icon} name="x" /></button>`)}
            </div>`}
          </li>`)}</ul>`}
    </section>

    <form class="box stack" onSubmit=${enviar} noValidate=${true} aria-labelledby="t-nbloq">
      <div><h2 id="t-nbloq" class="section-title">Bloquear días</h2>
        <p class="small muted" style=${{ marginTop: 2 }}>Para un solo día, deja vacío “Hasta”.</p></div>
      <div class="field-row">
        <${DS.Field} label="Desde" type="date" min=${hoy} max=${sumarDias(hoy, 366)} value=${f.desde} onChange=${set('desde')} error=${err.desde} />
        <${DS.Field} label="Hasta (opcional)" type="date" min=${f.desde || hoy} max=${sumarDias(hoy, 366)} value=${f.hasta} onChange=${set('hasta')} error=${err.hasta} />
      </div>
      <${DS.Field} label="Motivo (opcional)" value=${f.motivo} onChange=${set('motivo')} maxLength=${120} error=${err.motivo}
        hint="Solo lo ves tú y LilieVET." />
      ${envio.error && html`<${DS.Notice} tone="error" title="No se bloquearon los días.">${envio.error}.<//>`}
      <div><${DS.Button} type="submit" disabled=${envio.enviando}>${envio.enviando ? 'Bloqueando…' : 'Bloquear'}<//></div>
      <p class="small muted">Si ya tienes una consulta pagada ese día, no se puede bloquear desde aquí: escribe a soporte para avisarle al tutor.</p>
    </form>
  </div>`;
}

// ═════════ Precios y catálogo ═════════
function Precios({ perfil, onPerfil, datos, recargar }) {
  return html`<div class="grid-2">
    <${Catalogo} datos=${datos} recargar=${recargar} />
    <div class="stack"><${PreciosConsulta} perfil=${perfil} onPerfil=${onPerfil} params=${datos.params} /></div>
  </div>`;
}

function PreciosConsulta({ perfil, onPerfil, params }) {
  const toast = useToast();
  const x = perfil.extra || {};
  const minG = params.precio_min_general || 500;
  const minE = params.precio_min_especialidad || 1000;
  const com = params.comision ?? 0.225;
  const rec = params.recargo_mismo_dia ?? 0.4;
  const conEsp = !!x.especialidad_id && x.estado_especialidad === 'aprobado';
  const inicial = { general: x.precio_general != null ? String(Number(x.precio_general)) : '', esp: x.precio_especialidad != null ? String(Number(x.precio_especialidad)) : '', mismo: !!x.acepta_mismo_dia };
  const [f, setF] = useState(inicial);
  const [err, setErr] = useState({});
  const [envio, correr] = useEnvio();
  const cambiado = JSON.stringify(f) !== JSON.stringify(inicial);

  const guardar = async (ev) => {
    ev.preventDefault();
    const e = {};
    if (f.general !== '' && !(Number(f.general) >= minG)) e.general = `Mínimo ${money(minG)}.`;
    if (conEsp && f.esp !== '' && !(Number(f.esp) >= minE)) e.esp = `Mínimo ${money(minE)}.`;
    if (Number(f.general) > 20000 || Number(f.esp) > 20000) e[Number(f.general) > 20000 ? 'general' : 'esp'] = 'Máximo $20,000.';
    setErr(e);
    if (Object.keys(e).length) return;
    const d = { precio_general: f.general === '' ? null : Number(f.general), acepta_mismo_dia: f.mismo };
    if (conEsp) d.precio_especialidad = f.esp === '' ? null : Number(f.esp);
    if (await correr(() => api.guardarMvz(d))) { toast('Guardamos tus precios.'); onPerfil(); }
  };

  const ejemplo = (p) => (p !== '' && Number(p) > 0 ? Number(p) : null);
  const g = ejemplo(f.general);
  return html`<form class="box stack" onSubmit=${guardar} noValidate=${true} aria-labelledby="t-prec">
    <div><h2 id="t-prec" class="section-title">Precios de consulta</h2>
      <p class="small muted" style=${{ marginTop: 2 }}>Incluye tu traslado. La comisión de LilieVET es de ${(com * 100).toLocaleString('es-MX')}% sobre lo que se cobra.</p></div>
    <${DS.Field} label="Consulta general" type="number" inputMode="numeric" min=${minG} step="10" value=${f.general}
      onChange=${(e) => setF((x2) => ({ ...x2, general: e.target.value }))} error=${err.general}
      hint=${g ? `Recibes ${money(recibe(g, com))} por consulta.` : `Mínimo ${money(minG)}. Si lo dejas vacío, no ofreces consulta general.`} />
    ${conEsp
      ? html`<${DS.Field} label=${'Consulta especializada · ' + (x.especialidades?.nombre || 'tu especialidad')} type="number" inputMode="numeric" min=${minE} step="10" value=${f.esp}
          onChange=${(e) => setF((x2) => ({ ...x2, esp: e.target.value }))} error=${err.esp}
          hint=${ejemplo(f.esp) ? `Recibes ${money(recibe(ejemplo(f.esp), com))} por consulta.` : `Mínimo ${money(minE)}.`} />`
      : html`<p class="small muted">${x.especialidad_id ? 'Podrás poner el precio de consulta especializada cuando aprobemos tu especialidad.' : 'Si tienes una especialidad, regístrala en tu Perfil para ofrecer consulta especializada.'}</p>`}
    <label class="check"><input type="checkbox" checked=${f.mismo} onChange=${(e) => setF((x2) => ({ ...x2, mismo: e.target.checked }))} />
      <span><b>Acepto consultas el mismo día</b><br />
        <span class="muted">El tutor paga ${Math.round(rec * 100)}% más por reservar para hoy, y tú recibes tu parte del recargo.${g && f.mismo ? ` Ejemplo: consulta general de hoy, el tutor paga ${money(g * (1 + rec))} y tú recibes ${money(recibe(g * (1 + rec), com))}.` : ''}</span></span>
    </label>
    ${envio.error && html`<${DS.Notice} tone="error">${envio.error}<//>`}
    <div class="row">
      <${DS.Button} type="submit" disabled=${envio.enviando || !cambiado}>${envio.enviando ? 'Guardando…' : 'Guardar precios'}<//>
    </div>
    <p class="small muted">Un cambio de precio aplica a las reservas nuevas. Las consultas ya pagadas conservan su precio.</p>
  </form>`;
}

const PRODUCTO_VACIO = { tipo: 'vacuna', nombre: '', especie: '', precio: '' };

function Catalogo({ datos, recargar }) {
  const toast = useToast();
  const com = datos.params.comision ?? 0.225;
  const [editando, setEditando] = useState(null); // null, 'nuevo' o el id
  const [ocupado, setOcupado] = useState(null);
  const lista = [...datos.catalogo].sort((a, b) => (b.activo - a.activo) || a.tipo.localeCompare(b.tipo) || a.nombre.localeCompare(b.nombre));

  const alternar = async (p) => {
    setOcupado(p.id);
    try { await api.guardarProducto(p.id, { activo: !p.activo }); toast(p.activo ? `Pausaste ${p.nombre}.` : `${p.nombre} vuelve a ofrecerse.`); recargar(); }
    catch (e) { toast(e.message, { tone: 'info' }); }
    finally { setOcupado(null); }
  };
  const quitar = async (p) => {
    setOcupado(p.id);
    try {
      const r = await api.quitarProducto(p.id);
      toast(r === 'desactivado' ? `${p.nombre} ya se usó en consultas: lo pausamos para conservar el historial.` : `Quitaste ${p.nombre}.`, { tone: 'info' });
      recargar();
    } catch (e) { toast(e.message, { tone: 'info' }); }
    finally { setOcupado(null); }
  };

  return html`<section class="box" aria-labelledby="t-cat">
    <div class="box-head">
      <div><h2 id="t-cat">Vacunas y desparasitantes</h2>
        <p class="small muted" style=${{ marginTop: 2 }}>Lo que aplicas a domicilio. El tutor elige del catálogo y ve el total antes de pagar.</p></div>
      ${editando !== 'nuevo' && html`<${DS.Button} size="sm" onClick=${() => setEditando('nuevo')}>Agregar<//>`}
    </div>
    ${editando === 'nuevo' && html`<${FormProducto} inicial=${PRODUCTO_VACIO} com=${com} onCancelar=${() => setEditando(null)}
      onGuardar=${async (d) => { await api.guardarProducto(null, d); toast(`Agregaste ${d.nombre}.`); setEditando(null); recargar(); }} />`}
    ${lista.length === 0 && editando !== 'nuevo'
      ? html`<p class="muted">Todavía no tienes productos. Sin catálogo no apareces en las búsquedas de vacunación.</p>`
      : html`<ul class="cat-lista">${lista.map((p) => editando === p.id
          ? html`<li key=${p.id}><${FormProducto} inicial=${{ tipo: p.tipo, nombre: p.nombre, especie: p.especie || '', precio: String(Number(p.precio)) }} com=${com}
              onCancelar=${() => setEditando(null)}
              onGuardar=${async (d) => { await api.guardarProducto(p.id, d); toast('Guardamos el cambio.'); setEditando(null); recargar(); }} /></li>`
          : html`<li key=${p.id} class=${'cat-item' + (p.activo ? '' : ' off')}>
              <div class="cat-txt">
                <b>${p.nombre}</b>
                <span class="small muted">${TIPO_PRODUCTO[p.tipo]} · ${ESPECIE_PRODUCTO[p.especie || '']}${p.activo ? '' : ' · pausado'}</span>
              </div>
              <div class="cat-precio num"><b>${money(Number(p.precio))}</b><span class="small muted">recibes ${money(recibe(p.precio, com))}</span></div>
              <div class="cat-acc">
                <${DS.Button} size="sm" variant="ghost" disabled=${ocupado === p.id} onClick=${() => setEditando(p.id)}>Editar<//>
                <${DS.Button} size="sm" variant="ghost" disabled=${ocupado === p.id} onClick=${() => alternar(p)}>${p.activo ? 'Pausar' : 'Activar'}<//>
                <${DS.Button} size="sm" variant="ghost" disabled=${ocupado === p.id} onClick=${() => quitar(p)} aria-label=${'Quitar ' + p.nombre}>Quitar<//>
              </div>
            </li>`)}</ul>`}
  </section>`;
}

function FormProducto({ inicial, onGuardar, onCancelar, com }) {
  const [f, setF] = useState(inicial);
  const [err, setErr] = useState({});
  const [envio, correr] = useEnvio();
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const enviar = async (ev) => {
    ev.preventDefault();
    const e = {};
    const nombre = f.nombre.trim().replace(/\s+/g, ' ');
    if (nombre.length < 2) e.nombre = 'Escribe el nombre.';
    if (!(Number(f.precio) >= 1 && Number(f.precio) <= 20000)) e.precio = 'Entre $1 y $20,000.';
    setErr(e);
    if (Object.keys(e).length) return;
    await correr(() => onGuardar({ tipo: f.tipo, nombre, especie: f.especie || null, precio: Number(f.precio) }));
  };
  return html`<form class="cat-form stack" onSubmit=${enviar} noValidate=${true}>
    <div class="field-row">
      <${DS.Field} label="Tipo" as="select" value=${f.tipo} onChange=${set('tipo')}
        options=${[{ value: 'vacuna', label: 'Vacuna' }, { value: 'desparasitante', label: 'Desparasitante' }]} />
      <${DS.Field} label="Para" as="select" value=${f.especie} onChange=${set('especie')}
        options=${Object.entries(ESPECIE_PRODUCTO).map(([value, label]) => ({ value, label }))} />
    </div>
    <div class="field-row">
      <${DS.Field} label="Nombre" value=${f.nombre} onChange=${set('nombre')} maxLength=${80} error=${err.nombre}
        hint=${f.tipo === 'vacuna' ? 'Por ejemplo: Séxtuple canina, Triple felina.' : 'Por ejemplo: Desparasitante interno.'} />
      <${DS.Field} label="Precio por aplicación" type="number" inputMode="numeric" min="1" step="10" value=${f.precio} onChange=${set('precio')} error=${err.precio}
        hint=${Number(f.precio) > 0 ? `Recibes ${money(recibe(f.precio, com))}.` : 'Con tu traslado incluido.'} />
    </div>
    ${envio.error && html`<${DS.Notice} tone="error">${envio.error}<//>`}
    <div class="row">
      <${DS.Button} type="submit" size="sm" disabled=${envio.enviando}>${envio.enviando ? 'Guardando…' : 'Guardar'}<//>
      <${DS.Button} variant="ghost" size="sm" onClick=${onCancelar} disabled=${envio.enviando}>Cancelar<//>
    </div>
  </form>`;
}
