// Hoy del médico veterinario: consultas del día, alcaldía y pagos. Sin personajes (de colega a colega).
import { html, DS, money, hora, fechaLarga, capital, TIPO_CONSULTA, ESTADO_RESERVA, Icon } from '../lib.js';
import { api } from '../api.js';
import { PageHead, Cargando, ErrorCarga, useDatos, ir } from '../shell.js';

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export function HoyMvz({ perfil }) {
  const { cargando, datos, error, recargar } = useDatos(() => api.mvzHoy(), []);
  const titulo = capital(fechaLarga(new Date()));

  if (cargando) return html`<div class="page"><${Cargando} /></div>`;
  if (error) return html`<div class="page"><${ErrorCarga} error=${error} onReintentar=${recargar} /></div>`;

  const { consultas, alcaldia, horario, semana, saldo } = datos;
  const siguiente = consultas.find((c) => c.estado === 'confirmada' || c.estado === 'en_domicilio');
  const sub = alcaldia ? `${alcaldia} · ${horario[0]} a ${horario[1]}` : 'Hoy no tienes horario configurado.';

  return html`<div class="page">
    <${PageHead} titulo=${titulo} sub=${sub}>
      <${DS.Button} variant="secondary" onClick=${() => ir('agenda')}>Ver agenda<//>
    <//>
    <div class="only-m stack-sm"><h1 class="titulo-2">${titulo}</h1><p class="muted">${sub}</p></div>

    <div class="grid-2">
      <section class="box" aria-labelledby="t-cons">
        <div class="box-head"><h2 id="t-cons">Consultas de hoy</h2><span class="small muted">${consultas.length} ${consultas.length === 1 ? 'consulta' : 'consultas'}</span></div>
        ${consultas.length === 0
          ? html`<p class="muted">No tienes consultas hoy. Cuando un tutor reserve uno de tus bloques, aparece aquí y te avisamos por correo.</p>`
          : html`<div class="stack">${consultas.map((c) => {
              const [tono, txt] = ESTADO_RESERVA[c.estado];
              const esSig = siguiente && c.id === siguiente.id;
              return html`<article key=${c.id} class="visit">
                <div class="visit-time num">${hora(c.inicia_at)}<small>a ${hora(c.termina_at)}</small></div>
                <div class="visit-body">
                  <b>${c.mascota_nombre} · ${c.especie}</b>
                  <span class="small">${TIPO_CONSULTA[c.tipo]}${c.colonia ? ' · ' + c.colonia : ''}</span>
                  ${c.motivo && html`<span class="small muted">${c.motivo}</span>`}
                </div>
                <div class="visit-actions">
                  <${DS.Badge} tone=${tono}>${txt}<//>
                  <${DS.Button} size="sm" variant=${esSig ? 'primary' : 'secondary'} onClick=${() => ir('agenda')}>${esSig ? 'Abrir consulta' : 'Ver'}<//>
                </div>
              </article>`;
            })}</div>`}
      </section>

      <aside class="stack" aria-label="Pagos y semana">
        <section class="box" aria-labelledby="t-pagos">
          <div class="box-head"><h2 id="t-pagos">Tus pagos</h2><${DS.Button} variant="ghost" size="sm" onClick=${() => ir('pagos')}>Ver detalle<//></div>
          <${DS.BillSummary}
            items=${[{ label: 'Retenido (consultas sin cerrar)', amount: saldo.retenido }]}
            payNow=${saldo.por_depositar} payNowLabel="Por depositar" />
        </section>
        <${DS.Notice} tone="info" title="Marca “Llegué” al llegar a cada domicilio.">Tu pago se libera cuando cierras la consulta. Captura la información clínica en las 72 horas siguientes.<//>
        <section class="box box-tight" aria-labelledby="t-sem">
          <div class="box-head"><h2 id="t-sem">Tu semana</h2></div>
          <div class="stack-sm">
            ${DIAS.map((d, i) => {
              const s = semana.find((x) => x.dia === i + 1);
              return html`<div key=${d} class="spread small"><span class="muted">${d}</span><span>${s ? s.alcaldia : 'Sin horario'}</span></div>`;
            })}
          </div>
        </section>
      </aside>
    </div>
  </div>`;
}
