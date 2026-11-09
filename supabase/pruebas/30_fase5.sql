-- Pruebas de la fase 5 (agenda del médico veterinario). Correr en una base con:
-- 00_supabase_shim.sql → schema.sql → fase3.sql → fase5.sql → este archivo.
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
set client_min_messages = notice;

insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000a1', 'ana@lv.mx',  '{"rol":"mvz","nombre":"Ana","apellidos":"Ruiz"}'),
 ('00000000-0000-0000-0000-0000000000a2', 'luis@lv.mx', '{"rol":"mvz","nombre":"Luis","apellidos":"Pérez"}'),
 ('00000000-0000-0000-0000-0000000000b1', 'sofia@x.mx', '{"rol":"tutor","nombre":"Sofía","apellidos":"Hernández"}');
update mvz set estado = 'aprobado', precio_general = 600 where id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2');

-- Fecha del martes de la próxima semana (CDMX) y su día de la semana
select set_config('lv.martes', (((now() at time zone 'America/Mexico_City')::date + 7
        - extract(isodow from (now() at time zone 'America/Mexico_City')::date)::int + 2))::text, false);
select set_config('lv.hoy', ((now() at time zone 'America/Mexico_City')::date)::text, false);

-- Horario semanal ----------------------------------------------------------
set role authenticated;
select como('00000000-0000-0000-0000-0000000000a1');
insert into agenda_dias values (auth.uid(), 2, 3, '09:00', '15:00');
select debe((select count(*) = 3 from bloques_disponibles(3::smallint, current_setting('lv.martes')::date)), 'martes 9 a 15 = 3 bloques');
select debe_fallar($$insert into agenda_dias values (auth.uid(), 3, 3, '09:30', '15:30')$$, 'horario que no empieza en punto');
select debe_fallar($$insert into agenda_dias values (auth.uid(), 3, 3, '09:00', '14:00')$$, 'horario con medio bloque');
select debe_fallar($$insert into agenda_dias values (auth.uid(), 3, 3, '05:00', '09:00')$$, 'antes de las 6:00');
select debe_fallar($$insert into agenda_dias values (auth.uid(), 3, 3, '20:00', '23:00')$$, 'después de las 22:00');
select debe_fallar($$insert into agenda_dias values (auth.uid(), 3, 3, '10:00', '10:00')$$, 'horario vacío');
insert into agenda_dias values (auth.uid(), 3, 4, '08:00', '22:00');
select debe((select count(*) = 2 from agenda_dias where mvz_id = auth.uid()), 'dos días configurados');
select debe_fallar($$insert into agenda_dias values ('00000000-0000-0000-0000-0000000000a2', 5, 3, '09:00', '15:00')$$, 'configurar la agenda de otro médico');
-- Cambiar un día sin consultas: libre
update agenda_dias set hora_inicio = '10:00', hora_fin = '16:00' where mvz_id = auth.uid() and dia_semana = 3;
delete from agenda_dias where mvz_id = auth.uid() and dia_semana = 3;
select debe((select count(*) = 1 from agenda_dias where mvz_id = auth.uid()), 'quitar un día sin consultas');

-- Otro médico no ve ni cambia la agenda de Ana
select como('00000000-0000-0000-0000-0000000000a2');
select debe((select count(*) = 0 from agenda_dias where mvz_id = '00000000-0000-0000-0000-0000000000a1'), 'otro médico no ve la agenda ajena');
update agenda_dias set alcaldia_id = 9 where mvz_id = '00000000-0000-0000-0000-0000000000a1';
reset role;
select debe((select alcaldia_id = 3 from agenda_dias where mvz_id = '00000000-0000-0000-0000-0000000000a1' and dia_semana = 2), 'otro médico no cambia la agenda ajena');

-- Una consulta confirmada el martes a las 11:00 (se inserta directo, como si ya estuviera pagada)
insert into direcciones (id, tutor_id, calle, num_ext, colonia, cp, alcaldia_id)
  values ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000000b1', 'Pilares', '10', 'Del Valle', '03100', 3);
insert into mascotas (id, tutor_id, nombre, especie)
  values ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000000b1', 'Toby', 'perro');
insert into reservas (id, tutor_id, mvz_id, mascota_id, direccion_id, alcaldia_id, tipo, inicia_at, termina_at, estado, subtotal, total, comision_pct)
  values ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1',
          '00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000d001', 3, 'general',
          (current_setting('lv.martes')::date + time '11:00') at time zone 'America/Mexico_City',
          (current_setting('lv.martes')::date + time '13:00') at time zone 'America/Mexico_City',
          'confirmada', 600, 600, 0.225);

