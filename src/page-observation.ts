import type { Page } from "playwright";
import { z } from "zod";

const elementBoundsSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite().nonnegative(),
  height: z.number().finite().nonnegative(),
});

const elementPointSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

const interactiveElementObservationSchema = z.object({
  index: z.number().int().positive(),
  tagName: z.string(),
  role: z.string(),
  label: z.string(),
  text: z.string(),
  value: z.string().nullable(),
  disabled: z.boolean(),
  checked: z.boolean().nullable(),
  bounds: elementBoundsSchema,
  center: elementPointSchema,
});

const domObservationSchema = z.object({
  documentText: z.string(),
  focusedElement: z.string().nullable(),
  interactiveElements: z.array(interactiveElementObservationSchema),
});

export type ElementBounds = z.infer<typeof elementBoundsSchema>;
export type ElementPoint = z.infer<typeof elementPointSchema>;
export type InteractiveElementObservation = z.infer<
  typeof interactiveElementObservationSchema
>;

type DomObservation = z.infer<typeof domObservationSchema>;

export type BrowserPageObservation = DomObservation & {
  ariaSnapshot: string;
};

const MAX_ARIA_SNAPSHOT_LENGTH = 12_000;
const MAX_DOCUMENT_TEXT_LENGTH = 6_000;
const MAX_INTERACTIVE_ELEMENTS = 80;

type DomObservationOptions = {
  maxDocumentTextLength: number;
  maxInteractiveElements: number;
};

export async function capturePageObservation(
  page: Page,
): Promise<BrowserPageObservation> {
  const ariaSnapshot = await captureAriaSnapshot(page);
  const domObservation = await captureDomObservation(page);

  return {
    ariaSnapshot,
    ...domObservation,
  };
}

async function captureAriaSnapshot(page: Page): Promise<string> {
  try {
    const snapshot = await page.ariaSnapshot({
      mode: "ai",
      depth: 10,
      timeout: 1000,
    });

    return truncateText(snapshot.trim(), MAX_ARIA_SNAPSHOT_LENGTH);
  } catch (error) {
    return `ARIA snapshot unavailable: ${getErrorMessage(error)}`;
  }
}

