import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ResourcesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  listForOrg(organizationId: string) {
    return this.prisma.resource.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        timezone: true,
        capacity: true,
      },
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
}
