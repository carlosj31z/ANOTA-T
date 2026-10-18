// BLOQUE 9 — RENDER PIPELINE. Verificación propia (CONTRATO §9.1).
//
// Levanta el dev server de Vite en el puerto 4202, abre el autotest del circuito
// "meadow" y, en la misma página, importa `src/render/index.js` para montar una
// escena de prueba propia (`src/render/devScene.js`) en un canvas a pantalla
// completa. Renderiza con low/high/ultra, mide ms por frame de cada nivel y
// captura shots/render-low.png, render-high.png y render-ultra.png.
//
// Comprueba que no hay errores de consola ni de shader y reporta JSON.

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = 4202;
const BASE = `http://localhost:${PORT}`;
const SHOTS = path.join(ROOT, 'shots');
const W = 1280;
const H = 720;
const FRAMES = 16;
const WARMUP = 4;
const QUALITIES = ['low', 'high', 'ultra'];

async function waitForServer(url, timeoutMs = 40000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status === 200) return;
    } catch {
      /* aún no está */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('El dev server de render no respondió a tiempo');
}

function isPipelineError(text) {
  return /THREE|WebGL|Shader|GLSL|program|render pipeline|grading|GTAO|SMAA|bloom/i.test(text);
}

async function main() {
  await mkdir(SHOTS, { recursive: true });

  const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
    cwd: ROOT,
    stdio: 'ignore',
  });
  const cleanup = () => {
    try {
      server.kill('SIGTERM');
    } catch {
      /* ignore */
    }
  };
  process.on('exit', cleanup);

  let browser = null;
  const report = { qualities: {}, pipelineErrors: [], otherErrors: [], ok: false };

  try {
    await waitForServer(BASE);
    const { chromium } = await import('playwright');
    browser = await chromium.launch({
      args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    });

    const page = await browser.newPage({ viewport: { width: W, height: H } });
    // Bloquea HMR: otros agentes editan src/* a la vez.
    await page.route('**/@vite/client', (route) => route.abort());
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const t = msg.text();
        (isPipelineError(t) ? report.pipelineErrors : report.otherErrors).push(t);
      }
    });
    page.on('pageerror', (err) => {
      const t = 'pageerror: ' + (err && err.message ? err.message : String(err));
      (isPipelineError(t) ? report.pipelineErrors : report.otherErrors).push(t);
    });

    await page.goto(`${BASE}/?autotest=1&track=meadow`, { waitUntil: 'load' });

    // Espera (con tolerancia) a que el juego esté en carrera y avanza 10 s.
    try {
      await page.waitForFunction(() => window.__game && window.__game.state === 'race', null, { timeout: 15000 });
      await page.evaluate(() => window.__game.simulate(10));
    } catch {
      report.otherErrors.push('aviso: el autotest del juego no llegó a "race" (se continúa con la escena propia)');
    }

    // Monta la escena de prueba + pipeline en un canvas propio.
    const setup = await page.evaluate(async ({ W, H }) => {
      const { createRenderPipeline } = await import('/src/render/index.js');
      const { createDevScene, THREE } = await import('/src/render/devScene.js');

      const canvas = document.createElement('canvas');
      canvas.id = 'render-test-canvas';
      canvas.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:9999;display:block';
      document.body.appendChild(canvas);

      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: false,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true, // permite leer el canvas para las capturas
      });
      renderer.setPixelRatio(1);
      renderer.setSize(W, H);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;

      const dev = createDevScene(renderer);
      const pipeline = createRenderPipeline(renderer, dev.scene, dev.camera, { quality: 'high' });
      pipeline.setSize(W, H);
      pipeline.setDynamicResolution(false); // medición limpia
      pipeline.setSun(dev.sun);

      window.__renderTest = { THREE, renderer, dev, pipeline };

      return { webgl2: !!(renderer.capabilities && renderer.capabilities.isWebGL2) };
    }, { W, H });
    report.webgl2 = setup.webgl2;

    for (const q of QUALITIES) {
      const data = await page.evaluate(
        async ({ q, FRAMES, WARMUP }) => {
          const { renderer, dev, pipeline } = window.__renderTest;
          pipeline.setQuality(q);
          pipeline.setSize(window.innerWidth, window.innerHeight);
          pipeline.setFocus(dev.focus);
          // Encuadre fijo para que las capturas sean comparables.
          dev.camera.position.set(6.2, 4.2, 9.0);
          dev.camera.lookAt(dev.focus);

          for (let i = 0; i < WARMUP; i++) pipeline.render(1 / 60);

          const t0 = performance.now();
          for (let i = 0; i < FRAMES; i++) pipeline.render(1 / 60);
          const ms = (performance.now() - t0) / FRAMES;

          // Render final y lectura del canvas (evita page.screenshot, que se
          // atasca con el juego de fondo + SwiftShader).
          pipeline.render(1 / 60);
          const dataUrl = renderer.domElement.toDataURL('image/png');

          return {
            ms: Math.round(ms * 100) / 100,
            calls: renderer.info.render.calls,
            triangles: renderer.info.render.triangles,
            dataUrl,
          };
        },
        { q, FRAMES, WARMUP }
      );

      const base64 = data.dataUrl.replace(/^data:image\/png;base64,/, '');
      await writeFile(path.join(SHOTS, `render-${q}.png`), Buffer.from(base64, 'base64'));
      report.qualities[q] = { ms: data.ms, calls: data.calls, triangles: data.triangles };
    }

    await page.evaluate(() => {
      const t = window.__renderTest;
      if (!t) return;
      t.pipeline.dispose();
      t.renderer.dispose();
      const c = document.getElementById('render-test-canvas');
      if (c) c.remove();
    });

    await page.close();

    const allMeasured = QUALITIES.every((q) => report.qualities[q] && report.qualities[q].ms > 0);
    report.ok = allMeasured && report.pipelineErrors.length === 0;
  } catch (err) {
    report.error = err && err.message ? err.message : String(err);
    report.ok = false;
  } finally {
    if (browser) await browser.close();
    cleanup();
  }

  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  process.exit(report.ok ? 0 : 1);
}

main().catch((err) => {
  process.stderr.write('render-check falló: ' + (err && err.stack ? err.stack : String(err)) + '\n');
  process.exit(1);
});
