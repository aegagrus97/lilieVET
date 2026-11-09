// Utilidades compartidas: htm (JSX sin compilar), componentes del sistema de diseño, íconos y fechas.
export const React = window.React;
export const html = window.htm.bind(React.createElement);
export const DS = window.LilieVET;
export const { useState, useEffect, useMemo, useCallback, useContext, createContext, useRef } = React;

export const money = DS.money;
export const TZ = 'America/Mexico_City';

// Íconos de línea con el mismo trazo que el sistema (2 px, puntas redondeadas).
// Los primeros son los del sistema; los demás siguen el mismo estilo para el menú lateral.
const PATHS = {
  home: 'M3.5 11 12 4l8.5 7|M5.5 9.5V20h13V9.5|M10 20v-5.5h4V20',
  paw: 'M8.3 17.2c.6-2.7 2-4.7 3.9-4.7s3.3 2 3.9 4.7c.4 1.6-.7 2.8-2.1 2.8-.8 0-1.2-.4-1.8-.4s-1 .4-1.8.4c-1.4 0-2.5-1.2-2.1-2.8z',
  plus: 'M12 5v14M5 12h14',
  cal: 'M3.5 10h17M8 3v4M16 3v4',
  user: 'M4.5 20c1.3-3.6 4.2-5.6 7.5-5.6s6.2 2 7.5 5.6',
  inbox: 'M4 13.5 6.6 6h10.8L20 13.5V19H4z|M4 13.5h4.5l1.2 2.2h4.6l1.2-2.2H20',
  chat: 'M4 5.5h16v10.5H10l-4.5 3.8V16H4z|M8 9.5h8M8 12.5h5',
  check: 'M5 12.5 9.5 17 19 7.5',
  info: 'M12 11v5.5M12 7.8v.01',
  alert: 'M12 4 21 19.5H3z|M12 10v4.2M12 17v.01',
  pin: 'M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z',
  clock: 'M12 7.5V12l3 2',
  wallet: 'M4 7.5h14.5a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18V6.5A1.5 1.5 0 0 1 5.5 5H17|M16 13.5h.01',
  shield: 'M12 3.5 19 6v5.5c0 4.3-3 7.7-7 9-4-1.3-7-4.7-7-9V6z|M9 12l2 2 4-4',
  users: 'M3 19.5c1-3 3.4-4.6 6-4.6s5 1.6 6 4.6|M15.5 14.9c2.2.1 4.2 1.6 5 4.1',
  chart: 'M4 20h16|M7 16v-5M12 16V7M17 16v-8',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z|M10 20.5h4',
  settings: 'M4 7h10M18 7h2M4 17h4M12 17h8',
  logout: 'M14 5H5.5v14H14|M10 12h10M16.5 8.5 20 12l-3.5 3.5',
  menu: 'M4 7h16M4 12h16M4 17h16',
  back: 'M15 5l-7 7 7 7',
  moon: 'M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z',
  swap: 'M7 7h12l-3-3M17 17H5l3 3',
  doc: 'M6 3.5h8l4 4V20.5H6z|M14 3.5V8h4|M9 12h6M9 15.5h6',
  camera: 'M4 8.5h3.5L9 6h6l1.5 2.5H20V19H4z',
  id: 'M3.5 6h17v12h-17z|M13 10h4.5M13 13.5h3',
  upload: 'M12 15.5V5M8 9l4-4 4 4|M5 15v4.5h14V15',
  phone: 'M7.5 3.5h9v17h-9z|M11 17.5h2',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7L11.5 6.8|M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5',
  x: 'M6 6l12 12M18 6 6 18',
  bank: 'M3.5 9.5 12 4l8.5 5.5|M5.5 10v7.5M10 10v7.5M14 10v7.5M18.5 10v7.5|M3.5 20h17',
  star: 'M12 4l2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6z',
};
const EXTRA = {
  paw: [['circle', { cx: 6.5, cy: 10, r: 1.7 }], ['circle', { cx: 10, cy: 6, r: 1.7 }], ['circle', { cx: 14.5, cy: 6, r: 1.7 }], ['circle', { cx: 18, cy: 10, r: 1.7 }]],
  cal: [['rect', { x: 3.5, y: 5, width: 17, height: 15.5, rx: 2.5 }]],
  user: [['circle', { cx: 12, cy: 8, r: 3.8 }]],
  users: [['circle', { cx: 9, cy: 8.5, r: 3.4 }], ['circle', { cx: 16.5, cy: 9, r: 2.6 }]],
  info: [['circle', { cx: 12, cy: 12, r: 8.5 }]],
  pin: [['circle', { cx: 12, cy: 10, r: 2.3 }]],
  clock: [['circle', { cx: 12, cy: 12, r: 8.5 }]],
  settings: [['circle', { cx: 16, cy: 7, r: 2 }], ['circle', { cx: 10, cy: 17, r: 2 }]],
  camera: [['circle', { cx: 12, cy: 13, r: 3.2 }]],
  id: [['circle', { cx: 8.5, cy: 11, r: 1.8 }], ['path', { d: 'M6 15.5c.5-1.3 1.4-2 2.5-2s2 .7 2.5 2' }]],
};

