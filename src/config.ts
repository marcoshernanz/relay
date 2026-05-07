import type {
  OpenAICompatibleChatModelId,
  OpenAICompatibleProviderSettings,
} from "@ai-sdk/openai-compatible";

import "./env.js"; // Load .env without requiring provider secrets during config import.

export const nvidiaNimBaseUrl = "https://integrate.api.nvidia.com/v1" as const;
export const nvidiaModelId =
  "minimaxai/minimax-m2.7" satisfies OpenAICompatibleChatModelId;
export type NvidiaModelId = typeof nvidiaModelId;

export type NvidiaProviderConfig = Omit<
  OpenAICompatibleProviderSettings,
  "apiKey"
> & {
  name: "nvidia";
  baseURL: typeof nvidiaNimBaseUrl;
  apiKey?: never;
};

export type AgentConfig = {
  task: string;
  maxSteps: number;
  model: NvidiaModelId;
  maxOutputTokens: number;
  temperature: number;
};

export const nvidiaProviderConfig: NvidiaProviderConfig = {
  name: "nvidia",
  baseURL: nvidiaNimBaseUrl,
};

export const agentConfig: AgentConfig = {
  task: "Fill the test page form and finish the test.",
  maxSteps: 20,
  model: nvidiaModelId,
  maxOutputTokens: 512,
  temperature: 0,
};
