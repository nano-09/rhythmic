import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from '../services/i18n';

const LanguageContext = createContext(null);
const LANG_STORAGE_KEY = 'syncbeats_language';

export function LanguageProvider({ children }) {
  // Japanese is default
  const [language, setLanguageState] = useState(() => {
    try {
      const stored = localStorage.getItem(LANG_STORAGE_KEY);
      if (stored && ['ja', 'ko', 'en'].includes(stored)) {
        return stored;
      }
    } catch (e) {}
    return 'ja';
  });

  const setLanguage = (newLang) => {
    if (!['ja', 'ko', 'en'].includes(newLang)) return;
    setLanguageState(newLang);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, newLang);
    } catch (e) {}
  };

  const t = (key, fallback = '') => {
    const dict = translations[language] || translations.ja;
    return dict[key] || translations.en[key] || fallback || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
