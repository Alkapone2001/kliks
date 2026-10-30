import { HttpException, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';

interface RequestWindow {
  count: number;
  expiresAt: number;
}

const requestLimit = 30;
const requestWindowMs = 60_000;
const maxTrackedAddresses = 1_000;

@Injectable()
export class DirectoryRateLimitGuard implements CanActivate {
  private readonly requestsByAddress = new Map<string, RequestWindow>();

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      ip?: string;
      socket?: { remoteAddress?: string };
    }>();
    const address = request.ip ?? request.socket?.remoteAddress ?? 'unknown';
    const now = Date.now();
    let window = this.requestsByAddress.get(address);

    if (!window || window.expiresAt <= now) {
      if (!window && this.requestsByAddress.size >= maxTrackedAddresses) {
        this.removeExpiredWindows(now);
        if (this.requestsByAddress.size >= maxTrackedAddresses) {
          throw new HttpException('Too many directory requests.', 429);
        }
      }
      window = { count: 0, expiresAt: now + requestWindowMs };
      this.requestsByAddress.set(address, window);
    }
    if (window.count >= requestLimit) {
      throw new HttpException('Too many directory requests.', 429);
    }

    window.count += 1;
    return true;
  }

  private removeExpiredWindows(now: number): void {
    for (const [trackedAddress, trackedWindow] of this.requestsByAddress) {
      if (trackedWindow.expiresAt <= now) {
        this.requestsByAddress.delete(trackedAddress);
      }
    }
  }
}
