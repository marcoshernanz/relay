import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright";

import type { ClickOptions, ScrollOptions } from "./browser-action.js";
import {
  capturePageObservation,
  type BrowserPageObservation,
} from "./page-observation.js";

export type ViewportSize = {
  width: number;
  height: number;
};

export type ScreenshotResult = {
  data: Buffer;
  mediaType: "image/jpeg";
  width: number;
  height: number;
  url: string;
  title: string;
};

const DEFAULT_VIEWPORT: ViewportSize = {
  width: 1280,
  height: 800,
};

const DEFAULT_HEADLESS = false;
const DEFAULT_DEVICE_SCALE_FACTOR = 1;
const DEFAULT_START_URL = pathToFileURL(
  resolve("test-pages", "basic.html"),
).href;
const DEFAULT_ACTION_DELAY_MS = 500;

export class BrowserSession {
  private browser: Browser | undefined;
  private context: BrowserContext | undefined;
  private page: Page | undefined;

  async start(): Promise<void> {
    if (this.page !== undefined) {
      return;
    }

    this.browser = await chromium.launch({
      headless: DEFAULT_HEADLESS,
    });

    this.context = await this.browser.newContext({
      viewport: DEFAULT_VIEWPORT,
      deviceScaleFactor: DEFAULT_DEVICE_SCALE_FACTOR,
    });

    this.page = await this.context.newPage();
    await this.page.goto(DEFAULT_START_URL);
  }

  async screenshot(): Promise<ScreenshotResult> {
    const page = this.getPage();
    const data = await page.screenshot({
      type: "jpeg",
      quality: 80,
      fullPage: false,
    });

    return {
      data,
      mediaType: "image/jpeg",
      width: DEFAULT_VIEWPORT.width,
      height: DEFAULT_VIEWPORT.height,
      url: page.url(),
      title: await page.title(),
    };
  }

  async pageObservation(): Promise<BrowserPageObservation> {
    return capturePageObservation(this.getPage());
  }

  async click({ x, y, button }: ClickOptions): Promise<void> {
    this.assertPointInViewport(x, y);
    await this.getPage().mouse.click(x, y, { button });
    await this.wait();
  }

  async typeText(text: string): Promise<void> {
    await this.getPage().keyboard.type(text);
    await this.wait();
  }

  async pressKey(key: string): Promise<void> {
    await this.getPage().keyboard.press(key);
    await this.wait();
  }

  async scroll({ x, y, deltaX, deltaY }: ScrollOptions): Promise<void> {
    this.assertPointInViewport(x, y);
    const page = this.getPage();
    await page.mouse.move(x, y);
    await page.mouse.wheel(deltaX, deltaY);
    await this.wait();
  }

  async wait(ms = DEFAULT_ACTION_DELAY_MS): Promise<void> {
    if (ms < 0) {
      throw new Error("Wait duration must be non-negative.");
    }

    await this.getPage().waitForTimeout(ms);
  }

  async close(): Promise<void> {
    await this.context?.close();
    await this.browser?.close();

    this.page = undefined;
    this.context = undefined;
    this.browser = undefined;
  }

  private getPage(): Page {
    if (this.page === undefined) {
      throw new Error(
        "BrowserSession has not been started. Call start() first.",
      );
    }

    return this.page;
  }

  private assertPointInViewport(x: number, y: number): void {
    if (
      x < 0 ||
      x >= DEFAULT_VIEWPORT.width ||
      y < 0 ||
      y >= DEFAULT_VIEWPORT.height
    ) {
      throw new Error(
        `Point (${x}, ${y}) is outside the viewport ${DEFAULT_VIEWPORT.width}x${DEFAULT_VIEWPORT.height}.`,
      );
    }
  }
}
