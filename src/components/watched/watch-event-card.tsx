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
		<div className="rounded-lg border border-drive-in-border p-3 transition-colors hover:bg-cream/[0.03]">
			{actor && (
				<div className="flex items-center gap-2 mb-2">
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

			<div className="flex items-start justify-between gap-2">
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

					{event.rating && (
						<div className="flex items-center gap-1 mt-1">
							{[1, 2, 3, 4, 5].map((s) => (
								<Star
									key={s}
									className={`h-3 w-3 ${
										s <= (event.rating ?? 0)
											? "text-neon-amber fill-neon-amber"
											: "text-cream/15"
									}`}
								/>
							))}
						</div>
					)}

					{!actor && (
						<div className="text-[11px] text-cream/35 mt-1">
							{formatDate(event.watchedAt)}
						</div>
					)}

					{companionText && (
						<div className="text-[11px] text-cream/30 mt-0.5">
							{companionText}
						</div>
					)}

					{event.note && (
						<p className="text-xs text-cream/50 mt-1.5 line-clamp-2">
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
