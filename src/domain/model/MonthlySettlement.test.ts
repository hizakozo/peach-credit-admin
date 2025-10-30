import { describe, it, expect } from 'vitest';
import { MonthlySettlement } from './MonthlySettlement';
import { YearMonth } from './YearMonth';
import { Money } from './Money';

describe('MonthlySettlement', () => {
  describe('constructor', () => {
    it('should create MonthlySettlement with valid values', () => {
      const yearMonth = new YearMonth(2024, 10);
      const creditCardTotal = new Money(91788);
      const husbandAmount = new Money(45894);
      const wifeAmount = new Money(45894);

      const settlement = new MonthlySettlement(yearMonth, creditCardTotal, husbandAmount, wifeAmount);

      expect(settlement.getYearMonth()).toBe(yearMonth);
      expect(settlement.getCreditCardTotal()).toBe(creditCardTotal);
      expect(settlement.getHusbandAmount()).toBe(husbandAmount);
      expect(settlement.getWifeAmount()).toBe(wifeAmount);
    });
  });

  describe('getTotalAmount', () => {
    it('should return sum of husband and wife amounts', () => {
      const yearMonth = new YearMonth(2024, 10);
      const creditCardTotal = new Money(91789);
      const husbandAmount = new Money(45894);
      const wifeAmount = new Money(45895);

      const settlement = new MonthlySettlement(yearMonth, creditCardTotal, husbandAmount, wifeAmount);

      expect(settlement.getTotalAmount().getValue()).toBe(91789);
    });

    it('should handle equal split correctly', () => {
      const yearMonth = new YearMonth(2024, 10);
      const creditCardTotal = new Money(100000);
      const husbandAmount = new Money(50000);
      const wifeAmount = new Money(50000);

      const settlement = new MonthlySettlement(yearMonth, creditCardTotal, husbandAmount, wifeAmount);

      expect(settlement.getTotalAmount().getValue()).toBe(100000);
    });
  });

  describe('formatMessage', () => {
    it('should format settlement message according to spec', () => {
      const yearMonth = new YearMonth(2024, 10);
      const creditCardTotal = new Money(91788);
      const husbandAmount = new Money(45894);
      const wifeAmount = new Money(45894);

      const settlement = new MonthlySettlement(yearMonth, creditCardTotal, husbandAmount, wifeAmount);
      const message = settlement.formatMessage();

      expect(message).toBe(
        '💳 今月の支払い金額が確定しました\n\n' +
        '【2024年10月支払い分】\n\n' +
        'カード合計: 91,788円\n\n' +
        '👨 45,894円\n' +
        '👩 45,894円'
      );
    });

    it('should format with different amounts', () => {
      const yearMonth = new YearMonth(2025, 1);
      const creditCardTotal = new Money(100001);
      const husbandAmount = new Money(50000);
      const wifeAmount = new Money(50001);

      const settlement = new MonthlySettlement(yearMonth, creditCardTotal, husbandAmount, wifeAmount);
      const message = settlement.formatMessage();

      expect(message).toBe(
        '💳 今月の支払い金額が確定しました\n\n' +
        '【2025年01月支払い分】\n\n' +
        'カード合計: 100,001円\n\n' +
        '👨 50,000円\n' +
        '👩 50,001円'
      );
    });
  });
});
