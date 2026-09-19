import * as vscode from 'vscode';
import { BarConfig, CustomExplorersState, TabConfig, FolderConfig } from '../models/types';
import { isWindowsDriveRoot, formatWindowsDriveRoot, isPosixRoot, getFolderDisplayName, normalizePath, isPathEqual, normalizeForComparison } from '../utils/pathUtils';

const STORAGE_KEY = 'customExplorers.state';

export class StorageService {
  private _state: CustomExplorersState;
  private readonly _onDidChangeState = new vscode.EventEmitter<CustomExplorersState>();
  public readonly onDidChangeState = this._onDidChangeState.event;

  constructor(private readonly context: vscode.ExtensionContext) {
    this._state = this.loadState();
  }

  private loadState(): CustomExplorersState {
    try {
      const raw = this.context.globalState.get<CustomExplorersState>(STORAGE_KEY);
      if (raw && raw.bars && raw.bars.length === 10) {
        if (raw.filterByWorkspace === undefined) {
          raw.filterByWorkspace = false;
        }
        for (const b of raw.bars) {
          if (!b.tabs) b.tabs = [];
          for (let idx = 0; idx < b.tabs.length; idx++) {
            const t = b.tabs[idx];
            if (!t.folders) t.folders = [];
            if (!t.title || !t.title.trim()) {
              t.title = `Tab ${idx + 1}`;
            }
            for (const f of t.folders) {
              if (!f.label || !f.label.trim()) {
                f.label = getFolderDisplayName(f.path);
              }
            }
            if (t.expandedFolders && Array.isArray(t.expandedFolders)) {
              t.expandedFolders = Array.from(new Set(t.expandedFolders));
            }
          }
        }
        return raw;
      }
    } catch (err) {
      console.error('[Custom Explorers] Error loading state from globalState, resetting to defaults:', err);
    }

    // Initialize 10 slots
    const bars: BarConfig[] = [];
    for (let i = 1; i <= 10; i++) {
      bars.push({
        id: `bar-${i}`,
        slotIndex: i,
        title: `Explorer ${i}`,
        enabled: i === 1, // First explorer enabled by default
        iconLabel: String(i),
        activeTabId: undefined,
        tabs: []
      });
    }

    const initialState: CustomExplorersState = {
      version: 1,
      filterByWorkspace: false,
      bars
    };
    try {
      this.context.globalState.update(STORAGE_KEY, initialState);
    } catch (err) {
      console.error('[Custom Explorers] Error writing initial state to globalState:', err);
    }
    return initialState;
  }

  public getState(): CustomExplorersState {
    return this._state;
  }

  public async saveState(state: CustomExplorersState): Promise<void> {
    this._state = state;
    try {
      await this.context.globalState.update(STORAGE_KEY, state);
      this._onDidChangeState.fire(this._state);
    } catch (err: any) {
      console.error('[Custom Explorers] Error saving state:', err);
      vscode.window.showErrorMessage(`Failed to save Custom Explorers state: ${err?.message || err}`);
    }
  }

  public getBar(slotIndex: number): BarConfig | undefined {
    return this._state.bars.find(b => b.slotIndex === slotIndex);
  }

  public async updateBar(updatedBar: BarConfig): Promise<void> {
    const index = this._state.bars.findIndex(b => b.slotIndex === updatedBar.slotIndex);
    if (index !== -1) {
      this._state.bars[index] = updatedBar;
      await this.saveState(this._state);
    }
  }

  /**
   * Finds the first available disabled slot and enables it.
   */
  public async addBar(title?: string, iconLabel?: string): Promise<BarConfig | undefined> {
    const slot = this._state.bars.find(b => !b.enabled);
    if (!slot) {
      return undefined; // All 10 slots used
    }

    slot.enabled = true;
    slot.title = title || `Explorer ${slot.slotIndex}`;
    slot.iconLabel = iconLabel || String(slot.slotIndex);
    slot.tabs = [];
    slot.activeTabId = undefined;

    await this.saveState(this._state);
    return slot;
  }

  /**
   * Resets and disables a bar slot.
   */
  public async deleteBar(slotIndex: number): Promise<void> {
    const bar = this.getBar(slotIndex);
    if (!bar) return;

    bar.enabled = false;
    bar.title = `Explorer ${slotIndex}`;
    bar.iconLabel = String(slotIndex);
    bar.tabs = [];
    bar.activeTabId = undefined;

    await this.saveState(this._state);
  }

