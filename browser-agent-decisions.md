# Browser Agent Decisions

This document captures the initial decisions for a simple model-agnostic browser-control agent built with AI SDK, NVIDIA NIM, and Playwright.

## Goal

Build an agent loop that controls a browser at the UI level:

1. Capture a screenshot of the current browser state.
2. Send the screenshot plus task context to a model through AI SDK and NVIDIA's OpenAI-compatible NIM API.
3. Ask the model to either choose one browser action or answer normally when it is finished.
4. Execute that action through Playwright.
5. Capture the next screenshot and repeat until the task is complete or stopped.

The system should not depend on provider-native computer-use models. The agent owns the computer-control protocol and can switch models by changing the typed provider config.

## Initial Scope

Start with one controlled browser window.

Default decisions:

- Browser runtime: Playwright Chromium
- Viewport: `1280x800`
- Device scale factor: `1`
- Browser mode: one isolated browser context per task
- Auth state: nothing signed in
- Tabs: one active page initially

This avoids the complexity of arbitrary desktop control while preserving the core screenshot-to-action loop.

## Model Layer

Use AI SDK with the OpenAI-compatible provider pointed at NVIDIA NIM.

Requirements for any model used by the agent:

- Supports image input
- Supports tool calling or reliable structured JSON output
- Can reason over browser screenshots
- Can follow screen coordinates accurately
- Can follow strict action constraints

Different models will vary significantly in visual grounding, tool-call reliability, latency, and cost. The first version should keep the loop simple enough that models can be swapped and compared easily.

## Agent Contract

The model does not directly control Playwright. It chooses from a normalized internal action schema.

Initial action set:

```ts
type BrowserAction =
  | { type: "click"; x: number; y: number; button: "left" | "right" | "middle" }
  | { type: "typeText"; text: string }
  | { type: "pressKey"; key: string }
  | { type: "scroll"; x: number; y: number; deltaX: number; deltaY: number }
  | { type: "wait"; ms: number };
```

The executor should only understand this internal action format, regardless of whether the model produced it through AI SDK tool calling or a structured JSON fallback.

## Tool Set

Initial model tools:

- `click({ x, y, button })`
- `typeText({ text })`
- `pressKey({ key })`
- `scroll({ x, y, deltaX, deltaY })`
- `wait({ ms })`

Avoid these in the MVP:

- JavaScript execution
- DOM mutation
- Cookie access
- Credential access
- File upload
- Download automation
- Direct network requests made on behalf of the agent

Those tools are powerful and should only be added after the visual control loop, logs, and approval gates are working.

## Coordinate System

Use one consistent coordinate system.

Default decisions:

- Screenshots are captured at the same size as the Playwright viewport.
- Coordinates are CSS pixels.
- `deviceScaleFactor` is `1`.
- The screenshot width and height are included in every model prompt.
- Clicks outside the viewport are rejected before execution.
- Every coordinate action is logged.

Do not mix retina-scaled screenshots with CSS-pixel browser coordinates.

## Prompt Input

Each loop iteration sends a simple prompt plus the latest screenshot.

The input does not need a formal `BrowserObservation` abstraction yet. That was only a possible TypeScript shape for the data sent to the model. For the first version, keep it plain:

- User task
- Current step number
- Current URL
- Page title
- Viewport size
- Last action result, if any
- Screenshot

Possible later additions:

- Browser accessibility snapshot
- Visible text from OCR
- Clickable region detection
- DOM snapshot for the current page
- Focused element information
- Cursor position

## Loop Semantics

The model can either choose one action or stop by responding with normal text.

Default decisions:

- One model call produces at most one action.
- If the model calls a tool, the executor runs the action.
- The browser is allowed to settle briefly.
- A new screenshot is captured.
- The loop repeats.
- If the model does not call a tool, treat the model's text response as the final answer and stop.

Initial limits:

- Max steps per task: `50`
- Default wait after actions: `300-800ms`
- Max wait action: `5000ms`

The max step limit is an operational guard to avoid infinite loops, not a safety system.

## Safety

The first version relies on browser isolation instead of a detailed safety policy.

Default decisions:

- Launch a fresh Playwright browser context.
- Do not use a signed-in browser profile.
- Do not load saved cookies or credentials.
- Treat the browser like a guest or incognito session.

## Session And Authentication

Start unauthenticated.

Default decisions:

- Each task gets an isolated browser context.
- No persistent user profile for the first prototype.
- Persistent named profiles can be added later.

When persistent sessions are introduced, they should be explicit, named, and scoped to a known set of allowed domains.

## Logging

Keep basic logs while developing.

Log for each step:

- Step number
- Model name
- Current URL and title
- Chosen action
- Tool arguments
- Executor result
- Timing

Screenshots can be logged later if needed.

## First Success Criteria

The first version should prove the basic loop.

Initial test tasks:

- Search the web and open a result.
- Fill a simple form.
- Navigate a documentation site and find a specific piece of information.
- Use a local test page with buttons, inputs, dropdowns, and modals.

The milestone is:

> Given a browser screenshot and a user task, the agent can choose valid browser actions until it completes simple web tasks or stops with a final text answer.

## Recommended Starting Stack

- Runtime: Node.js script
- Model layer: AI SDK Core
- Model provider: NVIDIA NIM through `@ai-sdk/openai-compatible`
- Default model: `minimaxai/minimax-m2.7`
- Browser automation: Playwright Chromium
- Viewport: `1280x800`
- Device scale factor: `1`
- Agent contract: normalized `BrowserAction`
- Loop: zero or one action per model call
- Max steps: `50`
- Safety: fresh unsigned browser context
- Auth: nothing signed in

## Next Step

Scaffold a simple Node.js script with Playwright, AI SDK, NVIDIA NIM, and the normalized `BrowserAction` interface.
