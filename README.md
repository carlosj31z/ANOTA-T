# Formulario de Envío Logístico

Formulario de envío/recojo mobile-first para e-commerce, construido con
React + Vite + Tailwind CSS. Cada tienda comparte un enlace con
`?merchant=<id>`; el cliente completa sus datos y termina enviando el
resumen por WhatsApp.

## Portal de acceso (link normal = cliente, `/admin` = administrador)

Ya no hay un selector "¿Cómo deseas ingresar?": la URL decide qué flujo
se muestra (`src/App.jsx` lee `window.location.pathname`), un click menos
para cada quien:

- **Link normal** (`tu-dominio.com/`, con o sin `?merchant=id`) → pide la
  clave serial del cliente/negociante directamente.
- **`tu-dominio.com/admin`** → pide usuario y contraseña de administrador
  directamente. Las credenciales están en `src/utils/serial.js`
  (`ADMIN_USER` / `ADMIN_PASSWORD`).

Al validar, el rol se guarda en `localStorage` para no volver a pedirlo en
ese dispositivo. Para el rol **admin** eso basta (se confía de inmediato);
para el rol **cliente**, el serial se **re-valida contra Supabase en cada
carga de la página** — si el administrador lo retira desde la pestaña
"Clientes" del panel, ese dispositivo se bloquea solo, sin esperar a que
alguien borre su `localStorage` a mano. Ver "Clientes y seriales
(Supabase)" más abajo.

> Es una barrera del lado del cliente (no hay backend propio de
> autenticación), pensada para repartir acceso por código/credencial, no
> como seguridad real: la contraseña de administrador viaja en el bundle y
> cualquiera que lo inspeccione puede leerla. La lista de seriales, en
> cambio, ya no vive en el bundle — ver abajo.

## Panel de administrador y telemetría (anti-piratería)

Al entrar como **Administrador** se abre un panel
(`src/components/AdminDashboard.jsx`) con un registro de activaciones:
cada vez que alguien ingresa (con serial o como admin) se registra un
evento con dispositivo, navegador/OS, fecha y hora, zona horaria,
idioma, **ubicación por IP** (aprox., sin permiso) y, si el usuario
acepta el permiso del navegador, **coordenadas GPS** exactas. La lógica
está en `src/utils/telemetry.js`.

- El evento se guarda siempre en `localStorage` (visible en el panel de
  ese dispositivo) y, si hay un **endpoint** configurado, se envía a tu
  backend (`sendBeacon`/`fetch`, fire-and-forget).
- El panel muestra estadísticas (activaciones, dispositivos únicos,
  seriales usados, últimas 24 h), la tabla completa, exportación a CSV y
  un campo para pegar la URL del endpoint.

**Importante:** al ser una app estática, sin backend el panel solo ve
las activaciones de *ese* navegador. Para vigilar a todos tus clientes
(que es el objetivo anti-piratería) necesitas un backend que reciba los
eventos. La forma más simple y gratis es un **Google Apps Script + Hoja
de cálculo**:

1. Crea una Hoja de cálculo en Google Sheets.
2. Menú **Extensiones → Apps Script** y pega:

   ```js
   function doPost(e) {
     const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0]
     const d = JSON.parse(e.postData.contents)
     sheet.appendRow([
       new Date(), d.type, d.serial, d.deviceId, d.browser, d.os,
       d.deviceType, d.language, d.tz, d.ip, d.city, d.region, d.country,
       d.isp, d.ipLat, d.ipLng, d.gpsLat, d.gpsLng, d.gpsAccuracy, d.ua,
     ])
     return ContentService.createTextOutput('ok')
   }
   ```

3. **Implementar → Nueva implementación → Aplicación web**, acceso
   "Cualquier usuario", y copia la URL `…/exec`.
