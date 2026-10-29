import { NotFoundException } from '@nestjs/common';
import { afterEach, describe, expect, it } from 'vitest';
import { DevelopmentOnlyGuard } from '../src/modules/identity/development-only.guard.js';
import { KosovoPhoneNumber } from '../src/modules/identity/domain/kosovo-phone-number.js';
import { Username } from '../src/modules/identity/domain/username.js';

describe('KosovoPhoneNumber', () => {
  it('normalizes national and international Kosovo numbers to E.164', () => {
    expect(KosovoPhoneNumber.parse('044 123 456').e164).toBe('+38344123456');
    expect(KosovoPhoneNumber.parse('+383 44 123 456').e164).toBe('+38344123456');
  });

  it.each(['not a number', '044 123', '+355 69 123 4567', '+383 44 123 456 ext 12'])(
    'rejects invalid or non-Kosovo phone input: %s',
    (input) => {
      expect(() => KosovoPhoneNumber.parse(input)).toThrow(RangeError);
    },
  );
});

describe('Username', () => {
  it('trims and canonicalizes usernames to lowercase ASCII', () => {
    expect(Username.parse('  Arta_7  ').value).toBe('arta_7');
  });

  it.each(['ab', 'starts-with-hyphen', 'has space', 'përdorues', 'bad.name'])(
    'rejects %s',
    (input) => {
      expect(() => Username.parse(input)).toThrow(RangeError);
    },
  );
});

describe('DevelopmentOnlyGuard', () => {
  const originalEnvironment = process.env.NODE_ENV;

  afterEach(() => {
    if (originalEnvironment === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalEnvironment;
    }
  });

  it('hides identity endpoints in production', () => {
    process.env.NODE_ENV = 'production';
    expect(() => new DevelopmentOnlyGuard().canActivate()).toThrow(NotFoundException);
  });

  it('fails closed when NODE_ENV is unset', () => {
    delete process.env.NODE_ENV;
    expect(() => new DevelopmentOnlyGuard().canActivate()).toThrow(NotFoundException);
  });

  it('allows identity endpoints outside production', () => {
    process.env.NODE_ENV = 'development';
    expect(new DevelopmentOnlyGuard().canActivate()).toBe(true);
  });
});
