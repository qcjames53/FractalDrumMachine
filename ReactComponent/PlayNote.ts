const SNARE_SAMPLE_PATHS = [
  '/amen-drum-kit/26900__vexst__snare-1.wav',
  '/amen-drum-kit/26901__vexst__snare-2.wav',
  '/amen-drum-kit/26902__vexst__snare-3.wav',
  '/amen-drum-kit/26903__vexst__snare-4.wav',
];
const BASS_DRUM_SAMPLE_PATHS = [
  '/amen-drum-kit/26885__vexst__kick-1.wav',
  '/amen-drum-kit/26886__vexst__kick-2.wav',
  '/amen-drum-kit/26887__vexst__kick-3.wav',
  '/amen-drum-kit/26888__vexst__kick-4.wav',
];
const HIGH_HAT_SAMPLE_PATHS = [
  '/amen-drum-kit/26879__vexst__closed-hi-hat-1.wav',
  '/amen-drum-kit/26880__vexst__closed-hi-hat-2.wav',
  '/amen-drum-kit/26881__vexst__closed-hi-hat-3.wav',
  '/amen-drum-kit/26882__vexst__closed-hi-hat-4.wav',
];

const audioContext = typeof window !== 'undefined' ? new (window.AudioContext || (window as any).webkitAudioContext)() : undefined;

let SNARE_BUFFERS: AudioBuffer[] = [];
let BASS_DRUM_BUFFERS: AudioBuffer[] = [];
let HIGH_HAT_BUFFERS: AudioBuffer[] = [];
let samplesLoaded = false;

// Helper to fetch and decode a sample
async function fetchAndDecode(path: string): Promise<AudioBuffer> {
  if (!audioContext) throw new Error('AudioContext not available');
  // Use absolute path for static assets
  const url = path.startsWith('/') ? path : `/${path}`;
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  return await audioContext.decodeAudioData(arrayBuffer);
}

// Call this once (e.g. on app/component mount) to preload all samples
export async function LoadSamples(): Promise<void> {
  if (samplesLoaded || !audioContext) return;
  SNARE_BUFFERS = await Promise.all(SNARE_SAMPLE_PATHS.map(fetchAndDecode));
  BASS_DRUM_BUFFERS = await Promise.all(BASS_DRUM_SAMPLE_PATHS.map(fetchAndDecode));
  HIGH_HAT_BUFFERS = await Promise.all(HIGH_HAT_SAMPLE_PATHS.map(fetchAndDecode));
  samplesLoaded = true;
}

export function PlayNote(note: number) {
  if (!audioContext || !samplesLoaded) return;
  let buffer: AudioBuffer | undefined;
  switch (note) {
    case 0:
      buffer = BASS_DRUM_BUFFERS[Math.floor(Math.random() * BASS_DRUM_BUFFERS.length)];
      break;
    case 1:
      buffer = SNARE_BUFFERS[Math.floor(Math.random() * SNARE_BUFFERS.length)];
      break;
    case 2:
      buffer = HIGH_HAT_BUFFERS[Math.floor(Math.random() * HIGH_HAT_BUFFERS.length)];
      break;
    default:
      return;
  }
  if (buffer) {
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start(0);
  }
}