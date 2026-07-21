import { z } from "zod";

export const RoleSchema = z.enum(["owner", "admin", "member", "viewer"]);
export type Role = z.infer<typeof RoleSchema>;

export const BookingStatusSchema = z.enum(["confirmed", "cancelled"]);
export type BookingStatus = z.infer<typeof BookingStatusSchema>;

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const CreateBookingSchema = z
  .object({
    resourceId: z.string().min(1),
    title: z.string().min(1).max(120),
    notes: z.string().max(500).optional(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
  })
  .refine((v) => new Date(v.endsAt) > new Date(v.startsAt), {
    message: "endsAt must be after startsAt",
    path: ["endsAt"],
  });
export type CreateBookingInput = z.infer<typeof CreateBookingSchema>;

export const UserPublicSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
});
export type UserPublic = z.infer<typeof UserPublicSchema>;

export const AuthResponseSchema = z.object({
  accessToken: z.string(),
  user: UserPublicSchema,
  membership: z.object({
    organizationId: z.string(),
    organizationName: z.string(),
    role: RoleSchema,
  }),
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

export const ResourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  timezone: z.string(),
  capacity: z.number().int().positive(),
});
export type Resource = z.infer<typeof ResourceSchema>;

export const BookingSchema = z.object({
  id: z.string(),
  resourceId: z.string(),
  title: z.string(),
  notes: z.string().nullable().optional(),
  startsAt: z.string(),
  endsAt: z.string(),
  status: BookingStatusSchema,
  host: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().email(),
  }),
});
export type Booking = z.infer<typeof BookingSchema>;

export const ConflictErrorSchema = z.object({
  statusCode: z.literal(409),
  message: z.string(),
  conflict: z.object({
    bookingId: z.string(),
    title: z.string(),
    startsAt: z.string(),
    endsAt: z.string(),
    hostName: z.string(),
  }),
});
export type ConflictError = z.infer<typeof ConflictErrorSchema>;

export const DEMO_CREDENTIALS = {
  admin: { email: "admin@slotcraft.local", password: "slotcraft" },
  viewer: { email: "viewer@slotcraft.local", password: "slotcraft" },
} as const;