set role authenticated;
select como('00000000-0000-0000-0000-0000000000a1');
select debe((select count(*) = 2 from bloques_disponibles(3::smallint, current_setting('lv.martes')::date)), 'el bloque reservado ya no se ofrece');
select debe_fallar($$delete from agenda_dias where mvz_id = auth.uid() and dia_semana = 2$$, 'quitar un día con consulta confirmada');
select debe_fallar($$update agenda_dias set alcaldia_id = 4 where mvz_id = auth.uid() and dia_semana = 2$$, 'cambiar la alcaldía con consulta confirmada');
select debe_fallar($$update agenda_dias set hora_inicio = '12:00', hora_fin = '18:00' where mvz_id = auth.uid() and dia_semana = 2$$, 'dejar fuera del horario la consulta confirmada');
-- Lo que sigue cubriendo la consulta sí se puede
update agenda_dias set hora_inicio = '07:00', hora_fin = '17:00' where mvz_id = auth.uid() and dia_semana = 2;
select debe((select hora_inicio = '07:00' from agenda_dias where mvz_id = auth.uid() and dia_semana = 2), 'ampliar el horario sin dejar fuera la consulta');
insert into agenda_dias values (auth.uid(), 2, 3, '09:00', '15:00')
  on conflict (mvz_id, dia_semana) do update set hora_inicio = excluded.hora_inicio, hora_fin = excluded.hora_fin;
select debe((select hora_inicio = '09:00' from agenda_dias where mvz_id = auth.uid() and dia_semana = 2), 'guardar con upsert (como la app)');
select debe_fallar($$insert into agenda_dias values (auth.uid(), 2, 4, '09:00', '15:00')
  on conflict (mvz_id, dia_semana) do update set alcaldia_id = excluded.alcaldia_id$$, 'upsert que cambia la alcaldía con consulta confirmada');

-- Días bloqueados ----------------------------------------------------------
select debe_fallar($$insert into dias_bloqueados (mvz_id, dia) values (auth.uid(), current_setting('lv.martes')::date)$$, 'bloquear un día con consulta');
select debe_fallar($$insert into dias_bloqueados (mvz_id, dia) values (auth.uid(), current_setting('lv.hoy')::date - 1)$$, 'bloquear un día que ya pasó');
select debe_fallar($$insert into dias_bloqueados (mvz_id, dia) values (auth.uid(), current_setting('lv.hoy')::date + 400)$$, 'bloquear a más de un año');
select debe_fallar($$insert into dias_bloqueados (mvz_id, dia, motivo) values (auth.uid(), current_setting('lv.martes')::date + 7, repeat('x', 121))$$, 'motivo muy largo');
insert into dias_bloqueados (mvz_id, dia, motivo) values (auth.uid(), current_setting('lv.martes')::date + 7, '  Congreso  ');
select debe((select motivo = 'Congreso' from dias_bloqueados where mvz_id = auth.uid()), 'bloquea el martes siguiente y limpia el motivo');
select debe((select count(*) = 0 from bloques_disponibles(3::smallint, current_setting('lv.martes')::date + 7)), 'el día bloqueado no ofrece bloques');
delete from dias_bloqueados where mvz_id = auth.uid();
select debe((select count(*) = 3 from bloques_disponibles(3::smallint, current_setting('lv.martes')::date + 7)), 'al desbloquear vuelven los bloques');
select debe_fallar($$insert into dias_bloqueados (mvz_id, dia) values ('00000000-0000-0000-0000-0000000000a2', current_setting('lv.martes')::date + 7)$$, 'bloquear días de otro médico');

-- Al cancelarse la consulta, ya se puede cambiar el día
reset role;
update reservas set estado = 'cancelada_tutor' where id = '00000000-0000-0000-0000-00000000e001';
set role authenticated;
select como('00000000-0000-0000-0000-0000000000a1');
insert into dias_bloqueados (mvz_id, dia) values (auth.uid(), current_setting('lv.martes')::date);
update agenda_dias set alcaldia_id = 4 where mvz_id = auth.uid() and dia_semana = 2;
select debe((select alcaldia_id = 4 from agenda_dias where mvz_id = auth.uid() and dia_semana = 2), 'cambia la alcaldía cuando ya no hay consultas');

-- Catálogo y vacunación ----------------------------------------------------
select debe((select count(*) = 0 from bloques_disponibles(4::smallint, current_setting('lv.martes')::date + 7, 'vacunacion')), 'sin catálogo no ofrece vacunación');
select debe_fallar($$insert into catalogo_mvz (mvz_id, tipo, nombre, precio) values (auth.uid(), 'vacuna', ' ', 300)$$, 'producto sin nombre');
select debe_fallar($$insert into catalogo_mvz (mvz_id, tipo, nombre, precio) values (auth.uid(), 'vacuna', 'Rabia', 0)$$, 'producto con precio cero');
select debe_fallar($$insert into catalogo_mvz (mvz_id, tipo, nombre, precio) values (auth.uid(), 'vacuna', 'Rabia', 25000)$$, 'producto carísimo');
select debe_fallar($$insert into catalogo_mvz (mvz_id, tipo, nombre, precio) values (auth.uid(), 'pastilla', 'Rabia', 250)$$, 'tipo inventado');
insert into catalogo_mvz (id, mvz_id, tipo, nombre, especie, precio) values
  ('00000000-0000-0000-0000-0000000c0001', auth.uid(), 'vacuna', '  Séxtuple   canina ', 'perro', 450),
  ('00000000-0000-0000-0000-0000000c0002', auth.uid(), 'desparasitante', 'Desparasitante interno', null, 180);
