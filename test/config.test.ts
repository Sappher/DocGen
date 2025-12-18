import { describe, expect, it } from 'vitest';

import { parseConfluencePageMapInput } from '../src/config/inputs';

describe('parseConfluencePageMapInput', () => {
  it('parses newline separated entries', () => {
    const mapping = parseConfluencePageMapInput('ARCH.md=123\nsub/doc.md=456');
    expect(mapping).toEqual({ 'ARCH.md': '123', 'sub/doc.md': '456' });
  });

  it('parses JSON payloads', () => {
    const mapping = parseConfluencePageMapInput('{"ARCH.md":"123"}');
    expect(mapping).toEqual({ 'ARCH.md': '123' });
  });

  it('throws on malformed lines', () => {
    expect(() => parseConfluencePageMapInput('foo')).toThrow();
  });
});
