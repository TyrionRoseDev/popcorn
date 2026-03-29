import {
	skipToken,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { Eye, EyeOff, Loader2, Trash2, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { useTRPC } from "#/integrations/trpc/react";

interface SelectedUser {
	id: string;
	username: string | null;
	avatarUrl: string | null;
}

interface CreateWatchlistDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCreated?: (watchlist: { id: string; name: string }) => void;
}

function UserAvatar({
	user,
	size = "sm",
}: {
	user: SelectedUser;
	size?: "sm" | "md";
}) {
	const dim = size === "sm" ? "h-4 w-4" : "h-6 w-6";
	const text = size === "sm" ? "text-[10px]" : "text-[10px]";
	if (user.avatarUrl) {
		return (
			<img
				src={user.avatarUrl}
				alt=""
				className={`${dim} rounded-full object-cover`}
			/>
		);
	}
	return (
		<span
			className={`flex ${dim} items-center justify-center rounded-full bg-cream/15 ${text} font-semibold text-cream/60 uppercase`}
		>
			{user.username?.[0] ?? "?"}
		</span>
	);
}

export function CreateWatchlistDialog({
	open,
	onOpenChange,
	onCreated,
}: CreateWatchlistDialogProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [name, setName] = useState("");
	const [isPublic, setIsPublic] = useState(false);
	const [selectedMembers, setSelectedMembers] = useState<SelectedUser[]>([]);
	const [memberSearch, setMemberSearch] = useState("");
	const [debouncedQuery, setDebouncedQuery] = useState("");
	const [isSearchFocused, setIsSearchFocused] = useState(false);

	// Debounce member search
	useEffect(() => {
		const timer = setTimeout(() => setDebouncedQuery(memberSearch), 300);
		return () => clearTimeout(timer);
	}, [memberSearch]);

	// Fetch known users (co-members from other watchlists)
	const { data: knownUsers } = useQuery(
		trpc.watchlist.knownUsers.queryOptions(open ? undefined : skipToken),
	);

	// Remote search for when user types 2+ chars
	const { data: searchResults, isFetching: isSearching } = useQuery(
		trpc.watchlist.searchUsers.queryOptions(
			debouncedQuery.length >= 2 ? { query: debouncedQuery } : skipToken,
		),
	);

	const selectedIds = new Set(selectedMembers.map((m) => m.id));

	// Filter known users by the current search input (starts matching from 1 char)
	const matchingKnownUsers = useMemo(() => {
		if (!knownUsers || memberSearch.length === 0) return [];
		const q = memberSearch.toLowerCase();
		return knownUsers.filter(
			(u) => !selectedIds.has(u.id) && u.username?.toLowerCase().includes(q),
		);
	}, [knownUsers, memberSearch, selectedIds]);

	// Remote results, excluding already-selected and any already shown as known
	const knownIds = new Set(matchingKnownUsers.map((u) => u.id));
	const filteredRemoteResults = searchResults?.filter(
		(u) => !selectedIds.has(u.id) && !knownIds.has(u.id),
	);

	// Combine: known users first (labeled), then remote results
	const hasKnown = matchingKnownUsers.length > 0;
	const hasRemote = (filteredRemoteResults?.length ?? 0) > 0;
	const showDropdown =
		isSearchFocused &&
		memberSearch.length >= 1 &&
		(hasKnown ||
			hasRemote ||
			(debouncedQuery.length >= 2 && isSearching) ||
			debouncedQuery.length >= 2);

	const createMutation = useMutation(
		trpc.watchlist.create.mutationOptions({
			onSuccess: (newWatchlist) => {
				queryClient.invalidateQueries(trpc.watchlist.list.queryFilter());
				queryClient.invalidateQueries(
					trpc.watchlist.getForDropdown.queryFilter(),
				);
				toast.success(`Created "${newWatchlist.name}"`);
				resetState();
				onOpenChange(false);
				onCreated?.(newWatchlist);
			},
		}),
	);

	function resetState() {
		setName("");
		setIsPublic(false);
		setSelectedMembers([]);
		setMemberSearch("");
		setDebouncedQuery("");
	}

	function handleCreate() {
		const trimmed = name.trim();
		if (!trimmed) return;
		createMutation.mutate({
			name: trimmed,
			isPublic,
			memberIds: selectedMembers.map((m) => m.id),
		});
	}

	function handleNameKeyDown(e: React.KeyboardEvent) {
		if (e.key === "Enter") {
			e.preventDefault();
			handleCreate();
		}
	}

	function addMember(user: SelectedUser) {
		setSelectedMembers((prev) => [...prev, user]);
		setMemberSearch("");
		setDebouncedQuery("");
	}

	function removeMember(userId: string) {
		setSelectedMembers((prev) => prev.filter((m) => m.id !== userId));
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) resetState();
				onOpenChange(nextOpen);
			}}
		>
			<DialogContent className="bg-drive-in-card border border-drive-in-border rounded-xl max-w-md">
				<DialogHeader>
					<DialogTitle className="font-display text-cream">
						Create New Watchlist
					</DialogTitle>
					<DialogDescription className="text-cream/40">
						Give your watchlist a name, choose its visibility, and add members.
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-4 py-2">
					{/* Name input */}
					<input
						type="text"
						value={name}
						onChange={(e) => setName(e.target.value)}
						onKeyDown={handleNameKeyDown}
						placeholder="e.g. Friday Night Horror"
						disabled={createMutation.isPending}
						autoFocus
						className="w-full rounded-lg border border-cream/12 bg-cream/6 px-3.5 py-3 text-sm text-cream placeholder:text-cream/30 focus:border-neon-amber/40 focus:outline-none disabled:opacity-50"
					/>

					{/* Public/Private toggle */}
					<button
						type="button"
						role="switch"
						aria-checked={isPublic}
						onClick={() => setIsPublic((prev) => !prev)}
						className="flex items-center justify-between gap-3 rounded-lg border border-cream/8 bg-cream/4 px-3.5 py-2.5 text-sm text-cream/60 transition-colors hover:text-cream/80 hover:border-cream/15"
					>
						<span className="flex items-center gap-2.5">
							{isPublic ? (
								<Eye className="h-4 w-4 text-neon-cyan" />
							) : (
								<EyeOff className="h-4 w-4 text-cream/40" />
							)}
							<span>
								{isPublic ? "Public" : "Private"}{" "}
								<span className="text-cream/30">
									&mdash; {isPublic ? "anyone can view" : "members only"}
								</span>
							</span>
						</span>
						<span
							className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${isPublic ? "bg-neon-cyan/30" : "bg-cream/12"}`}
						>
							<span
								className={`inline-block h-3.5 w-3.5 rounded-full transition-all ${isPublic ? "translate-x-[18px] bg-neon-cyan" : "translate-x-[3px] bg-cream/40"}`}
							/>
						</span>
					</button>

					{/* Add members section */}
					<div className="flex flex-col gap-2">
						<span className="flex items-center gap-1.5 text-xs font-medium text-cream/40 uppercase tracking-wider">
							<UserPlus className="h-3.5 w-3.5" />
							Add Members
						</span>

						{/* Selected members list */}
						{selectedMembers.length > 0 && (
							<div className="flex flex-col gap-1 rounded-lg border border-cream/8 bg-cream/4 p-2">
								{selectedMembers.map((member) => (
									<div
										key={member.id}
										className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5"
									>
										<span className="flex items-center gap-2 text-sm text-cream/70 min-w-0">
											<UserAvatar user={member} size="md" />
											<span className="truncate">@{member.username}</span>
										</span>
										<button
											type="button"
											onClick={() => removeMember(member.id)}
											className="shrink-0 rounded-md p-1 text-cream/25 transition-colors hover:text-red-400 hover:bg-red-400/10"
											title="Remove"
										>
											<Trash2 className="h-3.5 w-3.5" />
										</button>
									</div>
								))}
							</div>
						)}

						{/* Member search input */}
						<div className="relative">
							<input
								type="text"
								value={memberSearch}
								onChange={(e) => setMemberSearch(e.target.value)}
								onFocus={() => setIsSearchFocused(true)}
								onBlur={() => {
									// Delay so click on result fires before dropdown hides
									setTimeout(() => setIsSearchFocused(false), 200);
								}}
								placeholder="Search username..."
								disabled={createMutation.isPending}
								className="w-full rounded-lg border border-cream/12 bg-cream/6 px-3.5 py-2.5 text-sm text-cream placeholder:text-cream/30 focus:border-neon-cyan/40 focus:outline-none disabled:opacity-50"
							/>

							{/* Suggestions / search results dropdown */}
							{showDropdown && (
								<div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-lg border border-cream/10 bg-drive-in-card shadow-lg">
									<div className="flex flex-col max-h-[200px] overflow-y-auto py-1">
										{/* Known users section */}
										{hasKnown && (
											<>
												<span className="px-3 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-cream/25">
													People you know
												</span>
												{matchingKnownUsers.map((u) => (
													<button
														key={u.id}
														type="button"
														onClick={() => addMember(u)}
														className="flex items-center gap-2.5 px-3 py-2 hover:bg-cream/5 text-left transition-colors"
													>
														<UserAvatar user={u} size="md" />
														<span className="text-sm text-cream/70 truncate">
															@{u.username}
														</span>
													</button>
												))}
											</>
										)}

										{/* Remote search results */}
										{hasRemote && (
											<>
												{hasKnown && (
													<span className="px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-cream/25">
														Other users
													</span>
												)}
												{filteredRemoteResults?.map((u) => (
													<button
														key={u.id}
														type="button"
														onClick={() => addMember(u)}
														className="flex items-center gap-2.5 px-3 py-2 hover:bg-cream/5 text-left transition-colors"
													>
														<UserAvatar user={u} size="md" />
														<span className="text-sm text-cream/70 truncate">
															@{u.username}
														</span>
													</button>
												))}
											</>
										)}

										{/* Loading indicator */}
										{isSearching && debouncedQuery.length >= 2 && (
											<div className="flex items-center gap-2 px-3 py-2.5 text-sm text-cream/40">
												<Loader2 className="h-3.5 w-3.5 animate-spin" />
												Searching...
											</div>
										)}

										{/* Empty state */}
										{!isSearching &&
											!hasKnown &&
											!hasRemote &&
											debouncedQuery.length >= 2 && (
												<p className="px-3 py-2.5 text-sm text-cream/30">
													No users found
												</p>
											)}
									</div>
								</div>
							)}
						</div>
					</div>
				</div>

				<DialogFooter>
					<button
						type="button"
						onClick={() => onOpenChange(false)}
						disabled={createMutation.isPending}
						className="rounded-lg px-4 py-2 text-sm text-cream/50 transition-colors hover:text-cream/80 hover:bg-cream/5 disabled:opacity-50"
					>
						Cancel
					</button>

					<button
						type="button"
						onClick={handleCreate}
						disabled={!name.trim() || createMutation.isPending}
						className="inline-flex items-center gap-1.5 rounded-full border border-neon-amber/45 bg-neon-amber/10 px-5 py-2 text-sm font-bold text-neon-amber transition-colors hover:bg-neon-amber/18 disabled:opacity-40 disabled:cursor-not-allowed"
					>
						{createMutation.isPending ? "Creating..." : "Create"}
					</button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
