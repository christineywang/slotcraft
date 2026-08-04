import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { ResourcesService } from "./resources.service";
import { CurrentUser, Roles } from "../auth/auth.decorators";
import type { AuthUser } from "../auth/auth.types";
import type {
  CreateResourceInput,
  UpdateResourceInput,
} from "@slotcraft/shared";

@Controller("resources")
export class ResourcesController {
  constructor(
    @Inject(ResourcesService) private readonly resources: ResourcesService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.resources.listForOrg(user.organizationId);
  }

  @Post()
  @Roles("owner", "admin")
  create(@CurrentUser() user: AuthUser, @Body() body: CreateResourceInput) {
    return this.resources.create(user.organizationId, body);
  }

  @Patch(":id")
  @Roles("owner", "admin")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: UpdateResourceInput,
  ) {
    return this.resources.update(id, user.organizationId, body);
  }

  @Delete(":id")
  @Roles("owner", "admin")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.resources.remove(id, user.organizationId);
  }
}
