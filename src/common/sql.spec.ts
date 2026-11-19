import { containsPattern } from './sql.js';

describe('containsPattern', () => {
  it('wraps the term for a contains match', () => {
    expect(containsPattern('pamp')).toBe('%pamp%');
  });

  it('escapes LIKE wildcards and the escape character', () => {
    expect(containsPattern('50%_off\\')).toBe('%50\\%\\_off\\\\%');
  });
});
