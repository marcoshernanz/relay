import {
  executeBrowserAction,
  type BrowserAction,
} from "./browser-action.js";
import { chooseNextAction } from "./ai-action-chooser.js";
import { agentConfig } from "./config.js";
import {
  captureBrowserObservation,
  type BrowserActionResult,
  type BrowserObservation,
  type BrowserObservationInput,
} from "./browser-observation.js";
import { BrowserSession } from "./browser-session.js";

type AgentLoopOptions = {
  task: string;
  maxSteps: number;
};

export async function runAgentLoop({
  task,
  maxSteps,
}: AgentLoopOptions): Promise<void> {
  const session = new BrowserSession();

  let lastAction: BrowserAction | undefined;
  let lastActionResult: BrowserActionResult | undefined;

  try {
    await session.start();

    for (let step = 0; step < maxSteps; step += 1) {
      const observationInput = createObservationInput({
        task,
        step,
        maxSteps,
        lastAction,
        lastActionResult,
      });
      const observation = await captureBrowserObservation(
        session,
        observationInput,
      );

      logObservation(observation);

      const action = await chooseNextAction(observation);

      if (action === null) {
        console.log("Agent loop stopped: chooser returned no action.");
        return;
      }

      lastActionResult = await executeAction(session, action);
      lastAction = action;
    }

    console.log(`Agent loop stopped: reached maxSteps (${maxSteps}).`);
  } finally {
    await session.close();
  }
}

function createObservationInput({
  task,
  step,
  maxSteps,
  lastAction,
  lastActionResult,
}: {
  task: string;
  step: number;
  maxSteps: number;
  lastAction: BrowserAction | undefined;
  lastActionResult: BrowserActionResult | undefined;
}): BrowserObservationInput {
  return {
    task,
    step,
    maxSteps,
    ...(lastAction === undefined ? {} : { lastAction }),
    ...(lastActionResult === undefined ? {} : { lastActionResult }),
  };
}

async function executeAction(
  session: BrowserSession,
  action: BrowserAction,
): Promise<BrowserActionResult> {
  logAction(action);

  try {
    await executeBrowserAction(session, action);

    const result: BrowserActionResult = { ok: true };
    logActionResult(result);
    return result;
  } catch (error) {
    const result: BrowserActionResult = {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };

    logActionResult(result);
    return result;
  }
}

function logObservation(observation: BrowserObservation): void {
  console.log(
    [
      `Observation ${observation.step + 1}/${observation.maxSteps}`,
      `title=${JSON.stringify(observation.page.title)}`,
      `url=${observation.page.url}`,
      `screenshot=${observation.screenshot.width}x${observation.screenshot.height}`,
    ].join(" | "),
  );
}

function logAction(action: BrowserAction): void {
  console.log(`Action: ${formatAction(action)}`);
}

function logActionResult(result: BrowserActionResult): void {
  if (result.ok) {
    console.log("Action result: ok");
    return;
  }

  console.log(`Action result: error | ${result.message ?? "unknown error"}`);
}

function formatAction(action: BrowserAction): string {
  switch (action.type) {
    case "click":
      return [
        "click",
        `x=${action.x}`,
        `y=${action.y}`,
        `button=${action.button}`,
      ].join(" ");
    case "typeText":
      return `typeText text=${JSON.stringify(action.text)}`;
    case "pressKey":
      return `pressKey key=${JSON.stringify(action.key)}`;
    case "scroll":
      return [
        "scroll",
        `x=${action.x}`,
        `y=${action.y}`,
        `deltaX=${action.deltaX}`,
        `deltaY=${action.deltaY}`,
      ].join(" ");
    case "wait":
      return `wait ms=${action.ms}`;
  }
}

await runAgentLoop(agentConfig);
