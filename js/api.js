// Capa de datos. Toda la app habla con `api`; por dentro usa Supabase (tablas de la fase 1)
// o, si aún no hay conexión, la vista de muestra con datos de ejemplo.
import { demoApi } from './demo.js';
import { hoyISO, prepararArchivo, DOC, armarVerif, ordenarCola } from './lib.js';
export { armarVerif, ordenarCola };

const cfg = window.LV_CONFIG || {};
const configurado = cfg.supabaseUrl && !cfg.supabaseUrl.includes('TU-PROYECTO') && cfg.supabaseKey && !cfg.supabaseKey.includes('PEGA-AQUI');

function demoPedido() {
  const p = new URLSearchParams(location.search).get('demo');
  if (p) { try { sessionStorage.setItem('lv-demo', p); } catch (e) { /* sin almacenamiento */ } return p; }
  try { return sessionStorage.getItem('lv-demo'); } catch (e) { return null; }
}

function supabaseApi() {
  const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  const ok = ({ data, error }) => { if (error) throw traducir(error); return data; };

  return {
    mode: 'supabase',
    client: sb,
    async session() { return (await sb.auth.getSession()).data.session; },
    onAuth(cb) { const { data } = sb.auth.onAuthStateChange((_e, s) => cb(s)); return () => data.subscription.unsubscribe(); },
    async entrar(correo, password) { ok(await sb.auth.signInWithPassword({ email: correo.trim(), password })); },
    async registrar(d) {
      ok(await sb.auth.signUp({
        email: d.correo.trim(), password: d.password,
        options: { data: {
          rol: d.rol, nombre: d.nombre.trim(), apellidos: d.apellidos.trim(), telefono: d.telefono.trim(),
          acepta_whatsapp: !!d.acepta_whatsapp, acepta_promos: !!d.acepta_promos,
          terminos_version: cfg.terminosVersion || '2026-11', codigo_invitacion: (d.codigo || '').trim() || null,
        } },
      }));
    },
    async recuperar(correo) {
      ok(await sb.auth.resetPasswordForEmail(correo.trim(), { redirectTo: location.origin + location.pathname + '#/nueva-contrasena' }));
    },
    async nuevaContrasena(password) { ok(await sb.auth.updateUser({ password })); },
    async salir() { await sb.auth.signOut(); },

    async perfil() {
      const uid = (await sb.auth.getUser()).data.user?.id;
      if (!uid) return null;
      const p = ok(await sb.from('perfiles').select('*').eq('id', uid).single());
      const [extra, docs, revs] = await Promise.all([
        p.rol === 'tutor'
          ? sb.from('tutores').select('*').eq('id', uid).single()
          : sb.from('mvz').select('*, especialidades(nombre)').eq('id', uid).single(),
        sb.from('documentos_verificacion').select('id, tipo, created_at').eq('cuenta_id', uid).order('created_at', { ascending: false }),
        sb.from('revisiones').select('objeto, decision, nota, created_at').eq('cuenta_id', uid).order('created_at', { ascending: false }),
      ]);
      return { ...p, extra: ok(extra), verif: armarVerif(ok(docs), ok(revs)) };
    },

    // ───────── Cuenta y verificación ─────────
    async subirDocumento(tipo, file) {
      const uid = (await sb.auth.getUser()).data.user.id;
      const f = await prepararArchivo(file, { pdf: DOC[tipo]?.pdf });
      const ext = f.type === 'application/pdf' ? 'pdf' : f.type === 'image/png' ? 'png' : /hei[cf]/i.test(f.type + f.name) ? 'heic' : 'jpg';
      const ruta = `${uid}/${tipo}-${Date.now()}.${ext}`;
      ok(await sb.storage.from('identidad').upload(ruta, f, { contentType: f.type || 'image/jpeg', upsert: false }));
      ok(await sb.from('documentos_verificacion').insert({ cuenta_id: uid, tipo, ruta: 'identidad/' + ruta, tipo_mime: f.type, bytes: f.size }));
      return { tipo, created_at: new Date().toISOString(), local: URL.createObjectURL(f) };
    },
    async enviarVerificacion(objeto) { ok(await sb.rpc('enviar_verificacion', { p_objeto: objeto })); },
    async guardarPerfil(d) {
      const uid = (await sb.auth.getUser()).data.user.id;
      ok(await sb.from('perfiles').update(d).eq('id', uid));
    },
    async guardarMvz(d) {
      const uid = (await sb.auth.getUser()).data.user.id;
      ok(await sb.from('mvz').update(d).eq('id', uid));
    },
    async subirFoto(file) {
      const uid = (await sb.auth.getUser()).data.user.id;
      const f = await prepararArchivo(file, { pdf: false });
      const ruta = `${uid}/foto-${Date.now()}.jpg`;
      ok(await sb.storage.from('perfiles').upload(ruta, f, { contentType: f.type, upsert: false }));
      ok(await sb.from('mvz').update({ foto_path: ruta }).eq('id', uid));
      return ruta;
    },
    fotoUrl(ruta) { return ruta ? sb.storage.from('perfiles').getPublicUrl(ruta).data.publicUrl : null; },
    async especialidades() { return ok(await sb.from('especialidades').select('id, nombre').order('nombre')); },
    async cambiarCorreo(correo) { ok(await sb.auth.updateUser({ email: correo.trim() })); },
    async invitaciones() {
      const [inv, saldo] = await Promise.all([
        sb.from('invitaciones').select('estado'),
        sb.from('saldo_tutor').select('monto, liberado, vence_el'),
      ]);
      const hoy = hoyISO();
      const vig = ok(saldo).filter((s) => !s.vence_el || s.vence_el >= hoy);
      return {
        registradas: ok(inv).length,
        activadas: ok(inv).filter((i) => i.estado === 'activada').length,
        saldo: vig.filter((s) => s.liberado).reduce((a, s) => a + Number(s.monto), 0),
        retenido: vig.filter((s) => !s.liberado).reduce((a, s) => a + Number(s.monto), 0),
      };
    },

    // ───────── Panel: verificación ─────────
    async colaVerificacion() {
      return ok(await sb.from('cola_verificacion').select('*').order('enviado_at'));
    },
    async conteosAdmin() {
      const r = await sb.from('cola_verificacion').select('cuenta_id', { count: 'exact', head: true });
      if (r.error) throw traducir(r.error);
      return { porRevisar: r.count || 0 };
    },
    async cuentaParaRevisar(id) {
      const [p, t, m, docs, revs] = await Promise.all([
        sb.from('perfiles').select('*').eq('id', id).single(),
        sb.from('tutores').select('*').eq('id', id).maybeSingle(),
        sb.from('mvz').select('*, especialidades(nombre)').eq('id', id).maybeSingle(),
        sb.rpc('documentos_de_cuenta', { p_cuenta: id }),
        sb.from('revisiones').select('id, objeto, decision, nota, created_at, revisor:perfiles!revisiones_revisado_por_fkey(nombre, apellidos)')
          .eq('cuenta_id', id).order('created_at', { ascending: false }),
      ]);
      const ds = ok(docs);
      const rutas = ds.map((d) => d.ruta.replace(/^identidad\//, ''));
      const firmadas = rutas.length ? ok(await sb.storage.from('identidad').createSignedUrls(rutas, 600)) : [];
      const url = Object.fromEntries(firmadas.map((f) => [f.path, f.signedUrl]));
      return {
        perfil: ok(p), tutor: ok(t), mvz: ok(m),
        docs: ds.map((d) => ({ ...d, url: url[d.ruta.replace(/^identidad\//, '')] })),
        revisiones: ok(revs),
        fotoUrl: ok(m)?.foto_path ? sb.storage.from('perfiles').getPublicUrl(ok(m).foto_path).data.publicUrl : null,
      };
    },
    async decidir(cuenta, objeto, decision, nota, clave) {
      ok(await sb.rpc('decidir_verificacion', { p_cuenta: cuenta, p_objeto: objeto, p_decision: decision, p_nota: nota || null, p_clave_elector: clave || null }));
    },
    async historialRevisiones() {
      return ok(await sb.from('revisiones')
        .select('id, cuenta_id, objeto, decision, nota, created_at, cuenta:perfiles!revisiones_cuenta_id_fkey(nombre, apellidos, rol)')
        .order('created_at', { ascending: false }).limit(60));
    },

    async tutorInicio() {
      const [mascotas, reservas, cartilla] = await Promise.all([
        sb.from('mascotas').select('id, nombre, especie, raza, sexo, fecha_nacimiento, edad_aprox_meses, foto_path').is('borrada_at', null).order('created_at'),
        sb.from('reservas').select('id, estado, tipo, inicia_at, termina_at, mascota_id, mvz_id')
          .in('estado', ['confirmada', 'en_domicilio']).order('inicia_at').limit(5),
        sb.from('cartilla').select('mascota_id, tipo, producto, proxima_el').gte('proxima_el', hoyISO()).order('proxima_el').limit(5),
      ]);
      const ms = ok(mascotas), rs = ok(reservas), cs = ok(cartilla);
      const ids = [...new Set(rs.map((r) => r.mvz_id))];
      const medicos = ids.length ? ok(await sb.from('mvz_publicos').select('id, nombre, apellidos, foto_path').in('id', ids)) : [];
      const porId = Object.fromEntries(medicos.map((m) => [m.id, m]));
      const mascota = Object.fromEntries(ms.map((m) => [m.id, m]));
      const vencidas = new Set(); // la cartilla vencida se calcula en la fase 4
      return {
        mascotas: ms.map((m) => ({ ...m, vacunaVencida: vencidas.has(m.id) })),
        proximas: rs.map((r) => ({ ...r, mascota: mascota[r.mascota_id], medico: porId[r.mvz_id] })),
        recordatorio: cs[0] ? { ...cs[0], mascota: mascota[cs[0].mascota_id] } : null,
      };
    },

    async mvzHoy() {
      const hoy = hoyISO();
      const dia = ((new Date(hoy + 'T12:00:00').getDay() + 6) % 7) + 1;
      const uid = (await sb.auth.getUser()).data.user.id;
      const [consultas, agenda, saldo] = await Promise.all([
        sb.rpc('mis_consultas_mvz', { p_desde: hoy, p_hasta: hoy }),
        sb.from('agenda_dias').select('dia_semana, hora_inicio, hora_fin, alcaldias(nombre)').eq('mvz_id', uid),
        sb.from('saldo_mvz').select('neto, estado'),
      ]);
      const ag = ok(agenda), sal = ok(saldo);
      const suma = (e) => sal.filter((s) => s.estado === e).reduce((a, s) => a + Number(s.neto), 0);
      const hoyAg = ag.find((a) => a.dia_semana === dia);
      return {
        consultas: ok(consultas),
        alcaldia: hoyAg?.alcaldias?.nombre || null,
        horario: hoyAg ? [hoyAg.hora_inicio.slice(0, 5), hoyAg.hora_fin.slice(0, 5)] : null,
        semana: ag.map((a) => ({ dia: a.dia_semana, alcaldia: a.alcaldias?.nombre })),
        saldo: { retenido: suma('retenido'), por_depositar: suma('por_depositar') },
      };
    },

    async adminResumen() {
      const hoy = hoyISO();
      const ini = new Date(hoy + 'T00:00:00-06:00').toISOString();
      const fin = new Date(hoy + 'T23:59:59-06:00').toISOString();
      const semana = new Date(Date.now() - 7 * 864e5).toISOString();
      const cuenta = async (q) => { const r = await q; if (r.error) throw traducir(r.error); return r.count || 0; };
      const [hoyN, semanaN, saldo, cola, proximas, fin_] = await Promise.all([
        cuenta(sb.from('reservas').select('id', { count: 'exact', head: true }).gte('inicia_at', ini).lte('inicia_at', fin).in('estado', ['confirmada', 'en_domicilio', 'cerrada'])),
        cuenta(sb.from('reservas').select('id', { count: 'exact', head: true }).gte('confirmada_at', semana)),
        sb.from('saldo_mvz').select('neto').eq('estado', 'por_depositar'),
        sb.from('cola_verificacion').select('*').order('enviado_at'),
        sb.from('reservas').select('id, folio, estado, tipo, inicia_at, termina_at, alcaldias(nombre), mascotas(nombre, especie)')
          .gte('inicia_at', ini).in('estado', ['confirmada', 'en_domicilio']).order('inicia_at').limit(8),
        sb.from('finanzas_mensuales').select('*').limit(1),
      ]);
      const revisiones = ordenarCola(ok(cola)).slice(0, 6);
      return {
        kpis: {
          consultasHoy: hoyN, pagadasSemana: semanaN, porRevisar: ok(cola).length,
          porDepositar: ok(saldo).reduce((a, s) => a + Number(s.neto), 0),
        },
        revisiones,
        proximas: ok(proximas).map((r) => ({ ...r, alcaldia: r.alcaldias?.nombre, mascota: r.mascotas })),
        finanzas: ok(fin_)[0] || null,
      };
    },
  };
}

// Mensajes de error en español
export function traducir(e) {
  const m = (e && (e.message || e.error_description)) || String(e);
  const tabla = [
    [/Invalid login credentials/i, 'El correo o la contraseña no coinciden.'],
    [/Email not confirmed/i, 'Confirma tu correo antes de entrar.'],
    [/User already registered/i, 'Ya existe una cuenta con ese correo. Inicia sesión.'],
    [/Password should be at least/i, 'La contraseña debe tener al menos 8 caracteres.'],
    [/rate limit/i, 'Hiciste muchos intentos. Espera unos minutos.'],
    [/Failed to fetch|NetworkError/i, 'No hay conexión. Revisa tu internet e intenta de nuevo.'],
    [/Payload too large|exceeded the maximum allowed size/i, 'El archivo pesa demasiado. Máximo 10 MB.'],
    [/mime type .* is not supported|invalid_mime_type/i, 'Ese tipo de archivo no se acepta. Sube una foto JPG o PNG, o un PDF.'],
    [/duplicate key value violates unique constraint "perfiles_ine_huella_key"/i, 'Esta INE ya está registrada en otra cuenta.'],
    [/New email address should be different/i, 'Ese ya es tu correo.'],
  ];
  const t = tabla.find(([re]) => re.test(m));
  const err = new Error(t ? t[1] : m);
  err.original = e;
  return err;
}

function sinConfig() {
  return { mode: 'sin_config', async session() { return null; }, onAuth() { return () => {}; } };
}

const demo = demoPedido();
export const api = demo ? demoApi(demo) : configurado ? supabaseApi() : sinConfig();
