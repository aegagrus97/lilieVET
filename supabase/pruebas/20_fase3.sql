-- Pruebas de la fase 3 (cuentas y verificación). Correr en una base con:
-- 00_supabase_shim.sql → schema.sql → fase3.sql → este archivo.
\set ON_ERROR_STOP 1
\pset format unaligned
\pset tuples_only on
set client_min_messages = warning;

create function public.como(p_uid uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), false); end $$;
create function public.debe_fallar(p_sql text, p_que text) returns void language plpgsql as $$
begin
  begin execute p_sql; exception when others then raise notice 'OK (bloqueado) %: %', p_que, sqlerrm; return; end;
  raise exception 'FALLA: debió bloquearse -> %', p_que;
end $$;
create function public.debe(p_cond boolean, p_que text) returns void language plpgsql as $$
begin
  if p_cond is distinct from true then raise exception 'FALLA: %', p_que; end if;
  raise notice 'OK %', p_que;
end $$;
grant execute on function public.como(uuid), public.debe_fallar(text, text), public.debe(boolean, text) to authenticated, service_role;
create function pg_temp.sube(p_uid uuid, p_tipo text) returns void language sql as $$
  insert into storage.objects (bucket_id, name) values ('identidad', p_uid::text || '/' || p_tipo || '.jpg');
  insert into documentos_verificacion (cuenta_id, tipo, ruta, tipo_mime, bytes)
  values (p_uid, p_tipo, 'identidad/' || p_uid::text || '/' || p_tipo || '.jpg', 'image/jpeg', 350000);
$$;
set client_min_messages = notice;

-- Títulos -------------------------------------------------------------
select debe(quitar_titulo('Dra. Paola') = 'Paola' and quitar_titulo('dr Luis') = 'Luis'
            and quitar_titulo('MVZ. Ana María') = 'Ana María' and quitar_titulo('M.V.Z. Kat') = 'Kat'
            and quitar_titulo('Draco') = 'Draco' and quitar_titulo('Drew') = 'Drew', 'quita títulos sin tocar nombres');

insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000a1', 'paola@lv.mx', '{"rol":"mvz","nombre":"Dra. Paola","apellidos":"Núñez Rivas","telefono":"5512345678"}'),
 ('00000000-0000-0000-0000-0000000000b1', 'sofia@x.mx', '{"rol":"tutor","nombre":"Sofía","apellidos":"Hernández"}'),
 ('00000000-0000-0000-0000-0000000000b2', 'jorge@x.mx', '{"rol":"tutor","nombre":"Jorge","apellidos":"Ramírez"}'),
 ('00000000-0000-0000-0000-0000000000ad', 'admin@lv.mx', '{"rol":"mvz","nombre":"Kat","apellidos":"Moctezuma"}');
select crear_admin('admin@lv.mx');
select debe((select nombre = 'Paola' from perfiles where id = '00000000-0000-0000-0000-0000000000a1'), 'el registro guarda el nombre sin "Dra."');
select debe((select estado = 'sin_enviar' from mvz where id = '00000000-0000-0000-0000-0000000000a1'), 'MVZ nuevo empieza sin enviar');
select debe((select count(*) = 0 from cola_verificacion), 'cola vacía mientras nadie envía');

-- Alta de MVZ -----------------------------------------------------------
set role authenticated;
select como('00000000-0000-0000-0000-0000000000a1');
select debe_fallar($$select enviar_verificacion('alta_mvz')$$, 'enviar alta sin documentos');
select pg_temp.sube(auth.uid(), 'ine_frente');
select pg_temp.sube(auth.uid(), 'ine_reverso');
select pg_temp.sube(auth.uid(), 'selfie_ine');
select debe((select estado = 'sin_enviar' from mvz where id = auth.uid()), 'subir archivos no manda a revisión por sí solo');
select debe_fallar($$select enviar_verificacion('alta_mvz')$$, 'falta la cédula escaneada');
select pg_temp.sube(auth.uid(), 'cedula');
select debe_fallar($$select enviar_verificacion('alta_mvz')$$, 'falta el número de cédula');
update mvz set cedula = '12345678', bio = 'Medicina preventiva de perros y gatos.' where id = auth.uid();
update perfiles set nombre = 'Dr. Paola' where id = auth.uid();
select debe((select nombre = 'Paola' from perfiles where id = auth.uid()), 'al editar tampoco se guarda el título');
select enviar_verificacion('alta_mvz');
select debe((select estado = 'pendiente' and alta_enviada_at is not null from mvz where id = auth.uid()), 'alta enviada queda pendiente');
select debe_fallar($$select enviar_verificacion('alta_mvz')$$, 'no se envía dos veces');
select debe_fallar($$update mvz set cedula = '87654321' where id = auth.uid()$$, 'cédula fija después de enviar');
select debe_fallar($$update perfiles set apellidos = 'Otro' where id = auth.uid()$$, 'nombre fijo después de enviar');
select debe((select count(*) = 1 from cola_verificacion), 'el MVZ ve solo su propia fila de la cola');

