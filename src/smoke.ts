import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  executeBrowserAction,
  type BrowserAction,
} from "./browser-action.js";
import { BrowserSession } from "./browser-session.js";

type SmokeAction = BrowserAction & {
  name: string;
};

const outputDir = resolve("dist", "smoke");

const smokeActions: SmokeAction[] = [
  {
    name: "wait for page load",
    type: "wait",
    ms: 1000,
  },
  {
    name: "click Alpha button",
    type: "click",
    x: 199,
    y: 227,
    button: "left",
  },
  {
    name: "focus name input",
    type: "click",
    x: 893,
    y: 223,
    button: "left",
  },
  {
    name: "type into name input",
    type: "typeText",
    text: "Ada Lovelace",
  },
  {
    name: "focus note textarea",
    type: "click",
    x: 893,
    y: 322,
    button: "left",
  },
  {
    name: "type into note textarea",
    type: "typeText",
    text: "Testing browser actions.",
  },
  {
    name: "focus select",
    type: "click",
    x: 893,
    y: 425,
    button: "left",
  },
  {
    name: "exercise select with keyboard",
    type: "pressKey",
    key: "ArrowDown",
  },
  {
    name: "confirm select option",
    type: "pressKey",
    key: "Enter",
  },
  {
    name: "submit form",
    type: "click",
    x: 730,
    y: 482,
    button: "left",
  },
  {
    name: "jump to scroll area",
    type: "click",
    x: 232,
    y: 685,
    button: "left",
  },
  {
    name: "scroll inside scroll box",
    type: "scroll",
    x: 640,
    y: 410,
    deltaX: 0,
    deltaY: 420,
  },
  {
    name: "jump to bottom target",
    type: "click",
    x: 394,
    y: 239,
    button: "left",
  },
  {
    name: "click finish button",
    type: "click",
    x: 217,
    y: 713,
    button: "left",
  },
  {
    name: "return to top",
    type: "pressKey",
    key: "Home",
  },
];

const screenshotAfterActionIndexes = new Map<number, string>([
  [-1, "01-initial.jpg"],
  [9, "02-form-submitted.jpg"],
  [14, "03-finished.jpg"],
]);

async function saveScreenshot(session: BrowserSession, filename: string): Promise<void> {
  const screenshot = await session.screenshot();
  const outputPath = resolve(outputDir, filename);
  await writeFile(outputPath, screenshot.data);
  console.log(`Saved ${outputPath}`);
}

async function main(): Promise<void> {
  await mkdir(outputDir, { recursive: true });

  const session = new BrowserSession();

  try {
    await session.start();
    await assertPageObservationWorks(session);
    await saveScreenshotAfterAction(session, -1);

    for (const [index, action] of smokeActions.entries()) {
      console.log(`Running: ${action.name}`);
      await executeBrowserAction(session, action);
      await saveScreenshotAfterAction(session, index);
    }
  } finally {
    await session.close();
  }
}

async function saveScreenshotAfterAction(
  session: BrowserSession,
  actionIndex: number,
): Promise<void> {
  const filename = screenshotAfterActionIndexes.get(actionIndex);

  if (filename !== undefined) {
    await saveScreenshot(session, filename);
  }
}

await main();

async function assertPageObservationWorks(session: BrowserSession): Promise<void> {
  const observation = await session.pageObservation();

  if (!observation.visibleText.includes("Browser Agent Test Page")) {
    throw new Error("Page observation did not include visible page text.");
  }

  if (observation.interactiveElements.length === 0) {
    throw new Error("Page observation did not include interactive elements.");
  }

  console.log(
    [
      "Observed page",
      `elements=${observation.interactiveElements.length}`,
      `textChars=${observation.visibleText.length}`,
      `ariaChars=${observation.ariaSnapshot.length}`,
    ].join(" | "),
  );
}
