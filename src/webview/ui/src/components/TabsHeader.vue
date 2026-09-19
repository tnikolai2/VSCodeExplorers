<script setup vapor lang="ts">
import type { TabConfig, ContextMenuTarget } from '../types';
import { postMessage } from '../vscode';

const props = defineProps<{
  tabs: TabConfig[];
  activeTabId: string | null;
}>();

const emit = defineEmits<{
  (e: 'showContextMenu', event: MouseEvent, target: ContextMenuTarget): void;
}>();

function switchTab(tabId: string) {
  postMessage({ command: 'switchTab', tabId });
}

function addTab() {
  postMessage({ command: 'addTab' });
}

function onTabContextMenu(e: MouseEvent, tabId: string) {
  e.preventDefault();
  e.stopPropagation();
  emit('showContextMenu', e, { isTab: true, tabId });
}

function onHeaderContextMenu(e: MouseEvent) {
  e.preventDefault();
  emit('showContextMenu', e, { isTabsHeader: true, tabId: props.activeTabId || undefined });
}
</script>

<template>
  <div class="tabs-header-container" @contextmenu="onHeaderContextMenu">
    <div class="tabs-list">
      <div
        v-for="tab in props.tabs"
        :key="tab.id"
        class="tab"
        :class="{ active: tab.id === props.activeTabId }"
        :title="`${tab.title} (${tab.folders?.length || 0} folders)`"
        @click="switchTab(tab.id)"
        @contextmenu="onTabContextMenu($event, tab.id)"
      >
        <span class="tab-label">{{ tab.title }}</span>
      </div>
      <div class="tab-add-btn" title="Add New Tab" @click="addTab">+</div>
    </div>
  </div>
</template>

<style scoped>
.tabs-header-container {
  width: 100%;
  background-color: var(--vscode-editorGroupHeader-tabsBackground, #252526);
  border-bottom: 1px solid var(--vscode-tab-border, rgba(128, 128, 128, 0.25));
  position: relative;
  overflow: hidden !important;
  z-index: 10;
  flex-shrink: 0;
  display: flex;
  align-items: center;
}
.tabs-list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  width: 100%;
  padding: 0;
  margin: 0;
}
.tab {
  display: inline-flex;
  align-items: center;
  height: 25px;
  padding: 0 8px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  background-color: var(--vscode-tab-inactiveBackground, #2d2d2d);
  color: var(--vscode-tab-inactiveForeground, #cccccc);
  border-right: 1px solid var(--vscode-tab-border, rgba(128, 128, 128, 0.25));
  border-bottom: 1px solid var(--vscode-tab-border, rgba(128, 128, 128, 0.25));
  border-top: 2px solid transparent;
  flex-shrink: 0;
  transition: background-color 0.1s ease, color 0.1s ease;
}
.tab:hover {
  background-color: var(--vscode-tab-hoverBackground, rgba(128, 128, 128, 0.15));
  color: var(--vscode-tab-hoverForeground, #ffffff);
}
.tab.active {
  background-color: var(--vscode-tab-activeBackground, var(--vscode-sideBar-background, #1e1e1e));
  color: var(--vscode-tab-activeForeground, #ffffff);
  border-top: 2px solid var(--vscode-tab-activeBorderTop, var(--vscode-focusBorder, #007acc));
  border-bottom: 1px solid var(--vscode-tab-activeBackground, var(--vscode-sideBar-background, #1e1e1e));
}
.tab-label {
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
  color: inherit;
}
.tab-add-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 25px;
  padding: 0 8px;
  cursor: pointer;
  opacity: 0.6;
  font-size: 14px;
  font-weight: 600;
  border-right: 1px solid var(--vscode-tab-border, rgba(128, 128, 128, 0.25));
}
.tab-add-btn:hover {
  opacity: 1;
  background-color: var(--vscode-tab-hoverBackground, rgba(128, 128, 128, 0.15));
}
</style>

