declare module 'potrace-wasm' {
  export function loadFromCanvas(canvas: OffscreenCanvas | HTMLCanvasElement): Promise<string>;

  const defaultExport: {
    loadFromCanvas: typeof loadFromCanvas;
  };

  export default defaultExport;
}

declare module '*?worker&format=es' {
  const WorkerFactory: {
    new (): Worker;
  };

  export default WorkerFactory;
}

declare module 'opentype.js' {
  export type PathCommand =
    | { type: 'M'; x: number; y: number }
    | { type: 'L'; x: number; y: number }
    | { type: 'Q'; x1: number; y1: number; x: number; y: number }
    | { type: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
    | { type: 'Z' };

  export class Path {
    commands: PathCommand[];
    moveTo(x: number, y: number): void;
    lineTo(x: number, y: number): void;
    quadraticCurveTo(x1: number, y1: number, x: number, y: number): void;
    curveTo(x1: number, y1: number, x2: number, y2: number, x: number, y: number): void;
    close(): void;
  }

  export class Glyph {
    constructor(options: {
      name: string;
      unicode?: number;
      advanceWidth: number;
      path: Path;
    });
  }

  export class Font {
    constructor(options: {
      familyName: string;
      styleName: string;
      unitsPerEm: number;
      ascender: number;
      descender: number;
      glyphs: Glyph[];
    });
    toArrayBuffer(): ArrayBuffer;
  }

  const opentype: {
    Path: typeof Path;
    Glyph: typeof Glyph;
    Font: typeof Font;
  };

  export default opentype;
}
