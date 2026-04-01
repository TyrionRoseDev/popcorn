import {
	skipToken,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	Check,
	Clock,
	Heart,
	Search,
	UserPlus,
	UserSearch,
	X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { NowShowingHeader } from "#/components/watchlist/now-showing-header";
import { useTRPC } from "#/integrations/trpc/react";

export const Route = createFileRoute("/app/friends")({
	component: FriendsPage,
});

const SKELETON_KEYS = ["skel-a", "skel-b", "skel-c", "skel-d"];

// Avatar gradient options keyed by first char code
function getAvatarGradient(letter: string) {
	const gradients = [
		"linear-gradient(135deg, #FF2D78, #7B2FBE)",
		"linear-gradient(135deg, #FFB800, #FF2D78)",
		"linear-gradient(135deg, #00E5FF, #7B2FBE)",
		"linear-gradient(135deg, #FF2D78, #00E5FF)",
		"linear-gradient(135deg, #FFB800, #00E5FF)",
		"linear-gradient(135deg, #7B2FBE, #FF2D78)",
	];
	const idx = (letter.charCodeAt(0) ?? 0) % gradients.length;
	return gradients[idx];
}

interface Friend {
	id: string;
	username: string | null;
	avatarUrl: string | null;
	favouriteFilmTmdbId: number | null;
	favouriteFilmMediaType: string | null;
	favouriteGenreId: number | null;
	bio: string | null;
}

function TicketStubCard({ friend }: { friend: Friend }) {
	const initial = (friend.username ?? "?").charAt(0).toUpperCase();
	const gradient = getAvatarGradient(initial);

	return (
		<Link
			to="/app/profile/$userId"
			params={{ userId: friend.id }}
			className="group block no-underline"
		>
			<div
				className="relative overflow-hidden rounded-lg border border-neon-amber/12 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-neon-amber/45 group-hover:shadow-[0_4px_20px_rgba(255,184,0,0.12),0_2px_12px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.03)]"
				style={{
					background:
						"linear-gradient(180deg, rgba(10,10,30,0.95) 0%, rgba(10,10,30,0.85) 100%)",
					boxShadow:
						"0 2px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)",
				}}
			>
				{/* Neon top-border glow on hover */}
				<div className="absolute inset-x-0 top-0 h-px bg-neon-amber/0 transition-colors duration-200 group-hover:bg-neon-amber/40" />
				<div
					className="absolute inset-x-0 top-0 h-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
					style={{
						height: "3px",
						background:
							"linear-gradient(180deg, rgba(255,184,0,0.25) 0%, transparent 100%)",
					}}
				/>

				{/* ADMIT ONE label rotated on right edge */}
				<div className="pointer-events-none absolute right-0 top-0 z-10 flex h-full w-5 items-center justify-center">
					<span className="whitespace-nowrap font-mono-retro text-[7px] uppercase tracking-[2px] text-cream/8 rotate-90">
						ADMIT ONE
					</span>
				</div>

				{/* Top section: avatar + username */}
				<div className="flex items-center gap-3 px-4 py-3 pr-6">
					{friend.avatarUrl ? (
						<img
							src={friend.avatarUrl}
							alt=""
							className="h-10 w-10 shrink-0 rounded-full border border-neon-amber/20 object-cover"
						/>
					) : (
						<div
							className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-neon-amber/20"
							style={{ background: gradient }}
						>
							<span className="text-[15px] font-bold text-cream/90">
								{initial}
							</span>
						</div>
					)}
					<span className="truncate font-mono-retro text-sm text-cream/85">
						@{friend.username ?? "unknown"}
					</span>
				</div>

				{/* Dashed tear line with punch holes */}
				<div className="relative flex h-px items-center">
					<div className="absolute -left-2.5 z-10 h-5 w-5 rounded-full bg-drive-in-bg" />
					<div className="absolute -right-2.5 z-10 h-5 w-5 rounded-full bg-drive-in-bg" />
					<div className="mx-3 w-full border-t border-dashed border-neon-amber/18" />
				</div>

				{/* Bottom section: favourite film + minutes watched */}
				<div className="flex items-center gap-3 px-4 py-2.5 pr-6">
					<div className="flex min-w-0 flex-1 items-center gap-1.5">
						<Heart className="h-3 w-3 shrink-0 text-neon-pink/75" />
						<span className="truncate text-xs text-cream/40">
							{friend.favouriteFilmTmdbId
								? `${friend.favouriteFilmMediaType === "tv" ? "Show" : "Film"} #${friend.favouriteFilmTmdbId}`
								: "No fave yet"}
						</span>
					</div>
					<div className="flex shrink-0 items-center gap-1">
						<Clock className="h-3 w-3 text-neon-amber/50" />
						<span className="text-xs text-cream/30">&mdash;</span>
					</div>
				</div>
			</div>
		</Link>
	);
}

function PendingRequestCard({
	request,
}: {
	request: {
		friendshipId: string;
		requesterId: string;
		username: string | null;
		avatarUrl: string | null;
		createdAt: Date | null;
	};
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const initial = (request.username ?? "?").charAt(0).toUpperCase();
	const gradient = getAvatarGradient(initial);

	const acceptMutation = useMutation(
		trpc.friend.acceptRequest.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: trpc.friend.list.queryKey(),
				});
				queryClient.invalidateQueries({
					queryKey: trpc.friend.pendingRequests.queryKey(),
				});
				queryClient.invalidateQueries(
					trpc.notification.getUnreadCount.queryFilter(),
				);
			},
		}),
	);

	const declineMutation = useMutation(
		trpc.friend.declineRequest.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: trpc.friend.pendingRequests.queryKey(),
				});
				queryClient.invalidateQueries(
					trpc.notification.getUnreadCount.queryFilter(),
				);
			},
		}),
	);

	const isPending = acceptMutation.isPending || declineMutation.isPending;

	const timeAgo = request.createdAt
		? formatTimeAgo(new Date(request.createdAt))
		: "";

	return (
		<motion.div
			layout
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, x: -20 }}
			className="group flex items-center gap-4 rounded-lg border border-neon-amber/10 px-4 py-3 transition-colors hover:border-neon-amber/25 hover:bg-cream/[0.02]"
			style={{
				background:
					"linear-gradient(180deg, rgba(10,10,30,0.9) 0%, rgba(10,10,30,0.8) 100%)",
			}}
		>
			<Link
				to="/app/profile/$userId"
				params={{ userId: request.requesterId }}
				className="flex min-w-0 flex-1 items-center gap-4"
			>
				{request.avatarUrl ? (
					<img
						src={request.avatarUrl}
						alt=""
						className="h-10 w-10 shrink-0 rounded-full border border-neon-amber/20 object-cover"
					/>
				) : (
					<div
						className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-neon-amber/20"
						style={{ background: gradient }}
					>
						<span className="text-[15px] font-bold text-cream/90">
							{initial}
						</span>
					</div>
				)}

				<div className="min-w-0 flex-1">
					<p className="truncate font-mono-retro text-sm text-cream/85">
						@{request.username ?? "unknown"}
					</p>
					{timeAgo && <p className="mt-0.5 text-xs text-cream/30">{timeAgo}</p>}
				</div>
			</Link>

			<div className="flex shrink-0 items-center gap-2">
				<button
					type="button"
					disabled={isPending}
					onClick={() =>
						acceptMutation.mutate({ friendshipId: request.friendshipId })
					}
					className="flex h-8 w-8 items-center justify-center rounded-full border border-green-500/30 bg-green-500/10 text-green-400 transition-colors hover:border-green-500/50 hover:bg-green-500/20 disabled:opacity-40"
				>
					<Check className="h-4 w-4" />
				</button>
				<button
					type="button"
					disabled={isPending}
					onClick={() =>
						declineMutation.mutate({ friendshipId: request.friendshipId })
					}
					className="flex h-8 w-8 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10 text-red-400 transition-colors hover:border-red-500/50 hover:bg-red-500/20 disabled:opacity-40"
				>
					<X className="h-4 w-4" />
				</button>
			</div>
		</motion.div>
	);
}

