import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Role } from "@slotcraft/shared";
import { ROLES_KEY } from "./auth.decorators";
import type { AuthUser } from "./auth.types";

@Injectable()
export class RolesGuard implements CanActivate {
  // Constructed directly: tsx watch does not emit design:paramtypes for DI.
  private readonly reflector = new Reflector();

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = request.user;
    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException(
        user?.role === "viewer"
          ? "Viewers can’t create bookings"
          : "You do not have permission for this action",
      );
    }
    return true;
  }
}
