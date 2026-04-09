/// <reference types="vite/client" />

/* eslint-disable @typescript-eslint/no-unused-vars -- ambient declaration merging */
interface ImportMetaEnv {
  readonly VITE_API_URL?: string
}

/** Electron preload 注入，仅在桌面壳内存在 */
interface ElectronAPI {
  apiBaseUrl: string
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}
