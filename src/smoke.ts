import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { BrowserSession } from "./browser-session.js";

type SmokeStep = {
  name: string;
  run: () => Promise<void>;
};

const outputDir = resolve("dist", "smoke");

async function saveScreenshot(session: BrowserSession, filename: string): Promise<void> {
  const screenshot = await session.screenshot();
  const outputPath = resolve(outputDir, filename);
  await writeFile(outputPath, screenshot.data);
  console.log(`Saved ${outputPath}`);
}

async function main(): Promise<void> {
  await mkdir(outputDir, { recursive: true });

  const session = new BrowserSession();

  const steps: SmokeStep[] = [
    {
      name: "wait for page load",
      run: () => session.wait(1000),
    },
    {
      name: "capture initial screenshot",
      run: () => saveScreenshot(session, "01-initial.jpg"),
    },
    {
      name: "click Alpha button",
      run: () => session.click({ x: 199, y: 227 }),
    },
    {
      name: "type into name input",
      run: async () => {
        await session.click({ x: 893, y: 223 });
        await session.typeText("Ada Lovelace");
      },
    },
    {
      name: "type into note textarea",
      run: async () => {
        await session.click({ x: 893, y: 322 });
        await session.typeText("Testing hardcoded browser actions.");
      },
    },
    {
      name: "exercise select with keyboard",
      run: async () => {
        await session.click({ x: 893, y: 425 });
        await session.pressKey("ArrowDown");
        await session.pressKey("Enter");
      },
    },
    {
      name: "submit form",
      run: () => session.click({ x: 730, y: 482 }),
    },
    {
      name: "capture form screenshot",
      run: () => saveScreenshot(session, "02-form-submitted.jpg"),
    },
    {
      name: "jump to scroll area",
      run: () => session.click({ x: 232, y: 685 }),
    },
    {
      name: "scroll inside scroll box",
      run: () => session.scroll({ x: 640, y: 410, deltaX: 0, deltaY: 420 }),
    },
    {
      name: "jump to bottom target",
      run: () => session.click({ x: 394, y: 239 }),
    },
    {
      name: "click finish button",
      run: () => session.click({ x: 217, y: 713 }),
    },
    {
      name: "return to top",
      run: () => session.pressKey("Home"),
    },
    {
      name: "capture final screenshot",
      run: () => saveScreenshot(session, "03-finished.jpg"),
    },
  ];

  try {
    await session.start();

    for (const step of steps) {
      console.log(`Running: ${step.name}`);
      await step.run();
    }
  } finally {
    await session.close();
  }
}

await main();
