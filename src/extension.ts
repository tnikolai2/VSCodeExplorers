import * as vscode from 'vscode';
import { StorageService } from './services/storageService';
import { VisibilityService } from './services/visibilityService';
import { IconGenerator } from './services/iconGenerator';
import { ManagerController } from './manager/managerController';
import { ExplorersStatusBarItem } from './statusBar/statusBarItem';
import { ExplorerWebviewProvider } from './webview/explorerWebviewProvider';

export async function activate(context: vscode.ExtensionContext) {
  const extStart = performance.now();
  try {
    // 1. Ensure default SVG icons exist for all 10 slots
    await IconGenerator.initializeDefaultIcons(context.extensionPath);

    // 2. Initialize Services
    const storageService = new StorageService(context);
    const visibilityService = new VisibilityService(context, storageService);
    const managerController = new ManagerController(context, storageService, visibilityService);
    new ExplorersStatusBarItem(context, storageService);

    // Regenerate icons for any enabled bars to apply latest SVG design
    for (const b of storageService.getState().bars) {
      if (b.enabled) {
        await IconGenerator.saveSlotIcon(context.extensionPath, b.slotIndex, b.name);
      }
    }

    // 3. Register WebviewViewProviders for all 10 slots
    const providers = new Map<number, ExplorerWebviewProvider>();
    for (let i = 1; i <= 10; i++) {
      const provider = new ExplorerWebviewProvider(i, context, storageService, managerController);
      providers.set(i, provider);
      context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(`custom-explorer-view-${i}`, provider)
      );
    }

    // 4. Register Essential Commands
    context.subscriptions.push(
      vscode.commands.registerCommand('customExplorer.manage', () => managerController.showManager()),
      vscode.commands.registerCommand('customExplorer.diagnostics', () => managerController.showDiagnosticsDialog()),
      vscode.commands.registerCommand('customExplorer.refresh', (arg?: any) => {
        if (typeof arg === 'number' && providers.has(arg)) {
          providers.get(arg)?.refresh();
        } else {
          providers.forEach((p) => p.refresh());
        }
      })
    );

    // 5. Apply initial Activity Bar visibility
    await visibilityService.updateVisibility();
    console.log(`[Custom Explorers Perf] Extension activated in ${Math.round(performance.now() - extStart)}ms`);
  } catch (err: any) {
    console.error('[Custom Explorers] Activation error:', err);
    vscode.window.showErrorMessage(`Custom Explorers failed to activate: ${err?.message || err}`);
  }
}

export function deactivate() {}
