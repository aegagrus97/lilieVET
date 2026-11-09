\set ON_ERROR_STOP 1
\pset format unaligned
\pset tuples_only on
set client_min_messages = warning;

-- Ayudas de prueba ----------------------------------------------------
create function public.como(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), false);
end $$;
create function public.debe_fallar(p_sql text, p_que text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    raise notice 'OK (bloqueado) %: %', p_que, sqlerrm;
    return;
  end;
  raise exception 'FALLA: debió bloquearse -> %', p_que;
end $$;
create function public.debe(p_cond boolean, p_que text) returns void language plpgsql as $$
begin
  if p_cond is distinct from true then raise exception 'FALLA: %', p_que; end if;
  raise notice 'OK %', p_que;
end $$;
grant execute on function public.como(uuid), public.debe_fallar(text, text), public.debe(boolean, text) to authenticated, service_role;
set client_min_messages = notice;

-- Usuarios -------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000a1', 'kat@lv.mx',  '{"rol":"mvz","nombre":"Kat","apellidos":"Moctezuma"}'),
 ('00000000-0000-0000-0000-0000000000a2', 'mvz2@lv.mx', '{"rol":"mvz","nombre":"Ana","apellidos":"Ruiz"}'),
 ('00000000-0000-0000-0000-0000000000b1', 'tutorA@x.mx','{"rol":"tutor","nombre":"Luis","telefono":"5511112222","acepta_whatsapp":true}');
select set_config('lv.codigo', (select codigo_invitacion from tutores where id = '00000000-0000-0000-0000-0000000000b1'), false);
insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000b2', 'tutorB@x.mx',
  jsonb_build_object('rol','tutor','nombre','Sofía','codigo_invitacion', current_setting('lv.codigo')));
insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000ad', 'admin@lv.mx', '{"rol":"mvz","nombre":"Admin"}');
select crear_admin('admin@lv.mx');
select debe((select count(*) = 1 from invitaciones), 'invitación registrada al usar el código');

-- Siguiente lunes (fecha CDMX)
select set_config('lv.lunes', (((now() at time zone 'America/Mexico_City')::date + 7
        - extract(isodow from (now() at time zone 'America/Mexico_City')::date)::int + 1))::text, false);

-- MVZ configuran su perfil y agenda ----------------------------------------
set role authenticated;
select como('00000000-0000-0000-0000-0000000000a2');
update mvz set precio_general = 600, cedula = '1234567', clabe = '012180001234567891' where id = auth.uid();
select debe_fallar($$update mvz set estado = 'aprobado' where id = auth.uid()$$, 'MVZ no puede aprobarse solo');
select debe_fallar($$update mvz set precio_general = 300 where id = auth.uid()$$, 'precio menor al mínimo');
insert into agenda_dias values (auth.uid(), 1, 3, '10:00', '18:00');
select debe((select count(*) = 0 from bloques_disponibles(3::smallint, current_setting('lv.lunes')::date)), 'MVZ no aprobado no aparece');

select como('00000000-0000-0000-0000-0000000000a1');
update mvz set precio_general = 500, acepta_mismo_dia = true where id = auth.uid();
insert into agenda_dias values (auth.uid(), 1, 3, '10:00', '18:00');
insert into catalogo_mvz (mvz_id, tipo, nombre, especie, precio) values
  (auth.uid(), 'vacuna', 'Séxtuple', 'perro', 450), (auth.uid(), 'desparasitante', 'Antiparasitario', 'perro', 200);
select como('00000000-0000-0000-0000-0000000000ad');
select revisar_cuenta('00000000-0000-0000-0000-0000000000a1', 'alta_mvz', 'aprobado');
select revisar_cuenta('00000000-0000-0000-0000-0000000000a2', 'alta_mvz', 'aprobado');
select debe_fallar($$select revisar_cuenta('00000000-0000-0000-0000-0000000000a2','alta_mvz','rechazado')$$, 'rechazo sin nota');

