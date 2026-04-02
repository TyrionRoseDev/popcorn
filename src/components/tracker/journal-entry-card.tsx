import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Globe, Lock, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "#/components/ui/popover";
import { useTRPC } from "#/integrations/trpc/react";

export interface JournalEntryCardProps {
	entry: {
		id: string;
		tmdbId: number;
		titleName: string;
		scope: string;
		seasonNumber: number | null;
		episodeNumber: number | null;
		note: string;
		isPublic: boolean;
		createdAt: Date;
	};
	onEdit?: (entry: JournalEntryCardProps["entry"]) => void;
	onDelete?: (id: string) => void;
}

function formatScopeBadge(
	scope: string,
	seasonNumber: number | null,
	episodeNumber: number | null,
): string {
	if (scope === "episode" && seasonNumber != null && episodeNumber != null) {
		return `S${seasonNumber}E${episodeNumber}`;
	}
	if (scope === "season" && seasonNumber != null) {
		return `Season ${seasonNumber}`;
	}
	return "Full Show";
}

function formatTimeAgo(date: Date): string {
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMin = Math.floor(diffMs / 60000);
	const diffHr = Math.floor(diffMs / 3600000);
	const diffDay = Math.floor(diffMs / 86400000);

	if (diffMin < 1) return "Just now";
	if (diffMin < 60) return `${diffMin}m ago`;
	if (diffHr < 24) return `${diffHr}h ago`;
	if (diffDay === 1) return "Yesterday";
	if (diffDay < 30) return `${diffDay}d ago`;
	return date.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

export function JournalEntryCard({
	entry,
	onEdit,
	onDelete,
}: JournalEntryCardProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [menuOpen, setMenuOpen] = useState(false);
	const [confirmDelete, setConfirmDelete] = useState(false);

	const deleteEntry = useMutation(
		trpc.journalEntry.delete.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries(trpc.journalEntry.getAll.queryFilter());
				queryClient.invalidateQueries(
					trpc.journalEntry.getForShow.queryFilter(),
				);
				toast.success("Journal entry deleted");
				onDelete?.(entry.id);
			},
			onError: () => {
				toast.error("Failed to delete entry");
			},
		}),
	);

	function handleEdit() {
		setMenuOpen(false);
		onEdit?.(entry);
	}

	function handleDelete() {
		if (!confirmDelete) {
			setConfirmDelete(true);
			return;
		}
		deleteEntry.mutate({ id: entry.id });
		setMenuOpen(false);
		setConfirmDelete(false);
	}

	const scopeBadge = formatScopeBadge(
		entry.scope,
		entry.seasonNumber,
		entry.episodeNumber,
	);

	return (
		<div
			className="relative rounded-[10px] border border-neon-cyan/15 p-4 transition-colors hover:border-neon-cyan/25"
			style={{
				background:
					"linear-gradient(145deg, rgba(10,10,30,0.95) 0%, rgba(15,15,35,0.8) 100%)",
				boxShadow:
					"0 0 12px rgba(0,229,255,0.04), inset 0 1px 0 rgba(255,255,240,0.03)",
				borderLeft: "2px solid rgba(0,229,255,0.35)",
			}}
		>
			{/* Cyan radial light overlay */}
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 rounded-[10px]"
				style={{
					background:
						"radial-gradient(ellipse at top left, rgba(0,229,255,0.05), transparent 50%)",
				}}
			/>

			<div className="relative z-10">
				{/* Top row: title + timestamp */}
				<div className="flex items-start justify-between gap-2 mb-2">
					<div className="min-w-0 flex-1">
						<div className="flex items-center gap-2 flex-wrap">
							<Link
								to="/app/title/$mediaType/$tmdbId"
								params={{ mediaType: "tv", tmdbId: entry.tmdbId }}
								className="text-sm font-semibold text-cream/90 hover:text-cream no-underline leading-tight"
							>
								{entry.titleName}
							</Link>
							{/* Scope badge */}
							<span
								className="inline-flex items-center rounded px-1.5 py-0.5 font-mono-retro text-[9px] tracking-[1.5px] uppercase leading-none shrink-0"
								style={{
									background: "rgba(0,229,255,0.08)",
									border: "1px solid rgba(0,229,255,0.2)",
									color: "rgba(0,229,255,0.7)",
								}}
							>
								{scopeBadge}
							</span>
						</div>
					</div>

					<div className="flex items-center gap-2 shrink-0">
						<span className="text-[10px] text-cream/25 font-mono-retro">
							{formatTimeAgo(new Date(entry.createdAt))}
						</span>

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
									disabled={deleteEntry.isPending}
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
					</div>
				</div>

				{/* Divider */}
				<div
					className="h-px mb-2.5"
					style={{
						background:
							"linear-gradient(90deg, rgba(0,229,255,0.15), transparent 80%)",
					}}
				/>

				{/* Note text */}
				<p className="text-[12.5px] leading-[1.65] text-cream/60">
					{entry.note}
				</p>

				{/* Footer: label + public indicator */}
				<div className="flex items-center gap-2 mt-3">
					<span className="text-[9px] font-mono-retro tracking-[1.5px] uppercase text-neon-cyan/30">
						Journal Entry
					</span>
					<span className="h-0.5 w-0.5 rounded-full bg-cream/15" />
					<span className="flex items-center gap-1 text-[9px] font-mono-retro tracking-[1px] uppercase text-cream/25">
						{entry.isPublic ? (
							<>
								<Globe className="h-2.5 w-2.5" />
								Public
							</>
						) : (
							<>
								<Lock className="h-2.5 w-2.5" />
								Private
							</>
						)}
					</span>
				</div>
			</div>
		</div>
	);
}
