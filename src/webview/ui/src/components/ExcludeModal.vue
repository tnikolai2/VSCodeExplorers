<script setup vapor lang="ts">
import { ref, watch } from 'vue';
import type { TabConfig, TabExcludeConfig } from '../types';
import { ICONS } from '../icons';

const props = defineProps<{
  visible: boolean;
  barTitle: string;
  tab: TabConfig | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'save', exclude: TabExcludeConfig): void;
}>();

const isInherit = ref(true);
const patternsText = ref('');

watch(
  () => props.visible,
  (val) => {
    if (val && props.tab) {
      const ex = props.tab.exclude;
      isInherit.value = ex ? ex.mode === 'inherit' : true;
      patternsText.value = ex && ex.patterns ? ex.patterns.join('\n') : '';
    }
  },
  { immediate: true }
);

function onSave() {
  const patterns = patternsText.value
    .split(/[\r\n,]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  emit('save', {
    mode: isInherit.value ? 'inherit' : 'custom',
    patterns,
    hideExcluded: true
  });
  emit('close');
}

function onCancel() {
  emit('close');
}
</script>

<template>
  <div v-if="props.visible && props.tab" class="modal-backdrop" @click="onCancel">
    <div class="modal-dialog" @click.stop>
      <!-- Close button / Header bar -->
      <div class="modal-top">
        <span class="modal-title">Exclude Rules</span>
        <button class="close-btn" @click="onCancel" title="Close" v-html="ICONS.close"></button>
      </div>

      <!-- Строка 1: Имя Bar -->
      <div class="modal-row">
        <span class="row-label">Bar:</span>
        <span class="row-value">{{ props.barTitle }}</span>
      </div>

      <!-- Строка 2: Имя Таба -->
      <div class="modal-row">
        <span class="row-label">Tab:</span>
        <span class="row-value tab-highlight">{{ props.tab.title }}</span>
      </div>

      <!-- Строка 3: Checkbox Inherit -->
      <div class="modal-row checkbox-row">
        <label class="checkbox-label">
          <input type="checkbox" v-model="isInherit" />
          <span class="checkbox-text">Inherit</span>
        </label>
      </div>

      <!-- Строка 4: Textbox (построчно) -->
      <div class="modal-row textarea-row">
        <textarea
          v-model="patternsText"
          class="textbox-area"
          placeholder="node_modules&#10;*.log&#10;dist&#10;.git"
          rows="4"
          @keydown.esc="onCancel"
          autofocus
        ></textarea>
      </div>

      <!-- Actions -->
      <div class="modal-actions">
        <button class="btn-cancel" @click="onCancel">Cancel</button>
        <button class="btn-save" @click="onSave">Save</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.45);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  box-sizing: border-box;
}

.modal-dialog {
  background-color: var(--vscode-editor-background, #1e1e1e);
  color: var(--vscode-foreground, #cccccc);
  border: 1px solid var(--vscode-widget-border, rgba(128, 128, 128, 0.35));
  border-radius: 4px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.45);
  width: 100%;
  max-width: 280px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-sizing: border-box;
}

.modal-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--vscode-widget-border, rgba(128, 128, 128, 0.2));
  padding-bottom: 6px;
  margin-bottom: 2px;
}

.modal-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--vscode-foreground);
}

.close-btn {
  background: none;
  border: none;
  color: var(--vscode-descriptionForeground, #999);
  cursor: pointer;
  padding: 2px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.close-btn:hover {
  color: var(--vscode-foreground, #fff);
}

.modal-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.row-label {
  font-size: 11px;
  color: var(--vscode-descriptionForeground, rgba(255, 255, 255, 0.6));
  min-width: 32px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.row-value {
  font-size: 12px;
  font-weight: 500;
  color: var(--vscode-foreground);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tab-highlight {
  color: var(--vscode-textLink-foreground, #3794ff);
  font-weight: 600;
}

.checkbox-row {
  margin-top: 2px;
}

.checkbox-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  cursor: pointer;
}

.checkbox-text {
  user-select: none;
}

.textarea-row {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 4px;
}

.textbox-area {
  background-color: var(--vscode-input-background, #252526);
  color: var(--vscode-input-foreground, #cccccc);
  border: 1px solid var(--vscode-input-border, rgba(128, 128, 128, 0.35));
  border-radius: 2px;
  padding: 6px 8px;
  font-size: 12px;
  font-family: var(--vscode-editor-font-family, monospace);
  line-height: 1.4;
  outline: none;
  width: 100%;
  resize: vertical;
  min-height: 72px;
  box-sizing: border-box;
}

.textbox-area:focus {
  border-color: var(--vscode-focusBorder, #007acc);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 4px;
}

.btn-cancel {
  padding: 4px 10px;
  background: transparent;
  color: var(--vscode-foreground, #cccccc);
  border: 1px solid var(--vscode-widget-border, rgba(128, 128, 128, 0.35));
  border-radius: 2px;
  font-size: 11px;
  cursor: pointer;
}
.btn-cancel:hover {
  background-color: rgba(128, 128, 128, 0.1);
}

.btn-save {
  padding: 4px 12px;
  background-color: var(--vscode-button-background, #0e639c);
  color: var(--vscode-button-foreground, #ffffff);
  border: none;
  border-radius: 2px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
}
.btn-save:hover {
  background-color: var(--vscode-button-hoverBackground, #1177bb);
}
</style>
