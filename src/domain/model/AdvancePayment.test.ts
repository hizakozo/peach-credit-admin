import { describe, it, expect } from 'vitest';
import { AdvancePayment } from './AdvancePayment';
import { Money } from './Money';
import { Payer } from './Payer';

describe('AdvancePayment', () => {
  const samplePayment = new AdvancePayment(
    '1',
    new Date('2025-10-15'),
    Payer.HUSBAND,
    new Money(1000),
    'ランチ代'
  );

  describe('getters', () => {
    it('should return id', () => {
      expect(samplePayment.getId()).toBe('1');
    });

    it('should return date', () => {
      expect(samplePayment.getDate()).toEqual(new Date('2025-10-15'));
    });

    it('should return payer', () => {
      expect(samplePayment.getPayer().equals(Payer.HUSBAND)).toBe(true);
    });

    it('should return amount', () => {
      expect(samplePayment.getAmount().equals(new Money(1000))).toBe(true);
    });

    it('should return memo', () => {
      expect(samplePayment.getMemo()).toBe('ランチ代');
    });
  });

  describe('getFormattedDate', () => {
    it('should return date in YYYY-MM-DD format', () => {
      expect(samplePayment.getFormattedDate()).toBe('2025-10-15');
    });

    it('should pad single digit month and day with zero', () => {
      const payment = new AdvancePayment(
        '2',
        new Date('2025-01-05'),
        Payer.WIFE,
        new Money(500),
        'メモ'
      );
      expect(payment.getFormattedDate()).toBe('2025-01-05');
    });
  });

  describe('isInMonth', () => {
    it('should return true for same year and month', () => {
      expect(samplePayment.isInMonth(2025, 10)).toBe(true);
    });

    it('should return false for different year', () => {
      expect(samplePayment.isInMonth(2024, 10)).toBe(false);
    });

    it('should return false for different month', () => {
      expect(samplePayment.isInMonth(2025, 11)).toBe(false);
    });

    it('should return false for different year and month', () => {
      expect(samplePayment.isInMonth(2024, 11)).toBe(false);
    });
  });
});
