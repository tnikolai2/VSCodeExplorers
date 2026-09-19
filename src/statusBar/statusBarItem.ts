import * as vscode from 'vscode';
import { StorageService } from '../services/storageService';

export class ExplorersStatusBarItem {
  private _statusBarItem: vscode.StatusBarItem;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly storageService: StorageService
  ) {
    this._statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 10);
    this._statusBarItem.command = 'customExplorer.manage';
    this._statusBarItem.text = '$(layers) Containers';
    this._statusBarItem.tooltip = 'Custom Explorers: Manage Containers';
    this._statusBarItem.show();

    this.context.subscriptions.push(this._statusBarItem);

    this.storageService.onDidChangeState(() => this.updateStatus());
    this.updateStatus();
  }

  private updateStatus(): void {
    const state = this.storageService.getState();
    const enabledCount = state.bars.filter(b => b.enabled).length;
    this._statusBarItem.text = `$(layers) Containers (${enabledCount})`;
    this._statusBarItem.tooltip = `Custom Explorers: ${enabledCount} active container(s). Click to manage.`;
  }
}

