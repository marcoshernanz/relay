import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, stepCountIs } from "ai";

import type { BrowserAction } from "./browser-action.js";
import type { BrowserObservation } from "./browser-observation.js";
import { browserTools } from "./browser-tools.js";
import { agentConfig } from "./config.js";
import { env } from "./env.js";
import { aiActionChooserSystemPrompt } from "./prompts.js";

type InteractiveElement =
  BrowserObservation["pageObservation"]["interactiveElements"][number];

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
  const lines = [
    `Task: ${observation.task}`,
    `Step: ${observation.step + 1}/${observation.maxSteps}`,
    `Page: ${formatJson({
      title: observation.page.title,
      url: observation.page.url,
    })}`,
    `Screenshot: ${observation.screenshot.width}x${observation.screenshot.height}`,
    `Last action: ${formatOptionalJson(observation.lastAction)}`,
    `Last result: ${formatOptionalJson(observation.lastActionResult)}`,
  ];

  appendSection(lines, "Page observation", formatPageObservation(observation));

  return lines.join("\n");
}

function formatJson(value: unknown): string {
  return JSON.stringify(value);
}

function formatOptionalJson(value: unknown): string {
  return value === undefined ? "none" : formatJson(value);
}

function formatPageObservation(observation: BrowserObservation): string {
  const pageObservation = observation.pageObservation;
  const lines = [
    `Focused: ${pageObservation.focusedElement ?? "none"}`,
    `Document text: ${formatBlock(pageObservation.documentText)}`,
  ];

  appendSection(
    lines,
    "Interactive elements",
    pageObservation.interactiveElements.length === 0
      ? "none"
      : pageObservation.interactiveElements.map(formatInteractiveElement),
  );
  appendSection(lines, "ARIA snapshot", formatBlock(pageObservation.ariaSnapshot));

  return lines.join("\n");
}

function appendSection(
  lines: string[],
  label: string,
  content: string | string[],
): void {
  const sectionLines = Array.isArray(content) ? content : content.split("\n");

  lines.push("", `${label}:`, ...sectionLines);
}

function formatBlock(value: string): string {
  return value === "" ? "none" : `\n${value}`;
}

function formatInteractiveElement(element: InteractiveElement): string {
  return [
    `[${element.index}]`,
    element.role,
    formatJson(element.label || "(unlabeled)"),
    `tag=${element.tagName}`,
    `center=${element.center.x},${element.center.y}`,
    `box=${element.bounds.x},${element.bounds.y},${element.bounds.width}x${element.bounds.height}`,
    ...formatElementAttributes(element),
  ].join(" ");
}

function formatElementAttributes(element: InteractiveElement): string[] {
  const attributes: string[] = [];

  if (element.value !== null && element.value !== "") {
    attributes.push(`value=${formatJson(element.value)}`);
  }

  if (element.checked !== null) {
    attributes.push(`checked=${String(element.checked)}`);
  }

  if (element.disabled) {
    attributes.push("disabled=true");
  }

  if (element.text !== "") {
    attributes.push(`text=${formatJson(element.text)}`);
  }

  return attributes;
}
