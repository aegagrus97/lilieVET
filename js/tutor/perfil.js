// Perfil del tutor: identidad (INE y selfie), datos, contraseña e invitaciones.
import { html, DS, Icon, useState, useEffect, money } from '../lib.js';
import { api } from '../api.js';
import { PageHead, useToast, useDatos } from '../shell.js';
import { Seccion, SubirDocumento, EstadoVerif, NotaRevision, useEnvio } from '../componentes.js';
import { DatosPersonales, CambiarAcceso } from '../cuenta.js';

const TIPOS_INE = ['ine_frente', 'ine_reverso', 'selfie_ine'];

// La identidad se pide una vez, antes de la primera consulta. Se usa aquí y, en la fase 6, dentro de Agendar.
export function IdentidadTutor({ perfil, onCambio }) {
  const toast = useToast();
  const estado = perfil.extra.estado_ine;
  const [subidos, setSubidos] = useState(perfil.verif.subidos);
  useEffect(() => setSubidos(perfil.verif.subidos), [perfil]);
  const [envio, correr] = useEnvio();
  const nota = perfil.verif.notas.ine_tutor;
  const editable = ['sin_enviar', 'info_requerida'].includes(estado);
  const completos = TIPOS_INE.every((t) => subidos[t]);

  const enviar = async () => {
    if (await correr(() => api.enviarVerificacion('ine_tutor'))) {
      toast('Listo. Revisamos tu INE en 24 a 48 horas.');
      onCambio && onCambio();
    }
  };

  return html`<${Seccion} id="identidad" titulo="Tu identidad" extra=${html`<${EstadoVerif} estado=${estado} />`}
      sub=${estado === 'aprobado' ? null : 'Te la pedimos una sola vez, antes de tu primera consulta. Así cuidamos a los médicos veterinarios que van a tu casa.'}>
    <div class="stack">
      ${estado === 'aprobado' && html`<${DS.Notice} tone="exito" title="Identidad verificada.">Ya no te la volvemos a pedir.<//>`}
      ${['pendiente', 'en_revision'].includes(estado) && html`<${DS.Notice} tone="info" title="La estamos revisando.">
        Tarda de 24 a 48 horas y te avisamos por correo. Mientras tanto puedes usar la app y agendar.<//>`}
      <${NotaRevision} nota=${nota} estado=${estado} />
      ${estado !== 'aprobado' && html`<div class="docs">
        ${TIPOS_INE.map((t) => html`<${SubirDocumento} key=${t} tipo=${t} subido=${subidos[t]} bloqueado=${!editable}
          onSubido=${(r) => setSubidos((s) => ({ ...s, [t]: r }))} />`)}
      </div>`}
      ${editable && html`<div class="stack-sm">
        ${envio.error && html`<${DS.Notice} tone="error">${envio.error}<//>`}
        <div class="row">
          <${DS.Button} onClick=${enviar} disabled=${!completos || envio.enviando}>${envio.enviando ? 'Enviando…' : estado === 'info_requerida' ? 'Enviar de nuevo' : 'Enviar a revisión'}<//>
          ${!completos && html`<span class="small muted">Sube las tres fotos para enviar.</span>`}
        </div>
        <p class="small muted">Solo el equipo de LilieVET ve tu INE. El médico veterinario nunca la ve. Una INE corresponde a una sola cuenta.</p>
      </div>`}
    </div>
  <//>`;
}

function Invitaciones({ perfil }) {
  const toast = useToast();
  const { datos } = useDatos(() => api.invitaciones(), []);
  const codigo = perfil.extra.codigo_invitacion;
  const enlace = `${location.origin}${location.pathname}#/registro?codigo=${codigo}`;
  const copiar = async () => {
    try { await navigator.clipboard.writeText(enlace); toast('Copiamos tu enlace de invitación.'); }
    catch (e) { toast('No se pudo copiar. Tu código es ' + codigo, { tone: 'info' }); }
  };
  return html`<${Seccion} id="invitaciones" titulo="Invita a otro tutor">
    <div class="stack">
      <p class="small">Cuando tu invitado paga su primera consulta, recibes $100 para la tuya. Él recibe $100 de descuento al registrarse con tu código.</p>
      <div class="codigo"><span class="small muted">Tu código</span><b class="num">${codigo}</b></div>
      <${DS.Button} variant="secondary" block onClick=${copiar}><${Icon} name="link" /> Copiar enlace<//>
      ${datos && html`<div class="stack-sm small">
        <div class="spread"><span class="muted">Se registraron con tu código</span><b>${datos.registradas}</b></div>
        <div class="spread"><span class="muted">Ya pagaron su primera consulta</span><b>${datos.activadas}</b></div>
        <div class="spread"><span class="muted">Saldo para tu próxima consulta</span><b class="num">${money(datos.saldo)}</b></div>
        ${datos.retenido > 0 && html`<p class="small muted">Tienes ${money(datos.retenido)} más que se liberan cuando verifiquemos tu INE.</p>`}
      </div>`}
    </div>
  <//>`;
}

export function PerfilTutor({ perfil, onPerfil }) {
  return html`<div class="page">
    <${PageHead} titulo="Perfil" sub=${perfil.correo} />
    <div class="grid-2">
      <div class="stack">
        <${IdentidadTutor} perfil=${perfil} onCambio=${onPerfil} />
        <${DatosPersonales} perfil=${perfil} onGuardado=${onPerfil}
          bloqueado=${['pendiente', 'en_revision', 'aprobado'].includes(perfil.extra.estado_ine)} />
        <${CambiarAcceso} perfil=${perfil} />
      </div>
      <aside class="stack" aria-label="Invitaciones y lo que viene">
        <${Invitaciones} perfil=${perfil} />
        <section class="box box-tight soon">
          <${Icon} name="info" />
          <div><b class="small">Llegan después</b>
            <ul class="small"><li>Tus direcciones (fase 6, al agendar)</li><li>Pagos y reembolsos (fase 6)</li><li>Borrar tu cuenta (fase 9)</li></ul></div>
        </section>
      </aside>
    </div>
  </div>`;
}
