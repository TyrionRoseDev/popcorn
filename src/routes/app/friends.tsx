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
	Inbox,
	Search,
	UserPlus,
	UserSearch,
	Users,
	X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "#/integrations/trpc/react";

export const Route = createFileRoute("/app/friends")({
	component: FriendsPage,
});

const FRIENDS_LETTERS = [
	{ letter: "F", pos: 0 },
	{ letter: "R", pos: 1 },
	{ letter: "I", pos: 2 },
	{ letter: "E", pos: 3 },
	{ letter: "N", pos: 4 },
	{ letter: "D", pos: 5 },
	{ letter: "S", pos: 6 },
];

const SKELETON_KEYS = ["skel-a", "skel-b", "skel-c", "skel-d"];

// Marquee bulbs: 24 bulbs staggered in chase pattern
const MARQUEE_BULBS = Array.from({ length: 24 }, (_, i) => ({
	id: `marquee-${i}`,
	delay: `${(i * 0.1) % 0.8}s`,
}));

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
					{/* Left punch hole */}
					<div className="absolute -left-2.5 z-10 h-5 w-5 rounded-full bg-drive-in-bg" />
					{/* Right punch hole */}
					<div className="absolute -right-2.5 z-10 h-5 w-5 rounded-full bg-drive-in-bg" />
					{/* Dashed line */}
					<div className="mx-3 w-full border-t border-dashed border-neon-amber/18" />
				</div>

				{/* Bottom section: favourite film + minutes watched */}
				<div className="flex items-center gap-3 px-4 py-2.5 pr-6">
					<div className="flex min-w-0 flex-1 items-center gap-1.5">
						<Heart className="h-3 w-3 shrink-0 text-neon-pink/75" />
						<span className="truncate text-xs text-cream/40">
							{friend.favouriteFilmTmdbId
								? `Film #${friend.favouriteFilmTmdbId}`
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
			},
		}),
	);

	const declineMutation = useMutation(
		trpc.friend.declineRequest.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: trpc.friend.pendingRequests.queryKey(),
				});
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
			{/* Avatar + Info (links to profile) */}
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

			{/* Actions */}
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
			{/* Neon top-border glow on hover */}
			<div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-neon-cyan/0 transition-colors duration-200 group-hover:bg-neon-cyan/25" />

			{/* Avatar */}
			<a href={`/app/profile/${user.id}`} className="shrink-0 no-underline">
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
			</a>

			{/* Info */}
			<div className="min-w-0 flex-1">
				<a
					href={`/app/profile/${user.id}`}
					className="block truncate font-mono-retro text-sm text-cream/85 no-underline transition-colors hover:text-neon-cyan"
				>
					@{user.username ?? "unknown"}
				</a>
			</div>

			{/* Action */}
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

