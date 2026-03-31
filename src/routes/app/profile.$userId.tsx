import {
	skipToken,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	Award,
	Ban,
	BarChart3,
	CalendarDays,
	ChevronRight,
	Film,
	Heart,
	Lock,
	Trophy,
	UserMinus,
	UserPlus,
	X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { useTRPC } from "#/integrations/trpc/react";
import { getUnifiedGenreById } from "#/lib/genre-map";
import { getTmdbImageUrl } from "#/lib/tmdb";

export const Route = createFileRoute("/app/profile/$userId")({
	component: ProfilePage,
});

// ── Marquee bulbs ──────────────────────────────────────────────
const MARQUEE_BULB_COUNT = 28;
const MARQUEE_BULBS = Array.from({ length: MARQUEE_BULB_COUNT }, (_, i) => ({
	id: i,
	delay: `${(i * 0.12) % 1.0}s`,
}));

// ── Deterministic hash for seeded "random" demo data ──────────
function hashStr(s: string) {
	let h = 0;
	for (let i = 0; i < s.length; i++)
		h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
	return Math.abs(h);
}

function seededRandom(seed: number) {
	let s = seed;
	return () => {
		s = (s * 16807 + 0) % 2147483647;
		return s / 2147483647;
	};
}

// ── Heatmap: flat array of cells in column-major order (7 rows × COLS) ──
const HEATMAP_COLS = 26;
const HEATMAP_ROWS = 7;

function buildHeatmapCells(userId: string) {
	const rand = seededRandom(hashStr(`${userId}heatmap`));
	const cells: { key: string; level: number }[] = [];
	for (let row = 0; row < HEATMAP_ROWS; row++) {
		for (let col = 0; col < HEATMAP_COLS; col++) {
			const r = rand();
			const level = r < 0.3 ? 0 : r < 0.55 ? 1 : r < 0.75 ? 2 : r < 0.9 ? 3 : 4;
			cells.push({ key: `h-${row}-${col}`, level });
		}
	}
	return cells;
}

const HEATMAP_COLORS = [
	"bg-cream/[0.04]", // 0 — empty
	"bg-neon-pink/20", // 1
	"bg-neon-pink/40", // 2
	"bg-neon-pink/60", // 3
	"bg-neon-pink/80", // 4
];

// ── Demo achievements ─────────────────────────────────────────
const DEMO_ACHIEVEMENTS_EARNED = [
	{
		icon: "🎬",
		label: "First Watch",
		desc: "Watched your first title",
		date: "Jan 12, 2025",
	},
	{
		icon: "🔥",
		label: "Binge Master",
		desc: "Watched 5 titles in one day",
		date: "Feb 3, 2025",
	},
	{
		icon: "🌍",
		label: "Genre Explorer",
		desc: "Watched titles in 10 genres",
		date: "Mar 8, 2025",
	},
	{
		icon: "🍿",
		label: "Watchlist Creator",
		desc: "Created 3 watchlists",
		date: "Mar 15, 2025",
	},
	{ icon: "⭐", label: "Critic", desc: "Wrote 5 reviews", date: "Apr 1, 2025" },
	{
		icon: "👯",
		label: "Social Butterfly",
		desc: "Added 5 friends",
		date: "Apr 20, 2025",
	},
	{
		icon: "🎯",
		label: "Completionist",
		desc: "Finished a watchlist",
		date: "May 5, 2025",
	},
	{
		icon: "🌙",
		label: "Night Owl",
		desc: "Watched something after midnight",
		date: "May 18, 2025",
	},
	{
		icon: "📺",
		label: "Series Addict",
		desc: "Finished a TV series",
		date: "Jun 2, 2025",
	},
	{
		icon: "🏆",
		label: "Century Club",
		desc: "Watched 100 titles",
		date: "Jul 14, 2025",
	},
	{
		icon: "💀",
		label: "Horror Fanatic",
		desc: "Watched 25 horror films",
		date: "Aug 9, 2025",
	},
	{
		icon: "🎭",
		label: "Drama Queen",
		desc: "Watched 15 dramas",
		date: "Sep 22, 2025",
	},
];
const DEMO_ACHIEVEMENTS_TOTAL = 50;

// ── Demo reviews ──────────────────────────────────────────────
const DEMO_REVIEWS = [
	{
		title: "The Shining",
		rating: 5,
		text: "Kubrick at his finest. The Overlook Hotel is a character in itself.",
		time: "2d ago",
	},
	{
		title: "Alien",
		rating: 4,
		text: "Ridley Scott created the perfect sci-fi horror. Still holds up.",
		time: "1w ago",
	},
	{
		title: "Hereditary",
		rating: 5,
		text: "Ari Aster doesn't let you look away. Toni Collette was robbed.",
		time: "2w ago",
	},
];

// ── Demo activity ─────────────────────────────────────────────
const DEMO_ACTIVITY = [
	{
		action: "Watched",
		title: "The Shining",
		time: "2d ago",
		color: "neon-pink",
	},
	{
		action: "Added to watchlist",
		title: "Midsommar",
		time: "3d ago",
		color: "neon-cyan",
	},
	{ action: "Reviewed", title: "Alien", time: "1w ago", color: "neon-amber" },
	{ action: "Watched", title: "Get Out", time: "1w ago", color: "neon-pink" },
	{
		action: "Added to watchlist",
		title: "Nope",
		time: "2w ago",
		color: "neon-cyan",
	},
];

// ── Avatar gradient by first character ──────────────────────────
function avatarGradient(_letter: string) {
	// Site colors only — pink, amber, cyan — with hard stops to avoid green blending
	return "conic-gradient(from 0deg, #FF2D78 0deg, #FF2D78 60deg, #FFB800 60deg, #FFB800 180deg, #00E5FF 180deg, #00E5FF 300deg, #FF2D78 300deg)";
}

// ── Tabs enum ──────────────────────────────────────────────────
type FriendTab = "watchlists" | "reviews" | "activity";
const TABS: {
	key: FriendTab;
	label: string;
	color: string;
	activeColor: string;
}[] = [
	{
		key: "watchlists",
		label: "Watchlists",
		color: "neon-cyan",
		activeColor: "text-neon-cyan border-neon-cyan",
	},
	{
		key: "reviews",
		label: "Reviews",
		color: "neon-amber",
		activeColor: "text-neon-amber border-neon-amber",
	},
	{
		key: "activity",
		label: "Activity",
		color: "neon-pink",
		activeColor: "text-neon-pink border-neon-pink",
	},
];

// ── Keyframes ──────────────────────────────────────────────────
const PROFILE_KEYFRAMES = `
@keyframes bulb-chase-profile {
	0%, 100% { opacity: 0.12; box-shadow: 0 0 2px rgba(255,184,0,0.08); }
	50% { opacity: 1; box-shadow: 0 0 6px rgba(255,184,0,0.6), 0 0 14px rgba(255,184,0,0.25); }
}
@keyframes avatar-ring-rotate {
	0% { transform: rotate(0deg); }
	100% { transform: rotate(360deg); }
}
@keyframes shimmer-sweep {
	0% { transform: translateX(-100%); }
	100% { transform: translateX(100%); }
}
@keyframes projector-sweep {
	0% { transform: rotate(0deg); }
	100% { transform: rotate(360deg); }
}
@keyframes scanline-scroll {
	0% { background-position: 0 0; }
	100% { background-position: 0 4px; }
}
@keyframes grain-profile {
	0%, 100% { transform: translate(0, 0); }
	10% { transform: translate(-1%, -1%); }
	30% { transform: translate(1%, 0.5%); }
	50% { transform: translate(-0.5%, 1%); }
	70% { transform: translate(0.5%, -0.5%); }
	90% { transform: translate(-1%, 0%); }
}
@keyframes trophy-wiggle {
	0%, 100% { transform: rotate(0deg); }
	20% { transform: rotate(-12deg); }
	40% { transform: rotate(10deg); }
	60% { transform: rotate(-6deg); }
	80% { transform: rotate(4deg); }
}
.group:hover .trophy-wiggle {
	animation: trophy-wiggle 0.5s ease-in-out;
}
`;

// ════════════════════════════════════════════════════════════════
// ProfilePage
// ════════════════════════════════════════════════════════════════

function ProfilePage() {
	const { userId } = Route.useParams();
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	// ── Queries ────────────────────────────────────────────────
	const { data: profile, isLoading } = useQuery(
		trpc.friend.profile.queryOptions({ userId }),
	);

	const { data: mutualFriends } = useQuery(
		trpc.friend.mutualFriends.queryOptions({ userId }),
	);

	const { data: favFilm } = useQuery(
		trpc.title.details.queryOptions(
			profile?.favouriteFilmTmdbId
				? {
						tmdbId: profile.favouriteFilmTmdbId,
						mediaType: "movie" as const,
					}
				: skipToken,
		),
	);

	// ── Mutations ──────────────────────────────────────────────
	const invalidateAll = () => {
		queryClient.invalidateQueries({
			queryKey: trpc.friend.profile.queryKey(),
		});
		queryClient.invalidateQueries({ queryKey: trpc.friend.list.queryKey() });
		queryClient.invalidateQueries({
			queryKey: trpc.friend.pendingRequests.queryKey(),
		});
		queryClient.invalidateQueries({
			queryKey: trpc.friend.mutualFriends.queryKey(),
		});
	};

	const sendRequest = useMutation(
		trpc.friend.sendRequest.mutationOptions({ onSuccess: invalidateAll }),
	);
	const cancelRequest = useMutation(
		trpc.friend.cancelRequest.mutationOptions({ onSuccess: invalidateAll }),
	);
	const acceptRequest = useMutation(
		trpc.friend.acceptRequest.mutationOptions({ onSuccess: invalidateAll }),
	);
	const declineRequest = useMutation(
		trpc.friend.declineRequest.mutationOptions({ onSuccess: invalidateAll }),
	);
	const removeFriend = useMutation(
		trpc.friend.removeFriend.mutationOptions({ onSuccess: invalidateAll }),
	);
	const blockUser = useMutation(
		trpc.friend.block.mutationOptions({ onSuccess: invalidateAll }),
	);

	const [activeTab, setActiveTab] = useState<FriendTab>("watchlists");
	const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
	const [showBlockConfirm, setShowBlockConfirm] = useState(false);

	const anyMutating =
		sendRequest.isPending ||
		cancelRequest.isPending ||
		acceptRequest.isPending ||
		declineRequest.isPending ||
		removeFriend.isPending ||
		blockUser.isPending;

	// ── Loading skeleton ──────────────────────────────────────
	if (isLoading || !profile) {
		return (
			<>
				<style>{PROFILE_KEYFRAMES}</style>
				<div className="flex justify-center px-4 py-12">
					<div className="w-full max-w-[560px] animate-pulse rounded-[20px] border border-drive-in-border bg-drive-in-card p-8">
						<div className="mx-auto mb-4 h-24 w-24 rounded-full bg-cream/[0.06]" />
						<div className="mx-auto mb-3 h-6 w-40 rounded bg-cream/[0.06]" />
						<div className="mx-auto mb-6 h-9 w-32 rounded-lg bg-cream/[0.06]" />
						<div className="flex justify-between gap-4">
							{[1, 2, 3].map((n) => (
								<div key={n} className="h-14 flex-1 rounded bg-cream/[0.04]" />
							))}
						</div>
					</div>
				</div>
			</>
		);
	}

	const isFriend = profile.isFriend;
	const initial = (profile.username ?? "?").charAt(0).toUpperCase();
	const genreName = profile.favouriteGenreId
		? (getUnifiedGenreById(profile.favouriteGenreId)?.name ?? null)
		: null;

	return (
		<>
			<style>{PROFILE_KEYFRAMES}</style>

			<div className="flex justify-center px-4 py-10 pb-24">
				{/* ── Main card ──────────────────────────────────── */}
				<div
					className="relative w-full max-w-[560px] overflow-hidden rounded-[20px]"
					style={{
						background:
							"linear-gradient(165deg, rgba(10,10,30,0.95), rgba(5,5,15,0.98))",
						border: "1px solid rgba(26,26,46,1)",
					}}
				>
					{/* Scanline overlay */}
					<div
						className="pointer-events-none absolute inset-0 z-[2] opacity-[0.03]"
						style={{
							backgroundImage:
								"repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,240,0.04) 2px, rgba(255,255,240,0.04) 4px)",
							animation: "scanline-scroll 0.3s linear infinite",
						}}
					/>

					{/* Projector sweep */}
					<div
						className="pointer-events-none absolute -right-32 -top-32 z-[1] h-64 w-64 opacity-[0.02]"
						style={{
							background:
								"conic-gradient(from 0deg, transparent 0%, rgba(255,184,0,0.3) 10%, transparent 20%)",
							animation: "projector-sweep 12s linear infinite",
						}}
					/>

					{/* Film grain */}
					<div
						className="pointer-events-none absolute inset-0 z-[3] opacity-[0.025]"
						style={{
							backgroundImage:
								"url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
							animation: "grain-profile 0.4s steps(1) infinite",
						}}
					/>

					{/* ── 1. Marquee lights ────────────────────── */}
					<div className="relative z-10 flex h-3 items-center">
						{MARQUEE_BULBS.map((bulb) => (
							<div
								key={bulb.id}
								className="absolute top-1/2 h-[5px] w-[5px] -translate-y-1/2 rounded-full bg-neon-amber"
								style={{
									left: `${(bulb.id / (MARQUEE_BULB_COUNT - 1)) * 100}%`,
									transform: "translateX(-50%) translateY(-50%)",
									animation: "bulb-chase-profile 1.6s ease-in-out infinite",
									animationDelay: bulb.delay,
								}}
							/>
						))}
					</div>

					<div className="relative z-10 px-6 pb-7 pt-5">
						{/* ── 2. Avatar ────────────────────────── */}
						<div className="flex justify-center">
							<div className="relative">
								{/* Rotating neon ring */}
								<div
									className="absolute -inset-[4px] rounded-full"
									style={{
										background: avatarGradient(initial),
										}}
								/>
								{/* Glow behind avatar */}
								<div
									className="absolute -inset-3 rounded-full opacity-30 blur-xl"
									style={{
										background: avatarGradient(initial),
									}}
								/>
								{/* Avatar itself */}
								<div className="relative h-24 w-24 overflow-hidden rounded-full border-[3px] border-drive-in-bg">
									{profile.avatarUrl ? (
										<img
											src={profile.avatarUrl}
											alt={profile.username ?? "User"}
											className="h-full w-full object-cover"
										/>
									) : (
										<div
											className="flex h-full w-full items-center justify-center"
											style={{
												background:
													"linear-gradient(135deg, rgba(10,10,30,0.9), rgba(20,20,50,0.9))",
											}}
										>
											<span className="font-display text-3xl text-cream/80">
												{initial}
											</span>
										</div>
									)}
								</div>
							</div>
						</div>

						{/* ── 3. Username ──────────────────────── */}
						<h1
							className="mt-4 text-center font-display text-2xl text-cream"
							style={{
								textShadow: "0 0 20px rgba(255,255,240,0.08)",
							}}
						>
							@{profile.username ?? "unknown"}
						</h1>

						{/* ── 4. Action buttons ───────────────── */}
						<div className="mt-3 flex justify-center gap-2">
							{profile.relationshipStatus ===
							"blocked" ? null : profile.relationshipStatus === "none" ? (
								/* Add Friend */
								<button
									type="button"
									onClick={() => sendRequest.mutate({ userId })}
									disabled={anyMutating}
									className="relative flex items-center gap-2 overflow-hidden rounded-lg border border-neon-pink/40 bg-neon-pink/10 px-5 py-2.5 font-mono-retro text-xs uppercase tracking-[2px] text-neon-pink transition-all hover:border-neon-pink/60 hover:bg-neon-pink/15 disabled:opacity-50"
									style={{
										textShadow: "0 0 10px rgba(255,45,120,0.3)",
									}}
								>
									<div
										className="pointer-events-none absolute inset-0 opacity-20"
										style={{
											background:
												"linear-gradient(90deg, transparent, rgba(255,45,120,0.4), transparent)",
											animation: "shimmer-sweep 2.5s ease-in-out infinite",
										}}
									/>
									<UserPlus className="relative z-10 h-4 w-4" />
									<span className="relative z-10">Add Friend</span>
								</button>
							) : profile.relationshipStatus === "request_sent" ? (
								/* Request Sent */
								<div className="flex items-center gap-2">
									<span className="font-mono-retro text-[10px] uppercase tracking-[1.5px] text-cream/35">
										Request Sent
									</span>
									<button
										type="button"
										onClick={() =>
											profile.friendshipId &&
											cancelRequest.mutate({
												friendshipId: profile.friendshipId,
											})
										}
										disabled={anyMutating}
										className="flex items-center gap-1 rounded-md border border-cream/12 bg-cream/[0.04] px-3 py-1.5 font-mono-retro text-[10px] uppercase tracking-[1px] text-cream/40 transition-all hover:border-cream/25 hover:text-cream/60 disabled:opacity-50"
									>
										<X className="h-3 w-3" />
										Cancel
									</button>
								</div>
							) : profile.relationshipStatus === "request_received" ? (
								/* Accept / Decline */
								<div className="flex items-center gap-2">
									<button
										type="button"
										onClick={() =>
											profile.friendshipId &&
											acceptRequest.mutate({
												friendshipId: profile.friendshipId,
											})
										}
										disabled={anyMutating}
										className="flex items-center gap-1.5 rounded-lg border border-neon-cyan/40 bg-neon-cyan/10 px-4 py-2 font-mono-retro text-[10px] uppercase tracking-[1.5px] text-neon-cyan transition-all hover:border-neon-cyan/60 hover:bg-neon-cyan/15 disabled:opacity-50"
										style={{
											textShadow: "0 0 8px rgba(0,229,255,0.25)",
										}}
									>
										Accept
									</button>
									<button
										type="button"
										onClick={() =>
											profile.friendshipId &&
											declineRequest.mutate({
												friendshipId: profile.friendshipId,
											})
										}
										disabled={anyMutating}
										className="flex items-center gap-1 rounded-lg border border-cream/12 bg-cream/[0.04] px-4 py-2 font-mono-retro text-[10px] uppercase tracking-[1.5px] text-cream/35 transition-all hover:border-cream/25 hover:text-cream/55 disabled:opacity-50"
									>
										Decline
									</button>
								</div>
							) : isFriend ? (
								/* Friend actions: Remove / Block */
								<AnimatePresence mode="wait">
									{showRemoveConfirm ? (
										<motion.div
											key="remove-confirm"
											initial={{
												opacity: 0,
												scale: 0.95,
											}}
											animate={{
												opacity: 1,
												scale: 1,
											}}
											exit={{
												opacity: 0,
												scale: 0.95,
											}}
											className="flex items-center gap-2"
										>
											<span className="text-xs text-cream/40">Remove?</span>
											<button
												type="button"
												onClick={() => {
													removeFriend.mutate({
														userId,
													});
													setShowRemoveConfirm(false);
												}}
												disabled={anyMutating}
												className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1 font-mono-retro text-[10px] uppercase text-red-400 transition-all hover:border-red-500/50 hover:bg-red-500/20 disabled:opacity-50"
											>
												Yes
											</button>
											<button
												type="button"
												onClick={() => setShowRemoveConfirm(false)}
												className="rounded-md border border-cream/12 bg-cream/[0.04] px-3 py-1 font-mono-retro text-[10px] uppercase text-cream/40 transition-all hover:border-cream/25"
											>
												No
											</button>
										</motion.div>
									) : showBlockConfirm ? (
										<motion.div
											key="block-confirm"
											initial={{
												opacity: 0,
												scale: 0.95,
											}}
											animate={{
												opacity: 1,
												scale: 1,
											}}
											exit={{
												opacity: 0,
												scale: 0.95,
											}}
											className="flex items-center gap-2"
										>
											<span className="text-xs text-cream/40">Block?</span>
											<button
												type="button"
												onClick={() => {
													blockUser.mutate({
														userId,
													});
													setShowBlockConfirm(false);
												}}
												disabled={anyMutating}
												className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1 font-mono-retro text-[10px] uppercase text-red-400 transition-all hover:border-red-500/50 hover:bg-red-500/20 disabled:opacity-50"
											>
												Yes
											</button>
											<button
												type="button"
												onClick={() => setShowBlockConfirm(false)}
												className="rounded-md border border-cream/12 bg-cream/[0.04] px-3 py-1 font-mono-retro text-[10px] uppercase text-cream/40 transition-all hover:border-cream/25"
											>
												No
											</button>
										</motion.div>
									) : (
										<motion.div
											key="friend-actions"
											initial={{
												opacity: 0,
												scale: 0.95,
											}}
											animate={{
												opacity: 1,
												scale: 1,
											}}
											exit={{
												opacity: 0,
												scale: 0.95,
											}}
											className="flex items-center gap-2"
										>
											<button
												type="button"
												onClick={() => setShowRemoveConfirm(true)}
												className="flex items-center gap-1 rounded-md border border-cream/10 bg-cream/[0.03] px-3 py-1.5 font-mono-retro text-[9px] uppercase tracking-[1px] text-cream/30 transition-all hover:border-cream/20 hover:text-cream/50"
											>
												<UserMinus className="h-3 w-3" />
												Remove
											</button>
											<button
												type="button"
												onClick={() => setShowBlockConfirm(true)}
												className="flex items-center gap-1 rounded-md border border-cream/10 bg-cream/[0.03] px-3 py-1.5 font-mono-retro text-[9px] uppercase tracking-[1px] text-cream/30 transition-all hover:border-red-500/25 hover:text-red-400/60"
											>
												<Ban className="h-3 w-3" />
												Block
											</button>
										</motion.div>
									)}
								</AnimatePresence>
							) : null}
						</div>

						{/* ── 5a. Watch time ─────────────────── */}
						<div className="mt-6 flex flex-col items-center py-2">
							<span
								className="font-display text-2xl text-neon-cyan"
								style={{
									textShadow: "0 0 12px rgba(0,229,255,0.3)",
								}}
							>
								72h 0m
							</span>
							<span className="mt-0.5 font-mono-retro text-[9px] uppercase tracking-[2px] text-cream/55">
								Watched
							</span>
						</div>

						{/* ── 5b. Stats row ──────────────────── */}
						<div className="mt-2 flex items-stretch overflow-hidden rounded-lg border border-drive-in-border">
							{/* Friends count */}
							<div className="flex flex-1 flex-col items-center justify-center py-3">
								<span
									className="font-display text-lg text-neon-cyan"
									style={{
										textShadow: "0 0 10px rgba(0,229,255,0.3)",
									}}
								>
									{profile.friendCount}
								</span>
								<span className="mt-0.5 font-mono-retro text-[9px] uppercase tracking-[2px] text-cream/55">
									Friends
								</span>
							</div>
							<div className="w-px bg-drive-in-border" />
							{/* Favourite genre */}
							<div className="flex flex-1 flex-col items-center justify-center py-3">
								<span
									className="font-display text-sm text-neon-pink"
									style={{
										textShadow: "0 0 10px rgba(255,45,120,0.3)",
									}}
								>
									{genreName ?? "None"}
								</span>
								<span className="mt-0.5 font-mono-retro text-[9px] uppercase tracking-[2px] text-cream/55">
									Fav Genre
								</span>
							</div>
							<div className="w-px bg-drive-in-border" />
							{/* Mutual friends */}
							<div className="flex flex-1 flex-col items-center justify-center py-3">
								<span
									className="font-display text-lg text-neon-amber"
									style={{
										textShadow: "0 0 10px rgba(255,184,0,0.3)",
									}}
								>
									{mutualFriends?.length ?? 0}
								</span>
								<span className="mt-0.5 font-mono-retro text-[9px] uppercase tracking-[2px] text-cream/55">
									Mutual
								</span>
							</div>
						</div>

						{/* ── 6. Bio ───────────────────────────── */}
						{profile.bio && (
							<div
								className="mt-5 rounded-lg border border-neon-amber/20 px-4 py-3"
								style={{
									background:
										"linear-gradient(135deg, rgba(255,184,0,0.03), rgba(255,184,0,0.01))",
								}}
							>
								<div className="mb-1.5 flex items-center gap-1.5">
									<span className="text-neon-amber/50">&#10022;</span>
									<span className="font-mono-retro text-[9px] uppercase tracking-[2px] text-neon-amber/50">
										Bio
									</span>
									<span className="text-neon-amber/50">&#10022;</span>
								</div>
								<p className="text-sm leading-relaxed text-cream/65">
									{profile.bio}
								</p>
							</div>
						)}

						{/* ── 7. Achievements ──────────────────── */}
						<AchievementsDesignB />

						{/* ── 8. Favourite film ────────────────── */}
						{profile.favouriteFilmTmdbId && (
							<div className="mt-5">
								<div className="mb-2 flex items-center justify-center gap-1.5">
									<Heart className="h-3 w-3 text-neon-pink/60" />
									<span className="font-mono-retro text-[10px] uppercase tracking-[2px] text-cream/70">
										Favourite Film
									</span>
								</div>
								<FavouriteFilmPoster
									tmdbId={profile.favouriteFilmTmdbId}
									film={favFilm ?? null}
								/>
							</div>
						)}

						{/* ═══════════════════════════════════════ */}
						{/* Friend-only or non-friend sections     */}
						{/* ═══════════════════════════════════════ */}

						{isFriend ? (
							<FriendExpandedSections
								profile={profile}
								userId={userId}
								activeTab={activeTab}
								setActiveTab={setActiveTab}
							/>
						) : (
							<NonFriendGatedSections status={profile.relationshipStatus} />
						)}
					</div>
				</div>
			</div>
		</>
	);
}

// ════════════════════════════════════════════════════════════════
// Achievements popup (shared by all designs)
// ════════════════════════════════════════════════════════════════

function AchievementsPopup({
	open,
	onClose,
}: {
	open: boolean;
	onClose: () => void;
}) {
	const earned = DEMO_ACHIEVEMENTS_EARNED.length;
	const total = DEMO_ACHIEVEMENTS_TOTAL;

	return (
		<AnimatePresence>
			{open && (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
					onClick={onClose}
				>
					<motion.div
						initial={{ opacity: 0, scale: 0.95, y: 10 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.95, y: 10 }}
						onClick={(e) => e.stopPropagation()}
						className="max-h-[70vh] w-full max-w-[420px] overflow-y-auto rounded-xl border border-drive-in-border bg-drive-in-bg p-5"
					>
						<div className="mb-4 flex items-center justify-between">
							<div className="flex items-center gap-2">
								<Trophy className="h-4 w-4 text-neon-amber" />
								<span className="font-mono-retro text-xs uppercase tracking-[2px] text-cream/80">
									Achievements
								</span>
								<span className="font-mono-retro text-xs text-cream/35">
									{earned}/{total}
								</span>
							</div>
							<button
								type="button"
								onClick={onClose}
								className="flex h-7 w-7 items-center justify-center rounded-full border border-cream/10 text-cream/40 transition-colors hover:border-cream/25 hover:text-cream/70"
							>
								<X className="h-3.5 w-3.5" />
							</button>
						</div>
						<div className="space-y-2">
							{DEMO_ACHIEVEMENTS_EARNED.map((a) => (
								<div
									key={a.label}
									className="flex items-center gap-3 rounded-lg border border-neon-amber/10 bg-neon-amber/[0.02] px-3 py-2.5"
								>
									<span className="text-xl">{a.icon}</span>
									<div className="min-w-0 flex-1">
										<p className="text-sm font-medium text-cream/75">
											{a.label}
										</p>
										<p className="text-xs text-cream/35">{a.desc}</p>
									</div>
									<span className="shrink-0 font-mono-retro text-[9px] text-cream/45">
										{a.date}
									</span>
								</div>
							))}
						</div>
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}

// ════════════════════════════════════════════════════════════════
// Design A — Recent badges row with count chip
// Shows last 3 earned icons in a row + "12/50" badge on the right
// ════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════
// Achievements — Centered trophy with ring progress
// ════════════════════════════════════════════════════════════════

function AchievementsDesignB() {
	const [open, setOpen] = useState(false);
	const earned = DEMO_ACHIEVEMENTS_EARNED.length;
	const total = DEMO_ACHIEVEMENTS_TOTAL;
	const pct = Math.round((earned / total) * 100);
	const radius = 34;
	const circumference = 2 * Math.PI * radius;
	const strokeDash = circumference * (pct / 100);
	const size = 80;
	const center = size / 2;

	return (
		<div className="mt-6">
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="group flex w-full flex-col items-center gap-1 py-2 transition-all"
			>
				{/* Ring progress */}
				<div
					className="relative flex items-center justify-center"
					style={{ width: size, height: size }}
				>
					<svg
						className="absolute inset-0"
						viewBox={`0 0 ${size} ${size}`}
						fill="none"
						role="img"
						aria-label="Achievement progress"
					>
						<circle
							cx={center}
							cy={center}
							r={radius}
							stroke="rgba(255,255,240,0.06)"
							strokeWidth="4"
						/>
						<circle
							cx={center}
							cy={center}
							r={radius}
							stroke="rgba(255,184,0,0.5)"
							strokeWidth="4"
							strokeLinecap="round"
							strokeDasharray={`${strokeDash} ${circumference}`}
							transform={`rotate(-90 ${center} ${center})`}
						/>
					</svg>
					<Trophy className="trophy-wiggle h-6 w-6 text-neon-amber/70" />
				</div>
				<p className="font-mono-retro text-[10px] uppercase tracking-[2px] text-cream/70">
					Achievements
				</p>
				<p className="text-xs text-cream/40">
					<span
						className="text-neon-amber"
						style={{ textShadow: "0 0 6px rgba(255,184,0,0.2)" }}
					>
						{earned}
					</span>
					<span className="text-cream/25"> / {total}</span>
				</p>
			</button>
			<AchievementsPopup open={open} onClose={() => setOpen(false)} />
		</div>
	);
}

// ════════════════════════════════════════════════════════════════
// FavouriteFilmPoster (centered, larger)
// ════════════════════════════════════════════════════════════════

function FavouriteFilmPoster({
	tmdbId,
	film,
}: {
	tmdbId: number;
	film: {
		title: string;
		year: string;
		genres: string[];
		posterPath: string | null;
	} | null;
}) {
	const posterUrl = film?.posterPath
		? getTmdbImageUrl(film.posterPath, "w342")
		: null;

	return (
		<Link
			to="/app/title/$mediaType/$tmdbId"
			params={{ mediaType: "movie", tmdbId }}
			className="group flex flex-col items-center no-underline"
		>
			<div className="relative w-[140px] overflow-hidden rounded-lg shadow-lg transition-transform duration-300 group-hover:scale-105">
				{posterUrl ? (
					<img
						src={posterUrl}
						alt={film?.title ?? "Film poster"}
						className="w-full"
					/>
				) : (
					<div className="flex aspect-[2/3] w-full items-center justify-center bg-cream/[0.04]">
						<Film className="h-8 w-8 text-cream/15" />
					</div>
				)}
			</div>
			{film && (
				<div className="mt-2 text-center">
					<p className="text-sm font-medium text-cream/75 transition-colors group-hover:text-neon-pink/90">
						{film.title}
					</p>
					<p className="mt-0.5 text-xs text-cream/40">{film.year}</p>
				</div>
			)}
		</Link>
	);
}

// ════════════════════════════════════════════════════════════════
// NonFriendGatedSections (9 + 10)
// ════════════════════════════════════════════════════════════════

function NonFriendGatedSections({ status }: { status: string }) {
	return (
		<>
			{/* ── 9. Blurred activity teaser ─────────── */}
			<div className="relative mt-6 overflow-hidden rounded-lg border border-drive-in-border">
				{/* Fake blurred rows */}
				<div className="space-y-0" style={{ filter: "blur(6px)" }}>
					{[1, 2, 3].map((n) => (
						<div
							key={n}
							className="flex items-center gap-3 border-b border-drive-in-border px-4 py-3 last:border-b-0"
						>
							<div className="h-8 w-8 rounded-full bg-cream/[0.06]" />
							<div className="flex-1">
								<div className="h-3 w-3/4 rounded bg-cream/[0.06]" />
								<div className="mt-1.5 h-2 w-1/2 rounded bg-cream/[0.04]" />
							</div>
							<div className="h-6 w-12 rounded bg-cream/[0.04]" />
						</div>
					))}
				</div>
				{/* Lock overlay */}
				<div className="absolute inset-0 flex flex-col items-center justify-center bg-drive-in-bg/40 backdrop-blur-[1px]">
					<Lock className="mb-1.5 h-5 w-5 text-cream/20" />
					<span className="font-mono-retro text-[10px] uppercase tracking-[1.5px] text-cream/30">
						Add friend to see activity
					</span>
				</div>
			</div>

			{/* ── 10. Gated message ──────────────────── */}
			{status !== "blocked" && (
				<div className="mt-5 flex flex-col items-center gap-2 py-4 text-center">
					<Lock className="h-4 w-4 text-cream/15" />
					<p className="max-w-[280px] text-xs leading-relaxed text-cream/30">
						Add as a friend to see watchlists, reviews &amp; activity
					</p>
				</div>
			)}
		</>
	);
}

// ════════════════════════════════════════════════════════════════
// FriendExpandedSections (9-11)
// ════════════════════════════════════════════════════════════════

function FriendExpandedSections({
	profile,
	userId,
	activeTab,
	setActiveTab,
}: {
	profile: {
		publicWatchlists: Array<{
			id: string;
			name: string;
			itemCount: number;
			memberCount: number;
		}>;
	};
	userId: string;
	activeTab: FriendTab;
	setActiveTab: (tab: FriendTab) => void;
}) {
	const heatmapCells = buildHeatmapCells(userId);
	return (
		<>
			{/* ── 9. Top Genres chart ──────────────── */}
			<div className="mt-5">
				<div className="mb-2 flex items-center gap-1.5">
					<BarChart3 className="h-3 w-3 text-neon-cyan/50" />
					<span className="font-mono-retro text-[10px] uppercase tracking-[2px] text-cream/70">
						Top Genres
					</span>
				</div>
				<div className="rounded-lg border border-drive-in-border px-4 py-3">
					<div className="space-y-2">
						{[
							{ genre: "Horror", pct: 82, color: "rgba(0,229,255,0.6)" },
							{ genre: "Sci-Fi", pct: 64, color: "rgba(255,45,120,0.5)" },
							{ genre: "Thriller", pct: 45, color: "rgba(255,184,0,0.5)" },
							{ genre: "Mystery", pct: 28, color: "rgba(123,47,190,0.5)" },
						].map((g) => (
							<div key={g.genre} className="flex items-center gap-2">
								<span className="w-14 text-right font-mono-retro text-[10px] text-cream/55">
									{g.genre}
								</span>
								<div className="h-1.5 flex-1 overflow-hidden rounded-full bg-cream/[0.04]">
									<div
										className="h-full rounded-full transition-all duration-700"
										style={{ width: `${g.pct}%`, background: g.color }}
									/>
								</div>
								<span className="w-7 font-mono-retro text-[9px] text-cream/45">
									{g.pct}%
								</span>
							</div>
						))}
					</div>
				</div>
			</div>

			{/* ── 10. Watch Activity heatmap ──────── */}
			<div className="mt-5">
				<div className="mb-2 flex items-center gap-1.5">
					<CalendarDays className="h-3 w-3 text-neon-pink/50" />
					<span className="font-mono-retro text-[10px] uppercase tracking-[2px] text-cream/70">
						Watch Activity
					</span>
				</div>
				<div className="rounded-lg border border-drive-in-border px-3 py-3">
					<div
						className="grid gap-[3px]"
						style={{
							gridTemplateColumns: `repeat(${HEATMAP_COLS}, 1fr)`,
							gridTemplateRows: `repeat(${HEATMAP_ROWS}, 1fr)`,
						}}
					>
						{heatmapCells.map((cell) => (
							<div
								key={cell.key}
								className={`aspect-square rounded-[2px] ${HEATMAP_COLORS[cell.level]}`}
							/>
						))}
					</div>
					{/* Legend */}
					<div className="mt-2 flex items-center justify-end gap-1">
						<span className="font-mono-retro text-[9px] text-cream/40">
							Less
						</span>
						{HEATMAP_COLORS.map((c) => (
							<div key={c} className={`h-[8px] w-[8px] rounded-[2px] ${c}`} />
						))}
						<span className="font-mono-retro text-[9px] text-cream/40">
							More
						</span>
					</div>
				</div>
			</div>

			{/* ── 11. Tabbed content ───────────────── */}
			<div className="mt-6">
				{/* Tab bar */}
				<div className="flex border-b border-drive-in-border">
					{TABS.map((tab) => (
						<button
							key={tab.key}
							type="button"
							onClick={() => setActiveTab(tab.key)}
							className={`-mb-px flex-1 border-b-2 bg-transparent py-2.5 text-center font-mono-retro text-[11px] uppercase tracking-[1.5px] transition-colors ${
								activeTab === tab.key
									? tab.activeColor
									: "border-transparent text-cream/40 hover:text-cream/60"
							}`}
						>
							{tab.label}
						</button>
					))}
				</div>

				{/* Tab content */}
				<AnimatePresence mode="wait">
					<motion.div
						key={activeTab}
						initial={{ opacity: 0, y: 6 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -6 }}
						transition={{ duration: 0.2 }}
						className="pt-4"
					>
						{activeTab === "watchlists" && (
							<WatchlistsTab watchlists={profile.publicWatchlists} />
						)}
						{activeTab === "reviews" && <DemoReviewsTab />}
						{activeTab === "activity" && <DemoActivityTab />}
					</motion.div>
				</AnimatePresence>
			</div>
		</>
	);
}

// ════════════════════════════════════════════════════════════════
// WatchlistsTab
// ════════════════════════════════════════════════════════════════

function WatchlistsTab({
	watchlists,
}: {
	watchlists: Array<{
		id: string;
		name: string;
		itemCount: number;
		memberCount: number;
	}>;
}) {
	if (watchlists.length === 0) {
		return (
			<div className="flex flex-col items-center py-8 text-center">
				<Film className="mb-2 h-6 w-6 text-neon-cyan/20" />
				<p className="text-xs text-cream/30">No public watchlists</p>
			</div>
		);
	}

	return (
		<div className="space-y-2">
			{watchlists.map((wl) => (
				<Link
					key={wl.id}
					to="/app/watchlists/$watchlistId"
					params={{ watchlistId: wl.id }}
					search={{ sort: "date-added", type: "all" }}
					className="group flex items-center gap-3 rounded-lg border border-drive-in-border px-3 py-2.5 no-underline transition-all hover:border-neon-cyan/25 hover:bg-neon-cyan/[0.03]"
				>
					<Film className="h-4 w-4 shrink-0 text-neon-cyan/40" />
					<div className="min-w-0 flex-1">
						<p className="truncate text-sm text-cream/70 transition-colors group-hover:text-cream/90">
							{wl.name}
						</p>
						<p className="mt-0.5 font-mono-retro text-[9px] text-cream/25">
							{wl.itemCount} titles &middot; {wl.memberCount} member
							{wl.memberCount !== 1 ? "s" : ""}
						</p>
					</div>
					<ChevronRight className="h-4 w-4 shrink-0 text-cream/15 transition-colors group-hover:text-neon-cyan/50" />
				</Link>
			))}
			{watchlists.length > 3 && (
				<div className="flex justify-center pt-2">
					<span
						className="cursor-not-allowed font-mono-retro text-[10px] uppercase tracking-[1.5px] text-neon-cyan/50"
						style={{
							textShadow: "0 0 6px rgba(0,229,255,0.15)",
						}}
					>
						See all
					</span>
				</div>
			)}
		</div>
	);
}

// ════════════════════════════════════════════════════════════════
// DemoReviewsTab
// ════════════════════════════════════════════════════════════════

function DemoReviewsTab() {
	return (
		<div className="space-y-3">
			{DEMO_REVIEWS.map((r) => (
				<div
					key={r.title}
					className="rounded-lg border border-drive-in-border px-4 py-3"
					style={{
						background:
							"linear-gradient(135deg, rgba(10,10,30,0.6), rgba(5,5,15,0.8))",
					}}
				>
					<div className="flex items-center justify-between">
						<span className="text-sm font-medium text-cream/75">{r.title}</span>
						<span className="font-mono-retro text-[9px] text-cream/25">
							{r.time}
						</span>
					</div>
					<div
						className="mt-1 flex items-center gap-0.5"
						style={{ fontSize: "10px" }}
					>
						<span className="text-neon-amber">{"★".repeat(r.rating)}</span>
						<span className="text-cream/10">{"★".repeat(5 - r.rating)}</span>
					</div>
					<p className="mt-1.5 text-xs leading-relaxed text-cream/45">
						{r.text}
					</p>
				</div>
			))}
			{DEMO_REVIEWS.length > 3 && (
				<div className="flex justify-center pt-2">
					<span
						className="cursor-not-allowed font-mono-retro text-[10px] uppercase tracking-[1.5px] text-neon-amber/50"
						style={{ textShadow: "0 0 6px rgba(255,184,0,0.15)" }}
					>
						See all
					</span>
				</div>
			)}
		</div>
	);
}

// ════════════════════════════════════════════════════════════════
// DemoActivityTab
// ════════════════════════════════════════════════════════════════

function DemoActivityTab() {
	const colorMap: Record<string, string> = {
		"neon-pink": "bg-neon-pink/30 text-neon-pink",
		"neon-cyan": "bg-neon-cyan/30 text-neon-cyan",
		"neon-amber": "bg-neon-amber/30 text-neon-amber",
	};

	return (
		<div className="space-y-1">
			{DEMO_ACTIVITY.map((a) => (
				<div
					key={`${a.action}-${a.title}`}
					className="flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-cream/[0.02]"
				>
					<div
						className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${colorMap[a.color]}`}
					>
						{a.action === "Watched" ? (
							<Film className="h-3 w-3" />
						) : a.action === "Reviewed" ? (
							<Award className="h-3 w-3" />
						) : (
							<Heart className="h-3 w-3" />
						)}
					</div>
					<div className="min-w-0 flex-1">
						<p className="truncate text-xs text-cream/60">
							<span className="text-cream/35">{a.action}</span>{" "}
							<span className="font-medium text-cream/75">{a.title}</span>
						</p>
					</div>
					<span className="shrink-0 font-mono-retro text-[9px] text-cream/40">
						{a.time}
					</span>
				</div>
			))}
			{DEMO_ACTIVITY.length > 5 && (
				<div className="flex justify-center pt-2">
					<span
						className="cursor-not-allowed font-mono-retro text-[10px] uppercase tracking-[1.5px] text-neon-pink/50"
						style={{ textShadow: "0 0 6px rgba(255,45,120,0.15)" }}
					>
						See all
					</span>
				</div>
			)}
		</div>
	);
}
