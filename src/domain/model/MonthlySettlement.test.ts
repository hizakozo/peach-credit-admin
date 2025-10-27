import { describe, it, expect } from 'vitest';
import { MonthlySettlement } from './MonthlySettlement';
import { YearMonth } from './YearMonth';
import { Money } from './Money';

describe('MonthlySettlement', () => {
  describe('constructor', () => {
    it('should create MonthlySettlement with valid values', () => {
      const yearMonth = new YearMonth(2024, 10);
      const husbandAmount = new Money(45894);
      const wifeAmount = new Money(45894);

      const settlement = new MonthlySettlement(yearMonth, husbandAmount, wifeAmount);

      expect(settlement.getYearMonth()).toBe(yearMonth);
      expect(settlement.getHusbandAmount()).toBe(husbandAmount);
      expect(settlement.getWifeAmount()).toBe(wifeAmount);
    });
  });

  describe('getTotalAmount', () => {
    it('should return sum of husband and wife amounts', () => {
      const yearMonth = new YearMonth(2024, 10);
      const husbandAmount = new Money(45894);
      const wifeAmount = new Money(45895);

      const settlement = new MonthlySettlement(yearMonth, husbandAmount, wifeAmount);

      expect(settlement.getTotalAmount().getValue()).toBe(91789);
    });

    it('should handle equal split correctly', () => {
      const yearMonth = new YearMonth(2024, 10);
      const husbandAmount = new Money(50000);
      const wifeAmount = new Money(50000);

      const settlement = new MonthlySettlement(yearMonth, husbandAmount, wifeAmount);

      expect(settlement.getTotalAmount().getValue()).toBe(100000);
    });
  });

  describe('formatMessage', () => {
    it('should format settlement message according to spec', () => {
      const yearMonth = new YearMonth(2024, 10);
      const husbandAmount = new Money(45894);
      const wifeAmount = new Money(45894);

      const settlement = new MonthlySettlement(yearMonth, husbandAmount, wifeAmount);
      const message = settlement.formatMessage();

      expect(message).toBe(
        '💳 今月の支払い金額が確定しました\n\n' +
        '【2024年10月分】\n\n' +
        '👨 45,894円\n' +
        '👩 45,894円'
      );
    });

    it('should format with different amounts', () => {
      const yearMonth = new YearMonth(2025, 1);
      const husbandAmount = new Money(50000);
      const wifeAmount = new Money(50001);

      const settlement = new MonthlySettlement(yearMonth, husbandAmount, wifeAmount);
      const message = settlement.formatMessage();

      expect(message).toBe(
        '💳 今月の支払い金額が確定しました\n\n' +
        '【2025年01月分】\n\n' +
        '👨 50,000円\n' +
        '👩 50,001円'
      );
    });
  });
});
