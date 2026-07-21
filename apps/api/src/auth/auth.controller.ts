import { Body, Controller, Get, Inject, Post } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { CurrentUser, Public } from "./auth.decorators";
import type { AuthUser } from "./auth.types";
import type { LoginInput } from "@slotcraft/shared";

@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Public()
  @Post("login")
  login(@Body() body: LoginInput) {
    return this.auth.login(body);
  }

  @Get("me")
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.sub);
  }
}
