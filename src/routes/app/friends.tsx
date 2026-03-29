import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Clock, Heart, Inbox, Search, Users } from "lucide-react";
import { useState } from "react";
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
		<a
			href={`/app/profile/${friend.id}`}
			className="group block no-underline"
			onMouseEnter={(e) => {
				const card = e.currentTarget.querySelector<HTMLDivElement>(
					"[data-ticket-card]",
				);
				if (card) {
					card.style.borderColor = "rgba(255,184,0,0.45)";
					card.style.boxShadow =
						"0 4px 20px rgba(255,184,0,0.12), 0 2px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)";
				}
			}}
			onMouseLeave={(e) => {
				const card = e.currentTarget.querySelector<HTMLDivElement>(
					"[data-ticket-card]",
				);
				if (card) {
					card.style.borderColor = "rgba(255,184,0,0.12)";
					card.style.boxShadow =
						"0 2px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)";
				}
			}}
		>
			<div
				data-ticket-card
				className="relative overflow-hidden rounded-lg transition-all duration-200 group-hover:-translate-y-0.5"
				style={{
					background: "rgba(10,10,30,0.9)",
					border: "1px solid rgba(255,184,0,0.12)",
					boxShadow:
						"0 2px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)",
					transition: "border-color 0.2s, box-shadow 0.2s, transform 0.2s",
				}}
			>
				{/* ADMIT ONE label rotated on right edge */}
				<div
					className="pointer-events-none absolute right-0 top-0 flex h-full w-5 items-center justify-center"
					style={{ zIndex: 1 }}
				>
					<span
						style={{
							fontSize: "7px",
							letterSpacing: "2px",
							color: "rgba(255,255,240,0.08)",
							transform: "rotate(90deg)",
							whiteSpace: "nowrap",
							fontFamily: "monospace",
							textTransform: "uppercase",
						}}
					>
						ADMIT ONE
					</span>
				</div>

				{/* Top section: avatar + username */}
				<div className="flex items-center gap-3 px-4 py-3 pr-6">
					{friend.avatarUrl ? (
						<img
							src={friend.avatarUrl}
							alt=""
							className="h-10 w-10 rounded-full object-cover shrink-0"
							style={{ border: "1px solid rgba(255,184,0,0.2)" }}
						/>
					) : (
						<div
							className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
							style={{
								background: gradient,
								border: "1px solid rgba(255,184,0,0.2)",
							}}
						>
							<span
								className="font-bold"
								style={{ fontSize: "15px", color: "rgba(255,255,240,0.9)" }}
							>
								{initial}
							</span>
						</div>
					)}
					<span
						className="truncate font-mono text-sm"
						style={{ color: "rgba(255,255,240,0.85)" }}
					>
						@{friend.username ?? "unknown"}
					</span>
				</div>

				{/* Dashed tear line with punch holes */}
				<div className="relative flex items-center" style={{ height: "1px" }}>
					{/* Left punch hole */}
					<div
						className="absolute -left-2 z-10 h-4 w-4 rounded-full"
						style={{ background: "#050508" }}
					/>
					{/* Right punch hole */}
					<div
						className="absolute -right-2 z-10 h-4 w-4 rounded-full"
						style={{ background: "#050508" }}
					/>
					{/* Dashed line */}
					<div
						className="w-full"
						style={{
							borderTop: "1px dashed rgba(255,184,0,0.18)",
							marginLeft: "8px",
							marginRight: "8px",
						}}
					/>
				</div>

				{/* Bottom section: favourite film + minutes watched */}
				<div className="flex items-center gap-3 px-4 py-2.5 pr-6">
					<div className="flex min-w-0 flex-1 items-center gap-1.5">
						<Heart
							className="h-3 w-3 shrink-0"
							style={{ color: "#FF2D78", opacity: 0.75 }}
						/>
						<span
							className="truncate text-xs"
							style={{ color: "rgba(255,255,240,0.4)" }}
						>
							{friend.favouriteFilmTmdbId
								? `Film #${friend.favouriteFilmTmdbId}`
								: "No fave yet"}
						</span>
					</div>
					<div className="flex shrink-0 items-center gap-1">
						<Clock
							className="h-3 w-3"
							style={{ color: "#FFB800", opacity: 0.5 }}
						/>
						<span
							className="text-xs"
							style={{ color: "rgba(255,255,240,0.3)" }}
						>
							—
						</span>
					</div>
				</div>
			</div>
		</a>
	);
}

