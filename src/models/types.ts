export interface FolderConfig {
  path: string;
  label?: string;
}

export type ExcludeMode = 'inherit' | 'custom';

export interface TabExcludeConfig {
  mode: ExcludeMode;       // 'inherit': VS Code global files.exclude + custom patterns; 'custom': only custom patterns
  patterns: string[];      // List of glob patterns to exclude (e.g. ['node_modules', '.git', '*.tmp'])
  hideExcluded: boolean;   // Quick toggle to show or hide excluded items
}

export interface TabConfig {
  id: string;
  title: string;
  folders: FolderConfig[];
  exclude?: TabExcludeConfig;
  expandedFolders?: string[]; // Persistent list of expanded folder paths
}

export interface BarConfig {
  id: string;              // e.g. "bar-1" .. "bar-10"
  slotIndex: number;       // 1 .. 10
  title: string;           // Display name for this explorer (e.g. "Frontend", "Backend")
  enabled: boolean;        // Whether this slot is actively in use
  iconLabel: string;       // Characters drawn on icon (1-3 chars, e.g. "FE", "1")
  activeTabId?: string;    // Currently active tab ID
  tabs: TabConfig[];
}

export interface CustomExplorersState {
  version: number;
  filterByWorkspace?: boolean; // Whether to filter Activity Bar slots by current workspace
  bars: BarConfig[];
}

