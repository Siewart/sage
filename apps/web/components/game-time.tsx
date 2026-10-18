const ESTIMATED_GAME_SPEED = 1.69;
const formatClock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/** Real time is an estimate; the dataset only records the game clock. */
export function GameTime({ milliseconds }: { milliseconds: number }) {
  const gameSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const realSeconds = Math.max(
    0,
    Math.round(gameSeconds / ESTIMATED_GAME_SPEED),
  );
  const gameTime = formatClock(gameSeconds);
  const realTime = formatClock(realSeconds);
  return (
    <span className="match-times">
      <time
        dateTime={`PT${gameSeconds}S`}
        aria-label={`GT — Game time ${gameTime}`}
      >
        GT {gameTime}
      </time>
      <time
        className="muted"
        dateTime={`PT${realSeconds}S`}
        aria-label={`RT — Estimated real time ${realTime}`}
      >
        RT ≈{realTime}
      </time>
    </span>
  );
}
