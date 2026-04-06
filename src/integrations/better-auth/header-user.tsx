import { Link, useNavigate } from "@tanstack/react-router";
import { EyeOff, LogOut, Settings, User } from "lucide-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { authClient } from "#/lib/auth-client";

export default function BetterAuthHeader() {
	const { data: session, isPending } = authClient.useSession();
	const navigate = useNavigate();

	if (isPending) {
		return <div className="h-10 w-10 animate-pulse rounded-full bg-cream/10" />;
	}

	if (session?.user) {
		return (
			<DropdownMenu modal={false}>
				<DropdownMenuTrigger asChild>
					<button
						type="button"
						className="rounded-full outline-none ring-1 ring-cream/10 transition-all hover:ring-2 hover:ring-neon-cyan/30 focus-visible:ring-2 focus-visible:ring-neon-cyan/30"
						aria-label="Open user menu"
					>
						{session.user.avatarUrl ? (
							<img
								src={session.user.avatarUrl}
								alt=""
								className="h-10 w-10 rounded-full object-cover"
							/>
						) : (
							<div className="flex h-10 w-10 items-center justify-center rounded-full bg-cream/10">
								<span className="text-sm font-medium text-cream/60">
									{session.user.username?.charAt(0).toUpperCase() ||
										session.user.email?.charAt(0).toUpperCase() ||
										"U"}
								</span>
							</div>
						)}
					</button>
				</DropdownMenuTrigger>
				<DropdownMenuContent
					align="end"
					className="border-cream/10 bg-drive-in-card"
				>
					<DropdownMenuItem asChild>
						<Link
							to="/app/profile/$userId"
							params={{ userId: session.user.id }}
							className="text-cream/60 no-underline focus:bg-cream/5 focus:text-cream/80"
						>
							<User className="mr-2 h-4 w-4" />
							Profile
						</Link>
					</DropdownMenuItem>
					<DropdownMenuSeparator className="bg-cream/10" />
					<DropdownMenuItem asChild>
						<Link
							to="/app/shuffle/hidden"
							className="text-cream/60 no-underline focus:bg-cream/5 focus:text-cream/80"
						>
							<EyeOff className="mr-2 h-4 w-4" />
							Hidden Titles
						</Link>
					</DropdownMenuItem>
					<DropdownMenuItem asChild>
						<Link
							to="/app/settings"
							className="text-cream/60 no-underline focus:bg-cream/5 focus:text-cream/80"
						>
							<Settings className="mr-2 h-4 w-4" />
							Settings
						</Link>
					</DropdownMenuItem>
					<DropdownMenuSeparator className="bg-cream/10" />
					<DropdownMenuItem
						onClick={async () => {
							await authClient.signOut();
							navigate({ to: "/" });
						}}
						className="text-cream/60 focus:bg-cream/5 focus:text-cream/80"
					>
						<LogOut className="mr-2 h-4 w-4" />
						Sign out
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
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
