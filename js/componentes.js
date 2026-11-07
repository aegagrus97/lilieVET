// Piezas compartidas: seguimiento de la consulta, subida de documentos y estado de verificación.
import { html, DS, Icon, useState, useRef, ESTADO_VERIF, DOC, fechaCorta, ventana, TIPO_CONSULTA } from './lib.js';
import { api } from './api.js';

// ───────── Seguimiento de la consulta del día ─────────
// Mismo aspecto que TrackingCard del sistema de diseño, con los pasos de la v3.2:
// confirmada → "Llegué" (el médico marca su llegada) → terminada. Sin "En camino".
const PASOS = [['confirmada', 'Confirmada'], ['en_domicilio', 'Llegó'], ['cerrada', 'Terminada']];
export function Seguimiento({ reserva, medico, nota, action, className = '' }) {
  const idx = Math.max(0, PASOS.findIndex(([e]) => e === reserva.estado));
  const badge = [['verificado', 'Confirmada'], ['verificado', 'Llegó'], ['completado', 'Terminada']][idx];
  const titular = idx === 0 ? ventana(reserva.inicia_at, reserva.termina_at) : idx === 1 ? 'Ya está en tu casa.' : 'Consulta terminada.';
  const nombre = medico ? `${medico.nombre} ${medico.apellidos}`.trim() : 'Tu médico veterinario';
  const ini = nombre.split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  return html`<article class=${'lv-track ' + className}>
    <div class="lv-track-head">
      <div class="lv-avatar lv-track-av" aria-hidden=${!medico?.foto}>${medico?.foto ? html`<img src=${medico.foto} alt=${nombre} />` : ini}</div>
      <div class="lv-track-who"><strong>${nombre}</strong>
        <span>Consulta de ${reserva.mascota?.nombre} · ${TIPO_CONSULTA[reserva.tipo].toLowerCase()}</span></div>
      <${DS.Badge} tone=${badge[0]}>${badge[1]}<//>
    </div>
    <p class="lv-track-eta"><b>${titular}</b></p>
    <ol class="lv-track-steps" aria-label="Avance de la consulta">
      ${PASOS.map(([id, label], i) => html`<li key=${id} class=${i < idx ? 'done' : i === idx ? 'now' : ''} aria-current=${i === idx ? 'step' : undefined}><i aria-hidden="true"></i>${label}</li>`)}
    </ol>
    ${nota && idx === 0 ? html`<p class="lv-track-note">${nota}</p>` : null}
    ${action ? html`<div class="lv-track-act">${action}</div>` : null}
  </article>`;
}

// ───────── Estado de verificación ─────────
export function EstadoVerif({ estado }) {
  const [tono, txt] = ESTADO_VERIF[estado] || ESTADO_VERIF.sin_enviar;
  return html`<${DS.Badge} tone=${tono}>${txt}<//>`;
}

// Caja con encabezado
export function Seccion({ titulo, sub, extra, children, id, className = '' }) {
  return html`<section class=${'box ' + className} id=${id} aria-labelledby=${id ? id + '-t' : undefined}>
    <div class="box-head"><div><h2 id=${id ? id + '-t' : undefined}>${titulo}</h2>${sub && html`<p class="small muted" style=${{ marginTop: 2 }}>${sub}</p>`}</div>${extra}</div>
    ${children}
  </section>`;
}

// ───────── Subir un documento ─────────
// La persona no puede volver a abrir lo que subió (solo LilieVET lo ve), así que la vista previa
// es la del archivo que acaba de elegir en este dispositivo.
export function SubirDocumento({ tipo, subido, onSubido, bloqueado, corregir }) {
  const d = DOC[tipo];
  const ref = useRef(null);
  const [estado, setEstado] = useState({ subiendo: false, error: null, preview: null, pdf: false });
  const elegir = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setEstado({ subiendo: true, error: null, preview: null, pdf: false });
    try {
      const r = await api.subirDocumento(tipo, file);
      setEstado({ subiendo: false, error: null, preview: file.type === 'application/pdf' ? null : r.local, pdf: file.type === 'application/pdf' });
      onSubido && onSubido(r);
    } catch (err) {
      setEstado({ subiendo: false, error: err.message || 'No se pudo subir. Intenta de nuevo.', preview: null, pdf: false });
    }
  };
  const listo = !!subido;
  const id = 'doc-' + tipo;
  return html`<div class=${'doc' + (listo ? ' doc-ok' : '') + (corregir ? ' doc-fix' : '')}>
    <div class="doc-thumb" aria-hidden="true">
      ${estado.preview ? html`<img src=${estado.preview} alt="" />`
        : html`<${Icon} name=${listo ? 'check' : d.selfie ? 'camera' : tipo === 'estado_cuenta' ? 'bank' : tipo.startsWith('ine') ? 'id' : 'doc'} />`}
    </div>
    <div class="doc-body">
      <b>${d.titulo}</b>
      <span class="small muted">${d.hint}</span>
      ${listo && !estado.error ? html`<span class="small doc-status">${estado.pdf ? 'PDF subido' : 'Subido'} el ${fechaCorta(subido.created_at)}</span>` : null}
      ${estado.error ? html`<span class="small doc-error" role="alert">${estado.error}</span>` : null}
    </div>
    ${!bloqueado && html`<div class="doc-act">
      <input ref=${ref} id=${id} class="sr-only" type="file" accept=${d.pdf ? 'image/*,application/pdf' : 'image/*'}
        capture=${d.selfie ? 'user' : undefined} onChange=${elegir} disabled=${estado.subiendo} />
      <${DS.Button} variant=${listo ? 'ghost' : 'secondary'} size="sm" disabled=${estado.subiendo} onClick=${() => ref.current && ref.current.click()}
        aria-label=${(listo ? 'Cambiar ' : 'Subir ') + d.titulo}>
        ${estado.subiendo ? 'Subiendo…' : listo ? 'Cambiar' : d.selfie ? 'Tomar selfie' : 'Subir'}
      <//>
    </div>`}
  </div>`;
}

// Nota de la última revisión (cuando LilieVET pidió corregir o rechazó)
export function NotaRevision({ nota, estado }) {
  if (!nota || !['info_requerida', 'rechazado'].includes(estado)) return null;
  return html`<${DS.Notice} tone="error" title=${estado === 'rechazado' ? 'No pudimos aprobarlo.' : 'Hay algo que corregir.'}>
    ${nota.nota}${estado === 'rechazado' ? ' Si crees que es un error, escríbenos a soporte.' : ''}
  <//>`;
}

// Envío con estado de espera y error en español
export function useEnvio() {
  const [st, setSt] = useState({ enviando: false, error: null });
  const correr = async (fn) => {
    setSt({ enviando: true, error: null });
    try { const r = await fn(); setSt({ enviando: false, error: null }); return r ?? true; }
    catch (e) { setSt({ enviando: false, error: e.message || 'Algo salió mal. Intenta de nuevo.' }); return false; }
  };
  return [st, correr, () => setSt({ enviando: false, error: null })];
}
