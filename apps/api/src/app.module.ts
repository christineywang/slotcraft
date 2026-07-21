import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { ResourcesModule } from "./resources/resources.module";
import { BookingsModule } from "./bookings/bookings.module";
import { HealthController } from "./health.controller";

@Module({
  imports: [PrismaModule, AuthModule, ResourcesModule, BookingsModule],
  controllers: [HealthController],
})
export class AppModule {}
