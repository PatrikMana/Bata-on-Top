import type { FormEvent } from 'react';

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
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="panel pixel-panel nickname-modal" role="dialog" aria-modal="true">
        <h1>Nickname</h1>

        <p className="screen-description">
          Než začneš hrát mapu, zadej jméno pro HUD a leaderboard.
        </p>

        <form className="nickname-form" onSubmit={handleSubmit}>
          <label htmlFor="player-name">Jméno hráče</label>

          <input
            id="player-name"
            autoFocus
            maxLength={24}
            value={value}
            placeholder="Hráč"
            onChange={(event) => onChange(event.target.value)}
          />

          {errorMessage && <p className="error-message">{errorMessage}</p>}

          <div className="button-row">
            <button type="submit" className="pixel-button primary-button">
              Uložit
            </button>

            <button type="button" className="pixel-button ghost-button" onClick={onCancel}>
              Zpět
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
