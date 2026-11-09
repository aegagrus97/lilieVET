-- =====================================================================
-- LilieVET · Fase 5: agenda del médico veterinario
-- Se corre DESPUÉS de schema.sql y fase3.sql. No borra datos ni tablas:
-- solo agrega reglas (triggers), una función y reemplaza bloques_disponibles.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Horario semanal: horas en punto, entre 06:00 y 22:00, en bloques completos
-- ---------------------------------------------------------------------
create or replace function agenda_valida() returns trigger
language plpgsql set search_path = public as $$
declare
  v_horas numeric := extract(epoch from (new.hora_fin - new.hora_inicio)) / 3600;
  v_bloque int := param('horas_bloque')::int;
begin
  if extract(minute from new.hora_inicio) <> 0 or extract(second from new.hora_inicio) <> 0
     or extract(minute from new.hora_fin) <> 0 or extract(second from new.hora_fin) <> 0 then
    raise exception 'El horario empieza y termina en punto (por ejemplo 9:00 o 15:00)' using errcode = 'P0001';
  end if;
  if new.hora_inicio < time '06:00' or new.hora_fin > time '22:00' then
    raise exception 'Puedes atender entre las 6:00 y las 22:00' using errcode = 'P0001';
  end if;
  if v_horas < v_bloque or mod(v_horas, v_bloque) <> 0 then
    raise exception 'El horario debe dar bloques completos de % horas', v_bloque using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists agenda_dias_valida on agenda_dias;
create trigger agenda_dias_valida before insert or update on agenda_dias
  for each row execute function agenda_valida();

-- ---------------------------------------------------------------------
-- 2. No se puede quitar un día ni cambiar su alcaldía u horario si eso deja
--    fuera una consulta ya apartada o pagada. Esa se cancela desde soporte.
-- ---------------------------------------------------------------------
create or replace function agenda_protege() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_n int;
  v_primera timestamptz;
begin
  select count(*), min(r.inicia_at) into v_n, v_primera
  from reservas r
  where r.mvz_id = old.mvz_id
    and r.estado in ('apartada', 'confirmada', 'en_domicilio')
    and r.termina_at > now()
    and extract(isodow from hora_cdmx(r.inicia_at)) = old.dia_semana
    and (tg_op = 'DELETE'
         or new.dia_semana <> old.dia_semana
         or r.alcaldia_id <> new.alcaldia_id
         or hora_cdmx(r.inicia_at)::time < new.hora_inicio
         or hora_cdmx(r.termina_at)::time > new.hora_fin);
  if v_n > 0 then
    raise exception 'Tienes % % ese día (la primera el %) que ya no cabría%. Cámbialo después de esa fecha o escribe a soporte',
      v_n, case when v_n = 1 then 'consulta' else 'consultas' end,
      to_char(hora_cdmx(v_primera), 'DD/MM/YYYY'), case when v_n = 1 then '' else 'n' end
      using errcode = 'P0003';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

drop trigger if exists agenda_dias_protege on agenda_dias;
create trigger agenda_dias_protege before update or delete on agenda_dias
  for each row execute function agenda_protege();

-- Guardar toda la semana de una vez (todo o nada). p_dias = [{dia_semana, alcaldia_id, hora_inicio, hora_fin}, …]
-- Los días que no vienen en la lista se quitan. Corre con los permisos del médico (RLS).
create or replace function guardar_agenda(p_dias jsonb) returns void
language plpgsql set search_path = public as $$
declare
  v_yo uuid := auth.uid();
  v_dias jsonb := coalesce(p_dias, '[]'::jsonb);
begin
  if v_yo is null or not exists (select 1 from mvz where id = v_yo) then
    raise exception 'Solo un médico veterinario puede guardar su agenda' using errcode = 'P0001';
  end if;
  if jsonb_typeof(v_dias) <> 'array' then
    raise exception 'Formato de agenda no válido' using errcode = 'P0001';
  end if;
  delete from agenda_dias
   where mvz_id = v_yo
     and dia_semana not in (select (e->>'dia_semana')::smallint from jsonb_array_elements(v_dias) e);
  insert into agenda_dias (mvz_id, dia_semana, alcaldia_id, hora_inicio, hora_fin)
  select v_yo, (e->>'dia_semana')::smallint, (e->>'alcaldia_id')::smallint, (e->>'hora_inicio')::time, (e->>'hora_fin')::time
    from jsonb_array_elements(v_dias) e
  on conflict (mvz_id, dia_semana) do update
     set alcaldia_id = excluded.alcaldia_id, hora_inicio = excluded.hora_inicio, hora_fin = excluded.hora_fin
   where (agenda_dias.alcaldia_id, agenda_dias.hora_inicio, agenda_dias.hora_fin)
         is distinct from (excluded.alcaldia_id, excluded.hora_inicio, excluded.hora_fin);
end $$;

-- ---------------------------------------------------------------------
-- 3. Días bloqueados: de hoy en adelante (hasta un año) y sin consultas ese día
-- ---------------------------------------------------------------------
create or replace function dia_bloqueado_valida() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_hoy date := (now() at time zone 'America/Mexico_City')::date;
  v_n int;
