import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
	ArrowLeft,
	Eye,
	EyeOff,
	Pencil,
	Trash2,
	UserPlus,
	Users,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "#/integrations/trpc/react";

interface WatchlistDetailHeaderProps {
	watchlist: {
		id: string;
		name: string;
		isPublic: boolean;
		isDefault: boolean;
		members: Array<{ user: { id: string; username: string | null } }>;
	};
	userRole: string | null;
	onInvite: () => void;
}

export function WatchlistDetailHeader({
	watchlist,
	userRole,
	onInvite,
}: WatchlistDetailHeaderProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const [isEditing, setIsEditing] = useState(false);
	const [editName, setEditName] = useState(watchlist.name);
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	const updateMutation = useMutation(
		trpc.watchlist.update.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries(
					trpc.watchlist.get.queryFilter({ watchlistId: watchlist.id }),
				);
				queryClient.invalidateQueries(trpc.watchlist.list.queryFilter());
				toast.success("Watchlist updated");
			},
		}),
	);

	const deleteMutation = useMutation(
		trpc.watchlist.delete.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries(trpc.watchlist.list.queryFilter());
				toast.success("Watchlist deleted");
				navigate({ to: "/app/watchlists" });
			},
		}),
	);

	function startEditing() {
		setEditName(watchlist.name);
		setIsEditing(true);
		setTimeout(() => inputRef.current?.focus(), 0);
	}

	function saveEdit() {
		const trimmed = editName.trim();
		if (trimmed && trimmed !== watchlist.name) {
			updateMutation.mutate({
				watchlistId: watchlist.id,
				name: trimmed,
			});
		}
		setIsEditing(false);
	}

	function toggleVisibility() {
		updateMutation.mutate({
			watchlistId: watchlist.id,
			isPublic: !watchlist.isPublic,
		});
	}

	function confirmDelete() {
		deleteMutation.mutate({ watchlistId: watchlist.id });
		setShowDeleteConfirm(false);
	}

	const isOwner = userRole === "owner";

	return (
		<div className="mx-auto max-w-6xl px-4">
			{/* Back link */}
			<Link
				to="/app/watchlists"
				className="mb-6 inline-flex items-center gap-1.5 text-sm text-cream/40 transition-colors hover:text-cream/70"
			>
				<ArrowLeft className="h-4 w-4" />
				Back to Watchlists
			</Link>

			{/* Title row */}
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex items-center gap-3">
					{isEditing ? (
						<input
							ref={inputRef}
							type="text"
							value={editName}
							onChange={(e) => setEditName(e.target.value)}
							onBlur={saveEdit}
							onKeyDown={(e) => {
								if (e.key === "Enter") saveEdit();
								if (e.key === "Escape") setIsEditing(false);
							}}
							className="border-b-2 border-neon-pink/50 bg-transparent font-display text-3xl text-cream outline-none sm:text-4xl"
						/>
					) : (
						<h1 className="font-display text-3xl text-cream sm:text-4xl">
							{watchlist.name}
						</h1>
					)}

					{isOwner && !isEditing && (
						<button
							type="button"
							onClick={startEditing}
							className="rounded-lg p-1.5 text-cream/30 transition-colors hover:text-cream/70 hover:bg-cream/8"
							title="Rename watchlist"
						>
							<Pencil className="h-4 w-4" />
						</button>
					)}
				</div>

				{/* Owner actions */}
				{isOwner && (
					<div className="flex items-center gap-2">
						{/* Invite button */}
						<button
							type="button"
							onClick={onInvite}
							className="inline-flex items-center gap-2 rounded-lg border border-neon-cyan/30 bg-neon-cyan/10 px-4 py-2 text-sm font-semibold text-neon-cyan transition-colors hover:bg-neon-cyan/20"
						>
							<UserPlus className="h-4 w-4" />
							Invite
						</button>

						{/* Visibility toggle */}
						<button
							type="button"
							onClick={toggleVisibility}
							disabled={updateMutation.isPending}
							className="rounded-lg p-2 text-cream/40 transition-colors hover:text-cream/70 hover:bg-cream/8"
							title={watchlist.isPublic ? "Make private" : "Make public"}
						>
							{watchlist.isPublic ? (
								<Eye className="h-4 w-4" />
							) : (
								<EyeOff className="h-4 w-4" />
							)}
						</button>

						{/* Delete button */}
						{!watchlist.isDefault &&
							(showDeleteConfirm ? (
								<div className="flex items-center gap-2 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-1.5">
									<span className="text-xs text-red-300">Delete?</span>
									<button
										type="button"
										onClick={confirmDelete}
										disabled={deleteMutation.isPending}
										className="text-xs font-semibold text-red-400 hover:text-red-300"
									>
										Yes
									</button>
									<button
										type="button"
										onClick={() => setShowDeleteConfirm(false)}
										className="text-xs text-cream/40 hover:text-cream/70"
									>
										No
									</button>
								</div>
							) : (
								<button
									type="button"
									onClick={() => setShowDeleteConfirm(true)}
									className="rounded-lg p-2 text-cream/30 transition-colors hover:text-red-400 hover:bg-red-400/10"
									title="Delete watchlist"
								>
									<Trash2 className="h-4 w-4" />
								</button>
							))}
					</div>
				)}
			</div>

			{/* Member count */}
			<div className="mt-3 flex items-center gap-1.5 text-sm text-cream/40">
				<Users className="h-4 w-4" />
				<span>
					{watchlist.members.length}{" "}
					{watchlist.members.length === 1 ? "member" : "members"}
				</span>
			</div>
		</div>
	);
}
