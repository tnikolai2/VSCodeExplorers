export interface FolderConfig {
  path: string;
  label?: string;
}

export type ExcludeMode = 'inherit' | 'custom';

export interface TabExcludeConfig {
  mode: ExcludeMode;
  patterns: string[];
  hideExcluded: boolean;
}

export interface TabConfig {
  id: string;
  title: string;
  folders: FolderConfig[];
  exclude?: TabExcludeConfig;
  expandedFolders?: string[];
}

export interface BarConfig {
  id: string;
  slotIndex: number;
  name: string;
  enabled: boolean;
  activeTabId?: string;
  tabs: TabConfig[];
}

export interface DirItem {
  name: string;
  path: string;
  isDirectory: boolean;
}

export interface ContextMenuTarget {
  path?: string;
  isDirectory?: boolean;
  isRoot?: boolean;
  tabId?: string;
  isTab?: boolean;
  isContainer?: boolean;
  isTabsHeader?: boolean;
}

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  target: ContextMenuTarget | null;
}