async function captureDomObservation(
  page: Page,
): Promise<Omit<BrowserPageObservation, "ariaSnapshot">> {
  const observation = await page.evaluate<
    Omit<BrowserPageObservation, "ariaSnapshot">,
    DomObservationOptions
  >(
    ({ maxDocumentTextLength, maxInteractiveElements }) => {
      type BrowserDocumentLike = {
        activeElement: unknown;
        body: { innerText?: string } | null;
        querySelector: (selector: string) => unknown;
        querySelectorAll: (selector: string) => Iterable<unknown>;
      };

      type BrowserWindowLike = {
        CSS?: { escape?: (value: string) => string };
        document?: BrowserDocumentLike;
        getComputedStyle?: (element: unknown) => {
          display: string;
          visibility: string;
          opacity: string;
        };
        innerHeight?: unknown;
        innerWidth?: unknown;
      };

      type RectLike = {
        x: number;
        y: number;
        width: number;
        height: number;
      };

      type ElementLike = {
        getAttribute: (name: string) => string | null;
        getBoundingClientRect: () => RectLike;
        hasAttribute: (name: string) => boolean;
        id?: string;
        labels?: Iterable<{ innerText?: string; textContent?: string | null }>;
        tagName?: string;
        textContent?: string | null;
        title?: string;
      };

      type FormElementLike = ElementLike & {
        alt?: string;
        checked?: boolean;
        disabled?: boolean;
        href?: string;
        options?: Iterable<{ selected?: boolean; textContent?: string | null }>;
        placeholder?: string;
        type?: string;
        value?: string;
      };

      const win = globalThis as unknown as BrowserWindowLike;
      const document = win.document;

      const interactiveSelector = [
        "a[href]",
        "button",
        "input",
        "select",
        "textarea",
        "summary",
        "[contenteditable='']",
        "[contenteditable='true']",
        "[role]",
        "[tabindex]:not([tabindex='-1'])",
      ].join(",");

      const documentText = truncateText(
        normalizeWhitespace(document?.body?.innerText ?? ""),
        maxDocumentTextLength,
      );

      const interactiveElements =
        document === undefined
          ? []
          : Array.from(document.querySelectorAll(interactiveSelector))
              .map((rawElement) => toInteractiveElement(rawElement, win))
              .filter(
                (
                  element,
                ): element is Omit<InteractiveElementObservation, "index"> =>
                  element !== null,
              )
              .slice(0, maxInteractiveElements)
              .map((element, index) => ({ index: index + 1, ...element }));

      const focusedElement = formatFocusedElement(
        document?.activeElement,
        win,
      );

      return {
        documentText,
        focusedElement,
        interactiveElements,
      };

      function toInteractiveElement(
        rawElement: unknown,
        browserWindow: BrowserWindowLike,
      ): Omit<InteractiveElementObservation, "index"> | null {
        if (!isElementLike(rawElement)) {
          return null;
        }

        const element = rawElement;
        const bounds = element.getBoundingClientRect();
        const visibleBounds = getVisibleBounds(bounds, browserWindow);

        if (
          visibleBounds === null ||
          !isVisibleElement(element, browserWindow)
        ) {
          return null;
        }

        const tagName = (element.tagName ?? "unknown").toLowerCase();
        const label = getElementLabel(element);
        const text = normalizeWhitespace(element.textContent ?? "");
        const value = getElementValue(element, tagName);

        return {
          tagName,
          role: getElementRole(element, tagName),
          label,
          text,
          value,
          disabled: element.disabled === true || element.hasAttribute("disabled"),
          checked: getCheckedState(element, tagName),
          bounds: roundBounds(bounds),
          center: getCenterPoint(visibleBounds),
        };
      }

      function isElementLike(value: unknown): value is FormElementLike {
        if (value === null || typeof value !== "object") {
          return false;
        }

        const candidate = value as Partial<Record<keyof ElementLike, unknown>>;
        return (
          typeof candidate.getAttribute === "function" &&
          typeof candidate.getBoundingClientRect === "function" &&
          typeof candidate.hasAttribute === "function"
        );
      }

      function isVisibleElement(
        element: ElementLike,
        browserWindow: BrowserWindowLike,
      ): boolean {
        const styles = browserWindow.getComputedStyle?.(element);
        if (styles === undefined) {
          return false;
        }

        return (
          styles.display !== "none" &&
          styles.visibility !== "hidden" &&
          styles.opacity !== "0"
        );
      }

      function getVisibleBounds(
        bounds: RectLike,
        browserWindow: BrowserWindowLike,
      ): ElementBounds | null {
        if (
          !isFiniteNumber(bounds.x) ||
          !isFiniteNumber(bounds.y) ||
          !isFiniteNumber(bounds.width) ||
          !isFiniteNumber(bounds.height) ||
          !isFiniteNumber(browserWindow.innerWidth) ||
          !isFiniteNumber(browserWindow.innerHeight) ||
          bounds.width <= 0 ||
          bounds.height <= 0 ||
          browserWindow.innerWidth <= 0 ||
          browserWindow.innerHeight <= 0
        ) {
          return null;
        }

        const viewportWidth = browserWindow.innerWidth;
        const viewportHeight = browserWindow.innerHeight;
        const left = Math.max(0, bounds.x);
        const top = Math.max(0, bounds.y);
        const right = Math.min(viewportWidth, bounds.x + bounds.width);
        const bottom = Math.min(viewportHeight, bounds.y + bounds.height);

        if (right <= left || bottom <= top) {
          return null;
        }

        return {
          x: left,
          y: top,
          width: right - left,
          height: bottom - top,
        };
      }

      function getElementLabel(element: FormElementLike): string {
        const ariaLabel = element.getAttribute("aria-label");
        if (ariaLabel !== null && ariaLabel.trim() !== "") {
          return normalizeWhitespace(ariaLabel);
        }

        const labelledBy = element.getAttribute("aria-labelledby");
        if (labelledBy !== null && labelledBy.trim() !== "") {
          const labelledByText = labelledBy
            .split(/\s+/)
            .map((id) => {
              const labelElement = document?.querySelector(
                `#${cssEscape(id)}`,
              ) as { textContent?: string | null } | null | undefined;
              return labelElement?.textContent ?? "";
            })
            .join(" ");

          if (labelledByText.trim() !== "") {
            return normalizeWhitespace(labelledByText);
          }
        }

        const labels = element.labels;
        if (labels !== undefined) {
          const labelText = Array.from(labels)
            .map((label) => label.innerText ?? label.textContent ?? "")
            .join(" ");

          if (labelText.trim() !== "") {
            return normalizeWhitespace(labelText);
          }
        }

        return normalizeWhitespace(
          element.placeholder ??
            element.alt ??
            element.title ??
            element.textContent ??
            element.value ??
            "",
        );
      }

      function getElementRole(element: FormElementLike, tagName: string): string {
        const explicitRole = element.getAttribute("role");
        if (explicitRole !== null && explicitRole.trim() !== "") {
          return explicitRole;
        }

        if (tagName === "a") {
          return "link";
        }

        if (tagName === "button") {
          return "button";
        }

        if (tagName === "textarea") {
          return "textbox";
        }

        if (tagName === "select") {
          return "combobox";
        }

        if (tagName === "input") {
          switch (element.type) {
            case "button":
            case "reset":
            case "submit":
              return "button";
            case "checkbox":
              return "checkbox";
            case "radio":
              return "radio";
            case "range":
              return "slider";
            default:
              return "textbox";
          }
        }

        return tagName;
      }

      function getElementValue(
        element: FormElementLike,
        tagName: string,
      ): string | null {
        if (tagName === "select" && element.options !== undefined) {
          const selectedOptions = Array.from(element.options)
            .filter((option) => option.selected === true)
            .map((option) => normalizeWhitespace(option.textContent ?? ""));
          return selectedOptions.join(", ") || null;
        }

        if (element.value === undefined) {
          return null;
        }

        return element.type === "password" ? "(password)" : element.value;
      }

      function getCheckedState(
        element: FormElementLike,
        tagName: string,
      ): boolean | null {
        if (tagName !== "input") {
          return null;
        }

        return element.type === "checkbox" || element.type === "radio"
          ? element.checked === true
          : null;
      }

      function roundBounds(bounds: ElementBounds): ElementBounds {
        return {
          x: Math.round(bounds.x),
          y: Math.round(bounds.y),
          width: Math.round(bounds.width),
          height: Math.round(bounds.height),
        };
      }

      function getCenterPoint(bounds: ElementBounds): ElementPoint {
        return {
          x: Math.round(bounds.x + bounds.width / 2),
          y: Math.round(bounds.y + bounds.height / 2),
        };
      }

      function formatFocusedElement(
        rawElement: unknown,
        browserWindow: BrowserWindowLike,
      ): string | null {
        if (rawElement === null || rawElement === undefined) {
          return null;
        }

        const element = toInteractiveElement(rawElement, browserWindow);

        if (element === null) {
          return null;
        }

        const label = element.label === "" ? "(unlabeled)" : element.label;
        return `${element.role} ${JSON.stringify(label)} at (${element.center.x}, ${element.center.y})`;
      }

      function cssEscape(value: string): string {
        const nativeEscape = win.CSS?.escape;
        if (nativeEscape !== undefined) {
          return nativeEscape(value);
        }

        return value.replace(/[^a-zA-Z0-9_-]/g, (character) => {
          const codePoint = character.codePointAt(0);
          return codePoint === undefined ? "" : `\\${codePoint.toString(16)} `;
        });
      }

      function normalizeWhitespace(value: string): string {
        return value.replace(/\s+/g, " ").trim();
      }

      function truncateText(value: string, maxLength: number): string {
        if (value.length <= maxLength) {
          return value;
        }

        return `${value.slice(0, maxLength)}...`;
      }

      function isFiniteNumber(value: unknown): value is number {
        return Number.isFinite(value);
      }
    },
    {
      maxDocumentTextLength: MAX_DOCUMENT_TEXT_LENGTH,
      maxInteractiveElements: MAX_INTERACTIVE_ELEMENTS,
    },
  );

  return domObservationSchema.parse(observation);
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}...`;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
