type AbsolutePoint = {
  x: number;
  y: number;
};

type SvgPathCommand =
  | { type: 'M'; x: number; y: number }
  | { type: 'L'; x: number; y: number }
  | { type: 'Q'; x1: number; y1: number; x: number; y: number }
  | { type: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { type: 'Z' };

const TOKEN_PATTERN = /([a-zA-Z])|([-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)/g;

const isCommandToken = (token: string): boolean => /^[a-zA-Z]$/.test(token);

const readNumber = (tokens: string[], index: number): number => {
  const token = tokens[index];

  if (token === undefined) {
    throw new Error('Unexpected end of SVG path data.');
  }

  const value = Number(token);

  if (Number.isNaN(value)) {
    throw new Error(`Invalid SVG path value "${token}".`);
  }

  return value;
};

const reflectPoint = (current: AbsolutePoint, control: AbsolutePoint | null): AbsolutePoint =>
  control === null
    ? current
    : {
        x: current.x * 2 - control.x,
        y: current.y * 2 - control.y,
      };

export const parseSvgPathData = (pathData: string): SvgPathCommand[] => {
  const tokens = Array.from(pathData.matchAll(TOKEN_PATTERN), (match) => match[0]);
  const commands: SvgPathCommand[] = [];
  let index = 0;
  let currentCommand = '';
  let currentPoint: AbsolutePoint = { x: 0, y: 0 };
  let subpathStart: AbsolutePoint = { x: 0, y: 0 };
  let previousControlPoint: AbsolutePoint | null = null;

  while (index < tokens.length) {
    const token = tokens[index];

    if (!token) {
      break;
    }

    if (isCommandToken(token)) {
      currentCommand = token;
      index += 1;
    } else if (currentCommand.length === 0 || currentCommand.toUpperCase() === 'Z') {
      throw new Error(`Unexpected SVG path token "${token}".`);
    }

    const isRelative = currentCommand === currentCommand.toLowerCase();

    switch (currentCommand.toUpperCase()) {
      case 'M': {
        const x = readNumber(tokens, index);
        const y = readNumber(tokens, index + 1);
        const nextPoint = {
          x: isRelative ? currentPoint.x + x : x,
          y: isRelative ? currentPoint.y + y : y,
        };

        commands.push({ type: 'M', ...nextPoint });
        currentPoint = nextPoint;
        subpathStart = nextPoint;
        previousControlPoint = null;
        index += 2;
        currentCommand = isRelative ? 'l' : 'L';
        break;
      }

      case 'L': {
        const x = readNumber(tokens, index);
        const y = readNumber(tokens, index + 1);
        const nextPoint = {
          x: isRelative ? currentPoint.x + x : x,
          y: isRelative ? currentPoint.y + y : y,
        };

        commands.push({ type: 'L', ...nextPoint });
        currentPoint = nextPoint;
        previousControlPoint = null;
        index += 2;
        break;
      }

      case 'H': {
        const x = readNumber(tokens, index);
        const nextPoint = {
          x: isRelative ? currentPoint.x + x : x,
          y: currentPoint.y,
        };

        commands.push({ type: 'L', ...nextPoint });
        currentPoint = nextPoint;
        previousControlPoint = null;
        index += 1;
        break;
      }

      case 'V': {
        const y = readNumber(tokens, index);
        const nextPoint = {
          x: currentPoint.x,
          y: isRelative ? currentPoint.y + y : y,
        };

        commands.push({ type: 'L', ...nextPoint });
        currentPoint = nextPoint;
        previousControlPoint = null;
        index += 1;
        break;
      }

      case 'Q': {
        const x1 = readNumber(tokens, index);
        const y1 = readNumber(tokens, index + 1);
        const x = readNumber(tokens, index + 2);
        const y = readNumber(tokens, index + 3);
        const controlPoint = {
          x: isRelative ? currentPoint.x + x1 : x1,
          y: isRelative ? currentPoint.y + y1 : y1,
        };
        const nextPoint = {
          x: isRelative ? currentPoint.x + x : x,
          y: isRelative ? currentPoint.y + y : y,
        };

        commands.push({
          type: 'Q',
          x1: controlPoint.x,
          y1: controlPoint.y,
          x: nextPoint.x,
          y: nextPoint.y,
        });
        previousControlPoint = controlPoint;
        currentPoint = nextPoint;
        index += 4;
        break;
      }

      case 'T': {
        const controlPoint = reflectPoint(currentPoint, previousControlPoint);
        const x = readNumber(tokens, index);
        const y = readNumber(tokens, index + 1);
        const nextPoint = {
          x: isRelative ? currentPoint.x + x : x,
          y: isRelative ? currentPoint.y + y : y,
        };

        commands.push({
          type: 'Q',
          x1: controlPoint.x,
          y1: controlPoint.y,
          x: nextPoint.x,
          y: nextPoint.y,
        });
        previousControlPoint = controlPoint;
        currentPoint = nextPoint;
        index += 2;
        break;
      }

      case 'C': {
        const x1 = readNumber(tokens, index);
        const y1 = readNumber(tokens, index + 1);
        const x2 = readNumber(tokens, index + 2);
        const y2 = readNumber(tokens, index + 3);
        const x = readNumber(tokens, index + 4);
        const y = readNumber(tokens, index + 5);
        const controlPointOne = {
          x: isRelative ? currentPoint.x + x1 : x1,
          y: isRelative ? currentPoint.y + y1 : y1,
        };
        const controlPointTwo = {
          x: isRelative ? currentPoint.x + x2 : x2,
          y: isRelative ? currentPoint.y + y2 : y2,
        };
        const nextPoint = {
          x: isRelative ? currentPoint.x + x : x,
          y: isRelative ? currentPoint.y + y : y,
        };

        commands.push({
          type: 'C',
          x1: controlPointOne.x,
          y1: controlPointOne.y,
          x2: controlPointTwo.x,
          y2: controlPointTwo.y,
          x: nextPoint.x,
          y: nextPoint.y,
        });
        previousControlPoint = controlPointTwo;
        currentPoint = nextPoint;
        index += 6;
        break;
      }

      case 'S': {
        const reflectedControlPoint = reflectPoint(currentPoint, previousControlPoint);
        const x2 = readNumber(tokens, index);
        const y2 = readNumber(tokens, index + 1);
        const x = readNumber(tokens, index + 2);
        const y = readNumber(tokens, index + 3);
        const controlPointTwo = {
          x: isRelative ? currentPoint.x + x2 : x2,
          y: isRelative ? currentPoint.y + y2 : y2,
        };
        const nextPoint = {
          x: isRelative ? currentPoint.x + x : x,
          y: isRelative ? currentPoint.y + y : y,
        };

        commands.push({
          type: 'C',
          x1: reflectedControlPoint.x,
          y1: reflectedControlPoint.y,
          x2: controlPointTwo.x,
          y2: controlPointTwo.y,
          x: nextPoint.x,
          y: nextPoint.y,
        });
        previousControlPoint = controlPointTwo;
        currentPoint = nextPoint;
        index += 4;
        break;
      }

      case 'Z':
        commands.push({ type: 'Z' });
        currentPoint = subpathStart;
        previousControlPoint = null;
        break;

      default:
        throw new Error(`Unsupported SVG path command "${currentCommand}".`);
    }
  }

  return commands;
};
