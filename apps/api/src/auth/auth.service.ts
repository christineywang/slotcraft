import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Inject,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { LoginSchema, type LoginInput } from "@slotcraft/shared";
import { PrismaService } from "../prisma/prisma.service";
import type { JwtPayload } from "./auth.types";

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JwtService) private readonly jwt: JwtService,
  ) {}

  async login(raw: LoginInput) {
    const parsed = LoginSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const user = await this.prisma.user.findUnique({
      where: { email: parsed.data.email.toLowerCase() },
      include: {
        memberships: {
          include: { organization: true },
          take: 1,
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const membership = user.memberships[0];
    if (!membership) {
      throw new UnauthorizedException("User has no organization membership");
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      organizationId: membership.organizationId,
      organizationName: membership.organization.name,
      role: membership.role,
    };

    return {
      accessToken: await this.jwt.signAsync(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      membership: {
        organizationId: membership.organizationId,
        organizationName: membership.organization.name,
        role: membership.role,
      },
    };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          include: { organization: true },
          take: 1,
        },
      },
    });
    if (!user || !user.memberships[0]) {
      throw new UnauthorizedException();
    }
    const membership = user.memberships[0];
    return {
      user: { id: user.id, email: user.email, name: user.name },
      membership: {
        organizationId: membership.organizationId,
        organizationName: membership.organization.name,
        role: membership.role,
      },
    };
  }
}
