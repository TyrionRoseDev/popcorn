import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
	Lock,
	MoreHorizontal,
	Pencil,
	Star,
	Trash2,
	Users,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "#/components/ui/popover";
import { useTRPC } from "#/integrations/trpc/react";
import type { Companion } from "./watched-with-modal";

interface WatchEventCardProps {
	event: {
		id: string;
		tmdbId: number;
		mediaType: string;
		rating: number | null;
		note: string | null;
		watchedAt: Date | string | null;
		createdAt?: Date | string;
		companions: Array<{ friendId: string | null; name: string }>;
		visibility?: "public" | "companion" | "private";
		originEventId?: string | null;
		originEvent?: {
			id: string;
			rating: number | null;
			note: string | null;
			visibility: string;
			userId: string;
			user: {
				id: string;
				username: string | null;
				avatarUrl: string | null;
			};
		} | null;
	};
	showTitle?: { name: string };
	actor?: {
		id: string;
		username: string | null;
		avatarUrl: string | null;
	};
	isOwn: boolean;
	onEdit?: (event: {
		id: string;
		rating: number | null;
		note: string | null;
		watchedAt: string;
		companions: Companion[];
		visibility: "public" | "companion" | "private";
	}) => void;
}

function formatPostedTime(date: Date | string): string {
	const now = new Date();
	const d = new Date(date);
	const diffMs = Math.max(0, now.getTime() - d.getTime());
	const diffMin = Math.floor(diffMs / 60000);
	const diffDay = Math.floor(diffMs / 86400000);

	if (diffMin < 1) return "Just now";
	if (diffMin < 60) return `${diffMin}m ago`;
	if (diffDay === 0) {
		return d.toLocaleTimeString("en-US", {
			hour: "numeric",
			minute: "2-digit",
		});
	}
	if (diffDay === 1) return "Yesterday";
	if (diffDay < 30) return `${diffDay}d ago`;
	return d.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

function formatDate(date: Date | string): string {
	return new Date(date).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

function isSameDay(a: Date | string, b: Date | string): boolean {
	const da = new Date(a);
	const db = new Date(b);
	return (
		da.getFullYear() === db.getFullYear() &&
		da.getMonth() === db.getMonth() &&
		da.getDate() === db.getDate()
	);
}

export function WatchEventCard({
	event,
	showTitle,
	actor,
	isOwn,
	onEdit,
}: WatchEventCardProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [menuOpen, setMenuOpen] = useState(false);
	const [confirmDelete, setConfirmDelete] = useState(false);

	const isPrivate = event.visibility === "private";
	const isCompanionOnly = event.visibility === "companion";

	const deleteEvent = useMutation(
		trpc.watchEvent.delete.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries(
					trpc.watchEvent.getForTitle.queryFilter(),
				);
				queryClient.invalidateQueries(
					trpc.watchEvent.getUserEvents.queryFilter(),
				);
				queryClient.invalidateQueries(
					trpc.watchEvent.getLatestRating.queryFilter(),
				);
				queryClient.invalidateQueries(trpc.watchEvent.getFeed.queryFilter());
				queryClient.invalidateQueries(trpc.watchlist.isWatched.queryFilter());
				queryClient.invalidateQueries(trpc.friend.genreStats.queryFilter());
				queryClient.invalidateQueries(trpc.friend.watchActivity.queryFilter());
				queryClient.invalidateQueries(trpc.friend.profile.queryFilter());
				toast.success("Watch event deleted");
			},
			onError: () => {
				toast.error("Failed to delete");
			},
		}),
	);

	function handleEdit() {
		setMenuOpen(false);
		onEdit?.({
			id: event.id,
			rating: event.rating,
			note: event.note,
			watchedAt: event.watchedAt ? new Date(event.watchedAt).toISOString() : "",
			companions: event.companions.map((c) => ({
				friendId: c.friendId ?? undefined,
				name: c.name,
			})),
			visibility: event.visibility ?? "public",
		});
	}

	function handleDelete() {
		if (!confirmDelete) {
			setConfirmDelete(true);
			return;
		}
		deleteEvent.mutate({ id: event.id });
		setMenuOpen(false);
		setConfirmDelete(false);
	}

	const companionText =
		event.companions.length > 0
			? `with ${event.companions.map((c) => c.name).join(", ")}`
			: null;

	return (
		<div
			className={`relative rounded-[10px] border p-4 transition-all hover:-translate-y-px ${
				isPrivate
					? "border-cream/[0.08] hover:border-cream/15"
					: isCompanionOnly
						? "border-neon-cyan/15 hover:border-neon-cyan/25"
						: "border-neon-amber/20 hover:border-neon-amber/30"
			}`}
			style={{
				background:
					"linear-gradient(145deg, rgba(10,10,30,0.95) 0%, rgba(15,15,35,0.8) 100%)",
				boxShadow: "0 0 12px rgba(255,184,0,0.04), 0 4px 16px rgba(0,0,0,0.3)",
			}}
		>
			{/* Privacy badge */}
			{isOwn && (isPrivate || isCompanionOnly) && (
				<div
					className={`absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded ${
						isPrivate ? "bg-cream/[0.05]" : "bg-neon-cyan/[0.06]"
					}`}
				>
					{isPrivate ? (
						<Lock className="h-2.5 w-2.5 text-cream/35" />
					) : (
						<Users className="h-2.5 w-2.5 text-neon-cyan/50" />
					)}
					<span
						className={`text-[9px] font-mono-retro uppercase tracking-wider ${
							isPrivate ? "text-cream/35" : "text-neon-cyan/50"
						}`}
					>
						{isPrivate ? "Private" : "Shared"}
					</span>
				</div>
			)}

			{/* Header row: avatar + action + timestamp */}
			{actor && (
				<div className="flex items-center gap-2 mb-2.5">
					<Link
						to="/app/profile/$userId"
						params={{ userId: actor.id }}
						className="flex items-center gap-2 no-underline"
					>
						<div className="w-7 h-7 rounded-full bg-neon-amber/15 border border-neon-amber/20 flex items-center justify-center text-[11px] font-medium text-neon-amber shrink-0">
							{actor.avatarUrl ? (
								<img
									src={actor.avatarUrl}
									alt=""
									className="w-7 h-7 rounded-full object-cover"
								/>
							) : (
								(actor.username?.charAt(0) ?? "?").toUpperCase()
							)}
						</div>
						<span className="text-[13px] font-semibold text-cream/75">
							{isOwn ? "You" : (actor.username ?? "Someone")}
						</span>
					</Link>
					<span className="text-xs text-cream/30">
						{event.watchedAt ? "watched" : "logged"}
					</span>
					<span className="text-[10px] text-cream/20 ml-auto font-mono-retro">
						{formatPostedTime(event.createdAt ?? event.watchedAt ?? new Date())}
					</span>
				</div>
			)}

			{/* Main row: title + episode on left, stars on right */}
			<div className="flex items-start justify-between gap-4">
				<div className="min-w-0 flex-1">
					{showTitle && (
						<Link
							to="/app/title/$mediaType/$tmdbId"
							params={{
								mediaType: event.mediaType as "movie" | "tv",
								tmdbId: event.tmdbId,
							}}
							className="text-[15px] font-bold text-neon-cyan no-underline hover:text-neon-cyan/90"
							style={{ textShadow: "0 0 8px rgba(0,229,255,0.15)" }}
						>
							{showTitle.name}
						</Link>
					)}

					{actor &&
						!isSameDay(event.watchedAt, event.createdAt ?? event.watchedAt) && (
							<div className="font-mono-retro text-[10px] tracking-[1px] text-cream/25 mt-1">
								watched on {formatDate(event.watchedAt)}
							</div>
						)}

					{!actor && (
						<div className="font-mono-retro text-[10px] tracking-[1px] text-[rgba(255,184,0,0.45)] mt-1">
							{event.watchedAt
								? formatDate(event.watchedAt)
								: event.createdAt
									? `Logged ${formatDate(event.createdAt)}`
									: "Date unknown"}
						</div>
					)}

					{companionText && (
						<div className="flex items-center gap-1.5 text-[11px] text-cream/30 mt-1">
							<span className="inline-block h-1 w-1 rounded-full bg-neon-cyan/50 shrink-0" />
							{companionText}
						</div>
					)}
				</div>

				<div className="flex items-center gap-2 shrink-0">
					{event.rating && (
						<div className="flex items-center gap-1">
							{[1, 2, 3, 4, 5].map((s) => (
								<Star
									key={s}
									className={`h-[15px] w-[15px] ${
										s <= (event.rating ?? 0)
											? "text-neon-amber fill-neon-amber drop-shadow-[0_0_6px_rgba(255,184,0,0.5)]"
											: "text-cream/8"
									}`}
								/>
							))}
						</div>
					)}

					{isOwn && (
						<Popover
							open={menuOpen}
							onOpenChange={(o) => {
								setMenuOpen(o);
								if (!o) setConfirmDelete(false);
							}}
						>
							<PopoverTrigger asChild>
								<button
									type="button"
									className="p-1 text-cream/20 hover:text-cream/50 transition-colors"
								>
									<MoreHorizontal className="h-4 w-4" />
								</button>
							</PopoverTrigger>
							<PopoverContent
								align="end"
								sideOffset={4}
								className="bg-drive-in-card border border-drive-in-border rounded-lg shadow-xl p-1 w-40"
							>
								<button
									type="button"
									onClick={handleEdit}
									className="flex items-center gap-2 w-full px-3 py-2 rounded-md hover:bg-cream/5 text-sm text-cream/70 hover:text-cream transition-colors"
								>
									<Pencil className="h-3.5 w-3.5" />
									Edit
								</button>
								<button
									type="button"
									onClick={handleDelete}
									disabled={deleteEvent.isPending}
									className={`flex items-center gap-2 w-full px-3 py-2 rounded-md hover:bg-red-500/10 text-sm transition-colors ${
										confirmDelete
											? "text-red-400 font-medium"
											: "text-red-400/70 hover:text-red-400"
									}`}
								>
									<Trash2 className="h-3.5 w-3.5" />
									{confirmDelete ? "Confirm Delete" : "Delete"}
								</button>
							</PopoverContent>
						</Popover>
					)}
				</div>
			</div>

			{/* Note row */}
			{event.note && (
				<div
					className="mt-2.5 py-1.5 px-3 rounded-r-md"
					style={{
						background: "rgba(0,229,255,0.03)",
						borderLeft: "2px solid rgba(0,229,255,0.25)",
					}}
				>
					<p className="text-[12px] text-cream/50 italic line-clamp-2">
						{event.note}
					</p>
				</div>
			)}

			{/* Reciprocal attribution — original reviewer's review */}
			{event.originEvent &&
				event.originEvent.rating != null &&
				(() => {
					const orig = event.originEvent;
					const canSeeReview =
						orig.visibility === "public" ||
						(orig.visibility === "companion" && isOwn);
					if (!canSeeReview) return null;

					return (
						<div
							className="mt-2.5 py-2 px-3 rounded-r-md"
							style={{
								background: "rgba(255,184,0,0.03)",
								borderLeft: "2px solid rgba(255,184,0,0.3)",
							}}
						>
							<div className="flex items-center gap-1.5 mb-1">
								<div className="w-4 h-4 rounded-full bg-neon-amber/15 flex items-center justify-center text-[7px] font-semibold text-neon-amber shrink-0">
									{(orig.user?.username?.charAt(0) ?? "?").toUpperCase()}
								</div>
								<span className="text-[10px] font-semibold text-neon-amber/60">
									{orig.user?.username ?? "Someone"}&apos;s review
								</span>
								{orig.rating && (
									<div className="flex items-center gap-0.5 ml-auto">
										{[1, 2, 3, 4, 5].map((s) => (
											<Star
												key={s}
												className={`h-[11px] w-[11px] ${
													s <= (orig.rating ?? 0)
														? "text-neon-amber fill-neon-amber"
														: "text-cream/8"
												}`}
											/>
										))}
									</div>
								)}
							</div>
							{orig.note && (
								<p className="text-[12px] text-cream/45 italic line-clamp-2">
									{orig.note}
								</p>
							)}
						</div>
					);
				})()}
		</div>
	);
}
