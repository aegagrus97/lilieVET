-- =====================================================================
-- LilieVET · Base de datos v3.2 (fase 1)
-- Supabase (Postgres 15+). Correr completo en SQL Editor en un proyecto NUEVO.
--
-- Reglas que viven aquí (no solo en la pantalla):
--   * Un MVZ no puede tener dos reservas activas que se crucen (exclusión).
--   * Una mascota no puede tener dos citas activas que se crucen.
--   * Las notas clínicas no se editan ni se borran: cada corrección es una versión nueva.
--   * El MVZ solo ve pacientes, direcciones y chat de sus citas, hasta 72 h después del cierre.
--   * Solo la cuenta admin aprueba INE, cédulas, CLABE y cambia estados de cuentas.
--   * INE, selfies y cédulas viven en un depósito privado que solo abre admin.
--   * Los cobros y reembolsos los confirma el servidor (Edge Functions con service_role).
-- Parámetros de negocio editables en la tabla parametros (Panel).
-- =====================================================================

create extension if not exists btree_gist;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type rol_cuenta as enum ('tutor', 'mvz');
create type estado_verif as enum ('sin_enviar', 'pendiente', 'en_revision', 'aprobado',
                                  'rechazado', 'info_requerida', 'suspendido');
create type especie as enum ('perro', 'gato');
create type tipo_consulta as enum ('general', 'especialidad', 'vacunacion');
create type estado_reserva as enum (
  'apartada',        -- bloque apartado 10 min mientras paga
  'confirmada',      -- pagada
  'en_domicilio',    -- el MVZ marcó "Llegué"
  'cerrada',         -- consulta terminada
  'expirada',        -- no pagó a tiempo
  'cancelada_tutor', -- canceló con 24 h o más (reembolso total)
  'cancelada_tarde', -- canceló con menos de 24 h (se cobra 50%)
  'tutor_ausente',   -- no estaba tras la espera (se cobra 100%)
  'mvz_no_llego',    -- falta del MVZ (reembolso total)
  'cancelada_admin'  -- cancelada por soporte
);
create type estado_pago as enum ('pendiente', 'aprobado', 'rechazado', 'reembolsado', 'reembolso_parcial');
create type estado_saldo_mvz as enum ('retenido', 'por_depositar', 'depositado', 'anulado');

-- ---------------------------------------------------------------------
-- Parámetros (editables desde el Panel)
-- ---------------------------------------------------------------------
create table parametros (
  clave       text primary key,
  valor       numeric not null,
  descripcion text not null,
  updated_at  timestamptz not null default now()
);
insert into parametros (clave, valor, descripcion) values
  ('comision',               0.225, 'Comisión de LilieVET sobre todo lo cobrado'),
  ('recargo_mismo_dia',      0.40,  'Recargo en consultas del mismo día'),
  ('horas_bloque',           2,     'Duración de cada bloque de atención (h)'),
  ('minutos_apartado',       10,    'Minutos que se aparta el bloque mientras el tutor paga'),
  ('minutos_espera_ausente', 25,    'Minutos tras "Llegué" para marcar tutor ausente'),
  ('horas_acceso_mvz',       72,    'Horas tras el cierre con acceso del MVZ y chat abierto'),
  ('horas_cancelacion',      24,    'Cancelación gratis con al menos estas horas de anticipación'),
  ('cobro_cancelacion_tarde',0.50,  'Parte de la consulta que se cobra al cancelar tarde'),
  ('cobro_tutor_ausente',    1.00,  'Parte de la consulta que se cobra si el tutor no está'),
  ('precio_min_general',     500,   'Precio mínimo de consulta general (MXN)'),
  ('precio_min_especialidad',1000,  'Precio mínimo de consulta especializada (MXN)'),
  ('pasarela_pct',           0.0349,'Mercado Pago: porcentaje por cobro'),
  ('pasarela_fijo',          4,     'Mercado Pago: cargo fijo por cobro (MXN)'),
  ('iva',                    0.16,  'IVA sobre la comisión de la pasarela'),
  ('invitacion_monto',       100,   'Saldo por invitación de tutor (MXN)'),
  ('invitaciones_max_anio',  10,    'Invitaciones máximas por tutor al año'),
  ('meses_vigencia_saldo',   12,    'Meses de vigencia del saldo de invitación'),
  ('inasistencias_baja',     3,     'Inasistencias consecutivas del MVZ que llevan a baja');

create function param(p_clave text) returns numeric
language sql stable security definer set search_path = public as
$$ select valor from parametros where clave = p_clave $$;

-- ---------------------------------------------------------------------
-- Catálogos
-- ---------------------------------------------------------------------
create table alcaldias (
  id     smallint primary key,
  nombre text not null unique
);
insert into alcaldias (id, nombre) values
  (1,'Álvaro Obregón'),(2,'Azcapotzalco'),(3,'Benito Juárez'),(4,'Coyoacán'),
  (5,'Cuajimalpa de Morelos'),(6,'Cuauhtémoc'),(7,'Gustavo A. Madero'),(8,'Iztacalco'),
  (9,'Iztapalapa'),(10,'La Magdalena Contreras'),(11,'Miguel Hidalgo'),(12,'Milpa Alta'),
  (13,'Tláhuac'),(14,'Tlalpan'),(15,'Venustiano Carranza'),(16,'Xochimilco');

-- Código postal → alcaldía (cargar desde SEPOMEX; si un CP no está, el tutor elige la alcaldía)
create table codigos_postales (
  cp          char(5) primary key,
  alcaldia_id smallint not null references alcaldias(id)
);

create table especialidades (
  id     serial primary key,
  nombre text not null unique
);

-- ---------------------------------------------------------------------
-- Cuentas
-- ---------------------------------------------------------------------
create table perfiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  rol             rol_cuenta not null,
  es_admin        boolean not null default false,
  nombre          text not null default '',
  apellidos       text not null default '',
  correo          text,
  telefono        text,
  acepta_whatsapp boolean not null default false,
  acepta_promos   boolean not null default false,
  terminos_version text,
  terminos_aceptados_at timestamptz,
  suspendido      boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table tutores (
  id              uuid primary key references perfiles(id) on delete cascade,
  estado_ine      estado_verif not null default 'sin_enviar',
  codigo_invitacion text not null unique default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8)),
  invitado_por    uuid references tutores(id),
  created_at      timestamptz not null default now()
);

create table mvz (
  id                 uuid primary key references perfiles(id) on delete cascade,
  estado             estado_verif not null default 'pendiente',
  cedula             text,
  especialidad_id    int references especialidades(id),
  estado_especialidad estado_verif not null default 'sin_enviar',
  bio                text not null default '',
  foto_path          text,                       -- depósito "perfiles" (público)
  precio_general     numeric(10,2) check (precio_general >= 500),
  precio_especialidad numeric(10,2) check (precio_especialidad >= 1000),
  acepta_mismo_dia   boolean not null default false,
  banco              text,
  clabe              char(18) check (clabe ~ '^[0-9]{18}$'),
  titular_clabe      text,
  estado_clabe       estado_verif not null default 'sin_enviar',
  rfc                text,
  inasistencias_seguidas int not null default 0,
  calificacion_prom  numeric(3,2),
  calificaciones_n   int not null default 0,
  created_at         timestamptz not null default now()
);

-- Documentos de verificación (archivos en el depósito privado "identidad")
create table documentos_verificacion (
  id          uuid primary key default gen_random_uuid(),
  cuenta_id   uuid not null references perfiles(id) on delete cascade,
  tipo        text not null check (tipo in ('ine_frente','ine_reverso','selfie_ine','cedula','especialidad','estado_cuenta')),
  ruta        text not null,          -- identidad/<cuenta_id>/<archivo>
  created_at  timestamptz not null default now()
);

