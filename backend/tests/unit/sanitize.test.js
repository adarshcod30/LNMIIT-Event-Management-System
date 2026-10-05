const { escapeRegex, csvCell, csvRow, icsText, safeFilename, pickFields, truncate } = require('../../lib/sanitize');

describe('escapeRegex', () => {
  it.each([
    ['plain', 'plain'],
    ['a.b', 'a\\.b'],
    ['(((', '\\(\\(\\('],
    ['.*', '\\.\\*'],
    ['[x]+?', '\\[x\\]\\+\\?'],
    ['^$|\\', '\\^\\$\\|\\\\'],
  ])('%j becomes %j', (input, expected) => {
    expect(escapeRegex(input)).toBe(expected);
  });

  it('produces a pattern that matches the original text literally and nothing else', () => {
    const hostile = 'a.c(d)+';
    const re = new RegExp(escapeRegex(hostile));
    expect(re.test('xx a.c(d)+ yy')).toBe(true);
    expect(re.test('abc d')).toBe(false);
  });
});

describe('csvCell', () => {
  it.each([
    ['text', '"text"'],
    ['say "hi"', '"say ""hi"""'],
    ['a,b', '"a,b"'],
    ['line\nbreak', '"line\nbreak"'],
    [42, '"42"'],
    [false, '"false"'],
    [null, '""'],
    [undefined, '""'],
  ])('%p becomes %s', (input, expected) => {
    expect(csvCell(input)).toBe(expected);
  });

  it.each(['=1+1', '+SUM(A1)', '-2+3', '@SUM(1)', '\tTAB', '\rCR'])('defuses the formula %j', (input) => {
    expect(csvCell(input)).toBe(`"'${input}"`);
  });

  it('leaves values that merely contain a formula character alone', () => {
    expect(csvCell('a=b')).toBe('"a=b"');
    expect(csvCell('2030-01-01T00:00:00.000Z')).toBe('"2030-01-01T00:00:00.000Z"');
  });
});

describe('csvRow', () => {
  it('joins cells so a row always has exactly as many columns as values', () => {
    expect(csvRow(['a', 'b,c', 'd"e', null])).toBe('"a","b,c","d""e",""');
  });
});

describe('icsText', () => {
  it.each([
    ['plain text', 'plain text'],
    ['a,b;c', 'a\\,b\;c'],
    ['back\\slash', 'back\\\\slash'],
    ['one\ntwo', 'one\\ntwo'],
    ['one\r\ntwo', 'one\\ntwo'],
    ['bell\u0007here', 'bellhere'],
    [null, ''],
    [undefined, ''],
  ])('%j becomes %j', (input, expected) => {
    expect(icsText(input)).toBe(expected);
  });

  it('cannot start a new calendar property however the text is built', () => {
    const out = icsText('x\r\nATTENDEE:mailto:evil@example.com\nEND:VEVENT');
    expect(out).not.toMatch(/[\r\n]/);
  });
});

describe('safeFilename', () => {
  it.each([
    ['Hack the Hall', '.ics', 'Hack_the_Hall.ics'],
    ['../../etc/passwd', '.csv', 'etc_passwd.csv'],
    ['evil"\r\nheader: x', '.ics', 'evil_header_x.ics'],
    ['', '.csv', 'download.csv'],
    [null, '.csv', 'download.csv'],
    ['***', '.ics', 'download.ics'],
  ])('%j with %s gives %j', (name, ext, expected) => {
    expect(safeFilename(name, ext)).toBe(expected);
  });

  it('keeps long names to a sane length', () => {
    expect(safeFilename('a'.repeat(500), '.csv')).toHaveLength(84);
  });
});

describe('pickFields', () => {
  it('copies only the allowed keys that are present', () => {
    expect(pickFields({ a: 1, b: 2, c: 3 }, ['a', 'c', 'd'])).toEqual({ a: 1, c: 3 });
  });

  it('keeps falsy values that are real, and drops undefined', () => {
    expect(pickFields({ a: 0, b: '', c: false, d: null, e: undefined }, ['a', 'b', 'c', 'd', 'e'])).toEqual({ a: 0, b: '', c: false, d: null });
  });

  it('never copies __proto__, even if a caller lists it, so the result keeps a normal prototype', () => {
    const hostile = JSON.parse('{"__proto__": {"role": "admin"}, "name": "x"}');
    const picked = pickFields(hostile, ['name', '__proto__', 'constructor']);
    expect(picked).toEqual({ name: 'x' });
    expect(Object.getPrototypeOf(picked)).toBe(Object.prototype);
    expect(picked.role).toBeUndefined();
    expect({}.role).toBeUndefined();
  });

  it.each([[null], [undefined], ['string'], [42]])('returns an empty object for %p', (input) => {
    expect(pickFields(input, ['a'])).toEqual({});
  });
});

describe('truncate', () => {
  it('leaves short text alone and cuts long text to exactly the limit', () => {
    expect(truncate('short', 10)).toBe('short');
    expect(truncate('x'.repeat(50), 10)).toHaveLength(10);
    expect(truncate('x'.repeat(50), 10).endsWith('…')).toBe(true);
  });
});
