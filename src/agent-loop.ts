import {
  executeBrowserAction,
  type BrowserAction,
} from "./browser-action.js";
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

type ActionChooser = (
  observation: BrowserObservation,
) => BrowserAction | null | Promise<BrowserAction | null>;

const hardcodedActions: BrowserAction[] = [
  { type: "wait", ms: 1000 },
  { type: "click", x: 199, y: 227 },
  { type: "click", x: 893, y: 223 },
  { type: "typeText", text: "Ada Lovelace" },
  { type: "click", x: 893, y: 322 },
  { type: "typeText", text: "Testing the agent loop skeleton." },
  { type: "click", x: 730, y: 482 },
  { type: "click", x: 232, y: 685 },
  { type: "scroll", x: 640, y: 410, deltaX: 0, deltaY: 420 },
  { type: "click", x: 394, y: 239 },
  { type: "click", x: 217, y: 713 },
  { type: "pressKey", key: "Home" },
];

export async function runAgentLoop({
  task,
  maxSteps,
}: AgentLoopOptions): Promise<void> {
  const session = new BrowserSession();
  const chooseNextAction = createHardcodedActionChooser(hardcodedActions);
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

function createHardcodedActionChooser(actions: BrowserAction[]): ActionChooser {
  return (observation) => actions[observation.step] ?? null;
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

const task = process.argv.slice(2).join(" ") || "Run hardcoded browser actions.";

await runAgentLoop({
  task,
  maxSteps: 20,
});
