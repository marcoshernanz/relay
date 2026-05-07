import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, stepCountIs } from "ai";

import type { BrowserAction } from "./browser-action.js";
import type { BrowserObservation } from "./browser-observation.js";
import { browserTools } from "./browser-tools.js";
import { agentConfig } from "./config.js";
import { env } from "./env.js";
import { aiActionChooserSystemPrompt } from "./prompts.js";

export async function chooseNextAction(
  observation: BrowserObservation,
): Promise<BrowserAction | null> {
  const openrouter = createOpenRouterProvider();

  const result = await generateText({
    model: openrouter(agentConfig.model),
    tools: browserTools,
    toolChoice: "auto",
    stopWhen: stepCountIs(1),
    system: aiActionChooserSystemPrompt,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: formatObservationForModel(observation),
          },
          {
            type: "image",
            image: observation.screenshot.data,
            mediaType: observation.screenshot.mediaType,
          },
        ],
      },
    ],
    temperature: agentConfig.temperature,
    maxOutputTokens: agentConfig.maxOutputTokens,
  });

  if (result.toolCalls.length === 0) {
    return null;
  }

  if (result.toolCalls.length !== 1) {
    throw new Error(
      `Expected exactly one browser tool call, received ${result.toolCalls.length}.`,
    );
  }

  const [toolResult] = result.toolResults;

  if (toolResult === undefined || result.toolResults.length !== 1) {
    throw new Error(
      `Expected exactly one browser tool result, received ${result.toolResults.length}.`,
    );
  }

  if (toolResult.dynamic === true) {
    throw new Error(
      `Unexpected dynamic browser tool result: ${toolResult.toolName}`,
    );
  }

  return toolResult.output;
}

function createOpenRouterProvider() {
  return createOpenRouter({
    apiKey: env.OPENROUTER_API_KEY,
    appName: "relay",
  });
}

function formatObservationForModel(observation: BrowserObservation): string {
  return [
    `Task: ${observation.task}`,
    `Step: ${observation.step + 1}/${observation.maxSteps}`,
    `Page title: ${observation.page.title}`,
    `Page URL: ${observation.page.url}`,
    `Screenshot size: ${observation.screenshot.width}x${observation.screenshot.height}`,
    `Last action: ${formatJson(observation.lastAction ?? null)}`,
    `Last action result: ${formatJson(observation.lastActionResult ?? null)}`,
    "",
    "Page observation:",
    formatPageObservation(observation),
  ].join("\n");
}

function formatJson(value: unknown): string {
  return JSON.stringify(value);
}

function formatPageObservation(observation: BrowserObservation): string {
  const pageObservation = observation.pageObservation;

  return [
    `Focused element: ${pageObservation.focusedElement ?? "none"}`,
    "",
    "Visible text:",
    pageObservation.visibleText,
    "",
    "Interactive elements visible in the viewport:",
    ...pageObservation.interactiveElements.map(formatInteractiveElement),
    "",
    "ARIA snapshot:",
    pageObservation.ariaSnapshot,
  ].join("\n");
}

function formatInteractiveElement(
  element: BrowserObservation["pageObservation"]["interactiveElements"][number],
): string {
  const value =
    element.value === null || element.value === ""
      ? ""
      : ` value=${JSON.stringify(element.value)}`;
  const checked =
    element.checked === null ? "" : ` checked=${String(element.checked)}`;
  const disabled = element.disabled ? " disabled=true" : "";
  const text =
    element.text === "" ? "" : ` text=${JSON.stringify(element.text)}`;

  return [
    `[${element.index}]`,
    `${element.role}`,
    JSON.stringify(element.label || "(unlabeled)"),
    `tag=${element.tagName}`,
    `center=(${element.center.x},${element.center.y})`,
    `bounds=${element.bounds.x},${element.bounds.y},${element.bounds.width}x${element.bounds.height}`,
    `${value}${checked}${disabled}${text}`,
  ]
    .join(" ")
    .trim();
}
