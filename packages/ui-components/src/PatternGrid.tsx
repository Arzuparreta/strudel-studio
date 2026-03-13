export interface PatternGridProps {
  /** Mini-notation string representing the base pattern for this lane. */
  mini: string;
  /** Number of steps to display in the grid (columns). */
  steps?: number;
  /**
   * Ordered list of voices (rows). For drum patterns this might be
   * ["bd", "sd", "ch", "oh"]. Defaults to ["bd"] for v0.4 behavior.
   */
  voices?: string[];
  /** Called when the user toggles cells and a new mini string is produced. */
  onChangeMini?: (nextMini: string) => void;
}

function miniToGrid(mini: string, voices: string[], steps: number): boolean[][] {
  const tokens = mini.trim().length === 0 ? [] : mini.trim().split(/\s+/);
  const rows = voices.length;
  const grid: boolean[][] = Array.from({ length: rows }, () =>
    Array.from({ length: steps }, () => false),
  );

  for (let col = 0; col < steps; col += 1) {
    const token = tokens[col] ?? "~";
    if (token === "~") {
      continue;
    }
    const rowIndex = voices.indexOf(token);
    if (rowIndex >= 0) {
      grid[rowIndex][col] = true;
    }
  }

  return grid;
}

function gridToMini(grid: boolean[][], voices: string[]): string {
  if (grid.length === 0 || grid[0].length === 0) {
    return "";
  }

  const rows = grid.length;
  const steps = grid[0].length;
  const tokens: string[] = [];

  for (let col = 0; col < steps; col += 1) {
    let token = "~";
    for (let row = 0; row < rows; row += 1) {
      if (grid[row][col]) {
        token = voices[row];
        break;
      }
    }
    tokens.push(token);
  }

  return tokens.join(" ");
}

/**
 * A small pattern grid for editing a lane's base mini serialization.
 * - Rows = voices (e.g. "bd", "sd")
 * - Columns = steps
 * Only one voice is active per step; toggling a cell on clears other rows
 * in that column to keep the mapping mini ↔ grid unambiguous.
 */
export function PatternGrid({
  mini,
  steps: stepsProp,
  voices: voicesProp,
  onChangeMini,
}: PatternGridProps) {
  const voices = voicesProp && voicesProp.length > 0 ? voicesProp : ["bd"];
  const steps = stepsProp ?? 4;
  const grid = miniToGrid(mini, voices, steps);

  return (
    <div
      style={{
        display: "inline-flex",
        flexDirection: "column",
        gap: "0.25rem",
        marginTop: "0.25rem",
      }}
    >
      {voices.map((voice, rowIndex) => (
        <div
          key={voice}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.25rem",
          }}
        >
          <span
            style={{
              width: "2rem",
              fontSize: "0.75rem",
              textAlign: "right",
              color: "#555",
            }}
          >
            {voice}
          </span>
          <div
            style={{
              display: "flex",
              gap: "0.25rem",
            }}
          >
            {grid[rowIndex].map((active, colIndex) => (
              <button
                key={colIndex}
                type="button"
                onClick={() => {
                  if (!onChangeMini) return;
                  const next = grid.map((row) => [...row]);

                  if (active) {
                    // Turning off the currently active cell.
                    next[rowIndex][colIndex] = false;
                  } else {
                    // Ensure only one voice per step: clear column then activate.
                    for (let r = 0; r < next.length; r += 1) {
                      next[r][colIndex] = false;
                    }
                    next[rowIndex][colIndex] = true;
                  }

                  const nextMini = gridToMini(next, voices);
                  onChangeMini(nextMini);
                }}
                style={{
                  width: "1.4rem",
                  height: "1.4rem",
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
        </div>
      ))}
    </div>
  );
}


