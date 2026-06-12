type StartScreenProps = {
  playerName: string;
  isStarting: boolean;
  errorMessage?: string;
  onPlayerNameChange: (value: string) => void;
  onStart: () => void;
};

export function StartScreen({
  playerName,
  isStarting,
  errorMessage,
  onPlayerNameChange,
  onStart,
}: StartScreenProps) {
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onStart();
  }

  return (
    <section className="screen start-screen">
      <div className="panel">
        <p className="eyebrow">Baťa / MDC climbing challenge</p>

        <h1>Bata on Top</h1>

        <p className="screen-description">
          Vyšplhej pomocí tkaničky až na vrchol a najdi zlaté střevíce.
        </p>

        <form onSubmit={handleSubmit} className="start-form">
          <label htmlFor="player-name">Nickname</label>

          <input
            id="player-name"
            value={playerName}
            maxLength={24}
            placeholder="Např. Patrik"
            onChange={(event) => onPlayerNameChange(event.target.value)}
          />

          {errorMessage && <p className="error-message">{errorMessage}</p>}

          <button type="submit" disabled={isStarting}>
            {isStarting ? 'Startuju...' : 'Start hry'}
          </button>
        </form>
      </div>
    </section>
  );
}