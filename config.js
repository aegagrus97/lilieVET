/* LilieVET · conexión con Supabase
   Pega aquí los dos datos de tu proyecto (Supabase > Project Settings > API, o el botón "Connect"):
   - Project URL
   - La clave "publishable" (o "anon public"). Esta clave SÍ puede ir en la app: las reglas de la base de datos protegen los datos.
   Nunca pegues aquí la "secret" ni la "service_role".

   Mientras no la conectes, la app ofrece una vista de muestra con datos de ejemplo
   (index.html?demo=tutor, ?demo=mvz o ?demo=admin) para revisar el diseño. */
window.LV_CONFIG = {
  supabaseUrl: 'https://TU-PROYECTO.supabase.co',
  supabaseKey: 'PEGA-AQUI-TU-CLAVE-PUBLISHABLE',
  terminosVersion: '2026-11',
};
