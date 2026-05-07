import type {
  OpenAICompatibleChatModelId,
  OpenAICompatibleProviderSettings,
} from "@ai-sdk/openai-compatible";

import { env } from "./env.js";

export type NvidiaModelId = OpenAICompatibleChatModelId;
export type NvidiaProviderConfig = OpenAICompatibleProviderSettings & {
  name: "nvidia";
  baseURL: "https://integrate.api.nvidia.com/v1";
  apiKey: string;
};

export type AgentConfig = {
  task: string;
  maxSteps: number;
  nvidiaBaseUrl: NvidiaProviderConfig["baseURL"];
  model: NvidiaModelId;
  maxOutputTokens: number;
  temperature: number;
};

export const nvidiaProviderConfig: NvidiaProviderConfig = {
  name: "nvidia",
  baseURL: "https://integrate.api.nvidia.com/v1",
  apiKey: env.NVIDIA_API_KEY,
};

export const agentConfig: AgentConfig = {
  task: "Fill the test page form and finish the test.",
  maxSteps: 20,
  nvidiaBaseUrl: nvidiaProviderConfig.baseURL,
  model: "moonshotai/kimi-k2.6",
  maxOutputTokens: 512,
  temperature: 0,
};
