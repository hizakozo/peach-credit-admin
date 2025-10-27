import { describe, it, expect } from 'vitest';
import { SettlementCalculator } from './SettlementCalculator';
import { Money } from '../model/Money';
import { YearMonth } from '../model/YearMonth';

describe('SettlementCalculator', () => {
  const calculator = new SettlementCalculator();

  describe('calculate', () => {
    it('should split even amount equally', () => {
      const yearMonth = new YearMonth(2024, 10);
      const totalAmount = new Money(100000);

      const settlement = calculator.calculate(yearMonth, totalAmount);

      expect(settlement.getYearMonth()).toBe(yearMonth);
      expect(settlement.getHusbandAmount().getValue()).toBe(50000);
      expect(settlement.getWifeAmount().getValue()).toBe(50000);
    });

    it('should split odd amount with floor division', () => {
      const yearMonth = new YearMonth(2024, 10);
      const totalAmount = new Money(91789);

      const settlement = calculator.calculate(yearMonth, totalAmount);

      expect(settlement.getYearMonth()).toBe(yearMonth);
      expect(settlement.getHusbandAmount().getValue()).toBe(45894);
      expect(settlement.getWifeAmount().getValue()).toBe(45894);
    });

    it('should handle zero amount', () => {
      const yearMonth = new YearMonth(2024, 10);
      const totalAmount = new Money(0);

      const settlement = calculator.calculate(yearMonth, totalAmount);

      expect(settlement.getHusbandAmount().getValue()).toBe(0);
      expect(settlement.getWifeAmount().getValue()).toBe(0);
    });

    it('should handle amount of 1 yen', () => {
      const yearMonth = new YearMonth(2024, 10);
      const totalAmount = new Money(1);

      const settlement = calculator.calculate(yearMonth, totalAmount);

      expect(settlement.getHusbandAmount().getValue()).toBe(0);
      expect(settlement.getWifeAmount().getValue()).toBe(0);
    });

    it('should split large amount correctly', () => {
      const yearMonth = new YearMonth(2024, 10);
      const totalAmount = new Money(1234567);

      const settlement = calculator.calculate(yearMonth, totalAmount);

      expect(settlement.getHusbandAmount().getValue()).toBe(617283);
      expect(settlement.getWifeAmount().getValue()).toBe(617283);
    });
  });
});
