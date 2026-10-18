# Rally Relámpago — Android (APK)

Empaquetado del juego web (Three.js) como app Android nativa con **Capacitor 8**.
La app fuerza orientación horizontal, pantalla completa inmersiva, sin zoom en el
WebView y con icono y splash generados por código.

- **appId**: `com.rallyrelampago.game`
- **Nombre**: Rally Relámpago
- **Salida**: `apk/rally-relampago-debug.apk` (firma debug)
- **Config**: `capacitor.config.json` · **Proyecto nativo**: `android/`

## Generar el APK

Un solo comando (instala el Android SDK la primera vez si falta):

```bash
npm run apk
# equivalente a: bash scripts/build-apk.sh
```

`scripts/build-apk.sh` hace, en orden:

1. Comprueba/instala el **Android SDK** en `$ANDROID_HOME` (por defecto
   `~/android-sdk`): command-line tools oficiales, `platform-tools`,
   `platforms;android-36` y `build-tools;36.0.0` (las versiones que pide
   Capacitor 8).
2. `npm run build` (Vite → `dist/`). Si el build falla porque otro proceso está
   escribiendo `src/`, reintenta hasta 5 veces cada 60 s.
3. `npx cap sync android` (copia los assets web y actualiza plugins).
4. `cd android && ./gradlew assembleDebug`.
5. Copia el resultado a `apk/rally-relampago-debug.apk`.

**Requisitos**: JDK 21 (Capacitor 8 lo exige) y conexión a `dl.google.com`,
`repo.maven.apache.org` y `services.gradle.org` (el primer build descarga el
wrapper de Gradle y las dependencias de AndroidX).

### Regenerar solo los assets web (sin recompilar nativo)

```bash
npm run build && npx cap sync android
```

## Regenerar icono y splash

```bash
node scripts/make-icons.mjs
```

Dibuja un emblema procedural (rayo amarillo-naranja sobre círculo azul oscuro
con borde dorado) en SVG y lo rasteriza con el Chromium del sistema vía
Playwright, sin `playwright install`. Escribe todas las densidades mipmap
(`ic_launcher`, `ic_launcher_round` y el foreground adaptativo 108dp) y todos
los splash (`drawable-land-*`, `drawable-port-*`) en
`android/app/src/main/res/`, además de los maestros `resources/icon.png` y
`resources/splash.png`.

## Verificar el APK

```bash
$ANDROID_HOME/build-tools/36.0.0/aapt2 dump badging apk/rally-relampago-debug.apk
```

Debe mostrar `package: name='com.rallyrelampago.game'`, el label
`Rally Relámpago` y la actividad `com.rallyrelampago.game.MainActivity`.
La orientación fija (`sensorLandscape`) y los assets web se comprueban con:

```bash
$ANDROID_HOME/build-tools/36.0.0/aapt2 dump xmltree \
  --file AndroidManifest.xml apk/rally-relampago-debug.apk | grep screenOrientation
unzip -l apk/rally-relampago-debug.apk | grep assets/public/index.html
```

## Instalar el APK en el móvil

El APK tiene **firma de depuración**: sirve para probar, no para publicar en
Google Play.

### Opción A — copiando el archivo (sin cable)

1. Pasa `apk/rally-relampago-debug.apk` al teléfono (USB/MTP, Google Drive,
   Telegram a ti mismo, etc.).
2. En el teléfono, abre el archivo desde la app **Archivos** o la notificación
   de descarga.
3. Android pedirá permiso para instalar apps de esa fuente: activa
   **"Permitir desde esta fuente"** / **"Instalar apps desconocidas"** para la
   app que abre el archivo (Ajustes → Apps → Acceso especial → Instalar apps
   desconocidas).
4. Pulsa **Instalar**. Si ya había una versión anterior, instala encima; si da
   error de firma, desinstala la anterior y vuelve a instalar.

### Opción B — por adb (con cable y depuración USB activada)

```bash
$ANDROID_HOME/platform-tools/adb install -r apk/rally-relampago-debug.apk
```

## Notas técnicas

- `AndroidManifest.xml`: actividad con `android:screenOrientation="sensorLandscape"`
  y `android:hardwareAccelerated="true"`.
- `MainActivity.java`: pantalla completa inmersiva con `WindowInsetsController`
  (oculta barras del sistema, se recuperan con gesto desde el borde) y desactiva
  el zoom del WebView.
- `styles.xml`: tema sin ActionBar y `AppTheme.NoActionBarLaunch` a pantalla
  completa para el splash.
- El arranque usa `Theme.SplashScreen` (`androidx.core:core-splashscreen`) con
  `drawable/splash` y transición al tema `AppTheme.NoActionBar`.
- El proyecto nativo de Capacitor ya trae su propio `.gitignore`
  (`android/.gitignore` + `android/app/.gitignore`) que excluye `build/`,
  `.gradle/`, `local.properties` y los assets copiados.
