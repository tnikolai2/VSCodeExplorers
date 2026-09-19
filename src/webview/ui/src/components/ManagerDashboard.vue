<script setup vapor lang="ts">
import { ref, onMounted } from 'vue';
import { generateIconSvg, ICONS } from '../icons';
import { postMessage } from '../vscode';

export interface ManagerSlotConfig {
  slotIndex: number;
  name: string;
  tabsCount: number;
}

export interface DiagnosticsData {
  sizeBytes: number;
  sizeKb: string;
  totalSlots: number;
  enabledSlots: number;
  totalTabs: number;
  totalFolders: number;
  totalExpanded: number;
  emptyTabs: Array<{ slotIndex: number; barTitle: string; tabId: string; tabTitle: string }>;
  staleExpandedPaths: Array<{ slotIndex: number; tabTitle: string; path: string }>;
  duplicateExpandedCount: number;
  hasLegacyKeys: boolean;
}

const filterByWorkspace = ref(false);
const slots = ref<ManagerSlotConfig[]>([]);
const isSaving = ref(false);
const saveSuccess = ref(false);

const diagnostics = ref<DiagnosticsData | null>(null);
const isLoadingDiag = ref(false);
const diagResponseMs = ref<number | null>(null);
let reqStart = 0;

function fetchDiagnostics() {
  isLoadingDiag.value = true;
  reqStart = performance.now();
  postMessage({ command: 'getDiagnostics' });
}

function cleanTrash() {
  postMessage({ command: 'cleanStorageTrash', removeEmptyTabs: false });
}

onMounted(() => {
  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (msg && msg.type === 'managerState') {
      filterByWorkspace.value = Boolean(msg.filterByWorkspace);
      slots.value = msg.slots || [];
    } else if (msg && msg.type === 'diagnosticsData') {
      isLoadingDiag.value = false;
      diagResponseMs.value = Math.round(performance.now() - reqStart);
      diagnostics.value = msg.diagnostics;
    }
  });

  postMessage({ command: 'getManagerInitialState' });
  fetchDiagnostics();
});

function onSave() {
  isSaving.value = true;
  saveSuccess.value = false;

  postMessage({
    command: 'saveManagerConfig',
    filterByWorkspace: filterByWorkspace.value,
    slots: slots.value.map((s) => ({
      slotIndex: s.slotIndex,
      name: (s.name || '').trim().slice(0, 3).toUpperCase()
    }))
  });

  setTimeout(() => {
    isSaving.value = false;
    saveSuccess.value = true;
    setTimeout(() => {
      saveSuccess.value = false;
    }, 4000);
  }, 350);
}
</script>

