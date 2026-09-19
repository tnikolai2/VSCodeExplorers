import * as vscode from 'vscode';
import { StorageService } from '../services/storageService';
import { VisibilityService } from '../services/visibilityService';
import { IconGenerator } from '../services/iconGenerator';
import { getFolderDisplayName } from '../utils/pathUtils';

export class ManagerController {
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly storageService: StorageService,
    private readonly visibilityService: VisibilityService
  ) {}

  private _panel: vscode.WebviewPanel | undefined;

  /**
   * Main Manager Dashboard opened in a WebviewPanel.
   */
  public async showManager(): Promise<void> {
    if (this._panel) {
      this._panel.reveal(vscode.ViewColumn.One);
      this.sendManagerInitialState();
      return;
    }

    this._panel = vscode.window.createWebviewPanel(
      'customExplorersManager',
      'Containers Manager',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [this.context.extensionUri]
      }
    );

    this._panel.iconPath = vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'icons', 'explorer-1.svg');
    this._panel.webview.html = this.getHtmlForWebview(this._panel.webview);

    this._panel.webview.onDidReceiveMessage(async (message) => {
      try {
        if (message.command === 'getManagerInitialState') {
          this.sendManagerInitialState();
        } else if (message.command === 'saveManagerConfig') {
          await this.handleSaveManagerConfig(message);
        } else if (message.command === 'getDiagnostics') {
          const diag = await this.storageService.getStorageDiagnostics();
          this._panel?.webview.postMessage({ type: 'diagnosticsData', diagnostics: diag });
        } else if (message.command === 'cleanStorageTrash') {
          const res = await this.storageService.cleanStorageTrash(message.removeEmptyTabs === true);
          vscode.window.showInformationMessage(
            `Storage cleaned: removed ${res.removedStalePaths} orphan paths, ${res.removedEmptyTabs} empty tabs${res.cleanedLegacyKeys ? ', cleared legacy keys' : ''}.`
          );
          const diag = await this.storageService.getStorageDiagnostics();
          this._panel?.webview.postMessage({ type: 'diagnosticsData', diagnostics: diag });
        }
      } catch (err: any) {
        console.error(`[Custom Explorers Manager] Error handling "${message?.command}":`, err);
        vscode.window.showErrorMessage(`Manager error: ${err?.message || err}`);
      }
    });

    this._panel.onDidDispose(() => {
      this._panel = undefined;
    });
  }

  private sendManagerInitialState(): void {
    if (!this._panel) return;
    try {
      const state = this.storageService.getState();
      const slots = state.bars.map((bar) => ({
        slotIndex: bar.slotIndex,
        name: bar.enabled ? bar.name : '',
        tabsCount: bar.tabs?.length || 0
      }));

      this._panel.webview.postMessage({
        type: 'managerState',
        filterByWorkspace: Boolean(state.filterByWorkspace),
        slots
      });
    } catch (err: any) {
      console.error('[Custom Explorers Manager] Error sending initial state:', err);
    }
  }

  private async handleSaveManagerConfig(message: {
    filterByWorkspace: boolean;
    slots: Array<{ slotIndex: number; name: string }>;
  }): Promise<void> {
    try {
      const currentState = this.storageService.getState();
      const oldNames = new Map<number, string>();
      for (const b of currentState.bars) {
        oldNames.set(b.slotIndex, b.name);
      }

      await this.storageService.saveManagerSettings(message.filterByWorkspace, message.slots);

      for (const s of message.slots) {
        const oldName = oldNames.get(s.slotIndex);
        const cleanLabel = (s.name || '').trim().slice(0, 3).toUpperCase() || String(s.slotIndex);
        if (oldName !== cleanLabel) {
          try {
            await IconGenerator.saveSlotIcon(this.context.extensionPath, s.slotIndex, cleanLabel);
          } catch (iconErr) {
            console.warn(`[Custom Explorers] Unable to write icon for slot ${s.slotIndex} to extensionPath (read-only environment):`, iconErr);
          }
        }
      }

      await this.visibilityService.updateVisibility();
      vscode.window.showInformationMessage('Explorer settings saved.');
    } catch (err: any) {
      console.error('[Custom Explorers] Failed to save manager config:', err);
      vscode.window.showErrorMessage(`Failed to save settings: ${err?.message || err}`);
    }
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'index.js'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'index.css'));

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource};">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Containers Manager</title>
  <link rel="stylesheet" href="${styleUri}">