-- Tutor A: dirección, mascota, INE ---------------------------------------
select como('00000000-0000-0000-0000-0000000000b1');
select debe_fallar($$select revisar_cuenta('00000000-0000-0000-0000-0000000000b1','ine_tutor','aprobado')$$, 'tutor no puede aprobarse');
insert into direcciones (id, tutor_id, calle, num_ext, colonia, cp, alcaldia_id)
  values ('00000000-0000-0000-0000-00000000d001', auth.uid(), 'Pilares', '10', 'Del Valle', '03100', 3);
insert into mascotas (id, tutor_id, nombre, especie, alergias)
  values ('00000000-0000-0000-0000-00000000f001', auth.uid(), 'Toby', 'perro', 'Penicilina'),
         ('00000000-0000-0000-0000-00000000f002', auth.uid(), 'Michi', 'gato', null);
insert into storage.objects (bucket_id, name) values ('identidad', '00000000-0000-0000-0000-0000000000b1/ine.jpg');
insert into documentos_verificacion (cuenta_id, tipo, ruta) values (auth.uid(), 'ine_frente', 'identidad/00000000-0000-0000-0000-0000000000b1/ine.jpg');
select debe((select estado_ine = 'pendiente' from tutores where id = auth.uid()), 'INE pasa a pendiente al subirla');
select debe_fallar($$insert into storage.objects (bucket_id, name) values ('identidad', '00000000-0000-0000-0000-0000000000b2/ine.jpg')$$, 'subir INE en carpeta ajena');
select debe((select count(*) = 0 from storage.objects where bucket_id = 'identidad'), 'el tutor no puede volver a abrir su INE (solo admin)');

-- Agenda visible -----------------------------------------------------------
select debe((select count(*) = 8 from bloques_disponibles(3::smallint, current_setting('lv.lunes')::date)), '8 bloques el lunes (2 MVZ x 4)');
select debe((select count(*) = 0 from bloques_disponibles(4::smallint, current_setting('lv.lunes')::date)), 'nada en otra alcaldía');
select debe((select count(*) = 1 from mvz_publicos where id = '00000000-0000-0000-0000-0000000000a1'), 'perfil público visible');
select debe((select count(*) = 0 from mvz where id = '00000000-0000-0000-0000-0000000000a2'), 'tutor no ve la tabla de MVZ (CLABE, RFC)');

-- Reservar -----------------------------------------------------------------
select set_config('lv.r1', (reservar('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000d001',
   '00000000-0000-0000-0000-0000000000a1', (current_setting('lv.lunes')::date + time '10:00') at time zone 'America/Mexico_City',
   'general', '{}', 'Vómito', 'Vomita desde ayer', '1 día')).id::text, false);
select debe((select estado = 'apartada' and total = 500 from reservas where id = current_setting('lv.r1')::uuid), 'reserva apartada por $500');
select debe((select count(*) = 7 from bloques_disponibles(3::smallint, current_setting('lv.lunes')::date)), 'el bloque apartado ya no aparece');
select debe_fallar($$select reservar('00000000-0000-0000-0000-00000000f002','00000000-0000-0000-0000-00000000d001',
   '00000000-0000-0000-0000-0000000000a1', (current_setting('lv.lunes')::date + time '10:00') at time zone 'America/Mexico_City','general')$$,
   'doble reserva del mismo bloque');
select debe_fallar($$select reservar('00000000-0000-0000-0000-00000000f001','00000000-0000-0000-0000-00000000d001',
   '00000000-0000-0000-0000-0000000000a2', (current_setting('lv.lunes')::date + time '10:00') at time zone 'America/Mexico_City','general')$$,
   'misma mascota con dos MVZ a la misma hora');
