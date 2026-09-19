import * as assert from 'assert';
import * as path from 'path';

// Mock vscode module for standalone tests
const Module = require('module');
const origResolve = Module._resolveFilename;
Module._resolveFilename = function(request: string, parent: any, isMain: boolean) {
  if (request === 'vscode') {
    return 'vscode';
  }
  return origResolve.call(this, request, parent, isMain);
};

const origRequire = Module.prototype.require;
Module.prototype.require = function(request: string) {
  if (request === 'vscode') {
    return {
      EventEmitter: class {
        event = () => ({ dispose: () => {} });
        fire = () => {};
      },
      workspace: {
        onDidChangeWorkspaceFolders: () => ({ dispose: () => {} }),
        fs: {
          stat: async (uri: any) => {
            if (uri?.fsPath && uri.fsPath.includes('stale')) {
              throw new Error('File not found');
            }
            return { type: 1, ctime: 0, mtime: 0, size: 100 };
          }
        }
      },
      Uri: {
        file: (fsPath: string) => ({
          fsPath,
          path: fsPath.replace(/\\/g, '/'),
          scheme: 'file'
        }),
        parse: (uriStr: string) => ({
          fsPath: uriStr.replace(/^file:\/\//, ''),
          path: uriStr,
          scheme: 'file'
        })
      },
      commands: { executeCommand: async () => {} }
    };
  }
  return origRequire.apply(this, arguments);
};

const { VisibilityService } = require('../src/services/visibilityService');
const { IconGenerator } = require('../src/services/iconGenerator');
const { StorageService } = require('../src/services/storageService');
const {
  isWindowsDriveRoot,
  isPosixRoot,
  formatWindowsDriveRoot,
  normalizePath,
  normalizeForComparison,
  isPathEqual,
  joinSubPath,
  getFolderDisplayName,
  isPathInside,
  isPathAllowed
} = require('../src/utils/pathUtils');
import { BarConfig, MAX_SLOTS } from '../src/models/types';

console.log('--- RUNNING CUSTOM EXPLORERS VERIFICATION TESTS ---');

// Test 1: pathUtils module
console.log('Test 1: pathUtils functions');
assert.strictEqual(isWindowsDriveRoot('C:'), true, 'C: should be drive root');
assert.strictEqual(isWindowsDriveRoot('C:\\'), true, 'C:\\ should be drive root');
assert.strictEqual(isWindowsDriveRoot('d:/'), true, 'd:/ should be drive root');
assert.strictEqual(isWindowsDriveRoot('E:\\Projects'), false, 'E:\\Projects is not drive root');
assert.strictEqual(isWindowsDriveRoot('/home/user'), false, 'Unix path is not drive root');

assert.strictEqual(isPosixRoot('/'), true, '/ should be POSIX root');
assert.strictEqual(isPosixRoot('///'), true, '/// should be POSIX root');
assert.strictEqual(isPosixRoot('/home'), false, '/home is not POSIX root');

assert.strictEqual(formatWindowsDriveRoot('c:/', '\\', true), 'C:\\', 'formatWindowsDriveRoot format check');
assert.strictEqual(formatWindowsDriveRoot('C:\\', '/', false), 'c:/', 'formatWindowsDriveRoot lowercase check');

// normalizePath cross-platform checks
assert.strictEqual(normalizePath('C:\\'), 'c:/');
assert.strictEqual(normalizePath('C:'), 'c:/');
assert.strictEqual(normalizePath('c:/'), 'c:/');
assert.strictEqual(normalizePath('/'), '/');
assert.strictEqual(normalizePath('///'), '/');
assert.strictEqual(normalizePath('E:\\1\\utils\\VSCodeExplorers'), 'E:/1/utils/VSCodeExplorers');
assert.strictEqual(normalizePath('/home/user/project/'), '/home/user/project');

// joinSubPath checks
assert.strictEqual(joinSubPath('E:\\', 'folder'), 'E:\\folder', 'joinSubPath with Windows drive root backslash');
assert.strictEqual(joinSubPath('e:/', 'folder'), 'e:/folder', 'joinSubPath with slash root');
assert.strictEqual(joinSubPath('/', 'etc'), '/etc', 'joinSubPath with POSIX root');
assert.strictEqual(joinSubPath('/home/user', 'docs'), '/home/user/docs', 'joinSubPath POSIX subfolder');

// isPathEqual & normalizeForComparison checks
assert.strictEqual(isPathEqual('E:\\1\\utils', 'e:/1/utils'), true, 'isPathEqual Windows case insensitive');
assert.strictEqual(isPathEqual('E:\\', 'e:/'), true, 'isPathEqual drive root with slash');
assert.strictEqual(isPathEqual('E:', 'e:/'), true, 'isPathEqual drive letter without slash');

// getFolderDisplayName checks - must NEVER be empty for roots
assert.strictEqual(getFolderDisplayName('C:\\'), 'C:\\', 'Windows drive root display name');
assert.strictEqual(getFolderDisplayName('c:'), 'C:\\', 'Windows drive root display name');
assert.strictEqual(getFolderDisplayName('E:/'), 'E:\\', 'Windows drive root with forward slash display name');
assert.strictEqual(getFolderDisplayName('/'), '/', 'POSIX root display name');
assert.strictEqual(getFolderDisplayName('/home/user/myproject'), 'myproject', 'POSIX subfolder display name');
assert.strictEqual(getFolderDisplayName('E:\\1\\utils'), 'utils', 'Windows subfolder display name');

// isPathInside & isPathAllowed security and containment checks
assert.strictEqual(isPathInside('C:\\Users\\John', 'C:\\'), true, 'C:\\Users should be inside C:\\');
assert.strictEqual(isPathInside('E:\\Projects\\MyApp', 'E:\\'), true, 'Workspace should be inside E:\\ root');
assert.strictEqual(isPathInside('/home/user', '/'), true, '/home/user should be inside /');
assert.strictEqual(isPathInside('/', '/'), true, '/ should match /');
assert.strictEqual(isPathInside('C:\\', 'c:/'), true, 'C:\\ should match c:/');
assert.strictEqual(isPathInside('E:\\1\\utils\\file.ts', 'E:\\1\\utils'), true, 'File should be inside parent');
assert.strictEqual(isPathInside('E:\\1\\utils_other\\file.ts', 'E:\\1\\utils'), false, 'Sibling folder should not be inside');
assert.strictEqual(isPathAllowed('E:\\Projects\\MyApp\\src\\index.ts', ['E:\\Projects\\MyApp']), true, 'Allowed path check');
assert.strictEqual(isPathAllowed('C:\\Windows\\System32\\cmd.exe', ['E:\\Projects\\MyApp']), false, 'Outside path check blocked');

// Test 2: VisibilityService Path normalization
console.log('Test 2: VisibilityService Path normalization');
const norm1 = VisibilityService.normalizePath('E:\\1\\utils\\VSCodeExplorers\\');
const norm2 = VisibilityService.normalizePath('E:/1/utils/VSCodeExplorers');
assert.strictEqual(norm1, norm2, 'Normalized paths should match regardless of trailing slashes and slash direction');

// Test 3: isFolderInWorkspace
console.log('Test 3: isFolderInWorkspace matching logic');
const mockWorkspaceFolders = [
  { uri: { fsPath: 'E:\\Projects\\MyApp' }, name: 'MyApp', index: 0 },
  { uri: { fsPath: 'E:\\Projects\\SharedLibs' }, name: 'SharedLibs', index: 1 }
] as any;

assert.strictEqual(VisibilityService.isFolderInWorkspace('E:\\Projects\\MyApp', mockWorkspaceFolders), true);
assert.strictEqual(VisibilityService.isFolderInWorkspace('E:\\Projects\\MyApp\\src\\components', mockWorkspaceFolders), true);
assert.strictEqual(VisibilityService.isFolderInWorkspace('E:\\Projects\\SharedLibs\\utils', mockWorkspaceFolders), true);
assert.strictEqual(VisibilityService.isFolderInWorkspace('D:\\OtherProject\\docs', mockWorkspaceFolders), false);
assert.strictEqual(VisibilityService.isFolderInWorkspace('E:\\Projects', mockWorkspaceFolders), true);
assert.strictEqual(VisibilityService.isFolderInWorkspace('E:\\', mockWorkspaceFolders), true, 'E:\\ root should contain workspace');
assert.strictEqual(VisibilityService.isFolderInWorkspace('E:', mockWorkspaceFolders), true, 'E: without slash should contain workspace');

// Test 4: Bar Visibility Rules
console.log('Test 4: Bar Visibility Rules');
const mockStorage: any = {
  getState: () => ({ filterByWorkspace: true, bars: [] }),
  onDidChangeState: () => ({ dispose: () => {} })
};
const mockContext: any = { subscriptions: [] };
const visibilityService = new VisibilityService(mockContext, mockStorage);

const disabledBar: BarConfig = {
  id: 'bar-2',
  slotIndex: 2,
  name: '2',
  enabled: false,
  tabs: []
};
assert.strictEqual(visibilityService.isBarVisible(disabledBar, mockWorkspaceFolders), false);

const emptyBar: BarConfig = {
  id: 'bar-1',
  slotIndex: 1,
  name: '1',
  enabled: true,
  tabs: []
};
assert.strictEqual(visibilityService.isBarVisible(emptyBar, mockWorkspaceFolders), true, 'Empty enabled bar must be visible');

const matchingBar: BarConfig = {
  id: 'bar-1',
  slotIndex: 1,
  name: 'FE',
  enabled: true,
  tabs: [
    {
      id: 't1',
      title: 'Frontend',
      folders: [{ path: 'E:\\Projects\\MyApp\\src' }]
    }
  ]
};
assert.strictEqual(visibilityService.isBarVisible(matchingBar, mockWorkspaceFolders), true);

const otherProjectBar: BarConfig = {
  id: 'bar-3',
  slotIndex: 3,
  name: '3',
  enabled: true,
  tabs: [
    {
      id: 't1',
      title: 'Other',
      folders: [{ path: 'D:\\Work\\OldProject' }]
    }
  ]
};
assert.strictEqual(visibilityService.isBarVisible(otherProjectBar, mockWorkspaceFolders), false);

// Test 5: StorageService Unit Tests
console.log('Test 5: StorageService full lifecycle & trash cleanup');
class MockMemento {
  private store = new Map<string, any>();
  get<T>(key: string, defaultValue?: T): T {
    return this.store.has(key) ? this.store.get(key) : (defaultValue as any);
  }
  async update(key: string, value: any): Promise<void> {
    if (value === undefined) {
      this.store.delete(key);
    } else {
      this.store.set(key, value);
    }
  }
  keys(): readonly string[] {
    return Array.from(this.store.keys());
  }
}

async function testStorageService() {
  const mockGlobalState = new MockMemento();
  const storageContext: any = { globalState: mockGlobalState };
  const storageService = new StorageService(storageContext);

  // Initial state must have MAX_SLOTS bars
  const state = storageService.getState();
  assert.strictEqual(state.bars.length, MAX_SLOTS, `Must initialize ${MAX_SLOTS} explorer bars`);
  assert.strictEqual(state.bars[0].enabled, true, 'Slot 1 enabled by default');
  assert.strictEqual(state.bars[1].enabled, false, 'Slot 2 disabled by default');

  // Add tab to Slot 1
  const createdUiTab = await storageService.addTab(1, 'UI Components');
  assert.ok(createdUiTab, 'UI Components tab should be created');
  await storageService.addFolderToTab(1, createdUiTab!.id, 'E:\\Projects\\MyApp\\src\\components', 'components');
  const slot1 = storageService.getBar(1);
  assert.strictEqual(slot1?.tabs.length, 1, 'Slot 1 should have 1 tab');
  assert.strictEqual(slot1?.tabs[0].title, 'UI Components');
  assert.strictEqual(slot1?.tabs[0].folders.length, 1, 'Slot 1 tab should have 1 folder');

  // Set expanded folders with duplicate and stale paths
  await storageService.setExpandedFolders(1, slot1!.tabs[0].id, [
    'E:/Projects/MyApp/src/components',
    'e:/projects/myapp/src/components', // duplicate (different case)
    'C:/stale_folder' // stale path that will fail stat
  ]);

  // Add tab with root folders to test original path preservation and non-empty display name
  const rootsTabCreated = await storageService.addTab(1, 'Roots Tab');
  assert.ok(rootsTabCreated, 'Roots tab should be created');
  const addedWinRoot = await storageService.addFolderToTab(1, rootsTabCreated!.id, 'C:\\', '');
  assert.strictEqual(addedWinRoot, true, 'Adding C:\\ should succeed');
  const addedDuplicateWinRoot = await storageService.addFolderToTab(1, rootsTabCreated!.id, 'c:/', '');
  assert.strictEqual(addedDuplicateWinRoot, false, 'Adding duplicate C:/ with different slash/case should return false');

  const addedPosixRoot = await storageService.addFolderToTab(1, rootsTabCreated!.id, '/', '');
  assert.strictEqual(addedPosixRoot, true, 'Adding / should succeed');
  const addedDuplicatePosixRoot = await storageService.addFolderToTab(1, rootsTabCreated!.id, '///', '');
  assert.strictEqual(addedDuplicatePosixRoot, false, 'Adding duplicate POSIX root /// should return false');

  // Test fallback tabId when unknown tabId is passed
  const addedWithFallback = await storageService.addFolderToTab(1, 'non-existent-tab-id', 'E:\\ExtraFolder', 'Extra');
  assert.strictEqual(addedWithFallback, true, 'Adding with non-existent tabId should fall back to first/active tab');

  const slot1WithRoots = storageService.getBar(1);
  const rootsTab = slot1WithRoots?.tabs.find((t: any) => t.title === 'Roots Tab');
  assert.strictEqual(rootsTab?.folders[0].path, 'C:\\', 'Original Windows drive root path preserved');
  assert.strictEqual(rootsTab?.folders[0].label, 'C:\\', 'Windows drive root label must not be empty');
  assert.strictEqual(rootsTab?.folders[1].path, '/', 'Original POSIX root path preserved');
  assert.strictEqual(rootsTab?.folders[1].label, '/', 'POSIX root label must not be empty');

  // Run trash cleanup
  const result = await storageService.cleanStorageTrash(false);
  assert.strictEqual(result.removedStalePaths, 1, 'Should detect and remove 1 stale path');
  const updatedSlot = storageService.getBar(1);
  assert.strictEqual(updatedSlot?.tabs[0].expandedFolders?.length, 1, 'Expanded folders should be deduplicated & cleaned');
}

// Test 6: SVG Icon Generator
console.log('Test 6: SVG Icon Generator');
const svg1 = IconGenerator.generateSvg('1');
assert.ok(svg1.includes('<svg') && svg1.includes('>1<'), 'SVG must contain label "1"');
assert.ok(svg1.includes('mask="url(#folderMask'), 'SVG must use mask');

const svgFE = IconGenerator.generateSvg('FE');
assert.ok(svgFE.includes('>FE<'), 'SVG must contain label "FE"');

const svgAPI = IconGenerator.generateSvg('API');
assert.ok(svgAPI.includes('>API<'), 'SVG must contain label "API"');

// Test 7: Gitignore and Exclude rules merging logic
console.log('Test 7: Gitignore and Exclude rules');
const picomatch = require('picomatch');
const rawPatterns = ['node_modules/', '*.log', 'dist/', '.git', 'out'];
const normalized = rawPatterns.map((p) => {
  let norm = p.replace(/\\/g, '/');
  if (norm.endsWith('/')) norm = norm.slice(0, -1);
  if (norm.startsWith('/')) norm = norm.slice(1);
  if (!norm.startsWith('**/')) {
    norm = `**/${norm}`;
  }
  return norm;
});
const isMatch = picomatch(normalized, { dot: true, nocase: true });
const checkExclude = (name: string, fsPath: string) => isMatch(name) || isMatch(fsPath.replace(/\\/g, '/'));

assert.strictEqual(checkExclude('node_modules', 'E:/proj/node_modules'), true, 'node_modules should be excluded');
assert.strictEqual(checkExclude('dist', 'E:/proj/dist'), true, 'dist should be excluded');
assert.strictEqual(checkExclude('.git', 'E:/proj/.git'), true, '.git should be excluded');
assert.strictEqual(checkExclude('app.log', 'E:/proj/src/app.log'), true, '*.log should be excluded');
assert.strictEqual(checkExclude('index.ts', 'E:/proj/src/index.ts'), false, 'index.ts should not be excluded');

testStorageService().then(() => {
  console.log('--- ALL TESTS PASSED SUCCESSFULLY! ---');
}).catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
