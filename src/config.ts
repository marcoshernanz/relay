import "./env.js"; // Load .env without requiring provider secrets during config import.

export const openRouterModelId = "xiaomi/mimo-v2.5-pro";
export type OpenRouterModelId = typeof openRouterModelId;

export type AgentConfig = {
  task: string;
  maxSteps: number;
  model: OpenRouterModelId;
  maxOutputTokens: number;
  temperature: number;
};

export const agentConfig: AgentConfig = {
  task: "Fill the test page form and finish the test.",
  maxSteps: 20,
  model: openRouterModelId,
  maxOutputTokens: 512,
  temperature: 0,
};