select debe_fallar($$insert into reservas (tutor_id, mvz_id, mascota_id, direccion_id, alcaldia_id, tipo, inicia_at, termina_at, subtotal, total, comision_pct)
   values (auth.uid(), '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-00000000f002', '00000000-0000-0000-0000-00000000d001', 3,
   'general', now() + interval '3 days', now() + interval '3 days 2 hours', 1, 1, 0)$$, 'insertar reserva directo (precio inventado)');

-- Pago aprobado (servidor)
reset role;
set role service_role;
insert into pagos (reserva_id, concepto, monto) values (current_setting('lv.r1')::uuid, 'reserva', 500) returning set_config('lv.p1', id::text, false);
select confirmar_pago(current_setting('lv.p1')::uuid, 'MP-1', 'visa', '4242', 24.88);
select confirmar_pago(current_setting('lv.p1')::uuid, 'MP-1', 'visa', '4242', 24.88);  -- webhook repetido
reset role;
select debe((select estado = 'confirmada' from reservas where id = current_setting('lv.r1')::uuid), 'pago confirma la reserva');
select debe((select count(*) = 1 and sum(neto) = 387.50 and min(estado::text) = 'retenido' from saldo_mvz
             where reserva_id = current_setting('lv.r1')::uuid), 'MVZ: $387.50 retenidos (22.5%), sin duplicar');
select debe((select count(*) = 6 from avisos where reserva_id = current_setting('lv.r1')::uuid), '6 avisos: tutor por correo y WhatsApp, MVZ solo correo (no aceptó WhatsApp)');

-- Accesos ------------------------------------------------------------------
set role authenticated;
select como('00000000-0000-0000-0000-0000000000a1');
select debe((select count(*) = 1 from mascotas where id = '00000000-0000-0000-0000-00000000f001'), 'MVZ asignado ve a Toby');
select debe((select count(*) = 0 from mascotas where id = '00000000-0000-0000-0000-00000000f002'), 'MVZ no ve a Michi (sin cita)');
select debe((select calle = 'Pilares' from direccion_de_reserva(current_setting('lv.r1')::uuid)), 'MVZ asignado abre la dirección');
select debe((select count(*) = 0 from direcciones), 'MVZ no lee la tabla de direcciones directo');
select debe((select count(*) = 1 from mis_consultas_mvz() where con_acceso and colonia = 'Del Valle'), 'agenda del MVZ con colonia');
select debe((select count(*) = 0 from perfiles where id = '00000000-0000-0000-0000-0000000000b1'), 'MVZ no ve teléfono ni correo del tutor');
select debe_fallar($$select marcar_llegada(current_setting('lv.r1')::uuid)$$, 'llegar días antes');

select como('00000000-0000-0000-0000-0000000000a2');
select debe((select count(*) = 0 from mascotas), 'otro MVZ no ve pacientes ajenos');
select debe_fallar($$select direccion_de_reserva(current_setting('lv.r1')::uuid)$$, 'otro MVZ no abre la dirección');
select debe_fallar($$insert into mensajes (reserva_id, texto) values (current_setting('lv.r1')::uuid, 'hola')$$, 'otro MVZ no escribe en el chat');
select debe_fallar($$insert into storage.objects (bucket_id, name) values ('expediente', '00000000-0000-0000-0000-00000000f001/x.pdf')$$, 'otro MVZ no sube al expediente');

select como('00000000-0000-0000-0000-0000000000b2');
select debe((select count(*) = 0 from mascotas) and (select count(*) = 0 from reservas) and (select count(*) = 0 from direcciones), 'tutor B no ve nada de tutor A');

-- Chat
select como('00000000-0000-0000-0000-0000000000b1');
insert into mensajes (reserva_id, texto) values (current_setting('lv.r1')::uuid, 'Mi cel es 55 1234 5678 y correo luis@gmail.com');
select debe((select texto not like '%5678%' and texto not like '%gmail%' from mensajes limit 1), 'chat oculta teléfono y correo');

