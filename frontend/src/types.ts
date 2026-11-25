export type ThemeId = 'minimal' | 'tech' | 'editorial' | 'japanese' | 'developer' | 'business'
export interface Theme { id: ThemeId; name: string; en: string; description: string; color: string; bg: string; text: string; muted: string; border: string; accent: string }