<template>
  <div class="manager-container">
    <div class="manager-header">
      <div class="header-left">
        <h2>Activity Bar Explorers</h2>
        <div class="filter-toggle">
          <label class="checkbox-label">
            <input type="checkbox" v-model="filterByWorkspace" />
            <span class="checkbox-text">
              Filter Activity Bar by current workspace
            </span>
          </label>
          <div class="filter-hint">
            When unchecked, all configured explorers are always visible regardless of open workspace.
          </div>
        </div>
      </div>
      <div class="header-right">
        <button class="save-btn" :disabled="isSaving" @click="onSave">
          <span class="btn-svg-icon" v-html="ICONS.save"></span>
          <span>{{ isSaving ? 'Saving...' : 'Save' }}</span>
        </button>
        <span v-if="saveSuccess" class="save-success">Saved ✓</span>
      </div>
    </div>

    <div class="slots-header-note">
      <span class="hint-svg-icon" v-html="ICONS.lightbulb"></span>
      Activity Bar icons change only after reload.
    </div>

    <div class="slots-list">
      <div
        v-for="slot in slots"
        :key="slot.slotIndex"
        class="slot-card"
        :class="{ inactive: !slot.name || !slot.name.trim() }"
      >
        <div class="slot-number-col">
          <span class="slot-number">#{{ slot.slotIndex }}</span>
        </div>

        <div
          class="slot-icon-col"
          v-html="generateIconSvg(slot.name || String(slot.slotIndex))"
          title="Icon preview"
        ></div>

        <div class="slot-field-col">
          <label class="col-label">Name / Icon (1-3 chars):</label>
          <input
            type="text"
            v-model="slot.name"
            maxlength="3"
            class="input-box name-input"
            :placeholder="'Slot ' + slot.slotIndex + ' (leave empty to disable)'"
          />
        </div>

        <div class="slot-status-col">
          <span v-if="slot.name && slot.name.trim()" class="tabs-count-badge">
            {{ slot.tabsCount }} {{ slot.tabsCount === 1 ? 'tab' : 'tabs' }}
          </span>
          <span
            class="state-badge"
            :class="slot.name && slot.name.trim() ? 'badge-on' : 'badge-off'"
          >
            {{ slot.name && slot.name.trim() ? 'Active' : 'Disabled' }}
          </span>
        </div>
      </div>
    </div>

    <!-- Storage Diagnostics & Debug Section -->
    <div class="diagnostics-card">
      <div class="diag-header">
        <div class="diag-title-row">
          <span class="diag-title">
            <span class="title-svg-icon" v-html="ICONS.search"></span>
            Storage & Performance Diagnostics
          </span>
          <span v-if="diagResponseMs !== null" class="diag-perf-badge">
            <span class="badge-svg-icon" v-html="ICONS.bolt"></span> Ping: {{ diagResponseMs }}ms
          </span>
        </div>
        <div class="diag-actions">
          <button class="diag-btn" :disabled="isLoadingDiag" @click="fetchDiagnostics">
            {{ isLoadingDiag ? 'Checking...' : 'Refresh Metrics' }}
          </button>
          <button
            v-if="diagnostics && (diagnostics.staleExpandedPaths.length > 0 || diagnostics.hasLegacyKeys)"
            class="clean-btn"
            @click="cleanTrash"
            title="Remove non-existent paths from storage"
          >
            <span class="btn-svg-icon" v-html="ICONS.trash"></span> Clean Trash ({{ diagnostics.staleExpandedPaths.length }} stale)
          </button>
        </div>
      </div>

      <div v-if="diagnostics" class="diag-grid">
        <div class="diag-stat">
          <div class="stat-value">{{ diagnostics.sizeBytes.toLocaleString() }} B</div>
          <div class="stat-label">Storage Size ({{ diagnostics.sizeKb }} KB)</div>
        </div>
        <div class="diag-stat">
          <div class="stat-value">{{ diagnostics.enabledSlots }} / {{ diagnostics.totalSlots }}</div>
          <div class="stat-label">Active Slots</div>
        </div>
        <div class="diag-stat">
          <div class="stat-value">
            {{ diagnostics.totalTabs }}
            <span v-if="diagnostics.emptyTabs.length > 0" class="stat-warn">({{ diagnostics.emptyTabs.length }} empty)</span>
          </div>
          <div class="stat-label">Total Tabs</div>
        </div>
        <div class="diag-stat">
          <div class="stat-value">{{ diagnostics.totalFolders }}</div>
          <div class="stat-label">Configured Folders</div>
        </div>
        <div class="diag-stat">
          <div class="stat-value">{{ diagnostics.totalExpanded }}</div>
          <div class="stat-label">Expanded Folders Saved</div>
        </div>
        <div class="diag-stat">
          <div class="stat-value" :class="diagnostics.staleExpandedPaths.length > 0 ? 'val-warn' : 'val-ok'">
            {{ diagnostics.staleExpandedPaths.length === 0 ? '✓ Clean' : diagnostics.staleExpandedPaths.length + ' stale' }}
          </div>
          <div class="stat-label">Orphan / Missing Paths</div>
        </div>
      </div>
    </div>

    <div class="manager-footer-hint">
      <span class="hint-svg-icon" v-html="ICONS.lightbulb"></span>
      Tabs and folders are managed directly inside each Activity Bar explorer.
    </div>
  </div>
</template>

<style scoped>
.manager-container {
  padding: 20px 24px;
  max-width: 800px;
  margin: 0 auto;
  color: var(--vscode-foreground);
  font-family: var(--vscode-font-family, sans-serif);
  height: 100vh;
  overflow-y: auto;
  box-sizing: border-box;
}

.manager-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--vscode-widget-border, rgba(128, 128, 128, 0.25));
  gap: 16px;
}

.header-left h2 {
  margin: 0 0 10px 0;
  font-size: 18px;
  font-weight: 600;
}

.filter-toggle {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
}

.checkbox-label input[type="checkbox"] {
  cursor: pointer;
  width: 16px;
  height: 16px;
}

.filter-hint {
  font-size: 11px;
  color: var(--vscode-descriptionForeground, rgba(255, 255, 255, 0.6));
  padding-left: 24px;
}

.header-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  flex-shrink: 0;
}

