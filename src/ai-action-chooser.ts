import { generateText, gateway, Output } from "ai";
import { z } from "zod";

import type { BrowserAction } from "./browser-action.js";
import type { BrowserObservation } from "./browser-observation.js";
import { agentConfig } from "./config.js";
import { aiActionChooserSystemPrompt } from "./prompts.js";

const mouseButtonSchema = z.enum(["left", "right", "middle"]);

const browserActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("click"),
    x: z.number().int(),
    y: z.number().int(),
    button: mouseButtonSchema,
  }),
  z.object({
    type: z.literal("typeText"),
    text: z.string(),
  }),
  z.object({
    type: z.literal("pressKey"),
    key: z.string(),
  }),
  z.object({
    type: z.literal("scroll"),
    x: z.number().int(),
    y: z.number().int(),
    deltaX: z.number().int(),
    deltaY: z.number().int(),
  }),
  z.object({
    type: z.literal("wait"),
    ms: z.number().int().nonnegative(),
  }),
]);

const actionDecisionSchema = z.object({
  action: browserActionSchema.nullable(),
  summary: z.string().optional(),
});

type AiBrowserAction = z.infer<typeof browserActionSchema>;

export async function chooseNextAction(
  observation: BrowserObservation,
): Promise<BrowserAction | null> {
  assertAiGatewayConfigured();

  const { output } = await generateText({
    model: gateway(agentConfig.aiGatewayModel),
    output: Output.object({
      schema: actionDecisionSchema,
    }),
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

  return output.action === null ? null : normalizeBrowserAction(output.action);
}

function assertAiGatewayConfigured(): void {
  if (process.env.AI_GATEWAY_API_KEY === undefined) {
    throw new Error(
      "AI mode requires AI_GATEWAY_API_KEY to be set in the environment.",
    );
  }
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

function normalizeBrowserAction(action: AiBrowserAction): BrowserAction {
  switch (action.type) {
    case "click":
      return { type: "click", x: action.x, y: action.y, button: action.button };
    case "typeText":
      return { type: "typeText", text: action.text };
    case "pressKey":
      return { type: "pressKey", key: action.key };
    case "scroll":
      return {
        type: "scroll",
        x: action.x,
        y: action.y,
        deltaX: action.deltaX,
        deltaY: action.deltaY,
      };
    case "wait":
      return { type: "wait", ms: action.ms };
  }
}