-- Consulta: llegada, registro clínico con versiones, cierre ---------------------
reset role;
update reservas set inicia_at = now() - interval '10 minutes', termina_at = now() + interval '110 minutes'
 where id = current_setting('lv.r1')::uuid;
set role authenticated;
select como('00000000-0000-0000-0000-0000000000a1');
select marcar_llegada(current_setting('lv.r1')::uuid);
select debe_fallar($$select marcar_tutor_ausente(current_setting('lv.r1')::uuid)$$, 'tutor ausente antes de 25 min');
select guardar_registro_clinico(current_setting('lv.r1')::uuid, 'Alerta, deshidratación leve', 'Gastroenteritis', 'Dieta blanda',
   'Suero oral', 'Volver si sigue', 'Revisión en 3 días', 18.5, 38.9);
select debe_fallar($$select guardar_registro_clinico(current_setting('lv.r1')::uuid,'x','y','z','w','v','u')$$, 'corrección sin motivo');
select guardar_registro_clinico(current_setting('lv.r1')::uuid, 'Alerta, deshidratación leve', 'Gastroenteritis aguda', 'Dieta blanda',
   'Suero oral', 'Volver si sigue', 'Revisión en 3 días', 18.5, 38.9, 'Precisé el diagnóstico');
select debe_fallar($$update registros_clinicos_versiones set diagnosticos = 'otro'$$, 'editar nota clínica');
select debe_fallar($$delete from registros_clinicos_versiones$$, 'borrar nota clínica');
insert into cartilla (mascota_id, tipo, producto, aplicada_el, origen, reserva_id)
  values ('00000000-0000-0000-0000-00000000f001', 'vacuna', 'Rabia', current_date, 'mvz', current_setting('lv.r1')::uuid);
select cerrar_consulta(current_setting('lv.r1')::uuid);
select debe((select diagnosticos = 'Gastroenteritis aguda' and version = 2 from historia_clinica('00000000-0000-0000-0000-00000000f001')),
            'historia clínica muestra la última versión');
select debe((select count(*) = 1 from mascotas where id = '00000000-0000-0000-0000-00000000f001'), 'MVZ conserva acceso tras el cierre (72 h)');
select debe_fallar($$select direccion_de_reserva(current_setting('lv.r1')::uuid)$$, 'dirección se cierra al terminar la consulta');
reset role;
select debe((select estado = 'por_depositar' from saldo_mvz where reserva_id = current_setting('lv.r1')::uuid), 'saldo pasa a por depositar');
select debe((select count(*) = 0 from avisos where reserva_id = current_setting('lv.r1')::uuid and plantilla like 'captura%' and estado = 'programado'),
            'avisos de captura cancelados porque ya capturó');
select debe((select count(*) >= 1 from registro_accesos where objeto = 'direccion'), 'acceso a la dirección quedó registrado');
update reservas set cerrada_at = now() - interval '73 hours' where id = current_setting('lv.r1')::uuid;
set role authenticated;
select debe((select count(*) = 0 from mascotas), 'tras 72 h el MVZ pierde acceso al paciente');
select debe_fallar($$insert into mensajes (reserva_id, texto) values (current_setting('lv.r1')::uuid, 'hola')$$, 'chat cerrado tras 72 h');
select como('00000000-0000-0000-0000-0000000000b1');
insert into calificaciones (reserva_id, tutor_id, mvz_id, estrellas, comentario)
  values (current_setting('lv.r1')::uuid, auth.uid(), '00000000-0000-0000-0000-0000000000a1', 5, 'Excelente');
select debe((select calificacion_prom = 5 from mvz_publicos where id = '00000000-0000-0000-0000-0000000000a1'), 'calificación actualiza el promedio');
select debe((select count(*) = 1 from historia_clinica('00000000-0000-0000-0000-00000000f001')), 'tutor conserva su historia clínica');

