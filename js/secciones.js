// Secciones que se construyen en las siguientes fases. Cada una dice qué tendrá.
import { html, DS, Icon } from './lib.js';
import { PageHead, NAV, todasLasSecciones } from './shell.js';

const PLAN = {
  tutor: {
    agendar: [6, 'Agendar consulta', ['Mascota y dirección (la alcaldía sale del código postal)', 'Consulta general, especializada o vacunación', 'Bloques de 2 horas de médicos verificados de tu alcaldía', 'Motivo, síntomas y tiempo de evolución', 'Pago con tarjeta y confirmación inmediata']],
    consultas: [6, 'Consultas', ['Próximas y pasadas', 'Chat con el médico veterinario', 'Cancelar (gratis hasta 24 horas antes)', 'Calificar la consulta']],
  },
  mvz: {
    agenda: [5, 'Agenda', ['Alcaldía y horario por día', 'Bloques de 2 horas que se generan solos', 'Días bloqueados', 'Acepto consultas el mismo día (+40%)', 'Precios y catálogo de vacunas y desparasitantes', 'Consultas: “Llegué”, captura clínica y cierre']],
    pagos: [9, 'Pagos', ['Retenido, por depositar y depositado', 'Detalle por consulta con la comisión', 'Depósitos por SPEI', 'CLABE y datos fiscales']],
  },
  admin: {
    reservas: [9, 'Reservas', ['Todas las reservas con filtros', 'Estado de la consulta y del pago', 'Cancelar y reembolsar', 'Registrar que el médico no llegó']],
    soporte: [9, 'Soporte', ['Reportes de tutores y médicos', 'Pagos por fuera, conducta y seguridad', 'Disputas de tutor ausente']],
    tutores: [9, 'Tutores', ['Lista y búsqueda', 'Mascotas, direcciones y consultas', 'Suspender cuentas']],
    medicos: [9, 'Médicos veterinarios', ['Solicitudes y admisión', 'Alcaldías, horarios y precios', 'Calificaciones e inasistencias', 'Consultas sin información clínica']],
    finanzas: [9, 'Finanzas', ['Cobros, comisiones y costo real de la pasarela', 'Reembolsos', 'Por depositar por médico y registro de SPEI', 'Reportes por día, semana y mes; exportar a CSV']],
    metricas: [9, 'Métricas', ['Las 5 métricas del piloto', 'Ocupación de agenda y cancelaciones', 'Recompra y satisfacción']],
    seguridad: [9, 'Seguridad', ['Quién vio qué: documentos, direcciones y expedientes', 'Cambios clínicos', 'Accesos vigentes y revocados']],
    avisos: [7, 'Avisos', ['Correos y WhatsApp enviados', 'Fallidos y reintentos']],
    parametros: [9, 'Parámetros', ['Comisión, recargo de mismo día y duración de bloque', 'Tiempos de espera y de captura', 'Retenciones']],
  },
};

export function Proximamente({ vista, id }) {
  const p = PLAN[vista]?.[id];
  if (!p) return null;
  const [fase, titulo, items] = p;
  return html`<div class="page">
    <${PageHead} titulo=${titulo} />
    <section class="box soon">
      <${Icon} name="info" />
      <div>
        <h2 class="section-title">Esta sección llega en la fase ${fase}</h2>
        <p class="muted small" style=${{ marginTop: 4 }}>La base de datos ya está lista para ella. Tendrá:</p>
        <ul>${items.map((t) => html`<li key=${t}>${t}</li>`)}</ul>
      </div>
    </section>
  </div>`;
}

// "Más" del Panel en celular: las secciones que no caben en la barra
export function MasAdmin() {
  const visibles = new Set(NAV.admin.tabs);
  const resto = todasLasSecciones('admin').filter((s) => !visibles.has(s.id));
  return html`<div class="page">
    <section class="box box-tight">
      <nav class="side-nav" aria-label="Más secciones">
        ${resto.map((s) => html`<a key=${s.id} class="side-link" href=${'#/' + s.id}><${Icon} name=${s.icon} /><span>${s.label}</span></a>`)}
      </nav>
    </section>
  </div>`;
}

export const tituloDe = (vista, id) => (id === 'mas' ? 'Más' : todasLasSecciones(vista).find((s) => s.id === id)?.label || '');