export function Icon({ name, className = '' }) {
  const kids = (EXTRA[name] || []).map((e, i) => React.createElement(e[0], { key: 'e' + i, ...e[1] }));
  (PATHS[name] || '').split('|').forEach((d, i) => { if (d) kids.push(React.createElement('path', { key: 'p' + i, d })); });
  return React.createElement('svg', {
    className: 'lv-i ' + className, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
  }, kids);
}

// ───────── Fechas (siempre en hora de CDMX) ─────────
const fmt = (opts) => new Intl.DateTimeFormat('es-MX', { timeZone: TZ, ...opts });
export const hora = (d) => fmt({ hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(d));
export const fechaLarga = (d) => fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(d));
export const fechaCorta = (d) => fmt({ day: 'numeric', month: 'short' }).format(new Date(d)).replace('.', '');
export function diaRelativo(d) {
  const k = (x) => fmt({ year: 'numeric', month: '2-digit', day: '2-digit' }).format(x);
  const hoy = new Date();
  const man = new Date(hoy.getTime() + 864e5);
  if (k(new Date(d)) === k(hoy)) return 'Hoy';
  if (k(new Date(d)) === k(man)) return 'Mañana';
  const s = fechaLarga(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}
export const ventana = (ini, fin) => `${diaRelativo(ini)}, ${hora(ini)} a ${hora(fin)}`;
export const hoyISO = () => fmt({ year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()).split('/').reverse().join('-');

// Fechas sin hora ("2026-03-04"): se arman al mediodía UTC para que no se recorran un día en CDMX
export function fechaDia(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).split('-').map(Number);
  return fmt({ day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(Date.UTC(y, m - 1, d, 12))).replace('.', '');
}
export function fechaDiaLarga(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).split('-').map(Number);
  return fmt({ day: 'numeric', month: 'long' }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}
export const diasHasta = (iso) => {
  const [y, m, d] = String(iso).split('-').map(Number);
  const [hy, hm, hd] = hoyISO().split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(hy, hm - 1, hd)) / 864e5);
};

export function edad(m) {
  if (m.fecha_nacimiento) {
    const meses = Math.floor((Date.now() - new Date(m.fecha_nacimiento)) / (30.44 * 864e5));
    return meses >= 12 ? `${Math.floor(meses / 12)} ${Math.floor(meses / 12) === 1 ? 'año' : 'años'}` : `${meses} meses`;
  }
  if (m.edad_aprox_meses != null) {
    const a = Math.floor(m.edad_aprox_meses / 12);
    return a >= 1 ? `${a} ${a === 1 ? 'año' : 'años'} aprox.` : `${m.edad_aprox_meses} meses aprox.`;
  }
  return null;
}
export const capital = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
export const nombreCorto = (p) => (p?.nombre || '').split(' ')[0];

// Etiquetas de estados de una reserva (tono del Badge + palabra)
export const ESTADO_RESERVA = {
  apartada: ['pendiente', 'Por pagar'],
  confirmada: ['verificado', 'Confirmada'],
  en_domicilio: ['en-camino', 'En consulta'],
  cerrada: ['completado', 'Terminada'],
  expirada: ['neutral', 'Sin pagar'],
  cancelada_tutor: ['neutral', 'Cancelada'],
  cancelada_tarde: ['neutral', 'Cancelada'],
  tutor_ausente: ['error', 'Tutor ausente'],
  mvz_no_llego: ['error', 'Médico ausente'],
  cancelada_admin: ['neutral', 'Cancelada'],
};
export const TIPO_CONSULTA = { general: 'Consulta general', especialidad: 'Consulta especializada', vacunacion: 'Vacunación y desparasitación' };

// ───────── Mascotas (fase 4) ─────────
export const ESPECIE = { perro: 'Perro', gato: 'Gato' };
export const SEXO = { macho: 'Macho', hembra: 'Hembra' };
export const TIPO_CARTILLA = { vacuna: 'Vacuna', desparasitacion: 'Desparasitación' };
export const DOC_MASCOTA = {
  laboratorio: 'Estudio de laboratorio', imagen: 'Estudio de imagen', receta: 'Receta',
  medico: 'Informe médico', cartilla: 'Cartilla física', otro: 'Otro',
};

