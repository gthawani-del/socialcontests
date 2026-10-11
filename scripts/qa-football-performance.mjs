import { createServer } from "vite";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const server = await createServer({
  server: {
    host: "127.0.0.1",
    port: 5197,
    hmr: false,
    watch: { ignored: ["**/*"] },
  },
  logLevel: "error",
});
await server.listen();
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH,
  args: [
    "--no-sandbox",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.addInitScript(() =>
    sessionStorage.setItem("infinite-pinball-demo-access", "granted"),
  );
  await page.goto(
    "http://127.0.0.1:5197/football-pinball/?mode=arcade-rush&qa",
  );
  await page.waitForFunction(() => window.__football);
  await page.click("#fp-serve");
  await page.waitForFunction(
    () => window.__football.snapshot().state === "active",
  );
  const sample = await page.evaluate(async () => {
    const values = [];
    let last = performance.now(),
      end = last + 3000;
    await new Promise((resolve) => {
      function frame(now) {
        values.push(now - last);
        last = now;
        if (now < end) requestAnimationFrame(frame);
        else resolve();
      }
      requestAnimationFrame(frame);
    });
    values.sort((a, b) => a - b);
    return {
      frames: values.length,
      meanMs: values.reduce((a, b) => a + b, 0) / values.length,
      p95Ms: values[Math.floor(values.length * 0.95)],
      metrics: window.__football.view.metrics(),
    };
  });
  const memories = [];
  for (let i = 0; i < 10; i++) {
    await page.click("#fp-reset");
    await page.waitForFunction(
      () => window.__football.snapshot().state === "ready",
    );
    await page.click("#fp-serve");
    await page.waitForFunction(
      () => window.__football.snapshot().state === "active",
    );
    memories.push(await page.evaluate(() => window.__football.view.metrics()));
  }
  assert(memories.at(-1).geometries <= memories[0].geometries + 2);
  assert(memories.at(-1).textures <= memories[0].textures + 1);
  await mkdir("docs/football-pinball/evidence-modes", { recursive: true });
  await writeFile(
    "docs/football-pinball/evidence-modes/performance.json",
    JSON.stringify(
      {
        environment:
          "Headless Chromium153, SwiftShader software GPU,390x844; not a physical mobile benchmark",
        sample,
        restartMemories: memories,
        resourceStabilityPassed: true,
        automaticFallbackObserved: memories.some(m=>m.quality==="low"),
        performanceTargetMet: sample.meanMs<=1000/30,
      },
      null,
      2,
    ),
  );
  console.log({ sample, restartStable: true });
} finally {
  await browser.close();
  await server.close();
}