-- Cancelaciones ------------------------------------------------------------
create or replace function pg_temp.reserva_pagada(p_mascota uuid, p_ini timestamptz) returns uuid language plpgsql as $$
declare r uuid; p uuid;
begin
  perform como('00000000-0000-0000-0000-0000000000b1');
  r := (reservar(p_mascota, '00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000000a2', p_ini, 'general')).id;
  reset role;
  insert into pagos (reserva_id, concepto, monto) values (r, 'reserva', 600) returning id into p;
  perform confirmar_pago(p, 'MP-' || p, 'visa', '4242', 28);
  return r;
end $$;
reset role;
grant execute on all functions in schema pg_temp to authenticated;
-- a) con 7 días: reembolso total
select set_config('lv.r2', pg_temp.reserva_pagada('00000000-0000-0000-0000-00000000f001',
   (current_setting('lv.lunes')::date + time '12:00') at time zone 'America/Mexico_City')::text, false);
set role authenticated;
select como('00000000-0000-0000-0000-0000000000b1');
select cancelar_reserva(current_setting('lv.r2')::uuid);
reset role;
select debe((select r.estado = 'cancelada_tutor' and rb.monto = 600 from reservas r join pagos p on p.reserva_id = r.id
             join reembolsos rb on rb.pago_id = p.id where r.id = current_setting('lv.r2')::uuid), 'cancelación a tiempo: reembolso total');
select debe((select estado = 'anulado' from saldo_mvz where reserva_id = current_setting('lv.r2')::uuid), 'MVZ no recibe nada');
select debe((select count(*) = 0 from avisos where reserva_id = current_setting('lv.r2')::uuid and plantilla = 'recordatorio_1h' and estado = 'programado'),
            'recordatorios cancelados');
-- b) con menos de 24 h: se cobra 50%
select set_config('lv.r3', pg_temp.reserva_pagada('00000000-0000-0000-0000-00000000f002',
   (current_setting('lv.lunes')::date + time '14:00') at time zone 'America/Mexico_City')::text, false);
update reservas set inicia_at = now() + interval '5 hours', termina_at = now() + interval '7 hours' where id = current_setting('lv.r3')::uuid;
set role authenticated;
select como('00000000-0000-0000-0000-0000000000b1');
select cancelar_reserva(current_setting('lv.r3')::uuid);
reset role;
select debe((select r.estado = 'cancelada_tarde' and rb.monto = 300 and s.neto = 232.50
             from reservas r join pagos p on p.reserva_id = r.id join reembolsos rb on rb.pago_id = p.id
             join saldo_mvz s on s.reserva_id = r.id where r.id = current_setting('lv.r3')::uuid),
            'cancelación tardía: regresa $300, MVZ recibe $232.50');
-- c) tutor ausente a los 25 min: se cobra 100%
select set_config('lv.r4', pg_temp.reserva_pagada('00000000-0000-0000-0000-00000000f002',
   (current_setting('lv.lunes')::date + time '16:00') at time zone 'America/Mexico_City')::text, false);
update reservas set estado = 'en_domicilio', inicia_at = now() - interval '30 minutes', termina_at = now() + interval '90 minutes',
                    llego_at = now() - interval '26 minutes' where id = current_setting('lv.r4')::uuid;
set role authenticated;
select como('00000000-0000-0000-0000-0000000000a2');
select marcar_tutor_ausente(current_setting('lv.r4')::uuid);
reset role;
select debe((select r.estado = 'tutor_ausente' and s.neto = 465 and s.estado = 'por_depositar'
             and not exists (select 1 from pagos p join reembolsos rb on rb.pago_id = p.id where p.reserva_id = r.id)
             from reservas r join saldo_mvz s on s.reserva_id = r.id where r.id = current_setting('lv.r4')::uuid),
            'tutor ausente: se cobra 100%, MVZ recibe $465, sin reembolso');