function FriendsPage() {
	const trpc = useTRPC();
	const [activeTab, setActiveTab] = useState<"friends" | "requests">("friends");
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
				@keyframes bulb-marquee {
					0%, 100% { opacity: 0.15; }
					50% { opacity: 1; }
				}
			`}</style>

			<div
				className="relative mx-auto max-w-4xl px-4 pb-16"
				style={{ paddingTop: "40px" }}
			>
				{/* Header: F.R.I.E.N.D.S cinema marquee */}
				<div className="flex justify-center">
					<div
						className="relative text-center"
						style={{ maxWidth: "600px", padding: "24px 48px 20px" }}
					>
						{/* Amber border frame */}
						<div
							className="pointer-events-none absolute inset-0 rounded-lg"
							style={{
								border: "2px solid rgba(255,184,0,0.28)",
								boxShadow:
									"0 0 24px rgba(255,184,0,0.06), inset 0 0 24px rgba(255,184,0,0.02)",
							}}
						/>

						{/* Marquee bulbs row */}
						<div
							className="absolute left-6 right-6"
							style={{ top: "-5px", height: "10px" }}
						>
							{MARQUEE_BULBS.map((bulb) => (
								<div
									key={bulb.id}
									className="absolute top-1/2 -translate-y-1/2 rounded-full"
									style={{
										left: `${(Number.parseInt(bulb.id.split("-")[1], 10) / (MARQUEE_BULBS.length - 1)) * 100}%`,
										transform: "translateX(-50%) translateY(-50%)",
										width: "6px",
										height: "6px",
										backgroundColor: "#FFB800",
										animationName: "bulb-marquee",
										animationDuration: "1.6s",
										animationTimingFunction: "ease-in-out",
										animationIterationCount: "infinite",
										animationDelay: bulb.delay,
									}}
								/>
							))}
						</div>

						{/* NOW SHOWING label */}
						<p
							style={{
								fontSize: "9px",
								letterSpacing: "5px",
								textTransform: "uppercase",
								color: "#FFB800",
								opacity: 0.6,
								margin: 0,
								marginBottom: "10px",
								fontFamily: "monospace",
							}}
						>
							NOW SHOWING
						</p>

						{/* F.R.I.E.N.D.S title */}
						<h1
							className="font-display leading-none"
							style={{ margin: 0, fontSize: "44px" }}
						>
							{FRIENDS_LETTERS.map(({ letter, pos }) => (
								<span key={`letter-${pos}`}>
									<span style={{ color: "#FFB800" }}>{letter}</span>
									{pos < 6 && (
										<span
											style={{
												color: "#FF2D78",
												fontSize: "22px",
												verticalAlign: "middle",
												opacity: 0.9,
											}}
										>
											·
										</span>
									)}
								</span>
							))}
						</h1>
					</div>
				</div>

				{/* Tabs */}
				<div
					className="mt-8 flex items-center gap-0 border-b"
					style={{ borderColor: "rgba(255,184,0,0.12)" }}
				>
					<button
						type="button"
						onClick={() => setActiveTab("friends")}
						className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-colors"
						style={{
							color:
								activeTab === "friends" ? "#FFB800" : "rgba(255,255,240,0.4)",
							borderBottom:
								activeTab === "friends"
									? "2px solid #FFB800"
									: "2px solid transparent",
							marginBottom: "-1px",
							background: "none",
							cursor: "pointer",
						}}
					>
						<Users className="h-4 w-4" />
						My Friends
						{friends && friends.length > 0 && (
							<span
								className="ml-0.5 rounded px-1.5 py-0.5 text-xs"
								style={{
									background:
										activeTab === "friends"
											? "rgba(255,184,0,0.15)"
											: "rgba(255,255,240,0.06)",
									color:
										activeTab === "friends"
											? "#FFB800"
											: "rgba(255,255,240,0.3)",
								}}
							>
								{friends.length}
							</span>
						)}
					</button>

					<button
						type="button"
						onClick={() => setActiveTab("requests")}
						className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-colors"
						style={{
							color:
								activeTab === "requests" ? "#FFB800" : "rgba(255,255,240,0.4)",
							borderBottom:
								activeTab === "requests"
									? "2px solid #FFB800"
									: "2px solid transparent",
							marginBottom: "-1px",
							background: "none",
							cursor: "pointer",
						}}
					>
						<Inbox className="h-4 w-4" />
						Requests
						{pendingCount > 0 && (
							<span
								className="ml-0.5 rounded-full px-1.5 py-0.5 text-xs font-bold"
								style={{
									background: "#FF2D78",
									color: "#fff",
									minWidth: "18px",
									textAlign: "center",
								}}
							>
								{pendingCount}
							</span>
						)}
					</button>
				</div>

				{/* Tab content */}
				<div className="mt-6">
					{activeTab === "friends" && (
						<div>
							{/* Search bar */}
							<div className="relative mb-6">
								<Search
									className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
									style={{ color: "rgba(255,184,0,0.5)" }}
								/>
								<input
									type="text"
									placeholder="Search friends..."
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									className="w-full rounded-lg bg-transparent py-2.5 pl-9 pr-4 text-sm outline-none transition-colors"
									style={{
										background: "rgba(255,184,0,0.04)",
										border: "1px solid rgba(255,184,0,0.2)",
										color: "rgba(255,255,240,0.8)",
									}}
									onFocus={(e) => {
										e.currentTarget.style.borderColor = "rgba(255,184,0,0.45)";
									}}
									onBlur={(e) => {
										e.currentTarget.style.borderColor = "rgba(255,184,0,0.2)";
									}}
								/>
							</div>

							{/* Friends grid */}
							{friendsLoading ? (
								<div className="grid grid-cols-2 gap-3">
									{SKELETON_KEYS.map((key) => (
										<div
											key={key}
											className="h-24 animate-pulse rounded-lg"
											style={{ background: "rgba(255,255,255,0.04)" }}
										/>
									))}
								</div>
							) : filteredFriends.length === 0 ? (
								<div className="flex flex-col items-center py-20 text-center">
									<Users
										className="mb-3 h-10 w-10"
										style={{ color: "rgba(255,184,0,0.2)" }}
									/>
									{searchQuery.trim() ? (
										<p
											className="text-sm"
											style={{ color: "rgba(255,255,240,0.35)" }}
										>
											No friends match &ldquo;{searchQuery}&rdquo;
										</p>
									) : (
										<>
											<p
												className="text-base"
												style={{ color: "rgba(255,255,240,0.45)" }}
											>
												No friends yet
											</p>
											<p
												className="mt-1 text-sm"
												style={{ color: "rgba(255,255,240,0.25)" }}
											>
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
						</div>
					)}

					{activeTab === "requests" && (
						<div className="flex flex-col items-center py-20 text-center">
							<Inbox
								className="mb-3 h-10 w-10"
								style={{ color: "rgba(255,184,0,0.2)" }}
							/>
							<p
								className="text-sm"
								style={{ color: "rgba(255,255,240,0.35)" }}
							>
								Requests tab coming next
							</p>
						</div>
					)}
				</div>
			</div>
		</>
	);
}
