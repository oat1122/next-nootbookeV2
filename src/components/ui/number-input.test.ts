import { describe, expect, it } from 'vitest';
import { groupThousands, stripNumeric } from './number-input';

describe('stripNumeric', () => {
  it('decimal: เก็บตัวเลข + จุดแรกเท่านั้น', () => {
    expect(stripNumeric('1,000', true)).toBe('1000');
    expect(stripNumeric('1,000.50', true)).toBe('1000.50');
    expect(stripNumeric('1.2.3', true)).toBe('1.23');
    expect(stripNumeric('฿ 12,345abc', true)).toBe('12345');
    expect(stripNumeric('1000.', true)).toBe('1000.');
  });
  it('integer: ตัดจุดและทุกอย่างที่ไม่ใช่ตัวเลข', () => {
    expect(stripNumeric('1,000', false)).toBe('1000');
    expect(stripNumeric('12.5', false)).toBe('125');
  });
});

describe('groupThousands', () => {
  it('คั่นหลักพันคงทศนิยม/จุดที่กำลังพิมพ์', () => {
    expect(groupThousands('')).toBe('');
    expect(groupThousands('1000')).toBe('1,000');
    expect(groupThousands('1000000')).toBe('1,000,000');
    expect(groupThousands('1000.5')).toBe('1,000.5');
    expect(groupThousands('1000.')).toBe('1,000.');
    expect(groupThousands('999')).toBe('999');
    expect(groupThousands('0.50')).toBe('0.50');
  });
});
