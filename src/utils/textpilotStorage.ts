export type SnippetItem = {
  id: string;
  title: string;
  content: string;
};

const PANEL_WIDTH_STORAGE_KEY = "textpilot.panelWidth";
const SNIPPETS_STORAGE_KEY = "textpilot.snippets";

type PanelWidthOptions = {
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
};

function clampWidth(width: number, minWidth: number, maxWidth: number): number {
  return Math.min(maxWidth, Math.max(minWidth, width));
}

function canUseChromeStorage(): boolean {
  try {
    return (
      typeof chrome !== "undefined" &&
      Boolean(chrome.runtime?.id) &&
      Boolean(chrome.storage) &&
      Boolean(chrome.storage.local)
    );
  } catch {
    return false;
  }
}

function chromeStorageGet<T>(key: string): Promise<T | undefined> {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(key, (result) => {
        const error = chrome.runtime.lastError;

        if (error) {
          console.warn("[TextPilot] chrome.storage.local.get failed:", error.message);
          resolve(undefined);
          return;
        }

        resolve(result[key] as T | undefined);
      });
    } catch (error) {
      console.warn("[TextPilot] chrome.storage.local.get context invalidated:", error);
      resolve(undefined);
    }
  });
}

function chromeStorageSet(key: string, value: unknown): Promise<void> {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.set({ [key]: value }, () => {
        const error = chrome.runtime.lastError;

        if (error) {
          console.warn("[TextPilot] chrome.storage.local.set failed:", error.message);
        }

        resolve();
      });
    } catch (error) {
      console.warn("[TextPilot] chrome.storage.local.set context invalidated:", error);
      resolve();
    }
  });
}

export async function loadPanelWidth(
  options: PanelWidthOptions,
): Promise<number> {
  if (canUseChromeStorage()) {
    const width = await chromeStorageGet<number>(PANEL_WIDTH_STORAGE_KEY);

    if (!Number.isFinite(width)) {
      return options.defaultWidth;
    }

    return clampWidth(width as number, options.minWidth, options.maxWidth);
  }

  const raw = window.localStorage.getItem(PANEL_WIDTH_STORAGE_KEY);

  if (!raw) {
    return options.defaultWidth;
  }

  const width = Number(raw);

  if (!Number.isFinite(width)) {
    return options.defaultWidth;
  }

  return clampWidth(width, options.minWidth, options.maxWidth);
}

export async function savePanelWidth(
  width: number,
  options: Pick<PanelWidthOptions, "minWidth" | "maxWidth">,
): Promise<void> {
  const nextWidth = clampWidth(width, options.minWidth, options.maxWidth);

  if (canUseChromeStorage()) {
    await chromeStorageSet(PANEL_WIDTH_STORAGE_KEY, nextWidth);
    return;
  }

  window.localStorage.setItem(PANEL_WIDTH_STORAGE_KEY, String(nextWidth));
}

export async function loadSnippetItems(
  defaultItems: SnippetItem[],
): Promise<SnippetItem[]> {
  if (canUseChromeStorage()) {
    const items = await chromeStorageGet<unknown>(SNIPPETS_STORAGE_KEY);

    if (!Array.isArray(items)) {
      return defaultItems;
    }

    const validItems = items.filter(isSnippetItem);

    return validItems.length > 0 ? validItems : defaultItems;
  }

  const raw = window.localStorage.getItem(SNIPPETS_STORAGE_KEY);

  if (!raw) {
    return defaultItems;
  }

  try {
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return defaultItems;
    }

    const items = parsed.filter(isSnippetItem);

    return items.length > 0 ? items : defaultItems;
  } catch {
    return defaultItems;
  }
}

export async function saveSnippetItems(items: SnippetItem[]): Promise<void> {
  if (canUseChromeStorage()) {
    await chromeStorageSet(SNIPPETS_STORAGE_KEY, items);
    return;
  }

  window.localStorage.setItem(SNIPPETS_STORAGE_KEY, JSON.stringify(items));
}

function isSnippetItem(value: unknown): value is SnippetItem {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const item = value as Partial<SnippetItem>;

  return (
    typeof item.id === "string" &&
    typeof item.title === "string" &&
    typeof item.content === "string"
  );
}