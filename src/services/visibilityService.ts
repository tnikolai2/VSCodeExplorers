import * as vscode from 'vscode';
import { BarConfig, MAX_SLOTS } from '../models/types';
import { StorageService } from './storageService';

import { isPathInside, normalizeForComparison } from '../utils/pathUtils';

export class VisibilityService {
  private readonly _onDidChangeVisibility = new vscode.EventEmitter<void>();
  public readonly onDidChangeVisibility = this._onDidChangeVisibility.event;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly storageService: StorageService
  ) {
    // Listen to workspace folder changes (e.g. adding/removing project roots or switching projects)
    this.context.subscriptions.push(
      vscode.workspace.onDidChangeWorkspaceFolders(() => this.updateVisibility())
    );
    // Note: Creating/deleting tabs or adding/removing folders does NOT trigger updateVisibility(),
    // because if a user is actively configuring tabs/folders in a panel, the panel is needed and must not disappear.
  }

  /**
   * Normalizes a filesystem path for reliable cross-platform comparison.
   */
  public static normalizePath(fsPath: string): string {
    return normalizeForComparison(fsPath);
  }

  /**
   * Checks if a folder path belongs to any workspace folder.
   * Returns true if:
   * - folderPath is identical to a workspace folder
   * - folderPath is inside a workspace folder (subfolder)
   * - workspace folder is inside folderPath (parent folder)
   */
  public static isFolderInWorkspace(folderPath: string, workspaceFolders?: readonly vscode.WorkspaceFolder[]): boolean {
    if (!folderPath || !workspaceFolders || workspaceFolders.length === 0) {
      return false;
    }

    for (const wf of workspaceFolders) {
      if (!wf || !wf.uri || !wf.uri.fsPath) continue;
      // Child or parent containment using safe cross-platform pathUtils
      if (isPathInside(folderPath, wf.uri.fsPath) || isPathInside(wf.uri.fsPath, folderPath)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Evaluates visibility for a single Activity Bar slot.
   */
  public isBarVisible(bar: BarConfig, workspaceFolders?: readonly vscode.WorkspaceFolder[]): boolean {
    if (!bar.enabled) {
      return false;
    }

    // If filtering by workspace is turned off, any enabled bar is always visible!
    if (!this.storageService.getState().filterByWorkspace) {
      return true;
    }

    // Collect all folders configured across all tabs in this bar
    const allFolders: string[] = [];
    for (const tab of (bar.tabs || [])) {
      for (const folder of (tab.folders || [])) {
        if (folder && folder.path) {
          allFolders.push(folder.path);
        }
      }
    }

    // Requirement: Empty Activity Bars (where no folders are set) are always visible!
    if (allFolders.length === 0) {
      return true;
    }

    // If no workspace is open at all in VS Code -> always visible (so user can use it without an open project)
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return true;
    }

    // Requirement: Visible if at least one tab contains folders from the current workspace
    return allFolders.some(fPath => VisibilityService.isFolderInWorkspace(fPath, workspaceFolders));
  }

  /**
   * Recalculates and sets VS Code context keys for all slots.
   */
  public async updateVisibility(): Promise<void> {
    const state = this.storageService.getState();
    const wsFolders = vscode.workspace.workspaceFolders;

    for (let i = 1; i <= MAX_SLOTS; i++) {
      const bar = state.bars.find(b => b.slotIndex === i);
      const isVisible = bar ? this.isBarVisible(bar, wsFolders) : false;
      await vscode.commands.executeCommand('setContext', `customExplorer.bar${i}.visible`, isVisible);
    }

    this._onDidChangeVisibility.fire();
  }
}

