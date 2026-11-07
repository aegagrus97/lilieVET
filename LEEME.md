# LilieVET · webapp v3.2 (fase 3: cuentas y verificación)

Webapp para tutores, médicos veterinarios y el Panel de LilieVET. Abre en navegador de escritorio y se ajusta en celular. Usa el sistema de diseño LilieVET v3 ("85% serio, 15% carácter") sin modificarlo.

## Nuevo en la fase 3
- **Tutor · Perfil:** INE (frente y reverso) y selfie con la INE, con estado (sin enviar, en revisión, verificada, falta corregir). Se pide antes de la primera consulta y no impide agendar. En Inicio, Liebe lo recuerda (arriba si ya hay consulta agendada). También: datos, correo y contraseña, y su código de invitación.
- **Médico veterinario · Tu alta:** asistente de 6 pasos (datos y número de cédula, INE y selfie, cédula escaneada, especialidad opcional, CLABE opcional, revisar y enviar). Después ve el estado de su solicitud y la nota si hay que corregir. En Perfil edita foto, presentación, especialidad y CLABE (con dígito verificador y banco automático).
- **Panel · Verificación:** cola de revisión (primero tutores con consulta agendada), documentos de cada cuenta con enlaces de 10 minutos, guía de qué revisar, enlace al Registro Nacional de Profesionistas, WhatsApp y correo, y Aprobar / Pedir corrección / Rechazar con nota. Historial de decisiones. El contador del menú muestra lo pendiente.
- **Una INE = una cuenta:** al aprobar una INE se captura la clave de elector; se guarda solo una huella (sha-256), nunca el número.
- **Ajustes del 5 nov:** el seguimiento de la consulta va Confirmada → Llegó → Terminada (sin "En camino"); los nombres se guardan y se muestran sin "Dr./Dra." (también si alguien lo escribe); logo, corazón e íconos en SVG.
- **Íconos de la app:** opción B (corazón con huella sobre lavanda) puesta de forma provisional mientras Kat elige. `icons/icon.svg` es el favicon; los PNG (Apple y Android) se generan desde ese SVG porque esas plataformas no aceptan SVG.

## Qué había desde la fase 2
- **Acceso:** entrar, crear cuenta (tutor o médico veterinario), recuperar y cambiar contraseña. El registro guarda los consentimientos (términos, WhatsApp, promociones) y el código de invitación.
- **Armazón:** menú lateral en escritorio, menú de íconos en tableta y barra de pestañas abajo en celular. Tema automático, claro u oscuro.
- **Inicio del tutor:** consulta del día, mascotas, próximas consultas, recordatorio de Lilie y avisos (urgencias y pagos solo en la app). Si aún no tiene mascotas, bienvenida con Liebe y Lilie.
- **Hoy del médico veterinario:** consultas del día con su estado, alcaldía y horario, pagos retenidos y por depositar, y su semana. Sin personajes.
- **Inicio del Panel:** cifras del día, cuentas por revisar, próximas consultas y el resumen del mes (cobrado, comisiones, pasarela y lo que queda a LilieVET).
- **Las demás secciones** muestran qué tendrán y en qué fase llegan.
- Si una cuenta admin también es médico veterinario, puede cambiar entre el Panel y su vista de médico.

## Vista de muestra (sin conectar nada)
Abre `index.html?demo=tutor`, `?demo=mvz`, `?demo=mvz-nuevo` (médico veterinario recién registrado, para probar el alta) o `?demo=admin`. En la muestra puedes subir fotos, enviar y aprobar; en el Panel, la clave `HRNDSF90010109M800` simula una INE que ya está en otra cuenta. Usa datos de ejemplo y no guarda nada. Sirve para revisar el diseño.

## Conectar Supabase
1. Crea un proyecto nuevo (región East US). En Database → Extensions activa **pg_cron**.
2. SQL Editor → pega `supabase/schema.sql` completo → Run. Luego pega `supabase/fase3.sql` → Run. (Si ya habías corrido schema.sql, solo corre fase3.sql.)
3. Authentication → Sign In / Providers → Email: apaga **Confirm email** (por ahora). En URL Configuration pon la dirección de la app en Site URL y Redirect URLs.
4. Copia la Project URL y la clave publishable en `config.js`.
5. Regístrate en la app y en SQL Editor corre: `select crear_admin('tu-correo');`. Recarga.

## Publicar en GitHub Pages
Sube todos los archivos a un repositorio, y en Settings → Pages elige la rama `main`. No hay que compilar nada.

## Archivos
| Carpeta | Qué es |
| --- | --- |
| `ds/` | Sistema de diseño LilieVET v3, copiado tal cual (tokens, estilos y componentes). No se edita aquí: se actualiza desde el sistema de diseño. |
| `css/app.css` | Solo el acomodo de la webapp (menú, rejillas, tablas). |
| `js/` | La app: `main.js` (entrada), `api.js` (datos), `shell.js` (menú y rutas), `auth.js` (acceso), `componentes.js` (seguimiento, subir documentos), `cuenta.js` (datos y contraseña), `tutor/`, `mvz/` (`alta.js`), `admin/` (`verificacion.js`). |
| `vendor/` | React 18, htm y Supabase JS, guardados en la app para no depender de otros servidores. |
| `supabase/` | `schema.sql` (fase 1) y `fase3.sql` (cuentas y verificación), con sus pruebas: 70 de la fase 1 y 47 de la fase 3. |
| `img/`, `icons/` | Logo y corazón con huella en SVG (los de Kat, sin cambios) e íconos de la app. |

## Pruebas hechas (fase 3)
- Base: 70 pruebas de la fase 1 (sobre schema.sql) y 47 de la fase 3 (schema.sql + fase3.sql) en Postgres 16. La prueba de "mismo día" de la fase 1 necesita correrse antes de las ~21:30 de CDMX (después ya no hay bloques ese día).
- Navegador: subir INE y enviar (tutor), alta completa del médico veterinario, aprobar con clave, INE duplicada, corrección sin nota; capturas a 390, 900 y 1280 px en claro y oscuro. Sin errores de consola ni desbordes.
- Falta probar contra un Supabase real (subidas a Storage, enlaces firmados y correos).

## Pruebas de la fase 2
- Capturas a 390, 900 y 1280 px, en claro y oscuro, de las tres vistas, el acceso y las secciones pendientes. Sin errores de consola ni desbordes.
- Modo Supabase con un servidor simulado: error de contraseña en español, inicio de sesión, carga del perfil y del Inicio del tutor sin mascotas.
- Falta probarla contra un Supabase real.
