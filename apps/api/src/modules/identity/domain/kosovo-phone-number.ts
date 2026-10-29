import { parsePhoneNumberFromString } from 'libphonenumber-js';

export class KosovoPhoneNumber {
  private constructor(readonly e164: string) {}

  static parse(input: string): KosovoPhoneNumber {
    const parsed = parsePhoneNumberFromString(input.trim(), {
      defaultCountry: 'XK',
      extract: false,
    });

    if (!parsed || parsed.country !== 'XK' || !parsed.isValid() || parsed.ext) {
      throw new RangeError('Enter a valid Kosovo phone number.');
    }

    return new KosovoPhoneNumber(parsed.number);
  }
}
