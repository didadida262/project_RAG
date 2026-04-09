/** 共享类型（对话与企业模型下拉等） */

export type ChatMessage = { role: 'user' | 'assistant'; content: string }

export type LlmModelOption = {
  path: string
  label: string
  active: boolean
}
