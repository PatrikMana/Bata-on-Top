import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getMenuItemClassName, useMenuKeys } from './useMenuKeys';

type PauseMenuModalProps = {
  menuKeysEnabled?: boolean;
  onLeaveLanguageMenu?: () => void;
  onResume: () => void;
  onRestart: () => void;
  onBackToMenu: () => void;
};

export function PauseMenuModal({
  menuKeysEnabled = true,
  onLeaveLanguageMenu,
  onResume,
  onRestart,
  onBackToMenu,
}: PauseMenuModalProps) {
  const { t } = useTranslation();

  const menuItems = useMemo(
    () => [
      { id: 'resume', onActivate: onResume },
      { id: 'restart', onActivate: onRestart },
      { id: 'menu', onActivate: onBackToMenu },
    ],
    [onBackToMenu, onRestart, onResume],
  );

  const { isFocused } = useMenuKeys({
    items: menuItems,
    enabled: menuKeysEnabled,
    onBack: onResume,
    onLeaveEnd: onLeaveLanguageMenu,
  });

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="panel pixel-panel pause-modal" role="dialog" aria-modal="true">
        <h1>{t('pause.title')}</h1>

        <div className="pause-actions">
          <button
            type="button"
            className={getMenuItemClassName('pixel-button primary-button', isFocused(0))}
            onClick={onResume}
          >
            {t('pause.resume')}
          </button>

          <button
            type="button"
            className={getMenuItemClassName('pixel-button secondary-button', isFocused(1))}
            onClick={onRestart}
          >
            {t('pause.restartRun')}
          </button>

          <button
            type="button"
            className={getMenuItemClassName('pixel-button ghost-button', isFocused(2))}
            onClick={onBackToMenu}
          >
            {t('common.backToMenu')}
          </button>
        </div>
      </section>
    </div>
  );
}
