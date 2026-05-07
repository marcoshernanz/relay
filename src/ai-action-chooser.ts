import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, stepCountIs } from "ai";

import type { BrowserAction } from "./browser-action.js";
import type { BrowserObservation } from "./browser-observation.js";
import { browserTools } from "./browser-tools.js";
import { agentConfig } from "./config.js";
import { aiActionChooserSystemPrompt } from "./prompts.js";

export async function chooseNextAction(
  observation: BrowserObservation,
): Promise<BrowserAction | null> {
  const nvidia = createNvidiaProvider();

  const result = await generateText({
    model: nvidia(agentConfig.model),
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
    throw new Error(`Unexpected dynamic browser tool result: ${toolResult.toolName}`);
  }

  return toolResult.output;
}

function createNvidiaProvider() {
  return createOpenAICompatible({
    name: "nvidia",
    baseURL: agentConfig.nvidiaBaseUrl,
    apiKey: getNvidiaApiKey(),
  });
}

function getNvidiaApiKey(): string {
  const apiKey = process.env.NVIDIA_API_KEY;

  if (apiKey === undefined || apiKey.trim() === "") {
    throw new Error(
      "AI mode requires NVIDIA_API_KEY to be set in the environment.",
    );
  }

  return apiKey;
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
  ].join("\n");
}

function formatJson(value: unknown): string {
  return JSON.stringify(value);
}
