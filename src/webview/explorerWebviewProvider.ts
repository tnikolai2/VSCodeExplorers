import * as vscode from 'vscode';
import * as path from 'path';
import picomatch from 'picomatch';
import { StorageService } from '../services/storageService';
import { ManagerController } from '../manager/managerController';
import { BarConfig, TabConfig } from '../models/types';
import { isWindowsDriveRoot, formatWindowsDriveRoot, isPathAllowed, isPathInside, normalizeForComparison, joinSubPath, getFolderDisplayName } from '../utils/pathUtils';

export class ExplorerWebviewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private fileWatchers: vscode.Disposable[] = [];
  private fsDebounceTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    public readonly slotIndex: number,
    private readonly context: vscode.ExtensionContext,
    private readonly storageService: StorageService,
    private readonly managerController: ManagerController
  ) {
    this.storageService.onDidChangeState(() => {
      // Only refresh if this explorer bar is currently visible to the user
      if (this.visible) {
        this.updateWebview();
      }
    });

    // Listen for file operations within VS Code only if this view is visible
    this.context.subscriptions.push(
      vscode.workspace.onDidCreateFiles(e => {
        if (!this.visible) return;
        for (const file of e.files) {
          this.handleFileSystemChange(file.fsPath);
        }
      }),
      vscode.workspace.onDidDeleteFiles(e => {
        if (!this.visible) return;
        for (const file of e.files) {
          this.handleFileSystemChange(file.fsPath);
        }
      }),
      vscode.workspace.onDidRenameFiles(e => {
        if (!this.visible) return;
        for (const file of e.files) {
          this.handleFileSystemChange(file.oldUri.fsPath);
          this.handleFileSystemChange(file.newUri.fsPath);
        }
      })
    );
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri]
    };

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (data) => {
      await this.handleMessage(data);
    });

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this.updateWebview();
      } else {
        // When explorer is hidden/collapsed, shut down all watchers and pending timers to free CPU & memory
        this.disposeWatchersAndTimers();
      }
    });

    this.updateWebview();
  }

  public get visible(): boolean {
    return this._view?.visible ?? false;
  }

  public refresh(): void {
    if (this.visible) {
      this.updateWebview();
    }
  }

  private getBar(): BarConfig | undefined {
    return this.storageService.getBar(this.slotIndex);
  }

  public getActiveTab(): TabConfig | undefined {
    const bar = this.getBar();
    if (!bar || bar.tabs.length === 0) return undefined;
    if (bar.activeTabId) {
      const found = bar.tabs.find(t => t.id === bar.activeTabId);
      if (found) return found;
    }
    return bar.tabs[0];
  }

  private disposeFileWatchers(): void {
    for (const d of this.fileWatchers) {
      d.dispose();
    }
    this.fileWatchers = [];
  }

  private disposeWatchersAndTimers(): void {
    this.disposeFileWatchers();
    for (const timer of this.fsDebounceTimers.values()) {
      clearTimeout(timer);
    }
    this.fsDebounceTimers.clear();
  }

  /**
   * Watches file changes ONLY for the folders of the currently ACTIVE tab.
   * If the explorer is hidden, no watchers are created.
   */
  private updateFileWatchers(): void {
    this.disposeFileWatchers();

    if (!this.visible) {
      return;
    }

    const activeTab = this.getActiveTab();
    if (!activeTab || !activeTab.folders || activeTab.folders.length === 0) {
      return;
    }

    const onFsEvent = (uri: vscode.Uri) => {
      this.handleFileSystemChange(uri.fsPath);
    };

    for (const f of activeTab.folders) {
      try {
        let watchPath = f.path;
        if (isWindowsDriveRoot(watchPath)) {
          watchPath = formatWindowsDriveRoot(watchPath, '\\', true);
        }
        const folderUri = vscode.Uri.file(watchPath);
        const pattern = new vscode.RelativePattern(folderUri, '**/*');
        const watcher = vscode.workspace.createFileSystemWatcher(pattern);

        watcher.onDidCreate(onFsEvent, this, this.fileWatchers);
        watcher.onDidDelete(onFsEvent, this, this.fileWatchers);
        watcher.onDidChange(onFsEvent, this, this.fileWatchers);

        this.fileWatchers.push(watcher);
      } catch (err) {
        console.error(`Failed to watch folder ${f.path}:`, err);
      }
    }
  }

  /**
   * Checks whether the given directory belongs to the active tab
   * and is currently visible (a root folder or expanded by user).
   * Inactive tabs, closed subfolders, and other explorers are completely ignored.
   */
  private isFolderRelevantAndExpanded(dirPath: string): boolean {
    if (!this.visible) return false;

    const activeTab = this.getActiveTab();
    if (!activeTab || !activeTab.folders || activeTab.folders.length === 0) {
      return false;
    }

    // Must be equal to or inside one of the active tab root folders
    const isInsideActiveRoots = activeTab.folders.some(f => isPathInside(dirPath, f.path));
    if (!isInsideActiveRoots) {
      return false;
    }

    const normDir = normalizeForComparison(dirPath);
    const rootNorms = activeTab.folders.map(f => normalizeForComparison(f.path));
    const expandedList = (activeTab.expandedFolders || []).map(p => normalizeForComparison(p));

    // If it is one of the root folders:
    if (rootNorms.includes(normDir)) {
      return expandedList.length === 0 || expandedList.includes(normDir);
    }

    // For any nested subfolder, only refresh if it is currently expanded in the UI
    return expandedList.includes(normDir);
  }

  private handleFileSystemChange(changedPath: string): void {
    if (!this.visible) return;

    const parentDir = path.dirname(changedPath);
    if (!this.isFolderRelevantAndExpanded(parentDir)) {
      return;
    }

    const normParent = normalizeForComparison(parentDir);
    const existing = this.fsDebounceTimers.get(normParent);
    if (existing) {
      clearTimeout(existing);
    }

    this.fsDebounceTimers.set(normParent, setTimeout(async () => {
      this.fsDebounceTimers.delete(normParent);
      if (this.isFolderRelevantAndExpanded(parentDir)) {
        await this.readDirectoryAndReply(parentDir);
      }
    }, 150));
  }

  private updateWebview(): void {
    if (!this._view) return;
    const bar = this.getBar();
    if (!bar) return;

    const activeTab = this.getActiveTab();
    this._view.title = bar.iconLabel || bar.title;
    this._view.description = activeTab ? `[${activeTab.title}]` : '';

    if (this.visible) {
      this.updateFileWatchers();
    } else {
      this.disposeWatchersAndTimers();
    }

    this._view.webview.postMessage({
      type: 'stateUpdate',
      bar,
      activeTabId: activeTab?.id,
      expandedFolders: activeTab?.expandedFolders || []
    });
  }

  private async handleMessage(message: any): Promise<void> {
    try {
      const bar = this.getBar();
      if (!bar) return;

      switch (message.command) {
        case 'getInitialState':
          this.updateWebview();
          break;

        case 'refresh':
          this.refresh();
          break;

        case 'saveExpandedFolders':
          if (message.tabId && Array.isArray(message.expandedFolders)) {
            await this.storageService.setExpandedFolders(this.slotIndex, message.tabId, message.expandedFolders);
          }
          break;

        case 'switchTab':
          this.disposeWatchersAndTimers();
          await this.storageService.setActiveTab(this.slotIndex, message.tabId);
          this.updateWebview();
          break;

        case 'addTab':
          await this.managerController.addTabFlow(this.slotIndex);
          this.updateWebview();
          break;

        case 'deleteTab':
        case 'closeTab': {
          const tab = bar.tabs.find(t => t.id === message.tabId);
          const tabTitle = tab?.title || message.tabTitle || 'this tab';
          const hasFolders = tab && tab.folders && tab.folders.length > 0;
          if (hasFolders) {
            const conf = await vscode.window.showWarningMessage(
              `Delete tab "${tabTitle}" with ${tab.folders.length} folder${tab.folders.length > 1 ? 's' : ''}?`,
              'Delete',
              'Cancel'
            );
            if (conf !== 'Delete') {
              break;
            }
          }
          await this.storageService.deleteTab(this.slotIndex, message.tabId);
          this.updateWebview();
          break;
        }

        case 'renameTab': {
          const tab = bar.tabs.find(t => t.id === message.tabId);
          const currentTitle = message.currentTitle || tab?.title || '';
          const newName = await vscode.window.showInputBox({
            prompt: 'Enter new tab name',
            value: currentTitle
          });
          if (newName && newName.trim()) {
            await this.storageService.renameTab(this.slotIndex, message.tabId, newName.trim());
            this.updateWebview();
          }
          break;
        }

        case 'addFolder':
          await this.managerController.addFolderFlow(this.slotIndex, message.tabId);
          this.updateWebview();
          break;

        case 'removeFolder':
          await this.storageService.removeFolderFromTab(this.slotIndex, message.tabId, message.folderPath);
          this.updateWebview();
          break;

        case 'openFile':
          try {
            const uri = vscode.Uri.file(message.filePath);
            await vscode.commands.executeCommand('vscode.open', uri);
          } catch (err: any) {
            vscode.window.showErrorMessage(`Failed to open file: ${err?.message || err}`);
          }
          break;

        case 'readDir':
          await this.readDirectoryAndReply(message.dirPath);
          break;

        case 'toggleExclude':
          await this.managerController.toggleTabExclude(this.slotIndex);
          break;

        case 'configureExclude': {
          const targetTabId = message.tabId || this.getActiveTab()?.id;
          if (targetTabId) {
            await this.managerController.configureExcludeRules(this.slotIndex, targetTabId);
          }
          break;
        }

        case 'saveTabExclude': {
          const targetTabId = message.tabId || this.getActiveTab()?.id;
          if (targetTabId && message.exclude) {
            await this.storageService.setTabExclude(this.slotIndex, targetTabId, message.exclude);
          }
          break;
        }

        case 'newFile':
          await this.createNewItem(message.folderPath, false);
          break;

        case 'newFolder':
          await this.createNewItem(message.folderPath, true);
          break;

        case 'renameItem':
          await this.renameItem(message.itemPath);
          break;

        case 'deleteItem':
          await this.deleteItem(message.itemPath);
          break;

        case 'revealInOS':
          try {
            await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(message.itemPath));
          } catch (err: any) {
            vscode.window.showErrorMessage(`Failed to reveal in OS: ${err?.message || err}`);
          }
          break;

        case 'copyPath':
          try {
            await vscode.env.clipboard.writeText(message.itemPath);
            vscode.window.showInformationMessage(`Copied: ${message.itemPath}`);
          } catch (err: any) {
            vscode.window.showErrorMessage(`Failed to copy path: ${err?.message || err}`);
          }
          break;
      }
    } catch (err: any) {
      console.error(`[Custom Explorers] Error handling message "${message?.command}":`, err);
      vscode.window.showErrorMessage(`Custom Explorer error: ${err?.message || err}`);
    }
  }

  private isOperationAllowed(targetPath: string): boolean {
    const allowedRoots: string[] = [];
    const bar = this.getBar();
    if (bar) {
      for (const t of bar.tabs) {
        if (t.folders) {
          for (const f of t.folders) {
            allowedRoots.push(f.path);
          }
        }
      }
    }
    if (vscode.workspace.workspaceFolders) {
      for (const wf of vscode.workspace.workspaceFolders) {
        allowedRoots.push(wf.uri.fsPath);
      }
    }
    return isPathAllowed(targetPath, allowedRoots);
  }

  private async createNewItem(folderPath: string, isDir: boolean): Promise<void> {
    if (!this.isOperationAllowed(folderPath)) {
      vscode.window.showErrorMessage(`Operation blocked: target path is outside explorer scope: ${folderPath}`);
      return;
    }

    const name = await vscode.window.showInputBox({
      prompt: isDir ? 'Enter new folder name' : 'Enter new file name',
      placeHolder: isDir ? 'components' : 'index.ts'
    });
    if (!name?.trim()) return;
    const targetDir = vscode.Uri.file(folderPath);
    const targetUri = vscode.Uri.joinPath(targetDir, name.trim());
    try {
      if (isDir) {
        await vscode.workspace.fs.createDirectory(targetUri);
      } else {
        await vscode.workspace.fs.writeFile(targetUri, new Uint8Array());
        await vscode.commands.executeCommand('vscode.open', targetUri);
      }
      await this.readDirectoryAndReply(folderPath);
    } catch (err: any) {
      vscode.window.showErrorMessage(`Failed to create ${isDir ? 'folder' : 'file'} "${name.trim()}": ${err?.message || err}`);
    }
  }

  private async renameItem(itemPath: string): Promise<void> {
    if (!this.isOperationAllowed(itemPath)) {
      vscode.window.showErrorMessage(`Operation blocked: target path is outside explorer scope: ${itemPath}`);
      return;
    }

    const oldName = getFolderDisplayName(itemPath);
    const newName = await vscode.window.showInputBox({ prompt: 'Enter new name', value: oldName });
    if (!newName?.trim() || newName.trim() === oldName) return;
    try {
      const parentDir = vscode.Uri.file(path.dirname(itemPath));
      await vscode.workspace.fs.rename(vscode.Uri.file(itemPath), vscode.Uri.joinPath(parentDir, newName.trim()));
      await this.readDirectoryAndReply(path.dirname(itemPath));
    } catch (err: any) {
      vscode.window.showErrorMessage(`Failed to rename "${oldName}": ${err?.message || err}`);
    }
  }

  private async deleteItem(itemPath: string): Promise<void> {
    if (!this.isOperationAllowed(itemPath)) {
      vscode.window.showErrorMessage(`Operation blocked: target path is outside explorer scope: ${itemPath}`);
      return;
    }

    const name = getFolderDisplayName(itemPath);
    const conf = await vscode.window.showWarningMessage(`Delete "${name}"?`, { modal: true }, 'Delete');
    if (conf === 'Delete') {
      try {
        await vscode.workspace.fs.delete(vscode.Uri.file(itemPath), { recursive: true, useTrash: true });
        await this.readDirectoryAndReply(path.dirname(itemPath));
      } catch (err: any) {
        vscode.window.showErrorMessage(`Failed to delete "${name}": ${err?.message || err}`);
      }
    }
  }

  private async readDirectoryAndReply(dirPath: string): Promise<void> {
    if (!this._view) return;
    const startT = performance.now();
    try {
      let resolvedPath = dirPath;
      if (isWindowsDriveRoot(resolvedPath)) {
        resolvedPath = formatWindowsDriveRoot(resolvedPath, '\\', true);
      }
      const uri = vscode.Uri.file(resolvedPath);
      const entries = await vscode.workspace.fs.readDirectory(uri);
      const readElapsedMs = Math.round(performance.now() - startT);
      const activeTab = this.getActiveTab();
      const matcher = this.buildExcludeMatcher(activeTab);

      const folders: { name: string; path: string; isDirectory: boolean }[] = [];
      const files: { name: string; path: string; isDirectory: boolean }[] = [];

      for (const [name, fileType] of entries) {
        const itemPath = joinSubPath(resolvedPath, name);

        if (matcher && matcher(name, itemPath)) {
          continue;
        }

        if (fileType & vscode.FileType.Directory) {
          folders.push({ name, path: itemPath, isDirectory: true });
        } else {
          files.push({ name, path: itemPath, isDirectory: false });
        }
      }

      folders.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
      files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

      const totalElapsedMs = Math.round(performance.now() - startT);
      console.log(`[Custom Explorers Perf] Slot #${this.slotIndex} read "${resolvedPath}": disk ${readElapsedMs}ms, total ${totalElapsedMs}ms (${folders.length} dirs, ${files.length} files)`);

      this._view.webview.postMessage({
        type: 'dirContents',
        dirPath,
        items: [...folders, ...files],
        perf: { diskReadMs: readElapsedMs, totalMs: totalElapsedMs }
      });
    } catch (err: any) {
      console.error(`[Custom Explorers] Error reading directory ${dirPath}:`, err);
      vscode.window.showWarningMessage(`Could not read "${getFolderDisplayName(dirPath)}": ${err?.message || err}`);
      this._view.webview.postMessage({
        type: 'dirContents',
        dirPath,
        items: []
      });
    }
  }

  private buildExcludeMatcher(tab?: TabConfig): ((name: string, fsPath: string) => boolean) | null {
    if (!tab) return null;
    const excludeConfig = tab.exclude || { mode: 'inherit', patterns: [], hideExcluded: true };
    if (!excludeConfig.hideExcluded) return null;

    const patternsToMatch: string[] = [];
    if (excludeConfig.mode === 'inherit') {
      const vsExclude = vscode.workspace.getConfiguration('files', null).get<Record<string, boolean>>('exclude') || {};
      for (const [pattern, enabled] of Object.entries(vsExclude)) {
        if (enabled) patternsToMatch.push(pattern);
      }
    }
    if (excludeConfig.patterns && excludeConfig.patterns.length > 0) {
      patternsToMatch.push(...excludeConfig.patterns);
    }
    if (patternsToMatch.length === 0) return null;

    const normalizedPatterns = patternsToMatch.map(p => {
      let norm = p.replace(/\\/g, '/');
      if (!norm.startsWith('**/') && !norm.startsWith('*')) {
        return `**/${norm}`;
      }
      return norm;
    });

    const isMatch = picomatch(normalizedPatterns, { dot: true, nocase: process.platform === 'win32' });
    return (name: string, fsPath: string) => {
      const normalizedFsPath = fsPath.replace(/\\/g, '/');
      return isMatch(name) || isMatch(normalizedFsPath);
    };
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
  <title>Custom Explorer</title>
  <link rel="stylesheet" href="${styleUri}">
</head>
<body>
  <div id="app"></div>
  <script type="module" src="${scriptUri}"></script>
</body>
</html>`;
  }
}
