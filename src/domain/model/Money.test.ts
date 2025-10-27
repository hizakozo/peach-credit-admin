import { describe, it, expect } from 'vitest';
import { Money } from './Money';

describe('Money', () => {
  describe('constructor', () => {
    it('should create Money with valid positive amount', () => {
      const money = new Money(1000);
      expect(money.getValue()).toBe(1000);
    });

    it('should create Money with zero amount', () => {
      const money = new Money(0);
      expect(money.getValue()).toBe(0);
    });

    it('should throw error for negative amount', () => {
      expect(() => new Money(-100)).toThrow('Amount cannot be negative');
    });
  });

  describe('divide', () => {
    it('should divide amount by 2 and round down', () => {
      const money = new Money(91789);
      const divided = money.divide(2);
      expect(divided.getValue()).toBe(45894);
    });

    it('should divide odd amount and round down', () => {
      const money = new Money(1001);
      const divided = money.divide(2);
      expect(divided.getValue()).toBe(500);
    });

    it('should throw error when dividing by zero', () => {
      const money = new Money(1000);
      expect(() => money.divide(0)).toThrow('Cannot divide by zero');
    });

    it('should throw error when dividing by negative number', () => {
      const money = new Money(1000);
      expect(() => money.divide(-2)).toThrow('Divisor must be positive');
    });
  });

  describe('equals', () => {
    it('should return true for same amount', () => {
      const money1 = new Money(1000);
      const money2 = new Money(1000);
      expect(money1.equals(money2)).toBe(true);
    });

    it('should return false for different amount', () => {
      const money1 = new Money(1000);
      const money2 = new Money(2000);
      expect(money1.equals(money2)).toBe(false);
    });
  });

  describe('format', () => {
    it('should format amount with comma separator', () => {
      const money = new Money(45894);
      expect(money.format()).toBe('45,894円');
    });

    it('should format zero', () => {
      const money = new Money(0);
      expect(money.format()).toBe('0円');
    });

    it('should format large amount', () => {
      const money = new Money(1234567);
      expect(money.format()).toBe('1,234,567円');
    });
  });
});
