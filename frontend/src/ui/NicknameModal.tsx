import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

type NicknameModalProps = {
  value: string;
  errorMessage?: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
};

export function NicknameModal({
  value,
  errorMessage,
  onChange,
  onSubmit,
  onCancel,
}: NicknameModalProps) {
  const { t } = useTranslation();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="panel pixel-panel nickname-modal" role="dialog" aria-modal="true">
        <h1>{t('nickname.title')}</h1>

        <p className="screen-description">{t('nickname.description')}</p>

        <form className="nickname-form" onSubmit={handleSubmit}>
          <label htmlFor="player-name">{t('nickname.playerNameLabel')}</label>

          <input
            id="player-name"
            autoFocus
            maxLength={24}
            value={value}
            placeholder={t('nickname.placeholder')}
            onChange={(event) => onChange(event.target.value)}
          />

          {errorMessage && <p className="error-message">{errorMessage}</p>}

          <div className="button-row">
            <button type="submit" className="pixel-button primary-button">
              {t('nickname.save')}
            </button>

            <button type="button" className="pixel-button ghost-button" onClick={onCancel}>
              {t('common.back')}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
