export type JwtPayload = {
  sub: string;
  email: string;
  name: string;
  organizationId: string;
  organizationName: string;
  role: "owner" | "admin" | "member" | "viewer";
};

export type AuthUser = JwtPayload;
