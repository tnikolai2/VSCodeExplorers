/**
 * Regular expression matching Windows drive roots, e.g. "C:", "c:\", "D:/", "E:\\"
 */
export const WINDOWS_DRIVE_ROOT_REGEX = /^[a-zA-Z]:[/\\]*$/;

/**
 * Returns true if the path represents a Windows drive root.
 */
export function isWindowsDriveRoot(p: string): boolean {
  if (!p) return false;
  return WINDOWS_DRIVE_ROOT_REGEX.test(p.trim());
}

/**
 * Returns true if the path represents a POSIX root directory (Linux / macOS "/").
 */
export function isPosixRoot(p: string): boolean {
  if (!p) return false;
  return /^\/+$/.test(p.trim());
}

/**
 * Normalizes a Windows drive root into a consistent format, e.g. "C:\" or "c:/"
 */
export function formatWindowsDriveRoot(p: string, separator: '\\' | '/' = '\\', upperCase: boolean = true): string {
  const trimmed = p.trim();
  const letter = upperCase ? trimmed.slice(0, 2).toUpperCase() : trimmed.slice(0, 2).toLowerCase();
  return letter + separator;
}

/**
 * Normalizes all path separators to forward slashes.
 * Preserves root paths properly ("/" stays "/", "C:\" becomes "c:/").
 */
export function normalizePath(p: string): string {
  if (!p) return '';
  const cleaned = p.replace(/\\/g, '/');
  if (isWindowsDriveRoot(cleaned)) {
    return formatWindowsDriveRoot(cleaned, '/', false);
  }
  if (isPosixRoot(cleaned)) {
    return '/';
  }
  return cleaned.replace(/\/+$/, '');
}

/**
 * Computes a human-readable display name for a folder on any OS.
 * Guaranteed to NEVER return an empty string for drive roots ("C:\") or POSIX roots ("/").
 */
export function getFolderDisplayName(p: string): string {
  if (!p) return '';
  const trimmed = p.trim();
  if (isWindowsDriveRoot(trimmed)) {
    return formatWindowsDriveRoot(trimmed, '\\', true);
  }
  if (isPosixRoot(trimmed)) {
    return '/';
  }
  const parts = trimmed.split(/[/\\]/).filter(Boolean);
  return parts.pop() || trimmed;
}

/**
 * Detects whether the current environment or target OS is Windows.
 * Works seamlessly in Node.js (Extension Host, build scripts, tests)
 * and Browser/Webview (via window.__VSCODE_PLATFORM__ or navigator).
 */
export function isWindowsPlatform(): boolean {
  if (typeof process !== 'undefined' && process?.platform) {
    return process.platform === 'win32';
  }
  const globalObj = typeof globalThis !== 'undefined' ? (globalThis as Record<string, any>) : undefined;
  if (globalObj) {
    if (globalObj.__VSCODE_PLATFORM__) {
      return globalObj.__VSCODE_PLATFORM__ === 'win32';
    }
    const nav = globalObj.navigator;
    if (nav?.platform && typeof nav.platform === 'string' && nav.platform.toLowerCase().includes('win')) {
      return true;
    }
  }
  return false;
}

/**
 * Returns a normalized path suitable for internal comparisons, cache keys, and Sets.
 * Respects OS case sensitivity (case-insensitive on Windows, case-sensitive on POSIX).
 */
export function normalizeForComparison(p: string): string {
  if (!p) return '';
  const norm = normalizePath(p);
  const isWindows = isWindowsPlatform() || WINDOWS_DRIVE_ROOT_REGEX.test(norm) || /^[a-zA-Z]:\//.test(norm);
  return isWindows ? norm.toLowerCase() : norm;
}

/**
 * Checks equality of two filesystem paths taking platform case sensitivity into account.
 */
export function isPathEqual(p1: string, p2: string): boolean {
  if (!p1 && !p2) return true;
  if (!p1 || !p2) return false;
  return normalizeForComparison(p1) === normalizeForComparison(p2);
}

/**
 * Safely joins a child item name to a parent path without creating double slashes
 * and preserving the separator style of the parent path.
 */
export function joinSubPath(parentPath: string, childName: string): string {
  if (!parentPath) return childName;
  if (!childName) return parentPath;

  const sep = parentPath.includes('/') && !parentPath.includes('\\') ? '/' : (isWindowsPlatform() ? '\\' : '/');
  const endsWithSep = parentPath.endsWith('/') || parentPath.endsWith('\\');
  return endsWithSep ? `${parentPath}${childName}` : `${parentPath}${sep}${childName}`;
}

/**
 * Checks if targetPath is equal to or located inside parentPath.
 * Case-insensitive comparison on Windows.
 */
export function isPathInside(targetPath: string, parentPath: string): boolean {
  if (!targetPath || !parentPath) return false;

  const normTarget = normalizeForComparison(targetPath);
  const normParent = normalizeForComparison(parentPath);

  if (normTarget === normParent) {
    return true;
  }

  const parentWithSlash = normParent.endsWith('/') ? normParent : normParent + '/';
  return normTarget.startsWith(parentWithSlash);
}

/**
 * Validates whether the given path is located within any of the allowed root directories.
 */
export function isPathAllowed(targetPath: string, allowedRoots: string[]): boolean {
  if (!targetPath || !allowedRoots || allowedRoots.length === 0) {
    return false;
  }
  return allowedRoots.some(root => isPathInside(targetPath, root));
}
