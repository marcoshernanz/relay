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

const observationCheckAfterActionIndexes = new Map<
  number,
  (session: BrowserSession) => Promise<void>
>([
  [-1, assertInitialPageObservation],
  [9, assertFormSubmittedObservation],
  [14, assertFinishedObservation],
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
    await saveScreenshotAfterAction(session, -1);
    await assertObservationAfterAction(session, -1);

    for (const [index, action] of smokeActions.entries()) {
      console.log(`Running: ${action.name}`);
      await executeBrowserAction(session, action);
      await saveScreenshotAfterAction(session, index);
      await assertObservationAfterAction(session, index);
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

async function assertObservationAfterAction(
  session: BrowserSession,
  actionIndex: number,
): Promise<void> {
  const check = observationCheckAfterActionIndexes.get(actionIndex);

  if (check !== undefined) {
    await check(session);
  }
}

async function assertInitialPageObservation(
  session: BrowserSession,
): Promise<void> {
  const observation = await session.pageObservation();

  assertDocumentTextIncludes(
    observation.documentText,
    "Browser Agent Test Page",
    "initial page title",
  );
  assertInteractiveElement(
    observation.interactiveElements,
    "button",
    "Alpha",
  );
  assertInteractiveElement(
    observation.interactiveElements,
    "textbox",
    "Name",
  );

  console.log(
    [
      "Observed page",
      `elements=${observation.interactiveElements.length}`,
      `documentTextChars=${observation.documentText.length}`,
      `ariaChars=${observation.ariaSnapshot.length}`,
    ].join(" | "),
  );
}

async function assertFormSubmittedObservation(
  session: BrowserSession,
): Promise<void> {
  const observation = await session.pageObservation();

  assertDocumentTextIncludes(
    observation.documentText,
    "Submitted name: Ada Lovelace",
    "submitted form output",
  );
  assertDocumentTextIncludes(
    observation.documentText,
    "Testing browser actions.",
    "submitted note output",
  );
}

async function assertFinishedObservation(session: BrowserSession): Promise<void> {
  const observation = await session.pageObservation();

  assertDocumentTextIncludes(
    observation.documentText,
    "Finished",
    "final status",
  );
}

function assertDocumentTextIncludes(
  documentText: string,
  expectedText: string,
  description: string,
): void {
  if (documentText.includes(expectedText)) {
    return;
  }

  throw new Error(
    `Page observation missing ${description}: expected document text to include ${JSON.stringify(expectedText)}.`,
  );
}

function assertInteractiveElement(
  elements: Awaited<
    ReturnType<BrowserSession["pageObservation"]>
  >["interactiveElements"],
  expectedRole: string,
  expectedLabel: string,
): void {
  const matchingElement = elements.find(
    (element) =>
      element.role === expectedRole &&
      (element.label.includes(expectedLabel) ||
        element.text.includes(expectedLabel)),
  );

  if (matchingElement !== undefined) {
    return;
  }

  throw new Error(
    `Page observation missing ${expectedRole} ${JSON.stringify(expectedLabel)}. Observed elements: ${elements
      .map(
        (element) =>
          `${element.role} label=${JSON.stringify(element.label)} text=${JSON.stringify(element.text)}`,
      )
      .join(", ")}`,
  );
}
