import i18n from "i18next";
import { initReactI18next } from 'react-i18next'
import LanguageDetector from "i18next-browser-languagedetector";

// Import translations
import enTranslation from "./locales/en.json";
import deTranslation from "./locales/de.json";
import esTranslation from "./locales/es.json";
import frTranslation from "./locales/fr.json";

const resources = {
  en: { translation: enTranslation },
  de: { translation: deTranslation },
  es: { translation: esTranslation },
  fr: { translation: frTranslation },
};

i18n
  .use(LanguageDetector) // detect language automatically
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
    },
  });

export default i18n;
