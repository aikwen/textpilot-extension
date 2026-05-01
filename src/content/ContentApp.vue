<template>
    <div
    v-show="visible"
    ref="panelWrapper"
    class="fixed z-[2147483647] rounded-2xl"
    :style="panelStyle"
    @pointerdown.stop
    @wheel.stop
    >
      <TextPilotPanel
        :floating-root="floatingRoot"
        :snippets-reload-key="snippetsReloadKey"
        @insert="handleInsert"
      />
  </div>

  <div
    ref="floatingRoot"
    class="fixed inset-0 z-[2147483647] pointer-events-none"
    @wheel.stop
  ></div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import TextPilotPanel from "../components/TextPilotPanel.vue";

const snippetsReloadKey = ref(0);

const visible = ref(false);
const panelWrapper = ref<HTMLElement | null>(null);
const floatingRoot = ref<HTMLElement | null>(null);
const activeEditable = ref<HTMLElement | null>(null);

const panelLeft = ref(0);
const panelTop = ref(0);

const viewportPadding = 12;
const gap = 8;
const fallbackPanelWidth = 520;
const fallbackPanelHeight = 420;
const panelStyle = computed(() => {
  return {
    left: `${panelLeft.value}px`,
    top: `${panelTop.value}px`,
    boxShadow:
      "0 24px 48px rgba(15, 23, 42, 0.28), 0 8px 16px rgba(15, 23, 42, 0.18)",
  };
});

function isDateLikeInput(input: HTMLInputElement): boolean {
  const metaText = [
    input.id,
    input.name,
    input.placeholder,
    input.autocomplete,
    input.getAttribute("aria-label"),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const keywordPattern =
    /(birthday|birth|dob|date|datetime|calendar|生日|出生|日期|时间)/i;

  const datePlaceholderPattern =
    /(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}|yyyy[-/]?mm[-/]?dd|yyyy|yyyy-mm-dd)/i;

  return (
    keywordPattern.test(metaText) ||
    datePlaceholderPattern.test(metaText)
  );
}


function isEditableElement(target: EventTarget | null): target is HTMLElement {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target instanceof HTMLTextAreaElement) {
    return !target.disabled && !target.readOnly;
  }

  if (target instanceof HTMLInputElement) {
    const type = target.type.toLowerCase();
  
    const blockedTypes = new Set([
      "date",
      "time",
      "datetime-local",
      "month",
      "week",
      "color",
      "file",
      "range",
      "checkbox",
      "radio",
      "button",
      "submit",
      "reset",
      "hidden",
      "password",
      "number",
    ]);
  
    if (blockedTypes.has(type)) {
      return false;
    }
  
    if (isDateLikeInput(target)) {
      return false;
    }
  
    const editableTypes = new Set([
      "text",
      "email",
      "tel",
      "url",
      "search",
    ]);
  
    return editableTypes.has(type) && !target.disabled && !target.readOnly;
  }

  return target.isContentEditable;
}

function showPanel(target: HTMLElement): void {
  activeEditable.value = target;
  visible.value = true;

  snippetsReloadKey.value += 1;

  requestAnimationFrame(() => {
    updatePanelPosition();
  });
}

function hidePanel(): void {
  visible.value = false;
  activeEditable.value = null;
}

function updatePanelPosition(): void {
  const target = activeEditable.value;

  if (!target) {
    return;
  }

  const rect = target.getBoundingClientRect();

  const panelWidth =
    panelWrapper.value?.offsetWidth || fallbackPanelWidth;

  const panelHeight =
    panelWrapper.value?.offsetHeight || fallbackPanelHeight;

  let left = rect.left;
  let top = rect.bottom + gap;

  const maxLeft = window.innerWidth - panelWidth - viewportPadding;

  if (left > maxLeft) {
    left = maxLeft;
  }

  if (left < viewportPadding) {
    left = viewportPadding;
  }

  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;

  if (spaceBelow < panelHeight + gap && spaceAbove > spaceBelow) {
    top = rect.top - panelHeight - gap;
  }

  if (top < viewportPadding) {
    top = viewportPadding;
  }

  const maxTop = window.innerHeight - panelHeight - viewportPadding;

  if (top > maxTop) {
    top = maxTop;
  }

  panelLeft.value = left;
  panelTop.value = top;
}

