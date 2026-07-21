import { Module } from "@nestjs/common";
import { BookingsService } from "./bookings.service";
import { BookingsController } from "./bookings.controller";
import { ResourcesModule } from "../resources/resources.module";

@Module({
  imports: [ResourcesModule],
  controllers: [BookingsController],
  providers: [BookingsService],
})
export class BookingsModule {}
