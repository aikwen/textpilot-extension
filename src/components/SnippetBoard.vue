<template>
  <div class="p-2  overscroll-contain"
   >
    <fieldset
      class="fieldset bg-base-200 border-base-300 overscroll-contain rounded-box w-96 max-h-[380px] overflow-y-auto overflow-x-hidden border p-4 shadow-2xl"
    >
      <legend class="fieldset-legend"></legend>

      <label class="label">Title</label>
      <input
        v-model="localTitle"
        type="text"
        class="input input-bordered w-full"
        placeholder="Title"
      />

      <label class="label mt-2">Content</label>
      <textarea
        v-model="localContent"
        class="textarea textarea-bordered min-h-36 max-h-56 w-full resize-none overflow-y-auto text-sm leading-6 overscroll-contain"
        placeholder="Content"
      />

      <div class="mt-3 flex justify-end">
        <button
          class="btn btn-primary btn-sm"
          type="button"
          @click="handleSave"
        >
          Save
        </button>
      </div>
    </fieldset>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";

type SnippetItem = {
  id: string;
  title: string;
  content: string;
};

const props = defineProps<{
  item: SnippetItem;
}>();

const emit = defineEmits<{
  save: [
    payload: {
      id: string;
      title: string;
      content: string;
    },
  ];
}>();

const localTitle = ref(props.item.title);
const localContent = ref(props.item.content);

watch(
  () => props.item,
  (item) => {
    localTitle.value = item.title;
    localContent.value = item.content;
  },
);

function handleSave(): void {
  const title = localTitle.value.trim();
  const content = localContent.value.trim();

  emit("save", {
    id: props.item.id,
    title: title || props.item.title,
    content,
  });
}
</script>