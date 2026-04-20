import { z } from "zod";
import { createTRPCRouter, protectedAdminProcedure } from "../../create-context";

  featureFlags: Record<string, boolean>;
  theme: {
    primary: string;
    accent: string;
  };
};

let CONFIG = {
  maintenanceMode: false,
  featureFlags: {},
  theme: {
    primary: "#0ea5e9",
    accent: "#22c55e",
  },
};

export default createTRPCRouter({
  getSignedControlInfo: protectedAdminProcedure.query(() => {
    const base = process.env.EXPO_PUBLIC_RORK_API_BASE_URL ?? "";
    return {
      baseUrl: base,
      trpcUrl: `${base}/api/trpc`,
      tokenType: "Bearer" as const,
      headerName: "Authorization" as const,
    };
  }),

  getConfig: protectedAdminProcedure.query((): { config: AdminAppConfig } => ({
    config,
  })),

  updateConfig: protectedAdminProcedure
    .input(
      z.object({
        maintenanceMode: z.boolean().optional(),
        featureFlags: z.record(z.string(), z.boolean()).optional(),
        theme: z
          .object({ primary: z.string(), accent: z.string() })
          .partial()
          .optional(),
      })
    )
    .mutation(({ input }): { ok: true; config: AdminAppConfig } => {
      CONFIG = {
        ...CONFIG,
        maintenanceMode: input.maintenanceMode ?? CONFIG.maintenanceMode,
        featureFlags: (input.featureFlags ?? CONFIG.featureFlags),
        theme: {
          primary: input.theme?.primary ?? CONFIG.theme.primary,
          accent: input.theme?.accent ?? CONFIG.theme.accent,
        },
      };
      return { ok: true as const, config: CONFIG };
    }),
});