<template>
<section
  class="relative card bg-base-100 shadow-xl border border-base-300 overflow-hidden"
  :style="{ width: `${panelWidth}px`, minWidth: `${minPanelWidth}px` }"
>
    <!-- 搜索区 -->
    <div class="p-3 border-b border-base-300">
      <label class="input input-bordered input-sm w-full">
        <span class="opacity-50" v-html="IconSearch"></span>

        <input
          v-model="searchKeyword"
          type="search"
          class="grow"
          placeholder="搜索片段..."
        />
      </label>
    </div>

    <!-- 列表区 -->
    <div
      ref="listEl"
      class="max-h-72 overflow-y-auto overflow-x-hidden overscroll-contain p-2"
    >
      <!-- 无搜索时：允许拖拽排序 -->
      <Draggable
        v-if="!hasSearchKeyword"
        v-model="items"
        item-key="id"
        handle=".tp-drag-handle"
        ghost-class="opacity-40"
        chosen-class="bg-base-200"
        drag-class="opacity-70"
        class="space-y-1"
        :scroll="listEl"
        :scroll-sensitivity="60"
        :scroll-speed="18"
        :bubble-scroll="false"
        :force-fallback="true"
        :fallback-on-body="true"
        @start="handleSortStart"
        @end="handleSortEnd"
      >
        <template #item="{ element: item }">
          <div
            class="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-base-200"
          >
            <button
              class="tp-drag-handle btn btn-ghost btn-xs btn-square cursor-grab active:cursor-grabbing"
              type="button"
              title="拖动排序"
            >
              <span v-html="IconGrip"></span>
            </button>

            <div
              class="flex-1 min-w-0 truncate text-sm cursor-pointer"
              @click="handleInsertSnippet(item)"
              @mouseenter="scheduleShowBoard(item.id, $event)"
              @mouseleave="scheduleHideBoard"
            >
              {{ item.title }}
            </div>

            <button
              class="btn btn-ghost btn-xs btn-square"
              type="button"
              title="删除"
              @click="handleDeleteSnippet(item.id)"
            >
              <span v-html="IconDelete"></span>
            </button>
          </div>
        </template>
      </Draggable>

      <!-- 搜索时：普通列表，不显示 Grip，不允许拖拽 -->
      <div
        v-else
        class="space-y-1"
      >
        <div
          v-for="item in filteredItems"
          :key="item.id"
          class="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-base-200"
        >
            <div
              class="flex-1 min-w-0 truncate text-sm cursor-pointer"
              @click="handleInsertSnippet(item)"
              @mouseenter="scheduleShowBoard(item.id, $event)"
              @mouseleave="scheduleHideBoard"
            >
              {{ item.title }}
            </div>

          <button
            class="btn btn-ghost btn-xs btn-square"
            type="button"
            title="删除"
            @click="handleDeleteSnippet(item.id)"
          >
            <span v-html="IconDelete"></span>
          </button>
        </div>

        <div
          v-if="filteredItems.length === 0"
          class="px-3 py-6 text-center text-sm text-base-content/50"
        >
          No results
        </div>
      </div>
    </div>

    <!-- 状态栏 -->
    <footer
      class="h-10 px-2 border-t border-base-300 bg-base-200/60 flex items-center gap-2"
    >
      <button
        class="btn btn-ghost btn-xs btn-square"
        type="button"
        title="新增记录"
        @click="handleAddSnippet"
      >
        <span v-html="IconPlus"></span>
      </button>

      <div class="flex-1 text-center text-xs opacity-60">
        <template v-if="hasSearchKeyword">
          {{ filteredItems.length }} / {{ items.length }} items
        </template>

        <template v-else>
          {{ items.length }} items
        </template>
      </div>

      <button
        class="btn btn-ghost btn-xs btn-square"
        type="button"
        title="数据仅保存在本地浏览器中，不会上传到服务器。"
      >
        <span v-html="IconInfo"></span>
      </button>
    </footer>

    <!-- 右侧拖拽宽度区域 -->
    <div
      class="absolute top-0 right-0 h-full w-2 cursor-ew-resize hover:bg-primary/10"
      title="拖拽调整宽度"
      @pointerdown="startResize"
    />
  </section>

  <!-- Floating Editor Board：常驻，只用 v-show 控制显示 -->
  <Teleport
    v-if="props.floatingRoot"
    :to="props.floatingRoot"
  >
    <div
    ref="floatingEl"
    v-show="boardVisible"
    class="z-[9999] pointer-events-auto"
    :style="floatingStyles"
    @mouseenter="cancelHideBoard"
    @mouseleave="scheduleHideBoard"
    @focusin="lockBoard"
    @focusout="unlockBoardLater"
    @wheel="handleBoardWheel"
    >
      <SnippetBoard
        :item="activeItem"
        @save="handleSnippetSave"
      />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import Draggable from "vuedraggable";
