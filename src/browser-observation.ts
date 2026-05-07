import type { BrowserAction } from "./browser-action.js";
import type { BrowserSession } from "./browser-session.js";

export type BrowserActionResult = {
  ok: boolean;
  message?: string;
};

export type BrowserObservationInput = {
  task: string;
  step: number;
  maxSteps: number;
  lastAction?: BrowserAction;
  lastActionResult?: BrowserActionResult;
};

export type BrowserObservation = BrowserObservationInput & {
  screenshot: {
    data: Buffer;
    mediaType: "image/jpeg";
    width: number;
    height: number;
  };
  page: {
    url: string;
    title: string;
  };
};

export async function captureBrowserObservation(
  session: BrowserSession,
  input: BrowserObservationInput,
): Promise<BrowserObservation> {
  const screenshot = await session.screenshot();

  return {
    ...input,
    screenshot: {
      data: screenshot.data,
      mediaType: screenshot.mediaType,
      width: screenshot.width,
      height: screenshot.height,
    },
    page: {
      url: screenshot.url,
      title: screenshot.title,
    },
  };
}
