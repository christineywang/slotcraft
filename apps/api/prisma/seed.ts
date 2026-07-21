import { PrismaClient, Role } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { DEMO_CREDENTIALS } from "@slotcraft/shared";

const prisma = new PrismaClient();

async function main() {
  await prisma.booking.deleteMany();
  await prisma.resource.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash(DEMO_CREDENTIALS.admin.password, 10);

  const admin = await prisma.user.create({
    data: {
      email: DEMO_CREDENTIALS.admin.email,
      name: "Alex Admin",
      passwordHash,
    },
  });

  const viewer = await prisma.user.create({
    data: {
      email: DEMO_CREDENTIALS.viewer.email,
      name: "Vera Viewer",
      passwordHash,
    },
  });

  const member = await prisma.user.create({
    data: {
      email: "member@slotcraft.local",
      name: "Morgan Member",
      passwordHash,
    },
  });

  const org = await prisma.organization.create({
    data: {
      name: "Northlight Studios",
      members: {
        create: [
          { userId: admin.id, role: Role.admin },
          { userId: viewer.id, role: Role.viewer },
          { userId: member.id, role: Role.member },
        ],
      },
      resources: {
        create: [
          { name: "Studio A", timezone: "America/Los_Angeles", capacity: 1 },
          { name: "Boardroom", timezone: "America/Los_Angeles", capacity: 1 },
          { name: "Desk 12", timezone: "America/Los_Angeles", capacity: 1 },
        ],
      },
    },
    include: { resources: true },
  });

  const studioA = org.resources.find((r) => r.name === "Studio A")!;
  const boardroom = org.resources.find((r) => r.name === "Boardroom")!;

  // Seed mid-afternoon Wednesday of the current local week (easy conflict demo).
  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  const day = weekStart.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  weekStart.setDate(weekStart.getDate() + diffToMon);
  const wednesday = new Date(weekStart);
  wednesday.setDate(weekStart.getDate() + 2);
  wednesday.setHours(14, 0, 0, 0);
  const wednesdayEnd = new Date(wednesday);
  wednesdayEnd.setHours(15, 0, 0, 0);

  await prisma.booking.create({
    data: {
      resourceId: studioA.id,
      hostId: admin.id,
      title: "Product sync",
      notes: "Seeded booking for conflict demos",
      startsAt: wednesday,
      endsAt: wednesdayEnd,
      status: "confirmed",
    },
  });

  const thursday = new Date(wednesday);
  thursday.setDate(wednesday.getDate() + 1);
  const thursdayEnd = new Date(wednesdayEnd);
  thursdayEnd.setDate(wednesdayEnd.getDate() + 1);

  await prisma.booking.create({
    data: {
      resourceId: boardroom.id,
      hostId: member.id,
      title: "Design critique",
      startsAt: thursday,
      endsAt: thursdayEnd,
      status: "confirmed",
    },
  });

  console.log("Seeded Slotcraft demo data");
  console.log(`  Admin:  ${DEMO_CREDENTIALS.admin.email} / ${DEMO_CREDENTIALS.admin.password}`);
  console.log(`  Viewer: ${DEMO_CREDENTIALS.viewer.email} / ${DEMO_CREDENTIALS.viewer.password}`);
  console.log(`  Org:    ${org.name} (${org.resources.length} resources)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
