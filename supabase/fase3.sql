-- =====================================================================
-- LilieVET · Base de datos, fase 3: cuentas y verificación
-- Correr en SQL Editor DESPUÉS de schema.sql (una sola vez, en el mismo proyecto).
--
-- Qué cambia:
--   * Nadie entra a la cola de revisión hasta que envía su solicitud completa
--     (antes bastaba con subir un archivo). Función: enviar_verificacion().
--   * Alta de MVZ: INE (frente y reverso), selfie con la INE, cédula escaneada y número de cédula.
--     Especialidad y CLABE se revisan aparte.
--   * Una INE = una cuenta: al aprobar una INE el admin captura la clave de elector; se guarda
--     solo su huella (sha-256), nunca el número, y no se puede aprobar la misma INE dos veces.
--   * Sin títulos en los nombres: "Dr.", "Dra.", "MVZ" y similares se quitan al guardar.
--   * Con la identidad enviada o aprobada, el nombre y la cédula solo los cambia soporte.
--   * Cola de revisión para el Panel (vista cola_verificacion) y apertura de documentos con registro.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Columnas nuevas
-- ---------------------------------------------------------------------
alter table mvz alter column estado set default 'sin_enviar';
update mvz set estado = 'sin_enviar'
 where estado = 'pendiente'
   and not exists (select 1 from documentos_verificacion d where d.cuenta_id = mvz.id);

alter table tutores add column ine_enviada_at timestamptz;
alter table mvz add column alta_enviada_at timestamptz,
                add column especialidad_enviada_at timestamptz,
                add column clabe_enviada_at timestamptz;
alter table perfiles add column ine_huella text unique;   -- sha-256 de la clave de elector
alter table documentos_verificacion add column tipo_mime text,
                                    add column bytes int check (bytes is null or bytes <= 10485760);

-- Catálogo inicial de especialidades (el admin puede agregar más)
insert into especialidades (nombre) values
  ('Cardiología'), ('Dermatología'), ('Endocrinología'), ('Etología clínica (comportamiento)'),
  ('Imagenología'), ('Medicina felina'), ('Medicina interna'), ('Nefrología y urología'),
  ('Neurología'), ('Nutrición clínica'), ('Odontología'), ('Oftalmología'), ('Oncología'),
  ('Ortopedia y traumatología'), ('Rehabilitación y fisioterapia')
on conflict (nombre) do nothing;

-- ---------------------------------------------------------------------
-- 2. Nombres sin título
-- ---------------------------------------------------------------------
create function quitar_titulo(t text) returns text language sql immutable as $$
  select btrim(regexp_replace(coalesce(t, ''),
    '^\s*((dra|dr|doctora|doctor|mvz|m\.\s*v\.\s*z|mtra|mtro|lic)(\.\s*|\s+))+', '', 'i'))
$$;
update perfiles set nombre = quitar_titulo(nombre) where nombre is distinct from quitar_titulo(nombre);

create function perfil_nombre() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.nombre := quitar_titulo(new.nombre);
  new.apellidos := btrim(coalesce(new.apellidos, ''));
  if tg_op = 'UPDATE' and not es_admin()
     and (new.nombre is distinct from old.nombre or new.apellidos is distinct from old.apellidos)
     and (exists (select 1 from tutores where id = new.id and estado_ine in ('pendiente','en_revision','aprobado'))
          or exists (select 1 from mvz where id = new.id and estado in ('pendiente','en_revision','aprobado'))) then
    raise exception 'Tu nombre ya está verificado con tu INE. Para corregirlo escribe a soporte.' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger perfiles_nombre before insert or update of nombre, apellidos on perfiles
  for each row execute function perfil_nombre();

-- ---------------------------------------------------------------------
-- 3. Cambios del MVZ que regresan algo a revisión
-- ---------------------------------------------------------------------
-- Antes: subir cualquier documento ponía la cuenta en "pendiente". Ahora se envía a propósito.
drop trigger al_subir_documento on documentos_verificacion;
drop function documento_subido();

create or replace function clabe_cambiada() returns trigger language plpgsql as $$
begin
  if not es_admin() then
    if new.clabe is distinct from old.clabe or new.titular_clabe is distinct from old.titular_clabe
       or new.banco is distinct from old.banco then
      new.estado_clabe := 'sin_enviar';
      new.clabe_enviada_at := null;
    end if;
    if new.especialidad_id is distinct from old.especialidad_id then
      new.estado_especialidad := 'sin_enviar';
      new.especialidad_enviada_at := null;
    end if;
    if new.cedula is distinct from old.cedula and old.estado in ('pendiente','en_revision','aprobado','suspendido') then
      raise exception 'Tu cédula ya está en revisión o aprobada. Para cambiarla escribe a soporte.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 4. Enviar a revisión (lo llama la persona desde la app)
