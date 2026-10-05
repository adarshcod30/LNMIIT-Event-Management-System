const { classifyRole, validateEmail } = require('../../lib/roleClassifier');

describe('classifyRole', () => {
  it.each([
    ['admin@lnmiit.ac.in', 'admin'],
    ['  Admin@LNMIIT.ac.in  ', 'admin'],
  ])('%j is the admin', (email, role) => {
    expect(classifyRole(email)).toBe(role);
  });

  it.each([
    '23ucs509@lnmiit.ac.in',
    '22ece101@lnmiit.ac.in',
    '21mec045@lnmiit.ac.in',
    '23UCS509@LNMIIT.AC.IN',
  ])('%s is a student', (email) => {
    expect(classifyRole(email)).toBe('student');
  });

  it.each([
    'vikas.bajpai@lnmiit.ac.in',
    'vikasbajpai@lnmiit.ac.in',
    'john@lnmiit.ac.in',
    'a_b-c1@lnmiit.ac.in',
  ])('%s is faculty', (email) => {
    expect(classifyRole(email)).toBe('faculty');
  });

  it.each([
    ['visitor@gmail.com'],
    ['someone@sub.lnmiit.ac.in'],
    ['23ucs509@lnmiit.ac.in.evil.com'],
    ['admin@lnmiit.ac.in.evil.com'],
    ['23ucs509@lnmiit.com'],
  ])('%s is an outsider, however much it looks like LNMIIT', (email) => {
    expect(classifyRole(email)).toBe('outsider');
  });

  it.each([
    ['1abc@lnmiit.ac.in', 'starts with a digit but is not a roll number'],
    ['@lnmiit.ac.in', 'has no local part'],
    ['.hidden@lnmiit.ac.in', 'starts with a dot'],
    ['x@evil.com?@lnmiit.ac.in', 'smuggles a second address'],
    ['23ucs5099@lnmiit.ac.in', 'has four digits'],
  ])('%s is unrecognised (%s)', (email) => {
    expect(classifyRole(email)).toBe('unrecognised');
  });

  it.each([[null], [undefined], [42], [{}], [''], [[]]])('treats %p as unrecognised', (value) => {
    expect(classifyRole(value)).toBe('unrecognised');
  });
});

describe('validateEmail', () => {
  it('accepts every recognised kind of address and reports its role', () => {
    expect(validateEmail('23ucs509@lnmiit.ac.in')).toEqual({ valid: true, role: 'student' });
    expect(validateEmail('visitor@gmail.com')).toEqual({ valid: true, role: 'outsider' });
  });

  it('refuses an unrecognised institutional address with an explanation', () => {
    const result = validateEmail('1abc@lnmiit.ac.in');
    expect(result.valid).toBe(false);
    expect(result.role).toBe('unrecognised');
    expect(result.error).toMatch(/Unrecognised institutional email/);
  });
});