begin
  new.motivo := nullif(btrim(coalesce(new.motivo, '')), '');
  if new.motivo is not null and char_length(new.motivo) > 120 then
    raise exception 'El motivo es de máximo 120 caracteres' using errcode = 'P0001';
  end if;
  if new.dia < v_hoy then
    raise exception 'Ese día ya pasó' using errcode = 'P0001';
  end if;
  if new.dia > v_hoy + 366 then
    raise exception 'Puedes bloquear días hasta con un año de anticipación' using errcode = 'P0001';
  end if;
  select count(*) into v_n from reservas r
  where r.mvz_id = new.mvz_id
    and r.estado in ('apartada', 'confirmada', 'en_domicilio')
    and hora_cdmx(r.inicia_at)::date = new.dia;
  if v_n > 0 then
    raise exception 'El % tienes % %. Para no dejar a nadie sin atención, escribe a soporte',
      to_char(new.dia, 'DD/MM/YYYY'), v_n, case when v_n = 1 then 'consulta agendada' else 'consultas agendadas' end using errcode = 'P0003';
  end if;
  return new;
end $$;

drop trigger if exists dias_bloqueados_valida on dias_bloqueados;
create trigger dias_bloqueados_valida before insert or update on dias_bloqueados
  for each row execute function dia_bloqueado_valida();

-- ---------------------------------------------------------------------
-- 4. Catálogo de vacunas y desparasitantes
-- ---------------------------------------------------------------------
create or replace function catalogo_valida() returns trigger
language plpgsql set search_path = public as $$
begin
  new.nombre := btrim(regexp_replace(coalesce(new.nombre, ''), '\s+', ' ', 'g'));
  if char_length(new.nombre) < 2 or char_length(new.nombre) > 80 then
    raise exception 'Escribe el nombre del producto (de 2 a 80 caracteres)' using errcode = 'P0001';
  end if;
  if new.precio is null or new.precio < 1 or new.precio > 20000 then
    raise exception 'El precio debe estar entre $1 y $20,000' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and new.mvz_id <> old.mvz_id then
    raise exception 'No se puede mover un producto a otra cuenta' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists catalogo_mvz_valida on catalogo_mvz;
create trigger catalogo_mvz_valida before insert or update on catalogo_mvz
  for each row execute function catalogo_valida();

-- Quitar un producto: si ya se vendió en alguna reserva, se desactiva (para conservar el historial);
-- si nunca se usó, se borra. Devuelve 'borrado' o 'desactivado'.
create or replace function quitar_producto(p_id uuid) returns text
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from catalogo_mvz where id = p_id and mvz_id = auth.uid()) then
    raise exception 'Producto no encontrado' using errcode = 'P0001';
  end if;
  if exists (select 1 from reserva_productos where catalogo_id = p_id) then
    update catalogo_mvz set activo = false where id = p_id;
    return 'desactivado';
  end if;
  delete from catalogo_mvz where id = p_id;
  return 'borrado';
end $$;

-- ---------------------------------------------------------------------
-- 5. Bloques disponibles: igual que en la fase 1, más una regla:
--    para vacunación, el médico necesita al menos un producto activo en su catálogo.
-- ---------------------------------------------------------------------
create or replace function bloques_disponibles(p_alcaldia smallint, p_dia date, p_tipo tipo_consulta default 'general')
returns table (mvz_id uuid, inicia_at timestamptz, termina_at timestamptz, mismo_dia boolean,
               precio numeric, nombre text, foto_path text, calificacion numeric, especialidad text)
language sql stable security definer set search_path = public as $$
  with p as (
    select make_interval(hours => param('horas_bloque')::int) as dur,
           (now() at time zone 'America/Mexico_City')::date as hoy
  ),
  base as (
    select m.*, a.hora_inicio, a.hora_fin, pf.nombre || ' ' || pf.apellidos as nombre_mvz, e.nombre as esp
    from mvz m
    join perfiles pf on pf.id = m.id and not pf.suspendido
    join agenda_dias a on a.mvz_id = m.id
         and a.dia_semana = extract(isodow from p_dia) and a.alcaldia_id = p_alcaldia
    left join especialidades e on e.id = m.especialidad_id
    where m.estado = 'aprobado'
      and not exists (select 1 from dias_bloqueados d where d.mvz_id = m.id and d.dia = p_dia)
      and (p_tipo <> 'especialidad' or (m.especialidad_id is not null and m.estado_especialidad = 'aprobado'))
      and (p_tipo <> 'vacunacion' or exists (select 1 from catalogo_mvz c where c.mvz_id = m.id and c.activo))
  ),
  slots as (
    select b.*, t at time zone 'America/Mexico_City' as ini
    from base b, p,
         generate_series(p_dia + b.hora_inicio, p_dia + b.hora_fin - p.dur, p.dur) as t
  )
  select s.id, s.ini, s.ini + p.dur, p_dia = p.hoy,
         case p_tipo when 'general' then s.precio_general
                     when 'especialidad' then s.precio_especialidad
                     else null end
         * case when p_dia = p.hoy then 1 + param('recargo_mismo_dia') else 1 end,
         s.nombre_mvz, s.foto_path, s.calificacion_prom, s.esp
  from slots s, p
  where s.ini > now() + interval '30 minutes'
    and p_dia >= p.hoy
    and (p_dia > p.hoy or s.acepta_mismo_dia)
    and (p_tipo = 'vacunacion' or
         case p_tipo when 'general' then s.precio_general else s.precio_especialidad end is not null)
    and not exists (
      select 1 from reservas r
      where r.mvz_id = s.id
        and r.estado in ('apartada','confirmada','en_domicilio')
        and r.horario && tstzrange(s.ini, s.ini + p.dur, '[)'))
  order by s.ini, s.calificacion_prom desc nulls last
$$;

-- ---------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------
revoke all on function agenda_valida(), agenda_protege(), dia_bloqueado_valida(), catalogo_valida(), quitar_producto(uuid),
  guardar_agenda(jsonb) from public, anon;
grant execute on function quitar_producto(uuid), guardar_agenda(jsonb) to authenticated;
grant execute on function bloques_disponibles(smallint, date, tipo_consulta) to authenticated;
