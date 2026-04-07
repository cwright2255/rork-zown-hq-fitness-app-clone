import { createTRPCRouter } from "./create-context";
import hiRoute from "./routes/example/hi/route";
import adminRouter from "./routes/admin/router";

export const appRouter = createTRPCRouter({
  example: createTRPCRouter({
    hi: hiRoute,
  }),
  admin: adminRouter,
});