-- Especialidad
select debe_fallar($$select enviar_verificacion('especialidad')$$, 'especialidad sin elegir');
update mvz set especialidad_id = (select id from especialidades where nombre = 'Dermatología') where id = auth.uid();
select debe_fallar($$select enviar_verificacion('especialidad')$$, 'especialidad sin documento');
select pg_temp.sube(auth.uid(), 'especialidad');
select enviar_verificacion('especialidad');
select debe((select estado_especialidad = 'pendiente' from mvz where id = auth.uid()), 'especialidad enviada');

-- CLABE
update mvz set banco = 'BBVA', clabe = '012180001234567891', titular_clabe = 'Paola Núñez Rivas' where id = auth.uid();
select debe_fallar($$select enviar_verificacion('clabe')$$, 'CLABE sin estado de cuenta');
select pg_temp.sube(auth.uid(), 'estado_cuenta');
select enviar_verificacion('clabe');
select debe((select estado_clabe = 'pendiente' from mvz where id = auth.uid()), 'CLABE enviada');
update mvz set clabe = '012180009999999999' where id = auth.uid();
select debe((select estado_clabe = 'sin_enviar' and clabe_enviada_at is null from mvz where id = auth.uid()), 'cambiar la CLABE la saca de revisión');
select enviar_verificacion('clabe');
select debe_fallar($$update mvz set estado = 'aprobado' where id = auth.uid()$$, 'el MVZ no se aprueba solo');

-- Tutores ---------------------------------------------------------------
select como('00000000-0000-0000-0000-0000000000b1');
select pg_temp.sube(auth.uid(), 'ine_frente');
select debe_fallar($$select enviar_verificacion('ine_tutor')$$, 'INE incompleta');
select pg_temp.sube(auth.uid(), 'ine_reverso');
select pg_temp.sube(auth.uid(), 'selfie_ine');
select debe_fallar($$select enviar_verificacion('alta_mvz')$$, 'un tutor no envía alta de MVZ');
select enviar_verificacion('ine_tutor');
select debe((select estado_ine = 'pendiente' from tutores where id = auth.uid()), 'INE del tutor pendiente');
select debe_fallar($$select documentos_de_cuenta('00000000-0000-0000-0000-0000000000a1')$$, 'un tutor no abre documentos ajenos');
select debe_fallar($$select decidir_verificacion(auth.uid(), 'ine_tutor', 'aprobado', null, 'LOPZMR90010109M800')$$, 'un tutor no se aprueba solo');
select debe((select count(*) = 0 from documentos_verificacion where cuenta_id <> auth.uid()), 'el tutor no ve documentos de otros');

select como('00000000-0000-0000-0000-0000000000b2');
select pg_temp.sube(auth.uid(), 'ine_frente');
select pg_temp.sube(auth.uid(), 'ine_reverso');
select pg_temp.sube(auth.uid(), 'selfie_ine');
select enviar_verificacion('ine_tutor');

