import {
	skipToken,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Clock, Search, UserPlus, UserSearch, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FriendsAtmosphere } from "#/components/friends/friends-atmosphere";
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
	watchCount: number;
	avgRating: number | null;
	listCount: number;
}

function SprocketRow({ color }: { color: string }) {
	return (
		<div
			className="flex justify-center gap-[10px] py-1.5"
			style={{
				background: `${color}04`,
				borderBottom: `1px solid ${color}12`,
			}}
		>
			{[0, 1, 2, 3, 4, 5].map((i) => (
				<div
					key={i}
					className="h-[5px] w-2 rounded-sm transition-colors"
					style={{ background: `${color}26` }}
				/>
			))}
		</div>
	);
}

function SprocketRowBottom({ color }: { color: string }) {
	return (
		<div
			className="flex justify-center gap-[10px] py-1.5"
			style={{
				background: `${color}04`,
				borderTop: `1px solid ${color}12`,
			}}
		>
			{[0, 1, 2, 3, 4, 5].map((i) => (
				<div
					key={i}
					className="h-[5px] w-2 rounded-sm transition-colors"
					style={{ background: `${color}26` }}
				/>
			))}
		</div>
	);
}

function FilmStripCard({ friend }: { friend: Friend }) {
	const trpc = useTRPC();
	const initial = (friend.username ?? "?").charAt(0).toUpperCase();
	const gradient = getAvatarGradient(initial);
	// Extract the first color from the gradient for sprocket/border accents
	const accentColor = gradient.match(/#[A-Fa-f0-9]{6}/)?.[0] ?? "#FF2D78";

	const { data: favFilm } = useQuery(
		trpc.title.details.queryOptions(
			friend.favouriteFilmTmdbId
				? {
						tmdbId: friend.favouriteFilmTmdbId,
						mediaType:
							friend.favouriteFilmMediaType === "tv"
								? ("tv" as const)
								: ("movie" as const),
					}
				: skipToken,
		),
	);

	return (
		<Link
			to="/app/profile/$userId"
			params={{ userId: friend.id }}
			className="group block no-underline"
		>
			<div
				className="relative overflow-hidden rounded-[10px] transition-all duration-200 group-hover:-translate-y-0.5"
				style={{
					border: `1px solid ${accentColor}1a`,
					background: "rgba(8,6,18,0.95)",
					boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
				}}
			>
				{/* Top sprockets */}
				<SprocketRow color={accentColor} />

				{/* Interior */}
				<div className="p-4">
					{/* Avatar + name row */}
					<div className="flex items-center gap-3">
						{friend.avatarUrl ? (
							<img
								src={friend.avatarUrl}
								alt=""
								className="h-[50px] w-[50px] shrink-0 rounded-full object-cover"
								style={{
									border: `2px solid ${accentColor}4d`,
									boxShadow: `0 0 20px ${accentColor}26`,
								}}
							/>
						) : (
							<div
								className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-full"
								style={{
									background: gradient,
									boxShadow: `0 0 20px ${accentColor}26`,
								}}
							>
								<span className="text-xl font-bold text-cream/90">
									{initial}
								</span>
							</div>
						)}
						<div className="min-w-0">
							<div className="truncate font-mono-retro text-sm font-bold text-cream/92">
								@{friend.username ?? "unknown"}
							</div>
							<div className="mt-0.5 truncate text-[10px] text-cream/30">
								♥{" "}
								{favFilm?.title
									? favFilm.title
									: friend.favouriteFilmTmdbId
										? "Loading…"
										: "No fave yet"}
							</div>
						</div>
					</div>

					{/* Stats bar */}
					<div className="mt-3.5 flex gap-px overflow-hidden rounded-md">
						<div
							className="flex-1 py-2 text-center"
							style={{ background: "rgba(255,45,120,0.06)" }}
						>
							<div className="font-mono-retro text-base font-bold text-neon-pink">
								{friend.watchCount}
							</div>
							<div className="mt-0.5 text-[7px] uppercase tracking-[1.5px] text-cream/25">
								Watched
							</div>
						</div>
						<div
							className="flex-1 py-2 text-center"
							style={{ background: "rgba(255,184,0,0.06)" }}
						>
							<div className="font-mono-retro text-base font-bold text-neon-amber">
								{friend.avgRating != null ? friend.avgRating.toFixed(1) : "—"}
							</div>
							<div className="mt-0.5 text-[7px] uppercase tracking-[1.5px] text-cream/25">
								Avg ★
							</div>
						</div>
						<div
							className="flex-1 py-2 text-center"
							style={{ background: "rgba(0,229,255,0.06)" }}
						>
							<div className="font-mono-retro text-base font-bold text-neon-cyan">
								{friend.listCount}
							</div>
							<div className="mt-0.5 text-[7px] uppercase tracking-[1.5px] text-cream/25">
								Lists
							</div>
						</div>
					</div>
				</div>

				{/* Bottom sprockets */}
				<SprocketRowBottom color={accentColor} />
			</div>
		</Link>
	);
}

function VerticalSprockets({
	color,
	side,
}: {
	color: string;
	side: "left" | "right";
}) {
	return (
		<div
			className="flex shrink-0 flex-col items-center justify-center gap-[6px] px-1.5"
			style={{
				background: `${color}06`,
				...(side === "left"
					? { borderRight: `1px solid ${color}15` }
					: { borderLeft: `1px solid ${color}15` }),
			}}
		>
			{[0, 1, 2, 3].map((i) => (
				<div
					key={i}
					className="h-[5px] w-2 rounded-sm"
					style={{ background: `${color}26` }}
				/>
			))}
		</div>
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
			className="group flex overflow-hidden rounded-lg border border-neon-pink/10 transition-all hover:-translate-y-px hover:border-neon-pink/25"
			style={{
				background: "rgba(8,6,18,0.95)",
				boxShadow: "0 2px 16px rgba(0,0,0,0.4)",
			}}
		>
			{/* Left sprockets */}
			<VerticalSprockets color="#FF2D78" side="left" />

			{/* Content */}
			<div className="flex flex-1 items-center gap-3 px-4 py-3">
				<Link
					to="/app/profile/$userId"
					params={{ userId: request.requesterId }}
					className="flex min-w-0 flex-1 items-center gap-3"
				>
					{request.avatarUrl ? (
						<img
							src={request.avatarUrl}
							alt=""
							className="h-10 w-10 shrink-0 rounded-full border border-neon-pink/20 object-cover"
						/>
					) : (
						<div
							className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-neon-pink/20"
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
						{timeAgo && (
							<p className="mt-0.5 text-xs text-cream/30">{timeAgo}</p>
						)}
					</div>
				</Link>

				<div className="flex shrink-0 items-center gap-2">
					<button
						type="button"
						aria-label="Accept friend request"
						disabled={isPending}
						onClick={() =>
							acceptMutation.mutate({
								friendshipId: request.friendshipId,
							})
						}
						className="flex h-8 w-8 items-center justify-center rounded-full border border-green-500/30 bg-green-500/10 text-green-400 transition-colors hover:border-green-500/50 hover:bg-green-500/20 disabled:opacity-40"
					>
						<Check className="h-4 w-4" />
					</button>
					<button
						type="button"
						aria-label="Decline friend request"
						disabled={isPending}
						onClick={() =>
							declineMutation.mutate({
								friendshipId: request.friendshipId,
							})
						}
						className="flex h-8 w-8 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10 text-red-400 transition-colors hover:border-red-500/50 hover:bg-red-500/20 disabled:opacity-40"
					>
						<X className="h-4 w-4" />
					</button>
				</div>
			</div>

			{/* Right sprockets */}
			<VerticalSprockets color="#FF2D78" side="right" />
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
			className="group flex overflow-hidden rounded-lg border border-neon-cyan/10 transition-all hover:-translate-y-px hover:border-neon-cyan/25"
			style={{
				background: "rgba(8,6,18,0.95)",
				boxShadow: "0 2px 16px rgba(0,0,0,0.4)",
			}}
		>
			{/* Left sprockets */}
			<VerticalSprockets color="#00E5FF" side="left" />

			{/* Content */}
			<div className="flex flex-1 items-center gap-3 px-4 py-3">
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
							className="flex cursor-pointer items-center gap-1.5 rounded-full border border-neon-pink/30 bg-neon-pink/10 px-3 py-1.5 font-mono-retro text-xs text-neon-pink transition-all hover:border-neon-pink/50 hover:bg-neon-pink/20 hover:shadow-[0_0_12px_rgba(255,45,120,0.15)] disabled:opacity-50"
						>
							<UserPlus className="h-3 w-3" />
							{sendRequestMutation.isPending ? "Sending..." : "Add Friend"}
						</button>
					)}
				</div>
			</div>

			{/* Right sprockets */}
			<VerticalSprockets color="#00E5FF" side="right" />
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
		<>
			<FriendsAtmosphere />
			<div className="relative z-[2] mx-auto max-w-2xl px-4 pt-8 pb-16">
				<NowShowingHeader title="Friends" />

				{/* Search bar */}
				<div className="relative mx-auto mt-8 max-w-xl">
					<Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neon-pink/50" />
					<input
						type="text"
						aria-label="Search friends or find new people"
						placeholder="Search friends or find new people..."
						value={searchInput}
						onChange={(e) => setSearchInput(e.target.value)}
						className="w-full rounded-lg border border-neon-pink/25 bg-neon-pink/[0.05] py-3 pl-10 pr-4 text-sm text-cream/85 outline-none transition-all placeholder:text-cream/25 focus:border-neon-pink/50 focus:shadow-[0_0_20px_rgba(255,45,120,0.08)]"
					/>
					{(searchLoading || isTyping) && hasApiQuery && (
						<div className="absolute right-3.5 top-1/2 -translate-y-1/2">
							<div className="h-4 w-4 animate-spin rounded-full border-2 border-neon-pink/20 border-t-neon-pink/60" />
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
							<p className="mb-3 font-mono-retro text-[11px] uppercase tracking-[2px] text-neon-pink/50">
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
							<div className="mt-8 border-t border-neon-pink/10" />
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
										<p className="mb-3 font-mono-retro text-[11px] uppercase tracking-[2px] text-neon-pink/50">
											Your Friends
										</p>
										<div className="grid grid-cols-2 gap-3">
											{filteredFriends.map((friend) => (
												<FilmStripCard key={friend.id} friend={friend} />
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
												<Search className="mb-3 h-8 w-8 text-neon-pink/15" />
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
										<Search className="mb-3 h-8 w-8 text-neon-pink/15" />
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
												className="h-[180px] animate-pulse rounded-lg bg-cream/[0.04]"
											/>
										))}
									</div>
								) : friends && friends.length > 0 ? (
									<div className="grid grid-cols-2 gap-3">
										{friends.map((friend) => (
											<FilmStripCard key={friend.id} friend={friend} />
										))}
									</div>
								) : (
									<div className="flex flex-col items-center py-20 text-center">
										<div
											className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-neon-pink/15"
											style={{
												background:
													"radial-gradient(circle, rgba(255,45,120,0.06) 0%, transparent 70%)",
											}}
										>
											<UserSearch className="h-8 w-8 text-neon-pink/25" />
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
		</>
	);
}
