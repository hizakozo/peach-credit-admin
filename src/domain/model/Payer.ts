/**
 * 支払者
 * 夫または妻
 */
export class Payer {
  static readonly HUSBAND = new Payer('夫');
  static readonly WIFE = new Payer('妻');

  private constructor(private readonly value: string) {}

  getValue(): string {
    return this.value;
  }

  equals(other: Payer): boolean {
    return this.value === other.value;
  }

  /**
   * 文字列から Payer を生成
   */
  static fromString(value: string): Payer {
    if (value === '夫') return Payer.HUSBAND;
    if (value === '妻') return Payer.WIFE;
    throw new Error(`Invalid payer value: ${value}`);
  }
}
