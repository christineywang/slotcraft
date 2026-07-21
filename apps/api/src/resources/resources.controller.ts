import { Controller, Get, Inject } from "@nestjs/common";
import { ResourcesService } from "./resources.service";
import { CurrentUser } from "../auth/auth.decorators";
import type { AuthUser } from "../auth/auth.types";

@Controller("resources")
export class ResourcesController {
  constructor(
    @Inject(ResourcesService) private readonly resources: ResourcesService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.resources.listForOrg(user.organizationId);
  }
}
