-- =====================================================================
-- LilieVET · base de datos para Supabase
-- Cómo usarlo: Supabase > SQL Editor > New query > pega TODO este
-- archivo > Run. Se puede volver a correr cuando haya una versión nueva:
-- no borra datos.
--
-- Idea general
-- - Cada registro de la app (tutor, mascota, consulta, aviso, pago...)
--   se guarda como un documento JSON en la tabla lv_docs.
-- - Nadie lee ni escribe la tabla directamente: todo pasa por las
--   funciones lv_load (leer) y lv_save (guardar), que deciden quién ve
--   y quién cambia cada cosa:
--     · El tutor ve lo suyo (su cuenta, mascotas, consultas, pagos).
--     · El médico veterinario ve las consultas que le llegaron y los
--       datos del tutor y la mascota de esas consultas (sin INE,
--       tarjetas ni datos fiscales).
--     · Todos ven los perfiles públicos de los médicos veterinarios
--       (sin cuenta bancaria, RFC, INE ni cédula escaneada).
--     · La cuenta admin (Kat) ve y cambia todo para revisar.
--   Las revisiones (INE de tutores, cédula de MVZ, cuentas CLABE) solo
--   las puede marcar como aprobadas la cuenta admin.
-- =====================================================================

-- ---------- Tablas ----------
create table if not exists public.lv_accounts (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       text not null check (role in ('pp', 'mvz')),   -- pp = tutor
  entity_id  text not null unique,                          -- id del tutor o MVZ dentro de la app
  is_admin   boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.lv_docs (
  coll       text not null,
  id         text not null,
  data       jsonb not null default '{}'::jsonb,
  rev        integer not null default 1,
  deleted    boolean not null default false,
  readers    text[] not null default '{}',
  writers    text[] not null default '{}',
  updated_at timestamptz not null default clock_timestamp(),
  updated_by uuid,
  created_at timestamptz not null default now(),
  primary key (coll, id)
);
create index if not exists lv_docs_updated on public.lv_docs (updated_at);
create index if not exists lv_docs_readers on public.lv_docs using gin (readers);
create index if not exists lv_docs_owner on public.lv_docs ((data->>'ownerId'));

alter table public.lv_accounts enable row level security;
alter table public.lv_docs enable row level security;
-- Sin políticas: el acceso directo queda cerrado. Solo las funciones de abajo entran.
revoke all on table public.lv_docs, public.lv_accounts from anon, authenticated;

-- ---------- Utilidades ----------
create or replace function public.lv_arr(j jsonb) returns text[]
language sql immutable set search_path = public as $$
  select coalesce(array_agg(x), '{}') from jsonb_array_elements_text(
    case when jsonb_typeof(j) = 'array' then j else '[]'::jsonb end) x
$$;

create or replace function public.lv_clean(a text[]) returns text[]
language sql immutable set search_path = public as $$
  select coalesce(array_agg(distinct x), '{}') from unnest(a) x where x is not null and x <> ''
$$;

-- Quién lee (readers) y quién escribe (writers) cada documento, según su contenido.
-- '*' en readers = público.
create or replace function public.lv_keys(p_coll text, p_id text, d jsonb, out readers text[], out writers text[])
language plpgsql immutable set search_path = public as $$
begin
  case p_coll
    when 'owners'    then readers := array[p_id]; writers := readers;
    when 'pets'      then readers := array[d->>'ownerId']; writers := readers;
    when 'requests'  then
      readers := array[d->>'ownerId', d->>'mvzId', d#>>'{offer,mvzId}', d#>>'{special,by}', d#>>'{search,takenBy}']
        || lv_arr(d->'queue') || lv_arr(d#>'{search,ids}')
        || coalesce((select array_agg(a->>'mvzId') from jsonb_array_elements(
             case when jsonb_typeof(d->'attempts') = 'array' then d->'attempts' else '[]'::jsonb end) a), '{}');
      writers := readers;
    when 'notifs'    then readers := array[d->>'to']; writers := readers;
    when 'mvzs'      then readers := array['*', p_id]; writers := array[p_id];
    when 'referrals' then readers := array[d->>'from', d->>'toId']; writers := readers;
    when 'rewards'   then readers := array[d->>'who']; writers := readers;
    when 'payments'  then readers := array[d->>'ownerId', d->>'mvzId']; writers := readers;
    when 'reports'   then readers := array[d->>'by']; writers := readers;
    when 'invoices'  then readers := array[d->>'ownerId', d->>'mvzId']; writers := array[d->>'ownerId'];
    when 'disputes'  then readers := array[d->>'mvzId']; writers := readers;
    when 'global'    then
      readers := case when p_id in ('params', 'legal') then array['*'] else '{}'::text[] end;
      writers := '{}';
    else readers := '{}'; writers := '{}';
  end case;
  readers := lv_clean(readers);
  writers := lv_clean(writers);
end $$;

-- ¿El MVZ (viewer) tiene alguna consulta con este tutor? Le da acceso a sus datos y mascotas.
create or replace function public.lv_linked(viewer text, owner_id text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from lv_docs q where q.coll = 'requests' and not q.deleted
                 and q.data->>'ownerId' = owner_id and viewer = any(q.readers))
$$;

-- ¿El MVZ tiene una visita aceptada con este tutor? Solo entonces ve su celular.
create or replace function public.lv_visit_with(mvz text, owner_id text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from lv_docs q where q.coll = 'requests' and not q.deleted
                 and q.data->>'ownerId' = owner_id and q.data->>'mvzId' = mvz
                 and q.data->>'status' in ('confirmada', 'en_camino', 'en_consulta', 'cambio_por_aprobar', 'costo_ajustado', 'por_pagar'))
$$;

-- Lo que ve cada quien de un documento
create or replace function public.lv_project(p_coll text, p_id text, d jsonb, ent text, adm boolean) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if adm then return d; end if;
  if p_coll = 'owners' and p_id is distinct from ent then
    return (d - array['email', 'pw', 'cards', 'card', 'fiscal', 'addresses', 'legal', 'referredBy', 'ine', 'phone'])
      || jsonb_build_object('ine', jsonb_build_object('status', d#>'{ine,status}'))
      || jsonb_build_object('phone', case when lv_visit_with(ent, p_id) then coalesce(d->'phone', '""'::jsonb) else '""'::jsonb end);
  end if;
  if p_coll = 'mvzs' and p_id is distinct from ent then
    return (d - array['email', 'pw', 'bank', 'fiscal', 'verif', 'legal', 'ine', 'phone', 'notifPrefs'])
      || jsonb_build_object('phone', case when ent is not null and lv_visit_with(p_id, ent) then coalesce(d->'phone', '""'::jsonb) else '""'::jsonb end);
  end if;
  return d;
end $$;

-- Campos que solo cambia la cuenta admin o que no se ven desde fuera
create or replace function public.lv_keep(old jsonb, nd jsonb, keys text[]) returns jsonb
language sql immutable set search_path = public as $$
  select (nd - keys) || coalesce((select jsonb_object_agg(k, old->k) from unnest(keys) k where old ? k), '{}'::jsonb)
$$;

create or replace function public.lv_protect(p_coll text, p_id text, old jsonb, nd jsonb, ent text, adm boolean) returns jsonb
language plpgsql stable set search_path = public as $$
declare
  o_st text; n_st text;
begin
  if adm then return nd; end if;
  if p_coll = 'owners' then
    if p_id is distinct from ent then
      -- Un MVZ con consulta guarda cambios (p. ej. saldo): no puede tocar lo que no ve
      return lv_keep(old, nd, array['email', 'pw', 'cards', 'card', 'fiscal', 'addresses', 'legal', 'referredBy', 'ine', 'phone', 'suspended', 'name', 'status']);
    end if;
    nd := lv_keep(old, nd, array['suspended']);
    o_st := old#>>'{ine,status}'; n_st := nd#>>'{ine,status}';
    -- El tutor solo puede mandar su INE a revisión; aprobarla o rechazarla lo hace LilieVET
    if n_st is distinct from o_st and coalesce(n_st, '') not in ('en_revision', 'sin_enviar') then
      nd := jsonb_set(nd, '{ine}', coalesce(nd->'ine', '{}'::jsonb) || jsonb_build_object(
        'status', old#>'{ine,status}', 'reviewedAt', old#>'{ine,reviewedAt}', 'reviewedBy', old#>'{ine,reviewedBy}', 'note', old#>'{ine,note}'));
    end if;
    return nd;
  end if;
  if p_coll = 'mvzs' then
    nd := lv_keep(old, nd, array['suspended']);
    o_st := old->>'status'; n_st := nd->>'status';
    -- Aprobar la cuenta lo hace LilieVET; el MVZ solo puede darse de baja o reenviar tras una corrección
    if n_st is distinct from o_st and not (n_st = 'baja' or (o_st = 'correccion' and n_st = 'pendiente')) then
      nd := jsonb_set(nd, '{status}', coalesce(old->'status', 'null'::jsonb));
    end if;
    if (nd ? 'verif') and (old ? 'verif') then
      nd := jsonb_set(nd, '{verif}', (nd->'verif') || coalesce((select jsonb_object_agg(k, old#>array['verif', k]) from unnest(array['reviewedBy', 'reviewedAt', 'approvedAt']) k where (old->'verif') ? k), '{}'::jsonb));
    end if;
    -- La CLABE la verifica LilieVET
    o_st := old#>>'{bank,status}'; n_st := nd#>>'{bank,status}';
    if n_st is distinct from o_st and coalesce(n_st, '') <> 'en_revision' and nd ? 'bank' and jsonb_typeof(nd->'bank') = 'object' then
      nd := jsonb_set(nd, '{bank,status}', coalesce(old#>'{bank,status}', '"en_revision"'::jsonb));
    end if;
    return nd;
  end if;
  return nd;
end $$;

-- ---------- Cuenta actual ----------
create or replace function public.lv_me() returns public.lv_accounts
language sql stable security definer set search_path = public as $$
  select * from lv_accounts where user_id = auth.uid()
$$;

-- ---------- Leer ----------
-- p_since = null: todo lo que la cuenta puede ver. Con fecha: solo lo que cambió desde entonces.
create or replace function public.lv_load(p_since timestamptz default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  me lv_accounts; ent text; adm boolean := false; docs jsonb; pub jsonb; t timestamptz := clock_timestamp();
begin
  me := lv_me();
  ent := me.entity_id; adm := coalesce(me.is_admin, false);

  with vis as (
    select d.* from lv_docs d
    where (p_since is null or d.updated_at > p_since)
      and (adm or '*' = any(d.readers) or (ent is not null and ent = any(d.readers))
           or (ent is not null and d.coll in ('owners', 'pets')
               and lv_linked(ent, case when d.coll = 'owners' then d.id else d.data->>'ownerId' end)))
    union
    -- Tutores y mascotas que se volvieron visibles porque llegó una consulta nueva
    select d.* from lv_docs d
    where p_since is not null and ent is not null and not adm and d.coll in ('owners', 'pets') and not d.deleted
      and exists (select 1 from lv_docs q where q.coll = 'requests' and q.updated_at > p_since and ent = any(q.readers)
                  and q.data->>'ownerId' = case when d.coll = 'owners' then d.id else d.data->>'ownerId' end)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'c', v.coll, 'i', v.id, 'r', v.rev, 'x', v.deleted,
           'w', adm or (ent is not null and (ent = any(v.writers) or (v.coll in ('owners', 'pets') and not (ent = any(v.readers))))),
           'd', case when v.deleted then null else lv_project(v.coll, v.id, v.data, ent, adm) end)), '[]'::jsonb)
    into docs from vis v;

  -- Resumen público de consultas de otros tutores: sirve para calificaciones, reseñas y agenda ocupada de cada MVZ
  if ent is not null and not adm then
    select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
             'id', q.id, 'mvzId', q.data->'mvzId', 'ownerId', q.data->'ownerId', 'status', q.data->'status',
             'visitDate', q.data->'visitDate', 'window', q.data->'window', 'windows', q.data->'windows', 'service', q.data->'service',
             'createdAt', q.data->'createdAt', 'rating', q.data->'rating', 'ratedAt', q.data->'ratedAt',
             'review', case when q.data ? 'review' then jsonb_build_object('text', q.data#>'{review,text}', 'at', q.data#>'{review,at}', 'hidden', q.data#>'{review,hidden}', 'reply', q.data#>'{review,reply}') end,
             'tutorRating', q.data->'tutorRating', 'acceptedAt', q.data->'acceptedAt', 'petId', q.data->'petId', 'petIds', q.data->'petIds',
             'address', case when q.data ? 'address' then jsonb_build_object('calle', '', 'colonia', q.data#>'{address,colonia}', 'alcaldia', q.data#>'{address,alcaldia}') end,
             'bill', case when q.data ? 'bill' then jsonb_build_object('paid', q.data#>'{bill,paid}') end,
             'who', (select split_part(o.data->>'name', ' ', 1) || coalesce(' ' || nullif(left(split_part(o.data->>'name', ' ', 2), 1), '') || '.', '')
                     from lv_docs o where o.coll = 'owners' and o.id = q.data->>'ownerId'),
             '_stub', true))), '[]'::jsonb)
      into pub from lv_docs q
      where q.coll = 'requests' and not q.deleted and q.data->>'mvzId' is not null
        and not (ent = any(q.readers))
        and (p_since is null or q.updated_at > p_since);
  end if;

  return jsonb_build_object('docs', docs, 'pub', coalesce(pub, '[]'::jsonb), 'now', t,
    'me', case when me.user_id is null then null else jsonb_build_object('role', me.role, 'entity_id', me.entity_id, 'is_admin', me.is_admin) end);
end $$;

-- ---------- Guardar ----------
-- p_changes: [{c, i, r (versión que tenía el teléfono; 0 = nuevo), d (datos), x (true = borrar)}]
create or replace function public.lv_save(p_changes jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  me lv_accounts; ent text; adm boolean := false;
  ch jsonb; c text; i text; base int; del boolean; nd jsonb; orig jsonb; cur lv_docs; k record; ok_writer boolean;
  oks jsonb := '[]'::jsonb; conflicts jsonb := '[]'::jsonb; denied jsonb := '[]'::jsonb;
  allowed text[] := array['owners', 'pets', 'requests', 'notifs', 'mvzs', 'referrals', 'rewards', 'payments', 'reports', 'invoices', 'disputes', 'global'];
  owner_of text;
begin
  me := lv_me();
  if me.user_id is null then raise exception 'sin_cuenta' using errcode = '28000'; end if;
  ent := me.entity_id; adm := me.is_admin;

  for ch in select * from jsonb_array_elements(coalesce(p_changes, '[]'::jsonb)) loop
    c := ch->>'c'; i := ch->>'i'; base := coalesce((ch->>'r')::int, 0); del := coalesce((ch->>'x')::boolean, false); nd := ch->'d';
    if c is null or i is null or not (c = any(allowed)) or (not del and (nd is null or jsonb_typeof(nd) <> 'object')) then
      denied := denied || jsonb_build_object('c', c, 'i', i); continue;
    end if;
    if not del and c <> 'global' then nd := jsonb_set(nd, '{id}', to_jsonb(i)); end if;
    orig := nd;

    select * into cur from lv_docs where coll = c and id = i for update;

    if not found then
      -- Documento nuevo
      if del then oks := oks || jsonb_build_object('c', c, 'i', i, 'r', 0, 'x', true); continue; end if;
      select * into k from lv_keys(c, i, nd);
      if not (adm or (c not in ('owners', 'mvzs', 'global') and (ent = any(k.writers) or c in ('notifs', 'rewards', 'referrals')))) then
        denied := denied || jsonb_build_object('c', c, 'i', i); continue;
      end if;
      insert into lv_docs (coll, id, data, rev, readers, writers, updated_by)
        values (c, i, nd, 1, k.readers, k.writers, auth.uid());
      oks := oks || jsonb_build_object('c', c, 'i', i, 'r', 1);
      continue;
    end if;

    owner_of := case when c = 'owners' then cur.id when c = 'pets' then cur.data->>'ownerId' end;
    ok_writer := adm or ent = any(cur.writers)
      or (c in ('owners', 'pets') and lv_linked(ent, owner_of));

    if not ok_writer then
      denied := denied || jsonb_build_object('c', c, 'i', i, 'r', cur.rev, 'x', cur.deleted,
        'd', case when cur.deleted or not (adm or '*' = any(cur.readers) or ent = any(cur.readers)) then null else lv_project(c, i, cur.data, ent, adm) end);
      continue;
    end if;

    if cur.rev <> base then
      conflicts := conflicts || jsonb_build_object('c', c, 'i', i, 'r', cur.rev, 'x', cur.deleted,
        'd', case when cur.deleted then null else lv_project(c, i, cur.data, ent, adm) end);
      continue;
    end if;

    if del then
      if not adm and c in ('owners', 'mvzs', 'global', 'payments') then
        denied := denied || jsonb_build_object('c', c, 'i', i, 'r', cur.rev, 'd', lv_project(c, i, cur.data, ent, adm)); continue;
      end if;
      update lv_docs set deleted = true, rev = rev + 1, updated_at = clock_timestamp(), updated_by = auth.uid()
        where coll = c and id = i;
      oks := oks || jsonb_build_object('c', c, 'i', i, 'r', cur.rev + 1, 'x', true);
      continue;
    end if;

    -- Una mascota no puede cambiar de dueño (salvo admin)
    if not adm and c = 'pets' and nd->>'ownerId' is distinct from cur.data->>'ownerId' then
      nd := jsonb_set(nd, '{ownerId}', cur.data->'ownerId');
    end if;
    nd := lv_protect(c, i, cur.data, nd, ent, adm);
    select * into k from lv_keys(c, i, nd);
    -- Quien guarda tiene que seguir teniendo acceso (evita "regalar" una consulta a otro tutor)
    if not adm and c not in ('owners', 'pets') and not (ent = any(k.writers)) then
      denied := denied || jsonb_build_object('c', c, 'i', i, 'r', cur.rev, 'd', lv_project(c, i, cur.data, ent, adm)); continue;
    end if;
    update lv_docs set data = nd, rev = rev + 1, deleted = false, readers = k.readers, writers = k.writers,
      updated_at = clock_timestamp(), updated_by = auth.uid()
      where coll = c and id = i;
    oks := oks || jsonb_build_object('c', c, 'i', i, 'r', cur.rev + 1,
      'd', case when nd is distinct from orig then lv_project(c, i, nd, ent, adm) end);
  end loop;

  return jsonb_build_object('ok', oks, 'conflicts', conflicts, 'denied', denied);
end $$;

-- ---------- Registro ----------
-- Se llama justo después de crear el usuario en Supabase Auth. p_doc es el registro del tutor o MVZ.
create or replace function public.lv_register(p_role text, p_doc jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); eid text := p_doc->>'id'; c text; d jsonb; k record; em text;
begin
  if uid is null then raise exception 'sin_sesion' using errcode = '28000'; end if;
  if exists (select 1 from lv_accounts where user_id = uid) then
    return jsonb_build_object('entity_id', (select entity_id from lv_accounts where user_id = uid), 'ya', true);
  end if;
  if p_role not in ('pp', 'mvz') then raise exception 'rol_invalido'; end if;
  if eid is null or eid !~ '^[a-z][a-z0-9]{5,24}$' then raise exception 'id_invalido'; end if;
  c := case when p_role = 'pp' then 'owners' else 'mvzs' end;
  if exists (select 1 from lv_docs where coll = c and id = eid) then raise exception 'id_ocupado'; end if;
  select email into em from auth.users where id = uid;

  d := (p_doc - array['pw', 'suspended']) || jsonb_build_object('id', eid, 'email', coalesce(em, p_doc->>'email'));
  if p_role = 'pp' then
    d := jsonb_set(d, '{ine}', coalesce(d->'ine', '{}'::jsonb) || jsonb_build_object('status',
      case when d#>>'{ine,status}' = 'en_revision' then 'en_revision' else 'sin_enviar' end));
  else
    d := d || jsonb_build_object('status', 'pendiente');
  end if;

  select * into k from lv_keys(c, eid, d);
  insert into lv_docs (coll, id, data, rev, readers, writers, updated_by) values (c, eid, d, 1, k.readers, k.writers, uid);
  insert into lv_accounts (user_id, role, entity_id) values (uid, p_role, eid);
  return jsonb_build_object('entity_id', eid);
end $$;

-- Busca a quien invitó por su código (antes de crear la cuenta)
create or replace function public.lv_ref_lookup(p_kind text, p_code text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', id, 'name', data->>'name') from lv_docs
  where coll = case when p_kind = 'mvz' then 'mvzs' else 'owners' end and not deleted
    and upper(data->>'refCode') = upper(trim(p_code))
  limit 1
$$;

-- Eliminar la cuenta: la app ya borró los datos personales del registro; aquí se borra el acceso
create or replace function public.lv_close_account() returns void
language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return; end if;
  delete from lv_accounts where user_id = uid;
  delete from auth.users where id = uid;
end $$;

-- ---------- Solo para Kat (se corre desde el SQL Editor, no desde la app) ----------
-- select lv_make_admin('tu-correo@ejemplo.com');
create or replace function public.lv_make_admin(p_email text) returns text
language plpgsql volatile security definer set search_path = public as $$
declare n int;
begin
  update lv_accounts set is_admin = true
    where user_id = (select id from auth.users where lower(email) = lower(trim(p_email)));
  get diagnostics n = row_count;
  return case when n = 1 then 'Listo: ' || p_email || ' ya es admin.' else 'No encontré una cuenta registrada en la app con ese correo.' end;
end $$;

-- ---------- Permisos ----------
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.lv_load(timestamptz) to anon, authenticated;
grant execute on function public.lv_ref_lookup(text, text) to anon, authenticated;
grant execute on function public.lv_save(jsonb) to authenticated;
grant execute on function public.lv_register(text, jsonb) to authenticated;
grant execute on function public.lv_close_account() to authenticated;
