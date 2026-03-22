import { Link, useNavigate } from "@tanstack/react-router";
import { authClient } from "#/lib/auth-client";

export default function BetterAuthHeader() {
	const { data: session, isPending } = authClient.useSession();
	const navigate = useNavigate();

	if (isPending) {
		return <div className="h-8 w-8 animate-pulse rounded-full bg-cream/10" />;
	}

	if (session?.user) {
		return (
			<div className="flex items-center gap-2">
				{session.user.avatarUrl ? (
					<img
						src={session.user.avatarUrl}
						alt=""
						className="h-8 w-8 rounded-full object-cover"
					/>
				) : (
					<div className="flex h-8 w-8 items-center justify-center rounded-full bg-cream/10">
						<span className="text-xs font-medium text-cream/60">
							{session.user.username?.charAt(0).toUpperCase() ||
								session.user.email?.charAt(0).toUpperCase() ||
								"U"}
						</span>
					</div>
				)}
				<button
					type="button"
					onClick={async () => {
						await authClient.signOut();
						navigate({ to: "/" });
					}}
					className="rounded-lg border border-cream/15 bg-cream/5 px-3 py-1.5 text-xs font-medium text-cream/60 transition-colors hover:bg-cream/10 hover:text-cream/80"
				>
					Sign out
				</button>
			</div>
		);
	}

	return (
		<Link
			to="/login"
			className="rounded-lg border border-neon-pink/30 bg-neon-pink/5 px-4 py-1.5 text-sm font-medium text-neon-pink no-underline transition-colors hover:bg-neon-pink/10"
		>
			Log In
		</Link>
	);
}
