import * as vscode from 'vscode';
import { MAX_SLOTS } from './models/types';
import { StorageService } from './services/storageService';
import { VisibilityService } from './services/visibilityService';
import { ManagerController } from './manager/managerController';
import { ExplorersStatusBarItem } from './statusBar/statusBarItem';
import { ExplorerWebviewProvider } from './webview/explorerWebviewProvider';

export async function activate(context: vscode.ExtensionContext) {
  const extStart = performance.now();
  try {
    // 1. Initialize Services
    const storageService = new StorageService(context);
    const visibilityService = new VisibilityService(context, storageService);
    const managerController = new ManagerController(context, storageService, visibilityService);
    new ExplorersStatusBarItem(context, storageService);

    // 2. Register WebviewViewProviders for all slots
    const providers = new Map<number, ExplorerWebviewProvider>();
    for (let i = 1; i <= MAX_SLOTS; i++) {
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
      vscode.commands.registerCommand('customExplorer.loadDemoPreset', async () => {
        try {
          const p = require('path');
          const extPath = context.extensionPath;
          const { IconGenerator } = require('./services/iconGenerator');
          
          await IconGenerator.saveSlotIcon(extPath, 1, 'FE');
          await IconGenerator.saveSlotIcon(extPath, 2, 'API');
          await IconGenerator.saveSlotIcon(extPath, 3, 'DOC');

          const state = storageService.getState();
          state.filterByWorkspace = false;
          
          // Slot 1: Frontend
          state.bars[0].enabled = true;
          state.bars[0].name = 'FE';
          state.bars[0].tabs = [
            {
              id: 'tab-fe-components',
              title: 'Components',
              folders: [{ path: p.join(extPath, 'demo', 'Frontend', 'src', 'components'), label: 'components' }],
              expandedFolders: [p.join(extPath, 'demo', 'Frontend', 'src', 'components')],
              exclude: { mode: 'inherit', patterns: [], hideExcluded: true, useGitIgnore: true }
            },
            {
              id: 'tab-fe-stores',
              title: 'Stores',
              folders: [{ path: p.join(extPath, 'demo', 'Frontend', 'src', 'stores'), label: 'stores' }],
              expandedFolders: [p.join(extPath, 'demo', 'Frontend', 'src', 'stores')],
              exclude: { mode: 'inherit', patterns: [], hideExcluded: true, useGitIgnore: true }
            }
          ];
          state.bars[0].activeTabId = 'tab-fe-components';

          // Slot 2: Backend
          state.bars[1].enabled = true;
          state.bars[1].name = 'API';
          state.bars[1].tabs = [
            {
              id: 'tab-api-controllers',
              title: 'Controllers',
              folders: [{ path: p.join(extPath, 'demo', 'Backend', 'src', 'controllers'), label: 'controllers' }],
              expandedFolders: [p.join(extPath, 'demo', 'Backend', 'src', 'controllers')],
              exclude: { mode: 'inherit', patterns: [], hideExcluded: true, useGitIgnore: true }
            },
            {
              id: 'tab-api-models',
              title: 'Models',
              folders: [{ path: p.join(extPath, 'demo', 'Backend', 'src', 'models'), label: 'models' }],
              expandedFolders: [p.join(extPath, 'demo', 'Backend', 'src', 'models')],
              exclude: { mode: 'inherit', patterns: [], hideExcluded: true, useGitIgnore: true }
            }
          ];
          state.bars[1].activeTabId = 'tab-api-controllers';

          // Slot 3: Docs
          state.bars[2].enabled = true;
          state.bars[2].name = 'DOC';
          state.bars[2].tabs = [
            {
              id: 'tab-doc-architecture',
              title: 'Architecture',
              folders: [{ path: p.join(extPath, 'demo', 'Docs'), label: 'docs' }],
              expandedFolders: [p.join(extPath, 'demo', 'Docs')],
              exclude: { mode: 'inherit', patterns: [], hideExcluded: true, useGitIgnore: true }
            }
          ];
          state.bars[2].activeTabId = 'tab-doc-architecture';

          // Slots 4..10: disabled
          for (let i = 3; i < state.bars.length; i++) {
            state.bars[i].enabled = false;
            state.bars[i].tabs = [];
            state.bars[i].activeTabId = undefined;
          }

          await storageService.saveState(state);
          await visibilityService.updateVisibility();

          const selection = await vscode.window.showInformationMessage(
            'Demo preset loaded! Reload window to apply Activity Bar icons.',
            'Reload Window'
          );
          if (selection === 'Reload Window') {
            await vscode.commands.executeCommand('workbench.action.reloadWindow');
          }
        } catch (demoErr: any) {
          vscode.window.showErrorMessage(`Failed to load demo preset: ${demoErr?.message || demoErr}`);
        }
      }),
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
