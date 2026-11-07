// Inicio del Panel: lo que pide atención hoy y cómo va el mes.
import { html, DS, money, hora, diaRelativo, fechaLarga, capital, TIPO_CONSULTA, ESTADO_RESERVA, OBJETO_VERIF, nombreCompleto, hace } from '../lib.js';
import { api } from '../api.js';
import { PageHead, Cargando, ErrorCarga, useDatos, ir } from '../shell.js';


export function InicioAdmin({ onConteos }) {
  const { cargando, datos, error, recargar } = useDatos(() => api.adminResumen().then((d) => { onConteos && onConteos({ porRevisar: d.kpis.porRevisar }); return d; }), []);
  const sub = capital(fechaLarga(new Date()));

  if (cargando) return html`<div class="page"><${Cargando} /></div>`;
  if (error) return html`<div class="page"><${ErrorCarga} error=${error} onReintentar=${recargar} /></div>`;
  const { kpis, revisiones, proximas, finanzas } = datos;

  return html`<div class="page">
    <${PageHead} titulo="Inicio" sub=${sub} />
    <div class="kpis">
      <div class="kpi"><span>Consultas hoy</span><b>${kpis.consultasHoy}</b><small>confirmadas y en curso</small></div>
      <div class="kpi"><span>Pagadas en 7 días</span><b>${kpis.pagadasSemana}</b><small>reservas confirmadas</small></div>
      <div class="kpi"><span>Por revisar</span><b>${kpis.porRevisar}</b><small>INE, altas y CLABE</small></div>
      <div class="kpi"><span>Por depositar</span><b>${money(kpis.porDepositar)}</b><small>a médicos veterinarios</small></div>
    </div>

    <div class="grid-2">
      <div class="stack">
        <section class="box" aria-labelledby="t-rev">
          <div class="box-head"><h2 id="t-rev">Por revisar</h2><${DS.Button} variant="ghost" size="sm" onClick=${() => ir('verificacion')}>Ver todo<//></div>
          ${revisiones.length === 0 ? html`<p class="muted">No hay cuentas pendientes.</p>` : html`<div class="table-wrap"><table class="table">
            <thead><tr><th>Nombre</th><th>Qué revisar</th><th>Enviado</th><th class="r"><span class="sr-only">Acción</span></th></tr></thead>
            <tbody>${revisiones.map((r) => html`<tr key=${r.cuenta_id + r.objeto}>
              <td data-label="Nombre"><span class="cell"><b>${nombreCompleto(r) || 'Sin nombre'}</b>${r.proxima_consulta ? html` <${DS.Badge} tone="pendiente">Consulta ${diaRelativo(r.proxima_consulta).toLowerCase()}<//>` : null}</span></td>
              <td data-label="Qué revisar">${OBJETO_VERIF[r.objeto]}</td>
              <td data-label="Enviado" class="muted nw">${hace(r.enviado_at)}</td>
              <td class="r"><${DS.Button} variant="secondary" size="sm" onClick=${() => ir('verificacion/' + r.cuenta_id)}>Revisar<//></td>
            </tr>`)}</tbody></table></div>`}
        </section>

      </div>

      <aside class="stack" aria-label="Resumen del mes">
        <section class="box" aria-labelledby="t-mes">
          <div class="box-head"><h2 id="t-mes">Este mes</h2><${DS.Button} variant="ghost" size="sm" onClick=${() => ir('finanzas')}>Finanzas<//></div>
          ${finanzas ? html`<${DS.BillSummary}
            items=${[
              { label: `Cobrado (${finanzas.consultas_cobradas} consultas)`, amount: Number(finanzas.cobrado || 0) },
              { label: 'Comisiones (22.5%)', amount: Number(finanzas.comisiones || 0) },
            ]}
            notes=${[{ label: 'Pasarela de pago', amount: -Number(finanzas.pasarela || 0) }]}
            payNow=${Number(finanzas.queda_lilievet || 0)} payNowLabel="Queda a LilieVET" />
            <p class="small muted" style=${{ marginTop: 12 }}>Antes de infraestructura, avisos, marketing e impuestos.</p>`
          : html`<p class="muted">Aún no hay cobros este mes.</p>`}
        </section>
        <${DS.Notice} tone="info" title="Depósitos por SPEI.">Registra cada depósito en Finanzas para que el médico veterinario lo vea en su pestaña de Pagos.<//>
      </aside>
        <section class="box span-2" aria-labelledby="t-prox">
        <div class="box-head"><h2 id="t-prox">Próximas consultas</h2><${DS.Button} variant="ghost" size="sm" onClick=${() => ir('reservas')}>Ver reservas<//></div>
        ${proximas.length === 0 ? html`<p class="muted">No hay consultas programadas.</p>` : html`<div class="table-wrap"><table class="table">
          <thead><tr><th>Folio</th><th>Cuándo</th><th>Mascota</th><th>Servicio</th><th>Alcaldía</th><th>Estado</th></tr></thead>
          <tbody>${proximas.map((r) => {
            const [tono, txt] = ESTADO_RESERVA[r.estado];
            return html`<tr key=${r.id}>
              <td data-label="Folio" class="num nw">#${r.folio}</td>
              <td data-label="Cuándo" class="num nw"><span class="cell">${diaRelativo(r.inicia_at)}, ${hora(r.inicia_at)}</span></td>
              <td data-label="Mascota"><span class="cell">${r.mascota?.nombre} <span class="muted">· ${r.mascota?.especie}</span></span></td>
              <td data-label="Servicio">${TIPO_CONSULTA[r.tipo]}</td>
              <td data-label="Alcaldía">${r.alcaldia}</td>
              <td data-label="Estado" class="nw"><${DS.Badge} tone=${tono}>${txt}<//></td>
            </tr>`;
          })}</tbody></table></div>`}
      </section>
    </div>
  </div>`;
}