-- ---------------------------------------------------------------------
create function nombre_documento(p_tipo text) returns text language sql immutable as $$
  select case p_tipo
    when 'ine_frente' then 'INE (frente)' when 'ine_reverso' then 'INE (reverso)'
    when 'selfie_ine' then 'selfie con tu INE' when 'cedula' then 'cédula profesional'
    when 'especialidad' then 'documento de especialidad' when 'estado_cuenta' then 'estado de cuenta'
    else p_tipo end
$$;

create function enviar_verificacion(p_objeto text) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_tipos text[];
  v_falta text;
  t tutores;
  m mvz;
  p perfiles;
begin
  if v_uid is null then raise exception 'Inicia sesión' using errcode = '42501'; end if;
  v_tipos := case p_objeto
    when 'ine_tutor'    then array['ine_frente','ine_reverso','selfie_ine']
    when 'alta_mvz'     then array['ine_frente','ine_reverso','selfie_ine','cedula']
    when 'especialidad' then array['especialidad']
    when 'clabe'        then array['estado_cuenta']
  end;
  if v_tipos is null then raise exception 'Solicitud no válida' using errcode = 'P0001'; end if;

  select string_agg(nombre_documento(x), ', ') into v_falta from unnest(v_tipos) x
   where not exists (select 1 from documentos_verificacion d where d.cuenta_id = v_uid and d.tipo = x);
  if v_falta is not null then raise exception 'Falta subir: %', v_falta using errcode = 'P0001'; end if;

  select * into p from perfiles where id = v_uid;
  if p.suspendido then raise exception 'Tu cuenta está suspendida. Escribe a soporte.' using errcode = 'P0001'; end if;

  if p_objeto = 'ine_tutor' then
    select * into t from tutores where id = v_uid;
    if not found then raise exception 'Solo para tutores' using errcode = '42501'; end if;
    if t.estado_ine not in ('sin_enviar','info_requerida') then
      raise exception 'Tu INE ya está en revisión o aprobada' using errcode = 'P0001';
    end if;
    update tutores set estado_ine = 'pendiente', ine_enviada_at = now() where id = v_uid;
  else
    select * into m from mvz where id = v_uid;
    if not found then raise exception 'Solo para médicos veterinarios' using errcode = '42501'; end if;
    if p_objeto = 'alta_mvz' then
      if m.estado not in ('sin_enviar','info_requerida') then
        raise exception 'Tu solicitud ya está en revisión o aprobada' using errcode = 'P0001';
      end if;
      if coalesce(p.nombre, '') = '' or coalesce(p.apellidos, '') = '' then
        raise exception 'Escribe tu nombre y apellidos como aparecen en tu INE' using errcode = 'P0001';
      end if;
      if coalesce(m.cedula, '') !~ '^[0-9]{5,8}$' then
        raise exception 'Escribe tu número de cédula profesional (solo números)' using errcode = 'P0001';
      end if;
      update mvz set estado = 'pendiente', alta_enviada_at = now() where id = v_uid;
    elsif p_objeto = 'especialidad' then
      if m.especialidad_id is null then raise exception 'Elige tu especialidad' using errcode = 'P0001'; end if;
      if m.estado = 'sin_enviar' then raise exception 'Primero envía tu solicitud de alta' using errcode = 'P0001'; end if;
      if m.estado_especialidad not in ('sin_enviar','info_requerida') then
        raise exception 'Tu especialidad ya está en revisión o aprobada' using errcode = 'P0001';
      end if;
      update mvz set estado_especialidad = 'pendiente', especialidad_enviada_at = now() where id = v_uid;
    else -- clabe
      if m.clabe is null or coalesce(m.titular_clabe, '') = '' or coalesce(m.banco, '') = '' then
        raise exception 'Completa banco, CLABE y titular' using errcode = 'P0001';
      end if;
      if m.estado = 'sin_enviar' then raise exception 'Primero envía tu solicitud de alta' using errcode = 'P0001'; end if;
      if m.estado_clabe not in ('sin_enviar','info_requerida') then
        raise exception 'Tu CLABE ya está en revisión o aprobada' using errcode = 'P0001';
      end if;
      update mvz set estado_clabe = 'pendiente', clabe_enviada_at = now() where id = v_uid;
    end if;
  end if;

  -- Aviso por correo a quien revisa (lo envía la fase 7)
  insert into avisos (destinatario_id, canal, plantilla)
  select id, 'correo', 'admin_por_revisar_' || p_objeto from perfiles where es_admin and id <> v_uid;
  return 'pendiente';
end $$;

-- ---------------------------------------------------------------------
-- 5. Decisión del admin (con la regla de una INE = una cuenta)
-- ---------------------------------------------------------------------
create function decidir_verificacion(p_cuenta uuid, p_objeto text, p_decision estado_verif,
                                     p_nota text default null, p_clave_elector text default null)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_estado estado_verif; v_clave text; v_huella text;
