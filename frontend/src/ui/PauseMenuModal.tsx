import { useTranslation } from 'react-i18next';

type PauseMenuModalProps = {
  onResume: () => void;
  onRestart: () => void;
  onBackToMenu: () => void;
};

export function PauseMenuModal({
  onResume,
  onRestart,
  onBackToMenu,
}: PauseMenuModalProps) {
  const { t } = useTranslation();

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="panel pixel-panel pause-modal" role="dialog" aria-modal="true">
        <h1>{t('pause.title')}</h1>

        <div className="pause-actions">
          <button type="button" className="pixel-button primary-button" onClick={onResume}>
            {t('pause.resume')}
          </button>

          <button type="button" className="pixel-button secondary-button" onClick={onRestart}>
            {t('pause.restartRun')}
          </button>

          <button type="button" className="pixel-button ghost-button" onClick={onBackToMenu}>
            {t('common.backToMenu')}
          </button>
        </div>
      </section>
    </div>
  );
}
