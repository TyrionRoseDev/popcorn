import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
	server: {
		DATABASE_URL: z.string().url(),
		BETTER_AUTH_URL: z.preprocess(
			(value) =>
				typeof value === "string" && value.trim().length > 0
					? value
					: process.env.COOLIFY_FQDN,
			z.string().url(),
		),
		BETTER_AUTH_SECRET: z.string().min(1),
		RESEND_API_KEY: z.string().min(1),
		RESEND_FROM_EMAIL: z.string().email(),
		UPLOADTHING_TOKEN: z.string().min(1),
		TMDB_READ_ACCESS_TOKEN: z.string().min(1),
		CRON_SECRET: z.string().min(1),
	},

	clientPrefix: "VITE_",

	client: {
		VITE_APP_TITLE: z.string().min(1).optional(),
	},

	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
});
