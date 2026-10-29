export class Username {
  private constructor(readonly value: string) {}

  static parse(input: string): Username {
    const value = input.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9_]{2,29}$/.test(value)) {
      throw new RangeError(
        'Username must be 3 to 30 characters and use ASCII letters, numbers, or underscores.',
      );
    }
    return new Username(value);
  }
}
