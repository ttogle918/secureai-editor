import { useSecureStore } from '@/store/useSecureStore';
import ko from '@/locales/ko.json';
import en from '@/locales/en.json';

const translations: Record<string, any> = {
  ko,
  en,
  // Add more languages as they are defined, falling back to English
  ja: en,
  zh: en,
  es: en,
  de: en,
};

export function useTranslation() {
  const lang = useSecureStore((s) => s.displayLanguage) || 'en';
  const currentLang = translations[lang] || translations['en'];

  const t = (key: string, defaultValue?: string) => {
    const keys = key.split('.');
    let result = currentLang;

    for (const k of keys) {
      if (result && typeof result === 'object' && k in result) {
        result = result[k];
      } else {
        return defaultValue || key;
      }
    }
    return result as string;
  };

  return { t, lang };
}
