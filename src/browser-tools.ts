import { tool } from "ai";
import { z } from "zod";

import type { BrowserAction } from "./browser-action.js";

export const browserTools = {
  click: tool({
    description: "Click a point in the browser viewport.",
    inputSchema: z.object({
      x: z.number().int(),
      y: z.number().int(),
      button: z.enum(["left", "right", "middle"]),
    }),
    execute: ({ x, y, button }): BrowserAction => ({
      type: "click",
      x,
      y,
      button,
    }),
  }),
  typeText: tool({
    description: "Type text using the keyboard at the current focus.",
    inputSchema: z.object({
      text: z.string(),
    }),
    execute: ({ text }): BrowserAction => ({ type: "typeText", text }),
  }),
  pressKey: tool({
    description:
      "Press one keyboard key, such as Enter, Tab, ArrowDown, or Home.",
    inputSchema: z.object({
      key: z.string(),
    }),
    execute: ({ key }): BrowserAction => ({ type: "pressKey", key }),
  }),
  scroll: tool({
    description: "Scroll at a point in the browser viewport.",
    inputSchema: z.object({
      x: z.number().int(),
      y: z.number().int(),
      deltaX: z.number().int(),
      deltaY: z.number().int(),
    }),
    execute: ({ x, y, deltaX, deltaY }): BrowserAction => ({
      type: "scroll",
      x,
      y,
      deltaX,
      deltaY,
    }),
  }),
  wait: tool({
    description: "Wait for the browser to settle.",
    inputSchema: z.object({
      ms: z.number().int().nonnegative(),
    }),
    execute: ({ ms }): BrowserAction => ({ type: "wait", ms }),
  }),
};
