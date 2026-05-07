import type { BrowserSession, MouseButton } from "./browser-session.js";

export type BrowserAction =
  | { type: "click"; x: number; y: number; button?: MouseButton }
  | { type: "typeText"; text: string }
  | { type: "pressKey"; key: string }
  | { type: "scroll"; x: number; y: number; deltaX: number; deltaY: number }
  | { type: "wait"; ms: number };

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
}
