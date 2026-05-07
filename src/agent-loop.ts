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
  type BrowserObservationContext,
} from "./browser-observation.js";
import { BrowserSession } from "./browser-session.js";

type AgentLoopOptions = {
  task: string;
  maxSteps: number;
};

type CompletedBrowserAction = {
  action: BrowserAction;
  result: BrowserActionResult;
};

export async function runAgentLoop({
  task,
  maxSteps,
}: AgentLoopOptions): Promise<void> {
  const session = new BrowserSession();
  let previousAction: CompletedBrowserAction | undefined;

  try {
    await session.start();

    for (let step = 0; step < maxSteps; step += 1) {
      const observationContext = createObservationContext({
        task,
        step,
        maxSteps,
        previousAction,
      });
      const observation = await captureBrowserObservation(
        session,
        observationContext,
      );

      logObservation(observation);

      const action = await chooseNextAction(observation);

      if (action === null) {
        console.log("Agent loop stopped: chooser returned no action.");
        return;
      }

      previousAction = await executeChosenAction(session, action);
    }

    console.log(`Agent loop stopped: reached maxSteps (${maxSteps}).`);
  } finally {
    await session.close();
  }
}

function createObservationContext({
  task,
  step,
  maxSteps,
  previousAction,
}: {
  task: string;
  step: number;
  maxSteps: number;
  previousAction: CompletedBrowserAction | undefined;
}): BrowserObservationContext {
  const context: BrowserObservationContext = {
    task,
    step,
    maxSteps,
  };

  if (previousAction === undefined) {
    return context;
  }

  return {
    ...context,
    lastAction: previousAction.action,
    lastActionResult: previousAction.result,
  };
}

async function executeChosenAction(
  session: BrowserSession,
  action: BrowserAction,
): Promise<CompletedBrowserAction> {
  logAction(action);

  const result = await executeAction(session, action);
  logActionResult(result);

  return { action, result };
}

async function executeAction(
  session: BrowserSession,
  action: BrowserAction,
): Promise<BrowserActionResult> {
  try {
    await executeBrowserAction(session, action);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: getErrorMessage(error),
    };
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function logObservation(observation: BrowserObservation): void {
  console.log(
    [
      `Observation ${observation.step + 1}/${observation.maxSteps}`,
      `title=${JSON.stringify(observation.page.title)}`,
      `url=${observation.page.url}`,
      `screenshot=${observation.screenshot.width}x${observation.screenshot.height}`,
      `elements=${observation.pageObservation.interactiveElements.length}`,
      `textChars=${observation.pageObservation.visibleText.length}`,
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

  console.log(`Action result: error | ${result.message}`);
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