-- Historial de decisiones del admin
create table revisiones (
  id          uuid primary key default gen_random_uuid(),
  cuenta_id   uuid not null references perfiles(id) on delete cascade,
  objeto      text not null check (objeto in ('ine_tutor','alta_mvz','especialidad','clabe','cuenta')),
  decision    estado_verif not null,
  nota        text,
  revisado_por uuid references perfiles(id),
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Direcciones y mascotas (las administra el tutor)
-- ---------------------------------------------------------------------
create table direcciones (
  id            uuid primary key default gen_random_uuid(),
  tutor_id      uuid not null references tutores(id) on delete cascade,
  etiqueta      text not null default 'Casa',
  calle         text not null,
  num_ext       text not null,
  num_int       text,
  colonia       text not null,
  cp            char(5) not null check (cp ~ '^[0-9]{5}$'),
  alcaldia_id   smallint not null references alcaldias(id),
  referencias   text,
  lat           double precision,
  lng           double precision,
  predeterminada boolean not null default false,
  borrada_at    timestamptz,
  created_at    timestamptz not null default now()
);
create index on direcciones (tutor_id);

create table mascotas (
  id               uuid primary key default gen_random_uuid(),
  tutor_id         uuid not null references tutores(id) on delete cascade,
  nombre           text not null check (char_length(nombre) between 1 and 40),
  especie          especie not null,
  raza             text,
  sexo             text check (sexo in ('macho','hembra')),
  esterilizado     boolean,
  fecha_nacimiento date,
  edad_aprox_meses int,
  peso_kg          numeric(5,2),
  senas            text,
  foto_path        text,                -- depósito "expediente"
  alergias         text,
  enfermedades     text,
  antecedentes     text,
  tratamientos_previos text,
  medicamentos_actuales text,
  notas_tutor      text,
  borrada_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index on mascotas (tutor_id);

-- Cartilla: lo registra el tutor (cartilla física) o el MVZ (aplicado en consulta)
create table cartilla (
  id            uuid primary key default gen_random_uuid(),
  mascota_id    uuid not null references mascotas(id) on delete cascade,
  tipo          text not null check (tipo in ('vacuna','desparasitacion')),
  producto      text not null,
  aplicada_el   date not null,
  proxima_el    date,
  lote          text,
  caducidad     date,
  origen        text not null check (origen in ('tutor','mvz')),
  reserva_id    uuid,
  registrado_por uuid not null default auth.uid() references perfiles(id),
  created_at    timestamptz not null default now()
);
create index on cartilla (mascota_id);

create table documentos_mascota (
  id          uuid primary key default gen_random_uuid(),
  mascota_id  uuid not null references mascotas(id) on delete cascade,
  tipo        text not null check (tipo in ('cartilla','receta','laboratorio','imagen','medico','otro')),
  titulo      text not null,
  ruta        text not null,            -- expediente/<mascota_id>/<archivo>
  subido_por  uuid not null default auth.uid() references perfiles(id),
  reserva_id  uuid,
  created_at  timestamptz not null default now()
);
create index on documentos_mascota (mascota_id);

-- ---------------------------------------------------------------------
-- Agenda del MVZ
-- ---------------------------------------------------------------------
-- Una alcaldía y un horario por día de la semana (1 = lunes ... 7 = domingo)
create table agenda_dias (
  mvz_id      uuid not null references mvz(id) on delete cascade,
  dia_semana  smallint not null check (dia_semana between 1 and 7),
  alcaldia_id smallint not null references alcaldias(id),
  hora_inicio time not null,
  hora_fin    time not null,
  primary key (mvz_id, dia_semana),
  check (hora_fin > hora_inicio)
);

create table dias_bloqueados (
  mvz_id uuid not null references mvz(id) on delete cascade,
  dia    date not null,
  motivo text,
  primary key (mvz_id, dia)
);

-- Catálogo de vacunas y desparasitantes con precio
create table catalogo_mvz (
  id       uuid primary key default gen_random_uuid(),
  mvz_id   uuid not null references mvz(id) on delete cascade,
  tipo     text not null check (tipo in ('vacuna','desparasitante')),
  nombre   text not null,
  especie  especie,
  precio   numeric(10,2) not null check (precio > 0),
  activo   boolean not null default true,
  created_at timestamptz not null default now()
);
create index on catalogo_mvz (mvz_id);

-- ---------------------------------------------------------------------
-- Reservas
-- ---------------------------------------------------------------------
create table reservas (
  id             uuid primary key default gen_random_uuid(),
  folio          bigint generated always as identity unique,
  tutor_id       uuid not null references tutores(id),
  mvz_id         uuid not null references mvz(id),
  mascota_id     uuid not null references mascotas(id),
  direccion_id   uuid not null references direcciones(id),
  alcaldia_id    smallint not null references alcaldias(id),
  tipo           tipo_consulta not null,
  inicia_at      timestamptz not null,
  termina_at     timestamptz not null,
  horario        tstzrange generated always as (tstzrange(inicia_at, termina_at, '[)')) stored,
  estado         estado_reserva not null default 'apartada',
  mismo_dia      boolean not null default false,
  subtotal       numeric(10,2) not null,     -- consulta o productos
  recargo        numeric(10,2) not null default 0,
  descuento_saldo numeric(10,2) not null default 0,
  total          numeric(10,2) not null,     -- lo que paga con tarjeta
  comision_pct   numeric(5,4) not null,      -- se congela al reservar
  cobrado_final  numeric(10,2),              -- lo que finalmente se cobra tras cancelaciones/ajustes
  motivo         text,
  sintomas       text,
  evolucion      text,
  info_adicional text,
  referencia_de  uuid references reservas(id),  -- consulta general que refirió (si aplica)
  apartada_hasta timestamptz,
  confirmada_at  timestamptz,
  llego_at       timestamptz,
  cerrada_at     timestamptz,
  cancelada_at   timestamptz,
  nota_cancelacion text,
  created_at     timestamptz not null default now(),
  check (termina_at > inicia_at)
);
-- La regla central: sin dobles reservas por MVZ ni por mascota
alter table reservas add constraint sin_doble_reserva_mvz
  exclude using gist (mvz_id with =, horario with &&)
  where (estado in ('apartada','confirmada','en_domicilio'));
alter table reservas add constraint sin_doble_cita_mascota
  exclude using gist (mascota_id with =, horario with &&)
  where (estado in ('apartada','confirmada','en_domicilio'));
create index on reservas (tutor_id);
create index on reservas (mvz_id, inicia_at);
create index on reservas (estado);

alter table cartilla add foreign key (reserva_id) references reservas(id);
alter table documentos_mascota add foreign key (reserva_id) references reservas(id);

-- Productos de una reserva de vacunación
create table reserva_productos (
  id          uuid primary key default gen_random_uuid(),
  reserva_id  uuid not null references reservas(id) on delete cascade,
  catalogo_id uuid references catalogo_mvz(id),
  nombre      text not null,
  precio      numeric(10,2) not null,
  aplicado    boolean            -- null = pendiente, false = no aplicado (se regresa)
);

-- ---------------------------------------------------------------------
-- Dinero
-- ---------------------------------------------------------------------
create table pagos (
  id              uuid primary key default gen_random_uuid(),
  reserva_id      uuid not null references reservas(id),
  concepto        text not null check (concepto in ('reserva','diferencia')),
  monto           numeric(10,2) not null check (monto > 0),
  estado          estado_pago not null default 'pendiente',
  proveedor       text not null default 'mercadopago',
  proveedor_id    text unique,
  liga_pago       text,
  tarjeta_marca   text,
  tarjeta_ult4    char(4),
  costo_pasarela  numeric(10,2),        -- real, según Mercado Pago
  llave_idempotencia text not null unique default gen_random_uuid()::text,
  created_at      timestamptz not null default now(),
  aprobado_at     timestamptz
);
create index on pagos (reserva_id);

create table reembolsos (
  id            uuid primary key default gen_random_uuid(),
  pago_id       uuid not null references pagos(id),
  monto         numeric(10,2) not null check (monto > 0),
  motivo        text not null check (motivo in ('cancelacion','cancelacion_tarde','mvz_no_llego',
                                                'producto_no_aplicado','diferencia_a_favor','soporte')),
  estado        text not null default 'por_procesar' check (estado in ('por_procesar','procesado','fallido')),
  proveedor_id  text,
  error         text,
  created_at    timestamptz not null default now(),
  procesado_at  timestamptz
);

-- Lo que se le debe a cada MVZ, consulta por consulta
create table saldo_mvz (
  id          uuid primary key default gen_random_uuid(),
  mvz_id      uuid not null references mvz(id),
  reserva_id  uuid references reservas(id),
  concepto    text not null check (concepto in ('consulta','cancelacion_tarde','tutor_ausente','diferencia',
                                                'descuento_inasistencia','ajuste')),
  bruto       numeric(10,2) not null,      -- lo cobrado (negativo en descuentos)
  comision    numeric(10,2) not null,
  neto        numeric(10,2) not null,      -- lo que recibe el MVZ
  estado      estado_saldo_mvz not null default 'retenido',
  deposito_id uuid,
  created_at  timestamptz not null default now()
);
create index on saldo_mvz (mvz_id, estado);

create table depositos (
  id          uuid primary key default gen_random_uuid(),
  mvz_id      uuid not null references mvz(id),
  monto       numeric(10,2) not null,
  clabe_ult4  char(4),
  referencia  text,
  pagado_el   date not null,
  registrado_por uuid references perfiles(id),
  created_at  timestamptz not null default now()
);
alter table saldo_mvz add foreign key (deposito_id) references depositos(id);

-- Invitaciones y saldo del tutor
create table invitaciones (
  id           uuid primary key default gen_random_uuid(),
  invita_id    uuid not null references tutores(id),
  invitado_id  uuid not null unique references tutores(id),
  estado       text not null default 'registrado' check (estado in ('registrado','activada','rechazada')),
  activada_at  timestamptz,
  created_at   timestamptz not null default now(),
  check (invita_id <> invitado_id)
);

create table saldo_tutor (
  id          uuid primary key default gen_random_uuid(),
  tutor_id    uuid not null references tutores(id),
  monto       numeric(10,2) not null,      -- positivo = abono, negativo = uso
  concepto    text not null check (concepto in ('invitacion','descuento_primera','uso','devolucion','vencimiento','ajuste')),
  reserva_id  uuid references reservas(id),
  invitacion_id uuid references invitaciones(id),
  liberado    boolean not null default true,    -- false hasta que la INE esté aprobada
  vence_el    date,
  created_at  timestamptz not null default now()
);
create index on saldo_tutor (tutor_id);

-- ---------------------------------------------------------------------
-- Clínico
-- ---------------------------------------------------------------------
create table registros_clinicos (
  id          uuid primary key default gen_random_uuid(),
  reserva_id  uuid not null unique references reservas(id),
  mascota_id  uuid not null references mascotas(id),
  mvz_id      uuid not null references mvz(id),
  created_at  timestamptz not null default now()
);

-- Solo se insertan versiones; nunca se editan ni se borran
create table registros_clinicos_versiones (
  registro_id     uuid not null references registros_clinicos(id),
  version         int not null,
  peso_kg         numeric(5,2),
  temperatura_c   numeric(4,1),
  valoracion      text,
  diagnosticos    text,
  indicaciones    text,
  tratamientos    text,
  recomendaciones text,
  seguimiento     text,
  motivo_cambio   text,        -- obligatorio desde la versión 2
  autor_id        uuid not null default auth.uid() references perfiles(id),
  created_at      timestamptz not null default now(),
  primary key (registro_id, version),
  check (version = 1 or coalesce(motivo_cambio, '') <> '')
);

create table referencias (
  id              uuid primary key default gen_random_uuid(),
  reserva_id      uuid not null references reservas(id),
  mascota_id      uuid not null references mascotas(id),
  mvz_id          uuid not null references mvz(id),
  especialidad_id int not null references especialidades(id),
  motivo          text not null,
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Comunicación
-- ---------------------------------------------------------------------
create table mensajes (
  id          uuid primary key default gen_random_uuid(),
  reserva_id  uuid not null references reservas(id),
  autor_id    uuid not null default auth.uid() references perfiles(id),
  texto       text check (char_length(texto) <= 2000),
  adjunto_ruta text,            -- chat/<reserva_id>/<archivo>
  created_at  timestamptz not null default now(),
  check (texto is not null or adjunto_ruta is not null)
);
create index on mensajes (reserva_id, created_at);

create table calificaciones (
  reserva_id  uuid primary key references reservas(id),
  tutor_id    uuid not null references tutores(id),
  mvz_id      uuid not null references mvz(id),
  estrellas   smallint not null check (estrellas between 1 and 5),
  comentario  text check (char_length(comentario) <= 1000),
  created_at  timestamptz not null default now()
);

create table reportes (
  id          uuid primary key default gen_random_uuid(),
  autor_id    uuid not null default auth.uid() references perfiles(id),
  reserva_id  uuid references reservas(id),
  tipo        text not null check (tipo in ('cobro_por_fuera','pago','conducta','tutor_ausente_disputa',
                                            'mvz_no_llego','seguridad','otro')),
  descripcion text not null,
  estado      text not null default 'abierto' check (estado in ('abierto','en_proceso','resuelto','descartado')),
  resolucion  text,
  atendido_por uuid references perfiles(id),
  created_at  timestamptz not null default now(),
  resuelto_at timestamptz
);

create table avisos (
  id            uuid primary key default gen_random_uuid(),
  reserva_id    uuid references reservas(id),
  destinatario_id uuid not null references perfiles(id),
  canal         text not null check (canal in ('correo','whatsapp')),
  plantilla     text not null,
  programado_at timestamptz not null default now(),
  estado        text not null default 'programado' check (estado in ('programado','enviando','enviado','fallido','cancelado')),
  intentos      int not null default 0,
  error         text,
  proveedor_id  text,
  enviado_at    timestamptz,
  created_at    timestamptz not null default now()
);
-- Evita avisos duplicados por reserva, persona, canal y plantilla
create unique index avisos_unicos on avisos (reserva_id, destinatario_id, canal, plantilla)
  where reserva_id is not null and estado <> 'cancelado';
create index on avisos (estado, programado_at);

-- ---------------------------------------------------------------------
-- Control: accesos y auditoría
-- ---------------------------------------------------------------------
create table registro_accesos (
  id        bigint generated always as identity primary key,
  actor_id  uuid,
  objeto    text not null,      -- direccion, expediente, documento_identidad, ...
  objeto_id text not null,
  reserva_id uuid,
  created_at timestamptz not null default now()
);
create index on registro_accesos (objeto, objeto_id);

create table auditoria (
  id        bigint generated always as identity primary key,
  tabla     text not null,
  fila_id   text,
  operacion text not null,
  antes     jsonb,
  despues   jsonb,
  actor_id  uuid,
  created_at timestamptz not null default now()
);
create index on auditoria (tabla, fila_id);

-- =====================================================================
-- Funciones de apoyo
-- =====================================================================
create function es_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((select es_admin from perfiles where id = auth.uid()), false) $$;

create function hora_cdmx(t timestamptz) returns timestamp
language sql immutable as $$ select t at time zone 'America/Mexico_City' $$;

-- ¿El MVZ actual tiene acceso operativo a esta reserva? (confirmada, en domicilio o cerrada hace < 72 h)
create function mvz_con_acceso(r reservas) returns boolean
language sql stable set search_path = public as $$
  select r.mvz_id = auth.uid() and (
    r.estado in ('confirmada','en_domicilio')
    or (r.estado in ('cerrada','tutor_ausente')
        and r.cerrada_at + make_interval(hours => param('horas_acceso_mvz')::int) > now())
  )
$$;

create function mvz_atiende_mascota(p_mascota uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from reservas r where r.mascota_id = p_mascota and mvz_con_acceso(r))
$$;

create function mvz_atiende_reserva(p_reserva uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from reservas r where r.id = p_reserva and mvz_con_acceso(r))
$$;

create function es_tutor_de_mascota(p_mascota uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from mascotas where id = p_mascota and tutor_id = auth.uid())
$$;

-- Chat abierto para quien participa: tutor o MVZ, desde confirmada hasta 72 h tras el cierre
create function chat_abierto(p_reserva uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from reservas r
    where r.id = p_reserva
      and (r.tutor_id = auth.uid() or r.mvz_id = auth.uid())
      and (r.estado in ('confirmada','en_domicilio')
           or (r.estado in ('cerrada','tutor_ausente')
               and r.cerrada_at + make_interval(hours => param('horas_acceso_mvz')::int) > now()))
  )
$$;

create function es_participante(p_reserva uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from reservas r where r.id = p_reserva
                 and (r.tutor_id = auth.uid() or r.mvz_id = auth.uid()))
$$;

create function reserva_de_mascota(p_reserva uuid, p_mascota uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from reservas where id = p_reserva and mascota_id = p_mascota)
$$;

create function registrar_acceso(p_objeto text, p_id text, p_reserva uuid default null) returns void
language sql security definer set search_path = public as $$
  insert into registro_accesos (actor_id, objeto, objeto_id, reserva_id) values (auth.uid(), p_objeto, p_id, p_reserva)
$$;

-- Lo que recibe el MVZ de un monto cobrado
create function neto_mvz(p_bruto numeric, p_pct numeric) returns numeric
language sql immutable as $$ select round(p_bruto * (1 - p_pct), 2) $$;

-- Costo estimado de Mercado Pago por un cobro (para reportes)
create function costo_pasarela(p_monto numeric) returns numeric
language sql stable as $$
  select round((p_monto * param('pasarela_pct') + param('pasarela_fijo')) * (1 + param('iva')), 2)
$$;

-- =====================================================================
-- Disparadores
-- =====================================================================
create function tocar_updated_at() returns trigger language plpgsql as
$$ begin new.updated_at := now(); return new; end $$;
create trigger perfiles_updated before update on perfiles for each row execute function tocar_updated_at();
create trigger mascotas_updated before update on mascotas for each row execute function tocar_updated_at();

-- Alta de cuenta: crea perfil + tutor o MVZ a partir de los datos del registro
create function nueva_cuenta() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_rol rol_cuenta := coalesce(new.raw_user_meta_data->>'rol', 'tutor')::rol_cuenta;
  v_codigo text := upper(new.raw_user_meta_data->>'codigo_invitacion');
  v_invita uuid;
begin
  insert into perfiles (id, rol, nombre, apellidos, correo, telefono, acepta_whatsapp, acepta_promos,
                        terminos_version, terminos_aceptados_at)
  values (new.id, v_rol,
          coalesce(new.raw_user_meta_data->>'nombre', ''),
          coalesce(new.raw_user_meta_data->>'apellidos', ''),
          new.email,
          new.raw_user_meta_data->>'telefono',
          coalesce((new.raw_user_meta_data->>'acepta_whatsapp')::boolean, false),
          coalesce((new.raw_user_meta_data->>'acepta_promos')::boolean, false),
          new.raw_user_meta_data->>'terminos_version',
          case when new.raw_user_meta_data ? 'terminos_version' then now() end);
  if v_rol = 'tutor' then
    select id into v_invita from tutores where codigo_invitacion = v_codigo;
    insert into tutores (id, invitado_por) values (new.id, v_invita);
    if v_invita is not null then
      insert into invitaciones (invita_id, invitado_id) values (v_invita, new.id);
    end if;
  else
    insert into mvz (id) values (new.id);
  end if;
  return new;
end $$;
create trigger al_crear_usuario after insert on auth.users
  for each row execute function nueva_cuenta();

-- Al subir el primer documento, la cuenta pasa a "pendiente" de revisión
create function documento_subido() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.tipo in ('ine_frente','ine_reverso','selfie_ine') then
    update tutores set estado_ine = 'pendiente'
      where id = new.cuenta_id and estado_ine in ('sin_enviar','info_requerida','rechazado');
  end if;
  if new.tipo = 'especialidad' then
    update mvz set estado_especialidad = 'pendiente'
      where id = new.cuenta_id and estado_especialidad in ('sin_enviar','info_requerida','rechazado');
  end if;
  return new;
end $$;
create trigger al_subir_documento after insert on documentos_verificacion
  for each row execute function documento_subido();

-- Si el MVZ cambia su CLABE, vuelve a revisión
create function clabe_cambiada() returns trigger language plpgsql as $$
begin
  if new.clabe is distinct from old.clabe and not es_admin() then
    new.estado_clabe := 'pendiente';
  end if;
  return new;
end $$;
create trigger mvz_clabe before update on mvz for each row execute function clabe_cambiada();

-- Alcaldía automática por código postal (si el CP está en el catálogo)
create function alcaldia_por_cp() returns trigger language plpgsql as $$
declare v smallint;
begin
  select alcaldia_id into v from codigos_postales where cp = new.cp;
  if v is not null then new.alcaldia_id := v; end if;
  return new;
end $$;
create trigger direcciones_cp before insert or update of cp on direcciones
  for each row execute function alcaldia_por_cp();

-- Oculta teléfonos y correos escritos en el chat
create function ocultar_contacto(t text) returns text language sql immutable as $$
  select regexp_replace(
           regexp_replace(t, '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[dato oculto]', 'g'),
           '(\+?\d[\s.-]?){8,}', '[dato oculto] ', 'g')
$$;
create function mensaje_limpio() returns trigger language plpgsql as $$
begin
  if new.texto is not null then new.texto := ocultar_contacto(new.texto); end if;
  return new;
end $$;
create trigger mensajes_limpios before insert on mensajes for each row execute function mensaje_limpio();

-- Calificación promedio del MVZ
create function recalcular_calificacion() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update mvz set calificacion_prom = s.prom, calificaciones_n = s.n
  from (select round(avg(estrellas)::numeric, 2) prom, count(*) n from calificaciones where mvz_id = new.mvz_id) s
  where mvz.id = new.mvz_id;
  return new;
end $$;
create trigger calificacion_nueva after insert on calificaciones
  for each row execute function recalcular_calificacion();

-- Auditoría genérica
create function auditar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into auditoria (tabla, fila_id, operacion, antes, despues, actor_id)
  values (tg_table_name,
          coalesce(to_jsonb(new)->>'id', to_jsonb(old)->>'id', to_jsonb(new)->>'clave', to_jsonb(new)->>'reserva_id'),
          tg_op,
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end,
          auth.uid());
  return coalesce(new, old);
end $$;
do $$
declare t text;
begin
  foreach t in array array['perfiles','tutores','mvz','reservas','pagos','reembolsos','saldo_mvz',
                           'depositos','parametros','revisiones','saldo_tutor','reportes','mascotas','direcciones']
  loop
    execute format('create trigger auditar_%1$s after insert or update or delete on %1$I
                    for each row execute function auditar()', t);
  end loop;
end $$;

-- =====================================================================
-- Agenda: bloques disponibles
-- =====================================================================
-- Bloques libres para una alcaldía y un día (hora de CDMX). Lo usa el asistente de reserva.
create function bloques_disponibles(p_alcaldia smallint, p_dia date, p_tipo tipo_consulta default 'general')
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

-- =====================================================================
-- Reservas: ciclo de vida (todas las transiciones pasan por aquí)
-- =====================================================================

-- 1. Apartar el bloque (10 min) y calcular el total. El pago lo crea después la Edge Function.
create function reservar(
  p_mascota uuid, p_direccion uuid, p_mvz uuid, p_inicia timestamptz, p_tipo tipo_consulta,
  p_productos uuid[] default '{}', p_motivo text default null, p_sintomas text default null,
  p_evolucion text default null, p_info text default null, p_usar_saldo boolean default false,
  p_referencia uuid default null
) returns reservas
language plpgsql security definer set search_path = public as $$
declare
  v_dir direcciones;
  v_slot record;
  v_sub numeric;
  v_rec numeric := 0;
  v_saldo numeric := 0;
  v_res reservas;
begin
  if not exists (select 1 from tutores t join perfiles p on p.id = t.id
                 where t.id = auth.uid() and not p.suspendido and t.estado_ine <> 'rechazado') then
    raise exception 'Tu cuenta no puede agendar en este momento' using errcode = 'P0001';
  end if;
  if not es_tutor_de_mascota(p_mascota) or
     exists (select 1 from mascotas where id = p_mascota and borrada_at is not null) then
    raise exception 'Mascota no válida' using errcode = 'P0001';
  end if;
  select * into v_dir from direcciones where id = p_direccion and tutor_id = auth.uid() and borrada_at is null;
  if not found then raise exception 'Dirección no válida' using errcode = 'P0001'; end if;

  select * into v_slot
  from bloques_disponibles(v_dir.alcaldia_id, hora_cdmx(p_inicia)::date, p_tipo) b
  where b.mvz_id = p_mvz and b.inicia_at = p_inicia;
  if not found then
    raise exception 'Ese horario ya no está disponible' using errcode = 'P0002';
  end if;

  if p_tipo = 'vacunacion' then
    select sum(precio) into v_sub from catalogo_mvz
     where id = any(p_productos) and mvz_id = p_mvz and activo;
    if v_sub is null or (select count(*) from catalogo_mvz where id = any(p_productos) and mvz_id = p_mvz and activo)
                        <> coalesce(array_length(p_productos, 1), 0) then
      raise exception 'Elige productos del catálogo de este médico veterinario' using errcode = 'P0001';
    end if;
  else
    v_sub := (select case p_tipo when 'general' then precio_general else precio_especialidad end
              from mvz where id = p_mvz);
  end if;
  if v_slot.mismo_dia then v_rec := round(v_sub * param('recargo_mismo_dia'), 2); end if;

  if p_usar_saldo then
    select coalesce(sum(monto), 0) into v_saldo from saldo_tutor
     where tutor_id = auth.uid() and liberado and (vence_el is null or vence_el >= current_date);
    v_saldo := least(greatest(v_saldo, 0), v_sub + v_rec - 1);   -- siempre queda un cobro con tarjeta
  end if;

  begin
    insert into reservas (tutor_id, mvz_id, mascota_id, direccion_id, alcaldia_id, tipo, inicia_at, termina_at,
                          mismo_dia, subtotal, recargo, descuento_saldo, total, comision_pct, motivo, sintomas,
                          evolucion, info_adicional, referencia_de, apartada_hasta)
    values (auth.uid(), p_mvz, p_mascota, p_direccion, v_dir.alcaldia_id, p_tipo, v_slot.inicia_at, v_slot.termina_at,
            v_slot.mismo_dia, v_sub, v_rec, v_saldo, v_sub + v_rec - v_saldo, param('comision'),
            p_motivo, p_sintomas, p_evolucion, p_info, p_referencia,
            now() + make_interval(mins => param('minutos_apartado')::int))
    returning * into v_res;
  exception when exclusion_violation then
    raise exception 'Ese horario se acaba de ocupar o tu mascota ya tiene una cita a esa hora' using errcode = 'P0002';
  end;

  if p_tipo = 'vacunacion' then
    insert into reserva_productos (reserva_id, catalogo_id, nombre, precio)
    select v_res.id, id, nombre, precio from catalogo_mvz where id = any(p_productos);
  end if;
  if v_saldo > 0 then
    insert into saldo_tutor (tutor_id, monto, concepto, reserva_id) values (auth.uid(), -v_saldo, 'uso', v_res.id);
  end if;
  return v_res;
end $$;

-- 2. Pago aprobado (solo servidor: webhook de Mercado Pago)
create function confirmar_pago(p_pago uuid, p_proveedor_id text, p_marca text, p_ult4 text, p_costo numeric)
returns reservas
language plpgsql security definer set search_path = public as $$
declare v_pago pagos; v_res reservas; v_comision numeric;
begin
  update pagos set estado = 'aprobado', proveedor_id = p_proveedor_id, tarjeta_marca = p_marca,
                   tarjeta_ult4 = p_ult4, costo_pasarela = p_costo, aprobado_at = now()
   where id = p_pago and estado = 'pendiente' returning * into v_pago;
  if not found then  -- webhook repetido: no hace nada
    select r.* into v_res from reservas r join pagos p on p.reserva_id = r.id where p.id = p_pago;
    return v_res;
  end if;

  select * into v_res from reservas where id = v_pago.reserva_id for update;

  if v_pago.concepto = 'diferencia' then
    v_comision := round(v_pago.monto * v_res.comision_pct, 2);
    insert into saldo_mvz (mvz_id, reserva_id, concepto, bruto, comision, neto, estado)
    values (v_res.mvz_id, v_res.id, 'diferencia', v_pago.monto, v_comision, v_pago.monto - v_comision,
            (case when v_res.estado = 'cerrada' then 'por_depositar' else 'retenido' end)::estado_saldo_mvz);
    return v_res;
  end if;

  if v_res.estado = 'expirada' then
    -- Pagó después de los 10 min: se reactiva si el bloque sigue libre; si no, reembolso total
    begin
      update reservas set estado = 'confirmada', confirmada_at = now() where id = v_res.id returning * into v_res;
      insert into saldo_tutor (tutor_id, monto, concepto, reserva_id)
      select v_res.tutor_id, -v_res.descuento_saldo, 'uso', v_res.id where v_res.descuento_saldo > 0;
    exception when exclusion_violation then
      insert into reembolsos (pago_id, monto, motivo) values (v_pago.id, v_pago.monto, 'soporte');
      update pagos set estado = 'reembolsado' where id = v_pago.id;
      return v_res;
    end;
  elsif v_res.estado = 'apartada' then
    update reservas set estado = 'confirmada', confirmada_at = now() where id = v_res.id returning * into v_res;
  else
    return v_res;
  end if;

  -- Lo del MVZ queda retenido hasta el cierre (sobre lo pagado + saldo usado: el saldo lo absorbe LilieVET)
  v_comision := round((v_res.subtotal + v_res.recargo) * v_res.comision_pct, 2);
  insert into saldo_mvz (mvz_id, reserva_id, concepto, bruto, comision, neto)
  values (v_res.mvz_id, v_res.id, 'consulta', v_res.subtotal + v_res.recargo, v_comision,
          v_res.subtotal + v_res.recargo - v_comision);

  -- Avisos: confirmación ya, recordatorio 1 h antes, para tutor y MVZ por correo y WhatsApp
  insert into avisos (reserva_id, destinatario_id, canal, plantilla, programado_at)
  select v_res.id, d.id, c.canal, pl.plantilla,
         case pl.plantilla when 'cita_confirmada' then now() else v_res.inicia_at - interval '1 hour' end
  from (values (v_res.tutor_id), (v_res.mvz_id)) d(id)
  cross join (values ('correo'), ('whatsapp')) c(canal)
  cross join (values ('cita_confirmada'), ('recordatorio_1h')) pl(plantilla)
  join perfiles pf on pf.id = d.id
  where c.canal = 'correo' or pf.acepta_whatsapp
  on conflict do nothing;
  return v_res;
end $$;

-- Pago rechazado (solo servidor)
create function rechazar_pago(p_pago uuid, p_detalle text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  update pagos set estado = 'rechazado' where id = p_pago and estado = 'pendiente';
end $$;

-- 3. Libera bloques no pagados (tarea programada cada minuto)
create function expirar_apartados() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  with e as (
    update reservas set estado = 'expirada'
     where estado = 'apartada' and apartada_hasta < now() returning id
  ), s as (
    delete from saldo_tutor where concepto = 'uso' and reserva_id in (select id from e) returning 1
  )
  select count(*) into n from e;
  return n;
end $$;

-- 4. El MVZ llegó al domicilio
create function marcar_llegada(p_reserva uuid) returns reservas
language plpgsql security definer set search_path = public as $$
declare v reservas;
begin
  update reservas set estado = 'en_domicilio', llego_at = now()
   where id = p_reserva and mvz_id = auth.uid() and estado = 'confirmada'
     and now() >= inicia_at - interval '1 hour'
  returning * into v;
  if not found then raise exception 'No se puede marcar la llegada ahora' using errcode = 'P0001'; end if;
  return v;
end $$;

-- 5. Cerrar la consulta (productos de vacunación no aplicados se regresan)
create function cerrar_consulta(p_reserva uuid, p_no_aplicados uuid[] default '{}') returns reservas
language plpgsql security definer set search_path = public as $$
declare v reservas; v_regreso numeric := 0; v_pago uuid;
begin
  select * into v from reservas where id = p_reserva and mvz_id = auth.uid() and estado = 'en_domicilio' for update;
  if not found then raise exception 'Solo se puede cerrar una consulta en curso' using errcode = 'P0001'; end if;

  if v.tipo = 'vacunacion' then
    update reserva_productos set aplicado = not (id = any(p_no_aplicados)) where reserva_id = v.id;
    -- Se regresa el precio de lo no aplicado más su parte del recargo de mismo día
    select round(coalesce(sum(precio), 0) * (v.subtotal + v.recargo) / v.subtotal, 2) into v_regreso
      from reserva_productos where reserva_id = v.id and not aplicado;
    if v_regreso > 0 then
      v_regreso := least(v_regreso, v.total);
      select id into v_pago from pagos where reserva_id = v.id and concepto = 'reserva' and estado = 'aprobado';
      insert into reembolsos (pago_id, monto, motivo) values (v_pago, v_regreso, 'producto_no_aplicado');
      update saldo_mvz set bruto = bruto - v_regreso,
                           comision = round((bruto - v_regreso) * v.comision_pct, 2),
                           neto = (bruto - v_regreso) - round((bruto - v_regreso) * v.comision_pct, 2)
       where reserva_id = v.id and concepto = 'consulta';
    end if;
  end if;

  -- cobrado_final = valor del servicio cobrado (tarjeta + saldo), ya con diferencias y regresos
  update reservas set estado = 'cerrada', cerrada_at = now(), cobrado_final = subtotal + recargo - v_regreso
   where id = v.id returning * into v;
  update saldo_mvz set estado = 'por_depositar' where reserva_id = v.id and estado = 'retenido';
  update mvz set inasistencias_seguidas = 0 where id = v.mvz_id;

  -- Recordatorios al MVZ si no captura la información clínica (se cancelan al capturarla)
  if not exists (select 1 from registros_clinicos where reserva_id = v.id) then
    insert into avisos (reserva_id, destinatario_id, canal, plantilla, programado_at)
    values (v.id, v.mvz_id, 'correo', 'captura_pendiente_24h', now() + interval '24 hours'),
           (v.id, v.mvz_id, 'correo', 'captura_pendiente_48h', now() + interval '48 hours')
    on conflict do nothing;
  end if;
  insert into avisos (reserva_id, destinatario_id, canal, plantilla, programado_at)
  values (v.id, v.tutor_id, 'correo', 'califica_consulta', now() + interval '2 hours')
  on conflict do nothing;
  return v;
end $$;

-- 6. Tutor ausente (25 min después de "Llegué"): se cobra 100%
create function marcar_tutor_ausente(p_reserva uuid) returns reservas
language plpgsql security definer set search_path = public as $$
declare v reservas; v_cobro numeric; v_pago uuid;
begin
  select * into v from reservas where id = p_reserva and mvz_id = auth.uid() and estado = 'en_domicilio' for update;
  if not found or now() < v.llego_at + make_interval(mins => param('minutos_espera_ausente')::int) then
    raise exception 'Aún no se cumple el tiempo de espera' using errcode = 'P0001';
  end if;
  v_cobro := round((v.subtotal + v.recargo) * param('cobro_tutor_ausente'), 2);
  if v_cobro < v.subtotal + v.recargo then
    select id into v_pago from pagos where reserva_id = v.id and concepto = 'reserva' and estado = 'aprobado';
    insert into reembolsos (pago_id, monto, motivo)
    values (v_pago, least(v.total, v.subtotal + v.recargo - v_cobro), 'cancelacion_tarde');
  end if;
  update reservas set estado = 'tutor_ausente', cerrada_at = now(), cobrado_final = v_cobro
   where id = v.id returning * into v;
  update saldo_mvz set concepto = 'tutor_ausente', bruto = v_cobro,
                       comision = round(v_cobro * v.comision_pct, 2),
                       neto = v_cobro - round(v_cobro * v.comision_pct, 2), estado = 'por_depositar'
   where reserva_id = v.id and concepto = 'consulta';
  update avisos set estado = 'cancelado' where reserva_id = v.id and estado = 'programado';
  insert into avisos (reserva_id, destinatario_id, canal, plantilla)
  values (v.id, v.tutor_id, 'correo', 'tutor_ausente') on conflict do nothing;
  return v;
end $$;

-- 7. El tutor cancela: gratis con 24 h o más; después se cobra 50%
create function cancelar_reserva(p_reserva uuid, p_nota text default null) returns reservas
language plpgsql security definer set search_path = public as $$
declare v reservas; v_pago uuid; v_cobro numeric := 0; v_tarde boolean;
begin
  select * into v from reservas where id = p_reserva and tutor_id = auth.uid() for update;
  if not found then raise exception 'Reserva no encontrada' using errcode = 'P0001'; end if;

  if v.estado = 'apartada' then
    update reservas set estado = 'expirada', cancelada_at = now() where id = v.id returning * into v;
    delete from saldo_tutor where reserva_id = v.id and concepto = 'uso';
    return v;
  end if;
  if v.estado <> 'confirmada' then
    raise exception 'Esta consulta ya no se puede cancelar desde la app' using errcode = 'P0001';
  end if;

  v_tarde := v.inicia_at - now() < make_interval(hours => param('horas_cancelacion')::int);
  select id into v_pago from pagos where reserva_id = v.id and concepto = 'reserva' and estado = 'aprobado';

  if v_tarde then
    v_cobro := round((v.subtotal + v.recargo) * param('cobro_cancelacion_tarde'), 2);
    -- Se regresa a la tarjeta lo pagado menos lo que se cobra (el saldo usado cuenta primero como cobro)
    if v.total - greatest(v_cobro - v.descuento_saldo, 0) > 0 then
      insert into reembolsos (pago_id, monto, motivo)
      values (v_pago, v.total - greatest(v_cobro - v.descuento_saldo, 0), 'cancelacion_tarde');
    end if;
    update saldo_mvz set concepto = 'cancelacion_tarde', bruto = v_cobro,
                         comision = round(v_cobro * v.comision_pct, 2),
                         neto = v_cobro - round(v_cobro * v.comision_pct, 2), estado = 'por_depositar'
     where reserva_id = v.id and concepto = 'consulta';
  else
    insert into reembolsos (pago_id, monto, motivo) values (v_pago, v.total, 'cancelacion');
    insert into saldo_tutor (tutor_id, monto, concepto, reserva_id)
    select v.tutor_id, v.descuento_saldo, 'devolucion', v.id where v.descuento_saldo > 0;
    update saldo_mvz set estado = 'anulado' where reserva_id = v.id;
  end if;

  update reservas set estado = case when v_tarde then 'cancelada_tarde' else 'cancelada_tutor' end::estado_reserva,
                      cancelada_at = now(), cobrado_final = v_cobro, nota_cancelacion = p_nota
   where id = v.id returning * into v;
  update avisos set estado = 'cancelado' where reserva_id = v.id and estado = 'programado';
  insert into avisos (reserva_id, destinatario_id, canal, plantilla)
  values (v.id, v.tutor_id, 'correo', 'cita_cancelada'), (v.id, v.mvz_id, 'correo', 'cita_cancelada')
  on conflict do nothing;
  return v;
end $$;

-- 8. El MVZ no llegó (lo confirma soporte): reembolso total y descuento al MVZ
create function registrar_mvz_no_llego(p_reserva uuid, p_nota text) returns reservas
language plpgsql security definer set search_path = public as $$
declare v reservas; v_pago uuid; v_bruto numeric; v_desc numeric;
begin
  if not es_admin() then raise exception 'Solo admin' using errcode = '42501'; end if;
  select * into v from reservas where id = p_reserva and estado in ('confirmada','en_domicilio') for update;
  if not found then raise exception 'Reserva no válida' using errcode = 'P0001'; end if;
  select id into v_pago from pagos where reserva_id = v.id and concepto = 'reserva' and estado = 'aprobado';
  insert into reembolsos (pago_id, monto, motivo) values (v_pago, v.total, 'mvz_no_llego');
  insert into saldo_tutor (tutor_id, monto, concepto, reserva_id)
  select v.tutor_id, v.descuento_saldo, 'devolucion', v.id where v.descuento_saldo > 0;
  update saldo_mvz set estado = 'anulado' where reserva_id = v.id;
  v_bruto := v.subtotal + v.recargo;
  v_desc := round(v_bruto * v.comision_pct, 2) + costo_pasarela(v.total);
  insert into saldo_mvz (mvz_id, reserva_id, concepto, bruto, comision, neto, estado)
  values (v.mvz_id, v.id, 'descuento_inasistencia', 0, 0, -v_desc, 'por_depositar');
  update reservas set estado = 'mvz_no_llego', cancelada_at = now(), cobrado_final = 0, nota_cancelacion = p_nota
   where id = v.id returning * into v;
  update mvz set inasistencias_seguidas = inasistencias_seguidas + 1 where id = v.mvz_id;
  update perfiles set suspendido = true
   where id = v.mvz_id and (select inasistencias_seguidas from mvz where id = v.mvz_id) >= param('inasistencias_baja');
  update avisos set estado = 'cancelado' where reserva_id = v.id and estado = 'programado';
  return v;
end $$;

-- 9. Cambiar una vacunación a consulta: crea el cobro de la diferencia (la liga la genera el servidor)
create function cambiar_a_consulta(p_reserva uuid) returns pagos
language plpgsql security definer set search_path = public as $$
declare v reservas; v_precio numeric; v_dif numeric; v_pago pagos; v_pago_res uuid;
begin
  select * into v from reservas where id = p_reserva and mvz_id = auth.uid()
     and tipo = 'vacunacion' and estado = 'en_domicilio' for update;
  if not found then raise exception 'Solo durante una vacunación en curso' using errcode = 'P0001'; end if;
  select precio_general into v_precio from mvz where id = v.mvz_id;
  v_precio := v_precio * case when v.mismo_dia then 1 + param('recargo_mismo_dia') else 1 end;
  v_dif := v_precio - (v.subtotal + v.recargo);
  update reservas set tipo = 'general', subtotal = v_precio, recargo = 0 where id = v.id;
  update reserva_productos set aplicado = false where reserva_id = v.id;
  update saldo_mvz set bruto = least(bruto, v_precio),
                       comision = round(least(bruto, v_precio) * v.comision_pct, 2),
                       neto = least(bruto, v_precio) - round(least(bruto, v_precio) * v.comision_pct, 2)
   where reserva_id = v.id and concepto = 'consulta';
  if v_dif > 0 then
    insert into pagos (reserva_id, concepto, monto) values (v.id, 'diferencia', v_dif) returning * into v_pago;
  elsif v_dif < 0 then
    select id into v_pago_res from pagos where reserva_id = v.id and concepto = 'reserva' and estado = 'aprobado';
    insert into reembolsos (pago_id, monto, motivo) values (v_pago_res, -v_dif, 'diferencia_a_favor');
    update reservas set total = total + v_dif where id = v.id;
  end if;
  return v_pago;
end $$;

-- =====================================================================
-- Clínico, chat y calificaciones
-- =====================================================================
create function guardar_registro_clinico(
  p_reserva uuid, p_valoracion text, p_diagnosticos text, p_indicaciones text, p_tratamientos text,
  p_recomendaciones text, p_seguimiento text, p_peso numeric default null, p_temperatura numeric default null,
  p_motivo_cambio text default null
) returns registros_clinicos_versiones
language plpgsql security definer set search_path = public as $$
declare v reservas; v_reg uuid; v_ver int; v_out registros_clinicos_versiones;
begin
  select * into v from reservas where id = p_reserva;
  if not found or not mvz_con_acceso(v) or v.estado not in ('en_domicilio','cerrada','tutor_ausente') then
    raise exception 'No puedes registrar información de esta consulta' using errcode = '42501';
  end if;
  insert into registros_clinicos (reserva_id, mascota_id, mvz_id) values (v.id, v.mascota_id, v.mvz_id)
  on conflict (reserva_id) do nothing;
  select id into v_reg from registros_clinicos where reserva_id = v.id;
  select coalesce(max(version), 0) + 1 into v_ver from registros_clinicos_versiones where registro_id = v_reg;
  insert into registros_clinicos_versiones (registro_id, version, peso_kg, temperatura_c, valoracion, diagnosticos,
     indicaciones, tratamientos, recomendaciones, seguimiento, motivo_cambio)
  values (v_reg, v_ver, p_peso, p_temperatura, p_valoracion, p_diagnosticos, p_indicaciones, p_tratamientos,
          p_recomendaciones, p_seguimiento, p_motivo_cambio)
  returning * into v_out;
  if p_peso is not null then update mascotas set peso_kg = p_peso where id = v.mascota_id; end if;
  update avisos set estado = 'cancelado'
   where reserva_id = v.id and plantilla like 'captura_pendiente%' and estado = 'programado';
  return v_out;
end $$;

-- Historia clínica de un paciente (última versión de cada consulta). Tutor dueño, MVZ con acceso o admin.
create function historia_clinica(p_mascota uuid)
returns table (reserva_id uuid, fecha timestamptz, tipo tipo_consulta, motivo text, version int,
               peso_kg numeric, temperatura_c numeric, valoracion text, diagnosticos text, indicaciones text,
               tratamientos text, recomendaciones text, seguimiento text, medico text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (es_tutor_de_mascota(p_mascota) or mvz_atiende_mascota(p_mascota) or es_admin()) then
    raise exception 'Sin acceso' using errcode = '42501';
  end if;
  return query
  select r.id, r.inicia_at, r.tipo, r.motivo, v.version, v.peso_kg, v.temperatura_c, v.valoracion, v.diagnosticos,
         v.indicaciones, v.tratamientos, v.recomendaciones, v.seguimiento,
         case when es_tutor_de_mascota(p_mascota) or es_admin() then pf.nombre || ' ' || pf.apellidos end
  from registros_clinicos rc
  join reservas r on r.id = rc.reserva_id
  join perfiles pf on pf.id = rc.mvz_id
  join lateral (select * from registros_clinicos_versiones x where x.registro_id = rc.id
                order by version desc limit 1) v on true
  where rc.mascota_id = p_mascota
  order by r.inicia_at desc;
end $$;

-- Dirección completa para el MVZ asignado (queda registrado cada acceso)
create function direccion_de_reserva(p_reserva uuid) returns direcciones
language plpgsql security definer set search_path = public as $$
declare v reservas; d direcciones;
begin
  select * into v from reservas where id = p_reserva;
  if not found then raise exception 'Sin acceso' using errcode = '42501'; end if;
  if not (v.tutor_id = auth.uid() or es_admin() or
          (v.mvz_id = auth.uid() and v.estado in ('confirmada','en_domicilio'))) then
    raise exception 'Sin acceso' using errcode = '42501';
  end if;
  select * into d from direcciones where id = v.direccion_id;
  if v.mvz_id = auth.uid() or es_admin() then
    perform registrar_acceso('direccion', d.id::text, v.id);
  end if;
  return d;
end $$;

-- Reservas del MVZ con lo que necesita ver (sin teléfono, correo ni INE del tutor)
create function mis_consultas_mvz(p_desde date default null, p_hasta date default null)
returns table (id uuid, folio bigint, estado estado_reserva, tipo tipo_consulta, inicia_at timestamptz,
               termina_at timestamptz, alcaldia text, colonia text, tutor_nombre text, mascota_id uuid,
               mascota_nombre text, especie especie, motivo text, sintomas text, evolucion text,
               info_adicional text, total_mvz numeric, con_acceso boolean)
language sql stable security definer set search_path = public as $$
  select r.id, r.folio, r.estado, r.tipo, r.inicia_at, r.termina_at, a.nombre,
         case when mvz_con_acceso(r) then d.colonia end,
         pf.nombre, r.mascota_id, m.nombre, m.especie,
         case when mvz_con_acceso(r) then r.motivo end,
         case when mvz_con_acceso(r) then r.sintomas end,
         case when mvz_con_acceso(r) then r.evolucion end,
         case when mvz_con_acceso(r) then r.info_adicional end,
         (select sum(neto) from saldo_mvz s where s.reserva_id = r.id and s.estado <> 'anulado'),
         mvz_con_acceso(r)
  from reservas r
  join alcaldias a on a.id = r.alcaldia_id
  join direcciones d on d.id = r.direccion_id
  join perfiles pf on pf.id = r.tutor_id
  join mascotas m on m.id = r.mascota_id
  where r.mvz_id = auth.uid()
    and r.estado not in ('apartada','expirada')
    and (p_desde is null or hora_cdmx(r.inicia_at)::date >= p_desde)
    and (p_hasta is null or hora_cdmx(r.inicia_at)::date <= p_hasta)
  order by r.inicia_at
$$;

-- Perfiles públicos de MVZ aprobados (sin CLABE, RFC, INE ni cédula escaneada)
create view mvz_publicos with (security_barrier) as
  select m.id, p.nombre, p.apellidos, m.bio, m.foto_path, m.cedula, e.nombre as especialidad,
         m.precio_general, m.precio_especialidad, m.acepta_mismo_dia, m.calificacion_prom, m.calificaciones_n
  from mvz m join perfiles p on p.id = m.id
  left join especialidades e on e.id = m.especialidad_id and m.estado_especialidad = 'aprobado'
  where m.estado = 'aprobado' and not p.suspendido;

-- =====================================================================
-- Admin
-- =====================================================================
create function revisar_cuenta(p_cuenta uuid, p_objeto text, p_decision estado_verif, p_nota text default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not es_admin() then raise exception 'Solo admin' using errcode = '42501'; end if;
  if p_decision in ('rechazado','info_requerida') and coalesce(p_nota, '') = '' then
    raise exception 'Escribe una nota para el usuario' using errcode = 'P0001';
  end if;
  case p_objeto
    when 'ine_tutor' then
      update tutores set estado_ine = p_decision where id = p_cuenta;
      if p_decision = 'aprobado' then
        update saldo_tutor set liberado = true where tutor_id = p_cuenta and not liberado;
      end if;
    when 'alta_mvz'     then update mvz set estado = p_decision where id = p_cuenta;
    when 'especialidad' then update mvz set estado_especialidad = p_decision where id = p_cuenta;
    when 'clabe'        then update mvz set estado_clabe = p_decision where id = p_cuenta;
    when 'cuenta'       then update perfiles set suspendido = (p_decision = 'suspendido') where id = p_cuenta;
    else raise exception 'Objeto no válido';
  end case;
  insert into revisiones (cuenta_id, objeto, decision, nota, revisado_por)
  values (p_cuenta, p_objeto, p_decision, p_nota, auth.uid());
  insert into avisos (destinatario_id, canal, plantilla) values (p_cuenta, 'correo', 'revision_' || p_objeto || '_' || p_decision);
end $$;

-- Activa la invitación cuando el invitado paga su primera consulta (la llama el servidor tras confirmar_pago)
create function activar_invitacion(p_tutor uuid) returns void
language plpgsql security definer set search_path = public as $$
declare i invitaciones; v_ine estado_verif; v_n int;
begin
  select * into i from invitaciones where invitado_id = p_tutor and estado = 'registrado' for update;
  if not found then return; end if;
  select count(*) into v_n from invitaciones
   where invita_id = i.invita_id and estado = 'activada' and activada_at > now() - interval '1 year';
  if v_n >= param('invitaciones_max_anio') then
    update invitaciones set estado = 'rechazada' where id = i.id; return;
  end if;
  select estado_ine into v_ine from tutores where id = i.invita_id;
  update invitaciones set estado = 'activada', activada_at = now() where id = i.id;
  insert into saldo_tutor (tutor_id, monto, concepto, invitacion_id, liberado, vence_el)
  values (i.invita_id, param('invitacion_monto'), 'invitacion', i.id, v_ine = 'aprobado',
          current_date + make_interval(months => param('meses_vigencia_saldo')::int));
end $$;

create function crear_admin(p_correo text) returns text
language plpgsql security definer set search_path = public as $$
begin
  update perfiles set es_admin = true where correo = p_correo;
  if not found then return 'No existe una cuenta con ese correo'; end if;
  return 'Listo: ' || p_correo || ' es admin';
end $$;

-- Resumen financiero por mes (Panel)
create view finanzas_mensuales as
  select date_trunc('month', hora_cdmx(r.confirmada_at))::date as mes,
         count(*) filter (where r.estado in ('cerrada','tutor_ausente','cancelada_tarde')) as consultas_cobradas,
         sum(r.cobrado_final) filter (where r.estado in ('cerrada','tutor_ausente','cancelada_tarde')) as cobrado,
         sum(s.comision) as comisiones,
         sum(p.costo_pasarela) as pasarela,
         sum(s.comision) - coalesce(sum(p.costo_pasarela), 0) as queda_lilievet,
         sum(s.neto) filter (where s.estado = 'retenido') as retenido_mvz,
         sum(s.neto) filter (where s.estado = 'por_depositar') as por_depositar_mvz,
         sum(s.neto) filter (where s.estado = 'depositado') as depositado_mvz
  from reservas r
  left join lateral (select sum(comision) comision, sum(neto) neto, min(estado::text)::estado_saldo_mvz estado
                     from saldo_mvz where reserva_id = r.id and estado <> 'anulado') s on true
  left join lateral (select sum(costo_pasarela) costo_pasarela from pagos where reserva_id = r.id and estado <> 'rechazado') p on true
  where r.confirmada_at is not null
  group by 1 order by 1 desc;

-- =====================================================================
-- Seguridad por fila (RLS)
-- =====================================================================
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on table %I from anon, authenticated', t);
  end loop;
end $$;
revoke all on all functions in schema public from public, anon;
revoke execute on all functions in schema public from authenticated;

-- Catálogos: lectura para todos con sesión
grant select on alcaldias, codigos_postales, especialidades, parametros to authenticated;
create policy lectura on alcaldias for select to authenticated using (true);
create policy lectura on codigos_postales for select to authenticated using (true);
create policy lectura on especialidades for select to authenticated using (true);
create policy lectura on parametros for select to authenticated using (true);
grant update (valor) on parametros to authenticated;
create policy admin_edita on parametros for update to authenticated using (es_admin());
grant insert, update on especialidades to authenticated;
create policy admin_edita on especialidades for all to authenticated using (es_admin()) with check (es_admin());

-- Perfiles: cada quien el suyo; admin todos. Solo datos personales se editan aquí.
grant select on perfiles to authenticated;
grant update (nombre, apellidos, telefono, acepta_whatsapp, acepta_promos, terminos_version, terminos_aceptados_at)
  on perfiles to authenticated;
create policy propio on perfiles for select to authenticated using (id = auth.uid() or es_admin());
create policy edita_propio on perfiles for update to authenticated using (id = auth.uid() or es_admin());

grant select on tutores to authenticated;
create policy propio on tutores for select to authenticated using (id = auth.uid() or es_admin());

grant select on mvz to authenticated;
grant update (cedula, especialidad_id, bio, foto_path, precio_general, precio_especialidad, acepta_mismo_dia,
              banco, clabe, titular_clabe, rfc) on mvz to authenticated;
create policy propio on mvz for select to authenticated using (id = auth.uid() or es_admin());
create policy edita_propio on mvz for update to authenticated using (id = auth.uid());
grant select on mvz_publicos to authenticated;

grant select, insert on documentos_verificacion to authenticated;
create policy propio on documentos_verificacion for select to authenticated using (cuenta_id = auth.uid() or es_admin());
create policy sube_propio on documentos_verificacion for insert to authenticated
  with check (cuenta_id = auth.uid() and ruta like 'identidad/' || auth.uid()::text || '/%');

grant select on revisiones to authenticated;
create policy propio on revisiones for select to authenticated using (cuenta_id = auth.uid() or es_admin());

-- Direcciones: solo el tutor (el MVZ las ve con direccion_de_reserva)
grant select, insert, update on direcciones to authenticated;
create policy propio on direcciones for select to authenticated using (tutor_id = auth.uid() or es_admin());
create policy crea on direcciones for insert to authenticated with check (tutor_id = auth.uid());
create policy edita on direcciones for update to authenticated using (tutor_id = auth.uid()) with check (tutor_id = auth.uid());

-- Mascotas: tutor dueño; MVZ con cita vigente (lectura); admin
grant select, insert, update on mascotas to authenticated;
create policy ver on mascotas for select to authenticated
  using (tutor_id = auth.uid() or mvz_atiende_mascota(id) or es_admin());
create policy crea on mascotas for insert to authenticated with check (tutor_id = auth.uid());
create policy edita on mascotas for update to authenticated using (tutor_id = auth.uid()) with check (tutor_id = auth.uid());

grant select, insert on cartilla to authenticated;
create policy ver on cartilla for select to authenticated
  using (es_tutor_de_mascota(mascota_id) or mvz_atiende_mascota(mascota_id) or es_admin());
create policy crea on cartilla for insert to authenticated with check (
  registrado_por = auth.uid() and (
    (origen = 'tutor' and es_tutor_de_mascota(mascota_id) and reserva_id is null) or
    (origen = 'mvz' and reserva_id is not null and mvz_atiende_reserva(reserva_id)
     and reserva_de_mascota(reserva_id, mascota_id))));
grant delete on cartilla to authenticated;
create policy borra_tutor on cartilla for delete to authenticated
  using (origen = 'tutor' and registrado_por = auth.uid());

grant select, insert on documentos_mascota to authenticated;
create policy ver on documentos_mascota for select to authenticated
  using (es_tutor_de_mascota(mascota_id) or mvz_atiende_mascota(mascota_id) or es_admin());
create policy crea on documentos_mascota for insert to authenticated with check (
  subido_por = auth.uid() and ruta like 'expediente/' || mascota_id::text || '/%' and
  (es_tutor_de_mascota(mascota_id) or (reserva_id is not null and mvz_atiende_reserva(reserva_id))));

-- Agenda del MVZ
grant select, insert, update, delete on agenda_dias, dias_bloqueados, catalogo_mvz to authenticated;
create policy propio on agenda_dias for all to authenticated
  using (mvz_id = auth.uid() or es_admin()) with check (mvz_id = auth.uid());
create policy propio on dias_bloqueados for all to authenticated
  using (mvz_id = auth.uid() or es_admin()) with check (mvz_id = auth.uid());
create policy propio on catalogo_mvz for all to authenticated
  using (mvz_id = auth.uid() or es_admin()) with check (mvz_id = auth.uid());
create policy ver_catalogo_publico on catalogo_mvz for select to authenticated
  using (activo and exists (select 1 from mvz_publicos m where m.id = catalogo_mvz.mvz_id));

-- Reservas: el tutor ve las suyas; el MVZ usa mis_consultas_mvz; admin todas. Se modifican solo con funciones.
grant select on reservas, reserva_productos to authenticated;
create policy ver on reservas for select to authenticated using (tutor_id = auth.uid() or es_admin());
create policy ver on reserva_productos for select to authenticated using (es_participante(reserva_id) or es_admin());

-- Dinero: el tutor ve sus pagos y reembolsos; el MVZ su saldo y depósitos; admin todo
grant select on pagos, reembolsos, saldo_mvz, depositos, saldo_tutor, invitaciones to authenticated;
create policy ver on pagos for select to authenticated using (
  es_admin() or exists (select 1 from reservas r where r.id = reserva_id and r.tutor_id = auth.uid()));
create policy ver on reembolsos for select to authenticated using (
  es_admin() or exists (select 1 from pagos p join reservas r on r.id = p.reserva_id
                        where p.id = pago_id and r.tutor_id = auth.uid()));
create policy ver on saldo_mvz for select to authenticated using (mvz_id = auth.uid() or es_admin());
create policy ver on depositos for select to authenticated using (mvz_id = auth.uid() or es_admin());
grant insert on depositos to authenticated;
create policy admin_registra on depositos for insert to authenticated with check (es_admin());
grant update (estado, deposito_id) on saldo_mvz to authenticated;
create policy admin_edita on saldo_mvz for update to authenticated using (es_admin());
create policy ver on saldo_tutor for select to authenticated using (tutor_id = auth.uid() or es_admin());
create policy ver on invitaciones for select to authenticated using (invita_id = auth.uid() or es_admin());

-- Clínico: solo lectura directa; se escribe con guardar_registro_clinico
grant select on registros_clinicos, registros_clinicos_versiones, referencias to authenticated;
create policy ver on registros_clinicos for select to authenticated using (
  es_tutor_de_mascota(mascota_id) or mvz_atiende_mascota(mascota_id) or es_admin());
create policy ver on registros_clinicos_versiones for select to authenticated using (
  exists (select 1 from registros_clinicos rc where rc.id = registro_id
          and (es_tutor_de_mascota(rc.mascota_id) or mvz_atiende_mascota(rc.mascota_id) or es_admin())));
grant insert on referencias to authenticated;
create policy ver on referencias for select to authenticated using (
  es_tutor_de_mascota(mascota_id) or mvz_id = auth.uid() or es_admin());
create policy crea on referencias for insert to authenticated with check (
  mvz_id = auth.uid() and mvz_atiende_reserva(reserva_id) and reserva_de_mascota(reserva_id, mascota_id));

-- Chat
grant select, insert on mensajes to authenticated;
create policy ver on mensajes for select to authenticated using (es_participante(reserva_id) or es_admin());
create policy escribe on mensajes for insert to authenticated with check (autor_id = auth.uid() and chat_abierto(reserva_id));

-- Calificaciones: el tutor califica una vez, tras el cierre
grant select, insert on calificaciones to authenticated;
create policy ver on calificaciones for select to authenticated using (true);
create policy crea on calificaciones for insert to authenticated with check (
  tutor_id = auth.uid() and exists (select 1 from reservas r where r.id = reserva_id
     and r.tutor_id = auth.uid() and r.mvz_id = calificaciones.mvz_id and r.estado = 'cerrada'));

-- Reportes
grant select, insert on reportes to authenticated;
grant update (estado, resolucion, atendido_por, resuelto_at) on reportes to authenticated;
create policy ver on reportes for select to authenticated using (autor_id = auth.uid() or es_admin());
create policy crea on reportes for insert to authenticated with check (
  autor_id = auth.uid() and (reserva_id is null or es_participante(reserva_id)));
create policy admin_edita on reportes for update to authenticated using (es_admin());

-- Solo admin
grant select on avisos, registro_accesos, auditoria to authenticated;
create policy admin on avisos for select to authenticated using (es_admin() or destinatario_id = auth.uid());
create policy admin on registro_accesos for select to authenticated using (es_admin());
create policy admin on auditoria for select to authenticated using (es_admin());
grant select on finanzas_mensuales to authenticated;
alter view finanzas_mensuales set (security_invoker = true);

-- Funciones que puede llamar la app con sesión
grant execute on function
  param(text), es_admin(), bloques_disponibles(smallint, date, tipo_consulta),
  reservar(uuid, uuid, uuid, timestamptz, tipo_consulta, uuid[], text, text, text, text, boolean, uuid),
  marcar_llegada(uuid), cerrar_consulta(uuid, uuid[]), marcar_tutor_ausente(uuid), cancelar_reserva(uuid, text),
  registrar_mvz_no_llego(uuid, text), cambiar_a_consulta(uuid),
  guardar_registro_clinico(uuid, text, text, text, text, text, text, numeric, numeric, text),
  historia_clinica(uuid), direccion_de_reserva(uuid), mis_consultas_mvz(date, date),
  revisar_cuenta(uuid, text, estado_verif, text), registrar_acceso(text, text, uuid),
  costo_pasarela(numeric), neto_mvz(numeric, numeric), hora_cdmx(timestamptz), ocultar_contacto(text),
  -- usadas dentro de las reglas de seguridad
  mvz_con_acceso(reservas), mvz_atiende_mascota(uuid), mvz_atiende_reserva(uuid), es_tutor_de_mascota(uuid),
  chat_abierto(uuid), es_participante(uuid), reserva_de_mascota(uuid, uuid)
to authenticated;

-- El servidor (service_role) trabaja con todas las tablas
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Solo servidor (Edge Functions / tareas programadas con service_role)
grant execute on function confirmar_pago(uuid, text, text, text, numeric), rechazar_pago(uuid, text),
  expirar_apartados(), activar_invitacion(uuid) to service_role;
revoke execute on function crear_admin(text) from authenticated, service_role;

-- =====================================================================
-- Almacenamiento (Storage)
-- =====================================================================
insert into storage.buckets (id, name, public) values
  ('identidad', 'identidad', false),   -- INE, selfies, cédulas, estados de cuenta: solo admin los abre
  ('expediente', 'expediente', false), -- fotos y documentos de mascotas: <mascota_id>/<archivo>
  ('chat', 'chat', false),             -- adjuntos del chat: <reserva_id>/<archivo>
  ('perfiles', 'perfiles', true)       -- fotos de perfil de MVZ: <mvz_id>/<archivo>
on conflict (id) do nothing;

create policy identidad_sube on storage.objects for insert to authenticated
  with check (bucket_id = 'identidad' and (storage.foldername(name))[1] = auth.uid()::text);
create policy identidad_admin on storage.objects for select to authenticated
  using (bucket_id = 'identidad' and es_admin());

create policy expediente_ver on storage.objects for select to authenticated using (
  bucket_id = 'expediente' and (
    es_tutor_de_mascota(((storage.foldername(name))[1])::uuid) or
    mvz_atiende_mascota(((storage.foldername(name))[1])::uuid) or es_admin()));
create policy expediente_sube on storage.objects for insert to authenticated with check (
  bucket_id = 'expediente' and (
    es_tutor_de_mascota(((storage.foldername(name))[1])::uuid) or
    mvz_atiende_mascota(((storage.foldername(name))[1])::uuid)));

create policy chat_ver on storage.objects for select to authenticated using (
  bucket_id = 'chat' and (es_participante(((storage.foldername(name))[1])::uuid) or es_admin()));
create policy chat_sube on storage.objects for insert to authenticated with check (
  bucket_id = 'chat' and chat_abierto(((storage.foldername(name))[1])::uuid));

create policy perfiles_ver on storage.objects for select to anon, authenticated using (bucket_id = 'perfiles');
create policy perfiles_sube on storage.objects for insert to authenticated
  with check (bucket_id = 'perfiles' and (storage.foldername(name))[1] = auth.uid()::text);
create policy perfiles_cambia on storage.objects for update to authenticated
  using (bucket_id = 'perfiles' and (storage.foldername(name))[1] = auth.uid()::text);

-- =====================================================================
-- Tareas programadas (Supabase: activar la extensión pg_cron en Database → Extensions)
-- =====================================================================
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('lv_expirar_apartados', '* * * * *', 'select public.expirar_apartados()');
  else
    raise notice 'pg_cron no está activo: actívalo y corre la línea de cron.schedule de este archivo';
  end if;
end $$;
-- Los avisos programados los envía la Edge Function "enviar-avisos" (fase 7), llamada cada minuto.

-- Para hacerte admin después de registrarte en la app:
--   select crear_admin('tu-correo@ejemplo.com');