begin
  if not es_admin() then raise exception 'Solo admin' using errcode = '42501'; end if;
  if p_decision not in ('aprobado','rechazado','info_requerida') then
    raise exception 'Decisión no válida' using errcode = 'P0001';
  end if;
  v_estado := case p_objeto
    when 'ine_tutor'    then (select estado_ine from tutores where id = p_cuenta)
    when 'alta_mvz'     then (select estado from mvz where id = p_cuenta)
    when 'especialidad' then (select estado_especialidad from mvz where id = p_cuenta)
    when 'clabe'        then (select estado_clabe from mvz where id = p_cuenta)
  end;
  if v_estado is null then raise exception 'Solicitud no encontrada' using errcode = 'P0001'; end if;
  if v_estado not in ('pendiente','en_revision') then
    raise exception 'Esta solicitud ya no está pendiente (estado: %)', v_estado using errcode = 'P0001';
  end if;

  if p_decision = 'aprobado' and p_objeto in ('ine_tutor','alta_mvz') then
    v_clave := upper(regexp_replace(coalesce(p_clave_elector, ''), '\s', '', 'g'));
    if v_clave !~ '^[A-Z]{6}[0-9]{8}[HM][0-9]{3}$' then
      raise exception 'Escribe la clave de elector de la INE (18 caracteres)' using errcode = 'P0001';
    end if;
    v_huella := encode(digest('lilievet-ine:' || v_clave, 'sha256'), 'hex');
    if exists (select 1 from perfiles where ine_huella = v_huella and id <> p_cuenta) then
      raise exception 'Esta INE ya está registrada en otra cuenta. No se puede aprobar.' using errcode = 'P0001';
    end if;
    update perfiles set ine_huella = v_huella where id = p_cuenta;
  end if;

  perform revisar_cuenta(p_cuenta, p_objeto, p_decision, p_nota);
end $$;

-- Documentos de una cuenta para revisarlos (queda registrado quién los abrió)
create function documentos_de_cuenta(p_cuenta uuid) returns setof documentos_verificacion
language plpgsql security definer set search_path = public as $$
begin
  if not es_admin() then raise exception 'Solo admin' using errcode = '42501'; end if;
  perform registrar_acceso('documentos_identidad', p_cuenta::text);
  return query select * from documentos_verificacion where cuenta_id = p_cuenta order by created_at desc;
end $$;

-- ---------------------------------------------------------------------
-- 6. Cola de revisión del Panel
-- ---------------------------------------------------------------------
create view cola_verificacion with (security_invoker = true) as
  with c as (
    select t.id as cuenta_id, 'ine_tutor'::text as objeto, t.estado_ine as estado,
           coalesce(t.ine_enviada_at, t.created_at) as enviado_at
      from tutores t where t.estado_ine in ('pendiente','en_revision')
    union all
    select m.id, 'alta_mvz', m.estado, coalesce(m.alta_enviada_at, m.created_at)
      from mvz m where m.estado in ('pendiente','en_revision')
    union all
    select m.id, 'especialidad', m.estado_especialidad, coalesce(m.especialidad_enviada_at, m.created_at)
      from mvz m where m.estado_especialidad in ('pendiente','en_revision') and m.estado <> 'sin_enviar'
    union all
    select m.id, 'clabe', m.estado_clabe, coalesce(m.clabe_enviada_at, m.created_at)
      from mvz m where m.estado_clabe in ('pendiente','en_revision') and m.estado <> 'sin_enviar'
  )
  select c.*, p.rol, p.nombre, p.apellidos, p.correo, p.telefono,
         (select min(r.inicia_at) from reservas r
           where r.tutor_id = c.cuenta_id and r.estado in ('confirmada','en_domicilio') and r.termina_at > now()) as proxima_consulta
  from c join perfiles p on p.id = c.cuenta_id;

-- ---------------------------------------------------------------------
-- 7. Permisos
-- ---------------------------------------------------------------------
grant select on cola_verificacion to authenticated;
grant execute on function enviar_verificacion(text),
  decidir_verificacion(uuid, text, estado_verif, text, text),
  documentos_de_cuenta(uuid), quitar_titulo(text), nombre_documento(text) to authenticated;

-- Archivos de identidad: hasta 10 MB, solo fotos y PDF (en Supabase)
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'storage' and table_name = 'buckets' and column_name = 'allowed_mime_types') then
    update storage.buckets set file_size_limit = 10485760,
           allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf']
     where id = 'identidad';
    update storage.buckets set file_size_limit = 5242880,
           allowed_mime_types = array['image/jpeg','image/png','image/webp']
     where id = 'perfiles';
  end if;
end $$;
