// appStore.ts → useSecureStore.ts 로 통합됨. 하위 호환 re-export
export { useSecureStore as useAppStore } from './useSecureStore';
export type { SeverityFilter, ViewMode, RightTab } from './useSecureStore';
