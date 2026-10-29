import { Injectable, NotFoundException, type CanActivate } from '@nestjs/common';

@Injectable()
export class DevelopmentOnlyGuard implements CanActivate {
  canActivate(): boolean {
    if (process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test') {
      throw new NotFoundException();
    }
    return true;
  }
}
