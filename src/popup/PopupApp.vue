<template>
  <main class="w-72 bg-base-100 p-4 text-base-content">
    <section class="space-y-4">
      <div>
        <h1 class="text-base font-semibold">TextPilot</h1>
        <p class="mt-1 text-xs text-base-content/60">
          Lightweight browser input snippets.
        </p>
      </div>

      <div class="rounded-box border border-base-300 bg-base-200/50 p-3">
        <label class="flex cursor-pointer items-center justify-between gap-4">
          <div>
            <div class="text-sm font-medium">
              {{ enabled ? "Enabled" : "Disabled" }}
            </div>
            <div class="mt-1 text-xs text-base-content/60">
              {{ statusText }}
            </div>
          </div>

          <input
            v-model="enabled"
            type="checkbox"
            class="toggle toggle-primary"
            :disabled="loading"
          />
        </label>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import {
  loadTextPilotEnabled,
  saveTextPilotEnabled,
} from "../utils/textpilotStorage";

const enabled = ref(true);
const loading = ref(true);
const hasLoaded = ref(false);

const statusText = computed(() => {
  if (enabled.value) {
    return "TextPilot will appear when you focus text inputs.";
  }

  return "TextPilot is hidden until you enable it again.";
});

watch(enabled, (value) => {
  if (!hasLoaded.value) {
    return;
  }

  void saveTextPilotEnabled(value);
});

onMounted(async () => {
  enabled.value = await loadTextPilotEnabled();
  loading.value = false;
  hasLoaded.value = true;
});
</script>