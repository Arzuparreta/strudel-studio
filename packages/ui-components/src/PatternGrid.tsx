export interface PatternGridProps {
  /** Mini-notation string representing the base pattern for this lane. */
  mini: string;
  /** Number of steps to display in the grid. */
  steps?: number;
  /** Called when the user toggles cells and a new mini string is produced. */
  onChangeMini?: (nextMini: string) => void;
}

function miniToGrid(mini: string, steps: number): boolean[] {
  const tokens = mini.trim().length === 0 ? [] : mini.trim().split(/\s+/);
  const grid: boolean[] = [];

  for (let i = 0; i < steps; i += 1) {
    const token = tokens[i];
    if (!token) {
      grid.push(false);
    } else if (token === "~") {
      grid.push(false);
    } else {
      grid.push(true);
    }
  }

  return grid;
}

function gridToMini(grid: boolean[], onToken: string): string {
  if (grid.length === 0) {
    return "";
  }
  return grid.map((active) => (active ? onToken : "~")).join(" ");
}

/**
 * A minimal, single-row pattern grid for editing a lane's base mini
 * serialization. This is an MVP for v0.5 where each active step emits
 * a fixed token (e.g. "bd") and inactive steps emit "~".
 */
export function PatternGrid({ mini, steps = 4, onChangeMini }: PatternGridProps) {
  const grid = miniToGrid(mini, steps);

  return (
    <div
      style={{
        display: "flex",
        gap: "0.25rem",
        marginTop: "0.25rem",
      }}
    >
      {grid.map((active, index) => (
        <button
          key={index}
          type="button"
          onClick={() => {
            if (!onChangeMini) return;
            const next = [...grid];
            next[index] = !next[index];
            const nextMini = gridToMini(next, "bd");
            onChangeMini(nextMini);
          }}
          style={{
            width: "1.75rem",
            height: "1.75rem",
            borderRadius: "3px",
            border: "1px solid #ccc",
            fontSize: "0.75rem",
            backgroundColor: active ? "#222" : "#f5f5f5",
            color: active ? "#fff" : "#666",
          }}
        >
          {active ? "●" : ""}
        </button>
      ))}
    </div>
  );
}

