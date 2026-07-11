import en from './en/translation.json'
import ja from './ja/translation.json'

export const resources = {
    en: { translation: en },
    ja: { translation: ja }
}

export const languages: { code: string; label: string }[] = [
    { code: 'en', label: 'English' },
    { code: 'ja', label: '日本語' }
]
