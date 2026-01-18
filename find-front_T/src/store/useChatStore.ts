import { create } from 'zustand'

interface ChatState {
  isOpen: boolean
  autoMessage: string | null
  toggleChat: () => void
  openChat: () => void
  closeChat: () => void
  sendAutoMessage: (message: string) => void
  clearAutoMessage: () => void
}

export const useChatStore = create<ChatState>((set) => ({
  isOpen: false,
  autoMessage: null,
  toggleChat: () => set((state) => ({ isOpen: !state.isOpen })),
  openChat: () => set({ isOpen: true }),
  closeChat: () => set({ isOpen: false }),
  sendAutoMessage: (message: string) => set({ isOpen: true, autoMessage: message }),
  clearAutoMessage: () => set({ autoMessage: null }),
}))

