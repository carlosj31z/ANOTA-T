# Formulario de Envío Logístico

Formulario de envío/recojo mobile-first para e-commerce, construido con
React + Vite + Tailwind CSS. Cada tienda comparte un enlace con
`?merchant=<id>`; el cliente completa sus datos y termina enviando el
resumen por WhatsApp.

## Portal de acceso (rol: administrador / negociante)

Antes de mostrar cualquier contenido, la app abre una ventana de acceso
(`src/components/AccessGate.jsx`) que pregunta **¿Cómo deseas ingresar?**
con dos opciones:

- **Administrador** → pide usuario y contraseña. Las credenciales están
  en `src/utils/serial.js` (`ADMIN_USER` / `ADMIN_PASSWORD`).
- **Negociante** → pide una clave serial. Solo los códigos listados en
  `src/data/serials.js` desbloquean el formulario; cualquier otro valor
  muestra un error y no deja avanzar.

Al validar (admin o serial), el rol se guarda en `localStorage`
(`anotate-access-role`) para no volver a pedirlo en ese dispositivo — si
luego quitas un serial de la lista, ese dispositivo se vuelve a bloquear
en la siguiente carga.

> Es una barrera del lado del cliente (no hay backend que la respalde),
> pensada para repartir acceso por código/credencial, no como seguridad
> real: cualquiera que inspeccione el bundle puede leer los seriales y la
> contraseña de administrador. Para seguridad real se necesita validar
> contra un servidor.

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
2. Las fechas de envío se calculan cada `shippingIntervalDays` días (por
   defecto 2) a partir de la fecha del dispositivo del cliente; si ya
   pasó la hora de corte (`cutoffHour`) de hoy, todo el calendario se
   corre un día más.
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
(`src/components/AgencyManager.jsx`) para sumar agencias propias al
directorio oficial sin tocar el código:

- **Resumen por courier:** cuántas agencias oficiales (baked-in) y cuántas
  propias hay cargadas de cada uno.
- **Agregar una agencia:** formulario con courier, departamento, provincia,
  distrito, zona, dirección, referencia y lat/lng opcionales. Si no pones
  coordenadas, se calculan por distrito/departamento para el orden por
  cercanía.
- **Importar en lote:** pega o **sube un archivo** en tres formatos —
  *Listado* (bloques de 3 líneas como el documento oficial de Shalom),
  *CSV* (`courier,department,province,district,zone,address,reference[,lat,lng]`)
  o *JSON* (arreglo de objetos). Un selector fija el courier por defecto
  para las filas que no lo traigan.
- **Exportar / Vaciar:** descarga las agencias propias como JSON (para
  respaldarlas o llevarlas a otro equipo) o bórralas.

> Las agencias propias se guardan en `localStorage` de **ese dispositivo**
> (clave `anotate-custom-agencies`) y se combinan con el directorio oficial
> en `getAgenciesForCourier()`. Al ser una app estática no hay backend
> compartido: para que todos los dispositivos las vean, agrégalas al
> archivo generado o intégralas por export/import. El directorio oficial
> baked-in sí es global para todos los usuarios.

Esto es una aproximación honesta, no una integración en vivo. Si más
adelante consigues credenciales de Shalom Pro o de Olva, basta con
reemplazar `getAgenciesForCourier()` en `src/data/agencies.js` por una
llamada a tu backend — el resto de la app (búsqueda, orden por
distancia, resumen de WhatsApp) ya espera ese mismo formato de objeto
(`{ id, label, address, reference, lat, lng }`) y no necesita cambios.

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
