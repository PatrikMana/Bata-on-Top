import { useTranslation } from 'react-i18next';
import i18n from '../i18n/i18n';

type LanguageSwitcherProps = {
  className?: string;
};

type AppLanguage = 'cs' | 'en';

export function LanguageSwitcher({ className }: LanguageSwitcherProps) {
  const { t, i18n: i18nInstance } = useTranslation();
  const activeLanguage: AppLanguage = i18nInstance.language.startsWith('en') ? 'en' : 'cs';

  function setLanguage(language: AppLanguage) {
    void i18n.changeLanguage(language);
  }

  return (
    <div
      className={className ?? 'language-switcher language-switcher--toggle-bottom'}
      role="group"
      aria-label={t('language.switchLabel')}
    >
      <div className="language-chrome language-chrome--toggle">
        <p className="language-chrome-eyebrow">{t('language.switchLabel')}</p>

        <div className="language-toggle-track" data-active={activeLanguage}>
          <span className="language-toggle-thumb" aria-hidden="true" />

          <button
            type="button"
            className={`pixel-button language-toggle-option${activeLanguage === 'cs' ? ' is-active' : ''}`}
            aria-pressed={activeLanguage === 'cs'}
            onClick={() => setLanguage('cs')}
          >
            {t('language.cs')}
          </button>

          <button
            type="button"
            className={`pixel-button language-toggle-option${activeLanguage === 'en' ? ' is-active' : ''}`}
            aria-pressed={activeLanguage === 'en'}
            onClick={() => setLanguage('en')}
          >
            {t('language.en')}
          </button>
        </div>
      </div>
    </div>
  );
}