-- Panel -----------------------------------------------------------------
select como('00000000-0000-0000-0000-0000000000ad');
select debe((select count(*) = 5 from cola_verificacion), 'la cola tiene alta, especialidad, CLABE y dos INE');
select debe((select count(*) = 6 from documentos_de_cuenta('00000000-0000-0000-0000-0000000000a1')), 'admin abre los documentos del MVZ');
select debe((select count(*) = 1 from registro_accesos where objeto = 'documentos_identidad'), 'queda registrado quién abrió los documentos');
select debe_fallar($$select decidir_verificacion('00000000-0000-0000-0000-0000000000b1', 'ine_tutor', 'aprobado')$$, 'aprobar INE sin clave de elector');
select debe_fallar($$select decidir_verificacion('00000000-0000-0000-0000-0000000000b1', 'ine_tutor', 'aprobado', null, 'ABC123')$$, 'clave de elector con formato inválido');
select decidir_verificacion('00000000-0000-0000-0000-0000000000b1', 'ine_tutor', 'aprobado', null, 'hrndsf90010109m800');
select debe((select estado_ine = 'aprobado' from tutores where id = '00000000-0000-0000-0000-0000000000b1'), 'INE aprobada');
select debe((select ine_huella is not null and ine_huella !~* 'HRNDSF' from perfiles where id = '00000000-0000-0000-0000-0000000000b1'),
            'se guarda la huella, no la clave');
select debe_fallar($$select decidir_verificacion('00000000-0000-0000-0000-0000000000b2', 'ine_tutor', 'aprobado', null, 'HRNDSF90010109M800')$$,
                   'una INE = una cuenta');
select debe_fallar($$select decidir_verificacion('00000000-0000-0000-0000-0000000000b2', 'ine_tutor', 'info_requerida')$$, 'pedir corrección sin nota');
select decidir_verificacion('00000000-0000-0000-0000-0000000000b2', 'ine_tutor', 'info_requerida', 'La selfie salió borrosa. Tómala con buena luz.');
select debe_fallar($$select decidir_verificacion('00000000-0000-0000-0000-0000000000b1', 'ine_tutor', 'rechazado', 'x')$$, 'no se decide dos veces');
select decidir_verificacion('00000000-0000-0000-0000-0000000000a1', 'alta_mvz', 'aprobado', null, 'NZRVPL88050509M100');
select decidir_verificacion('00000000-0000-0000-0000-0000000000a1', 'especialidad', 'aprobado');
select decidir_verificacion('00000000-0000-0000-0000-0000000000a1', 'clabe', 'rechazado', 'El titular no coincide con tu nombre.');
select debe((select estado = 'aprobado' and estado_especialidad = 'aprobado' and estado_clabe = 'rechazado'
             from mvz where id = '00000000-0000-0000-0000-0000000000a1'), 'decisiones del MVZ guardadas');
select debe((select count(*) = 0 from cola_verificacion), 'en la cola ya no queda nada resuelto');
select debe((select count(*) = 5 from revisiones), 'historial con cada decisión');
select debe((select count(*) = 5 from avisos where plantilla like 'revision_%'), 'cada decisión deja un correo para la persona');
select debe((select count(*) = 1 from mvz_publicos where especialidad = 'Dermatología'), 'MVZ aprobado aparece con su especialidad');

-- Correcciones -----------------------------------------------------------
select como('00000000-0000-0000-0000-0000000000b2');
select debe((select nota is not null from revisiones where cuenta_id = auth.uid() order by created_at desc limit 1), 'el tutor ve la nota de corrección');
update perfiles set apellidos = 'Ramírez Soto' where id = auth.uid();
select debe((select apellidos = 'Ramírez Soto' from perfiles where id = auth.uid()), 'con corrección pedida puede ajustar su nombre');
select pg_temp.sube(auth.uid(), 'selfie_ine');
select enviar_verificacion('ine_tutor');
select debe((select estado_ine = 'pendiente' from tutores where id = auth.uid()), 'reenviada tras la corrección');
select como('00000000-0000-0000-0000-0000000000a1');
select debe_fallar($$update perfiles set nombre = 'Otra' where id = auth.uid()$$, 'MVZ aprobado no cambia su nombre');
update mvz set especialidad_id = (select id from especialidades where nombre = 'Oftalmología') where id = auth.uid();
select debe((select estado_especialidad = 'sin_enviar' from mvz where id = auth.uid()), 'cambiar de especialidad pide revisión de nuevo');
reset role;
