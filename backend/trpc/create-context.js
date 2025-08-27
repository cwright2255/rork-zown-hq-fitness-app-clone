import { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";

// Context creation function
export const createContext = async (opts) => {
  const authHeader = opts.req.headers.get("authorization");
  const altHeader = opts.req.headers.get("x-admin-token");
  const provided =
    (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : authHeader) ??
    altHeader ??
    null;

  const expected = process.env.ADMIN_API_TOKEN ?? process.env.API_ADMIN_TOKEN ?? null;

  const adminAuth = {
    isAdmin: Boolean(provided && expected && provided === expected),
    adminTokenProvided: provided,
  };

  return {
    req: opts.req,
    admin: adminAuth,
  };
};

// Initialize tRPC
const t = initTRPC.context().create({
  transformer: superjson,
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;
export const protectedAdminProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.admin?.isAdmin) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Admin token required" });
  }
  return next();
});