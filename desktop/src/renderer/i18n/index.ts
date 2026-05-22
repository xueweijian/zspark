import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import en from './locales/en.json'
import zhCN from './locales/zh-CN.json'

const isTest = typeof process !== 'undefined' && process.env && process.env.VITEST

if (!isTest) {
  i18n.use(LanguageDetector)
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      'zh-CN': { translation: zhCN },
    },
    ...(isTest ? { lng: 'en' } : {}),
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'zspark-language',
      caches: ['localStorage'],
    },
  })

export default i18n

