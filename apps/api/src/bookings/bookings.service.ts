import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  Inject,
} from "@nestjs/common";
import {
  CreateBookingSchema,
  UpdateBookingSchema,
  type CreateBookingInput,
  type UpdateBookingInput,
} from "@slotcraft/shared";
import { PrismaService } from "../prisma/prisma.service";
import { ResourcesService } from "../resources/resources.service";
import type { AuthUser } from "../auth/auth.types";
import {
  canMutateBooking,
  formatHourLabel,
  formatRange,
  isAtCapacity,
  isWithinAvailability,
  overlaps,
} from "./booking-rules";

type BookingRow = {
  id: string;
  resourceId: string;
  title: string;
  notes: string | null;
  startsAt: Date;
  endsAt: Date;
  status: string;
  host: { id: string; name: string; email: string };
};

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

    return bookings.map((b) => this.toDto(b));
  }

  /**
   * Conflict check: same resource, confirmed status, intersecting intervals.
   * Capacity > 1 allows concurrent bookings until the seat count is full.
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

    this.assertAvailability(resource, start, end);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.booking.findMany({
        where: {
          resourceId,
          status: "confirmed",
          startsAt: { lt: end },
          endsAt: { gt: start },
        },
        include: {
          host: { select: { id: true, name: true, email: true } },
        },
        orderBy: { startsAt: "asc" },
      });

      const overlapping = existing.filter((b) =>
        overlaps(start, end, b.startsAt, b.endsAt),
      );

      if (isAtCapacity(overlapping.length, resource.capacity)) {
        const conflict = overlapping[0]!;
        throw new ConflictException({
          statusCode: 409,
          message:
            resource.capacity === 1
              ? `${resource.name} is already booked ${formatRange(conflict.startsAt, conflict.endsAt)} by ${conflict.host.name}`
              : `${resource.name} is at capacity (${resource.capacity}/${resource.capacity}) ${formatRange(conflict.startsAt, conflict.endsAt)} — overlapping with ${conflict.title} by ${conflict.host.name}`,
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

      return this.toDto(booking);
    });
  }

  async update(user: AuthUser, bookingId: string, raw: UpdateBookingInput) {
    if (user.role === "viewer") {
      throw new ForbiddenException("Viewers can’t update bookings");
    }

    const parsed = UpdateBookingSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        resource: true,
        host: { select: { id: true, name: true, email: true } },
      },
    });
    if (!booking || booking.resource.organizationId !== user.organizationId) {
      throw new NotFoundException("Booking not found");
    }
    if (booking.status === "cancelled") {
      throw new BadRequestException("Cancelled bookings can’t be updated");
    }
    if (!canMutateBooking(user.role, booking.hostId, user.sub)) {
      throw new ForbiddenException("You can only edit your own bookings");
    }

    const start = parsed.data.startsAt
      ? new Date(parsed.data.startsAt)
      : booking.startsAt;
    const end = parsed.data.endsAt
      ? new Date(parsed.data.endsAt)
      : booking.endsAt;

    if (end <= start) {
      throw new BadRequestException("endsAt must be after startsAt");
    }

    this.assertAvailability(booking.resource, start, end);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.booking.findMany({
        where: {
          resourceId: booking.resourceId,
          status: "confirmed",
          id: { not: bookingId },
          startsAt: { lt: end },
          endsAt: { gt: start },
        },
        include: {
          host: { select: { id: true, name: true, email: true } },
        },
        orderBy: { startsAt: "asc" },
      });

      const overlapping = existing.filter((b) =>
        overlaps(start, end, b.startsAt, b.endsAt),
      );

      if (isAtCapacity(overlapping.length, booking.resource.capacity)) {
        const conflict = overlapping[0]!;
        throw new ConflictException({
          statusCode: 409,
          message:
            booking.resource.capacity === 1
              ? `${booking.resource.name} is already booked ${formatRange(conflict.startsAt, conflict.endsAt)} by ${conflict.host.name}`
              : `${booking.resource.name} is at capacity (${booking.resource.capacity}/${booking.resource.capacity}) — overlapping with ${conflict.title} by ${conflict.host.name}`,
          conflict: {
            bookingId: conflict.id,
            title: conflict.title,
            startsAt: conflict.startsAt.toISOString(),
            endsAt: conflict.endsAt.toISOString(),
            hostName: conflict.host.name,
          },
        });
      }

      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: {
          title: parsed.data.title ?? booking.title,
          notes:
            parsed.data.notes !== undefined
              ? parsed.data.notes
              : booking.notes,
          startsAt: start,
          endsAt: end,
        },
        include: {
          host: { select: { id: true, name: true, email: true } },
        },
      });

      return this.toDto(updated);
    });
  }

  async cancel(user: AuthUser, bookingId: string) {
    if (user.role === "viewer") {
      throw new ForbiddenException("Viewers can’t cancel bookings");
    }

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        resource: true,
        host: { select: { id: true, name: true, email: true } },
      },
    });
    if (!booking || booking.resource.organizationId !== user.organizationId) {
      throw new NotFoundException("Booking not found");
    }
    if (!canMutateBooking(user.role, booking.hostId, user.sub)) {
      throw new ForbiddenException("You can only cancel your own bookings");
    }

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: "cancelled" },
      include: {
        host: { select: { id: true, name: true, email: true } },
      },
    });

    return this.toDto(updated);
  }

  private assertAvailability(
    resource: {
      name: string;
      availableFromHour: number;
      availableToHour: number;
    },
    start: Date,
    end: Date,
  ) {
    if (
      !isWithinAvailability(
        start,
        end,
        resource.availableFromHour,
        resource.availableToHour,
      )
    ) {
      throw new BadRequestException(
        `${resource.name} is only bookable ${formatHourLabel(resource.availableFromHour)}–${formatHourLabel(resource.availableToHour)}`,
      );
    }
  }

  private toDto(booking: BookingRow) {
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
  }
}