-- Vacunación con producto no aplicado y mismo día
set role authenticated;
select como('00000000-0000-0000-0000-0000000000b1');
reset role;
-- bloque de hoy para Kat (acepta mismo día): agenda del día de hoy
insert into agenda_dias values ('00000000-0000-0000-0000-0000000000a1',
  extract(isodow from (now() at time zone 'America/Mexico_City'))::smallint, 3, '06:00', '22:00')
  on conflict (mvz_id, dia_semana) do update set hora_inicio = '06:00', hora_fin = '22:00';
set role authenticated;
select como('00000000-0000-0000-0000-0000000000b1');
select set_config('lv.hoy', (select inicia_at::text from bloques_disponibles(3::smallint, (now() at time zone 'America/Mexico_City')::date, 'vacunacion')
   where mvz_id = '00000000-0000-0000-0000-0000000000a1' limit 1), false);
\echo hoy:
select current_setting('lv.hoy');
select set_config('lv.r5', (reservar('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000d001',
   '00000000-0000-0000-0000-0000000000a1', current_setting('lv.hoy')::timestamptz, 'vacunacion',
   array(select id from catalogo_mvz order by precio desc))).id::text, false);
select debe((select mismo_dia and subtotal = 650 and recargo = 260 and total = 910 from reservas where id = current_setting('lv.r5')::uuid),
            'vacunación mismo día: $650 + 40% = $910');
reset role;
insert into pagos (reserva_id, concepto, monto)
   values (current_setting('lv.r5')::uuid, 'reserva', 910) returning set_config('lv.p5', id::text, false);
set role service_role;
select confirmar_pago(current_setting('lv.p5')::uuid, 'MP-5', 'mastercard', '1111', 40);
reset role;
update reservas set estado = 'en_domicilio', llego_at = now() where id = current_setting('lv.r5')::uuid;
set role authenticated;
select como('00000000-0000-0000-0000-0000000000a1');
select cerrar_consulta(current_setting('lv.r5')::uuid, array(select id from reserva_productos where reserva_id = current_setting('lv.r5')::uuid and precio = 200));
reset role;
select debe((select rb.monto = 280 from reembolsos rb join pagos p on p.id = rb.pago_id where p.reserva_id = current_setting('lv.r5')::uuid),
            'desparasitante no aplicado: se regresan $280 ($200 + su 40%)');
select debe((select neto = round(630 * 0.775, 2) from saldo_mvz where reserva_id = current_setting('lv.r5')::uuid),
            'MVZ recibe 77.5% de lo que sí se cobró ($630)');

-- Expiración de apartados
set role authenticated;
select como('00000000-0000-0000-0000-0000000000b1');
select set_config('lv.r6', (reservar('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000d001',
   '00000000-0000-0000-0000-0000000000a2', (current_setting('lv.lunes')::date + time '10:00') at time zone 'America/Mexico_City', 'general')).id::text, false);
reset role;
update reservas set apartada_hasta = now() - interval '1 minute' where id = current_setting('lv.r6')::uuid;
select debe(expirar_apartados() = 1, 'apartado vencido se libera');
set role authenticated;
select debe((select count(*) = 1 from bloques_disponibles(3::smallint, current_setting('lv.lunes')::date)
             where mvz_id = '00000000-0000-0000-0000-0000000000a2' and hora_cdmx(inicia_at)::time = '10:00'), 'el bloque vuelve a estar disponible');

-- MVZ no llegó (soporte)
select como('00000000-0000-0000-0000-0000000000a1');
reset role;
select set_config('lv.r7', pg_temp.reserva_pagada('00000000-0000-0000-0000-00000000f002',
   (current_setting('lv.lunes')::date + time '12:00') at time zone 'America/Mexico_City')::text, false);
set role authenticated;
select debe_fallar($$select registrar_mvz_no_llego(current_setting('lv.r7')::uuid, 'x')$$, 'MVZ no registra faltas');
select como('00000000-0000-0000-0000-0000000000ad');
select registrar_mvz_no_llego(current_setting('lv.r7')::uuid, 'No se presentó');
reset role;
select debe((select sum(neto) = -(round(600*0.225,2) + costo_pasarela(600)) from saldo_mvz
             where reserva_id = current_setting('lv.r7')::uuid and estado <> 'anulado'),
            'MVZ que falta: se le descuenta comisión + pasarela del reembolso');

