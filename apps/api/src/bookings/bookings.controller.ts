import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { BookingsService } from "./bookings.service";
import { CurrentUser, Roles } from "../auth/auth.decorators";
import type { AuthUser } from "../auth/auth.types";
import type {
  CreateBookingInput,
  UpdateBookingInput,
} from "@slotcraft/shared";

@Controller()
export class BookingsController {
  constructor(
    @Inject(BookingsService) private readonly bookings: BookingsService,
  ) {}

  @Get("resources/:resourceId/bookings")
  list(
    @CurrentUser() user: AuthUser,
    @Param("resourceId") resourceId: string,
    @Query("from") from: string,
    @Query("to") to: string,
  ) {
    return this.bookings.listForResource(
      resourceId,
      user.organizationId,
      from,
      to,
    );
  }

  @Post("bookings")
  @Roles("owner", "admin", "member")
  create(@CurrentUser() user: AuthUser, @Body() body: CreateBookingInput) {
    return this.bookings.create(user, body);
  }

  @Patch("bookings/:id")
  @Roles("owner", "admin", "member")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: UpdateBookingInput,
  ) {
    return this.bookings.update(user, id, body);
  }

  @Delete("bookings/:id")
  @Roles("owner", "admin", "member")
  cancel(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.bookings.cancel(user, id);
  }
}
