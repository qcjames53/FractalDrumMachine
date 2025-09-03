// Helper to compute initial zoom and offset
export function getInitialZoomAndOffset(notesPerMeasure: number) {
  const fractalSize = Math.floor(4 ** Math.ceil(notesPerMeasure / 2));
  const log_min_c = Math.log(256);
  const log_max_c = Math.log(65535);
  const log_c = Math.log(fractalSize);
  const log_min_z = Math.log(0.008);
  const log_max_z = Math.log(2);
  const t = (log_c - log_min_c) / (log_max_c - log_min_c);
  const log_zoom = log_max_z + t * (log_min_z - log_max_z);
  const log_zoom_exp = Math.exp(log_zoom);
  const offset = {
    x: 800 / 2 - (fractalSize * log_zoom_exp) / 2,
    y: 600 / 2 - (fractalSize * log_zoom_exp) / 2
  };
  return { zoom: log_zoom_exp, offset, fractalSize };
}

// Helper to determine which notes are played to reach a certain coord
export function determine_notes_from_coords(x: number, y: number, fractalSize: number, notesPerMeasure: number): number[] {
  if (x < 0 || y < 0) return [];
  const current_notes: number[] = [];
  let note_size = fractalSize / 4;
  let notes_remaining = notesPerMeasure
  let tx = x;
  let ty = y;
  while (note_size > 0) {
    current_notes.push(Math.floor(tx / note_size));
    if (notes_remaining > 1) {
      current_notes.push(Math.floor(ty / note_size));
    }
    tx = tx % note_size;
    ty = ty % note_size;
    note_size = Math.floor(note_size / 4);
    notes_remaining -= 2;
  }
  return current_notes;
}

// Helper to convert the note coordinates to a string
export function coords_to_string(x: number, y: number, notesPerMeasure: number): string {
  if (x < 0 || y < 0) return "";
  if (notesPerMeasure % 2 === 0) return `${x},${y}`;
  return `${x},${Math.floor(y/4)}`;
}

// Helper to convert a notes int array to string
export function note_array_to_string(notes: number[]): string {
  const note_names : string[] = ['B', 'S', 'H', '-']
  let output = "";
  for (const note of notes) {
    output += note_names[note] || "?";
  }
  return output;
}