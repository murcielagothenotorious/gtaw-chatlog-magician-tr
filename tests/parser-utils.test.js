import { describe, it, expect } from 'vitest';
import * as utils from '../js/parser-utils.js';

describe('parser-utils', () => {
  it('replaceDashes converts ...- and -... to em dash', () => {
    expect(utils.replaceDashes('hello...-world')).toBe('hello—world');
    expect(utils.replaceDashes('hello-. . .')).toContain('hello');
  });

  it('replaceCurlyApostrophes normalizes fancy quotes', () => {
    expect(utils.replaceCurlyApostrophes("It’s fine")).toBe("It's fine");
  });

  it('wrapSpan outputs invisible censored-remove span in remove mode (default)', () => {
    const html = utils.wrapSpan('white', "Hello ÷secret÷ world");
    expect(html).toContain('<span class="white colorable">Hello</span>');
    expect(html).toContain('censored-content');
    expect(html).toContain('censored-remove');
    expect(html).toContain('data-original="secret"');
    expect(html).toContain('<span class="white colorable">world</span>');
  });

  it('wrapSpan shows colorable blurred censored text with color class in blur mode', () => {
    const html = utils.wrapSpan('white', "Hello ÷secret÷ world", 'blur');
    expect(html).toContain('<span class="white colorable">Hello</span>');
    expect(html).toContain('censored-content');
    expect(html).toContain('blur-mode');
    expect(html).toContain('colorable');
    expect(html).toContain('class="white censored-content blur-mode colorable"');
    expect(html).toContain('data-original="secret"');
    expect(html).toContain('<span class="white colorable">world</span>');
  });

  it('formatSaysLine colors based on speaker and target', () => {
    const line = 'Alice says (to Bob): Hi';
    const forBob = utils.formatSaysLine(line, 'Bob', false);
    expect(forBob).toContain('class="white');

    const forCarol = utils.formatSaysLine(line, 'Carol', false);
    expect(forCarol).toContain('class="lightgrey');

    const fromAliceForAlice = utils.formatSaysLine('Alice says: Hi', 'Alice', false);
    expect(fromAliceForAlice).toContain('class="white');
  });

  it('formatSaysLine preserves [!] leading marker with special handling', () => {
    const emph = utils.formatSaysLine('[!] Alice says: Urgent', 'Dave', false);
    expect(emph).toContain('[!]');
    expect(emph).toContain('colorable');
  });
});


