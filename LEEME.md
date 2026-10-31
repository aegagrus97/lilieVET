# LilieVET · webapp: cómo publicarla

Esta carpeta es la app que van a usar tutores y médicos veterinarios. Ya no usa datos de ejemplo:
cada persona crea su cuenta y todo se guarda en tu base de datos de Supabase.

| Archivo | Para qué sirve |
| --- | --- |
| `index.html` | La app completa (tutor, médico veterinario y Panel de LilieVET) |
| `config.js` | Aquí pegas los 2 datos de tu proyecto de Supabase |
| `supabase/schema.sql` | La base de datos: se pega una vez en Supabase |
| `manifest.webmanifest`, `sw.js`, `icons/` | Para que se pueda instalar en el teléfono como app |

---

## 1. Supabase (10 minutos)

1. Entra a supabase.com y crea tu cuenta (puedes entrar con tu GitHub).
2. **New project** → nombre `lilievet` → región **East US (North Virginia)** → guarda bien la contraseña de la base de datos.
3. Menú **SQL Editor** → **New query** → pega TODO el contenido de `supabase/schema.sql` → **Run**. Debe decir *Success*.
4. Menú **Authentication**:
   - **Sign In / Providers → Email**: apaga **Confirm email**. Así la gente entra en cuanto se registra.
     (Supabase solo manda correos a tu equipo hasta que conectes un servidor de correo propio; ver el paso 6.)
   - **URL Configuration**: en **Site URL** pon la dirección donde quedará la app (paso 3), por ejemplo
     `https://aegagrus97.github.io/lilievet/`, y agrégala también en **Redirect URLs**.
5. Botón **Connect** (o **Project Settings → API Keys**): copia la **Project URL** y la clave **publishable**
   (o "anon public"). **Nunca** copies la *secret* ni la *service_role*.

## 2. config.js

Abre `config.js` y reemplaza los dos valores:

```js
window.LV_CONFIG = {
  supabaseUrl: 'https://xxxxxxxx.supabase.co',
  supabaseKey: 'sb_publishable_xxxxxxxx',
};
```

Esta clave sí puede ir en la app: las reglas de la base de datos deciden quién ve qué.

## 3. Publicarla en GitHub Pages (gratis)

1. En GitHub crea un repositorio nuevo, por ejemplo `lilievet` (público).
2. **Add file → Upload files** → sube todo lo de esta carpeta (incluida la carpeta `icons`).
3. **Settings → Pages** → *Source: Deploy from a branch* → rama `main`, carpeta `/ (root)` → **Save**.
4. En 1 o 2 minutos queda en `https://aegagrus97.github.io/lilievet/`.

Más adelante puedes conectar un dominio propio (por ejemplo lilievet.mx) en esa misma pantalla y ponerlo
en el Panel → Parámetros → dominio, para que los links de invitación salgan con tu dominio.

## 4. Tu cuenta de administradora

1. Abre la app → **Soy veterinario** → crea tu cuenta con tus datos reales (cédula, INE, selfie).
2. En Supabase → **SQL Editor** corre (con tu correo):
   ```sql
   select lv_make_admin('tu-correo@ejemplo.com');
   ```
3. Recarga la app: arriba aparece **Panel de LilieVET**. En **Revisiones** apruebas tu propia cuenta
   y, desde ahí, las INE de los tutores, las cédulas de los médicos veterinarios y las cuentas CLABE.

Si algún día quieres otra persona admin, repite el paso 2 con su correo.

## 5. Cómo funciona por dentro (resumen)

- El tutor ve solo lo suyo. El médico veterinario ve las consultas que le llegaron y el tutor y la mascota de
  esas consultas (sin INE, tarjeta ni datos fiscales; el celular del tutor aparece solo con la visita aceptada).
- Los perfiles de los médicos veterinarios son públicos, sin CLABE, RFC, INE ni cédula escaneada.
- Tú (admin) ves todo para revisar. Aprobar una INE, una cédula o una CLABE solo lo puede hacer la cuenta admin:
  si alguien lo intenta desde su teléfono, la base de datos lo regresa.
- Los cambios llegan a los demás teléfonos en unos 10 segundos.
- **Depósitos:** en Panel → Usuarios → MVZ → Acciones ves la CLABE y cuánto se le debe a cada uno.
  Haces el SPEI desde tu banco y luego tocas **Registrar depósito** para que quede en su historial.

## 6. Pendientes antes de abrirla al público

1. **Pagos con Mercado Pago.** Hoy la app está en **modo de prueba**: muestra los montos y guarda los
   movimientos, pero no cobra. Se ve el aviso "Modo de prueba" al pagar. Se conecta en la siguiente etapa.
2. **Avisos al teléfono.** Por ahora los avisos llegan dentro de la app (y como notificación del sistema
   mientras la app está abierta). Los médicos veterinarios deben revisarla seguido mientras estén disponibles.
   Faltan avisos push o por WhatsApp.
3. **Plazos de 1 hora cuando nadie tiene la app abierta.** El paso al siguiente médico veterinario de la
   lista lo hace el teléfono de alguien involucrado. Durante el piloto, deja LilieVET abierta con tu cuenta admin
   en una computadora en el horario de solicitudes (7:00 a 23:00): tu Panel procesa los plazos de todos.
4. **Correo propio** (para "¿Olvidaste tu contraseña?"): conecta un servidor de correo como Brevo o Resend en
   Authentication → Emails → SMTP Settings. Mientras no lo hagas, solo te llegan correos a ti y a tu equipo.
5. **Plan Pro de Supabase (US$25 al mes)** cuando haya tutores reales: el plan gratis pausa el proyecto tras
   una semana sin uso y no tiene copias de seguridad diarias.
6. **Aviso de Privacidad:** que tu abogado agregue que los datos (incluidas las INE) se guardan en servidores
   en Estados Unidos.

## 7. Publicar una versión nueva

Reemplaza `index.html` en GitHub y, en `sw.js`, sube el número de `VERSION` (por ejemplo `lilievet-1.0.1`)
para que los teléfonos que ya la instalaron descarguen la nueva. Si cambia `supabase/schema.sql`, vuelve a
correrlo completo en el SQL Editor: no borra datos.
