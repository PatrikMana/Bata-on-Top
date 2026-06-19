import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n/i18n';
import { getMenuItemClassName, useMenuKeys } from './useMenuKeys';

type LanguageSwitcherProps = {
  className?: string;
  menuKeysEnabled?: boolean;
  onLeaveLanguageMenu?: () => void;
};

type AppLanguage = 'cs' | 'en';

export function LanguageSwitcher({
  className,
  menuKeysEnabled = false,
  onLeaveLanguageMenu,
}: LanguageSwitcherProps) {
  const { t, i18n: i18nInstance } = useTranslation();
  const activeLanguage: AppLanguage = i18nInstance.language.startsWith('en') ? 'en' : 'cs';

  const menuItems = useMemo(
    () => [
      { id: 'cs', onActivate: () => { void i18n.changeLanguage('cs'); } },
      { id: 'en', onActivate: () => { void i18n.changeLanguage('en'); } },
    ],
    [],
  );

  const { isFocused } = useMenuKeys({
    items: menuItems,
    layout: 'horizontal',
    enabled: menuKeysEnabled,
    onLeaveStart: onLeaveLanguageMenu,
  });

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
            className={getMenuItemClassName(
              `pixel-button language-toggle-option${activeLanguage === 'cs' ? ' is-active' : ''}`,
              menuKeysEnabled && isFocused(0),
            )}
            aria-pressed={activeLanguage === 'cs'}
            onClick={() => { void i18n.changeLanguage('cs'); }}
          >
            {t('language.cs')}
          </button>

          <button
            type="button"
            className={getMenuItemClassName(
              `pixel-button language-toggle-option${activeLanguage === 'en' ? ' is-active' : ''}`,
              menuKeysEnabled && isFocused(1),
            )}
            aria-pressed={activeLanguage === 'en'}
            onClick={() => { void i18n.changeLanguage('en'); }}
          >
            {t('language.en')}
          </button>
        </div>
      </div>
    </div>
  );
}
