import { HttpException, type ExecutionContext } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { DirectoryRateLimitGuard } from '../src/modules/directory/directory-rate-limit.guard.js';

function contextFor(ip: string): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ ip }) }),
  } as unknown as ExecutionContext;
}

describe('DirectoryRateLimitGuard', () => {
  it('limits each IP to 30 requests per minute', () => {
    const guard = new DirectoryRateLimitGuard();
    const context = contextFor('192.0.2.1');

    for (let request = 0; request < 30; request += 1) {
      expect(guard.canActivate(context)).toBe(true);
    }
    try {
      guard.canActivate(context);
      throw new Error('Expected the directory request to be throttled.');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(429);
    }
    expect(guard.canActivate(contextFor('192.0.2.2'))).toBe(true);
  });

  it('bounds the number of tracked client addresses', () => {
    const guard = new DirectoryRateLimitGuard();
    for (let address = 0; address < 1_000; address += 1) {
      expect(guard.canActivate(contextFor(`192.0.2.${address}`))).toBe(true);
    }

    try {
      guard.canActivate(contextFor('198.51.100.1'));
      throw new Error('Expected an untracked address to be rejected at capacity.');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(429);
    }
  });
});
