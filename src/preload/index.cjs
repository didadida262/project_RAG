const { contextBridge } = require('electron')

const PREFIX = '--private-rag-api-base='

function readApiBaseUrl() {
  const hit = process.argv.find((a) => a.startsWith(PREFIX))
  if (hit) {
    try {
      return decodeURIComponent(hit.slice(PREFIX.length))
    } catch {
      return hit.slice(PREFIX.length)
    }
  }
  return 'http://127.0.0.1:8787'
}

contextBridge.exposeInMainWorld('electronAPI', {
  apiBaseUrl: readApiBaseUrl(),
})
