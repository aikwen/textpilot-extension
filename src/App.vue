<template>
  <main class="min-h-screen bg-base-200 flex items-center justify-center p-8">
    <section class="w-full max-w-2xl rounded-2xl bg-base-100 shadow-xl p-8">
      <div class="text-center mb-6">
        <h1 class="text-2xl font-bold">TextPilot Playground</h1>
        <p class="text-sm text-base-content/60 mt-2">
          静态 UI 测试
        </p>
      </div>

      <div class="flex justify-center">
        <div class="w-[520px]">
          <TextPilotPanel />
        </div>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import TextPilotPanel from "./components/TextPilotPanel.vue";
</script>