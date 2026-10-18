// Bloque 2 — Prueba numérica de ventajas (contrato §10.2 / SPEC C15).
// Levanta el dev server de Vite en el puerto 4183 (exclusivo del bloque 2),
// abre ?autotest=1&track=meadow y, sobre los karts reales que expone el core,
// comprueba:
//   - Mishi (siete_vidas): el 1er hit() de la vuelta NO produce spin y el 2º SÍ.
//   - Bolt (blindaje): su spinTime tras un golpe es 0.6× el de Rayo.
// Imprime un JSON con el resultado.

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = 4183;
const BASE = `http://localhost:${PORT}`;

async function waitForServer(url, timeoutMs = 40000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status === 200) return true;
    } catch {
      /* aún no está */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

async function main() {
  const server = spawn(
    'npx',
    ['vite', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'],
    { cwd: ROOT, stdio: 'ignore' }
  );
  const cleanup = () => {
    try {
      server.kill('SIGTERM');
    } catch {
      /* ignore */
    }
  };
  process.on('exit', cleanup);

  let browser = null;
  const report = { ok: false, errors: [], results: null };

  try {
    const up = await waitForServer(BASE);
    if (!up) throw new Error('El dev server no respondió en el puerto ' + PORT);

    const { chromium } = await import('playwright');
    browser = await chromium.launch({
      args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    });
    const page = await browser.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error') report.errors.push(msg.text());
    });
    page.on('pageerror', (err) =>
      report.errors.push('pageerror: ' + (err && err.message ? err.message : String(err)))
    );

    await page.goto(`${BASE}/?autotest=1&track=meadow`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__game && window.__game.state === 'race', null, {
      timeout: 30000,
    });

    report.results = await page.evaluate(async () => {
      const g = window.__game;
      const out = { perkIds: g.karts.map((k) => k.character.perk && k.character.perk.id) };

      // --- siete_vidas (Mishi): 1er golpe ignorado, 2º aplicado ---
      const mishi = g.karts.find((k) => k.character.perk && k.character.perk.id === 'siete_vidas');
      if (mishi) {
        const pos = mishi.position.clone();
        mishi.setTransform(pos, mishi.heading);
        const before = mishi.state.spinTime;
        mishi.hit('test');
        const afterFirst = mishi.state.spinTime;
        mishi.hit('test');
        const afterSecond = mishi.state.spinTime;
        out.sieteVidas = { before, afterFirst, afterSecond };
      } else {
        out.sieteVidas = null;
      }

      // --- blindaje (Bolt) vs rayo: spinTime ×0.6. Se construyen karts
      //     directamente porque la parrilla puede no incluir a Bolt.
      const mod = await import('/src/kart/dev-api.js');
      const THREE = mod.THREE;
      const scene = new THREE.Scene();
      const mk = (id) => {
        const c = mod.CHARACTERS.find((x) => x.id === id);
        return mod.createKart(scene, c, { isPlayer: false });
      };
      const bolt = mk('bolt');
      const rayo = mk('rayo');
      const spin = (k) => {
        k.setTransform(new THREE.Vector3(0, 0, 0), 0);
        k.hit('test');
        return k.state.spinTime;
      };
      const boltSpin = spin(bolt);
      const baseSpin = spin(rayo);
      out.blindaje = { boltSpin, baseSpin, ratio: baseSpin > 0 ? boltSpin / baseSpin : null };
      out.devKartsOk = boltSpin > 0 && baseSpin > 0;

      // --- rugido (Rex): boost de objeto ×1.35 ---
      const rex = mk('rex');
      rex.setTransform(new THREE.Vector3(0, 0, 0), 0);
      rex.applyBoost(1, 1, 'item');
      const rexBoost = rex.state.boostTime;
      const rayo2 = mk('rayo');
      rayo2.setTransform(new THREE.Vector3(0, 0, 0), 0);
      rayo2.applyBoost(1, 1, 'item');
      const baseBoost = rayo2.state.boostTime;
      out.rugido = { rexBoost, baseBoost, ratio: baseBoost > 0 ? rexBoost / baseBoost : null };

      // --- presencia de los 11 perks ---
      out.perkIdSet = [...new Set(g.karts.map((k) => k.character.perk && k.character.perk.id))];
      return out;
    });

    const r = report.results;
    const sieteOk = r.sieteVidas && r.sieteVidas.afterFirst === 0 && r.sieteVidas.afterSecond > 0;
    const blindajeOk = r.blindaje && Math.abs(r.blindaje.ratio - 0.6) < 0.02;
    const rugidoOk = r.rugido && Math.abs(r.rugido.ratio - 1.35) < 0.02;
    report.ok = !!sieteOk && !!blindajeOk && !!rugidoOk && report.errors.length === 0;
    report.checks = { sieteOk: !!sieteOk, blindajeOk: !!blindajeOk, rugidoOk: !!rugidoOk };
  } catch (err) {
    report.errors.push('fatal: ' + (err && err.stack ? err.stack : String(err)));
  } finally {
    if (browser) await browser.close();
    cleanup();
  }

  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  process.exit(report.ok ? 0 : 1);
}

main().catch((err) => {
  process.stderr.write('kart-perks falló: ' + (err && err.stack ? err.stack : String(err)) + '\n');
  process.exit(1);
});