-- Funciones solo de servidor
set role authenticated;
select como('00000000-0000-0000-0000-0000000000b1');
select debe_fallar($$select confirmar_pago(gen_random_uuid(), 'x', 'x', '0000', 0)$$, 'tutor no puede confirmar pagos');
select debe_fallar($$select crear_admin('tutorA@x.mx')$$, 'tutor no puede hacerse admin');
update parametros set valor = 0 where clave = 'comision';
reset role;
select debe((select valor = 0.225 from parametros where clave = 'comision'), 'comisión sigue en 22.5%');
select debe((select count(*) > 0 from auditoria where tabla = 'reservas'), 'auditoría registra cambios');

-- Vacunación que cambia a consulta: se cobra la diferencia con liga de pago
select como('00000000-0000-0000-0000-0000000000b1');
select set_config('lv.r8', (reservar('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000d001',
   '00000000-0000-0000-0000-0000000000a1', (current_setting('lv.lunes')::date + time '14:00') at time zone 'America/Mexico_City', 'vacunacion',
   array(select id from catalogo_mvz where precio = 200))).id::text, false);
insert into pagos (reserva_id, concepto, monto) values (current_setting('lv.r8')::uuid, 'reserva', 200) returning set_config('lv.p8', id::text, false);
select confirmar_pago(current_setting('lv.p8')::uuid, 'MP-8', 'visa', '4242', 13);
update reservas set estado = 'en_domicilio', llego_at = now(), inicia_at = now() - interval '5 minutes', termina_at = now() + interval '115 minutes'
 where id = current_setting('lv.r8')::uuid;
set role authenticated;
select como('00000000-0000-0000-0000-0000000000a1');
select (cambiar_a_consulta(current_setting('lv.r8')::uuid)).id::text as pago_dif \gset
reset role;
select debe((select monto = 300 and concepto = 'diferencia' and estado = 'pendiente' from pagos where id = :'pago_dif'), 'diferencia de $300 por cobrar');
select confirmar_pago(:'pago_dif', 'MP-8b', 'visa', '4242', 15);
set role authenticated;
select cerrar_consulta(current_setting('lv.r8')::uuid);
reset role;
select debe((select cobrado_final = 500 and tipo = 'general' from reservas where id = current_setting('lv.r8')::uuid), 'consulta cobrada completa: $500');
select debe((select sum(neto) = 387.50 from saldo_mvz where reserva_id = current_setting('lv.r8')::uuid), 'MVZ recibe $387.50 en total');
select debe((select count(*) = 0 from reembolsos rb join pagos p on p.id = rb.pago_id where p.reserva_id = current_setting('lv.r8')::uuid),
            'sin reembolsos por productos al cambiar a consulta');

-- Invitación: se activa cuando el invitado paga; el saldo se libera hasta aprobar la INE de quien invita
set role service_role;
select activar_invitacion('00000000-0000-0000-0000-0000000000b2');
reset role;
select debe((select monto = 100 and not liberado from saldo_tutor where concepto = 'invitacion'), '$100 de invitación, retenidos hasta aprobar la INE');
set role authenticated;
select como('00000000-0000-0000-0000-0000000000ad');
select revisar_cuenta('00000000-0000-0000-0000-0000000000b1', 'ine_tutor', 'aprobado');
reset role;
select debe((select liberado from saldo_tutor where concepto = 'invitacion'), 'INE aprobada libera el saldo');
select 'Finanzas:', mes, consultas_cobradas, cobrado, comisiones, pasarela, queda_lilievet, por_depositar_mvz from finanzas_mensuales;
\echo TODAS LAS PRUEBAS TERMINARON