import {
  autoUpdate,
  flip,
  offset,
  shift,
  useFloating,
  type VirtualElement,
} from "@floating-ui/vue";

import SnippetBoard from "./SnippetBoard.vue";

import {
  IconDelete,
  IconGrip,
  IconInfo,
  IconPlus,
  IconSearch,
} from "../utils/icons";

import {
  loadPanelWidth,
  loadSnippetItems,
  savePanelWidth,
  saveSnippetItems,
  type SnippetItem,
} from "../utils/textpilotStorage";

const props = defineProps<{
  floatingRoot?: HTMLElement | null;
  snippetsReloadKey?: number;
}>();

const emit = defineEmits<{
  insert: [content: string];
}>();

const emptyItem: SnippetItem = {
  id: "",
  title: "",
  content: "",
};

const minPanelWidth = 250;
const maxPanelWidth = 750;
const defaultPanelWidth = minPanelWidth;

const panelWidth = ref(defaultPanelWidth);

let isResizing = false;
let startX = 0;
let startWidth = 0;

let showTimer: number | null = null;
let hideTimer: number | null = null;
let unlockTimer: number | null = null;

const boardVisible = ref(false);
const isBoardLocked = ref(false);
const listEl = ref<HTMLElement | null>(null);

const searchKeyword = ref("");

const defaultItems: SnippetItem[] = [
  {
    id: "1",
    title: "姓名",
    content: "张三",
  },
  {
    id: "2",
    title: "本科学校",
    content: "门口沟大学",
  },
  {
    id: "3",
    title:
      "ababababaabababababababababababababababababababababababaabababababababababababababababababababababbababababab",
    content:
      "ababababaabababababababababababababababababababababababaabababababababababababababababababababababbababababab",
  },
  {
    id: "4",
    title:
      "你好你好你好你好你好你好你好你好你好你好你好你好你好你好你好你好你好你好你好你好你好你好你好你好你好你好你好你好",
    content:
      "你好你好你好你好你好你好你好你好你好你好你好你好你好你好你好你好你好你好你好你好你好你好你好你好你好你好你好你好",
  },
];

const items = ref<SnippetItem[]>(defaultItems);
async function loadPanelWidthOnce(): Promise<void> {
  panelWidth.value = await loadPanelWidth({
    defaultWidth: defaultPanelWidth,
    minWidth: minPanelWidth,
    maxWidth: maxPanelWidth,
  });
}

async function reloadSnippetItems(): Promise<void> {
  items.value = await loadSnippetItems(defaultItems);
}

const hasSearchKeyword = computed(() => {
  return searchKeyword.value.trim().length > 0;
});

const filteredItems = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase();

  if (!keyword) {
    return items.value;
  }

  return items.value.filter((item) => {
    return item.title.toLowerCase().includes(keyword);
  });
});

const activeItemId = ref<string | null>(null);
const referenceEl = shallowRef<VirtualElement | null>(null);
const floatingEl = shallowRef<HTMLElement | null>(null);

