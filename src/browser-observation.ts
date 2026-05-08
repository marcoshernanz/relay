import type { BrowserAction } from "./browser-action.js";
import type { BrowserSession } from "./browser-session.js";
import type { BrowserPageObservation } from "./page-observation.js";

export type BrowserActionResult =
  | { ok: true }
  | { ok: false; message: string };

export type BrowserObservationContext = {
  task: string;
  step: number;
  maxSteps: number;
  lastAction?: BrowserAction;
  lastActionResult?: BrowserActionResult;
};

export type BrowserObservationScreenshot = {
  data: Buffer;
  mediaType: "image/jpeg";
  width: number;
  height: number;
};

export type BrowserObservationPage = {
  url: string;
  title: string;
};

export type BrowserObservation = BrowserObservationContext & {
  screenshot: BrowserObservationScreenshot;
  page: BrowserObservationPage;
  pageObservation: BrowserPageObservation;
};

export async function captureBrowserObservation(
  session: BrowserSession,
  context: BrowserObservationContext,
): Promise<BrowserObservation> {
  const pageSnapshot = await session.screenshot();
  const pageObservation = await session.pageObservation();

  return {
    ...context,
    screenshot: {
      data: pageSnapshot.data,
      mediaType: pageSnapshot.mediaType,
      width: pageSnapshot.width,
      height: pageSnapshot.height,
    },
    page: {
      url: pageSnapshot.url,
      title: pageSnapshot.title,
    },
    pageObservation,
  };
}
