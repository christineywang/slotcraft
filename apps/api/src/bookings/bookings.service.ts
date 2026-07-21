import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  Inject,
} from "@nestjs/common";
import { CreateBookingSchema, type CreateBookingInput } from "@slotcraft/shared";
import { PrismaService } from "../prisma/prisma.service";
import { ResourcesService } from "../resources/resources.service";
import type { AuthUser } from "../auth/auth.types";

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && aEnd > bStart;
}

function formatRange(startsAt: Date, endsAt: Date) {
  const opts: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
  };
  return `${startsAt.toLocaleTimeString("en-US", opts)}–${endsAt.toLocaleTimeString("en-US", opts)}`;
}

@Injectable()
export class BookingsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ResourcesService) private readonly resources: ResourcesService,
  ) {}

  async listForResource(
    resourceId: string,
    organizationId: string,
    from: string,
    to: string,
  ) {
    await this.resources.getInOrg(resourceId, organizationId);
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      throw new BadRequestException("from and to must be ISO datetimes");
    }

    const bookings = await this.prisma.booking.findMany({
      where: {
        resourceId,
        status: "confirmed",
        startsAt: { lt: toDate },
        endsAt: { gt: fromDate },
      },
      include: {
        host: { select: { id: true, name: true, email: true } },
      },
      orderBy: { startsAt: "asc" },
    });

    return bookings.map((b) => ({
      id: b.id,
      resourceId: b.resourceId,
      title: b.title,
      notes: b.notes,
      startsAt: b.startsAt.toISOString(),
      endsAt: b.endsAt.toISOString(),
      status: b.status,
      host: b.host,
    }));
  }

  /**
   * Conflict check: same resource, confirmed status, intersecting intervals.
   * Runs inside a transaction so concurrent creates still serialize.
   */
  async create(user: AuthUser, raw: CreateBookingInput) {
    if (user.role === "viewer") {
      throw new ForbiddenException("Viewers can’t create bookings");
    }

    const parsed = CreateBookingSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const { resourceId, title, notes, startsAt, endsAt } = parsed.data;
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    const resource = await this.resources.getInOrg(
      resourceId,
      user.organizationId,
    );

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.booking.findMany({
        where: {
          resourceId,
          status: "confirmed",
          startsAt: { lt: end },
          endsAt: { gt: start },
        },
        include: {
          host: { select: { name: true } },
        },
        orderBy: { startsAt: "asc" },
      });

      const conflict = existing.find((b) =>
        overlaps(start, end, b.startsAt, b.endsAt),
      );

      if (conflict) {
        throw new ConflictException({
          statusCode: 409,
          message: `${resource.name} is already booked ${formatRange(conflict.startsAt, conflict.endsAt)} by ${conflict.host.name}`,
          conflict: {
            bookingId: conflict.id,
            title: conflict.title,
            startsAt: conflict.startsAt.toISOString(),
            endsAt: conflict.endsAt.toISOString(),
            hostName: conflict.host.name,
          },
        });
      }

      const booking = await tx.booking.create({
        data: {
          resourceId,
          hostId: user.sub,
          title,
          notes,
          startsAt: start,
          endsAt: end,
          status: "confirmed",
        },
        include: {
          host: { select: { id: true, name: true, email: true } },
        },
      });

      return {
        id: booking.id,
        resourceId: booking.resourceId,
        title: booking.title,
        notes: booking.notes,
        startsAt: booking.startsAt.toISOString(),
        endsAt: booking.endsAt.toISOString(),
        status: booking.status,
        host: booking.host,
      };
    });
  }

  async cancel(user: AuthUser, bookingId: string) {
    if (user.role === "viewer") {
      throw new ForbiddenException("Viewers can’t cancel bookings");
    }

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { resource: true },
    });
    if (!booking || booking.resource.organizationId !== user.organizationId) {
      throw new NotFoundException("Booking not found");
    }

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: "cancelled" },
      include: {
        host: { select: { id: true, name: true, email: true } },
      },
    });

    return {
      id: updated.id,
      resourceId: updated.resourceId,
      title: updated.title,
      notes: updated.notes,
      startsAt: updated.startsAt.toISOString(),
      endsAt: updated.endsAt.toISOString(),
      status: updated.status,
      host: updated.host,
    };
  }
}