const activeItem = computed(() => {
  if (!activeItemId.value) {
    return emptyItem;
  }

  return items.value.find((item) => item.id === activeItemId.value) ?? emptyItem;
});

const { floatingStyles } = useFloating(referenceEl, floatingEl, {
  strategy: "fixed",
  placement: "right-start",
  middleware: [
    offset(12),
    flip({
      padding: 12,
    }),
    shift({
      padding: 12,
    }),
  ],
  whileElementsMounted: autoUpdate,
});

function handleAddSnippet(): void {
  const newItem: SnippetItem = {
    id: createSnippetId(),
    title: "New Snippet",
    content: "",
  };

  const nextItems = [...items.value, newItem];

  items.value = nextItems;
  void saveSnippetItems(nextItems);

  void scrollListToBottom();
}

function handleDeleteSnippet(id: string): void {
  const nextItems = items.value.filter((item) => item.id !== id);

  items.value = nextItems;
  void saveSnippetItems(nextItems);

  if (activeItemId.value === id) {
    hideBoard();
    activeItemId.value = null;
  }
}

function handleSortStart(): void {
  cancelShowBoard();
  hideBoard();
}

function handleSortEnd(): void {
  void saveSnippetItems(items.value);
}

function createSnippetId(): string {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `snippet-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function scrollListToBottom(): Promise<void> {
  await nextTick();

  if (!listEl.value) {
    return;
  }

  listEl.value.scrollTo({
    top: listEl.value.scrollHeight,
    behavior: "smooth",
  });
}

function scheduleShowBoard(itemId: string, event: MouseEvent): void {
  cancelShowBoard();
  cancelHideBoard();
  cancelUnlockBoard();

  const x = event.clientX;
  const y = event.clientY;

  showTimer = window.setTimeout(() => {
    activeItemId.value = itemId;
    referenceEl.value = createMouseVirtualElement(x, y);
    boardVisible.value = true;
    showTimer = null;
  }, 800);
}

function cancelShowBoard(): void {
  if (showTimer === null) {
    return;
  }

  window.clearTimeout(showTimer);
  showTimer = null;
}

function createMouseVirtualElement(x: number, y: number): VirtualElement {
  return {
    getBoundingClientRect() {
      return {
        x,
        y,
        top: y,
        left: x,
        right: x,
        bottom: y,
        width: 0,
        height: 0,
      } as DOMRect;
    },
  };
}

function scheduleHideBoard(): void {
  cancelShowBoard();
  cancelHideBoard();

  hideTimer = window.setTimeout(() => {
    if (isBoardLocked.value) {
      return;
    }

    hideBoard();
  }, 180);
}

function cancelHideBoard(): void {
  if (hideTimer === null) {
    return;
  }

  window.clearTimeout(hideTimer);
  hideTimer = null;
}

function hideBoard(): void {
  cancelShowBoard();
  cancelHideBoard();
  cancelUnlockBoard();

  isBoardLocked.value = false;
  boardVisible.value = false;
  referenceEl.value = null;
}

function lockBoard(): void {
  cancelShowBoard();
  cancelHideBoard();
  cancelUnlockBoard();

  isBoardLocked.value = true;
  boardVisible.value = true;
}

function unlockBoardLater(): void {
  cancelUnlockBoard();

  unlockTimer = window.setTimeout(() => {
    const activeElement = document.activeElement;

    if (
      floatingEl.value &&
      activeElement instanceof Node &&
      floatingEl.value.contains(activeElement)
    ) {
      return;
    }

    isBoardLocked.value = false;
  }, 80);
}

function cancelUnlockBoard(): void {
  if (unlockTimer === null) {
    return;
  }

  window.clearTimeout(unlockTimer);
  unlockTimer = null;
}

function handleSnippetSave(payload: SnippetItem): void {
  if (!payload.id) {
    return;
  }

  const nextItems = items.value.map((item) => {
    if (item.id !== payload.id) {
      return item;
    }

    return {
      ...item,
      title: payload.title,
      content: payload.content,
    };
  });

  items.value = nextItems;
  void saveSnippetItems(nextItems);
  activeItemId.value = payload.id;
}

function handleInsertSnippet(item: SnippetItem): void {
  emit("insert", item.content);
}

function handleDocumentPointerDown(event: PointerEvent): void {
  if (!boardVisible.value) {
    return;
  }

  const path = event.composedPath();

  if (floatingEl.value && path.includes(floatingEl.value)) {
    return;
  }

  hideBoard();
}

function handleDocumentKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    hideBoard();
  }
}

function clampWidth(width: number): number {
  return Math.min(maxPanelWidth, Math.max(minPanelWidth, width));
}

function startResize(event: PointerEvent): void {
  event.preventDefault();

  isResizing = true;
  startX = event.clientX;
  startWidth = panelWidth.value;

  document.body.style.cursor = "ew-resize";
  document.body.style.userSelect = "none";

  window.addEventListener("pointermove", handleResize);
  window.addEventListener("pointerup", stopResize);
}

function handleResize(event: PointerEvent): void {
  if (!isResizing) return;

  const delta = event.clientX - startX;
  panelWidth.value = clampWidth(startWidth + delta);
}

function stopResize(): void {
  if (!isResizing) return;

  isResizing = false;

  void savePanelWidth(panelWidth.value, {
    minWidth: minPanelWidth,
    maxWidth: maxPanelWidth,
  });

  document.body.style.cursor = "";
  document.body.style.userSelect = "";

  window.removeEventListener("pointermove", handleResize);
  window.removeEventListener("pointerup", stopResize);
}

function handleBoardWheel(event: WheelEvent): void {
  event.stopPropagation();

  const target = event.target;

  if (!(target instanceof Element)) {
    event.preventDefault();
    return;
  }

  const scrollableElement = findScrollableElement(target, floatingEl.value);

  if (!scrollableElement) {
    event.preventDefault();
    return;
  }

  if (!canScrollElement(scrollableElement, event.deltaY)) {
    event.preventDefault();
  }
}

function findScrollableElement(
  startElement: Element,
  stopElement: HTMLElement | null,
): HTMLElement | null {
  let current: Element | null = startElement;

  while (current && current !== stopElement) {
    if (current instanceof HTMLElement && isScrollableElement(current)) {
      return current;
    }

    current = current.parentElement;
  }

  if (stopElement && isScrollableElement(stopElement)) {
    return stopElement;
  }

  return null;
}

function isScrollableElement(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  const overflowY = style.overflowY;

  const canOverflow =
    overflowY === "auto" ||
    overflowY === "scroll" ||
    overflowY === "overlay";

  return canOverflow && element.scrollHeight > element.clientHeight;
}

function canScrollElement(element: HTMLElement, deltaY: number): boolean {
  if (deltaY < 0) {
    return element.scrollTop > 0;
  }

  if (deltaY > 0) {
    return element.scrollTop + element.clientHeight < element.scrollHeight;
  }

  return false;
}

watch(
  () => props.snippetsReloadKey,
  () => {
    void reloadSnippetItems();
  },
);

onMounted(() => {
  void loadPanelWidthOnce();
  void reloadSnippetItems();
  
  document.addEventListener("pointerdown", handleDocumentPointerDown);
  document.addEventListener("keydown", handleDocumentKeydown);
});

onBeforeUnmount(() => {
  cancelShowBoard();
  cancelHideBoard();
  cancelUnlockBoard();

  document.removeEventListener("pointerdown", handleDocumentPointerDown);
  document.removeEventListener("keydown", handleDocumentKeydown);

  window.removeEventListener("pointermove", handleResize);
  window.removeEventListener("pointerup", stopResize);

  document.body.style.cursor = "";
  document.body.style.userSelect = "";
});
</script>

<style scoped>
:deep(svg) {
  width: 16px;
  height: 16px;
}
</style>