// Cómo va la cartilla: vencido manda sobre lo que viene pronto
export function estadoCartilla(filas) {
  const con = (filas || []).filter((f) => f.proxima_el);
  const hoy = hoyISO();
  const vencidas = con.filter((f) => f.proxima_el < hoy).sort((a, b) => a.proxima_el.localeCompare(b.proxima_el));
  const proxima = con.filter((f) => f.proxima_el >= hoy).sort((a, b) => a.proxima_el.localeCompare(b.proxima_el))[0] || null;
  if (vencidas.length) {
    return { tone: 'error', label: vencidas.some((f) => f.tipo === 'vacuna') ? 'Vacuna vencida' : 'Desparasitación vencida', vencidas, proxima };
  }
  if (!filas || !filas.length) return { tone: 'neutral', label: 'Sin cartilla', vencidas, proxima };
  if (proxima && diasHasta(proxima.proxima_el) <= 30) return { tone: 'pendiente', label: 'Refuerzo pronto', vencidas, proxima };
  return { tone: 'verificado', label: 'Cartilla al día', vencidas, proxima };
}

// ───────── Verificación ─────────
export const ESTADO_VERIF = {
  sin_enviar: ['neutral', 'Sin enviar'],
  pendiente: ['pendiente', 'En revisión'],
  en_revision: ['pendiente', 'En revisión'],
  aprobado: ['verificado', 'Verificado'],
  rechazado: ['error', 'Rechazado'],
  info_requerida: ['error', 'Falta corregir'],
  suspendido: ['error', 'Suspendido'],
};
export const OBJETO_VERIF = {
  ine_tutor: 'INE de tutor',
  alta_mvz: 'Alta de médico veterinario',
  especialidad: 'Especialidad',
  clabe: 'CLABE para depósitos',
  cuenta: 'Cuenta',
};
export const DECISION = { aprobado: 'Aprobado', rechazado: 'Rechazado', info_requerida: 'Pidió corrección', suspendido: 'Suspendida', pendiente: 'Pendiente' };
export const DOC = {
  ine_frente: { titulo: 'INE (frente)', hint: 'Que se lean tu nombre y tu foto. Sin reflejos ni dedos encima.', pdf: false },
  ine_reverso: { titulo: 'INE (reverso)', hint: 'Que se vea completa, con el código de barras.', pdf: false },
  selfie_ine: { titulo: 'Selfie con tu INE', hint: 'Tu cara y tu INE junto a ella, las dos bien enfocadas.', pdf: false, selfie: true },
  cedula: { titulo: 'Cédula profesional', hint: 'Foto o PDF de tu cédula de médico veterinario zootecnista.', pdf: true },
  especialidad: { titulo: 'Documento de especialidad', hint: 'Cédula de especialidad, diploma o constancia de la residencia.', pdf: true },
  estado_cuenta: { titulo: 'Estado de cuenta', hint: 'La carátula donde se ven tu nombre, el banco y la CLABE. Puedes tapar los movimientos.', pdf: true },
};
// Nombres sin título: "Dra. Ana" → "Ana" (igual que la base de datos)
export const quitarTitulo = (t) => String(t || '').replace(/^\s*((dra|dr|doctora|doctor|mvz|m\.\s*v\.\s*z|mtra|mtro|lic)(\.\s*|\s+))+/i, '').trim();
export const nombreCompleto = (p) => `${p?.nombre || ''} ${p?.apellidos || ''}`.trim();

// CLABE: 18 dígitos con dígito verificador (pesos 3, 7, 1)
export function clabeValida(c) {
  const d = String(c || '').replace(/\D/g, '');
  if (d.length !== 18) return false;
  const p = [3, 7, 1];
  const suma = [...d.slice(0, 17)].reduce((a, n, i) => a + ((Number(n) * p[i % 3]) % 10), 0);
  return (10 - (suma % 10)) % 10 === Number(d[17]);
}
const BANCOS = { '002': 'Banamex', '012': 'BBVA', '014': 'Santander', '021': 'HSBC', '030': 'BanBajío', '036': 'Inbursa', '044': 'Scotiabank',
  '058': 'Banregio', '072': 'Banorte', '127': 'Banco Azteca', '137': 'BanCoppel', '638': 'Nu México', '646': 'STP', '722': 'Mercado Pago' };
export const bancoDeClabe = (c) => BANCOS[String(c || '').replace(/\D/g, '').slice(0, 3)] || null;

export function hace(d) {
  const min = Math.round((Date.now() - new Date(d)) / 6e4);
  if (min < 1) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  if (min < 1440) return `hace ${Math.round(min / 60)} h`;
  if (min < 2880) return 'ayer';
  return fechaCorta(d);
}

