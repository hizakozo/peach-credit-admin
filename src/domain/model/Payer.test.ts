import { describe, it, expect } from 'vitest';
import { Payer } from './Payer';

describe('Payer', () => {
  describe('getValue', () => {
    it('should return husband value', () => {
      expect(Payer.HUSBAND.getValue()).toBe('夫');
    });

    it('should return wife value', () => {
      expect(Payer.WIFE.getValue()).toBe('妻');
    });
  });

  describe('equals', () => {
    it('should return true for same payer', () => {
      expect(Payer.HUSBAND.equals(Payer.HUSBAND)).toBe(true);
      expect(Payer.WIFE.equals(Payer.WIFE)).toBe(true);
    });

    it('should return false for different payer', () => {
      expect(Payer.HUSBAND.equals(Payer.WIFE)).toBe(false);
      expect(Payer.WIFE.equals(Payer.HUSBAND)).toBe(false);
    });
  });

  describe('fromString', () => {
    it('should create HUSBAND from string', () => {
      const payer = Payer.fromString('夫');
      expect(payer.equals(Payer.HUSBAND)).toBe(true);
    });

    it('should create WIFE from string', () => {
      const payer = Payer.fromString('妻');
      expect(payer.equals(Payer.WIFE)).toBe(true);
    });

    it('should throw error for invalid value', () => {
      expect(() => Payer.fromString('無効')).toThrow('Invalid payer value: 無効');
    });
  });
});
