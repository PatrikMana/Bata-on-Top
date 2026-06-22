import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { getMenuItemClassName, useMenuKeys } from './useMenuKeys';

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
  const inputRef = useRef<HTMLInputElement>(null);
  const [buttonsFocused, setButtonsFocused] = useState(false);

  const menuItems = useMemo(
    () => [
      { id: 'save', onActivate: onSubmit },
      { id: 'back', onActivate: onCancel },
    ],
    [onCancel, onSubmit],
  );

  const { isFocused } = useMenuKeys({
    items: menuItems,
    layout: 'horizontal',
    enabled: buttonsFocused,
    onBack: onCancel,
  });

  useEffect(() => {
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape' || event.repeat) {
        return;
      }

      event.preventDefault();
      onCancel();
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onCancel]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  function handleInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 's' || event.key === 'S') {
      event.preventDefault();
      setButtonsFocused(true);
      inputRef.current?.blur();
    }
  }

  function handleInputFocus() {
    setButtonsFocused(false);
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="panel pixel-panel nickname-modal" role="dialog" aria-modal="true">
        <h1>{t('nickname.title')}</h1>

        <p className="screen-description">{t('nickname.description')}</p>

        <form className="nickname-form" onSubmit={handleSubmit}>
          <label htmlFor="player-name">{t('nickname.playerNameLabel')}</label>

          <input
            ref={inputRef}
            id="player-name"
            autoFocus
            maxLength={24}
            value={value}
            placeholder={t('nickname.placeholder')}
            onChange={(event) => onChange(event.target.value)}
            onFocus={handleInputFocus}
            onKeyDown={handleInputKeyDown}
          />

          {errorMessage && <p className="error-message">{errorMessage}</p>}

          <div className="button-row">
            <button
              type="submit"
              className={getMenuItemClassName('pixel-button primary-button', buttonsFocused && isFocused(0))}
              onFocus={() => setButtonsFocused(true)}
            >
              {t('nickname.save')}
            </button>

            <button
              type="button"
              className={getMenuItemClassName('pixel-button ghost-button', buttonsFocused && isFocused(1))}
              onClick={onCancel}
              onFocus={() => setButtonsFocused(true)}
            >
              {t('common.back')}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