function handleInsert(content: string): void {
  const target = activeEditable.value;

  if (!target || !content) {
    return;
  }

  if (target instanceof HTMLInputElement) {
    appendToInput(target, content);
    return;
  }

  if (target instanceof HTMLTextAreaElement) {
    appendToTextarea(target, content);
    return;
  }
}

function appendToInput(input: HTMLInputElement, content: string): void {
  const currentValue = input.value;
  const nextValue = currentValue ? `${currentValue} ${content}` : content;

  setNativeValue(input, nextValue);
  focusAndMoveCursorToEnd(input);
  dispatchEditableEvents(input);
}

function appendToTextarea(textarea: HTMLTextAreaElement, content: string): void {
  const currentValue = textarea.value;
  const nextValue = currentValue ? `${currentValue}\n${content}` : content;

  setNativeValue(textarea, nextValue);
  focusAndMoveCursorToEnd(textarea);
  dispatchEditableEvents(textarea);
}

function setNativeValue(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): void {
  const prototype = Object.getPrototypeOf(element);
  const valueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;

  valueSetter?.call(element, value);
}

function focusAndMoveCursorToEnd(
  element: HTMLInputElement | HTMLTextAreaElement,
): void {
  element.focus();

  if (element instanceof HTMLTextAreaElement) {
    const end = element.value.length;
    element.setSelectionRange(end, end);
    return;
  }

  if (!canSetSelectionRange(element)) {
    return;
  }

  try {
    const end = element.value.length;
    element.setSelectionRange(end, end);
  } catch (error) {
    console.warn("[TextPilot] setSelectionRange failed:", error);
  }
}

function canSetSelectionRange(input: HTMLInputElement): boolean {
  const supportedTypes = new Set([
    "text",
    "search",
    "url",
    "tel",
  ]);

  return supportedTypes.has(input.type.toLowerCase());
}

function dispatchEditableEvents(
  element: HTMLInputElement | HTMLTextAreaElement,
): void {
  element.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      inputType: "insertText",
      data: element.value,
    }),
  );

  element.dispatchEvent(
    new Event("change", {
      bubbles: true,
    }),
  );
}

function handleFocusIn(event: FocusEvent): void {
  const path = event.composedPath();

  if (panelWrapper.value && path.includes(panelWrapper.value)) {
    return;
  }

  if (floatingRoot.value && path.includes(floatingRoot.value)) {
    return;
  }

  const target = event.target;

  if (!isEditableElement(target)) {
    return;
  }

  showPanel(target);
}

function handlePointerDown(event: PointerEvent): void {
  const path = event.composedPath();

  if (panelWrapper.value && path.includes(panelWrapper.value)) {
    return;
  }

  if (floatingRoot.value && path.includes(floatingRoot.value)) {
    return;
  }

  const target = event.target;

  if (isEditableElement(target)) {
    showPanel(target);
    return;
  }

  hidePanel();
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    hidePanel();
  }
}

function handleScrollOrResize(event?: Event): void {
  if (!visible.value) {
    return;
  }

  if (event) {
    const path = event.composedPath();

    if (panelWrapper.value && path.includes(panelWrapper.value)) {
      return;
    }

    if (floatingRoot.value && path.includes(floatingRoot.value)) {
      return;
    }
  }

  hidePanel();
}

onMounted(() => {
  document.addEventListener("focusin", handleFocusIn, true);
  document.addEventListener("pointerdown", handlePointerDown, true);
  document.addEventListener("keydown", handleKeydown, true);
  window.addEventListener("scroll", handleScrollOrResize, true);
  window.addEventListener("resize", handleScrollOrResize);
});

onBeforeUnmount(() => {
  document.removeEventListener("focusin", handleFocusIn, true);
  document.removeEventListener("pointerdown", handlePointerDown, true);
  document.removeEventListener("keydown", handleKeydown, true);
  window.removeEventListener("scroll", handleScrollOrResize, true);
  window.removeEventListener("resize", handleScrollOrResize);
});
</script>