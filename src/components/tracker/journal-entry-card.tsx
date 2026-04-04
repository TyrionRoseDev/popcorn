import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
	BookOpen,
	Globe,
	Lock,
	MoreHorizontal,
	Pencil,
	Trash2,
} from "lucide-react";
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
	return "General";
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

	const hasNote = entry.note && entry.note.trim().length > 0;

	return (
		<div
			className="group relative rounded-[10px] border border-neon-cyan/15 transition-all hover:border-neon-cyan/25"
			style={{
				background:
					"linear-gradient(145deg, rgba(10,10,30,0.95) 0%, rgba(12,12,28,0.9) 50%, rgba(15,15,35,0.8) 100%)",
				boxShadow:
					"0 0 12px rgba(0,229,255,0.04), inset 0 1px 0 rgba(255,255,240,0.03)",
				borderLeft: "3px solid rgba(0,229,255,0.35)",
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

			{/* Subtle background texture */}
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 rounded-[10px] opacity-[0.03]"
				style={{
					backgroundImage:
						"radial-gradient(circle at 20% 80%, rgba(0,229,255,0.3), transparent 40%), radial-gradient(circle at 80% 20%, rgba(255,255,240,0.15), transparent 40%)",
				}}
			/>

			<div className="relative z-10 p-4">
				{/* Type label — prominent at the top */}
				<div className="flex items-center justify-between mb-3">
					<span
						className="inline-flex items-center gap-1.5 font-mono-retro"
						style={{
							fontSize: "9px",
							letterSpacing: "3px",
							textTransform: "uppercase",
							color: "rgba(0,229,255,0.5)",
							textShadow: "0 0 10px rgba(0,229,255,0.2)",
						}}
					>
						<BookOpen className="h-3 w-3" />
						Journal Entry
					</span>

					<div className="flex items-center gap-2">
						<span className="flex items-center gap-1 text-[9px] font-mono-retro tracking-[1px] uppercase text-cream/20">
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

						{/* Actions menu */}
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
									aria-label="More actions"
									className="p-1 text-cream/15 hover:text-cream/50 transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
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

				{/* Show title — large and prominent */}
				<Link
					to="/app/title/$mediaType/$tmdbId"
					params={{ mediaType: "tv", tmdbId: entry.tmdbId }}
					className="font-display text-cream/90 hover:text-cream no-underline leading-tight block mb-2"
					style={{
						fontSize: "20px",
						textShadow: "0 0 20px rgba(255,255,240,0.06)",
					}}
				>
					{entry.titleName}
				</Link>

				{/* Scope badge — prominent with glow */}
				<div className="flex items-center gap-3 mb-3">
					<span
						className="inline-flex items-center rounded-full px-3 py-1 font-mono-retro"
						style={{
							fontSize: "10px",
							letterSpacing: "2px",
							background: "rgba(0,229,255,0.1)",
							border: "1px solid rgba(0,229,255,0.25)",
							color: "#00E5FF",
							textShadow: "0 0 8px rgba(0,229,255,0.3)",
							boxShadow: "0 0 10px rgba(0,229,255,0.06)",
						}}
					>
						{scopeBadge}
					</span>
					<span className="text-[10px] text-cream/25 font-mono-retro">
						{formatTimeAgo(new Date(entry.createdAt))}
					</span>
				</div>

				{/* Note text — styled as a quote */}
				{hasNote ? (
					<div
						className="pl-3"
						style={{
							borderLeft: "2px solid rgba(0,229,255,0.2)",
						}}
					>
						<p className="text-sm font-sans leading-relaxed text-cream/60">
							{entry.note}
						</p>
					</div>
				) : (
					<div className="pl-3">
						<p className="text-[12px] leading-[1.65] text-cream/20 italic">
							No text added
						</p>
					</div>
				)}
			</div>
		</div>
	);
}
