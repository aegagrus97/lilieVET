// Vista de muestra: datos de ejemplo para revisar el diseño sin conectar Supabase.
// Se abre con index.html?demo=tutor, ?demo=mvz, ?demo=mvz-nuevo o ?demo=admin. Nada de esto se guarda:
// al recargar la página vuelve a empezar.
import { hoyISO, prepararArchivo, DOC, quitarTitulo, OBJETO_VERIF, armarVerif, ordenarCola, estadoCartilla, diaSemana, isoDe, horaNum } from './lib.js';

// Una fecha sin hora, a n días de hoy ("2026-03-04")
const dia = (n) => {
  const [y, m, d] = hoyISO().split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

const h = (dias, hh, mm = 0) => {
  const [y, m, d] = hoyISO().split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias, hh + 6, mm)).toISOString(); // CDMX = UTC-6
};
const antes = (min) => new Date(Date.now() - min * 6e4).toISOString();
const espera = (ms = 250) => new Promise((r) => setTimeout(r, ms));
const falla = (msg) => { throw new Error(msg); };

// Imagen gris de ejemplo con una etiqueta: no imita ningún documento real
function svgEjemplo(texto, ancho = 640, alto = 400) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}">
    <rect width="100%" height="100%" rx="18" fill="#EDEAF7"/><rect x="14" y="14" width="${ancho - 28}" height="${alto - 28}" rx="12" fill="none" stroke="#B9B4E8" stroke-width="3" stroke-dasharray="10 8"/>
    <text x="50%" y="46%" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="26" font-weight="600" fill="#5B5675">Archivo de ejemplo</text>
    <text x="50%" y="58%" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="22" fill="#5B5675">${texto}</text></svg>`;
}
function ejemplo(texto, ancho = 640, alto = 400) {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgEjemplo(texto, ancho, alto));
}
// Igual, pero como archivo: así se puede abrir en otra pestaña
const ejemploArchivo = (texto) => URL.createObjectURL(new Blob([svgEjemplo(texto)], { type: 'image/svg+xml' }));

const PERFILES = {
  tutor: { id: 'demo-tutor', rol: 'tutor', es_admin: false, nombre: 'Mariana', apellidos: 'López', correo: 'mariana@ejemplo.mx', telefono: '5511223344',
    acepta_whatsapp: true, acepta_promos: false, extra: { estado_ine: 'sin_enviar', codigo_invitacion: 'MARI2026' } },
  mvz: { id: 'demo-mvz', rol: 'mvz', es_admin: false, nombre: 'Ana', apellidos: 'Ruiz', correo: 'ana@ejemplo.mx', telefono: '5522334455',
    extra: { estado: 'aprobado', cedula: '10293847', bio: 'Medicina preventiva y consulta general de perros y gatos.', precio_general: 600, acepta_mismo_dia: true,
      especialidad_id: null, estado_especialidad: 'sin_enviar', banco: 'BBVA', clabe: '012180001234567891', titular_clabe: 'Ana Ruiz', estado_clabe: 'aprobado' } },
  'mvz-nuevo': { id: 'demo-mvz-nuevo', rol: 'mvz', es_admin: false, nombre: 'Paola', apellidos: 'Núñez Rivas', correo: 'paola@ejemplo.mx', telefono: '5533445566',
    extra: { estado: 'sin_enviar', cedula: null, bio: '', especialidad_id: null, estado_especialidad: 'sin_enviar', estado_clabe: 'sin_enviar' } },
  admin: { id: 'demo-admin', rol: 'mvz', es_admin: true, nombre: 'Kat', apellidos: 'Moctezuma', correo: 'kat@lilievet.mx', telefono: '5548031238',
    extra: { estado: 'aprobado', cedula: '11223344', precio_general: 600, estado_especialidad: 'sin_enviar', estado_clabe: 'aprobado' } },
};
const ESPECIALIDADES = ['Cardiología', 'Dermatología', 'Endocrinología', 'Etología clínica (comportamiento)', 'Imagenología', 'Medicina felina',
  'Medicina interna', 'Nefrología y urología', 'Neurología', 'Nutrición clínica', 'Odontología', 'Oftalmología', 'Oncología',
  'Ortopedia y traumatología', 'Rehabilitación y fisioterapia'].map((nombre, i) => ({ id: i + 1, nombre }));

// Cuentas que esperan revisión en el Panel de muestra
function cuentasPanel() {
  const docs = (id, tipos, min) => tipos.map((t, i) => ({ id: `${id}-${t}`, cuenta_id: id, tipo: t, created_at: antes(min + i), tipo_mime: 'image/svg+xml',
    url: ejemplo(DOC[t].titulo, t === 'selfie_ine' ? 480 : 640, t === 'selfie_ine' ? 600 : 400) }));
  return {
    'c-paola': { perfil: { id: 'c-paola', rol: 'mvz', nombre: 'Paola', apellidos: 'Núñez Rivas', correo: 'paola@ejemplo.mx', telefono: '5533445566', created_at: antes(3000) },
      mvz: { estado: 'pendiente', alta_enviada_at: antes(8), cedula: '12345678', bio: 'Dermatología de perros y gatos. 6 años de experiencia.', especialidad_id: 2,
        especialidades: { nombre: 'Dermatología' }, estado_especialidad: 'pendiente', especialidad_enviada_at: antes(7),
        banco: 'BBVA', clabe: '012180001234567891', titular_clabe: 'Paola Núñez Rivas', estado_clabe: 'pendiente', clabe_enviada_at: antes(7) },
      docs: docs('c-paola', ['estado_cuenta', 'especialidad', 'cedula', 'selfie_ine', 'ine_reverso', 'ine_frente'], 9), revisiones: [] },
    'c-luis': { perfil: { id: 'c-luis', rol: 'mvz', nombre: 'Luis', apellidos: 'Pérez Gómez', correo: 'luis@ejemplo.mx', telefono: '5544556677', created_at: antes(5000) },
      mvz: { estado: 'pendiente', alta_enviada_at: antes(14 * 60), cedula: '9876543', bio: '', estado_especialidad: 'sin_enviar', estado_clabe: 'sin_enviar' },
      docs: docs('c-luis', ['cedula', 'selfie_ine', 'ine_reverso', 'ine_frente'], 14 * 60 + 2),
      revisiones: [{ id: 'r0', objeto: 'alta_mvz', decision: 'info_requerida', nota: 'La foto de la cédula está cortada. Súbela completa.', created_at: antes(2 * 1440), revisor: { nombre: 'Kat', apellidos: 'Moctezuma' } }] },
    'c-sofia': { perfil: { id: 'c-sofia', rol: 'tutor', nombre: 'Sofía', apellidos: 'Hernández', correo: 'sofia@ejemplo.mx', telefono: '5555667788', created_at: antes(900) },
      tutor: { estado_ine: 'pendiente', ine_enviada_at: antes(95) }, proxima: h(1, 10),
      docs: docs('c-sofia', ['selfie_ine', 'ine_reverso', 'ine_frente'], 96), revisiones: [] },
    'c-jorge': { perfil: { id: 'c-jorge', rol: 'tutor', nombre: 'Jorge', apellidos: 'Ramírez', correo: 'jorge@ejemplo.mx', telefono: '5566778899', created_at: antes(400) },
      tutor: { estado_ine: 'pendiente', ine_enviada_at: antes(42) },
      docs: docs('c-jorge', ['selfie_ine', 'ine_reverso', 'ine_frente'], 43), revisiones: [] },
  };
}

export function demoApi(quien) {
  const perfil = JSON.parse(JSON.stringify(PERFILES[quien] || PERFILES.tutor));
  // Lo que la persona de muestra ya subió y las notas que recibió
  const misDocs = [];
  const misRevs = [];
  if (quien === 'mvz') ['ine_frente', 'ine_reverso', 'selfie_ine', 'cedula', 'estado_cuenta'].forEach((t) => misDocs.push({ tipo: t, created_at: antes(40 * 1440) }));
  const cuentas = cuentasPanel();
  const historial = [
    { id: 'h1', cuenta_id: 'c-ana', objeto: 'alta_mvz', decision: 'aprobado', nota: null, created_at: antes(3 * 1440), cuenta: { nombre: 'Ana', apellidos: 'Ruiz', rol: 'mvz' } },
    { id: 'h2', cuenta_id: 'c-mariana', objeto: 'ine_tutor', decision: 'aprobado', nota: null, created_at: antes(2 * 1440), cuenta: { nombre: 'Mariana', apellidos: 'López', rol: 'tutor' } },
    { id: 'h3', cuenta_id: 'c-luis', objeto: 'alta_mvz', decision: 'info_requerida', nota: 'La foto de la cédula está cortada. Súbela completa.', created_at: antes(2 * 1440), cuenta: { nombre: 'Luis', apellidos: 'Pérez Gómez', rol: 'mvz' } },
  ];
  const huellas = new Map([['HRNDSF90010109M800', 'c-otra']]); // una INE ya registrada, para probar el aviso

  // Mascotas de muestra (fase 4). Se pueden editar aquí mismo; al recargar vuelven a empezar.
  let nuevoId = 0;
  const mascotas = [
    { id: 'm1', nombre: 'Luna', especie: 'gato', raza: 'Doméstico de pelo corto', sexo: 'hembra', esterilizado: true,
      fecha_nacimiento: null, edad_aprox_meses: 38, peso_kg: 4.2, senas: 'Blanca con manchas grises y un lunar en la nariz.',
      foto_path: null, alergias: 'Ninguna conocida', enfermedades: null, antecedentes: 'La esterilizaron a los 8 meses.',
      tratamientos_previos: null, medicamentos_actuales: null, notas_tutor: 'Se esconde cuando llegan visitas. Dale unos minutos.',
      cartilla: [
        { id: 'c1', tipo: 'vacuna', producto: 'Triple felina', aplicada_el: dia(-356), proxima_el: dia(9), lote: 'A-4471', caducidad: dia(240), origen: 'mvz' },
        { id: 'c2', tipo: 'desparasitacion', producto: 'Desparasitación interna', aplicada_el: dia(-95), proxima_el: dia(85), lote: null, caducidad: null, origen: 'tutor' },
      ],
      documentos: [{ id: 'd1', tipo: 'laboratorio', titulo: 'Biometría hemática', created_at: antes(40 * 1440), ruta: ejemploArchivo('Biometría hemática'), mio: true }],
      historia: [{ reserva_id: 'r0', fecha: antes(40 * 1440), tipo: 'general', motivo: 'Comía menos de lo normal', version: 1,
        peso_kg: 4.1, temperatura_c: 38.6, valoracion: 'Alerta y bien hidratada. Sarro leve en los molares superiores.',
        diagnosticos: 'Gingivitis leve.', indicaciones: 'Alimento húmedo durante cinco días.',
        tratamientos: null, recomendaciones: 'Limpieza dental en los próximos seis meses.', seguimiento: 'Revisión en un mes.', medico: 'Ana Ruiz' }] },
    { id: 'm2', nombre: 'Mango', especie: 'perro', raza: 'Mestizo', sexo: 'macho', esterilizado: false,
      fecha_nacimiento: dia(-1950), edad_aprox_meses: null, peso_kg: 12.8, senas: 'Café claro, orejas paradas.',
      foto_path: null, alergias: null, enfermedades: null, antecedentes: null, tratamientos_previos: null,
      medicamentos_actuales: null, notas_tutor: null,
      cartilla: [{ id: 'c3', tipo: 'vacuna', producto: 'Rabia', aplicada_el: dia(-400), proxima_el: dia(-35), lote: null, caducidad: null, origen: 'tutor' }],
      documentos: [], historia: [] },
  ];
  const buscarMascota = (id) => mascotas.find((m) => m.id === id) || falla('No encontramos esa mascota.');
  const conEstado = (m) => ({ ...m, foto: m.foto_path, cartillaEstado: estadoCartilla(m.cartilla) });

  // Agenda de muestra del médico veterinario (fase 5): Coyoacán entre semana y Benito Juárez el sábado
  const ALCALDIAS = ['Álvaro Obregón', 'Azcapotzalco', 'Benito Juárez', 'Coyoacán', 'Cuajimalpa de Morelos', 'Cuauhtémoc', 'Gustavo A. Madero',
    'Iztacalco', 'Iztapalapa', 'La Magdalena Contreras', 'Miguel Hidalgo', 'Milpa Alta', 'Tláhuac', 'Tlalpan', 'Venustiano Carranza', 'Xochimilco']
    .map((nombre, i) => ({ id: i + 1, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre));
  const PARAMS = { horas_bloque: 2, recargo_mismo_dia: 0.4, comision: 0.225, precio_min_general: 500, precio_min_especialidad: 1000 };
  const conAgenda = quien === 'mvz' || quien === 'admin';
  let agenda = conAgenda ? [1, 2, 3, 4, 5].map((d) => ({ dia_semana: d, alcaldia_id: 4, hora_inicio: '10:00:00', hora_fin: '18:00:00' }))
    .concat([{ dia_semana: 6, alcaldia_id: 3, hora_inicio: '09:00:00', hora_fin: '13:00:00' }]) : [];
  let bloqueados = conAgenda ? [{ dia: dia(16), motivo: 'Congreso de medicina felina' }] : [];
  let catalogo = conAgenda ? [
    { id: 'p1', tipo: 'vacuna', nombre: 'Séxtuple canina', especie: 'perro', precio: 480, activo: true },
    { id: 'p2', tipo: 'vacuna', nombre: 'Triple felina', especie: 'gato', precio: 450, activo: true },
    { id: 'p3', tipo: 'vacuna', nombre: 'Antirrábica', especie: null, precio: 300, activo: true },
    { id: 'p4', tipo: 'desparasitante', nombre: 'Desparasitante interno', especie: null, precio: 180, activo: true },
    { id: 'p5', tipo: 'desparasitante', nombre: 'Pipeta antipulgas', especie: 'perro', precio: 260, activo: false },
  ] : [];
  const vendidos = new Set(['p1', 'p5']); // ya se usaron en alguna consulta: al quitarlos se desactivan
  // Consultas de muestra: siempre en el siguiente día hábil con horario, para que el calendario tenga algo
  const proximoDia = (desde, dias) => { for (let n = desde; n < desde + 14; n++) if (dias.includes(diaSemana(dia(n)))) return n; return desde; };
  const consultasDemo = (() => {
    if (!conAgenda) return [];
    const c = (id, folio, n, hh, estado, tipo, mascota_nombre, especie, colonia, motivo, tutor_nombre) =>
      ({ id, folio, estado, tipo, inicia_at: h(n, hh), termina_at: h(n, hh + 2), alcaldia: 'Coyoacán', colonia, tutor_nombre, mascota_id: 'x' + id,
        mascota_nombre, especie, motivo, total_mvz: tipo === 'vacunacion' ? 503.75 : 465, con_acceso: true });
    const n1 = proximoDia(1, [1, 2, 3, 4, 5]);
    const n2 = proximoDia(n1 + 1, [1, 2, 3, 4, 5]);
    return [
      c('c1', 1042, 0, 10, 'cerrada', 'general', 'Kira', 'perro', 'Del Carmen', 'Cojea de la pata trasera', 'Jorge'),
      c('c2', 1047, 0, 12, 'confirmada', 'vacunacion', 'Luna', 'gato', 'Santa Catarina', 'Refuerzo de triple felina', 'Mariana'),
      c('c3', 1051, 0, 16, 'confirmada', 'general', 'Max', 'perro', 'Villa Coyoacán', 'Vómito desde ayer', 'Sofía'),
      c('c4', 1055, n1, 10, 'confirmada', 'general', 'Coco', 'perro', 'Ciudad Jardín', 'Se rasca mucho las orejas', 'Daniela'),
      c('c5', 1058, n1, 14, 'confirmada', 'vacunacion', 'Mango', 'perro', 'Del Carmen', 'Séxtuple y desparasitación', 'Mariana'),
      c('c6', 1060, n2, 12, 'confirmada', 'general', 'Nube', 'gato', 'Romero de Terreros', 'Dejó de comer', 'Andrés'),
      c('c7', 1031, -3, 10, 'cerrada', 'general', 'Toby', 'perro', 'Copilco', 'Revisión general', 'Luis'),
      c('c8', 1033, -3, 14, 'tutor_ausente', 'general', 'Pelusa', 'gato', 'Pedregal', 'Estornuda', 'Rocío'),
    ];
  })();
  const activas = (iso) => consultasDemo.filter((c) => ['confirmada', 'en_domicilio'].includes(c.estado) && isoDe(c.inicia_at) === iso);

  let sesion = { user: { id: perfil.id, email: perfil.correo } };
  const subs = new Set();
  const avisar = () => subs.forEach((cb) => cb(sesion));

  const cola = () => {
    const filas = [];
    Object.values(cuentas).forEach((c) => {
      const base = { cuenta_id: c.perfil.id, rol: c.perfil.rol, nombre: c.perfil.nombre, apellidos: c.perfil.apellidos, correo: c.perfil.correo, telefono: c.perfil.telefono };
      if (c.tutor && c.tutor.estado_ine === 'pendiente') filas.push({ ...base, objeto: 'ine_tutor', estado: 'pendiente', enviado_at: c.tutor.ine_enviada_at, proxima_consulta: c.proxima || null });
      if (c.mvz) {
        if (c.mvz.estado === 'pendiente') filas.push({ ...base, objeto: 'alta_mvz', estado: 'pendiente', enviado_at: c.mvz.alta_enviada_at });
        if (c.mvz.estado !== 'sin_enviar' && c.mvz.estado_especialidad === 'pendiente') filas.push({ ...base, objeto: 'especialidad', estado: 'pendiente', enviado_at: c.mvz.especialidad_enviada_at });
        if (c.mvz.estado !== 'sin_enviar' && c.mvz.estado_clabe === 'pendiente') filas.push({ ...base, objeto: 'clabe', estado: 'pendiente', enviado_at: c.mvz.clabe_enviada_at });
      }
    });
    return filas.sort((a, b) => new Date(a.enviado_at) - new Date(b.enviado_at));
  };

  return {
    mode: 'demo',
    quien,
    async session() { return sesion; },
    onAuth(cb) { subs.add(cb); return () => subs.delete(cb); },
    async entrar() { await espera(); sesion = { user: { id: perfil.id } }; avisar(); },
    async registrar() { await espera(); },
    async recuperar() { await espera(); },
    async nuevaContrasena() { await espera(); },
    async cambiarCorreo() { await espera(); },
    async salir() {
      sesion = null;
      try { sessionStorage.removeItem('lv-demo'); } catch (e) { /* nada */ }
      avisar();
    },
    async perfil() {
      await espera(120);
      return { ...perfil, extra: { ...perfil.extra, especialidades: perfil.extra.especialidad_id ? ESPECIALIDADES[perfil.extra.especialidad_id - 1] : null },
        verif: armarVerif(misDocs, misRevs) };
    },

    // ───────── Cuenta y verificación ─────────
    async subirDocumento(tipo, file) {
      const f = await prepararArchivo(file, { pdf: DOC[tipo]?.pdf });
      await espera(600);
      const d = { tipo, created_at: new Date().toISOString() };
      misDocs.unshift(d);
      return { ...d, local: URL.createObjectURL(f) };
    },
    async enviarVerificacion(objeto) {
      await espera(400);
      const x = perfil.extra;
      const req = { ine_tutor: ['ine_frente', 'ine_reverso', 'selfie_ine'], alta_mvz: ['ine_frente', 'ine_reverso', 'selfie_ine', 'cedula'], especialidad: ['especialidad'], clabe: ['estado_cuenta'] }[objeto];
      const falta = req.filter((t) => !misDocs.some((d) => d.tipo === t)).map((t) => DOC[t].titulo);
      if (falta.length) falla('Falta subir: ' + falta.join(', '));
      if (objeto === 'ine_tutor') x.estado_ine = 'pendiente';
      if (objeto === 'alta_mvz') { if (!/^\d{5,8}$/.test(x.cedula || '')) falla('Escribe tu número de cédula profesional (solo números)'); x.estado = 'pendiente'; }
      if (objeto === 'especialidad') { if (!x.especialidad_id) falla('Elige tu especialidad'); x.estado_especialidad = 'pendiente'; }
      if (objeto === 'clabe') { if (!x.clabe || !x.titular_clabe || !x.banco) falla('Completa banco, CLABE y titular'); x.estado_clabe = 'pendiente'; }
    },
    async guardarPerfil(d) {
      await espera(300);
      const verificado = ['pendiente', 'en_revision', 'aprobado'].includes(perfil.rol === 'tutor' ? perfil.extra.estado_ine : perfil.extra.estado);
      if (verificado && ((d.nombre && quitarTitulo(d.nombre) !== perfil.nombre) || (d.apellidos && d.apellidos.trim() !== perfil.apellidos))) {
        falla('Tu nombre ya está verificado con tu INE. Para corregirlo escribe a soporte.');
      }
      Object.assign(perfil, d, d.nombre ? { nombre: quitarTitulo(d.nombre) } : {});
    },
    async guardarMvz(d) {
      await espera(300);
      const x = perfil.extra;
      if (d.precio_general != null && Number(d.precio_general) < 500) falla('La consulta general cuesta al menos $500.');
      if (d.precio_especialidad != null && Number(d.precio_especialidad) < 1000) falla('La consulta especializada cuesta al menos $1,000.');
      if ('cedula' in d && d.cedula !== x.cedula && ['pendiente', 'en_revision', 'aprobado'].includes(x.estado)) falla('Tu cédula ya está en revisión o aprobada. Para cambiarla escribe a soporte.');
      if (['clabe', 'banco', 'titular_clabe'].some((k) => k in d && d[k] !== x[k])) x.estado_clabe = 'sin_enviar';
      if ('especialidad_id' in d && d.especialidad_id !== x.especialidad_id) x.estado_especialidad = 'sin_enviar';
      Object.assign(x, d);
    },
    async subirFoto(file) { const f = await prepararArchivo(file, { pdf: false }); await espera(400); perfil.extra.foto_local = URL.createObjectURL(f); return 'local'; },
    fotoUrl(ruta) { return ruta === 'local' ? perfil.extra.foto_local : null; },
    async especialidades() { await espera(100); return ESPECIALIDADES; },
    async invitaciones() { await espera(200); return { registradas: 2, activadas: 1, saldo: 0, retenido: 100 }; },

    // ───────── Inicio de cada vista ─────────
    // ───────── Mascotas (fase 4) ─────────
    async mascotas() { await espera(); return mascotas.map(conEstado); },
    async mascota(id) { await espera(); return conEstado(buscarMascota(id)); },
    async guardarMascota(id, d) {
      await espera();
      if (id) { Object.assign(buscarMascota(id), d); return id; }
      const nueva = { id: 'm-nueva-' + ++nuevoId, foto_path: null, cartilla: [], documentos: [], historia: [], ...d };
      mascotas.push(nueva);
      return nueva.id;
    },
    async borrarMascota(id) { await espera(); mascotas.splice(mascotas.findIndex((m) => m.id === id), 1); },
    async subirFotoMascota(id, file) {
      const f = await prepararArchivo(file, { pdf: false });
      await espera();
      buscarMascota(id).foto_path = URL.createObjectURL(f);
    },
    async agregarCartilla(id, d) {
      await espera();
      const fila = { id: 'c-nueva-' + ++nuevoId, origen: 'tutor', ...d };
      buscarMascota(id).cartilla.unshift(fila);
      return fila;
    },
    async borrarCartilla(idFila) {
      await espera();
      mascotas.forEach((m) => { m.cartilla = m.cartilla.filter((c) => c.id !== idFila); });
    },
    async subirDocumentoMascota(id, { tipo, titulo }, file) {
      const f = await prepararArchivo(file, { pdf: true });
      await espera();
      const doc = { id: 'd-nuevo-' + ++nuevoId, tipo, titulo, created_at: new Date().toISOString(), mio: true, ruta: URL.createObjectURL(f) };
      buscarMascota(id).documentos.unshift(doc);
      return doc;
    },
    async abrirDocumentoMascota(ruta) { await espera(150); return ruta; },

    async tutorInicio() {
      await espera();
      const ms = mascotas.map(conEstado);
      const proxima = mascotas.flatMap((m) => m.cartilla.filter((c) => c.proxima_el >= hoyISO()).map((c) => ({ ...c, mascota: m })))
        .sort((a, b) => a.proxima_el.localeCompare(b.proxima_el))[0] || null;
      return {
        mascotas: ms,
        proximas: [{
          id: 'r1', estado: 'confirmada', tipo: 'general', inicia_at: h(0, 16), termina_at: h(0, 18),
          mascota: ms[0], medico: { nombre: 'Ana', apellidos: 'Ruiz' },
        }, {
          id: 'r2', estado: 'confirmada', tipo: 'vacunacion', inicia_at: h(6, 10), termina_at: h(6, 12),
          mascota: ms[1], medico: { nombre: 'Luis', apellidos: 'Pérez' },
        }].filter((r) => r.mascota),
        recordatorio: proxima,
      };
    },

    async mvzHoy() {
      await espera();
      return {
        alcaldia: 'Coyoacán',
        horario: ['10:00', '18:00'],
        semana: [{ dia: 1, alcaldia: 'Coyoacán' }, { dia: 2, alcaldia: 'Coyoacán' }, { dia: 3, alcaldia: 'Coyoacán' }, { dia: 4, alcaldia: 'Coyoacán' }, { dia: 5, alcaldia: 'Coyoacán' }],
        saldo: { retenido: 1395, por_depositar: 2790 },
        consultas: [
          { id: 'c1', folio: 1042, estado: 'cerrada', tipo: 'general', inicia_at: h(0, 10), termina_at: h(0, 12), alcaldia: 'Coyoacán', colonia: 'Del Carmen', tutor_nombre: 'Jorge', mascota_nombre: 'Kira', especie: 'perro', motivo: 'Cojea de la pata trasera', total_mvz: 465, con_acceso: true },
          { id: 'c2', folio: 1047, estado: 'confirmada', tipo: 'vacunacion', inicia_at: h(0, 12), termina_at: h(0, 14), alcaldia: 'Coyoacán', colonia: 'Santa Catarina', tutor_nombre: 'Mariana', mascota_nombre: 'Luna', especie: 'gato', motivo: 'Refuerzo de triple felina', total_mvz: 503.75, con_acceso: true },
          { id: 'c3', folio: 1051, estado: 'confirmada', tipo: 'general', inicia_at: h(0, 16), termina_at: h(0, 18), alcaldia: 'Coyoacán', colonia: 'Villa Coyoacán', tutor_nombre: 'Sofía', mascota_nombre: 'Max', especie: 'perro', motivo: 'Vómito desde ayer', total_mvz: 465, con_acceso: true },
        ],
      };
    },

    // ───────── Agenda del médico veterinario (fase 5) ─────────
    async miAgenda() {
      await espera();
      const hoy = hoyISO();
      return JSON.parse(JSON.stringify({ dias: agenda, bloqueados: bloqueados.filter((b) => b.dia >= hoy), catalogo, alcaldias: ALCALDIAS, params: PARAMS }));
    },
    async consultasMvz(desde, hasta) {
      await espera(200);
      return consultasDemo.filter((c) => { const d = isoDe(c.inicia_at); return d >= desde && d <= hasta; })
        .sort((a, b) => a.inicia_at.localeCompare(b.inicia_at));
    },
    async guardarHorario(filas) {
      await espera(400);
      const quitar = agenda.map((a) => a.dia_semana).filter((d) => !filas.some((f) => f.dia_semana === d));
      filas.forEach((f) => {
        const [i, fi] = [horaNum(f.hora_inicio), horaNum(f.hora_fin)];
        if (i < 6 || fi > 22) falla('Puedes atender entre las 6:00 y las 22:00');
        if (fi - i < 2 || (fi - i) % 2) falla('El horario debe dar bloques completos de 2 horas');
      });
      // Igual que la base: no se puede dejar fuera una consulta ya pagada
      const futuras = consultasDemo.filter((c) => ['confirmada', 'en_domicilio'].includes(c.estado) && new Date(c.termina_at) > new Date());
      futuras.forEach((c) => {
        const ds = diaSemana(isoDe(c.inicia_at));
        const f = filas.find((x) => x.dia_semana === ds);
        const antes = agenda.find((x) => x.dia_semana === ds);
        const h0 = horaNum(new Date(c.inicia_at).toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City', hour: '2-digit', hour12: false }));
        const fuera = quitar.includes(ds) || (f && (f.alcaldia_id !== antes?.alcaldia_id || h0 < horaNum(f.hora_inicio) || h0 + 2 > horaNum(f.hora_fin)));
        if (antes && fuera) {
          falla(`Tienes una consulta ese día (la primera el ${isoDe(c.inicia_at).split('-').reverse().join('/')}) que ya no cabría. Cámbialo después de esa fecha o escribe a soporte`);
        }
      });
      agenda = agenda.filter((a) => !quitar.includes(a.dia_semana) && !filas.some((f) => f.dia_semana === a.dia_semana))
        .concat(filas.map((f) => ({ ...f, hora_inicio: f.hora_inicio + ':00', hora_fin: f.hora_fin + ':00' })))
        .sort((a, b) => a.dia_semana - b.dia_semana);
    },
    async bloquearDias(dias, motivo) {
      await espera(300);
      const ocupado = dias.find((d) => activas(d).length);
      if (ocupado) falla(`El ${ocupado.split('-').reverse().join('/')} tienes ${activas(ocupado).length} consultas agendadas. Para no dejar a nadie sin atención, escribe a soporte`);
      if (dias.some((d) => d < hoyISO())) falla('Ese día ya pasó');
      dias.forEach((d) => { if (!bloqueados.some((b) => b.dia === d)) bloqueados.push({ dia: d, motivo: (motivo || '').trim() || null }); });
      bloqueados.sort((a, b) => a.dia.localeCompare(b.dia));
    },
    async desbloquearDia(d) { await espera(250); bloqueados = bloqueados.filter((b) => b.dia !== d); },
    async guardarProducto(id, d) {
      await espera(300);
      const nombre = 'nombre' in d ? String(d.nombre || '').trim().replace(/\s+/g, ' ') : undefined;
      if (nombre !== undefined && (nombre.length < 2 || nombre.length > 80)) falla('Escribe el nombre del producto (de 2 a 80 caracteres)');
      if ('precio' in d && !(Number(d.precio) >= 1 && Number(d.precio) <= 20000)) falla('El precio debe estar entre $1 y $20,000');
      if (id) Object.assign(catalogo.find((p) => p.id === id), d, nombre !== undefined ? { nombre } : {});
      else catalogo.push({ id: 'p' + Date.now(), activo: true, ...d, nombre });
    },
    async quitarProducto(id) {
      await espera(250);
      if (vendidos.has(id)) { catalogo.find((p) => p.id === id).activo = false; return 'desactivado'; }
      catalogo = catalogo.filter((p) => p.id !== id);
      return 'borrado';
    },

    async adminResumen() {
      await espera();
      const c = cola();
      return {
        kpis: { consultasHoy: 7, pagadasSemana: 31, porRevisar: c.length, porDepositar: 8640.5 },
        revisiones: ordenarCola(c).slice(0, 6),
        proximas: [
          { id: 'p1', folio: 1047, estado: 'en_domicilio', tipo: 'vacunacion', inicia_at: h(0, 12), termina_at: h(0, 14), alcaldia: 'Coyoacán', mascota: { nombre: 'Luna', especie: 'gato' } },
          { id: 'p2', folio: 1049, estado: 'confirmada', tipo: 'general', inicia_at: h(0, 14), termina_at: h(0, 16), alcaldia: 'Benito Juárez', mascota: { nombre: 'Toby', especie: 'perro' } },
          { id: 'p3', folio: 1051, estado: 'confirmada', tipo: 'general', inicia_at: h(0, 16), termina_at: h(0, 18), alcaldia: 'Coyoacán', mascota: { nombre: 'Max', especie: 'perro' } },
          { id: 'p4', folio: 1053, estado: 'confirmada', tipo: 'especialidad', inicia_at: h(1, 10), termina_at: h(1, 12), alcaldia: 'Benito Juárez', mascota: { nombre: 'Nube', especie: 'gato' } },
        ],
        finanzas: { mes: hoyISO().slice(0, 8) + '01', consultas_cobradas: 58, cobrado: 35650, comisiones: 8021.25, pasarela: 1612.4, queda_lilievet: 6408.85, por_depositar_mvz: 8640.5 },
      };
    },

    // ───────── Panel: verificación ─────────
    async colaVerificacion() { await espera(); return cola(); },
    async conteosAdmin() { return { porRevisar: cola().length }; },
    async cuentaParaRevisar(id) {
      await espera(300);
      const c = cuentas[id];
      if (!c) falla('No encontramos esa cuenta.');
      return JSON.parse(JSON.stringify({ perfil: c.perfil, tutor: c.tutor || null, mvz: c.mvz || null, docs: c.docs, revisiones: c.revisiones, fotoUrl: null }));
    },
    async decidir(id, objeto, decision, nota, clave) {
      await espera(400);
      const c = cuentas[id];
      if (['rechazado', 'info_requerida'].includes(decision) && !(nota || '').trim()) falla('Escribe una nota para el usuario');
      if (decision === 'aprobado' && ['ine_tutor', 'alta_mvz'].includes(objeto)) {
        const k = String(clave || '').replace(/\s/g, '').toUpperCase();
        if (!/^[A-Z]{6}[0-9]{8}[HM][0-9]{3}$/.test(k)) falla('Escribe la clave de elector de la INE (18 caracteres)');
        if (huellas.has(k) && huellas.get(k) !== id) falla('Esta INE ya está registrada en otra cuenta. No se puede aprobar.');
        huellas.set(k, id);
      }
      const campo = { ine_tutor: ['tutor', 'estado_ine'], alta_mvz: ['mvz', 'estado'], especialidad: ['mvz', 'estado_especialidad'], clabe: ['mvz', 'estado_clabe'] }[objeto];
      c[campo[0]][campo[1]] = decision;
      const r = { id: 'r' + Date.now(), cuenta_id: id, objeto, decision, nota: nota || null, created_at: new Date().toISOString(), revisor: { nombre: 'Kat', apellidos: 'Moctezuma' } };
      c.revisiones.unshift(r);
      historial.unshift({ ...r, cuenta: { nombre: c.perfil.nombre, apellidos: c.perfil.apellidos, rol: c.perfil.rol } });
    },
    async historialRevisiones() { await espera(); return historial; },
    nombreObjeto: (o) => OBJETO_VERIF[o],
  };
}
