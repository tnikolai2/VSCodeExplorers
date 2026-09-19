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

export {
  normalizeForComparison as norm,
  getFolderDisplayName,
  isPathInside
} from '../../../utils/pathUtils';

