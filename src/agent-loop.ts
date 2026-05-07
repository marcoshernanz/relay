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

    for (let step = 0; step < maxSteps; step++) {
      const observation = await captureBrowserObservation(session, createObservationInput({
        task,
        step,
        maxSteps,
        lastAction,
        lastActionResult,
      }));

      logObservation(observation);

      const action = await chooseNextAction(observation);

      if (action === null) {
        console.log("Agent loop stopped: chooser returned no action.");
        return;
      }

      console.log(`Executing action: ${JSON.stringify(action)}`);

      try {
        await executeBrowserAction(session, action);
        lastAction = action;
        lastActionResult = { ok: true };
      } catch (error) {
        lastAction = action;
        lastActionResult = {
          ok: false,
          message: error instanceof Error ? error.message : String(error),
        };
      }
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

function logObservation(observation: BrowserObservation): void {
  console.log(
    [
      `Step ${observation.step + 1}/${observation.maxSteps}`,
      observation.page.title,
      observation.page.url,
      `${observation.screenshot.width}x${observation.screenshot.height}`,
    ].join(" | "),
  );
}

await runAgentLoop(agentConfig);
