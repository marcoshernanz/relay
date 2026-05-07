import { z } from "zod";

import type { BrowserSession } from "./browser-session.js";

export const mouseButtonSchema = z.enum(["left", "right", "middle"]);
export type MouseButton = z.infer<typeof mouseButtonSchema>;

export const clickActionInputSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
  button: mouseButtonSchema,
});
export type ClickOptions = z.infer<typeof clickActionInputSchema>;

export const typeTextActionInputSchema = z.object({
  text: z.string(),
});
export type TypeTextOptions = z.infer<typeof typeTextActionInputSchema>;

export const pressKeyActionInputSchema = z.object({
  key: z.string(),
});
export type PressKeyOptions = z.infer<typeof pressKeyActionInputSchema>;

export const scrollActionInputSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
  deltaX: z.number().int(),
  deltaY: z.number().int(),
});
export type ScrollOptions = z.infer<typeof scrollActionInputSchema>;

export const waitActionInputSchema = z.object({
  ms: z.number().int().nonnegative(),
});
export type WaitOptions = z.infer<typeof waitActionInputSchema>;

export type BrowserAction =
  | ({ type: "click" } & ClickOptions)
  | ({ type: "typeText" } & TypeTextOptions)
  | ({ type: "pressKey" } & PressKeyOptions)
  | ({ type: "scroll" } & ScrollOptions)
  | ({ type: "wait" } & WaitOptions);

type BrowserActionFor<Type extends BrowserAction["type"]> = Extract<
  BrowserAction,
  { type: Type }
>;

type BrowserActionInput<Type extends BrowserAction["type"]> = Omit<
  BrowserActionFor<Type>,
  "type"
>;

type BrowserActionCreators = {
  [Type in BrowserAction["type"]]: (
    input: BrowserActionInput<Type>,
  ) => BrowserActionFor<Type>;
};

export const createBrowserAction = {
  click: (input: BrowserActionInput<"click">) => ({ type: "click", ...input }),
  typeText: (input: BrowserActionInput<"typeText">) => ({
    type: "typeText",
    ...input,
  }),
  pressKey: (input: BrowserActionInput<"pressKey">) => ({
    type: "pressKey",
    ...input,
  }),
  scroll: (input: BrowserActionInput<"scroll">) => ({
    type: "scroll",
    ...input,
  }),
  wait: (input: BrowserActionInput<"wait">) => ({ type: "wait", ...input }),
} satisfies BrowserActionCreators;

export async function executeBrowserAction(
  session: BrowserSession,
  action: BrowserAction,
): Promise<void> {
  switch (action.type) {
    case "click":
      await session.click(action);
      return;
    case "typeText":
      await session.typeText(action.text);
      return;
    case "pressKey":
      await session.pressKey(action.key);
      return;
    case "scroll":
      await session.scroll(action);
      return;
    case "wait":
      await session.wait(action.ms);
      return;
  }

  assertNeverAction(action);
}

function assertNeverAction(action: never): never {
  throw new Error(`Unhandled browser action: ${JSON.stringify(action)}`);
}
