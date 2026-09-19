<script setup vapor lang="ts">
import { computed } from 'vue';
import type { ContextMenuState } from '../types';
import { postMessage } from '../vscode';

const props = defineProps<{
  menuState: ContextMenuState;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const positionStyle = computed(() => {
  const x = Math.min(props.menuState.x, window.innerWidth - 170);
  const y = Math.min(props.menuState.y, window.innerHeight - 200);
  return {
    left: `${Math.max(0, x)}px`,
    top: `${Math.max(0, y)}px`
  };
});

function handleAction(action: string) {
  const target = props.menuState.target;
  emit('close');
  if (!target) return;

  switch (action) {
    case 'renameTab':
      if (target.tabId) postMessage({ command: 'renameTab', tabId: target.tabId });
      break;
    case 'deleteTab':
      if (target.tabId) postMessage({ command: 'deleteTab', tabId: target.tabId });
      break;
    case 'addTab':
      postMessage({ command: 'addTab' });
      break;
    case 'addFolder':
      postMessage({ command: 'addFolder', tabId: target.tabId });
      break;
    case 'refresh':
      postMessage({ command: 'refresh' });
      break;
    case 'newFile':
      if (target.path) postMessage({ command: 'newFile', folderPath: target.path });
      break;
    case 'newFolder':
      if (target.path) postMessage({ command: 'newFolder', folderPath: target.path });
      break;
    case 'renameItem':
      if (target.path) postMessage({ command: 'renameItem', itemPath: target.path });
      break;
    case 'deleteItem':
      if (target.path) postMessage({ command: 'deleteItem', itemPath: target.path });
      break;
    case 'removeRootFolder':
      if (target.tabId && target.path) {
        postMessage({ command: 'removeFolder', tabId: target.tabId, folderPath: target.path });
      }
      break;
    case 'copyPath':
      if (target.path) postMessage({ command: 'copyPath', itemPath: target.path });
      break;
    case 'revealInOS':
      if (target.path) postMessage({ command: 'revealInOS', itemPath: target.path });
      break;
  }
}
</script>

<template>
  <div
    v-if="props.menuState.visible && props.menuState.target"
    class="context-menu"
    :style="positionStyle"
    @click.stop
  >
    <!-- Tab context menu -->
    <template v-if="props.menuState.target.isTab">
      <div class="context-menu-item" @click="handleAction('renameTab')">Rename Tab...</div>
      <div class="context-menu-item" @click="handleAction('addFolder')">📁 Add Folder to Tab...</div>
      <div class="context-menu-item" @click="handleAction('addTab')">+ New Tab...</div>
      <div class="context-menu-sep"></div>
      <div class="context-menu-item danger" @click="handleAction('deleteTab')">Delete Tab</div>
    </template>

    <!-- Container / Header context menu -->
    <template v-else-if="props.menuState.target.isContainer || props.menuState.target.isTabsHeader">
      <div class="context-menu-item" @click="handleAction('addTab')">+ New Tab...</div>
      <div class="context-menu-item" @click="handleAction('addFolder')">📁 Add Folder to Tab...</div>
      <div class="context-menu-sep"></div>
      <div class="context-menu-item" @click="handleAction('refresh')">🔄 Refresh</div>
    </template>

    <!-- File / Folder context menu -->
    <template v-else>
      <template v-if="props.menuState.target.isDirectory">
        <div class="context-menu-item" @click="handleAction('newFile')">New File...</div>
        <div class="context-menu-item" @click="handleAction('newFolder')">New Folder...</div>
        <div class="context-menu-sep"></div>
      </template>

      <template v-if="!props.menuState.target.isRoot">
        <div class="context-menu-item" @click="handleAction('renameItem')">Rename...</div>
        <div class="context-menu-item danger" @click="handleAction('deleteItem')">Delete</div>
        <div class="context-menu-sep"></div>
      </template>
      <template v-else>
        <div class="context-menu-item danger" @click="handleAction('removeRootFolder')">Remove from Tab</div>
        <div class="context-menu-sep"></div>
      </template>

      <div class="context-menu-item" @click="handleAction('copyPath')">Copy Path</div>
      <div class="context-menu-item" @click="handleAction('revealInOS')">Reveal in File Explorer</div>
    </template>
  </div>
</template>

<style scoped>
.context-menu {
  position: fixed;
  z-index: 9999;
  background-color: var(--vscode-menu-background, #252526);
  color: var(--vscode-menu-foreground, #cccccc);
  border: 1px solid var(--vscode-menu-border, #454545);
  border-radius: 4px;
  padding: 4px 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
  min-width: 160px;
}
.context-menu-item {
  padding: 5px 12px;
  cursor: pointer;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.context-menu-item:hover {
  background-color: var(--vscode-menu-selectionBackground, #094771);
  color: var(--vscode-menu-selectionForeground, #ffffff);
}
.context-menu-item.danger:hover {
  background-color: var(--vscode-inputValidation-errorBackground, #5a1d1d);
  color: #ff8888;
}
.context-menu-sep {
  height: 1px;
  background-color: var(--vscode-menu-separatorBackground, #454545);
  margin: 4px 0;
}
</style>

