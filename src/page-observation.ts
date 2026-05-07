import type { Page } from "playwright";

export type ElementBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ElementPoint = {
  x: number;
  y: number;
};

export type InteractiveElementObservation = {
  index: number;
  tagName: string;
  role: string;
  label: string;
  text: string;
  value: string | null;
  disabled: boolean;
  checked: boolean | null;
  bounds: ElementBounds;
  center: ElementPoint;
};

export type BrowserPageObservation = {
  ariaSnapshot: string;
  visibleText: string;
  focusedElement: string | null;
  interactiveElements: InteractiveElementObservation[];
};

const MAX_ARIA_SNAPSHOT_LENGTH = 12_000;
const MAX_VISIBLE_TEXT_LENGTH = 6_000;
const MAX_INTERACTIVE_ELEMENTS = 80;

export async function capturePageObservation(
  page: Page,
): Promise<BrowserPageObservation> {
  const [ariaSnapshot, domObservation] = await Promise.all([
    captureAriaSnapshot(page),
    captureDomObservation(page),
  ]);

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
  const observation = await page.evaluate(
    ({ maxVisibleTextLength, maxInteractiveElements }) => {
      const win = globalThis as unknown as {
        document: {
          activeElement: unknown;
          body: { innerText?: string } | null;
          querySelector: (selector: string) => unknown;
          querySelectorAll: (selector: string) => Iterable<unknown>;
        };
        getComputedStyle: (element: unknown) => {
          display: string;
          visibility: string;
          opacity: string;
        };
        innerHeight: number;
        innerWidth: number;
      };

      type ElementLike = {
        getAttribute: (name: string) => string | null;
        getBoundingClientRect: () => ElementBounds;
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

      const visibleText = truncateText(
        normalizeWhitespace(win.document.body?.innerText ?? ""),
        maxVisibleTextLength,
      );

      const interactiveElements = Array.from(
        win.document.querySelectorAll(interactiveSelector),
      )
        .map((rawElement) => toInteractiveElement(rawElement, win))
        .filter((element): element is Omit<InteractiveElementObservation, "index"> =>
          element !== null,
        )
        .slice(0, maxInteractiveElements)
        .map((element, index) => ({ index: index + 1, ...element }));

      const focusedElement = formatFocusedElement(
        win.document.activeElement,
        win,
      );

      return {
        visibleText,
        focusedElement,
        interactiveElements,
      };

      function toInteractiveElement(
        rawElement: unknown,
        browserWindow: typeof win,
      ): Omit<InteractiveElementObservation, "index"> | null {
        const element = rawElement as FormElementLike;
        const bounds = element.getBoundingClientRect?.();

        if (bounds === undefined || !isVisibleElement(element, bounds, browserWindow)) {
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
          center: {
            x: Math.round(bounds.x + bounds.width / 2),
            y: Math.round(bounds.y + bounds.height / 2),
          },
        };
      }

      function isVisibleElement(
        element: ElementLike,
        bounds: ElementBounds,
        browserWindow: typeof win,
      ): boolean {
        if (bounds.width <= 0 || bounds.height <= 0) {
          return false;
        }

        if (
          bounds.x + bounds.width < 0 ||
          bounds.y + bounds.height < 0 ||
          bounds.x > browserWindow.innerWidth ||
          bounds.y > browserWindow.innerHeight
        ) {
          return false;
        }

        const styles = browserWindow.getComputedStyle(element);
        return (
          styles.display !== "none" &&
          styles.visibility !== "hidden" &&
          styles.opacity !== "0"
        );
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
              const labelElement = win.document.querySelector(`#${cssEscape(id)}`) as
                | { textContent?: string | null }
                | null;
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

      function formatFocusedElement(
        rawElement: unknown,
        browserWindow: typeof win,
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
    },
    {
      maxVisibleTextLength: MAX_VISIBLE_TEXT_LENGTH,
      maxInteractiveElements: MAX_INTERACTIVE_ELEMENTS,
    },
  );

  return observation;
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