// Fotos: se reducen a 2000 px en JPG antes de subirlas. PDF se suben tal cual (máx. 10 MB).
export async function prepararArchivo(file, { pdf = true } = {}) {
  const MB = 1048576;
  if (!file) throw new Error('Elige un archivo.');
  if (file.type === 'application/pdf') {
    if (!pdf) throw new Error('Aquí va una foto (JPG o PNG), no un PDF.');
    if (file.size > 10 * MB) throw new Error('El PDF pesa más de 10 MB. Prueba con una foto.');
    return file;
  }
  if (!/^image\//.test(file.type) && !/\.(heic|heif)$/i.test(file.name || '')) throw new Error('Sube una foto (JPG o PNG)' + (pdf ? ' o un PDF.' : '.'));
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { bmp = null; }
  if (!bmp) {
    if (file.size > 10 * MB) throw new Error('La foto pesa más de 10 MB. Tómala de nuevo.');
    return file; // HEIC u otro formato que el navegador no abre: se sube como está
  }
  if (Math.max(bmp.width, bmp.height) < 700) throw new Error('La foto se ve muy pequeña. Tómala más de cerca y con buena luz.');
  const k = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
  const cv = document.createElement('canvas');
  cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
  cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
  const blob = await new Promise((r) => cv.toBlob(r, 'image/jpeg', 0.85));
  return new File([blob], 'foto.jpg', { type: 'image/jpeg' });
}

// Lo que la persona ya subió y la última nota de cada revisión
export function armarVerif(docs, revs) {
  const subidos = {};
  docs.forEach((d) => { if (!subidos[d.tipo]) subidos[d.tipo] = d; });
  const notas = {};
  revs.forEach((r) => { if (!notas[r.objeto]) notas[r.objeto] = r; });
  return { subidos, notas };
}
// Primero quien ya tiene consulta agendada; luego lo más antiguo
export const ordenarCola = (cola) => [...cola].sort((a, b) =>
  (a.proxima_consulta ? 0 : 1) - (b.proxima_consulta ? 0 : 1)
  || new Date(a.proxima_consulta || a.enviado_at) - new Date(b.proxima_consulta || b.enviado_at));


// ───────── Agenda del médico veterinario (fase 5) ─────────
// CDMX no cambia de horario desde 2022: siempre UTC-6.
export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const partes = (iso) => String(iso).split('-').map(Number);
export const sumarDias = (iso, n) => { const [y, m, d] = partes(iso); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
// 1 = lunes … 7 = domingo (igual que isodow en la base)
export const diaSemana = (iso) => { const [y, m, d] = partes(iso); return ((new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7) + 1; };
export const lunesDe = (iso) => sumarDias(iso, 1 - diaSemana(iso));
export const hhmm = (t) => String(t || '').slice(0, 5);
export const horaNum = (t) => Number(String(t || '').slice(0, 2));
export const dosDig = (n) => String(n).padStart(2, '0');
export const instante = (iso, hora) => new Date(`${iso}T${hhmm(hora)}:00-06:00`);
// Fecha (sin hora) en CDMX de un instante
export const isoDe = (d) => fmt({ year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(d)).split('/').reverse().join('-');
export const numDia = (iso) => partes(iso)[2];
export const mesCorto = (iso) => { const [y, m, d] = partes(iso); return fmt({ month: 'short' }).format(new Date(Date.UTC(y, m - 1, d, 12))).replace('.', ''); };

// Bloques de un día según su horario: [{ ini, fin, desde: '09:00', hasta: '11:00' }]
export function bloquesDelDia(iso, conf, horasBloque = 2) {
  if (!conf) return [];
  const out = [];
  for (let h = horaNum(conf.hora_inicio); h + horasBloque <= horaNum(conf.hora_fin); h += horasBloque) {
    const desde = dosDig(h) + ':00', hasta = dosDig(h + horasBloque) + ':00';
    out.push({ ini: instante(iso, desde), fin: instante(iso, hasta), desde, hasta });
  }
  return out;
}
export const nBloques = (ini, fin, horasBloque = 2) => Math.max(0, Math.floor((horaNum(fin) - horaNum(ini)) / horasBloque));
// Lo que recibe el médico de un precio (la comisión se cobra sobre todo)
export const recibe = (precio, comision) => Math.round(Number(precio) * (1 - Number(comision)) * 100) / 100;
export const TIPO_PRODUCTO = { vacuna: 'Vacuna', desparasitante: 'Desparasitante' };
export const ESPECIE_PRODUCTO = { '': 'Perros y gatos', perro: 'Perros', gato: 'Gatos' };
// Estados de reserva que ocupan el bloque en la agenda del médico
export const OCUPA_BLOQUE = new Set(['confirmada', 'en_domicilio', 'cerrada', 'tutor_ausente', 'mvz_no_llego']);
