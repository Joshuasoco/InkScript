interface RandomizedCharacter {
  sizeOffset: number;
  rotation: number;
  yOffset: number;
}

interface RandomizedLine {
  characters: RandomizedCharacter[];
}

interface WorkerRequest {
  type: 'randomize';
  payload: {
    lines: string[];
    fontSize: number;
    letterVariation: number;
    seed: number;
  };
}

interface WorkerResponse {
  type: 'randomized';
  payload: {
    lines: RandomizedLine[];
  };
}

const MAX_SIZE_JITTER = 2;
const MAX_ROTATION_DEGREES = 1.5;
const MAX_Y_OFFSET = 2;

const createSeededRandom = (seed: number): (() => number) => {
  let state = seed >>> 0;

  return () => {
    state += 0x6d2b79f5;

    let next = Math.imul(state ^ (state >>> 15), state | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);

    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
};

const randomInRange = (random: () => number, min: number, max: number): number =>
  min + (max - min) * random();

const clamp = (value: number, min: number, max: number): number => {
  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
};

self.onmessage = (event: MessageEvent<WorkerRequest>): void => {
  if (event.data.type !== 'randomize') {
    return;
  }

  const { lines, fontSize, letterVariation, seed } = event.data.payload;
  const random = createSeededRandom(seed ^ fontSize);
  const intensity = clamp(letterVariation, 0, 1);
  const response: WorkerResponse = {
    type: 'randomized',
    payload: {
      lines: lines.map((line) => ({
        characters: Array.from(line, () => ({
          // WHY: Moving the jitter math off the main thread keeps long previews responsive while typing.
          sizeOffset: randomInRange(random, -MAX_SIZE_JITTER, MAX_SIZE_JITTER) * intensity,
          rotation: randomInRange(random, -MAX_ROTATION_DEGREES, MAX_ROTATION_DEGREES) * intensity,
          yOffset: randomInRange(random, -MAX_Y_OFFSET, MAX_Y_OFFSET) * intensity,
        })),
      })),
    },
  };

  self.postMessage(response);
};
