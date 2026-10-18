#!/usr/bin/env bash
# Construye el APK de depuración de "Rally Relámpago" de forma reproducible.
#
# Pasos: build web (Vite) -> sync de Capacitor -> assembleDebug de Gradle ->
# copia el APK a apk/rally-relampago-debug.apk. Si falta el Android SDK, lo
# instala (command-line tools oficiales) en $ANDROID_HOME (~/android-sdk).
#
# Uso: npm run apk   (o bash scripts/build-apk.sh)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# --- Android SDK -------------------------------------------------------------
export ANDROID_HOME="${ANDROID_HOME:-$HOME/android-sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

SDK_PLATFORM="platforms;android-36"
SDK_BUILDTOOLS="build-tools;36.0.0"
CLT_URL="https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"

ensure_sdk() {
  if [ -d "$ANDROID_HOME/platforms/android-36" ] \
     && [ -d "$ANDROID_HOME/build-tools/36.0.0" ] \
     && [ -d "$ANDROID_HOME/platform-tools" ]; then
    echo "[sdk] Android SDK ya presente en $ANDROID_HOME"
    return
  fi

  echo "[sdk] Instalando Android SDK en $ANDROID_HOME ..."
  mkdir -p "$ANDROID_HOME/cmdline-tools"
  if [ ! -x "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" ]; then
    local tmp
    tmp="$(mktemp -d)"
    echo "[sdk] Descargando command-line tools ..."
    curl -fsSL -o "$tmp/cmdline-tools.zip" "$CLT_URL"
    unzip -q -o "$tmp/cmdline-tools.zip" -d "$tmp"
    rm -rf "$ANDROID_HOME/cmdline-tools/latest"
    mv "$tmp/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest"
    rm -rf "$tmp"
  fi

  echo "[sdk] Aceptando licencias ..."
  yes | "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" \
    --sdk_root="$ANDROID_HOME" --licenses >/dev/null 2>&1 || true

  echo "[sdk] Instalando platform-tools, $SDK_PLATFORM y $SDK_BUILDTOOLS ..."
  "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" --sdk_root="$ANDROID_HOME" \
    "platform-tools" "$SDK_PLATFORM" "$SDK_BUILDTOOLS"
}

ensure_sdk

# AGP localiza el SDK por local.properties o por ANDROID_HOME.
echo "sdk.dir=$ANDROID_HOME" > android/local.properties

# --- Build web (con reintentos por si otros bloques editan src/*) ------------
build_web() {
  local intento=0
  while true; do
    intento=$((intento + 1))
    if npm run build; then
      return 0
    fi
    if [ "$intento" -ge 5 ]; then
      echo "[web] El build falló tras $intento intentos." >&2
      return 1
    fi
    echo "[web] Build falló (¿src/* a medias?). Reintento en 60 s ($intento/5) ..."
    sleep 60
  done
}
build_web

# --- Sincronizar assets y plugins con Capacitor ------------------------------
npx cap sync android

# --- Compilar el APK de depuración -------------------------------------------
echo "[gradle] assembleDebug ..."
(cd android && ./gradlew assembleDebug)

# --- Copiar resultado --------------------------------------------------------
mkdir -p apk
cp android/app/build/outputs/apk/debug/app-debug.apk apk/rally-relampago-debug.apk
echo "[apk] Generado: apk/rally-relampago-debug.apk"
