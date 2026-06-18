import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import cs from './locales/cs.json';
import en from './locales/en.json';

const LOCALE_STORAGE_KEY = 'bata-on-top-map-builder-locale';

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      cs: { translation: cs },
      en: { translation: en },
    },
    fallbackLng: 'cs',
    supportedLngs: ['cs', 'en'],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: LOCALE_STORAGE_KEY,
      caches: ['localStorage'],
      convertDetectedLanguage: (language: string) => {
        if (language.startsWith('cs')) {
          return 'cs';
        }

        if (language.startsWith('en')) {
          return 'en';
        }

        return 'cs';
      },
    },
  });

function syncDocumentLanguage(language: string) {
  document.documentElement.lang = language;
  document.title = i18n.t('meta.title');

  const descriptionMeta = document.querySelector('meta[name="description"]');

  if (descriptionMeta) {
    descriptionMeta.setAttribute('content', i18n.t('meta.description'));
  }
}

syncDocumentLanguage(i18n.language);

i18n.on('languageChanged', syncDocumentLanguage);

export default i18n;
