import React from 'react';
import { DrawGrid } from './DrawGrid';
import { DrawMeasure } from './DrawMeasure';
import { getInitialZoomAndOffset, determine_notes_from_coords, coords_to_string, note_array_to_string } from './Utils'
import { PlayNote, LoadSamples } from './PlayNote'

const minZoom: number = 0.0000001;
const maxZoom: number = 60;

const FractalDrumMachine = () => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  // Calculate notes per measure based on time signature and fractal note type. Calculate number of whole notes in the
  // measure and see how many fractal notes fit inside. Full equation below (has been simplified in code).
  // (timeSignatureCounts * (1 / timeSignatureNoteType)) / (1 / fractalNoteType)
  const [timeSignatureCounts, setTimeSignatureCounts] = React.useState(4); // Default to 4 counts
  const [timeSignatureNoteType, setTimeSignatureNoteType] = React.useState(4); // Default to quarter note has the beat
  const [fractalNoteType, setFractalNoteType] = React.useState(8); // Default to 8th notes
  const notesPerMeasure = Math.round(timeSignatureCounts * (fractalNoteType / timeSignatureNoteType));

  // Calculate the ms delay for each note by determining the delay for one time signature count and dividing by the number of
  // fractal notes that fit inside of a count note. E.G. 4 16th notes inside of one quarter note (has been simplified in code).
  // (60000 / beatsPerMinute) / ((1 / timeSignatureNoteType) / (1 / fractalNoteType))
  const [beatsPerMinute, setBeatsPerMinute] = React.useState(120);
  const noteMillisecondDelay: number = Math.round(60000 / beatsPerMinute * timeSignatureNoteType / fractalNoteType);

  // Use helper for initial state of zoom, offset, fractal size
  const initial = getInitialZoomAndOffset(notesPerMeasure); 
  const [zoom, setZoom] = React.useState(initial.zoom);
  const [offset, setOffset] = React.useState(initial.offset);
  const fractalSize = initial.fractalSize;

  const [isLooping, setIsLooping] = React.useState(true);
  const [measureCoordinate, setMeasureCoordinate] = React.useState({ x: -1, y: -1 });
  const measureNotes = React.useMemo(
    () => determine_notes_from_coords(measureCoordinate.x, measureCoordinate.y, fractalSize, notesPerMeasure),
    [measureCoordinate, fractalSize, notesPerMeasure]
  );
  const measureCoordinateString: string = coords_to_string(measureCoordinate.x, measureCoordinate.y, notesPerMeasure);
  const measureNotesString: string = note_array_to_string(measureNotes);
  const [displayedMeasureNotes, setDisplayedMeasureNotes] = React.useState<number[]>(measureNotes);
  
  // Track refs for certain event handlers
  const notesPerMeasureRef = React.useRef(notesPerMeasure);
  const fractalSizeRef = React.useRef(fractalSize);
  const zoomRef = React.useRef(zoom);
  const offsetRef = React.useRef(offset);
  const measureNotesRef = React.useRef(measureNotes);
  const displayedMeasureNotesRef = React.useRef(displayedMeasureNotes);
  const noteMillisecondDelayRef = React.useRef(noteMillisecondDelay);
  React.useEffect(() => { notesPerMeasureRef.current = notesPerMeasure; }, [notesPerMeasure]);
  React.useEffect(() => { fractalSizeRef.current = fractalSize; }, [fractalSize]);
  React.useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  React.useEffect(() => { offsetRef.current = offset; }, [offset]);
  React.useEffect(() => { measureNotesRef.current = measureNotes; }, [measureNotes]);
  React.useEffect(() => { displayedMeasureNotesRef.current = displayedMeasureNotes; }, [displayedMeasureNotes]);
  React.useEffect(() => { noteMillisecondDelayRef.current = noteMillisecondDelay; }, [noteMillisecondDelay]);

  // ----- Drawing -----
  // Draw function (action-based due to best practices, don't understand why this can't be state driven?)
  const onDraw: () => void = React.useCallback(() => {
    const canvas: HTMLCanvasElement | null = canvasRef.current;
    if (canvas) {
      const ctx: CanvasRenderingContext2D | null = canvas.getContext('2d');
      if (ctx) {
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Apply pan and zoom
        ctx.save();
        ctx.translate(offset.x, offset.y);
        ctx.scale(zoom, zoom);

        // Draw the gridlines
        DrawGrid(ctx, offset, zoom, fractalSize, notesPerMeasure);

        // Draw the measure
        DrawMeasure(ctx, zoom, fractalSize, displayedMeasureNotes);

        // Restore translation
        ctx.restore();
      }
    }
  }, [offset, zoom, measureCoordinate, fractalSize, displayedMeasureNotes]);

  // ----- Mouse event handlers -----
  React.useEffect(() => {
    const canvas: HTMLCanvasElement | null = canvasRef.current;
    if (!canvas) return;
    let isPanning: boolean = false;
    let isSelecting: boolean = false;
    let lastPos: { x: number; y: number } = { x: 0, y: 0 };

    // Helper to update selection
    const updateSelection = (e: MouseEvent) => {
      const rect: DOMRect = canvas.getBoundingClientRect();
      const mouseX: number = e.clientX - rect.left;
      const mouseY: number = e.clientY - rect.top;

      // Use latest offset, zoom, notesPerMeasure, and fractalSize from refs
      let worldX: number = Math.floor((mouseX - offsetRef.current.x) / zoomRef.current);
      let worldY: number = Math.floor((mouseY - offsetRef.current.y) / zoomRef.current);
      
      // Clamp the world coordinates to the fractal bounds
      const fractalSize = fractalSizeRef.current;
      worldX = Math.max(0, Math.min(worldX, fractalSize - 1));
      worldY = Math.max(0, Math.min(worldY, fractalSize - 1));
      
      // Offset to the nearest multiple of 4 y coord if there are an odd number of notesPerMeasure
      const notesPerMeasure = notesPerMeasureRef.current;
      if (notesPerMeasure % 2 === 1) {
        worldY = Math.floor(worldY / 4) * 4;
      }

      setMeasureCoordinate({ x: worldX, y: worldY });
    };

    const handleMouseDown: (e: MouseEvent) => void = (e: MouseEvent) => {
      if (e.button === 0) {
        isPanning = true;
      }
      else if (e.button === 2) {
        isSelecting = true;
        updateSelection(e);
      }
      lastPos = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove: (e: MouseEvent) => void = (e: MouseEvent) => {
      if (isPanning) {
        const dx: number = e.clientX - lastPos.x;
        const dy: number = e.clientY - lastPos.y;
        setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
        lastPos = { x: e.clientX, y: e.clientY };
      }

      if (isSelecting) {
        stopMeasure();
        updateSelection(e);
      }
    };

    const handleMouseUp: (e: MouseEvent) => void = (e: MouseEvent) => {
      if (e.button === 0) {
        isPanning = false;
      } else if (e.button === 2) {
        isSelecting = false;
        playMeasure();
      }
    };

    const handleWheel: (e: WheelEvent) => void = (e: WheelEvent) => {
      e.preventDefault();
      const rect: DOMRect = canvas.getBoundingClientRect();
      const mouseX: number = e.clientX - rect.left;
      const mouseY: number = e.clientY - rect.top;
      const zoomFactor: number = e.deltaY < 0 ? 1.1 : 0.9;
      setZoom(prevZoom => {
        const newZoom: number = Math.max(minZoom, Math.min(maxZoom, prevZoom * zoomFactor));
        // Adjust offset so zoom is centered at mouse
        setOffset(prevOffset => {
          const x: number = mouseX - ((mouseX - prevOffset.x) * (newZoom / prevZoom));
          const y: number = mouseY - ((mouseY - prevOffset.y) * (newZoom / prevZoom));
          return { x, y };
        });
        return newZoom;
      });
    };
    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // ----- Effects -----
  // Keep canvas in sync with offset, zoom, and measureCoordinate changes
  React.useEffect(() => {
    onDraw();
  }, [offset, zoom, measureCoordinate, displayedMeasureNotes, onDraw]);

  // Keep displayedMeasureNotes in sync with measureNotes except during play
  React.useEffect(() => {
    setDisplayedMeasureNotes(measureNotes);
  }, [measureNotes]);

  // Reset zoom/offset when notesPerMeasure changes
  React.useEffect(() => {
    const { zoom, offset } = getInitialZoomAndOffset(notesPerMeasure);
    setZoom(zoom);
    setOffset(offset);
    setMeasureCoordinate({ x: -1, y: -1 });
  }, [notesPerMeasure]);

  // Handler for Clear button
  const clearFractal = React.useCallback(() => {
  stopMeasure();
  setMeasureCoordinate({ x: -1, y: -1 });
  }, []);

  // Handler for Reset button
  const resetFractal = React.useCallback(() => {
  stopMeasure();
  const { zoom, offset } = getInitialZoomAndOffset(notesPerMeasure);
  setZoom(zoom);
  setOffset(offset);
  setMeasureCoordinate({ x: -1, y: -1 });
  }, [notesPerMeasure]);

  // Cleanup timer on unmount
  React.useEffect(() => {
    return () => {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
    };
  }, []);

  // ----- Misc -----
  // Play measure animation (seamless loop with setTimeout)
  const playTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const playMeasure = React.useCallback(() => {
    stopMeasure();
    const mn = measureNotesRef.current;
    setDisplayedMeasureNotes([]);
    const delay = noteMillisecondDelayRef.current;

    function playNextNote(i: number, dmn: number[]) {
      if (i < mn.length) {
        dmn = [...dmn, mn[i]];
        PlayNote(mn[i]);
        setDisplayedMeasureNotes(dmn);
        playTimerRef.current = setTimeout(playNextNote, delay, i + 1, dmn);
      } else if (isLooping) {
        setDisplayedMeasureNotes([]);
        playTimerRef.current = setTimeout(playNextNote, 0, 0, []); // No gap between loops
      } else {
        stopMeasure();
      }
    }
    playNextNote(0, []);
  }, [measureNotes, isLooping]);

  // Stop measure animation
  const stopMeasure = React.useCallback(() => {
    if (playTimerRef.current) {
      clearTimeout(playTimerRef.current);
      playTimerRef.current = null;
    }
  }, []);

  // Helper for clipboard
  const copyToClipboard = (text: string) => {
    if (navigator && navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
  };

  // Preload drum samples on mount
  React.useEffect(() => {
    LoadSamples();
  }, []);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      {/* Top row: time signature, BPM, reset */}
      <div style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        {/* Time signature fraction */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginRight: '1rem' }}>
          <input
            type="number"
            min={1}
            max={22}
            value={timeSignatureCounts}
            onChange={e => {
                setTimeSignatureCounts(Math.max(1, Math.min(22, parseInt(e.target.value) || 1)));
            }}
            style={{ width: 100, textAlign: 'center', fontSize: '1.2rem', marginBottom: 2 }}
          />
          <div style={{ borderTop: '2px solid #333', width: 40, margin: '2px 0' }} />
          <input
            type="number"
            min={4}
            max={16}
            step={4}
            value={timeSignatureNoteType}
            onChange={e => {
              const v = parseInt(e.target.value) || 4;
              setTimeSignatureNoteType([4,8,16].includes(v) ? v : 4);
            }}
            style={{ width: 100, textAlign: 'center', fontSize: '1.2rem', marginTop: 2 }}
          />
        </div>
        <span style={{ fontSize: '1.1rem', marginRight: '1rem' }}>Fractal note type:</span>
        <input
          type="number"
          min={1}
          max={32}
          value={fractalNoteType}
          onChange={e => setFractalNoteType(Math.max(1, Math.min(32, parseInt(e.target.value) || 8)))}
          style={{ width: 100, textAlign: 'center', fontSize: '1.2rem', marginRight: '1rem' }}
        />
        <span style={{ fontSize: '1.1rem', marginRight: '1rem' }}>BPM:</span>
        <input
          type="number"
          min={1}
          max={1000}
          value={beatsPerMinute}
          onChange={e => setBeatsPerMinute(Math.max(1, Math.min(1000, parseInt(e.target.value) || 120)))}
          style={{ width: 100, textAlign: 'center', fontSize: '1.2rem', marginRight: '1rem' }}
        />
        <button onClick={playMeasure}>Play</button>
        <button onClick={stopMeasure}>Stop</button>
        <button onClick={clearFractal}>Clear</button>
        <button onClick={resetFractal}>Reset</button>
      </div>

      {/* Second row: coord and notes display */}
      <div style={{ marginBottom: '1rem', display: 'grid', gridTemplateColumns: 'max-content 15ch 2.5rem 1fr 2.5rem', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
        {/* Measure Coordinate Display */}
        <label style={{ fontWeight: 500, gridColumn: '1' }}>Selected:</label>
        <input
          type="text"
          value={measureCoordinateString}
          readOnly
          style={{ gridColumn: '2', width: '15ch', minWidth: '15ch', maxWidth: '15ch', textAlign: 'center', fontSize: '1.1rem', background: '#f7f7f7', border: '1px solid #ccc', borderRadius: 4 }}
        />
        <button
          title="Copy coordinate to clipboard"
          style={{ gridColumn: '3', fontSize: '1.3rem', padding: '0 6px', cursor: 'pointer', background: 'none', border: 'none' }}
          onClick={() => copyToClipboard(measureCoordinateString)}
        >⧉</button>

        {/* Measure Notes String Display */}
        <input
          type="text"
          value={measureNotesString}
          readOnly
          style={{ gridColumn: '4', width: '100%', minWidth: 0, textAlign: 'left', fontSize: '1.1rem', background: '#f7f7f7', border: '1px solid #ccc', borderRadius: 4 }}
        />
        <button
          title="Copy notes to clipboard"
          style={{ gridColumn: '5', fontSize: '1.3rem', padding: '0 6px', cursor: 'pointer', background: 'none', border: 'none' }}
          onClick={() => copyToClipboard(measureNotesString)}
        >⧉</button>
      </div>

      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        style={{ display: 'block', border: '1px solid #ccc', width: '800px', height: '600px' }}
        onContextMenu={e => e.preventDefault()}
      />
    </div>
  );
};

export default FractalDrumMachine;
