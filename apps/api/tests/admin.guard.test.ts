import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import { DemoAdminGuard } from '../src/modules/admin/admin.guard.js';

const token = 'isolated-admin-test-token-with-at-least-32-characters';
function context(value?: unknown) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers: { 'x-kliks-admin-token': value } }) }),
  } as ExecutionContext;
}
afterEach(() => vi.unstubAllEnvs());
describe('separate demo admin guard', () => {
  it('fails closed without configuration and outside development/test', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('DEMO_ADMIN_TOKEN', '');
    expect(() => new DemoAdminGuard().canActivate(context(token))).toThrow();
    vi.stubEnv('DEMO_ADMIN_TOKEN', token);
    vi.stubEnv('NODE_ENV', 'production');
    expect(() => new DemoAdminGuard().canActivate(context(token))).toThrow();
  });
  it('rejects shared login values, client IDs, absent and malformed headers', () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('DEMO_ADMIN_TOKEN', token);
    for (const value of [undefined, 'demo', 'a-user-id', ['anything'], 'x'.repeat(257)])
      expect(() => new DemoAdminGuard().canActivate(context(value))).toThrow();
  });
  it('accepts only the independently configured administrator token', () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('DEMO_ADMIN_TOKEN', token);
    expect(new DemoAdminGuard().canActivate(context(token))).toBe(true);
    expect(() => new DemoAdminGuard().canActivate(context(token + 'x'))).toThrow();
  });
});
