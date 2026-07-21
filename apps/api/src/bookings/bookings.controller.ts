import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { BookingsService } from "./bookings.service";
import { CurrentUser, Roles } from "../auth/auth.decorators";
import type { AuthUser } from "../auth/auth.types";
import type { CreateBookingInput } from "@slotcraft/shared";

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

  @Delete("bookings/:id")
  @Roles("owner", "admin", "member")
  cancel(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.bookings.cancel(user, id);
  }
}
