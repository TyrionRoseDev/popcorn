import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Ban, ChevronLeft } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { useTRPC } from "#/integrations/trpc/react";

export const Route = createFileRoute("/app/settings/blocked")({
	component: BlockedUsersPage,
	head: () => ({
		meta: [{ title: "Blocked Users — Popcorn" }],
	}),
});

function formatTimeAgo(date: Date): string {
	const now = new Date();
	const diffMs = now.getTime() - new Date(date).getTime();
	const diffMin = Math.floor(diffMs / 60000);
	const diffHr = Math.floor(diffMs / 3600000);
	const diffDay = Math.floor(diffMs / 86400000);

	if (diffMin < 1) return "just now";
	if (diffMin < 60) return `${diffMin}m ago`;
	if (diffHr < 24) return `${diffHr}h ago`;
	if (diffDay === 1) return "1d ago";
	if (diffDay < 30) return `${diffDay}d ago`;
	const diffWk = Math.floor(diffDay / 7);
	if (diffWk < 5) return `${diffWk}w ago`;
	const diffMo = Math.floor(diffDay / 30);
	return `${diffMo}mo ago`;
}

function BlockedUsersPage() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const {
		data: blockedUsers,
		isLoading,
		isError,
		error,
	} = useQuery(trpc.friend.getBlockedUsers.queryOptions());

	const unblockMutation = useMutation({
		...trpc.friend.unblock.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: trpc.friend.getBlockedUsers.queryKey(),
			});
			toast.success("User unblocked");
		},
		onError: () => {
			toast.error("Failed to unblock user");
		},
	});

	return (
		<div className="mx-auto max-w-lg px-4 py-10">
			{/* Back link */}
			<Link
				to="/app/settings"
				className="mb-6 inline-flex items-center gap-1 font-mono-retro text-xs uppercase tracking-wider text-cream/40 no-underline transition-colors hover:text-cream/70"
			>
				<ChevronLeft className="h-3.5 w-3.5" />
				Back
			</Link>

			{/* Header */}
			<h1 className="mb-1 font-display text-2xl text-cream">Blocked Users</h1>
			<p className="mb-8 font-mono-retro text-xs text-cream/40">
				Users you've blocked can't send you friend requests or see your full
				profile.
			</p>

			{/* Content */}
			{isError ? (
				<div className="flex flex-col items-center py-20 text-center">
					<Ban className="mb-3 h-10 w-10 text-neon-pink/20" />
					<p className="font-display text-lg text-cream/50">
						Something went wrong
					</p>
					<p className="mt-1 font-mono-retro text-xs text-cream/30">
						{error?.message ?? "Could not load blocked users."}
					</p>
				</div>
			) : isLoading ? (
				<div className="space-y-3">
					{Array.from({ length: 3 }, (_, i) => (
						<div
							key={`skeleton-${
								// biome-ignore lint/suspicious/noArrayIndexKey: skeleton items
								i
							}`}
							className="flex items-center gap-3 rounded-xl border border-cream/8 bg-drive-in-card px-4 py-3.5"
						>
							<div className="h-9 w-9 animate-pulse rounded-full bg-cream/10" />
							<div className="flex-1 space-y-1.5">
								<div className="h-3.5 w-28 animate-pulse rounded bg-cream/10" />
								<div className="h-3 w-16 animate-pulse rounded bg-cream/5" />
							</div>
							<div className="h-7 w-16 animate-pulse rounded-lg bg-cream/5" />
						</div>
					))}
				</div>
			) : !blockedUsers?.length ? (
				<div className="flex flex-col items-center py-20 text-center">
					<Ban className="mb-3 h-10 w-10 text-cream/15" />
					<p className="text-lg text-cream/50">No blocked users</p>
					<p className="mt-1 text-sm text-cream/30">
						When you block someone, they'll appear here.
					</p>
				</div>
			) : (
				<div className="space-y-2">
					<AnimatePresence initial={false}>
						{blockedUsers.map((user) => (
							<motion.div
								key={user.id}
								initial={{ opacity: 0, y: 6 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, scale: 0.97 }}
								transition={{ duration: 0.18 }}
								className="flex items-center gap-3 rounded-xl border border-cream/8 bg-drive-in-card px-4 py-3.5"
							>
								{/* Avatar */}
								<div className="shrink-0 opacity-40 saturate-0">
									{user.avatarUrl ? (
										<img
											src={user.avatarUrl}
											alt=""
											className="h-9 w-9 rounded-full object-cover"
										/>
									) : (
										<div className="flex h-9 w-9 items-center justify-center rounded-full bg-cream/10">
											<span className="text-sm font-medium text-cream/60">
												{user.username?.charAt(0).toUpperCase() || "?"}
											</span>
										</div>
									)}
								</div>

								{/* Info */}
								<div className="min-w-0 flex-1">
									<p className="truncate text-sm text-cream/70">
										{user.username || "Unknown user"}
									</p>
									<p className="font-mono-retro text-xs text-cream/30">
										Blocked {formatTimeAgo(user.blockedAt)}
									</p>
								</div>

								{/* Unblock button */}
								<button
									type="button"
									onClick={() => unblockMutation.mutate({ userId: user.id })}
									disabled={unblockMutation.isPending}
									className="shrink-0 rounded-lg border border-neon-amber/20 bg-neon-amber/5 px-3 py-1.5 font-mono-retro text-xs text-neon-amber/70 transition-colors hover:bg-neon-amber/10 hover:text-neon-amber disabled:opacity-40"
								>
									Unblock
								</button>
							</motion.div>
						))}
					</AnimatePresence>
				</div>
			)}
		</div>
	);
}
