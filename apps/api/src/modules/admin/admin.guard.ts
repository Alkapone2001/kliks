import { createHash, timingSafeEqual } from 'node:crypto';
import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class DemoAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.DEMO_ADMIN_TOKEN;
    if (
      !['development', 'test'].includes(process.env.NODE_ENV ?? '') ||
      !expected ||
      expected.length < 32
    )
      throw new NotFoundException();
    const supplied: unknown = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, unknown> }>().headers['x-kliks-admin-token'];
    if (
      typeof supplied !== 'string' ||
      supplied.length > 256 ||
      !timingSafeEqual(
        createHash('sha256').update(expected).digest(),
        createHash('sha256').update(supplied).digest(),
      )
    )
      throw new UnauthorizedException('Separate demo administrator access is required.');
    return true;
  }
}