select debe((select nombre = 'Séxtuple canina' from catalogo_mvz where id = '00000000-0000-0000-0000-0000000c0001'), 'limpia espacios del nombre');
select debe((select count(*) = 3 from bloques_disponibles(4::smallint, current_setting('lv.martes')::date + 7, 'vacunacion')), 'con catálogo ofrece vacunación');
select debe_fallar($$update catalogo_mvz set mvz_id = '00000000-0000-0000-0000-0000000000a2' where id = '00000000-0000-0000-0000-0000000c0001'$$, 'pasar un producto a otro médico');

-- Un producto vendido se desactiva; uno sin usar se borra
reset role;
insert into reservas (id, tutor_id, mvz_id, mascota_id, direccion_id, alcaldia_id, tipo, inicia_at, termina_at, estado, subtotal, total, comision_pct)
  values ('00000000-0000-0000-0000-00000000e002', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1',
          '00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000d001', 3, 'vacunacion',
          now() - interval '20 days', now() - interval '20 days' + interval '2 hours', 'cerrada', 450, 450, 0.225);
insert into reserva_productos (reserva_id, catalogo_id, nombre, precio)
  values ('00000000-0000-0000-0000-00000000e002', '00000000-0000-0000-0000-0000000c0001', 'Séxtuple canina', 450);
set role authenticated;
select como('00000000-0000-0000-0000-0000000000a2');
select debe_fallar($$select quitar_producto('00000000-0000-0000-0000-0000000c0001')$$, 'quitar un producto de otro médico');
select como('00000000-0000-0000-0000-0000000000a1');
select debe(quitar_producto('00000000-0000-0000-0000-0000000c0001') = 'desactivado', 'producto vendido se desactiva');
select debe(quitar_producto('00000000-0000-0000-0000-0000000c0002') = 'borrado', 'producto sin usar se borra');
select debe((select count(*) = 1 and bool_and(not activo) from catalogo_mvz where mvz_id = auth.uid()), 'queda solo el desactivado');
select debe((select count(*) = 0 from bloques_disponibles(4::smallint, current_setting('lv.martes')::date + 7, 'vacunacion')), 'con todo desactivado ya no ofrece vacunación');

-- Tutor: ve el catálogo activo de médicos aprobados, no edita nada de la agenda
update catalogo_mvz set activo = true where id = '00000000-0000-0000-0000-0000000c0001';
select como('00000000-0000-0000-0000-0000000000b1');
select debe((select count(*) = 1 from catalogo_mvz), 'el tutor ve el catálogo activo');
select debe((select count(*) = 0 from agenda_dias), 'el tutor no ve la agenda interna');
select debe_fallar($$insert into agenda_dias values (auth.uid(), 4, 3, '09:00', '15:00')$$, 'tutor no crea agenda');
select debe_fallar($$select quitar_producto('00000000-0000-0000-0000-0000000c0001')$$, 'tutor no quita productos');
reset role;

-- Guardar la semana completa (todo o nada) ------------------------------------
reset role;
delete from dias_bloqueados;
update reservas set estado = 'confirmada' where id = '00000000-0000-0000-0000-00000000e001';
update agenda_dias set alcaldia_id = 3 where dia_semana = 2;
set role authenticated;
select como('00000000-0000-0000-0000-0000000000a1');
select guardar_agenda('[{"dia_semana":2,"alcaldia_id":3,"hora_inicio":"09:00","hora_fin":"15:00"},
                        {"dia_semana":4,"alcaldia_id":14,"hora_inicio":"10:00","hora_fin":"14:00"}]');
select debe((select count(*) = 2 from agenda_dias where mvz_id = auth.uid()), 'guarda la semana: martes igual y jueves nuevo');
select debe_fallar($$select guardar_agenda('[{"dia_semana":4,"alcaldia_id":14,"hora_inicio":"10:00","hora_fin":"14:00"},
                        {"dia_semana":5,"alcaldia_id":14,"hora_inicio":"10:00","hora_fin":"14:00"}]')$$, 'quitar el martes con consulta (en lote)');
select debe((select count(*) = 2 and bool_or(dia_semana = 2) and not bool_or(dia_semana = 5) from agenda_dias where mvz_id = auth.uid()),
            'si algo falla no se guarda nada (el viernes tampoco)');
select debe_fallar($$select guardar_agenda('[{"dia_semana":2,"alcaldia_id":3,"hora_inicio":"09:00","hora_fin":"15:00"},
                        {"dia_semana":5,"alcaldia_id":14,"hora_inicio":"10:00","hora_fin":"13:00"}]')$$, 'horario con medio bloque (en lote)');
select guardar_agenda('[{"dia_semana":2,"alcaldia_id":3,"hora_inicio":"09:00","hora_fin":"15:00"}]');
select debe((select count(*) = 1 from agenda_dias where mvz_id = auth.uid()), 'quita el jueves al no venir en la lista');
select como('00000000-0000-0000-0000-0000000000b1');
select debe_fallar($$select guardar_agenda('[]')$$, 'un tutor no guarda agenda');
reset role;
