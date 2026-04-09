/// <reference types="vite/client" />

/* eslint-disable @typescript-eslint/no-unused-vars -- ambient declaration merging */
interface ImportMetaEnv {
  /** 直连企业公网根地址（慎用：需 CORS）；不设则走本机反代 */
  readonly VITE_ENTERPRISE_API_URL?: string
  /** 本机 Express 反代地址，默认 http://127.0.0.1:8787 */
  readonly VITE_API_PROXY_URL?: string
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
