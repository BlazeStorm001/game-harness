import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

import { access, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const MAX_EVENTS = 12;
const MAX_TEXT = 500;

type BrowserEvent = {
  kind: string;
  text: string;
};

type BrowserState = {
  browser?: any;
  context?: any;
  page?: any;
  events: BrowserEvent[];
};

const state: BrowserState = { events: [] };

function remember(kind: string, value: unknown) {
  const text = String(value ?? "").replace(/\s+/g, " ").slice(0, MAX_TEXT);
  state.events.push({ kind, text });
  state.events = state.events.slice(-MAX_EVENTS);
}

async function closeBrowser() {
  await state.browser?.close().catch(() => undefined);
  state.browser = undefined;
  state.context = undefined;
  state.page = undefined;
  state.events = [];
}

function harnessRoot(cwd: string) {
  return resolve(process.env.AGENT_EVAL_HARNESS_DIR || resolve(cwd, ".harness"));
}

async function loadChromium(cwd: string) {
  const root = harnessRoot(cwd);
  const entry = resolve(root, "node_modules/playwright/index.mjs");
  await access(entry).catch(() => {
    throw new Error(
      `Playwright is not installed in ${root}. Run harness/scripts/setup.sh --install first.`,
    );
  });

  const playwright = await import(pathToFileURL(entry).href);
  return playwright.chromium;
}

async function browserLaunchOptions(cwd: string, chromium: any) {
  const expected = chromium.executablePath();
  if (await access(expected).then(() => true).catch(() => false)) return { headless: true };

  const browserRoot = resolve(harnessRoot(cwd), ".runtime/browsers");
  const revisions = await readdir(browserRoot, { withFileTypes: true }).catch(() => []);
  const candidates = revisions
    .filter((entry) => entry.isDirectory() && /^chromium(?:_headless_shell)?-/.test(entry.name))
    .sort((left, right) => right.name.localeCompare(left.name))
    .flatMap((entry) => [
      resolve(browserRoot, entry.name, "chrome-headless-shell-linux64/chrome-headless-shell"),
      resolve(browserRoot, entry.name, "chrome-linux64/chrome"),
    ]);

  for (const executablePath of candidates) {
    if (await access(executablePath).then(() => true).catch(() => false)) {
      return { headless: true, executablePath };
    }
  }

  throw new Error(
    `No usable Chromium executable was found in ${browserRoot} (Playwright expected ${expected}).`,
  );
}

function requirePage() {
  if (!state.page || state.page.isClosed()) {
    throw new Error("No game page is open. Call game_test with operation=open first.");
  }
  return state.page;
}

async function observe(includeScreenshot: boolean) {
  const page = requirePage();
  const pageState = await page.evaluate(() => {
    const compact = (value: any, depth = 0, seen = new WeakSet<object>()): any => {
      if (value === null || typeof value === "boolean" || typeof value === "number") return value;
      if (typeof value === "string") return value.slice(0, 500);
      if (typeof value === "undefined") return "[undefined]";
      if (typeof value === "function") return "[function]";
      if (typeof value !== "object") return String(value).slice(0, 500);
      if (depth >= 5) return "[max depth]";
      if (seen.has(value)) return "[circular]";
      seen.add(value);

      if (Array.isArray(value)) {
        return value.slice(0, 40).map((item) => compact(item, depth + 1, seen));
      }

      return Object.fromEntries(
        Object.entries(value)
          .slice(0, 60)
          .map(([key, item]) => [key, compact(item, depth + 1, seen)]),
      );
    };

    const gameTest = (window as any).__gameTest;
    let snapshot: any = null;
    let snapshotError: string | null = null;
    let actions: any = null;

    if (gameTest && typeof gameTest.snapshot === "function") {
      try {
        snapshot = compact(gameTest.snapshot());
      } catch (error) {
        snapshotError = String(error).slice(0, 500);
      }
    }

    if (gameTest && typeof gameTest.actions === "function") {
      try {
        actions = compact(gameTest.actions());
      } catch (error) {
        snapshotError ??= `actions(): ${String(error).slice(0, 450)}`;
      }
    }

    const canvases = [...document.querySelectorAll("canvas")].slice(0, 8).map((canvas, index) => {
      const rect = canvas.getBoundingClientRect();
      let pixels: any = null;

      try {
        const probe = document.createElement("canvas");
        probe.width = 32;
        probe.height = 32;
        const context = probe.getContext("2d", { willReadFrequently: true });
        if (context && canvas.width > 0 && canvas.height > 0) {
          context.drawImage(canvas, 0, 0, 32, 32);
          const data = context.getImageData(0, 0, 32, 32).data;
          const colors = new Set<string>();
          let visible = 0;
          let sum = 0;
          let sumSquares = 0;

          for (let offset = 0; offset < data.length; offset += 4) {
            const red = data[offset];
            const green = data[offset + 1];
            const blue = data[offset + 2];
            const alpha = data[offset + 3];
            if (alpha > 8) visible++;
            const luminance = (red * 299 + green * 587 + blue * 114) / 1000;
            sum += luminance;
            sumSquares += luminance * luminance;
            colors.add(`${red >> 4},${green >> 4},${blue >> 4},${alpha >> 6}`);
          }

          const count = data.length / 4;
          const mean = sum / count;
          pixels = {
            sampledPixels: count,
            visibleRatio: Number((visible / count).toFixed(3)),
            uniqueColorBuckets: colors.size,
            luminanceStdDev: Number(Math.sqrt(Math.max(0, sumSquares / count - mean * mean)).toFixed(2)),
          };
        }
      } catch (error) {
        pixels = { error: String(error).slice(0, 300) };
      }

      return {
        index,
        bitmap: { width: canvas.width, height: canvas.height },
        displayed: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
        pixels,
      };
    });

    const controls = [...document.querySelectorAll("button, a, input, select, [role=button]")]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      })
      .slice(0, 20)
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        text: (element.textContent || (element as HTMLInputElement).value || "").trim().slice(0, 120),
        ariaLabel: element.getAttribute("aria-label"),
      }));

    return {
      url: location.href,
      title: document.title,
      viewport: { width: innerWidth, height: innerHeight },
      visibility: document.visibilityState,
      activeElement: document.activeElement?.tagName.toLowerCase() ?? null,
      bodyText: (document.body?.innerText ?? "").replace(/\s+/g, " ").trim().slice(0, 1500),
      controls,
      canvases,
      gameTest: {
        available: Boolean(gameTest),
        methods: gameTest
          ? ["reset", "actions", "act", "step", "snapshot"].filter(
              (name) => typeof gameTest[name] === "function",
            )
          : [],
        actions,
        snapshot,
        error: snapshotError,
      },
    };
  });

  const observation = {
    ...pageState,
    browserEvents: [...state.events],
  };

  const content: any[] = [
    {
      type: "text",
      text: JSON.stringify(observation, null, 2),
    },
  ];

  if (includeScreenshot) {
    const screenshot = await page.screenshot({ type: "png" });
    content.push({
      type: "image",
      data: screenshot.toString("base64"),
      mimeType: "image/png",
    });
  }

  return { observation, content };
}