function DiscoverTab({ friendIds }: { friendIds: Set<string> }) {
	const trpc = useTRPC();
	const [discoverInput, setDiscoverInput] = useState("");
	const [debouncedQuery, setDebouncedQuery] = useState("");

	// Debounce the search input
	useEffect(() => {
		if (discoverInput.trim().length < 2) {
			setDebouncedQuery("");
			return;
		}
		const timer = setTimeout(() => {
			setDebouncedQuery(discoverInput.trim());
		}, 300);
		return () => clearTimeout(timer);
	}, [discoverInput]);

	const { data: searchResults, isLoading: searchLoading } = useQuery(
		trpc.watchlist.searchUsers.queryOptions(
			debouncedQuery.length >= 2 ? { query: debouncedQuery } : skipToken,
		),
	);

	const hasQuery = debouncedQuery.length >= 2;
	const isTyping =
		discoverInput.trim().length >= 2 && discoverInput.trim() !== debouncedQuery;

	return (
		<div>
			{/* Search input */}
			<div className="relative mb-6">
				<Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neon-amber/50" />
				<input
					type="text"
					placeholder="Search by username..."
					value={discoverInput}
					onChange={(e) => setDiscoverInput(e.target.value)}
					className="w-full rounded-lg border border-neon-amber/25 bg-neon-amber/[0.05] py-3 pl-10 pr-4 text-sm text-cream/85 outline-none transition-all placeholder:text-cream/25 focus:border-neon-amber/50 focus:shadow-[0_0_20px_rgba(255,184,0,0.08)]"
				/>
				{(searchLoading || isTyping) && hasQuery && (
					<div className="absolute right-3.5 top-1/2 -translate-y-1/2">
						<div className="h-4 w-4 animate-spin rounded-full border-2 border-neon-amber/20 border-t-neon-amber/60" />
					</div>
				)}
			</div>

			{/* Results */}
			<AnimatePresence mode="wait">
				{!hasQuery && !isTyping ? (
					/* Empty state: no search query */
					<motion.div
						key="empty"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className="flex flex-col items-center py-20 text-center"
					>
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
							Find your movie buddies
						</p>
						<p className="mt-1.5 max-w-xs text-sm text-cream/25">
							Search by username to discover friends and share your watchlists
							at the drive-in
						</p>
					</motion.div>
				) : searchLoading || isTyping ? (
					/* Loading skeletons */
					<motion.div
						key="loading"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className="flex flex-col gap-2"
					>
						{SKELETON_KEYS.map((key) => (
							<div
								key={key}
								className="h-[60px] animate-pulse rounded-lg bg-cream/[0.03]"
							/>
						))}
					</motion.div>
				) : searchResults && searchResults.length > 0 ? (
					/* Search results */
					<motion.div
						key="results"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className="flex flex-col gap-2"
					>
						{searchResults.map((result, index) => (
							<motion.div
								key={result.id}
								initial={{ opacity: 0, y: 12 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{
									duration: 0.25,
									delay: index * 0.06,
								}}
							>
								<DiscoverResultCard
									user={result}
									isFriend={friendIds.has(result.id)}
								/>
							</motion.div>
						))}
					</motion.div>
				) : (
					/* No results */
					<motion.div
						key="no-results"
						initial={{ opacity: 0, y: 6 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0 }}
						className="flex flex-col items-center py-20 text-center"
					>
						<Search className="mb-3 h-10 w-10 text-neon-amber/15" />
						<p className="text-base text-cream/40">
							No users found matching &ldquo;{debouncedQuery}&rdquo;
						</p>
						<p className="mt-1 text-sm text-cream/20">
							Try a different username
						</p>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}

function FriendsPage() {
	const trpc = useTRPC();
	const [activeTab, setActiveTab] = useState<
		"friends" | "requests" | "discover"
	>("friends");
	const [searchQuery, setSearchQuery] = useState("");

	const { data: friends, isLoading: friendsLoading } = useQuery(
		trpc.friend.list.queryOptions(),
	);
	const { data: pendingRequests } = useQuery(
		trpc.friend.pendingRequests.queryOptions(),
	);

	const pendingCount = pendingRequests?.length ?? 0;

	const filteredFriends = (friends ?? []).filter((f) => {
		if (!searchQuery.trim()) return true;
		return f.username?.toLowerCase().includes(searchQuery.toLowerCase().trim());
	});

	return (
		<>
			{/* Keyframe injection */}
			<style>{`
				@keyframes bulb-chase {
					0%, 100% { opacity: 0.15; box-shadow: 0 0 2px rgba(255,184,0,0.1); }
					50% { opacity: 1; box-shadow: 0 0 6px rgba(255,184,0,0.6), 0 0 12px rgba(255,184,0,0.3); }
				}
				@keyframes grain {
					0%, 100% { transform: translate(0, 0); }
					10% { transform: translate(-1%, -1%); }
					20% { transform: translate(1%, 0%); }
					30% { transform: translate(-0.5%, 1%); }
					40% { transform: translate(0.5%, -0.5%); }
					50% { transform: translate(-1%, 0.5%); }
					60% { transform: translate(1%, -1%); }
					70% { transform: translate(0%, 1%); }
					80% { transform: translate(-0.5%, -0.5%); }
					90% { transform: translate(0.5%, 0%); }
				}
			`}</style>

			<div className="relative mx-auto max-w-4xl px-4 pb-16 pt-10">
				{/* Subtle film grain overlay */}
				<div
					className="pointer-events-none fixed inset-0 z-50 opacity-[0.03]"
					style={{
						backgroundImage:
							"url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")",
						animation: "grain 0.5s steps(1) infinite",
					}}
				/>

				{/* Ambient projector beam glow */}
				<div
					className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2"
					style={{
						width: "600px",
						height: "300px",
						background:
							"radial-gradient(ellipse at center, rgba(255,184,0,0.04) 0%, transparent 70%)",
					}}
				/>

				{/* Header: F.R.I.E.N.D.S cinema marquee */}
				<div className="flex justify-center">
					<div className="relative max-w-[600px] px-12 pb-5 pt-6 text-center">
						{/* Amber border frame with corner glow */}
						<div
							className="pointer-events-none absolute inset-0 rounded-lg"
							style={{
								border: "2px solid rgba(255,184,0,0.28)",
								boxShadow:
									"0 0 24px rgba(255,184,0,0.06), inset 0 0 24px rgba(255,184,0,0.02), 0 0 60px rgba(255,184,0,0.03)",
							}}
						/>
						{/* Corner glow accents */}
						<div
							className="pointer-events-none absolute -left-1 -top-1 h-8 w-8"
							style={{
								background:
									"radial-gradient(circle at top left, rgba(255,184,0,0.15) 0%, transparent 70%)",
							}}
						/>
						<div
							className="pointer-events-none absolute -right-1 -top-1 h-8 w-8"
							style={{
								background:
									"radial-gradient(circle at top right, rgba(255,184,0,0.15) 0%, transparent 70%)",
							}}
						/>
						<div
							className="pointer-events-none absolute -bottom-1 -left-1 h-8 w-8"
							style={{
								background:
									"radial-gradient(circle at bottom left, rgba(255,184,0,0.15) 0%, transparent 70%)",
							}}
						/>
						<div
							className="pointer-events-none absolute -bottom-1 -right-1 h-8 w-8"
							style={{
								background:
									"radial-gradient(circle at bottom right, rgba(255,184,0,0.15) 0%, transparent 70%)",
							}}
						/>

						{/* Marquee bulbs row */}
						<div className="absolute left-6 right-6 -top-[5px] h-[10px]">
							{MARQUEE_BULBS.map((bulb) => (
								<div
									key={bulb.id}
									className="absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-neon-amber"
									style={{
										left: `${(Number.parseInt(bulb.id.split("-")[1], 10) / (MARQUEE_BULBS.length - 1)) * 100}%`,
										transform: "translateX(-50%) translateY(-50%)",
										animation: `bulb-chase 1.6s ease-in-out infinite`,
										animationDelay: bulb.delay,
									}}
								/>
							))}
						</div>

						{/* NOW SHOWING label */}
						<p className="m-0 mb-2.5 font-mono-retro text-[9px] uppercase tracking-[5px] text-neon-amber/60">
							&#9733; NOW SHOWING &#9733;
						</p>

						{/* F.R.I.E.N.D.S title */}
						<h1 className="m-0 font-display text-[44px] leading-none">
							{FRIENDS_LETTERS.map(({ letter, pos }) => (
								<span key={`letter-${pos}`}>
									<span
										className="text-neon-amber"
										style={{
											textShadow:
												"0 0 10px rgba(255,184,0,0.3), 0 0 30px rgba(255,184,0,0.1)",
										}}
									>
										{letter}
									</span>
									{pos < 6 && (
										<span
											className="inline-block align-middle text-[22px] text-neon-pink/90"
											style={{
												textShadow:
													"0 0 8px rgba(255,45,120,0.4), 0 0 20px rgba(255,45,120,0.15)",
											}}
										>
											.
										</span>
									)}
								</span>
							))}
						</h1>
					</div>
				</div>

				{/* Tabs */}
				<div className="mt-8 flex items-center gap-0 border-b border-neon-amber/12">
					<button
						type="button"
						onClick={() => setActiveTab("friends")}
						className={`-mb-px flex cursor-pointer items-center gap-2 border-b-2 bg-transparent px-5 py-2.5 text-sm font-medium transition-colors ${
							activeTab === "friends"
								? "border-neon-amber text-neon-amber"
								: "border-transparent text-cream/40 hover:text-cream/60"
						}`}
					>
						<Users className="h-4 w-4" />
						My Friends
						{friends && friends.length > 0 && (
							<span
								className={`ml-0.5 rounded px-1.5 py-0.5 text-xs ${
									activeTab === "friends"
										? "bg-neon-amber/15 text-neon-amber"
										: "bg-cream/6 text-cream/30"
								}`}
							>
								{friends.length}
							</span>
						)}
					</button>

					<button
						type="button"
						onClick={() => setActiveTab("requests")}
						className={`-mb-px flex cursor-pointer items-center gap-2 border-b-2 bg-transparent px-5 py-2.5 text-sm font-medium transition-colors ${
							activeTab === "requests"
								? "border-neon-amber text-neon-amber"
								: "border-transparent text-cream/40 hover:text-cream/60"
						}`}
					>
						<Inbox className="h-4 w-4" />
						Requests
						{pendingCount > 0 && (
							<span className="ml-0.5 min-w-[18px] rounded-full bg-neon-pink px-1.5 py-0.5 text-center text-xs font-bold text-white">
								{pendingCount}
							</span>
						)}
					</button>

					<button
						type="button"
						onClick={() => setActiveTab("discover")}
						className={`-mb-px flex cursor-pointer items-center gap-2 border-b-2 bg-transparent px-5 py-2.5 text-sm font-medium transition-colors ${
							activeTab === "discover"
								? "border-neon-amber text-neon-amber"
								: "border-transparent text-cream/40 hover:text-cream/60"
						}`}
					>
						<UserSearch className="h-4 w-4" />
						Add a Friend
					</button>
				</div>

				{/* Tab content with animated transitions */}
				<div className="mt-6">
					<AnimatePresence mode="wait">
						{activeTab === "friends" && (
							<motion.div
								key="friends"
								initial={{ opacity: 0, y: 8 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -8 }}
								transition={{ duration: 0.2 }}
								layout
							>
								{/* Search bar */}
								<div className="relative mb-6">
									<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neon-amber/50" />
									<input
										type="text"
										placeholder="Search friends..."
										value={searchQuery}
										onChange={(e) => setSearchQuery(e.target.value)}
										className="w-full rounded-lg border border-neon-amber/20 bg-neon-amber/[0.04] py-2.5 pl-9 pr-4 text-sm text-cream/80 outline-none transition-colors placeholder:text-cream/25 focus:border-neon-amber/45"
									/>
								</div>

								{/* Friends grid */}
								{friendsLoading ? (
									<div className="grid grid-cols-2 gap-3">
										{SKELETON_KEYS.map((key) => (
											<div
												key={key}
												className="h-24 animate-pulse rounded-lg bg-cream/[0.04]"
											/>
										))}
									</div>
								) : filteredFriends.length === 0 ? (
									<div className="flex flex-col items-center py-20 text-center">
										<Users className="mb-3 h-10 w-10 text-neon-amber/20" />
										{searchQuery.trim() ? (
											<p className="text-sm text-cream/35">
												No friends match &ldquo;{searchQuery}&rdquo;
											</p>
										) : (
											<>
												<p className="text-base text-cream/45">
													No friends yet
												</p>
												<p className="mt-1 text-sm text-cream/25">
													Search for people to add as friends
												</p>
											</>
										)}
									</div>
								) : (
									<div className="grid grid-cols-2 gap-3">
										{filteredFriends.map((friend) => (
											<TicketStubCard key={friend.id} friend={friend} />
										))}
									</div>
								)}
							</motion.div>
						)}

						{activeTab === "requests" && (
							<motion.div
								key="requests"
								initial={{ opacity: 0, y: 8 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -8 }}
								transition={{ duration: 0.2 }}
								layout
							>
								{pendingRequests && pendingRequests.length > 0 ? (
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
								) : (
									<div className="flex flex-col items-center py-20 text-center">
										<Inbox className="mb-3 h-10 w-10 text-neon-amber/20" />
										<p className="text-base text-cream/45">
											No pending requests
										</p>
										<p className="mt-1 text-sm text-cream/25">
											When someone sends you a friend request, it will appear
											here
										</p>
									</div>
								)}
							</motion.div>
						)}

						{activeTab === "discover" && (
							<motion.div
								key="discover"
								initial={{ opacity: 0, y: 8 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -8 }}
								transition={{ duration: 0.2 }}
								layout
							>
								<DiscoverTab
									friendIds={new Set((friends ?? []).map((f) => f.id))}
								/>
							</motion.div>
						)}
					</AnimatePresence>
				</div>
			</div>
		</>
	);
}
