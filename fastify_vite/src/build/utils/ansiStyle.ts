const codes = {
  // Standard foreground colors
  black: 30,
  red: 31,
  green: 32,
  yellow: 33,
  blue: 34,
  magenta: 35,
  cyan: 36,
  white: 37,

  // Bright foreground colors
  blackBright: 90,
  redBright: 91,
  greenBright: 92,
  yellowBright: 93,
  blueBright: 94,
  magentaBright: 95,
  cyanBright: 96,
  whiteBright: 97,

  // Standard background colors
  bgBlack: 40,
  bgRed: 41,
  bgGreen: 42,
  bgYellow: 43,
  bgBlue: 44,
  bgMagenta: 45,
  bgCyan: 46,
  bgWhite: 47,

  // Bright background colors
  bgBlackBright: 100,
  bgRedBright: 101,
  bgGreenBright: 102,
  bgYellowBright: 103,
  bgBlueBright: 104,
  bgMagentaBright: 105,
  bgCyanBright: 106,
  bgWhiteBright: 107,

  // Text styles
  bold: 1,
  dim: 2,
  italic: 3,
  underline: 4,
  blink: 5,
  inverse: 7,
  hidden: 8,
  strikethrough: 9,
} as const;

const resetCodes = {
  bold: 22,
  dim: 22,
  italic: 23,
  underline: 24,
  blink: 25,
  inverse: 27,
  hidden: 28,
  strikethrough: 29,
} as const;

type StyleName = keyof typeof codes;
type Rgb = readonly [r: number, g: number, b: number];

export type Styled = ((text: string | number) => string) & {
  [K in StyleName]: Styled;
} & {
  rgb: (r: number, g: number, b: number) => Styled;
  bgRgb: (r: number, g: number, b: number) => Styled;
  ansi256: (index: number) => Styled;
  bgAnsi256: (index: number) => Styled;
};

type StyleCode =
  | { kind: 'sgr'; code: number; reset: number }
  | { kind: 'rgb'; rgb: Rgb; background: boolean }
  | { kind: 'ansi256'; index: number; background: boolean };

const ESC = '\x1b[';
const RESET = `${ESC}0m`;

function sgr(code: number): string {
  return `${ESC}${code}m`;
}

function validateChannel(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 255) {
    throw new RangeError(`${name} must be an integer between 0 and 255`);
  }
}

function validateIndex(value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > 255) {
    throw new RangeError(
      'ANSI color index must be an integer between 0 and 255'
    );
  }
}

function renderStyle(style: StyleCode): string {
  switch (style.kind) {
    case 'sgr':
      return sgr(style.code);

    case 'rgb': {
      const [r, g, b] = style.rgb;
      return `${ESC}${style.background ? 48 : 38};2;${r};${g};${b}m`;
    }

    case 'ansi256':
      return `${ESC}${style.background ? 48 : 38};5;${style.index}m`;
  }
}

function createAnsi(styles: StyleCode[] = []): Styled {
  const fn = (text: string | number): string => {
    if (styles.length === 0) return String(text);

    const opening = styles.map(renderStyle).join('');

    // Close styles in reverse order to avoid leaking formatting.
    const closing = [...styles]
      .reverse()
      .map((style) => {
        if (style.kind !== 'sgr') return RESET;

        // Foreground/background colors reset together; a full reset
        // is safest when mixed with other styles.
        if (style.code >= 30 && style.code <= 107) return RESET;

        return sgr(style.reset);
      })
      .join('');

    return `${opening}${text}${closing}`;
  };

  return new Proxy(fn, {
    get(target, property, receiver) {
      if (typeof property !== 'string') {
        return Reflect.get(target, property, receiver);
      }

      if (Object.hasOwn(codes, property)) {
        const code = codes[property as StyleName];
        const reset =
          property in resetCodes
            ? resetCodes[property as keyof typeof resetCodes]
            : 0;

        return createAnsi([...styles, { kind: 'sgr', code, reset }]);
      }

      if (property === 'rgb' || property === 'bgRgb') {
        return (r: number, g: number, b: number) => {
          validateChannel(r, 'r');
          validateChannel(g, 'g');
          validateChannel(b, 'b');

          return createAnsi([
            ...styles,
            { kind: 'rgb', rgb: [r, g, b], background: property === 'bgRgb' },
          ]);
        };
      }

      if (property === 'ansi256' || property === 'bgAnsi256') {
        return (index: number) => {
          validateIndex(index);

          return createAnsi([
            ...styles,
            { kind: 'ansi256', index, background: property === 'bgAnsi256' },
          ]);
        };
      }

      return Reflect.get(target, property, receiver);
    },
  }) as Styled;
}

export const ansi = createAnsi();
