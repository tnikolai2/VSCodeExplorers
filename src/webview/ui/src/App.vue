<script setup vapor lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue';
import type { BarConfig, DirItem, ContextMenuTarget, ContextMenuState, TabConfig, TabExcludeConfig } from './types';
import { postMessage, norm, isPathInside, getVsCodeApi } from './vscode';
import TabsHeader from './components/TabsHeader.vue';
import FileTree from './components/FileTree.vue';
import ContextMenu from './components/ContextMenu.vue';
import ExcludeModal from './components/ExcludeModal.vue';
import ManagerDashboard from './components/ManagerDashboard.vue';

const isManager = ref((window as any).EXPLORER_MODE === 'manager');
const mountStart = performance.now();
let firstDirLogged = false;

const currentBar = ref<BarConfig | null>(null);
const activeTabId = ref<string | null>(null);
const expandedDirs = ref<Set<string>>(new Set());
const dirCache = ref<Map<string, DirItem[]>>(new Map());

const contextMenuState = reactive<ContextMenuState>({
  visible: false,
  x: 0,
  y: 0,
  target: null
});

const activeTab = computed(() => {
  if (!currentBar.value || !currentBar.value.tabs) return undefined;
  return currentBar.value.tabs.find((t) => t.id === activeTabId.value) || currentBar.value.tabs[0];
});

function toggleExpand(dirPath: string) {
  const nPath = norm(dirPath);
  const nextSet = new Set(expandedDirs.value);

  if (nextSet.has(nPath)) {
    nextSet.delete(nPath);
  } else {
    nextSet.add(nPath);
    // Request folder contents if not cached
    if (!dirCache.value.has(nPath)) {
      postMessage({ command: 'readDir', dirPath });
    }
  }

  expandedDirs.value = nextSet;

  // Persist expanded folders
  const currentTab = activeTab.value;
  if (currentTab) {
    const expArray = Array.from(nextSet);
    getVsCodeApi().setState({ currentActiveTabId: currentTab.id, expandedFolders: expArray });
    postMessage({
      command: 'saveExpandedFolders',
      tabId: currentTab.id,
      expandedFolders: expArray
    });
  }
}

function openContextMenu(event: MouseEvent, target: ContextMenuTarget) {
  contextMenuState.visible = true;
  contextMenuState.x = event.clientX;
  contextMenuState.y = event.clientY;
  contextMenuState.target = target;
}

function closeContextMenu() {
  contextMenuState.visible = false;
  contextMenuState.target = null;
}

const excludeModalVisible = ref(false);
const excludeModalTab = ref<TabConfig | null>(null);

function openExcludeModal(tabId?: string) {
  const targetId = tabId || activeTabId.value;
  const tab = currentBar.value?.tabs?.find((t) => t.id === targetId) || activeTab.value || null;
  if (tab) {
    excludeModalTab.value = tab;
    excludeModalVisible.value = true;
  }
}

function onSaveExclude(exclude: TabExcludeConfig) {
  if (!excludeModalTab.value) return;
  postMessage({
    command: 'saveTabExclude',
    tabId: excludeModalTab.value.id,
    exclude
  });
}

function onWindowMessage(event: MessageEvent) {
  const msg = event.data;
  if (!msg) return;

  if (msg.type === 'stateUpdate') {
    const newTabId = msg.activeTabId || (msg.bar?.tabs?.[0]?.id ?? null);
    if (activeTabId.value !== newTabId) {
      // Clear cache on tab switch so inactive tabs do not consume memory
      dirCache.value = new Map();
    }
    currentBar.value = msg.bar;
    activeTabId.value = newTabId;

    const tab = currentBar.value?.tabs?.find((t) => t.id === activeTabId.value);
    if (tab) {
      const expList = Array.isArray(tab.expandedFolders) && tab.expandedFolders.length > 0
        ? tab.expandedFolders
        : (tab.folders || []).map((f) => f.path);
      const set = new Set(expList.map(norm));
      expandedDirs.value = set;

      // Fetch directory contents only for active tab expanded folders
      for (const f of expList) {
        postMessage({ command: 'readDir', dirPath: f });
      }
    } else {
      expandedDirs.value = new Set();
    }
  } else if (msg.type === 'dirContents') {
    const normDir = norm(msg.dirPath);
    const tab = activeTab.value;
    if (tab && tab.folders && tab.folders.length > 0) {
      const belongsToActiveTab = tab.folders.some((f) => isPathInside(msg.dirPath, f.path));
      if (!belongsToActiveTab) {
        // Ignore stale or background responses
        return;
      }
    }
    const nextMap = new Map(dirCache.value);
    nextMap.set(normDir, msg.items);
    dirCache.value = nextMap;

    if (!firstDirLogged) {
      firstDirLogged = true;
      const totalMs = Math.round(performance.now() - mountStart);
      console.log(`[Custom Explorers Perf] Webview tree rendered in ${totalMs}ms (disk read: ${msg.perf?.diskReadMs ?? '?'}ms)`);
    }
  }
}

onMounted(() => {
  if (isManager.value) return;
  window.addEventListener('message', onWindowMessage);
  window.addEventListener('click', closeContextMenu);
  postMessage({ command: 'getInitialState' });
});

onUnmounted(() => {
  if (isManager.value) return;
  window.removeEventListener('message', onWindowMessage);
  window.removeEventListener('click', closeContextMenu);
});
</script>

<template>
  <ManagerDashboard v-if="isManager" />
  <div v-else class="explorer-app" @click="closeContextMenu">
    <TabsHeader
      v-if="currentBar && currentBar.tabs && currentBar.tabs.length > 0"
      :tabs="currentBar.tabs"
      :active-tab-id="activeTabId"
      @show-context-menu="openContextMenu"
    />

    <FileTree
      :active-tab="activeTab"
      :expanded-dirs="expandedDirs"
      :dir-cache="dirCache"
      @toggle-expand="toggleExpand"
      @show-context-menu="openContextMenu"
    />

    <ContextMenu
      :menu-state="contextMenuState"
      @close="closeContextMenu"
      @open-exclude-modal="openExcludeModal"
    />

    <ExcludeModal
      :visible="excludeModalVisible"
      :bar-title="currentBar?.iconLabel || currentBar?.title || 'Explorer'"
      :tab="excludeModalTab"
      @close="excludeModalVisible = false"
      @save="onSaveExclude"
    />
  </div>
</template>

<style>
* {
  box-sizing: border-box;
}

body, html {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  user-select: none;
}

.explorer-app {
  font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif);
  font-size: 13px;
  color: var(--vscode-foreground);
  background-color: var(--vscode-sideBar-background, #181818);
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>