function formatTimeAgo(date: Date): string {
	const now = new Date();
	const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
	if (seconds < 60) return "just now";
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	if (days < 7) return `${days}d ago`;
	return `${Math.floor(days / 7)}w ago`;
}

function DiscoverResultCard({
	user,
	isFriend,
}: {
	user: { id: string; username: string | null; avatarUrl: string | null };
	isFriend: boolean;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const initial = (user.username ?? "?").charAt(0).toUpperCase();
	const gradient = getAvatarGradient(initial);
	const [requestSent, setRequestSent] = useState(false);

	const sendRequestMutation = useMutation(
		trpc.friend.sendRequest.mutationOptions({
			onSuccess: () => {
				setRequestSent(true);
				toast.success(`Friend request sent to @${user.username ?? "user"}!`);
				queryClient.invalidateQueries({
					queryKey: trpc.friend.pendingRequests.queryKey(),
				});
			},
			onError: (error) => {
				if (error.message === "Request already exists") {
					setRequestSent(true);
					toast.info("A request already exists with this user");
				} else {
					toast.error("Failed to send request");
				}
			},
		}),
	);

	return (
		<motion.div
			initial={{ opacity: 0, y: 12 }}
			animate={{ opacity: 1, y: 0 }}
			className="group flex items-center gap-4 rounded-lg border border-neon-cyan/10 px-4 py-3 transition-colors hover:border-neon-cyan/30 hover:bg-neon-cyan/[0.02]"
			style={{
				background:
					"linear-gradient(180deg, rgba(10,10,30,0.92) 0%, rgba(10,10,30,0.82) 100%)",
				boxShadow:
					"0 2px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.02)",
			}}
		>
			<div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-neon-cyan/0 transition-colors duration-200 group-hover:bg-neon-cyan/25" />

			<Link
				to="/app/profile/$userId"
				params={{ userId: user.id }}
				className="shrink-0 no-underline"
			>
				{user.avatarUrl ? (
					<img
						src={user.avatarUrl}
						alt=""
						className="h-11 w-11 rounded-full border border-neon-cyan/20 object-cover transition-colors group-hover:border-neon-cyan/40"
					/>
				) : (
					<div
						className="flex h-11 w-11 items-center justify-center rounded-full border border-neon-cyan/20 transition-colors group-hover:border-neon-cyan/40"
						style={{ background: gradient }}
					>
						<span className="text-[15px] font-bold text-cream/90">
							{initial}
						</span>
					</div>
				)}
			</Link>

			<div className="min-w-0 flex-1">
				<Link
					to="/app/profile/$userId"
					params={{ userId: user.id }}
					className="block truncate font-mono-retro text-sm text-cream/85 no-underline transition-colors hover:text-neon-cyan"
				>
					@{user.username ?? "unknown"}
				</Link>
			</div>

			<div className="shrink-0">
				{isFriend ? (
					<span className="flex items-center gap-1.5 rounded-full border border-green-500/20 bg-green-500/8 px-3 py-1.5 font-mono-retro text-xs text-green-400/70">
						<Check className="h-3 w-3" />
						Friends
					</span>
				) : requestSent ? (
					<span className="flex items-center gap-1.5 rounded-full border border-cream/10 bg-cream/[0.04] px-3 py-1.5 font-mono-retro text-xs text-cream/35">
						<Clock className="h-3 w-3" />
						Request Sent
					</span>
				) : (
					<button
						type="button"
						disabled={sendRequestMutation.isPending}
						onClick={() => sendRequestMutation.mutate({ userId: user.id })}
						className="flex cursor-pointer items-center gap-1.5 rounded-full border border-neon-amber/30 bg-neon-amber/10 px-3 py-1.5 font-mono-retro text-xs text-neon-amber transition-all hover:border-neon-amber/50 hover:bg-neon-amber/20 hover:shadow-[0_0_12px_rgba(255,184,0,0.15)] disabled:opacity-50"
					>
						<UserPlus className="h-3 w-3" />
						{sendRequestMutation.isPending ? "Sending..." : "Add Friend"}
					</button>
				)}
			</div>
		</motion.div>
	);
}

function FriendsPage() {
	const trpc = useTRPC();
	const [searchInput, setSearchInput] = useState("");
	const [debouncedQuery, setDebouncedQuery] = useState("");

	const { data: friends, isLoading: friendsLoading } = useQuery(
		trpc.friend.list.queryOptions(),
	);
	const { data: pendingRequests } = useQuery(
		trpc.friend.pendingRequests.queryOptions(),
	);

	// Debounce search for the user-discovery API
	useEffect(() => {
		if (searchInput.trim().length < 2) {
			setDebouncedQuery("");
			return;
		}
		const timer = setTimeout(() => {
			setDebouncedQuery(searchInput.trim());
		}, 300);
		return () => clearTimeout(timer);
	}, [searchInput]);

	const { data: searchResults, isLoading: searchLoading } = useQuery(
		trpc.watchlist.searchUsers.queryOptions(
			debouncedQuery.length >= 2 ? { query: debouncedQuery } : skipToken,
		),
	);

	const friendIds = new Set((friends ?? []).map((f) => f.id));
	const isSearching = searchInput.trim().length > 0;
	const hasApiQuery = debouncedQuery.length >= 2;
	const isTyping =
		searchInput.trim().length >= 2 && searchInput.trim() !== debouncedQuery;

	// Local filter of existing friends
	const filteredFriends = (friends ?? []).filter((f) => {
		if (!searchInput.trim()) return true;
		return f.username?.toLowerCase().includes(searchInput.toLowerCase().trim());
	});

	// Other users from search (exclude existing friends)
	const otherUsers = (searchResults ?? []).filter((u) => !friendIds.has(u.id));

	return (
		<div className="relative mx-auto max-w-4xl px-4 pb-16 pt-10">
			<NowShowingHeader title="Friends" />

			{/* Search bar */}
			<div className="relative mx-auto mt-8 max-w-xl">
				<Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neon-amber/50" />
				<input
					type="text"
					placeholder="Search friends or find new people..."
					value={searchInput}
					onChange={(e) => setSearchInput(e.target.value)}
					className="w-full rounded-lg border border-neon-amber/25 bg-neon-amber/[0.05] py-3 pl-10 pr-4 text-sm text-cream/85 outline-none transition-all placeholder:text-cream/25 focus:border-neon-amber/50 focus:shadow-[0_0_20px_rgba(255,184,0,0.08)]"
				/>
				{(searchLoading || isTyping) && hasApiQuery && (
					<div className="absolute right-3.5 top-1/2 -translate-y-1/2">
						<div className="h-4 w-4 animate-spin rounded-full border-2 border-neon-amber/20 border-t-neon-amber/60" />
					</div>
				)}
			</div>

			<div className="mt-8">
				{/* Pending requests section — only when not searching and requests exist */}
				{!isSearching && pendingRequests && pendingRequests.length > 0 && (
					<motion.div
						initial={{ opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						className="mb-8"
					>
						<p className="mb-3 font-mono-retro text-[11px] uppercase tracking-[2px] text-neon-amber/50">
							Friend Requests
						</p>
						<div className="flex flex-col gap-2">
							<AnimatePresence mode="popLayout">
								{pendingRequests.map((request) => (
									<PendingRequestCard
										key={request.friendshipId}
										request={request}
									/>
								))}
							</AnimatePresence>
						</div>
						<div className="mt-8 border-t border-neon-amber/10" />
					</motion.div>
				)}

				{/* Main content */}
				<AnimatePresence mode="wait">
					{isSearching ? (
						<motion.div
							key="search-results"
							initial={{ opacity: 0, y: 8 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -8 }}
							transition={{ duration: 0.2 }}
						>
							{/* Filtered friends */}
							{filteredFriends.length > 0 && (
								<div className="mb-8">
									<p className="mb-3 font-mono-retro text-[11px] uppercase tracking-[2px] text-neon-amber/50">
										Your Friends
									</p>
									<div className="grid grid-cols-2 gap-3">
										{filteredFriends.map((friend) => (
											<TicketStubCard key={friend.id} friend={friend} />
										))}
									</div>
								</div>
							)}

							{/* Other users from search */}
							{hasApiQuery && (
								<div>
									<p className="mb-3 font-mono-retro text-[11px] uppercase tracking-[2px] text-neon-cyan/50">
										Other Users
									</p>
									{searchLoading || isTyping ? (
										<div className="flex flex-col gap-2">
											{SKELETON_KEYS.map((key) => (
												<div
													key={key}
													className="h-[60px] animate-pulse rounded-lg bg-cream/[0.03]"
												/>
											))}
										</div>
									) : otherUsers.length > 0 ? (
										<div className="flex flex-col gap-2">
											{otherUsers.map((user, index) => (
												<motion.div
													key={user.id}
													initial={{ opacity: 0, y: 12 }}
													animate={{ opacity: 1, y: 0 }}
													transition={{
														duration: 0.25,
														delay: index * 0.06,
													}}
												>
													<DiscoverResultCard
														user={user}
														isFriend={friendIds.has(user.id)}
													/>
												</motion.div>
											))}
										</div>
									) : (
										<div className="flex flex-col items-center py-12 text-center">
											<Search className="mb-3 h-8 w-8 text-neon-amber/15" />
											<p className="text-sm text-cream/40">
												No other users found matching &ldquo;{debouncedQuery}
												&rdquo;
											</p>
										</div>
									)}
								</div>
							)}

							{/* No matches at all */}
							{filteredFriends.length === 0 && !hasApiQuery && (
								<div className="flex flex-col items-center py-16 text-center">
									<Search className="mb-3 h-8 w-8 text-neon-amber/15" />
									<p className="text-sm text-cream/35">
										No friends match &ldquo;{searchInput}&rdquo;
									</p>
									<p className="mt-1 text-xs text-cream/20">
										Type at least 2 characters to search all users
									</p>
								</div>
							)}
						</motion.div>
					) : (
						<motion.div
							key="friends-grid"
							initial={{ opacity: 0, y: 8 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -8 }}
							transition={{ duration: 0.2 }}
						>
							{friendsLoading ? (
								<div className="grid grid-cols-2 gap-3">
									{SKELETON_KEYS.map((key) => (
										<div
											key={key}
											className="h-24 animate-pulse rounded-lg bg-cream/[0.04]"
										/>
									))}
								</div>
							) : friends && friends.length > 0 ? (
								<div className="grid grid-cols-2 gap-3">
									{friends.map((friend) => (
										<TicketStubCard key={friend.id} friend={friend} />
									))}
								</div>
							) : (
								<div className="flex flex-col items-center py-20 text-center">
									<div
										className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-neon-amber/15"
										style={{
											background:
												"radial-gradient(circle, rgba(255,184,0,0.06) 0%, transparent 70%)",
										}}
									>
										<UserSearch className="h-8 w-8 text-neon-amber/25" />
									</div>
									<p className="font-display text-lg text-cream/45">
										No friends yet
									</p>
									<p className="mt-1.5 max-w-xs text-sm text-cream/25">
										Search by username above to find people and send friend
										requests
									</p>
								</div>
							)}
						</motion.div>
					)}
				</AnimatePresence>
			</div>
		</div>
	);
}
