# Browser Agent Decisions

This document records the current browser-agent architecture and the decisions that keep it model-agnostic.

## Current Architecture

The agent controls one Playwright Chromium page through a normalized action protocol. Each loop iteration:

1. Captures a viewport screenshot.
2. Captures a compact page observation from Playwright.
3. Sends the task, browser metadata, last action result, page observation, and screenshot to Grok through AI SDK and OpenRouter.
4. Lets the model choose zero or one browser tool call.
5. Converts that tool call into an internal `BrowserAction`.
6. Executes the action through Playwright, waits briefly, and repeats.

The model never receives direct Playwright, DOM mutation, cookie, credential, file, or network-request tools. It can only ask for one of the browser actions defined by the local action schema.

## Runtime Defaults

- Browser runtime: Playwright Chromium
- Viewport: `1280x800`
- Device scale factor: `1`
- Browser mode: one isolated context per run
- Start page: `test-pages/basic.html`
- Auth state: unsigned fresh context
- Default action delay: `500ms`

These defaults keep screenshots and browser coordinates aligned: screenshot pixels are CSS pixels, and click/scroll coordinates are rejected if they fall outside the viewport.

## Model Layer

- Model provider: OpenRouter through `@openrouter/ai-sdk-provider`
- Model id: `x-ai/grok-4.3`
- AI SDK API: `generateText`
- Tool policy: `toolChoice: "auto"` with `stepCountIs(1)`
- Temperature: `0`

The provider and model are configured in `src/config.ts`; the OpenRouter API key is read from `OPENROUTER_API_KEY`. Keeping the provider behind AI SDK makes the control loop independent from provider-native computer-use APIs.

## Page Observation

The screenshot remains the spatial source of truth. The page observation supplies grounding that screenshots alone handle poorly:

- Current URL and title
- ARIA snapshot from `page.ariaSnapshot({ mode: "ai" })`
- Document text from `document.body.innerText`, which can include offscreen content
- Focused element summary
- Visible interactive elements with role, label, value, disabled/checked state, bounds, and center coordinate

Interactive elements are viewport-filtered and capped to keep prompts bounded. The prompt tells the model to use document text and ARIA for state, visible interactive elements for current controls, and the screenshot to verify exact coordinates.

## Action Contract

Browser actions are normalized before execution:

```ts
type BrowserAction =
  | { type: "click"; x: number; y: number; button: "left" | "right" | "middle" }
  | { type: "typeText"; text: string }
  | { type: "pressKey"; key: string }
  | { type: "scroll"; x: number; y: number; deltaX: number; deltaY: number }
  | { type: "wait"; ms: number };
```

AI SDK tools return this internal schema, and `executeBrowserAction` is the only place that maps it to `BrowserSession` methods. This keeps model-tool names separate from the browser execution boundary.

## Loop Semantics

- One model call produces at most one action.
- A missing tool call means the agent is done and has answered normally.
- Tool-call failures are returned as the next observation's last action result.
- The loop stops after `maxSteps`.

The step cap is an operational guard against runaway loops. It is not a safety policy.

## Safety Boundaries

The prototype relies on isolation and a narrow tool set:

- Fresh browser context per run
- No signed-in profile
- No saved cookies or credentials
- No JavaScript execution tool
- No DOM mutation tool
- No download, upload, or direct network-request tool

Persistent sessions should be explicit, named, and scoped to known allowed domains if they are added later.

## Smoke Verification

`pnpm smoke` runs a deterministic local-page workflow against `test-pages/basic.html`. It exercises waiting, clicking, typing, keyboard selection, form submission, in-page navigation, scrolling, and final status update.

Smoke assertions intentionally check only stable milestones:

- Initial page observation sees expected document text and key visible controls.
- Submitted form output includes the typed name and note.
- Final observation includes the finished status.

Screenshots are saved under `dist/smoke/` at the initial state, after form submission, and after the final state for manual inspection.
