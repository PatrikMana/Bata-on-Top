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
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="panel pixel-panel pause-modal" role="dialog" aria-modal="true">
        <h1>Pauza</h1>

        <div className="pause-actions">
          <button type="button" className="pixel-button primary-button" onClick={onResume}>
            Pokračovat
          </button>

          <button type="button" className="pixel-button secondary-button" onClick={onRestart}>
            Restartovat run
          </button>

          <button type="button" className="pixel-button ghost-button" onClick={onBackToMenu}>
            Zpět do menu
          </button>
        </div>
      </section>
    </div>
  );
}
