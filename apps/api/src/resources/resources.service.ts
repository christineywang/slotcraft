import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CreateResourceSchema,
  UpdateResourceSchema,
  type CreateResourceInput,
  type UpdateResourceInput,
} from "@slotcraft/shared";
import { PrismaService } from "../prisma/prisma.service";

const resourceSelect = {
  id: true,
  name: true,
  timezone: true,
  capacity: true,
  availableFromHour: true,
  availableToHour: true,
} as const;

@Injectable()
export class ResourcesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  listForOrg(organizationId: string) {
    return this.prisma.resource.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
      select: resourceSelect,
    });
  }

  async getInOrg(resourceId: string, organizationId: string) {
    const resource = await this.prisma.resource.findFirst({
      where: { id: resourceId, organizationId },
    });
    if (!resource) {
      throw new NotFoundException("Resource not found");
    }
    return resource;
  }

  create(organizationId: string, raw: CreateResourceInput) {
    const parsed = CreateResourceSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.prisma.resource.create({
      data: {
        organizationId,
        name: parsed.data.name,
        timezone: parsed.data.timezone,
        capacity: parsed.data.capacity,
        availableFromHour: parsed.data.availableFromHour,
        availableToHour: parsed.data.availableToHour,
      },
      select: resourceSelect,
    });
  }

  async update(
    resourceId: string,
    organizationId: string,
    raw: UpdateResourceInput,
  ) {
    const parsed = UpdateResourceSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const existing = await this.getInOrg(resourceId, organizationId);
    const availableFromHour =
      parsed.data.availableFromHour ?? existing.availableFromHour;
    const availableToHour =
      parsed.data.availableToHour ?? existing.availableToHour;

    if (availableToHour <= availableFromHour) {
      throw new BadRequestException(
        "availableToHour must be after availableFromHour",
      );
    }

    return this.prisma.resource.update({
      where: { id: resourceId },
      data: {
        name: parsed.data.name,
        timezone: parsed.data.timezone,
        capacity: parsed.data.capacity,
        availableFromHour: parsed.data.availableFromHour,
        availableToHour: parsed.data.availableToHour,
      },
      select: resourceSelect,
    });
  }

  async remove(resourceId: string, organizationId: string) {
    await this.getInOrg(resourceId, organizationId);
    await this.prisma.resource.delete({ where: { id: resourceId } });
    return { id: resourceId, deleted: true };
  }
}
