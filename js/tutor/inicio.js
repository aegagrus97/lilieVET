// Inicio del tutor: consulta del día, mascotas y recordatorio de Lilie.
import { html, DS, money, ventana, diaRelativo, hora, edad, capital, fechaLarga, TIPO_CONSULTA, ESTADO_RESERVA, nombreCorto } from '../lib.js';
import { api } from '../api.js';
import { PageHead, Cargando, ErrorCarga, useDatos, ir } from '../shell.js';
import { Seguimiento } from '../componentes.js';

const ESPECIE = { perro: 'Perro', gato: 'Gato' };
const nombreMedico = (m) => (m ? `${m.nombre} ${m.apellidos}`.trim() : 'Tu médico veterinario');

// La INE se pide antes de la primera consulta; no impide agendar
function AvisoIne({ perfil, hayConsulta }) {
  const e = perfil.extra.estado_ine;
  const nota = perfil.verif?.notas?.ine_tutor;
  if (e === 'info_requerida') {
    return html`<${DS.Notice} tone="error" title="Hay algo que corregir en tu INE.">${nota?.nota || ''}
      <button class="linkish" type="button" onClick=${() => ir('perfil')}>Corregir</button><//>`;
  }
  if (e !== 'sin_enviar') return null;
  return html`<${DS.CharacterNote} who="liebe" title="Antes de tu primera consulta"
    action=${html`<${DS.Button} variant=${hayConsulta ? 'secondary' : 'ghost'} onClick=${() => ir('perfil')}>Subir mi INE<//>`}>
    ${hayConsulta ? 'Necesito tu INE y una selfie con ella antes de que llegue tu médico veterinario. Toma dos minutos.'
      : 'Cuando agendes tu primera consulta te pediré tu INE y una selfie con ella. Si quieres, súbelas ya.'}
  <//>`;
}

function Avisos() {
  return html`<div class="stack">
    <${DS.Notice} title="No atendemos urgencias.">Si tu mascota no respira bien, sangra mucho o tuvo un accidente, llévala hoy a un hospital veterinario 24 horas.<//>
    <${DS.Notice} tone="info" title="Paga solo dentro de LilieVET.">Así tu consulta queda protegida: si el médico veterinario no llega, te regresamos todo.<//>
  </div>`;
}

export function InicioTutor({ perfil }) {
  const { cargando, datos, error, recargar } = useDatos(() => api.tutorInicio(), []);
  const saludo = `Hola, ${nombreCorto(perfil)}`;

  if (cargando) return html`<div class="page"><${Cargando} /></div>`;
  if (error) return html`<div class="page"><${ErrorCarga} error=${error} onReintentar=${recargar} /></div>`;

  const { mascotas, proximas, recordatorio } = datos;
  const hoy = proximas.find((r) => diaRelativo(r.inicia_at) === 'Hoy');
  const despues = proximas.filter((r) => r !== hoy);

  if (!mascotas.length) {
    return html`<div class="page">
      <img class="page-logo" src="img/lilievet-logo.svg" alt="LilieVET · Tu vet a domicilio" />
      <${PageHead} titulo=${saludo} />
      <${DS.EmptyState} who="ambos" title="Te damos la bienvenida a LilieVET"
        action=${html`<${DS.Button} block onClick=${() => ir('mascotas')}>Registrar a mi mascota<//>`}>
        Hola, soy Liebe. Cuéntame de tu mascota y te ayudo a cuidarla sin salir de casa.
      <//>
      <${AvisoIne} perfil=${perfil} hayConsulta=${false} />
      <${Avisos} />
    </div>`;
  }

  return html`<div class="page">
    <img class="page-logo" src="img/lilievet-logo.svg" alt="LilieVET · Tu vet a domicilio" />
    <${PageHead} titulo=${saludo} sub="¿A quién atendemos hoy?">
      <${DS.Button} onClick=${() => ir('agendar')}>Agendar consulta<//>
    <//>
    <div class="only-m stack-sm">
      <h1 class="titulo-2">${saludo}</h1>
      <p class="muted">¿A quién atendemos hoy?</p>
    </div>

    <div class="grid-2">
      <div class="stack">
        ${proximas.length > 0 && html`<${AvisoIne} perfil=${perfil} hayConsulta=${true} />`}
        ${hoy && html`<section class="stack-sm" aria-labelledby="t-hoy">
          <h2 class="section-title" id="t-hoy">Tu consulta de hoy</h2>
          <${Seguimiento} reserva=${hoy} medico=${hoy.medico}
            nota=${`Ten a la mano la cartilla de ${hoy.mascota?.nombre}.`}
            action=${html`<${DS.Button} variant="ghost" size="sm" onClick=${() => ir('consultas')}>Abrir chat de la consulta<//>`}
            className="tc-full" />
        </section>`}

        <div class="only-m"><${DS.Button} block onClick=${() => ir('agendar')}>Agendar consulta<//></div>

        <section class="stack-sm" aria-labelledby="t-masc">
          <div class="spread"><h2 class="section-title" id="t-masc">Tus mascotas</h2>
            <${DS.Button} variant="ghost" size="sm" onClick=${() => ir('mascotas')}>Ver todas<//></div>
          <div class="grid-cards">
            ${mascotas.map((m) => html`<${DS.PetCard} key=${m.id} name=${m.nombre} species=${m.especie}
              detail=${[ESPECIE[m.especie], m.raza, edad(m)].filter(Boolean).join(' · ')}
              badges=${m.vacunaVencida ? [{ label: 'Vacuna vencida', tone: 'error' }] : [{ label: 'Cartilla al día', tone: 'verificado' }]}
              onClick=${() => ir('mascotas')} />`)}
          </div>
        </section>

        ${despues.length > 0 && html`<section class="box box-tight" aria-labelledby="t-prox">
          <div class="box-head"><h2 id="t-prox">Próximas consultas</h2></div>
          <div class="stack-sm">
            ${despues.map((r) => {
              const [tono, txt] = ESTADO_RESERVA[r.estado];
              return html`<div key=${r.id} class="spread" style=${{ padding: '8px 0' }}>
                <div><b>${r.mascota?.nombre} · ${TIPO_CONSULTA[r.tipo]}</b>
                  <div class="small muted">${ventana(r.inicia_at, r.termina_at)} · ${nombreMedico(r.medico)}</div></div>
                <${DS.Badge} tone=${tono}>${txt}<//>
              </div>`;
            })}
          </div>
        </section>`}
      </div>

      <aside class="stack" aria-label="Recordatorios y avisos">
        ${proximas.length === 0 && html`<${AvisoIne} perfil=${perfil} hayConsulta=${false} />`}
        ${recordatorio && html`<${DS.CharacterNote} who="lilie"
          action=${html`<${DS.Button} variant="ghost" onClick=${() => ir('agendar')}>Agendar refuerzo<//>`}>
          A ${recordatorio.mascota?.nombre} le toca su refuerzo de ${recordatorio.producto} el ${fechaLarga(recordatorio.proxima_el).replace(/^[^,]+, /, '')}. Te aviso tres días antes.
        <//>`}
        <${Avisos} />
      </aside>
    </div>
  </div>`;
}
