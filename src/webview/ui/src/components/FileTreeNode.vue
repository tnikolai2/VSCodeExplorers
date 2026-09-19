<script setup vapor lang="ts">
import { computed } from 'vue';
import type { DirItem, ContextMenuTarget } from '../types';
import { ICONS, getFileIcon } from '../icons';
import { postMessage, norm, getFolderDisplayName } from '../vscode';

const props = withDefaults(
  defineProps<{
    item: DirItem;
    isRoot?: boolean;
    rootLabel?: string;
    tabId?: string;
    expandedDirs: Set<string>;
    dirCache: Map<string, DirItem[]>;
  }>(),
  {
    isRoot: false
  }
);

const emit = defineEmits<{
  (e: 'toggleExpand', path: string): void;
  (e: 'showContextMenu', event: MouseEvent, target: ContextMenuTarget): void;
}>();

const normalizedPath = computed(() => norm(props.item.path));
const isExpanded = computed(() => props.item.isDirectory && props.expandedDirs.has(normalizedPath.value));

const children = computed<DirItem[] | undefined>(() => {
  if (!props.item.isDirectory) return undefined;
  return props.dirCache.get(normalizedPath.value);
});

const label = computed(() => {
  if (props.isRoot) {
    if (props.rootLabel && props.rootLabel.trim()) return props.rootLabel;
    return getFolderDisplayName(props.item.path);
  }
  return props.item.name || getFolderDisplayName(props.item.path);
});

function onClick() {
  if (props.item.isDirectory) {
    emit('toggleExpand', props.item.path);
  } else {
    postMessage({ command: 'openFile', filePath: props.item.path });
  }
}

function onRemoveRoot(e: MouseEvent) {
  e.stopPropagation();
  if (props.tabId) {
    postMessage({
      command: 'removeFolder',
      tabId: props.tabId,
      folderPath: props.item.path
    });
  }
}

function onContextMenu(e: MouseEvent) {
  e.preventDefault();
  e.stopPropagation();
  emit('showContextMenu', e, {
    path: props.item.path,
    isDirectory: props.item.isDirectory,
    isRoot: props.isRoot,
    tabId: props.tabId
  });
}
</script>

<template>
  <div>
    <div
      class="tree-item"
      :class="{ 'root-folder': props.isRoot }"
      :title="props.item.path"
      @click="onClick"
      @contextmenu="onContextMenu"
    >
      <span
        v-if="props.item.isDirectory"
        class="item-toggle"
        :class="{ open: isExpanded }"
        v-html="ICONS.chevron"
      ></span>
      <span v-else class="item-toggle-spacer"></span>

      <span
        class="item-icon"
        v-html="
          props.item.isDirectory
            ? isExpanded
              ? ICONS.folderOpened
              : ICONS.folderClosed
            : getFileIcon(props.item.name)
        "
      ></span>

      <span class="item-label">{{ label }}</span>

      <span
        v-if="props.isRoot"
        class="item-remove"
        title="Remove folder from tab"
        v-html="ICONS.close"
        @click="onRemoveRoot"
      ></span>
    </div>

    <!-- Recursive children -->
    <div v-if="props.item.isDirectory && isExpanded" class="tree-children">
      <div v-if="children === undefined" class="tree-loading">
        Loading...
      </div>
      <div v-else-if="children.length === 0" class="tree-empty">
        (empty)
      </div>
      <FileTreeNode
        v-for="child in children"
        :key="child.path"
        :item="child"
        :is-root="false"
        :tab-id="props.tabId"
        :expanded-dirs="props.expandedDirs"
        :dir-cache="props.dirCache"
        @toggle-expand="(p) => emit('toggleExpand', p)"
        @show-context-menu="(ev, t) => emit('showContextMenu', ev, t)"
      />
    </div>
  </div>
</template>

<style scoped>
.tree-item {
  display: flex;
  align-items: center;
  padding: 1px 6px;
  cursor: pointer;
  font-size: 13px;
  line-height: 22px;
  height: 22px;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  box-sizing: border-box;
}
.tree-item:hover {
  background-color: var(--vscode-list-hoverBackground, rgba(128, 128, 128, 0.1));
}
.tree-item.root-folder {
  font-weight: 600;
  background-color: rgba(128, 128, 128, 0.06);
  margin-top: 1px;
  margin-bottom: 1px;
}
.item-toggle {
  width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-right: 2px;
  opacity: 0.7;
  transform: rotate(0deg);
  transition: transform 0.12s ease;
  flex-shrink: 0;
}
.item-toggle.open {
  transform: rotate(90deg);
}
.item-toggle-spacer {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  margin-right: 2px;
}
.item-icon {
  margin-right: 6px;
  width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.item-label {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
}
.item-remove {
  display: none;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  opacity: 0.6;
  border-radius: 3px;
  flex-shrink: 0;
  margin-left: 4px;
}
.tree-item:hover .item-remove {
  display: inline-flex;
}
.item-remove:hover {
  opacity: 1;
  background: rgba(255, 0, 0, 0.25);
}
.tree-children {
  padding-left: 12px;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
}
.tree-empty,
.tree-loading {
  padding: 2px 6px 2px 18px;
  font-size: 12px;
  opacity: 0.5;
  font-style: italic;
}
</style>

