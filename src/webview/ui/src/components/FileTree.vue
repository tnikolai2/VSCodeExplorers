<script setup vapor lang="ts">
import type { TabConfig, DirItem, ContextMenuTarget } from '../types';
import { ICONS } from '../icons';
import { postMessage } from '../vscode';
import FileTreeNode from './FileTreeNode.vue';

const props = defineProps<{
  activeTab: TabConfig | undefined;
  expandedDirs: Set<string>;
  dirCache: Map<string, DirItem[]>;
}>();

const emit = defineEmits<{
  (e: 'toggleExpand', path: string): void;
  (e: 'showContextMenu', event: MouseEvent, target: ContextMenuTarget): void;
}>();

function onContainerContextMenu(e: MouseEvent) {
  if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('empty-state')) {
    e.preventDefault();
    emit('showContextMenu', e, { isContainer: true, tabId: props.activeTab?.id });
  }
}

function onAddFolder() {
  postMessage({ command: 'addFolder', tabId: props.activeTab?.id });
}
</script>

<template>
  <div class="tree-container" @contextmenu="onContainerContextMenu">
    <div
      v-if="!props.activeTab || !props.activeTab.folders || props.activeTab.folders.length === 0"
      class="empty-state"
    >
      <div class="empty-icon" v-html="ICONS.folderOpened"></div>
      <div class="empty-title">{{ props.activeTab ? props.activeTab.title : 'Active Tab' }}</div>
      <div class="empty-subtitle">No folders added to this tab yet</div>
      <button class="empty-btn" @click="onAddFolder">📁 Add Folder to Tab</button>
    </div>

    <template v-else>
      <FileTreeNode
        v-for="folder in props.activeTab.folders"
        :key="folder.path"
        :item="{ name: folder.label || folder.path, path: folder.path, isDirectory: true }"
        :is-root="true"
        :root-label="folder.label"
        :tab-id="props.activeTab.id"
        :expanded-dirs="props.expandedDirs"
        :dir-cache="props.dirCache"
        @toggle-expand="(p) => emit('toggleExpand', p)"
        @show-context-menu="(ev, t) => emit('showContextMenu', ev, t)"
      />
    </template>
  </div>
</template>

<style scoped>
.tree-container {
  flex: 1;
  width: 100%;
  max-width: 100%;
  overflow-y: auto !important;
  overflow-x: hidden !important;
  padding: 2px 0;
  scrollbar-width: thin;
}
.tree-container::-webkit-scrollbar {
  display: block !important;
  width: 7px !important;
}
.tree-container::-webkit-scrollbar-thumb {
  background-color: var(--vscode-scrollbarSlider-background, rgba(128, 128, 128, 0.25));
  border-radius: 3px;
}
.tree-container::-webkit-scrollbar-thumb:hover {
  background-color: var(--vscode-scrollbarSlider-hoverBackground, rgba(128, 128, 128, 0.4));
}
.empty-state {
  padding: 36px 16px;
  text-align: center;
  color: var(--vscode-descriptionForeground, rgba(255, 255, 255, 0.6));
  font-size: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.empty-icon {
  width: 32px;
  height: 32px;
  margin-bottom: 8px;
  opacity: 0.85;
}
.empty-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--vscode-foreground);
  margin-bottom: 4px;
}
.empty-subtitle {
  font-size: 11px;
  opacity: 0.7;
  margin-bottom: 12px;
}
.empty-btn {
  padding: 5px 14px;
  background-color: var(--vscode-button-background, #0e639c);
  color: var(--vscode-button-foreground, #ffffff);
  border: none;
  border-radius: 2px;
  cursor: pointer;
  font-size: 12px;
}
.empty-btn:hover {
  background-color: var(--vscode-button-hoverBackground, #1177bb);
}
</style>
