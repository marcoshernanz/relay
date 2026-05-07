import type { GatewayModelId } from "ai";

export type AgentConfig = {
  task: string;
  maxSteps: number;
  aiGatewayModel: GatewayModelId;
  maxOutputTokens: number;
  temperature: number;
};

export const agentConfig: AgentConfig = {
  task: "Fill the test page form and finish the test.",
  maxSteps: 20,
  aiGatewayModel: "deepseek/deepseek-v4-flash",
  maxOutputTokens: 512,
  temperature: 0,
};