4. Pega esa URL en el panel de administrador (campo "Endpoint de
   telemetría") y guarda. Desde ahí cada activación de tus clientes se
   registrará en tu Hoja.

> La telemetría de activación de licencias es una práctica estándar de
> anti-piratería. La ubicación por IP es aproximada; el GPS exacto solo
> se obtiene con el permiso del navegador (el propio navegador muestra el
> aviso). Los datos se envían únicamente a TU endpoint.

## Cómo funciona

1. La página lee `?merchant=<id>` de la URL y lo busca en
   `src/data/merchants.js`. Si no existe o falta el parámetro, se usa la
   tienda por defecto (`march-usa`) — el formulario siempre es usable, con
   o sin ese parámetro.
2. Las fechas de envío son **continuas** (todos los días, sin saltos) a
   partir de mañana según la fecha del dispositivo del cliente; si ya pasó
   la hora de corte (`cutoffHour`) de hoy, arrancan un día más tarde. Se
   eligen en un **mini calendario** (`src/components/DatePicker.jsx`), no
   en una lista desplegable.
3. El cliente elige cómo quiere recibir su pedido:
   - **Retiro en tienda** — solo nombre y fecha.
   - **Envío a domicilio** — dirección, departamento, provincia/distrito,
     referencia y método de pago (Yape/Plin, transferencia, contraentrega).
   - **Retiro en agencia** (Shalom / Emtrafesa / Marvisur / Olva Courier /
     Transportes Flores) — buscador de agencias con geolocalización (ver
     abajo) + DNI/CE.
   - **Otra agencia / encomienda** — nombre y dirección de recojo libres,
     para couriers fuera del catálogo.
4. Al enviar, se valida todo en tiempo real y se muestra la pantalla de
   confirmación con un resumen y un botón para mandarlo por WhatsApp
   (`wa.me`) con emojis y negritas, al número configurado del merchant.

## Sobre las "agencias cercanas" (Shalom, Emtrafesa, Marvisur, Olva, Flores)

Antes de construir esto se investigó si estas empresas peruanas ofrecen
una API pública para ubicar agencias por geolocalización. Resultado:

- **Ninguna tiene una API pública y gratuita.**
- **Shalom** tiene una API B2B ("Shalom Pro") para tracking, catálogo de
  agencias y creación de guías, pero requiere solicitar credenciales como
  cliente comercial.
- **Olva Courier** solo ofrece integración por API mediante contacto
  comercial directo (proceso de 2-4 semanas), sin documentación pública.
- **Marvisur**, **Emtrafesa** y **Transportes Flores** no tienen ninguna
  API documentada.
- Además, `olvacourier.com`, `shalom.com.pe` y `expresomarvisur.com` no
  envían cabeceras CORS para consumo desde un dominio de terceros, así que
  aunque se consiguieran credenciales, no se podría llamar a esas APIs
  directamente desde el navegador (necesitarían un backend/proxy propio).

**Solución implementada:** un directorio propio en
`src/data/agenciesData.js` (archivo **generado**, no editar a mano) con
**más de 1200 agencias reales**, expuesto a la app vía `src/data/agencies.js`:

- **Shalom (496 agencias): directorio oficial nacional completo.** Del
  listado oficial de sucursales (documento Word), geocodificado por
  distrito/departamento.
- **Olva Courier (468 agencias): directorio oficial completo.** Del
  documento oficial del courier — cobertura de los 25 departamentos.
- **Marvisur (179 agencias): directorio oficial completo**, con
  dirección, referencia, email y teléfono de cada sucursal.
- **Emtrafesa (45 agencias): directorio oficial completo** (cobertura
  norte del país: La Libertad, Lambayeque, Piura, Cajamarca, Áncash,
  Tumbes, Lima, etc.).
- **Transportes Flores (26 agencias): directorio oficial completo**
  (Arequipa, La Libertad, Lima, Piura, Puno, Tacna, Tumbes, etc.).

Las coordenadas son aproximadas a nivel de distrito/ciudad
(`src/data/peruGeo.js` geocodifica por distrito → provincia →
departamento). El formulario pide permiso de geolocalización al navegador
(`navigator.geolocation`) y ordena las agencias por distancia real
(fórmula de Haversine, ver `src/utils/geo.js`), mostrando "~X km" junto
a cada resultado.

> Nota: las 5 empresas están al 100% de sus directorios oficiales
> (documentos Word/PDF proporcionados y procesados). Para sumar otro
> courier o actualizar uno existente, basta con subir su directorio
> oficial desde el panel de administrador (ver abajo) — o pedir que se
> integre al dataset baked-in para que quede disponible para todos los
> usuarios, como se hizo con estos cinco.

## Cargar/alimentar la base de datos (panel de administrador)

El panel de administrador tiene una pestaña **"Base de datos"**
(`src/components/AgencyManager.jsx`) para sumar agencias — y empresas
courier **completamente nuevas** — sin tocar el código ni depender de subir
archivos por chat:

- **Plantilla Excel (recomendado):** un botón descarga un `.xlsx` con las
  columnas correctas (`courier, courier_label, department, province,
  district, zone, address, reference, lat, lng`), 2 filas de ejemplo y una
  hoja de instrucciones con los couriers que ya existen. El admin la llena
  y la vuelve a subir con el botón de al lado — cada fila se valida,
  se le calculan las coordenadas si faltan, y se guarda en **Supabase**
  (ver abajo), visible al instante para cualquier visitante del sitio.
  Para una empresa nueva basta con inventar un `courier` (código corto,
  ej. `rapidito`) y poner su nombre en `courier_label`: aparece solo,
  automáticamente, como una opción más de "Retiro en agencia" en el
  formulario — no hace falta editar `ShippingForm.jsx` ni `agencies.js`.
- **Agregar una agencia suelta:** el mismo formulario de siempre, con un
  selector de courier que incluye **"+ Nueva empresa…"** para crear una
  al vuelo. Si Supabase está configurado, se guarda ahí (compartido); si
  no, se guarda localmente como respaldo.
- **Resumen por courier:** cuántas agencias hay oficiales (baked-in),
  cuántas en Supabase (compartidas) y cuántas solo locales de cada una.
- **Importador local** (`<details>` colapsable, respaldo sin conexión):
  el mismo de antes — pegar texto en formato *Listado* / *CSV* / *JSON*,
  o subir un archivo — pero guarda solo en `localStorage` de **ese
  dispositivo**. Útil si todavía no configuraste Supabase, o para pruebas
  rápidas. Exportar/Vaciar siguen disponibles ahí.

### Base de datos compartida (Supabase)

Por qué: sin esto, cualquier cosa que cargue el admin solo la ve **su
propio navegador** (limitación de una app 100% estática, sin servidor
propio). Con Supabase, el navegador de CADA visitante lee/escribe directo
contra tu proyecto — se vuelve una base de datos real y compartida, sin
que tengas que montar un backend.

**1. Crea el proyecto y la tabla.** En [supabase.com](https://supabase.com)
crea un proyecto gratis, abre **SQL Editor** y pega:

```sql
create table if not exists public.agencies (
  id bigint generated always as identity primary key,
  courier text not null,
  courier_label text,
  department text,
  province text,
  district text,
  zone text,
  address text not null,
  reference text,
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now()
);

alter table public.agencies enable row level security;

-- Cualquiera puede LEER (lo necesita el formulario, para todos los clientes).
create policy "agencies_public_select" on public.agencies
  for select using (true);

-- Cualquiera puede ESCRIBIR (ver nota de seguridad más abajo).
create policy "agencies_public_insert" on public.agencies
  for insert with check (true);

create policy "agencies_public_delete" on public.agencies
  for delete using (true);
```

**2. Copia tus credenciales.** En **Settings → API** de ese proyecto,
copia la **Project URL** y la **anon public key**.

**3. Configúralas en Vercel** (Project Settings → Environment Variables):

```
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
```

Vuelve a desplegar (`npx vercel --prod` o un nuevo push) para que queden
horneadas en el bundle — a partir de ahí, TODOS los visitantes leen/escriben
en la misma base. Para desarrollo local, copia `.env.example` a `.env` con
esos mismos valores. También puedes pegarlos directamente en el panel de
administrador (sección "Base de datos compartida") para probarlos sin
redeploy — esa copia queda **solo en ese dispositivo**.

> **Nota de seguridad, léela antes de usarlo en un negocio real de
> volumen:** la "anon key" de Supabase está *pensada* para ser pública
> (viaja en el bundle del navegador, como el resto del código) — la
> protección real la da Row Level Security, no ocultar la clave. La
> política de arriba (`with check (true)`) permite que **cualquiera** que
> inspeccione el sitio pueda insertar filas directamente contra tu
> Supabase, sin pasar por el panel de administrador — el mismo nivel de
> "seguridad de cliente, no de servidor" que ya tiene el login de admin de
> esta app (ver arriba). Es razonable para empezar; si más adelante quieres
> cerrarlo de verdad, la vía correcta es activar **Supabase Auth** (un
> usuario admin real) y cambiar las políticas de `insert`/`delete` a algo
> como `using (auth.role() = 'authenticated')` en vez de `true` — dilo y se
> integra.

### Sobre la librería de Excel (`xlsx` / SheetJS)

La lectura del `.xlsx` que sube el admin usa `xlsx` (SheetJS). La versión
publicada en npm tiene 2 CVEs conocidos sin parche ahí (prototype
pollution y ReDoS al leer un archivo malicioso) — ver
[GHSA-4r6h-8v6p-xvw6](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6) y
[GHSA-5pgg-2g8v-p4x9](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9).
Mitigado por ahora con: (1) esta librería solo se carga tras el login de
administrador, nunca para clientes del formulario (`import()` dinámico);
(2) el archivo subido se limita a 5 MB antes de intentar leerlo; (3) el
parseo va en `try/catch`. Para eliminar el riesgo del todo, SheetJS publica
builds parchadas en su propio dominio (no en npm):

```bash
npm install https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz
```

(ese dominio estaba bloqueado en el sandbox donde se desarrolló esto, así
que no se pudo instalar ni probar acá — debería funcionar normal en tu
máquina o en el build de Vercel).

Esto es una aproximación honesta, no una integración en vivo. Si más
adelante consigues credenciales de Shalom Pro o de Olva, basta con
reemplazar `getAgenciesForCourier()` en `src/data/agencies.js` por una
llamada a tu backend — el resto de la app (búsqueda, orden por
distancia, resumen de WhatsApp) ya espera ese mismo formato de objeto
(`{ id, label, address, reference, lat, lng }`) y no necesita cambios.

## Clientes y seriales (Supabase)

Antes, los seriales que desbloquean el formulario vivían en una lista fija
en `src/data/serials.js` — para sumar o quitar un cliente había que editar
código y volver a desplegar. Ahora eso se administra desde la pestaña
**"Clientes"** del panel de administrador, guardado en la misma base de
datos Supabase que las agencias.

A diferencia de la tabla `agencies` (pública a propósito), `clients` **no
tiene ninguna política pública de lectura ni escritura** — si la tuviera,
cualquiera podría listar todos los seriales válidos con una sola llamada a
la API pública. Toda la gestión pasa por funciones de Postgres protegidas
con una **clave de administrador que vive solo en la base de datos** (a
diferencia de `ADMIN_PASSWORD` en `serial.js`, esta nunca viaja en el
bundle del navegador). Corre esto en el **SQL Editor** de tu proyecto
Supabase (el mismo de la sección anterior), después del SQL de `agencies`:

```sql
create table if not exists public.clients (
  id bigint generated always as identity primary key,
  serial text not null unique,
  name text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.clients enable row level security;
-- Sin políticas públicas: nadie puede leer ni escribir esta tabla
-- directamente, solo a través de las funciones de abajo.

create table if not exists public.app_settings (
  key text primary key,
  value text not null
);
alter table public.app_settings enable row level security;

-- Clave de administrador: CAMBIA 'pon-aqui-una-clave-larga' antes de correr esto.
insert into public.app_settings (key, value) values ('admin_secret', 'pon-aqui-una-clave-larga')
  on conflict (key) do update set value = excluded.value;

-- Público: solo responde true/false, nunca expone la lista de seriales.
create or replace function public.check_client_serial(p_serial text)
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from public.clients where serial = p_serial and active = true);
$$;
grant execute on function public.check_client_serial(text) to anon, authenticated;

-- Protegidas con la clave de admin (nunca en el bundle del navegador).
create or replace function public.admin_list_clients(p_secret text)
returns setof public.clients language plpgsql security definer set search_path = public as $$
begin
  if p_secret is null or p_secret <> (select value from public.app_settings where key = 'admin_secret') then
    raise exception 'unauthorized';
  end if;
  return query select * from public.clients order by created_at desc;
end; $$;
grant execute on function public.admin_list_clients(text) to anon, authenticated;

create or replace function public.admin_add_client(p_secret text, p_serial text, p_name text, p_notes text default null)
returns public.clients language plpgsql security definer set search_path = public as $$
declare r public.clients;
begin
  if p_secret is null or p_secret <> (select value from public.app_settings where key = 'admin_secret') then
    raise exception 'unauthorized';
  end if;
  insert into public.clients (serial, name, notes) values (upper(trim(p_serial)), p_name, p_notes) returning * into r;
  return r;
end; $$;
grant execute on function public.admin_add_client(text,text,text,text) to anon, authenticated;

create or replace function public.admin_set_client_active(p_secret text, p_id bigint, p_active boolean)
returns public.clients language plpgsql security definer set search_path = public as $$
declare r public.clients;
begin
  if p_secret is null or p_secret <> (select value from public.app_settings where key = 'admin_secret') then
    raise exception 'unauthorized';
  end if;
  update public.clients set active = p_active where id = p_id returning * into r;
  return r;
end; $$;
grant execute on function public.admin_set_client_active(text,bigint,boolean) to anon, authenticated;

create or replace function public.admin_delete_client(p_secret text, p_id bigint)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_secret is null or p_secret <> (select value from public.app_settings where key = 'admin_secret') then
    raise exception 'unauthorized';
  end if;
  delete from public.clients where id = p_id;
  return true;
end; $$;
grant execute on function public.admin_delete_client(text,bigint) to anon, authenticated;
```

Después, en el panel → pestaña **Clientes**, pega esa misma clave (el
campo "Clave de administrador") y ya puedes agregar/activar/desactivar/
eliminar clientes. El cambio aplica **de inmediato**: el formulario
re-valida el serial guardado contra Supabase en cada carga, así que
desactivar un cliente bloquea su dispositivo sin esperar nada más.

> Si Supabase no está configurado (o se cae la red), el login de cliente
> cae de respaldo a la lista fija `VALID_SERIALS` de `src/data/serials.js`
> — así nadie se queda sin poder entrar mientras configuras esto. Una vez
> que uses Supabase como fuente de verdad, esa lista queda como respaldo
> de emergencia; no hace falta borrarla.

## Agregar o editar una tienda (merchant)

Edita `src/data/merchants.js`:

```js
'mi-tienda': {
  id: 'mi-tienda',
  businessName: 'Mi Tienda',
  subtitle: 'Formulario de Envío',
  whatsappNumber: '51987654321', // número que recibe el pedido, sin '+'
  cutoffHour: 14,                // hora de corte en formato 24h
  shippingIntervalDays: 2,       // ofrece una fecha cada N días desde hoy
  weeksAhead: 2,                 // cuántas semanas de fechas mostrar
}
```

El enlace para esa tienda sería `tu-dominio.vercel.app/?merchant=mi-tienda`.

## Desarrollo local

```bash
npm install
npm run dev       # servidor de desarrollo
npm run lint      # oxlint
npm run build     # build de producción en dist/
npm run preview   # sirve el build de producción localmente
```

## Deploy a Vercel

El proyecto incluye `vercel.json` (framework Vite, build `npm run build`,
salida `dist/`). Para desplegar:

```bash
npx vercel        # preview
npx vercel --prod # producción
```

O impórtalo directamente desde el dashboard de Vercel apuntando a este
repositorio — lo detecta como proyecto Vite sin configuración adicional.
