declare function acquireVsCodeApi(): {
  postMessage(message: any): void;
  getState(): any;
  setState(state: any): void;
};

let vsCodeApi: ReturnType<typeof acquireVsCodeApi> | null = null;

export function getVsCodeApi() {
  if (!vsCodeApi) {
    vsCodeApi = acquireVsCodeApi();
  }
  return vsCodeApi;
}

export function postMessage(message: any) {
  getVsCodeApi().postMessage(message);
}

export function norm(p: string): string {
  if (!p) return '';
  const cleaned = p.replace(/\\/g, '/');
  // 1. Windows drive root: "C:", "c:\", "c:/", "C://" -> always "c:/"
  if (/^[a-zA-Z]:[/\\]*$/.test(cleaned)) {
    return cleaned.slice(0, 2).toLowerCase() + '/';
  }
  // 2. POSIX root: "/" or "///" -> always "/"
  if (/^\/+$/.test(cleaned)) {
    return '/';
  }
  // 3. Check if path starts with Windows drive letter (e.g. "C:/Users/...")
  const isWindows = /^[a-zA-Z]:\//.test(cleaned);
  const withoutTrailing = cleaned.replace(/\/+$/, '');
  return isWindows ? withoutTrailing.toLowerCase() : withoutTrailing;
}

export function getFolderDisplayName(p: string): string {
  if (!p) return '';
  const trimmed = p.trim();
  if (/^[a-zA-Z]:[/\\]*$/.test(trimmed)) {
    return trimmed.slice(0, 2).toUpperCase() + '\\';
  }
  if (/^\/+$/.test(trimmed)) {
    return '/';
  }
  const parts = trimmed.split(/[/\\]/).filter(Boolean);
  return parts.pop() || trimmed;
}

export function isPathInside(targetPath: string, parentPath: string): boolean {
  if (!targetPath || !parentPath) return false;
  const normTarget = norm(targetPath);
  const normParent = norm(parentPath);
  if (normTarget === normParent) return true;
  const parentWithSlash = normParent.endsWith('/') ? normParent : normParent + '/';
  return normTarget.startsWith(parentWithSlash);
}

