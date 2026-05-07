import "./env.js"; // Load .env without requiring provider secrets during config import.

export const openRouterModelId = "x-ai/grok-4.3";
export type OpenRouterModelId = typeof openRouterModelId;

export type AgentConfig = {
  task: string;
  maxSteps: number;
  model: OpenRouterModelId;
  maxOutputTokens: number;
  temperature: number;
};

export const agentConfig: AgentConfig = {
  task: "Fill the form, submit it, scroll to the bottom target, and click Finish Test.",
  maxSteps: 20,
  model: openRouterModelId,
  maxOutputTokens: 512,
  temperature: 0,
};