const operations = Type.Union([
  Type.Literal("open"),
  Type.Literal("observe"),
  Type.Literal("key"),
  Type.Literal("click"),
  Type.Literal("action"),
  Type.Literal("step"),
  Type.Literal("wait"),
  Type.Literal("reset"),
  Type.Literal("reload"),
  Type.Literal("close"),
]);

export default function gameTestExtension(pi: ExtensionAPI) {
  pi.registerTool({
    name: "game_test",
    label: "Game Test",
    description:
      "Drive and inspect a running browser game as an action-transition-observation loop. " +
      "Start the game's dev server with bash, open its URL, then use keyboard/mouse input or " +
      "the optional window.__gameTest contract. Every operation returns compact state and errors; " +
      "screenshots are included by default for open and observe.",
    promptSnippet: "Play and inspect a running browser game through deterministic state transitions",
    promptGuidelines: [
      "Use game_test on the actual running game before claiming browser behavior works.",
      "For reliable tests, expose window.__gameTest with reset(seed), actions(), act(action, payload), step(frames), and snapshot(); keep it JSON-serializable and production behavior unchanged.",
      "Test meaningful transitions by observing state before and after input, including start, gameplay, damage/scoring or objectives, win/loss, and restart when those states exist.",
      "Check browserEvents and canvas pixel signals for runtime errors, missing assets, blank rendering, and unchanged output; request screenshots at important visual checkpoints.",
    ],
    executionMode: "sequential",
    parameters: Type.Object({
      operation: operations,
      url: Type.Optional(
        Type.String({ description: "URL for open, for example http://127.0.0.1:8000." }),
      ),
      action: Type.Optional(
        Type.String({ description: "High-level action name for operation=action." }),
      ),
      payload: Type.Optional(
        Type.Unknown({ description: "Optional JSON-serializable payload for operation=action." }),
      ),
      key: Type.Optional(
        Type.String({ description: "Playwright key name for operation=key, such as Enter, ArrowLeft, or Space." }),
      ),
      x: Type.Optional(Type.Number({ description: "Viewport x coordinate for operation=click." })),
      y: Type.Optional(Type.Number({ description: "Viewport y coordinate for operation=click." })),
      frames: Type.Optional(
        Type.Integer({ description: "Frame count for operation=step.", minimum: 1, maximum: 3600 }),
      ),
      seed: Type.Optional(Type.Integer({ description: "Deterministic seed for operation=reset." })),
      durationMs: Type.Optional(
        Type.Integer({
          description: "Key hold or wait duration in milliseconds.",
          minimum: 0,
          maximum: 30000,
        }),
      ),
      settleMs: Type.Optional(
        Type.Integer({
          description: "Delay after the operation before observing. Defaults to 100ms.",
          minimum: 0,
          maximum: 10000,
        }),
      ),
      screenshot: Type.Optional(
        Type.Boolean({ description: "Include a screenshot. Defaults to true for open/observe and false otherwise." }),
      ),
    }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      if (signal?.aborted) throw new Error("Game test operation aborted.");

      const includeScreenshot = params.screenshot ?? ["open", "observe"].includes(params.operation);
      const settleMs = params.settleMs ?? 100;

      onUpdate?.({
        content: [{ type: "text", text: `Game test: ${params.operation}...` }],
        details: { operation: params.operation },
      });

      if (params.operation === "close") {
        await closeBrowser();
        return {
          content: [{ type: "text", text: "Browser closed." }],
          details: { operation: "close" },
        };
      }

      if (params.operation === "open") {
        if (!params.url) throw new Error("operation=open requires url.");
        await closeBrowser();
        const chromium = await loadChromium(ctx.cwd);
        state.browser = await chromium.launch(await browserLaunchOptions(ctx.cwd, chromium));
        state.context = await state.browser.newContext({
          viewport: { width: 1280, height: 720 },
        });
        state.page = await state.context.newPage();
        state.page.on("console", (message: any) => {
          if (["error", "warning"].includes(message.type())) remember(`console.${message.type()}`, message.text());
        });
        state.page.on("pageerror", (error: any) => remember("pageerror", error));
        state.page.on("requestfailed", (request: any) => {
          remember("requestfailed", `${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}`);
        });
        state.page.on("response", (response: any) => {
          if (response.status() >= 400) remember("http", `${response.status()} ${response.url()}`);
        });

        try {
          await state.page.goto(params.url, { waitUntil: "domcontentloaded", timeout: 15000 });
        } catch (error) {
          await closeBrowser();
          throw new Error(`Could not open ${params.url}: ${String(error)}`);
        }
      } else {
        const page = requirePage();

        if (params.operation === "key") {
          if (!params.key) throw new Error("operation=key requires key.");
          await page.keyboard.down(params.key);
          await page.waitForTimeout(params.durationMs ?? 50);
          await page.keyboard.up(params.key);
        } else if (params.operation === "click") {
          if (params.x === undefined || params.y === undefined) {
            throw new Error("operation=click requires x and y.");
          }
          await page.mouse.click(params.x, params.y);
        } else if (params.operation === "action") {
          if (!params.action) throw new Error("operation=action requires action.");
          await page.evaluate(
            async ({ action, payload }: { action: string; payload: unknown }) => {
              const api = (window as any).__gameTest;
              if (!api || typeof api.act !== "function") {
                throw new Error("window.__gameTest.act(action, payload) is not available");
              }
              await api.act(action, payload);
            },
            { action: params.action, payload: params.payload },
          );
        } else if (params.operation === "step") {
          if (!params.frames) throw new Error("operation=step requires frames.");
          await page.evaluate(async (frames: number) => {
            const api = (window as any).__gameTest;
            if (!api || typeof api.step !== "function") {
              throw new Error("window.__gameTest.step(frames) is not available");
            }
            await api.step(frames);
          }, params.frames);
        } else if (params.operation === "wait") {
          await page.waitForTimeout(params.durationMs ?? 1000);
        } else if (params.operation === "reset") {
          const resetThroughHook = await page.evaluate(async (seed: number | undefined) => {
            const api = (window as any).__gameTest;
            if (!api || typeof api.reset !== "function") return false;
            await api.reset(seed);
            return true;
          }, params.seed);
          if (!resetThroughHook) await page.reload({ waitUntil: "domcontentloaded" });
        } else if (params.operation === "reload") {
          await page.reload({ waitUntil: "domcontentloaded" });
        }
      }

      const page = requirePage();
      if (settleMs > 0) await page.waitForTimeout(settleMs);
      if (signal?.aborted) throw new Error("Game test operation aborted.");

      const result = await observe(includeScreenshot);
      return {
        content: result.content,
        details: { operation: params.operation, observation: result.observation },
      };
    },
  });

  pi.on("session_shutdown", async () => {
    await closeBrowser();
  });
}