  public async addTab(slotIndex: number, title: string): Promise<TabConfig | undefined> {
    const bar = this.getBar(slotIndex);
    if (!bar) return undefined;

    const tabId = `tab-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newTab: TabConfig = {
      id: tabId,
      title,
      folders: [],
      exclude: {
        mode: 'inherit',
        patterns: [],
        hideExcluded: true
      }
    };

    bar.tabs.push(newTab);
    bar.activeTabId = tabId;

    await this.updateBar(bar);
    return newTab;
  }

  public async deleteTab(slotIndex: number, tabId: string): Promise<void> {
    const bar = this.getBar(slotIndex);
    if (!bar) return;

    bar.tabs = bar.tabs.filter(t => t.id !== tabId);
    if (bar.activeTabId === tabId) {
      bar.activeTabId = bar.tabs.length > 0 ? bar.tabs[0].id : undefined;
    }

    await this.updateBar(bar);
  }

  public async setActiveTab(slotIndex: number, tabId: string): Promise<void> {
    const bar = this.getBar(slotIndex);
    if (!bar) return;

    if (bar.activeTabId !== tabId) {
      bar.activeTabId = tabId;
      await this.updateBar(bar);
    }
  }

  public async renameTab(slotIndex: number, tabId: string, newTitle: string): Promise<void> {
    const bar = this.getBar(slotIndex);
    if (!bar) return;

    const tab = bar.tabs.find(t => t.id === tabId);
    if (tab) {
      tab.title = newTitle;
      await this.updateBar(bar);
    }
  }

  public async addFolderToTab(slotIndex: number, tabId: string, folderPath: string, label?: string): Promise<boolean> {
    const bar = this.getBar(slotIndex);
    if (!bar) return false;

    let tab = bar.tabs.find(t => t.id === tabId);
    if (!tab && bar.tabs.length > 0) {
      tab = bar.tabs.find(t => t.id === bar.activeTabId) || bar.tabs[0];
    }
    if (!tab) return false;

    if (!tab.folders) {
      tab.folders = [];
    }

    const exists = tab.folders.some(f => isPathEqual(f.path, folderPath));
    if (exists) {
      return false;
    }

    const cleanLabel = (label && label.trim()) || getFolderDisplayName(folderPath);
    tab.folders.push({ path: folderPath, label: cleanLabel });
    if (!tab.expandedFolders) tab.expandedFolders = [];
    if (!tab.expandedFolders.some(p => isPathEqual(p, folderPath))) {
      tab.expandedFolders.push(folderPath);
    }
    await this.updateBar(bar);
    return true;
  }

  public async removeFolderFromTab(slotIndex: number, tabId: string, folderPath: string): Promise<void> {
    const bar = this.getBar(slotIndex);
    if (!bar) return;

    let tab = bar.tabs.find(t => t.id === tabId);
    if (!tab && bar.tabs.length > 0) {
      tab = bar.tabs.find(t => t.id === bar.activeTabId) || bar.tabs[0];
    }
    if (!tab) return;
    if (!tab.folders) tab.folders = [];

    tab.folders = tab.folders.filter(f => !isPathEqual(f.path, folderPath));
    if (tab.expandedFolders) {
      tab.expandedFolders = tab.expandedFolders.filter(f => !isPathEqual(f, folderPath));
    }
    await this.updateBar(bar);
  }

  public async setExpandedFolders(slotIndex: number, tabId: string, expandedFolders: string[]): Promise<void> {
    const bar = this.getBar(slotIndex);
    if (!bar) return;

    const tab = bar.tabs.find(t => t.id === tabId);
    if (!tab) return;

    tab.expandedFolders = expandedFolders;
    await this.context.globalState.update(STORAGE_KEY, this._state);
  }

  public async saveManagerSettings(
    filterByWorkspace: boolean,
    updatedBars: Array<{ slotIndex: number; name: string }>
  ): Promise<void> {
    this._state.filterByWorkspace = filterByWorkspace;
    for (const u of updatedBars) {
      const bar = this.getBar(u.slotIndex);
      if (bar) {
        const trimmed = (u.name || '').trim().slice(0, 3).toUpperCase();
        if (trimmed) {
          bar.enabled = true;
          bar.title = trimmed;
          bar.iconLabel = trimmed;
        } else {
          bar.enabled = false;
          bar.title = `Explorer ${u.slotIndex}`;
          bar.iconLabel = String(u.slotIndex);
        }
      }
    }
    await this.saveState(this._state);
  }

  /**
   * Evaluates storage footprint, metrics, and garbage (stale paths, duplicates, empty tabs).
   */
  public async getStorageDiagnostics(): Promise<{
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
  }> {
    const rawJson = JSON.stringify(this._state);
    const sizeBytes = Buffer.byteLength(rawJson, 'utf8');
    const sizeKb = (sizeBytes / 1024).toFixed(2);

    let totalTabs = 0;
    let totalFolders = 0;
    let totalExpanded = 0;
    let duplicateExpandedCount = 0;
    const emptyTabs: Array<{ slotIndex: number; barTitle: string; tabId: string; tabTitle: string }> = [];
    const staleExpandedPaths: Array<{ slotIndex: number; tabTitle: string; path: string }> = [];

    const enabledSlots = this._state.bars.filter((b) => b.enabled).length;

    for (const bar of this._state.bars) {
      for (const tab of bar.tabs || []) {
        totalTabs++;
        if (!tab.folders || tab.folders.length === 0) {
          emptyTabs.push({
            slotIndex: bar.slotIndex,
            barTitle: bar.title,
            tabId: tab.id,
            tabTitle: tab.title
          });
        } else {
          totalFolders += tab.folders.length;
        }

        const exp = tab.expandedFolders || [];
        totalExpanded += exp.length;

        const seen = new Set<string>();
        for (const p of exp) {
          const compKey = normalizeForComparison(p);
          if (seen.has(compKey)) {
            duplicateExpandedCount++;
          }
          seen.add(compKey);

          // Check if path exists
          let checkPath = p;
          if (isWindowsDriveRoot(checkPath)) {
            checkPath = formatWindowsDriveRoot(checkPath, '\\', true);
          }
          try {
            await vscode.workspace.fs.stat(vscode.Uri.file(checkPath));
          } catch {
            staleExpandedPaths.push({
              slotIndex: bar.slotIndex,
              tabTitle: tab.title,
              path: p
            });
          }
        }
      }
    }

    const legacyTabs = this.context.globalState.get('customExplorers.tabs');
    const hasLegacyKeys = legacyTabs !== undefined;

    return {
      sizeBytes,
      sizeKb,
      totalSlots: this._state.bars.length,
      enabledSlots,
      totalTabs,
      totalFolders,
      totalExpanded,
      emptyTabs,
      staleExpandedPaths,
      duplicateExpandedCount,
      hasLegacyKeys
    };
  }

  /**
   * Cleans orphan/non-existent paths, deduplicates expanded folders, and clears legacy storage keys.
   */
  public async cleanStorageTrash(removeEmptyTabs = false): Promise<{
    removedStalePaths: number;
    removedEmptyTabs: number;
    cleanedLegacyKeys: boolean;
  }> {
    let removedStalePaths = 0;
    let removedEmptyTabs = 0;

    for (const bar of this._state.bars) {
      if (removeEmptyTabs && bar.tabs) {
        const initialCount = bar.tabs.length;
        bar.tabs = bar.tabs.filter((t) => t.folders && t.folders.length > 0);
        removedEmptyTabs += initialCount - bar.tabs.length;
        if (bar.activeTabId && !bar.tabs.some((t) => t.id === bar.activeTabId)) {
          bar.activeTabId = bar.tabs[0]?.id;
        }
      }

      for (const tab of bar.tabs || []) {
        if (!tab.expandedFolders) continue;

        const seen = new Set<string>();
        const uniqueList: string[] = [];

        for (const p of tab.expandedFolders) {
          const compKey = normalizeForComparison(p);
          if (!seen.has(compKey)) {
            seen.add(compKey);
            uniqueList.push(p);
          }
        }

        const validList: string[] = [];
        for (const p of uniqueList) {
          let checkPath = p;
          if (isWindowsDriveRoot(checkPath)) {
            checkPath = formatWindowsDriveRoot(checkPath, '\\', true);
          }
          try {
            await vscode.workspace.fs.stat(vscode.Uri.file(checkPath));
            validList.push(p);
          } catch {
            removedStalePaths++;
          }
        }

        tab.expandedFolders = validList;
      }
    }

    let cleanedLegacyKeys = false;
    if (this.context.globalState.get('customExplorers.tabs') !== undefined) {
      await this.context.globalState.update('customExplorers.tabs', undefined);
      cleanedLegacyKeys = true;
    }

    await this.saveState(this._state);
    return {
      removedStalePaths,
      removedEmptyTabs,
      cleanedLegacyKeys
    };
  }
}

