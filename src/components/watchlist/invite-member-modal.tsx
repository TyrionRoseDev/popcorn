import {
	skipToken,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { Loader2, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { useTRPC } from "#/integrations/trpc/react";

interface InviteMemberModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	watchlistId: string;
	watchlistName: string;
}

export function InviteMemberModal({
	open,
	onOpenChange,
	watchlistId,
	watchlistName,
}: InviteMemberModalProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [searchInput, setSearchInput] = useState("");
	const [debouncedQuery, setDebouncedQuery] = useState("");
	const [selectedUser, setSelectedUser] = useState<{
		id: string;
		username: string | null;
		avatarUrl: string | null;
	} | null>(null);

	// Debounce search input
	useEffect(() => {
		const timer = setTimeout(() => setDebouncedQuery(searchInput), 300);
		return () => clearTimeout(timer);
	}, [searchInput]);

	const { data: users, isFetching } = useQuery(
		trpc.watchlist.searchUsers.queryOptions(
			debouncedQuery.length >= 2 ? { query: debouncedQuery } : skipToken,
		),
	);

	const addMemberMutation = useMutation(
		trpc.watchlist.addMember.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries(
					trpc.watchlist.get.queryFilter({ watchlistId }),
				);
				toast.success(
					`Invited @${selectedUser?.username ?? "user"} to ${watchlistName}`,
				);
				resetAndClose();
			},
		}),
	);

	function resetAndClose() {
		setSearchInput("");
		setDebouncedQuery("");
		setSelectedUser(null);
		onOpenChange(false);
	}

	function handleConfirmInvite() {
		if (!selectedUser) return;
		addMemberMutation.mutate({
			watchlistId,
			userId: selectedUser.id,
		});
	}

	const showResults = debouncedQuery.length >= 2 && !selectedUser;
	const showSearching = isFetching && showResults;

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) {
					resetAndClose();
				} else {
					onOpenChange(nextOpen);
				}
			}}
		>
			<DialogContent className="bg-drive-in-card border border-drive-in-border rounded-xl max-w-md">
				<DialogHeader>
					<DialogTitle className="font-display text-cream">
						Invite to {watchlistName}
					</DialogTitle>
					<DialogDescription className="text-cream/40">
						Search for a user by their username.
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-3 py-2">
					{/* Search input */}
					<input
						type="text"
						value={searchInput}
						onChange={(e) => {
							setSearchInput(e.target.value);
							setSelectedUser(null);
						}}
						placeholder="Search username..."
						disabled={addMemberMutation.isPending}
						autoFocus
						className="w-full rounded-lg border border-cream/12 bg-cream/6 px-3.5 py-3 text-sm text-cream placeholder:text-cream/30 focus:border-neon-cyan/40 focus:outline-none disabled:opacity-50"
					/>

					{/* Selected user confirmation */}
					{selectedUser && (
						<div className="rounded-lg border border-neon-cyan/20 bg-neon-cyan/5 p-4">
							<p className="text-sm text-cream/80 mb-3">
								Invite{" "}
								<span className="font-semibold text-cream">
									@{selectedUser.username}
								</span>{" "}
								to {watchlistName}?
							</p>
							<div className="flex items-center gap-2">
								<button
									type="button"
									onClick={handleConfirmInvite}
									disabled={addMemberMutation.isPending}
									className="inline-flex items-center gap-1.5 rounded-full border border-neon-cyan/40 bg-neon-cyan/10 px-4 py-1.5 text-sm font-semibold text-neon-cyan transition-colors hover:bg-neon-cyan/20 disabled:opacity-50"
								>
									<UserPlus className="h-3.5 w-3.5" />
									{addMemberMutation.isPending ? "Inviting..." : "Confirm"}
								</button>
								<button
									type="button"
									onClick={() => setSelectedUser(null)}
									disabled={addMemberMutation.isPending}
									className="rounded-lg px-3 py-1.5 text-sm text-cream/40 transition-colors hover:text-cream/70 disabled:opacity-50"
								>
									Cancel
								</button>
							</div>
						</div>
					)}

					{/* Loading state */}
					{showSearching && (
						<div className="flex items-center gap-2 px-1 py-3 text-sm text-cream/40">
							<Loader2 className="h-4 w-4 animate-spin" />
							Searching...
						</div>
					)}

					{/* Results list */}
					{showResults && !isFetching && users && users.length > 0 && (
						<div className="flex flex-col max-h-[200px] overflow-y-auto">
							{users.map((u) => (
								<button
									key={u.id}
									type="button"
									onClick={() => setSelectedUser(u)}
									className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-cream/5 text-left transition-colors"
								>
									{/* Avatar circle */}
									<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cream/10 text-xs font-semibold text-cream/60 uppercase">
										{u.avatarUrl ? (
											<img
												src={u.avatarUrl}
												alt=""
												className="h-8 w-8 rounded-full object-cover"
											/>
										) : (
											(u.username?.[0] ?? "?")
										)}
									</div>
									<span className="text-sm text-cream/70 truncate">
										@{u.username}
									</span>
								</button>
							))}
						</div>
					)}

					{/* Empty state */}
					{showResults && !isFetching && users && users.length === 0 && (
						<p className="px-1 py-3 text-sm text-cream/30">No users found</p>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
