import { createServer } from "vite";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const server = await createServer({
  server: {
    host: "127.0.0.1",
    port: 5193,
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
const dir = "docs/football-pinball/evidence-modes";
await mkdir(dir, { recursive: true });
await mkdir("public/football-pinball/cards", { recursive: true });
const results = [];
try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  await page.addInitScript(() =>
    sessionStorage.setItem("infinite-pinball-demo-access", "granted"),
  );
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:5193/football-pinball/?mode=pvp&qa");
  await page.waitForFunction(() => window.__football);
  await page.selectOption("[name=format]", "golden");
  await page.click("#fp-serve");
  await page.waitForFunction(() =>
    ["choice", "countdown", "active"].includes(
      window.__football?.snapshot().state,
    ),
  );
  if (await page.locator("#fp-toss-choices").isVisible())
    await page.click("[data-choice=kickoff]");
  await page.waitForFunction(
    () => window.__football.snapshot().state === "active",
  );
  await page.locator("[data-boot=blue-left]").scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => {
    const e = window.__football.engine,
      b = e.boots.find((b) => b.team === "blue" && b.x < 0),
      ball = e.balls[0];
    ball.body.setTranslation(
      {
        x: b.x + Math.cos(b.rest) * 0.95,
        y: 0.15,
        z: -(b.y + Math.sin(b.rest) * 0.95 + 0.31),
      },
      true,
    );
    ball.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    return { id: b.id, angle: b.angle };
  });
  const box = await page.locator("[data-boot=blue-left]").boundingBox();
  const session = await page.context().newCDPSession(page);
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }],
  });
  await page.waitForFunction(() =>
    window.__football
      .snapshot()
      .boots.some((b) => b.team === "blue" && b.pressed),
  );
  await page.evaluate(() => {
    for (let i = 0; i < 10; i++) window.__football.engine.step();
  });
  const pressed = await page.evaluate(() => window.__football.snapshot());
  assert(pressed.boots.find((b) => b.id === before.id).angle !== before.angle);
  assert(
    pressed.events.some(
      (e) => e.type === "COLLISION" && e.targetId === before.id,
    ),
  );
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page.waitForTimeout(180);
  assert.equal(
    await page.evaluate(
      () =>
        window.__football.snapshot().boots.find((b) => b.id === "blue-left")
          .pressed,
    ),
    false,
  );
  await page.screenshot({ path: dir + "/pvp-mobile.png" });
  await page
    .locator("#fp-arena canvas")
    .screenshot({ path: "public/football-pinball/cards/pvp.png" });
  results.push({
    check:
      "mobile touch changes actual boot angle, makes physics contact and releases",
    passed: true,
  });
  await page.click("#fp-reset");
  await page.click("#fp-serve");
  await page.waitForFunction(() =>
    ["choice", "countdown", "active"].includes(
      window.__football?.snapshot().state,
    ),
  );
  if (await page.locator("#fp-toss-choices").isVisible())
    await page.click("[data-choice=kickoff]");
  await page.waitForFunction(
    () => window.__football.snapshot().state === "active",
  );
  await page.evaluate(() => {
    const e = window.__football.engine,
      b = e.balls[0];
    b.body.setTranslation({ x: 0.72, y: 0.3, z: -4.94 }, true);
    b.body.setLinvel({ x: 0, y: 0, z: -3 }, true);
  });
  await page.waitForFunction(
    () => window.__football.snapshot().state === "ended",
  );
  assert.equal(await page.locator("#blueScore").textContent(), "1");
  assert.equal(await page.locator("#fp-results h2").textContent(), "Blue wins");
  results.push({
    check:
      "golden goal physics crossing updates HUD and final result once (seeded fixture)",
    passed: true,
  });
  await page.screenshot({ path: dir + "/pvp-result.png" });
  for (const mode of ["crash", "penalty", "arcade-rush"]) {
    await page.goto(
      "http://127.0.0.1:5193/football-pinball/?mode=" + mode + "&qa",
    );
    await page.waitForFunction(() => window.__football);
    await page.click("#fp-serve");
    await page.waitForFunction(
      () => window.__football.snapshot().state === "active",
    );
    assert.equal(
      await page.evaluate(() => window.__football.snapshot().boots.length),
      2,
    );
    if (mode === "crash") {
      await page.evaluate(() => {
        const e = window.__football.engine,
          b = e.balls[0],
          t = e.targets[0];
        b.body.setTranslation(
          { x: t.x - t.radius - 0.14, y: 0.14, z: -t.y },
          true,
        );
        b.body.setLinvel({ x: 3, y: 0, z: 0 }, true);
        for (let i = 0; i < 12; i++) e.step();
      });
      await page.click("#fp-pause");
      const frozen = await page.evaluate(
        () => window.__football.snapshot().activeTicks,
      );
      await page.waitForTimeout(250);
      assert.equal(
        await page.evaluate(() => window.__football.snapshot().activeTicks),
        frozen,
      );
      assert(
        (await page.evaluate(() => window.__football.snapshot().basePoints)) >
          0,
      );
      await page.screenshot({ path: dir + "/crash-mobile.png" });
      await page
        .locator("#fp-arena canvas")
        .screenshot({ path: "public/football-pinball/cards/crash.png" });
      await page.click("#fp-pause");
      await page.click("#fp-bank");
      await page.waitForFunction(
        () => window.__football.snapshot().state === "ended",
      );
      assert.equal(
        await page.locator("#fp-results h2").textContent(),
        "Points banked",
      );
      assert(
        (await page.evaluate(() => window.__football.snapshot().bankedPoints)) >
          0,
      );
      results.push({
        check:
          "Crash physical target, frozen pause, real Bank button and terminal banked points",
        passed: true,
      });
    } else if (mode === "penalty") {
      await page.click("#fp-pause");
      await page.screenshot({ path: dir + "/penalty-mobile.png" });
      await page
        .locator("#fp-arena canvas")
        .screenshot({ path: "public/football-pinball/cards/penalty.png" });
      await page.click("#fp-pause");
      await page.evaluate(() => {
        const e = window.__football.engine;
        for (let shot = 0; shot < 5; shot++) {
          if (e.state === "relaunch") for (let j = 0; j < 240; j++) e.step();
          const b = e.balls[0];
          b.body.setTranslation({ x: 0.8, y: 0.95, z: -4.94 }, true);
          b.body.setLinvel({ x: 0, y: 0, z: -4 }, true);
          for (let j = 0; j < 12; j++) e.step();
        }
      });
      await page.waitForFunction(
        () => window.__football.snapshot().state === "ended",
      );
      assert.equal(
        await page.evaluate(() => window.__football.snapshot().shot.goals),
        5,
      );
      await page.waitForFunction(
        () => document.querySelector("#fp-goals").textContent === "5",
      );
      assert.equal(await page.locator("#fp-goals").textContent(), "5");
      assert.equal(await page.locator("#fp-points").textContent(), "4,800");
      results.push({
        check:
          "Penalty five actual goal crossings, corner/streak bonuses and terminal HUD (fixture)",
        passed: true,
      });
    } else {
      await page.evaluate(() => {
        const e = window.__football.engine,
          b = e.balls[0],
          t = e.targets.find((t) => t.type === "multiball");
        b.body.setTranslation(
          { x: t.x - t.radius - 0.14, y: 0.14, z: -t.y },
          true,
        );
        b.body.setLinvel({ x: 3, y: 0, z: 0 }, true);
        for (let i = 0; i < 12; i++) e.step();
      });
      await page.click("#fp-pause");
      assert.equal(
        await page.evaluate(() => window.__football.snapshot().balls.length),
        3,
      );
      await page.screenshot({ path: dir + "/arcade-rush-mobile.png" });
      await page
        .locator("#fp-arena canvas")
        .screenshot({ path: "public/football-pinball/cards/arcade-rush.png" });
      await page.click("#fp-pause");
      await page.evaluate(() => {
        const e = window.__football.engine;
        e.activeTicks = e.durationTicks - 1;
        e.step();
      });
      await page.waitForFunction(
        () => window.__football.snapshot().state === "ended",
      );
      await page.locator(".fp-records").waitFor({state:"visible"});assert(await page.locator(".fp-records").isVisible());
      results.push({
        check:
          "Rush physical multiball, three unique balls, timer locks result and device records (fixture)",
        passed: true,
      });
    }
    assert.deepEqual(
      await page.evaluate(() => window.__football.view.metrics().failedAssets),
      [],
    );
    const replaced = await page.evaluate(async () => {
      await window.__football.view.replaceAsset(
        "football",
        "/models/football/football.glb",
      );
      return window.__football.view.metrics();
    });
    assert(replaced.assetsLoaded.includes("football"));
    for (const width of [360, 430, 1440]) {
      await page.setViewportSize({
        width,
        height: width === 1440 ? 1000 : 844,
      });
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
    }
    await page.setViewportSize({ width: 390, height: 844 });
  }
  assert.deepEqual(errors, []);
  results.push({ check: "no runtime errors", passed: true });
  await writeFile(
    dir + "/results.json",
    JSON.stringify(
      {
        fixtureNote:
          "Ball placement is an explicit physics test fixture; touch is real Chromium mobile input.",
        results,
      },
      null,
      2,
    ),
  );
  console.log(results);
} finally {
  await browser.close();
  await server.close();
}
