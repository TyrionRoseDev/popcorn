import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getSession } from "#/lib/auth-session";

export const Route = createFileRoute("/app")({
	beforeLoad: async () => {
		const session = await getSession();

		if (!session?.user) {
			throw redirect({ to: "/login" });
		}

		if (!session.user.onboardingCompleted) {
			throw redirect({ to: "/onboarding" });
		}

		return { user: session.user };
	},
	component: () => <Outlet />,
});
