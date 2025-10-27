import { describe, it, expect } from 'vitest';
import { YearMonth } from './YearMonth';

describe('YearMonth', () => {
  describe('constructor', () => {
    it('should create YearMonth with valid year and month', () => {
      const ym = new YearMonth(2024, 10);
      expect(ym.getYear()).toBe(2024);
      expect(ym.getMonth()).toBe(10);
    });

    it('should throw error for invalid month (0)', () => {
      expect(() => new YearMonth(2024, 0)).toThrow('Month must be between 1 and 12');
    });

    it('should throw error for invalid month (13)', () => {
      expect(() => new YearMonth(2024, 13)).toThrow('Month must be between 1 and 12');
    });

    it('should throw error for negative year', () => {
      expect(() => new YearMonth(-2024, 10)).toThrow('Year must be positive');
    });
  });

  describe('fromDate', () => {
    it('should create YearMonth from Date object', () => {
      const date = new Date('2024-10-27');
      const ym = YearMonth.fromDate(date);
      expect(ym.getYear()).toBe(2024);
      expect(ym.getMonth()).toBe(10);
    });

    it('should handle January correctly', () => {
      const date = new Date('2024-01-15');
      const ym = YearMonth.fromDate(date);
      expect(ym.getYear()).toBe(2024);
      expect(ym.getMonth()).toBe(1);
    });

    it('should handle December correctly', () => {
      const date = new Date('2024-12-31');
      const ym = YearMonth.fromDate(date);
      expect(ym.getYear()).toBe(2024);
      expect(ym.getMonth()).toBe(12);
    });
  });

  describe('equals', () => {
    it('should return true for same year and month', () => {
      const ym1 = new YearMonth(2024, 10);
      const ym2 = new YearMonth(2024, 10);
      expect(ym1.equals(ym2)).toBe(true);
    });

    it('should return false for different month', () => {
      const ym1 = new YearMonth(2024, 10);
      const ym2 = new YearMonth(2024, 11);
      expect(ym1.equals(ym2)).toBe(false);
    });

    it('should return false for different year', () => {
      const ym1 = new YearMonth(2024, 10);
      const ym2 = new YearMonth(2025, 10);
      expect(ym1.equals(ym2)).toBe(false);
    });
  });

  describe('format', () => {
    it('should format as "YYYY年MM月"', () => {
      const ym = new YearMonth(2024, 10);
      expect(ym.format()).toBe('2024年10月');
    });

    it('should format single digit month with zero padding', () => {
      const ym = new YearMonth(2024, 5);
      expect(ym.format()).toBe('2024年05月');
    });
  });
});
