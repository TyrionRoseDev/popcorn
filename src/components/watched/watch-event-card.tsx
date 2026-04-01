import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { MoreHorizontal, Pencil, Star, Trash2 } from "lucide-react";
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
		watchedAt: Date | string;
		companions: Array<{ friendId: string | null; name: string }>;
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
	}) => void;
}

function formatTimeAgo(date: Date | string): string {
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
			watchedAt: new Date(event.watchedAt).toISOString(),
			companions: event.companions.map((c) => ({
				friendId: c.friendId ?? undefined,
				name: c.name,
			})),
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
			className="relative rounded-[10px] border border-neon-amber/20 p-4 transition-colors hover:border-neon-amber/30"
			style={{
				background:
					"linear-gradient(145deg, rgba(10,10,30,0.95) 0%, rgba(15,15,35,0.8) 100%)",
				boxShadow:
					"0 0 12px rgba(255,184,0,0.05), inset 0 1px 0 rgba(255,255,240,0.03)",
			}}
		>
			{/* Warm radial light overlay */}
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 rounded-[10px]"
				style={{
					background:
						"radial-gradient(ellipse at top left, rgba(255,184,0,0.06), transparent 50%)",
				}}
			/>
			{actor && (
				<div className="relative z-10 flex items-center gap-2 mb-2">
					<Link
						to="/app/profile/$userId"
						params={{ userId: actor.id }}
						className="flex items-center gap-2 no-underline"
					>
						<div className="w-7 h-7 rounded-full bg-cream/10 flex items-center justify-center text-xs font-medium text-cream/60 shrink-0">
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
						<span className="text-xs font-semibold text-cream/80">
							{isOwn ? "You" : (actor.username ?? "Someone")}
						</span>
					</Link>
					<span className="text-xs text-cream/30">watched</span>
					<span className="text-[10px] text-cream/25 ml-auto">
						{formatTimeAgo(event.watchedAt)}
					</span>
				</div>
			)}

			<div className="relative z-10 flex items-start justify-between gap-2">
				<div className="min-w-0 flex-1">
					{showTitle && (
						<Link
							to="/app/title/$mediaType/$tmdbId"
							params={{
								mediaType: event.mediaType as "movie" | "tv",
								tmdbId: event.tmdbId,
							}}
							className="text-sm font-semibold text-cream/90 hover:text-cream no-underline"
						>
							{showTitle.name}
						</Link>
					)}

					{/* Stars — larger with amber glow */}
					{event.rating && (
						<div className="flex items-center gap-1 mt-1">
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

					{/* Date — amber-tinted Space Mono */}
					{!actor && (
						<div className="font-mono-retro text-[10px] tracking-[1px] text-[rgba(255,184,0,0.45)] mt-1.5">
							{formatDate(event.watchedAt)}
						</div>
					)}

					{/* Divider — amber gradient line (only show if there are companions or a note) */}
					{(companionText || event.note) && (
						<div
							className="h-px mt-2.5 mb-2"
							style={{
								background:
									"linear-gradient(90deg, rgba(255,184,0,0.2), transparent 80%)",
							}}
						/>
					)}

					{/* Companions — cyan dot prefix */}
					{companionText && (
						<div className="flex items-center gap-1.5 text-[11px] text-cream/30">
							<span className="inline-block h-1 w-1 rounded-full bg-neon-cyan/50 shrink-0" />
							{companionText}
						</div>
					)}

					{/* Note — cyan quote bar */}
					{event.note && (
						<p className="relative text-[12.5px] leading-[1.6] text-cream/55 mt-1.5 pl-3 line-clamp-2 before:absolute before:left-0 before:top-0.5 before:bottom-0.5 before:w-0.5 before:rounded-full before:bg-[rgba(0,229,255,0.2)]">
							{event.note}
						</p>
					)}
				</div>

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
								className="p-1 text-cream/20 hover:text-cream/50 transition-colors shrink-0"
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
	);
}
