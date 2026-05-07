import { tool } from "ai";

import {
  clickActionInputSchema,
  createBrowserAction,
  pressKeyActionInputSchema,
  scrollActionInputSchema,
  typeTextActionInputSchema,
  waitActionInputSchema,
} from "./browser-action.js";

export const browserTools = {
  click: tool({
    description: "Click a point in the browser viewport.",
    inputSchema: clickActionInputSchema,
    execute: createBrowserAction.click,
  }),
  typeText: tool({
    description: "Type text using the keyboard at the current focus.",
    inputSchema: typeTextActionInputSchema,
    execute: createBrowserAction.typeText,
  }),
  pressKey: tool({
    description:
      "Press one keyboard key, such as Enter, Tab, ArrowDown, or Home.",
    inputSchema: pressKeyActionInputSchema,
    execute: createBrowserAction.pressKey,
  }),
  scroll: tool({
    description: "Scroll at a point in the browser viewport.",
    inputSchema: scrollActionInputSchema,
    execute: createBrowserAction.scroll,
  }),
  wait: tool({
    description: "Wait for the browser to settle.",
    inputSchema: waitActionInputSchema,
    execute: createBrowserAction.wait,
  }),
};