.save-btn {
  padding: 8px 22px;
  background-color: var(--vscode-button-background, #0e639c);
  color: var(--vscode-button-foreground, #ffffff);
  border: none;
  border-radius: 3px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: background-color 0.15s ease;
}

.save-btn:hover:not(:disabled) {
  background-color: var(--vscode-button-hoverBackground, #1177bb);
}

.save-btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.save-success {
  font-size: 12px;
  color: #4ec9b0;
  font-weight: 500;
}

.slots-header-note {
  font-size: 12px;
  color: var(--vscode-descriptionForeground, rgba(255, 255, 255, 0.7));
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.slots-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.slot-card {
  display: flex;
  align-items: center;
  background-color: var(--vscode-editor-background, #1e1e1e);
  border: 1px solid var(--vscode-widget-border, rgba(128, 128, 128, 0.2));
  border-radius: 4px;
  padding: 8px 14px;
  gap: 14px;
  transition: border-color 0.15s ease, opacity 0.15s ease;
}

.slot-card:hover {
  border-color: var(--vscode-focusBorder, #007acc);
}

.slot-card.inactive {
  opacity: 0.5;
  background-color: rgba(128, 128, 128, 0.04);
}

.slot-number-col {
  flex-shrink: 0;
  min-width: 32px;
}

.slot-number {
  font-size: 13px;
  font-weight: 700;
  color: var(--vscode-foreground);
}

.slot-icon-col {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.slot-field-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.col-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--vscode-descriptionForeground, rgba(255, 255, 255, 0.55));
}

.input-box {
  background-color: var(--vscode-input-background, #252526);
  color: var(--vscode-input-foreground, #cccccc);
  border: 1px solid var(--vscode-input-border, rgba(128, 128, 128, 0.3));
  border-radius: 2px;
  padding: 6px 10px;
  font-size: 13px;
  font-family: inherit;
  outline: none;
  width: 100%;
  box-sizing: border-box;
}

.input-box:focus {
  border-color: var(--vscode-focusBorder, #007acc);
}

.name-input {
  text-transform: uppercase;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.slot-status-col {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.tabs-count-badge {
  font-size: 11px;
  color: var(--vscode-descriptionForeground, rgba(255, 255, 255, 0.6));
  background-color: rgba(128, 128, 128, 0.12);
  padding: 3px 8px;
  border-radius: 10px;
}

.state-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 3px;
  min-width: 55px;
  text-align: center;
}

.badge-on {
  background-color: rgba(78, 201, 176, 0.15);
  color: #4ec9b0;
}

.badge-off {
  background-color: rgba(128, 128, 128, 0.12);
  color: #777777;
}

.manager-footer-hint {
  margin-top: 24px;
  padding: 12px 16px;
  background-color: rgba(128, 128, 128, 0.08);
  border-radius: 4px;
  font-size: 12px;
  color: var(--vscode-descriptionForeground, rgba(255, 255, 255, 0.7));
  text-align: center;
}

/* Diagnostics card styles */
.diagnostics-card {
  margin-top: 24px;
  background-color: var(--vscode-editor-background, #1e1e1e);
  border: 1px solid var(--vscode-widget-border, rgba(128, 128, 128, 0.25));
  border-radius: 6px;
  padding: 16px 18px;
}

.diag-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
  flex-wrap: wrap;
  gap: 10px;
}

.diag-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.diag-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--vscode-foreground);
}

.diag-perf-badge {
  font-size: 11px;
  color: #4ec9b0;
  background-color: rgba(78, 201, 176, 0.12);
  padding: 2px 7px;
  border-radius: 10px;
}

.diag-actions {
  display: flex;
  gap: 8px;
}

.diag-btn {
  padding: 4px 10px;
  font-size: 11px;
  cursor: pointer;
  background-color: transparent;
  color: var(--vscode-button-background, #0e639c);
  border: 1px solid var(--vscode-button-background, #0e639c);
  border-radius: 3px;
}
.diag-btn:hover {
  background-color: rgba(14, 99, 156, 0.1);
}

.clean-btn {
  padding: 4px 10px;
  font-size: 11px;
  cursor: pointer;
  background-color: #d83b01;
  color: white;
  border: none;
  border-radius: 3px;
  font-weight: 500;
}
.clean-btn:hover {
  background-color: #ea4a1f;
}

.diag-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 10px;
}

.diag-stat {
  background-color: rgba(128, 128, 128, 0.06);
  padding: 10px 12px;
  border-radius: 4px;
}

.stat-value {
  font-size: 15px;
  font-weight: 600;
  color: var(--vscode-foreground);
  margin-bottom: 3px;
}

.stat-sub {
  font-size: 12px;
  font-weight: normal;
  color: var(--vscode-descriptionForeground, rgba(255, 255, 255, 0.6));
}

.stat-label {
  font-size: 11px;
  color: var(--vscode-descriptionForeground, rgba(255, 255, 255, 0.6));
}

.stat-warn {
  font-size: 11px;
  color: #cca700;
  font-weight: normal;
}

.val-ok {
  color: #4ec9b0 !important;
}

.val-warn {
  color: #f14c4c !important;
}

.btn-svg-icon,
.title-svg-icon,
.badge-svg-icon,
.hint-svg-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  vertical-align: middle;
}

.title-svg-icon {
  margin-right: 6px;
}

.btn-svg-icon {
  margin-right: 5px;
}

.badge-svg-icon {
  margin-right: 4px;
}

.hint-svg-icon {
  margin-right: 6px;
}
</style>
