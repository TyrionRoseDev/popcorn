import {
	skipToken,
	useInfiniteQuery,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	Ban,
	BarChart3,
	BookOpen,
	CalendarDays,
	ChevronRight,
	Film,
	Heart,
	List,
	Loader2,
	Lock,
	Star,
	Trophy,
	UserMinus,
	UserPlus,
	X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { AchievementGrid } from "#/components/achievements/achievement-grid";
import { FeedJournalCard } from "#/components/tracker/feed-journal-card";
import { Dialog, DialogContent, DialogTitle } from "#/components/ui/dialog";
import { WatchEventCard } from "#/components/watched/watch-event-card";
import { useTRPC } from "#/integrations/trpc/react";
import { ACHIEVEMENTS } from "#/lib/achievements";
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

// ── Avatar gradient by first character ──────────────────────────
function avatarGradient(_letter: string) {
	// Site colors only — pink, amber, cyan — with hard stops to avoid green blending
	return "conic-gradient(from 0deg, #FF2D78 0deg, #FF2D78 60deg, #FFB800 60deg, #FFB800 180deg, #00E5FF 180deg, #00E5FF 300deg, #FF2D78 300deg)";
}

// ── Tabs enum ──────────────────────────────────────────────────
type FriendTab = "activity" | "journal" | "watchlists";
const TABS: {
	key: FriendTab;
	label: string;
	color: string;
	activeColor: string;
}[] = [
	{
		key: "activity",
		label: "Recent Activity",
		color: "neon-pink",
		activeColor: "text-neon-pink border-neon-pink",
	},
	{
		key: "journal",
		label: "Journal",
		color: "neon-amber",
		activeColor: "text-neon-amber border-neon-amber",
	},
	{
		key: "watchlists",
		label: "Watchlists",
		color: "neon-cyan",
		activeColor: "text-neon-cyan border-neon-cyan",
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
	const {
		data: profile,
		isLoading,
		isError,
		error,
	} = useQuery(trpc.friend.profile.queryOptions({ userId }));

	const { data: mutualFriends } = useQuery(
		trpc.friend.mutualFriends.queryOptions({ userId }),
	);

	const { data: favFilm } = useQuery(
		trpc.title.details.queryOptions(
			profile?.favouriteFilmTmdbId
				? {
						tmdbId: profile.favouriteFilmTmdbId,
						mediaType: profile.favouriteFilmMediaType === "tv" ? "tv" : "movie",
					}
				: skipToken,
		),
	);

	const { data: genreStats } = useQuery(
		trpc.friend.genreStats.queryOptions(
			profile && (profile.isSelf || profile.isFriend)
				? { userId: profile.id }
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

	const [activeTab, setActiveTab] = useState<FriendTab>("activity");
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
	if (isLoading) {
		return (
			<>
				<style>{PROFILE_KEYFRAMES}</style>
				<div className="flex justify-center px-4 py-12">
					<div className="w-full max-w-7xl animate-pulse rounded-[20px] border border-drive-in-border bg-drive-in-card p-8">
						<div className="flex flex-col items-center gap-6">
							<div className="h-36 w-36 rounded-full bg-cream/[0.06]" />
							<div className="h-6 w-40 rounded bg-cream/[0.06]" />
							<div className="h-10 w-48 rounded bg-cream/[0.04]" />
							<div className="flex gap-6">
								{[1, 2, 3].map((n) => (
									<div key={n} className="h-12 w-20 rounded bg-cream/[0.04]" />
								))}
							</div>
						</div>
					</div>
				</div>
			</>
		);
	}

	if (isError || !profile) {
		const isNotFound = error?.message === "User not found";
		return (
			<>
				<style>{PROFILE_KEYFRAMES}</style>
				<div className="flex justify-center px-4 py-20">
					<div className="flex w-full max-w-7xl flex-col items-center rounded-[20px] border border-drive-in-border bg-drive-in-card px-8 py-14 text-center">
						{isNotFound ? (
							<Film className="mb-4 h-10 w-10 text-cream/15" />
						) : (
							<X className="mb-4 h-10 w-10 text-neon-pink/30" />
						)}
						<p className="font-display text-lg text-cream/50">
							{isNotFound ? "User not found" : "Something went wrong"}
						</p>
						<p className="mt-1.5 font-mono-retro text-xs text-cream/30">
							{isNotFound
								? "This profile doesn\u2019t exist or may have been removed."
								: "We couldn\u2019t load this profile right now."}
						</p>
						<Link
							to="/app/friends"
							className="mt-6 rounded-lg border border-neon-cyan/20 bg-neon-cyan/5 px-5 py-2 font-mono-retro text-xs uppercase tracking-wider text-neon-cyan/70 no-underline transition-colors hover:border-neon-cyan/40 hover:bg-neon-cyan/10 hover:text-neon-cyan"
						>
							Back to friends
						</Link>
					</div>
				</div>
			</>
		);
	}

	const isSelf = profile.isSelf;
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
					className="relative w-full max-w-7xl overflow-hidden rounded-[20px]"
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

					<div className="relative z-10 px-6 pb-7 pt-4 md:px-8">
						{/* ── Hero section (centered) ── */}
						<div className="flex flex-col items-center gap-2">
							{/* ── Avatar ── */}
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
								<div className="relative h-28 w-28 overflow-hidden rounded-full md:h-36 md:w-36 border-[3px] border-drive-in-bg">
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
											<span className="font-display text-5xl text-cream/80">
												{initial}
											</span>
										</div>
									)}
								</div>
							</div>

							{/* ── Username + joined ── */}
							<div className="flex flex-col items-center">
								<h1
									className="text-center font-display text-2xl text-cream"
									style={{
										textShadow: "0 0 20px rgba(255,255,240,0.08)",
									}}
								>
									@{profile.username ?? "unknown"}
								</h1>
								<span className="mt-1 font-mono-retro text-[9px] uppercase tracking-[2px] text-cream/25">
									Joined{" "}
									{new Date(profile.createdAt).toLocaleDateString("en-US", {
										month: "short",
										year: "numeric",
									})}
								</span>
							</div>

							{/* ── Action buttons (hidden for own profile) ── */}
							{!isSelf && (
								<div className="mt-3 flex justify-center gap-2 md:justify-start">
									{profile.relationshipStatus === "blocked" ? null : (
										<AnimatePresence mode="wait">
											{showBlockConfirm ? (
												<motion.div
													key="block-confirm"
													initial={{ opacity: 0, scale: 0.95 }}
													animate={{ opacity: 1, scale: 1 }}
													exit={{ opacity: 0, scale: 0.95 }}
													className="flex items-center gap-2"
												>
													<span className="text-xs text-cream/40">Block?</span>
													<button
														type="button"
														onClick={() => {
															blockUser.mutate({ userId });
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
											) : showRemoveConfirm ? (
												<motion.div
													key="remove-confirm"
													initial={{ opacity: 0, scale: 0.95 }}
													animate={{ opacity: 1, scale: 1 }}
													exit={{ opacity: 0, scale: 0.95 }}
													className="flex items-center gap-2"
												>
													<span className="text-xs text-cream/40">Remove?</span>
													<button
														type="button"
														onClick={() => {
															removeFriend.mutate({ userId });
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
											) : profile.relationshipStatus === "none" ? (
												/* No relationship: Add Friend + Block */
												<motion.div
													key="none-actions"
													initial={{ opacity: 0, scale: 0.95 }}
													animate={{ opacity: 1, scale: 1 }}
													exit={{ opacity: 0, scale: 0.95 }}
													className="flex items-center gap-2"
												>
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
																animation:
																	"shimmer-sweep 2.5s ease-in-out infinite",
															}}
														/>
														<UserPlus className="relative z-10 h-4 w-4" />
														<span className="relative z-10">Add Friend</span>
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
											) : profile.relationshipStatus === "request_sent" ? (
												/* Request Sent: Cancel + Block */
												<motion.div
													key="sent-actions"
													initial={{ opacity: 0, scale: 0.95 }}
													animate={{ opacity: 1, scale: 1 }}
													exit={{ opacity: 0, scale: 0.95 }}
													className="flex items-center gap-2"
												>
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
													<button
														type="button"
														onClick={() => setShowBlockConfirm(true)}
														className="flex items-center gap-1 rounded-md border border-cream/10 bg-cream/[0.03] px-3 py-1.5 font-mono-retro text-[9px] uppercase tracking-[1px] text-cream/30 transition-all hover:border-red-500/25 hover:text-red-400/60"
													>
														<Ban className="h-3 w-3" />
														Block
													</button>
												</motion.div>
											) : profile.relationshipStatus === "request_received" ? (
												/* Request Received: Accept + Decline + Block */
												<motion.div
													key="received-actions"
													initial={{ opacity: 0, scale: 0.95 }}
													animate={{ opacity: 1, scale: 1 }}
													exit={{ opacity: 0, scale: 0.95 }}
													className="flex items-center gap-2"
												>
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
													<button
														type="button"
														onClick={() => setShowBlockConfirm(true)}
														className="flex items-center gap-1 rounded-md border border-cream/10 bg-cream/[0.03] px-3 py-1.5 font-mono-retro text-[9px] uppercase tracking-[1px] text-cream/30 transition-all hover:border-red-500/25 hover:text-red-400/60"
													>
														<Ban className="h-3 w-3" />
														Block
													</button>
												</motion.div>
											) : isFriend ? (
												/* Friends: Remove + Block */
												<motion.div
													key="friend-actions"
													initial={{ opacity: 0, scale: 0.95 }}
													animate={{ opacity: 1, scale: 1 }}
													exit={{ opacity: 0, scale: 0.95 }}
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
											) : null}
										</AnimatePresence>
									)}
								</div>
							)}

							{/* ── Watched hours ── */}
							<div className="mt-1 flex flex-col items-center">
								<span
									className="font-display text-3xl text-neon-amber"
									style={{
										textShadow: "0 0 18px rgba(255,184,0,0.35)",
									}}
								>
									{Math.floor((profile.watchTimeMinutes ?? 0) / 60)}h{" "}
									{(profile.watchTimeMinutes ?? 0) % 60}m
								</span>
								<span className="mt-1 font-mono-retro text-[9px] uppercase tracking-[3px] text-cream/45">
									Watched
								</span>
							</div>

							{/* ── Titles + Friends + Genre + Mutual row ── */}
							<div className="mt-1 flex items-center justify-center gap-6">
								<div className="flex flex-col items-center">
									<span
										className="font-display text-lg text-neon-cyan"
										style={{
											textShadow: "0 0 10px rgba(0,229,255,0.3)",
										}}
									>
										{profile.totalWatched}
									</span>
									<span className="mt-0.5 font-mono-retro text-[9px] uppercase tracking-[2px] text-cream/45">
										Titles
									</span>
								</div>
								<div className="h-6 w-px bg-cream/10" />
								<div className="flex flex-col items-center">
									<span
										className="font-display text-lg text-neon-cyan"
										style={{
											textShadow: "0 0 10px rgba(0,229,255,0.3)",
										}}
									>
										{profile.friendCount}
									</span>
									<span className="mt-0.5 font-mono-retro text-[9px] uppercase tracking-[2px] text-cream/45">
										Friends
									</span>
								</div>
								<div className="h-6 w-px bg-cream/10" />
								<div className="flex flex-col items-center">
									<span
										className="font-display text-base text-neon-pink"
										style={{
											textShadow: "0 0 10px rgba(255,45,120,0.3)",
										}}
									>
										{genreName ?? "None"}
									</span>
									<span className="mt-0.5 font-mono-retro text-[9px] uppercase tracking-[2px] text-cream/45">
										Fav Genre
									</span>
								</div>
								{!isSelf && (
									<>
										<div className="h-6 w-px bg-cream/10" />
										<div className="flex flex-col items-center">
											<span
												className="font-display text-lg text-neon-amber"
												style={{
													textShadow: "0 0 10px rgba(255,184,0,0.3)",
												}}
											>
												{mutualFriends?.length ?? 0}
											</span>
											<span className="mt-0.5 font-mono-retro text-[9px] uppercase tracking-[2px] text-cream/45">
												Mutual
											</span>
										</div>
									</>
								)}
							</div>

							{/* ── Bio ── */}
							{profile.bio && (
								<div
									className="mt-3 w-full max-w-lg rounded-lg border border-neon-amber/20 px-4 py-3"
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
						</div>
						{/* end hero section */}

						{/* ═══════════════════════════════════════ */}
						{/* Two-column layout below hero            */}
						{/* ═══════════════════════════════════════ */}

						{isFriend || isSelf ? (
							<FriendExpandedSections
								profile={profile}
								genreStats={genreStats ?? []}
								activeTab={activeTab}
								setActiveTab={setActiveTab}
								isSelf={isSelf}
								favouriteFilm={
									profile.favouriteFilmTmdbId
										? {
												tmdbId: profile.favouriteFilmTmdbId,
												mediaType:
													profile.favouriteFilmMediaType === "tv"
														? "tv"
														: "movie",
												film: favFilm ?? null,
											}
										: null
								}
								ratingDistribution={profile.ratingDistribution}
							/>
						) : (
							<NonFriendGatedSections />
						)}
					</div>
				</div>
			</div>
		</>
	);
}

// ════════════════════════════════════════════════════════════════
// ProfileAchievements — Real data with ring progress + grid popup
// ════════════════════════════════════════════════════════════════

function ProfileAchievements({
	userId,
	isFriend,
	isOwnProfile,
	friendName,
}: {
	userId: string;
	isFriend: boolean;
	isOwnProfile: boolean;
	friendName?: string;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [showGrid, setShowGrid] = useState(false);
	const syncedRef = useRef(false);

	useQuery(trpc.achievement.myAchievements.queryOptions());

	const syncMutation = useMutation(
		trpc.achievement.sync.mutationOptions({
			onSuccess: (data) => {
				if (data.newAchievements.length > 0) {
					queryClient.invalidateQueries({
						queryKey: trpc.achievement.myAchievements.queryKey(),
					});
					queryClient.invalidateQueries({
						queryKey: trpc.achievement.userAchievements.queryKey({ userId }),
					});
				}
			},
		}),
	);

	useEffect(() => {
		if (isOwnProfile && !syncedRef.current) {
			syncedRef.current = true;
			syncMutation.mutate();
		}
	}, [isOwnProfile, syncMutation.mutate]);

	const { data: comparison } = useQuery({
		...trpc.achievement.compare.queryOptions({ friendId: userId }),
		enabled: isFriend && !isOwnProfile,
	});

	const { data: theirAchievements } = useQuery({
		...trpc.achievement.userAchievements.queryOptions({ userId }),
		enabled: isOwnProfile,
	});

	const earnedCount = isOwnProfile
		? (theirAchievements?.earned.length ?? 0)
		: isFriend
			? (comparison?.theirTotal ?? 0)
			: 0;
	const total = ACHIEVEMENTS.length;

	// SVG ring progress
	const radius = 38;
	const circumference = 2 * Math.PI * radius;
	const progress = (earnedCount / total) * circumference;

	return (
		<>
			<button
				type="button"
				onClick={() => (isFriend || isOwnProfile) && setShowGrid(true)}
				className="group flex flex-col items-center gap-2"
			>
				<div className="relative flex h-24 w-24 items-center justify-center">
					<svg
						className="absolute inset-0 -rotate-90"
						viewBox="0 0 96 96"
						role="img"
						aria-label="Achievement progress"
					>
						<circle
							cx="48"
							cy="48"
							r={radius}
							fill="none"
							stroke="currentColor"
							strokeWidth="3"
							className="text-cream/10"
						/>
						<circle
							cx="48"
							cy="48"
							r={radius}
							fill="none"
							stroke="url(#achievement-gradient)"
							strokeWidth="3"
							strokeLinecap="round"
							strokeDasharray={circumference}
							strokeDashoffset={circumference - progress}
							className="transition-all duration-700"
						/>
						<defs>
							<linearGradient id="achievement-gradient">
								<stop offset="0%" stopColor="#FF2D78" />
								<stop offset="50%" stopColor="#FFB800" />
								<stop offset="100%" stopColor="#00E5FF" />
							</linearGradient>
						</defs>
					</svg>
					<Trophy className="h-6 w-6 text-neon-amber transition-transform group-hover:scale-110" />
				</div>
				<span className="font-mono text-xs text-cream/50">Achievements</span>
				<span className="font-mono text-sm text-cream">
					{earnedCount} / {total}
				</span>
			</button>

			{showGrid && isOwnProfile && theirAchievements && (
				<AchievementGrid
					myEarned={theirAchievements.earned.map((e) => ({
						id: e.id,
						earnedAt: e.earnedAt,
					}))}
					onClose={() => setShowGrid(false)}
				/>
			)}

			{showGrid && isFriend && !isOwnProfile && comparison && (
				<AchievementGrid
					myEarned={comparison.achievements
						.filter(
							(a): a is typeof a & { myEarnedAt: Date } =>
								a.myEarnedAt !== null,
						)
						.map((a) => ({ id: a.id, earnedAt: a.myEarnedAt }))}
					theirEarned={comparison.achievements
						.filter(
							(a): a is typeof a & { theirEarnedAt: Date } =>
								a.theirEarnedAt !== null,
						)
						.map((a) => ({ id: a.id, earnedAt: a.theirEarnedAt }))}
					theirName={friendName}
					onClose={() => setShowGrid(false)}
				/>
			)}
		</>
	);
}

// ════════════════════════════════════════════════════════════════
// FavouriteFilmPoster
// ════════════════════════════════════════════════════════════════

function FavouriteFilmPoster({
	tmdbId,
	mediaType,
	film,
}: {
	tmdbId: number;
	mediaType: "movie" | "tv";
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
			params={{ mediaType, tmdbId }}
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

function NonFriendGatedSections() {
	return (
		<>
			{/* ── Blurred activity teaser ─────────── */}
			<div className="relative mt-8 overflow-hidden rounded-lg border border-drive-in-border">
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
		</>
	);
}

// ════════════════════════════════════════════════════════════════
// WatchActivityHeatmap
// ════════════════════════════════════════════════════════════════

function pad2(n: number) {
	return n.toString().padStart(2, "0");
}

function fmtDate(d: Date) {
	return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// Year colors: current year = pink, past years cycle cyan → amber → pink
const YEAR_COLORS = [
	{ r: 0, g: 229, b: 255 }, // cyan
	{ r: 255, g: 184, b: 0 }, // amber
	{ r: 255, g: 45, b: 120 }, // pink
];

type HeatmapData = Array<{ date: string; count: number; titles: string[] }>;

function buildYearGrid(
	year: number,
	dataMap: Map<string, { count: number; titles: string[] }>,
) {
	const jan1 = new Date(year, 0, 1);
	const endDate = new Date(year, 11, 31);
	const endStr = fmtDate(endDate);
	const startDow = jan1.getDay();
	const cells: Array<{ date: string; count: number } | null> = [];

	for (let i = 0; i < startDow; i++) cells.push(null);

	const cursor = new Date(jan1);
	while (fmtDate(cursor) <= endStr) {
		const ds = fmtDate(cursor);
		cells.push({ date: ds, count: dataMap.get(ds)?.count ?? 0 });
		cursor.setDate(cursor.getDate() + 1);
	}

	return cells;
}

function formatDisplayDate(dateStr: string) {
	const d = new Date(`${dateStr}T00:00:00`);
	return d.toLocaleDateString("en-US", {
		weekday: "short",
		month: "short",
		day: "numeric",
	});
}

function HeatmapGrid({
	cells,
	dataMap,
	maxCount,
	todayStr,
	color,
}: {
	cells: Array<{ date: string; count: number } | null>;
	dataMap: Map<string, { count: number; titles: string[] }>;
	maxCount: number;
	todayStr: string;
	color: { r: number; g: number; b: number };
}) {
	const [hover, setHover] = useState<{
		date: string;
		count: number;
		titles: string[];
		x: number;
		y: number;
	} | null>(null);

	return (
		<div className="relative">
			{/* biome-ignore lint/a11y/noStaticElementInteractions: tooltip dismiss on mouse leave */}
			<div
				className="overflow-x-auto"
				style={{ direction: "rtl" }}
				onMouseLeave={() => setHover(null)}
			>
				<div
					style={{
						direction: "ltr",
						display: "grid",
						gridTemplateRows: "repeat(7, 16px)",
						gridAutoColumns: "16px",
						gridAutoFlow: "column",
						gap: "4px",
					}}
				>
					{cells.map((cell, idx) =>
						cell === null ? (
							// biome-ignore lint/suspicious/noArrayIndexKey: null padding cells have no unique id
							<div key={`empty-${idx}`} />
						) : (
							// biome-ignore lint/a11y/noStaticElementInteractions: hover tooltip
							<div
								key={cell.date}
								onMouseEnter={(e) => {
									const rect = (
										e.target as HTMLElement
									).getBoundingClientRect();
									const entry = dataMap.get(cell.date);
									setHover({
										date: cell.date,
										count: cell.count,
										titles: entry?.titles ?? [],
										x: rect.left + rect.width / 2,
										y: rect.top,
									});
								}}
								onMouseLeave={() => setHover(null)}
								style={{
									width: 16,
									height: 16,
									borderRadius: 3,
									cursor: cell.count > 0 ? "pointer" : "default",
									backgroundColor:
										cell.date > todayStr
											? "rgba(255, 255, 240, 0.02)"
											: cell.count > 0
												? `rgba(${color.r}, ${color.g}, ${color.b}, ${0.2 + (cell.count / maxCount) * 0.8})`
												: "rgba(255, 255, 240, 0.04)",
								}}
							/>
						),
					)}
				</div>
			</div>
			{hover && (
				<div
					className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full"
					style={{ left: hover.x, top: hover.y - 8 }}
				>
					<div className="rounded-lg border border-drive-in-border bg-[#0a0a1e] px-3 py-2 shadow-xl">
						<p className="font-mono-retro text-[10px] tracking-[1px] text-cream/60">
							{formatDisplayDate(hover.date)}
						</p>
						{hover.count > 0 ? (
							<div className="mt-1 flex flex-col gap-0.5">
								{[...new Set(hover.titles.filter(Boolean))].map((title) => (
									<p
										key={title}
										className="text-[11px]"
										style={{
											color: `rgb(${color.r}, ${color.g}, ${color.b})`,
										}}
									>
										{title}
									</p>
								))}
							</div>
						) : (
							<p className="mt-0.5 text-[10px] text-cream/25">
								No films logged
							</p>
						)}
					</div>
				</div>
			)}
		</div>
	);
}

function WatchActivityHeatmap({ data }: { data: HeatmapData }) {
	const currentYear = new Date().getFullYear().toString();
	const todayStr = fmtDate(new Date());
	const [showHistory, setShowHistory] = useState(false);

	// Build date→data lookup
	const dataMap = new Map(
		data.map((d) => [d.date, { count: d.count, titles: d.titles }]),
	);

	// Past years with data (excluding current year), newest first
	const pastYears = [...new Set(data.map((d) => d.date.slice(0, 4)))]
		.filter((y) => y !== currentYear)
		.sort()
		.reverse();

	const maxCount = Math.max(...data.map((d) => d.count), 1);
	const currentYearCells = buildYearGrid(
		Number.parseInt(currentYear, 10),
		dataMap,
	);

	return (
		<>
			<div className="rounded-lg border border-drive-in-border p-4">
				<HeatmapGrid
					cells={currentYearCells}
					dataMap={dataMap}
					maxCount={maxCount}
					todayStr={todayStr}
					color={YEAR_COLORS[2]}
				/>
				{/* Legend */}
				<div className="mt-3 flex items-center justify-end gap-1.5">
					<span className="font-mono-retro text-[9px] text-cream/30">Less</span>
					{[0, 0.2, 0.4, 0.6, 0.8, 1].map((intensity) => (
						<div
							key={intensity}
							style={{
								width: 12,
								height: 12,
								borderRadius: 2,
								backgroundColor:
									intensity === 0
										? "rgba(255, 255, 240, 0.04)"
										: `rgba(255, 45, 120, ${0.2 + intensity * 0.8})`,
							}}
						/>
					))}
					<span className="font-mono-retro text-[9px] text-cream/30">More</span>
				</div>
				{pastYears.length > 0 && (
					<button
						type="button"
						onClick={() => setShowHistory(true)}
						className="mt-2.5 w-full rounded-md border border-cream/[0.06] bg-cream/[0.02] py-1.5 font-mono-retro text-[9px] uppercase tracking-[2px] text-cream/35 transition-colors hover:border-cream/15 hover:text-cream/55"
					>
						See previous years
					</button>
				)}
			</div>

			{/* History modal */}
			<Dialog
				open={showHistory}
				onOpenChange={(v) => {
					if (!v) setShowHistory(false);
				}}
			>
				<DialogContent
					className="max-w-[600px] max-h-[80vh] overflow-y-auto rounded-xl border-drive-in-border bg-[#0a0a1e] p-5 gap-0 shadow-2xl"
					overlayClassName="bg-black/60 backdrop-blur-sm"
					showCloseButton={false}
				>
					<DialogTitle className="sr-only">Watch History</DialogTitle>
					<div className="mb-4 flex items-center justify-between">
						<h3 className="font-mono-retro text-[11px] uppercase tracking-[2px] text-cream/70">
							Watch History
						</h3>
						<button
							type="button"
							onClick={() => setShowHistory(false)}
							className="text-cream/30 transition-colors hover:text-cream/60"
							aria-label="Close"
						>
							<X className="h-4 w-4" />
						</button>
					</div>
					<div className="flex flex-col gap-5">
						{pastYears.map((year, i) => {
							const yearCells = buildYearGrid(
								Number.parseInt(year, 10),
								dataMap,
							);
							const color = YEAR_COLORS[i % YEAR_COLORS.length];
							return (
								<div key={year}>
									<p
										className="mb-1.5 font-mono-retro text-[10px] tracking-[1px]"
										style={{
											color: `rgb(${color.r}, ${color.g}, ${color.b})`,
										}}
									>
										{year}
									</p>
									<div className="rounded-lg border border-drive-in-border p-3">
										<HeatmapGrid
											cells={yearCells}
											dataMap={dataMap}
											maxCount={maxCount}
											todayStr={todayStr}
											color={color}
										/>
									</div>
								</div>
							);
						})}
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}

// ════════════════════════════════════════════════════════════════
// FriendExpandedSections (9-11)
// ════════════════════════════════════════════════════════════════

const GENRE_BAR_COLORS = [
	"rgb(0, 229, 255)", // neon-cyan
	"rgb(255, 45, 120)", // neon-pink
	"rgb(255, 184, 0)", // neon-amber
	"rgba(0, 229, 255, 0.5)", // cyan soft
	"rgba(255, 45, 120, 0.5)", // pink soft
];

function FriendExpandedSections({
	profile,
	genreStats,
	activeTab,
	setActiveTab,
	isSelf,
	favouriteFilm,
	ratingDistribution,
}: {
	profile: {
		id: string;
		publicWatchlists: Array<{
			id: string;
			name: string;
			itemCount: number;
			memberCount: number;
		}>;
	};
	genreStats: Array<{ name: string; count: number }>;
	activeTab: FriendTab;
	setActiveTab: (tab: FriendTab) => void;
	isSelf: boolean;
	favouriteFilm: {
		tmdbId: number;
		mediaType: "movie" | "tv";
		film: {
			title: string;
			year: string;
			genres: string[];
			posterPath: string | null;
		} | null;
	} | null;
	ratingDistribution: Array<{ star: number; count: number }>;
}) {
	const trpc = useTRPC();
	const [selectedStar, setSelectedStar] = useState<number | null>(null);

	const { data: watchActivity } = useQuery(
		trpc.friend.watchActivity.queryOptions({ userId: profile.id }),
	);

	const { data: starRatings } = useQuery(
		trpc.friend.ratingsByStars.queryOptions(
			selectedStar
				? { userId: profile.id, star: selectedStar }
				: (skipToken as never),
		),
	);

	const maxGenreCount = genreStats.length > 0 ? genreStats[0].count : 0;

	return (
		<div className="mt-8 grid gap-8 lg:grid-cols-2">
			{/* ══ Left column: achievements, favourite, genres ══ */}
			<div className="flex flex-col gap-6">
				{/* ── Achievements ── */}
				<ProfileAchievements
					userId={profile.id}
					isFriend={!isSelf}
					isOwnProfile={isSelf}
				/>

				{/* ── Rating Distribution ── */}
				<div>
					<div className="mb-3 flex items-center gap-2">
						<Star className="h-4 w-4 text-neon-amber/50" />
						<span className="font-mono-retro text-[11px] uppercase tracking-[2px] text-cream/70">
							Ratings
						</span>
					</div>
					{ratingDistribution.some((r) => r.count > 0) ? (
						<div className="flex items-end justify-between gap-2 rounded-lg border border-drive-in-border p-5">
							{ratingDistribution.map((r) => {
								const maxRating = Math.max(
									...ratingDistribution.map((d) => d.count),
									1,
								);
								const heightPct = (r.count / maxRating) * 100;
								return (
									<button
										key={r.star}
										type="button"
										onClick={() => r.count > 0 && setSelectedStar(r.star)}
										className={`flex flex-1 flex-col items-center gap-2 bg-transparent transition-opacity ${r.count > 0 ? "cursor-pointer hover:opacity-80" : "cursor-default"}`}
									>
										<span className="font-mono-retro text-[10px] text-cream/35">
											{r.count}
										</span>
										<div className="relative h-20 w-full">
											<div
												className="absolute bottom-0 left-1/2 w-3/4 -translate-x-1/2 rounded-sm"
												style={{
													height: `${Math.max(heightPct, 4)}%`,
													backgroundColor: "rgb(255, 184, 0)",
													opacity: 0.2 + (r.star / 5) * 0.8,
													boxShadow: `0 0 8px rgba(255, 184, 0, ${0.1 + (r.star / 5) * 0.3})`,
												}}
											/>
										</div>
										<div className="flex items-center gap-0.5">
											<span className="font-mono-retro text-[10px] text-cream/50">
												{r.star}
											</span>
											<Star className="h-2.5 w-2.5 fill-neon-amber/60 text-neon-amber/60" />
										</div>
									</button>
								);
							})}
						</div>
					) : (
						<div className="flex flex-col items-center rounded-lg border border-drive-in-border py-8 text-center">
							<Star className="mb-2 h-6 w-6 text-cream/15" />
							<p className="text-[11px] text-cream/25">No ratings yet</p>
						</div>
					)}

					{/* Star ratings modal */}
					<Dialog
						open={!!selectedStar}
						onOpenChange={(v) => {
							if (!v) setSelectedStar(null);
						}}
					>
						<DialogContent
							className="max-w-md max-h-[70vh] overflow-y-auto rounded-xl border-drive-in-border bg-[#0a0a1e] p-5 gap-0 shadow-2xl"
							overlayClassName="bg-black/60 backdrop-blur-sm"
							showCloseButton={false}
						>
							<DialogTitle className="sr-only">Star Ratings</DialogTitle>
							<div className="mb-4 flex items-center justify-between">
								<div className="flex items-center gap-2">
									<h3 className="font-mono-retro text-[11px] uppercase tracking-[2px] text-cream/70">
										{selectedStar} Star Ratings
									</h3>
									<div className="flex items-center gap-0.5">
										{[1, 2, 3, 4, 5].slice(0, selectedStar ?? 0).map((n) => (
											<Star
												key={n}
												className="h-3 w-3 fill-neon-amber/60 text-neon-amber/60"
											/>
										))}
									</div>
								</div>
								<button
									type="button"
									onClick={() => setSelectedStar(null)}
									className="text-cream/30 transition-colors hover:text-cream/60"
									aria-label="Close"
								>
									<X className="h-4 w-4" />
								</button>
							</div>
							{!starRatings ? (
								<div className="flex justify-center py-8">
									<Loader2 className="h-5 w-5 animate-spin text-cream/30" />
								</div>
							) : starRatings.length === 0 ? (
								<p className="py-8 text-center font-mono-retro text-[11px] text-cream/30">
									No public ratings
								</p>
							) : (
								<div className="flex flex-col gap-2">
									{starRatings.map((item) => (
										<Link
											key={`${item.tmdbId}-${item.mediaType}`}
											to="/app/title/$mediaType/$tmdbId"
											params={{
												mediaType: item.mediaType as "movie" | "tv",
												tmdbId: item.tmdbId,
											}}
											onClick={() => setSelectedStar(null)}
											className="group rounded-lg border border-cream/[0.06] p-3 no-underline transition-colors hover:border-cream/15 hover:bg-cream/[0.03]"
										>
											<p className="text-sm font-medium text-cream/80 group-hover:text-cream">
												{item.titleName}
											</p>
											{item.reviewText && (
												<p className="mt-1 line-clamp-2 text-xs text-cream/40">
													{item.reviewText}
												</p>
											)}
										</Link>
									))}
								</div>
							)}
						</DialogContent>
					</Dialog>
				</div>

				{/* ── Favourite film ── */}
				{favouriteFilm && (
					<div>
						<div className="mb-3 flex items-center gap-2">
							<Heart className="h-4 w-4 text-neon-pink/50" />
							<span className="font-mono-retro text-[11px] uppercase tracking-[2px] text-cream/70">
								Favourite{" "}
								{favouriteFilm.mediaType === "tv" ? "TV Show" : "Film"}
							</span>
						</div>
						<FavouriteFilmPoster
							tmdbId={favouriteFilm.tmdbId}
							mediaType={favouriteFilm.mediaType}
							film={favouriteFilm.film}
						/>
					</div>
				)}

				{/* ── Top Genres ── */}
				<div>
					<div className="mb-3 flex items-center gap-2">
						<BarChart3 className="h-4 w-4 text-neon-cyan/50" />
						<span className="font-mono-retro text-[11px] uppercase tracking-[2px] text-cream/70">
							Top Genres
						</span>
					</div>
					{genreStats.length > 0 ? (
						<div className="space-y-3 rounded-lg border border-drive-in-border p-5">
							{genreStats.map((genre, i) => (
								<div key={genre.name} className="flex items-center gap-3">
									<span className="w-24 shrink-0 text-right font-mono-retro text-[11px] uppercase tracking-wider text-cream/60">
										{genre.name}
									</span>
									<div className="relative h-6 flex-1 overflow-hidden rounded-full bg-cream/[0.04]">
										<div
											className="absolute inset-y-0 left-0 rounded-full"
											style={{
												width: `${maxGenreCount > 0 ? (genre.count / maxGenreCount) * 100 : 0}%`,
												backgroundColor:
													GENRE_BAR_COLORS[i] ?? GENRE_BAR_COLORS[4],
												boxShadow: `0 0 10px ${GENRE_BAR_COLORS[i] ?? GENRE_BAR_COLORS[4]}50`,
											}}
										/>
									</div>
									<span className="w-8 shrink-0 font-mono-retro text-[11px] text-cream/40">
										{genre.count}
									</span>
								</div>
							))}
						</div>
					) : (
						<div className="flex flex-col items-center rounded-lg border border-drive-in-border py-8 text-center">
							<BarChart3 className="mb-2 h-6 w-6 text-cream/15" />
							<p className="text-[11px] text-cream/25">
								Watch more films to see your genre breakdown
							</p>
						</div>
					)}
				</div>
			</div>

			{/* ══ Right column: tabbed activity + heatmap ══ */}
			<div className="flex flex-col">
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

				{/* Tab content — fills remaining height to align with left column */}
				<AnimatePresence mode="wait">
					<motion.div
						key={activeTab}
						initial={{ opacity: 0, y: 6 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -6 }}
						transition={{ duration: 0.2 }}
						className="flex min-h-0 flex-1 flex-col pt-4"
					>
						<div className="relative min-h-0 flex-1">
							<div className="absolute inset-0 overflow-y-auto overflow-x-hidden">
								{activeTab === "activity" && (
									<ActivityTab userId={profile.id} isOwn={isSelf} />
								)}
								{activeTab === "journal" && <DiaryTab userId={profile.id} />}
								{activeTab === "watchlists" && (
									<WatchlistsTab watchlists={profile.publicWatchlists} />
								)}
							</div>
							{/* Fade overlay */}
							<div
								className="pointer-events-none absolute bottom-0 left-0 right-0 h-20"
								style={{
									background:
										"linear-gradient(to top, rgb(10,10,30) 0%, transparent 100%)",
								}}
							/>
						</div>
						{/* See more link */}
						<div className="flex justify-center pt-2 pb-1">
							<Link
								to="/app/feed"
								search={{ userId: profile.id }}
								className="font-mono-retro text-[10px] uppercase tracking-[2px] text-cream/40 hover:text-cream/70 transition-colors no-underline"
								style={{ textShadow: "0 0 6px rgba(255,255,240,0.08)" }}
							>
								See more &rarr;
							</Link>
						</div>
					</motion.div>
				</AnimatePresence>

				{/* ── Watch Activity heatmap ── */}
				<div className="mt-6">
					<div className="mb-3 flex items-center gap-2">
						<CalendarDays className="h-4 w-4 text-neon-pink/50" />
						<span className="font-mono-retro text-[11px] uppercase tracking-[2px] text-cream/70">
							Watch Activity
						</span>
					</div>
					{watchActivity && watchActivity.length > 0 ? (
						<WatchActivityHeatmap data={watchActivity} />
					) : (
						<div className="flex flex-col items-center rounded-lg border border-drive-in-border py-8 text-center">
							<CalendarDays className="mb-2 h-6 w-6 text-cream/15" />
							<p className="text-[11px] text-cream/25">No watch activity yet</p>
						</div>
					)}
				</div>
			</div>
		</div>
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
		<div className="flex flex-col gap-3">
			{watchlists.map((wl) => (
				<Link
					key={wl.id}
					to="/app/watchlists/$watchlistId"
					params={{ watchlistId: wl.id }}
					search={{ sort: "date-added", type: "all" }}
					className="group relative block rounded-[10px] border border-neon-cyan/15 p-4 no-underline transition-colors hover:border-neon-cyan/30"
					style={{
						background:
							"linear-gradient(145deg, rgba(10,10,30,0.95) 0%, rgba(15,15,35,0.8) 100%)",
						boxShadow:
							"0 0 12px rgba(0,229,255,0.04), inset 0 1px 0 rgba(255,255,240,0.03)",
					}}
				>
					<div className="flex items-center gap-3">
						<Film className="h-5 w-5 shrink-0 text-neon-cyan/40" />
						<div className="min-w-0 flex-1">
							<p className="truncate text-sm font-semibold text-cream/80 transition-colors group-hover:text-cream">
								{wl.name}
							</p>
							<p className="mt-1 font-mono-retro text-[10px] text-cream/30">
								{wl.itemCount} titles &middot; {wl.memberCount} member
								{wl.memberCount !== 1 ? "s" : ""}
							</p>
						</div>
						<ChevronRight className="h-4 w-4 shrink-0 text-cream/15 transition-colors group-hover:text-neon-cyan/50" />
					</div>
				</Link>
			))}
		</div>
	);
}

// ════════════════════════════════════════════════════════════════
// JournalTab (journal entries, not watch events/reviews)
// ════════════════════════════════════════════════════════════════

function DiaryTab({ userId }: { userId: string }) {
	const trpc = useTRPC();
	const { data, isLoading } = useQuery(
		trpc.journalEntry.getAll.queryOptions({ userId, limit: 50 }),
	);

	if (isLoading) {
		return (
			<div className="flex justify-center py-8">
				<div className="h-4 w-4 animate-spin rounded-full border-2 border-cream/20 border-t-cream/60" />
			</div>
		);
	}

	const entries = data?.items ?? [];

	if (entries.length === 0) {
		return (
			<div className="flex flex-col items-center py-8 text-center">
				<BookOpen className="mb-2 h-6 w-6 text-neon-amber/20" />
				<p className="text-xs text-cream/30">No journal entries yet</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-3">
			{entries.map((entry) => {
				const badge = formatJournalScope(
					entry.scope,
					entry.seasonNumber,
					entry.episodeNumber,
				);

				return (
					<Link
						key={entry.id}
						to="/app/title/$mediaType/$tmdbId"
						params={{ mediaType: "tv", tmdbId: entry.tmdbId }}
						className="group relative block rounded-[10px] border border-neon-amber/15 p-4 no-underline transition-colors hover:border-neon-amber/30"
						style={{
							background:
								"linear-gradient(145deg, rgba(10,10,30,0.95) 0%, rgba(15,15,35,0.8) 100%)",
							boxShadow:
								"0 0 12px rgba(255,184,0,0.04), inset 0 1px 0 rgba(255,255,240,0.03)",
						}}
					>
						<div className="flex items-start justify-between gap-3">
							<div className="min-w-0 flex-1">
								<div className="flex items-center gap-2">
									<span className="text-sm font-semibold text-cream/80 group-hover:text-cream transition-colors truncate">
										{entry.titleName}
									</span>
									{badge && (
										<span className="shrink-0 rounded bg-neon-amber/10 px-1.5 py-0.5 font-mono-retro text-[9px] text-neon-amber/60">
											{badge}
										</span>
									)}
								</div>
								<p className="mt-0.5 font-mono-retro text-[10px] text-cream/25">
									{formatActivityTime(entry.createdAt)}
								</p>
							</div>
						</div>
						<div className="mt-2.5 flex items-start gap-2">
							<BookOpen className="h-3 w-3 text-neon-amber/30 mt-0.5 shrink-0" />
							<p className="text-[12.5px] leading-[1.6] text-cream/50 line-clamp-3 pl-2 relative before:absolute before:left-0 before:top-0.5 before:bottom-0.5 before:w-0.5 before:rounded-full before:bg-neon-amber/20">
								{entry.note}
							</p>
						</div>
					</Link>
				);
			})}
		</div>
	);
}

function formatJournalScope(
	scope: string,
	seasonNumber: number | null,
	episodeNumber: number | null,
): string | null {
	if (scope === "episode" && seasonNumber != null && episodeNumber != null) {
		return `S${seasonNumber}E${episodeNumber}`;
	}
	if (scope === "season" && seasonNumber != null) {
		return `Season ${seasonNumber}`;
	}
	return null;
}

// ════════════════════════════════════════════════════════════════
// ActivityTab
// ════════════════════════════════════════════════════════════════

function ActivityTab({ userId, isOwn }: { userId: string; isOwn: boolean }) {
	const trpc = useTRPC();

	const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
		useInfiniteQuery(
			trpc.watchEvent.getFeed.infiniteQueryOptions(
				{ userId, limit: 10 },
				{ getNextPageParam: (lastPage) => lastPage.nextCursor },
			),
		);

	if (isLoading) {
		return (
			<div className="flex justify-center py-8">
				<Loader2 className="h-4 w-4 animate-spin text-cream/30" />
			</div>
		);
	}

	const items = data?.pages.flatMap((p) => p.items) ?? [];
	const renderableItems = items.filter(
		(item) =>
			item.type === "watch_event" ||
			item.type === "watchlist_created" ||
			item.type === "journal_entry",
	);

	if (renderableItems.length === 0) {
		return (
			<div className="flex flex-col items-center py-8 text-center">
				<Film className="mb-2 h-6 w-6 text-neon-pink/20" />
				<p className="text-xs text-cream/30">No activity yet</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-3">
			{renderableItems.map((item) => {
				if (item.type === "watch_event") {
					const event = item.data;
					return (
						<WatchEventCard
							key={`we-${event.id}`}
							event={event}
							showTitle={{
								name: event.title ?? `Title #${event.tmdbId}`,
							}}
							isOwn={isOwn}
						/>
					);
				}

				if (item.type === "watchlist_created") {
					const wl = item.data;
					return (
						<Link
							key={`wl-${wl.id}`}
							to="/app/watchlists/$watchlistId"
							params={{ watchlistId: wl.id }}
							search={{ sort: "date-added", type: "all" }}
							className="group flex items-center gap-3 rounded-lg border border-neon-pink/15 px-3 py-2.5 no-underline transition-all hover:border-neon-pink/25 hover:bg-neon-pink/[0.03]"
						>
							<List className="h-4 w-4 shrink-0 text-neon-pink/40" />
							<div className="min-w-0 flex-1">
								<p className="truncate text-sm text-cream/70 transition-colors group-hover:text-cream/90">
									Created{" "}
									<span className="font-semibold text-neon-pink/80">
										{wl.name}
									</span>
								</p>
								<p className="mt-0.5 font-mono-retro text-[9px] text-cream/25">
									{wl.items.length} {wl.items.length === 1 ? "title" : "titles"}
								</p>
							</div>
							<span className="font-mono-retro text-[9px] text-cream/20">
								{formatActivityTime(wl.createdAt)}
							</span>
						</Link>
					);
				}

				if (item.type === "journal_entry") {
					return (
						<FeedJournalCard key={`je-${item.data.id}`} entry={item.data} />
					);
				}

				return null;
			})}
			{hasNextPage && (
				<button
					type="button"
					onClick={() => fetchNextPage()}
					disabled={isFetchingNextPage}
					className="mx-auto mt-4 flex items-center gap-2 rounded-lg border border-cream/10 px-4 py-2 font-mono-retro text-[11px] uppercase tracking-[2px] text-cream/40 transition-colors hover:border-cream/20 hover:text-cream/60 disabled:opacity-50"
				>
					{isFetchingNextPage ? (
						<Loader2 className="h-3 w-3 animate-spin" />
					) : null}
					{isFetchingNextPage ? "Loading..." : "Load more"}
				</button>
			)}
		</div>
	);
}

function formatActivityTime(date: Date | string): string {
	const now = new Date();
	const d = new Date(date);
	const diffMs = now.getTime() - d.getTime();
	const diffMin = Math.floor(diffMs / 60000);
	const diffHr = Math.floor(diffMs / 3600000);
	const diffDay = Math.floor(diffMs / 86400000);

	if (diffMin < 1) return "Just now";
	if (diffMin < 60) return `${diffMin}m ago`;
	if (diffHr < 24) return `${diffHr}h ago`;
	if (diffDay === 1) return "Yesterday";
	if (diffDay < 30) return `${diffDay}d ago`;
	return d.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
	});
}
