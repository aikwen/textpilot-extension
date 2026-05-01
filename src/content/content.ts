import { createApp } from "vue";
import ContentApp from "./ContentApp.vue";
import cssText from "../style.css?inline";

const HOST_ID = "textpilot-shadow-host";

function normalizeRemToPx(css: string): string {
  return css.replace(
    /(-?\d*\.?\d+)rem/g,
    (_, value: string) => {
      const px = Number(value) * 16;
      return `${px}px`;
    },
  );
}

const normalizedCssText = normalizeRemToPx(cssText);

function createShadowRoot(): ShadowRoot {
  const existingHost = document.getElementById(HOST_ID);

  if (existingHost?.shadowRoot) {
    return existingHost.shadowRoot;
  }

  const host = document.createElement("div");
  host.id = HOST_ID;

  document.documentElement.appendChild(host);

  const shadowRoot = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = `
    :host {
      all: initial;
      color-scheme: light;
      font-size: 16px;
      line-height: 1.5;
      font-family:
        system-ui,
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        sans-serif;
    }

    #textpilot-app {
      color-scheme: light;
      font-size: 16px;
      line-height: 1.5;
      font-family:
        system-ui,
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        sans-serif;
    }

    ${normalizedCssText}
  `;
  shadowRoot.appendChild(style);

  const appRoot = document.createElement("div");
  appRoot.id = "textpilot-app";
  appRoot.setAttribute("data-theme", "light");
  shadowRoot.appendChild(appRoot);

  createApp(ContentApp).mount(appRoot);

  return shadowRoot;
}

createShadowRoot();