</head>
<body>
  <div id="app"></div>
  <script>
    window.EXPLORER_MODE = 'manager';
  </script>
  <script type="module" src="${scriptUri}"></script>
</body>
</html>`;
  }

  public async addTabFlow(slotIndex: number): Promise<void> {
    const title = await vscode.window.showInputBox({
      prompt: 'Enter name for the new tab',
      placeHolder: 'e.g. Components, Utils, Backend'
    });

    if (!title || !title.trim()) return;

    await this.storageService.addTab(slotIndex, title.trim());
  }

  public async addFolderFlow(slotIndex: number, tabId?: string): Promise<void> {
    const bar = this.storageService.getBar(slotIndex);
    if (!bar) return;

    let targetTabId = tabId;
    if (!targetTabId || !bar.tabs.some(t => t.id === targetTabId)) {
      targetTabId = bar.activeTabId;
    }
    if (!targetTabId || !bar.tabs.some(t => t.id === targetTabId)) {
      if (bar.tabs.length === 0) {
        const title = await vscode.window.showInputBox({
          prompt: 'Enter name for the new tab',
          placeHolder: 'e.g. Components, Utils, Backend'
        });
        if (!title || !title.trim()) return;
        const created = await this.storageService.addTab(slotIndex, title.trim());
        targetTabId = created?.id;
      } else {
        targetTabId = bar.tabs[0].id;
      }
    }
    if (!targetTabId) return;

    const sourceChoices: vscode.QuickPickItem[] = [
      {
        label: '$(root-folder) Current Workspace Folders',
        description: 'Choose a folder already open in VS Code'
      },
      {
        label: '$(folder-opened) Browse from Disk...',
        description: 'Select any folder from your computer via file dialog'
      }
    ];

    const source = await vscode.window.showQuickPick(sourceChoices, {
      placeHolder: 'Select folder source'
    });
    if (!source) return;

    if (source.label.includes('Current Workspace Folders')) {
      const wsFolders = vscode.workspace.workspaceFolders;
      if (!wsFolders || wsFolders.length === 0) {
        vscode.window.showInformationMessage('No workspace folders are currently open. Use "Browse from Disk..." instead.');
        return;
      }

      const folderPicks: vscode.QuickPickItem[] = wsFolders.map((wf) => ({
        label: wf.name,
        description: wf.uri.fsPath
      }));

      const picked = await vscode.window.showQuickPick(folderPicks, {
        placeHolder: 'Select workspace folder to add'
      });

      if (picked && picked.description) {
        const added = await this.storageService.addFolderToTab(slotIndex, targetTabId, picked.description, picked.label);
        if (!added) {
          vscode.window.showInformationMessage(`Folder "${picked.label || picked.description}" is already in this tab.`);
        }
      }
    } else {
      const uris = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: true,
        openLabel: 'Add Folder to Tab'
      });

      if (uris && uris.length > 0) {
        for (const uri of uris) {
          const folderName = getFolderDisplayName(uri.fsPath);
          const added = await this.storageService.addFolderToTab(slotIndex, targetTabId, uri.fsPath, folderName);
          if (!added) {
            vscode.window.showInformationMessage(`Folder "${folderName}" is already in this tab.`);
          }
        }
      }
    }
  }

  public async configureExcludeRules(slotIndex: number, tabId: string): Promise<void> {
    const bar = this.storageService.getBar(slotIndex);
    if (!bar) return;

    const tab = bar.tabs.find((t) => t.id === tabId);
    if (!tab) return;

    if (!tab.exclude) {
      tab.exclude = { mode: 'inherit', patterns: [], hideExcluded: true, useGitIgnore: true };
    }

    const currentMode = tab.exclude.mode;
    const currentPatterns = tab.exclude.patterns.join(', ') || '(none)';
    const gitIgnoreActive = tab.exclude.useGitIgnore !== false;

    const items: vscode.QuickPickItem[] = [
      {
        label: `$(settings) Switch Mode: Current is "${currentMode}"`,
        description: currentMode === 'inherit'
          ? 'Uses VS Code files.exclude + tab patterns. Click to change to custom mode.'
          : 'Ignores VS Code files.exclude and uses only tab patterns. Click to change to inherit mode.'
      },
      {
        label: gitIgnoreActive ? '$(check) Gitignore: Active (Excluding .gitignore files)' : '$(circle-slash) Gitignore: Inactive (Showing .gitignore files)',
        description: 'Click to toggle .gitignore exclusion'
      },
      {
        label: '$(edit) Edit Custom Patterns',
        description: `Patterns: ${currentPatterns}`
      },
      {
        label: tab.exclude.hideExcluded ? '$(eye-closed) Toggle: Currently Hiding Excluded Files' : '$(eye) Toggle: Currently Showing All Files',
        description: 'Click to toggle showing/hiding excluded files'
      }
    ];

    const sel = await vscode.window.showQuickPick(items, {
      placeHolder: `Exclude Rules for Tab "${tab.title}"`
    });
    if (!sel) return;

    if (sel.label.includes('Switch Mode')) {
      tab.exclude.mode = tab.exclude.mode === 'inherit' ? 'custom' : 'inherit';
      await this.storageService.updateBar(bar);
      vscode.window.showInformationMessage(`Exclude mode changed to "${tab.exclude.mode}"`);
    } else if (sel.label.includes('Gitignore:')) {
      tab.exclude.useGitIgnore = !gitIgnoreActive;
      await this.storageService.updateBar(bar);
      vscode.window.showInformationMessage(tab.exclude.useGitIgnore ? 'Gitignore exclusion enabled' : 'Gitignore exclusion disabled');
    } else if (sel.label.includes('Edit Custom Patterns')) {
      const input = await vscode.window.showInputBox({
        prompt: 'Enter comma-separated glob patterns to exclude (e.g. node_modules, *.log, dist, .git)',
        value: tab.exclude.patterns.join(', ')
      });
      if (input !== undefined) {
        tab.exclude.patterns = input.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
        await this.storageService.updateBar(bar);
        vscode.window.showInformationMessage(`Patterns updated: ${tab.exclude.patterns.join(', ') || 'none'}`);
      }
    } else if (sel.label.includes('Toggle:')) {
      tab.exclude.hideExcluded = !tab.exclude.hideExcluded;
      await this.storageService.updateBar(bar);
      vscode.window.showInformationMessage(tab.exclude.hideExcluded ? 'Excluded files are now hidden' : 'All files are now shown');
    }
  }

  public async toggleTabExclude(slotIndex: number): Promise<void> {
    const bar = this.storageService.getBar(slotIndex);
    if (!bar) return;
    const tab = bar.tabs.find((t) => t.id === bar.activeTabId) || bar.tabs[0];
    if (!tab) return;

    if (!tab.exclude) {
      tab.exclude = { mode: 'inherit', patterns: [], hideExcluded: true, useGitIgnore: true };
    }

    tab.exclude.hideExcluded = !tab.exclude.hideExcluded;
    await this.storageService.updateBar(bar);
    vscode.window.showInformationMessage(
      tab.exclude.hideExcluded ? `Hidden files are now hidden for "${tab.title}"` : `Showing all files for "${tab.title}"`
    );
  }

  public async showDiagnosticsDialog(): Promise<void> {
    const diag = await this.storageService.getStorageDiagnostics();
    const details = [
      `Storage Size: ${diag.sizeBytes.toLocaleString()} bytes (${diag.sizeKb} KB)`,
      `Active Slots: ${diag.enabledSlots} / ${diag.totalSlots}`,
      `Total Tabs: ${diag.totalTabs} (Empty tabs without folders: ${diag.emptyTabs.length})`,
      `Total Folders Configured: ${diag.totalFolders}`,
      `Saved Expanded Folders: ${diag.totalExpanded}`,
      `Stale / Non-existent Paths: ${diag.staleExpandedPaths.length}`,
      `Duplicate Paths: ${diag.duplicateExpandedCount}`,
      `Legacy Storage Keys: ${diag.hasLegacyKeys ? 'Found' : 'Clean'}`
    ].join('\n• ');

    const choice = await vscode.window.showInformationMessage(
      `Custom Explorers Storage Diagnostics:\n• ${details}`,
      { modal: true },
      'Clean Storage Trash',
      'Open Manager'
    );

    if (choice === 'Clean Storage Trash') {
      const res = await this.storageService.cleanStorageTrash(false);
      vscode.window.showInformationMessage(
        `Storage cleaned: removed ${res.removedStalePaths} stale paths${res.cleanedLegacyKeys ? ', cleared legacy keys' : ''}.`
      );
    } else if (choice === 'Open Manager') {
      await this.showManager();
    }
  }
}
