import { describe, expect, it } from 'vitest';

import { parseSvgPathData } from './svgPathParser';

describe('parseSvgPathData', () => {
  it('keeps all contours when paths include repeated close commands', () => {
    const commands = parseSvgPathData(
      'M0 0 L10 0 L10 10 L0 10 Z M20 20 L30 20 L30 30 L20 30 Z',
    );

    const moveCommands = commands.filter((command) => command.type === 'M');
    const closeCommands = commands.filter((command) => command.type === 'Z');

    expect(moveCommands).toHaveLength(2);
    expect(closeCommands).toHaveLength(2);

    expect(moveCommands[0]).toEqual({ type: 'M', x: 0, y: 0 });
    expect(moveCommands[1]).toEqual({ type: 'M', x: 20, y: 20 });
  });

  it('throws when numeric tokens appear directly after closepath', () => {
    expect(() => parseSvgPathData('M0 0 L10 10 Z 12 15')).toThrow(
      /Unexpected SVG path token/,
    );
  });
});
