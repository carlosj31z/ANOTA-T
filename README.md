# Formulario de Envío Logístico

Formulario de envío/recojo mobile-first para e-commerce, construido con
React + Vite + Tailwind CSS. Cada tienda comparte un enlace con
`?merchant=<id>`; el cliente completa sus datos y termina enviando el
resumen por WhatsApp.

## Portal de acceso (serial)

Antes de mostrar cualquier contenido, la app pide un serial ("Ingrese
serial para desbloquear todas las funciones"). Solo los códigos listados
en `src/data/serials.js` desbloquean el formulario; cualquier otro valor
muestra un error y no deja avanzar. Una vez validado, el serial se
guarda en `localStorage` para no volver a pedirlo en ese dispositivo —
si luego quitas ese código de la lista, se vuelve a bloquear en la
siguiente carga. Es una barrera del lado del cliente (no hay backend
que la respalde), pensada para repartir acceso por código, no como
seguridad real: cualquiera con acceso al código fuente puede leer la
lista de seriales o desactivar la verificación.

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
   - **Retiro en agencia** (Shalom / Marvisur / Olva Courier) — buscador de
     agencias con geolocalización (ver abajo) + DNI/CE.
   - **Otra agencia / encomienda** — nombre y dirección de recojo libres,
     para couriers fuera del catálogo.
4. Al enviar, se valida todo en tiempo real y se muestra la pantalla de
   confirmación con un resumen y un botón para mandarlo por WhatsApp
   (`wa.me`) con emojis y negritas, al número configurado del merchant.

## Sobre las "agencias cercanas" (Shalom, Marvisur, Olva Courier)

Antes de construir esto se investigó si estas 3 empresas peruanas ofrecen
una API pública para ubicar agencias por geolocalización. Resultado:

- **Ninguna tiene una API pública y gratuita.**
- **Shalom** tiene una API B2B ("Shalom Pro") para tracking, catálogo de
  agencias y creación de guías, pero requiere solicitar credenciales como
  cliente comercial.
- **Olva Courier** solo ofrece integración por API mediante contacto
  comercial directo (proceso de 2-4 semanas), sin documentación pública.
- **Marvisur** no tiene ninguna API documentada.
- Además, `olvacourier.com`, `shalom.com.pe` y `expresomarvisur.com` no
  envían cabeceras CORS para consumo desde un dominio de terceros, así que
  aunque se consiguieran credenciales, no se podría llamar a esas APIs
  directamente desde el navegador (necesitarían un backend/proxy propio).

**Solución implementada:** un directorio propio y curado en
`src/data/agencies.js` con direcciones reales (recopiladas de las páginas
de agencias de cada empresa) en varias ciudades del Perú — para Olva
Courier cubre 22 de los 25 departamentos —, con coordenadas aproximadas
a nivel de distrito/ciudad. El formulario pide
permiso de geolocalización al navegador (`navigator.geolocation`) y
ordena las agencias por distancia real (fórmula de Haversine, ver
`src/utils/geo.js`), mostrando "~X km" junto a cada resultado.

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
