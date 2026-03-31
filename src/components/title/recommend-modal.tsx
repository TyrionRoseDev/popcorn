import {
	skipToken,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { Loader2, Send, X } from "lucide-react";
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

interface RecommendModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	tmdbId: number;
	mediaType: "movie" | "tv";
	titleName: string;
}

export function RecommendModal({
	open,
	onOpenChange,
	tmdbId,
	mediaType,
	titleName,
}: RecommendModalProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [searchInput, setSearchInput] = useState("");
	const [debouncedQuery, setDebouncedQuery] = useState("");
	const [selectedFriends, setSelectedFriends] = useState<
		{ id: string; username: string | null; avatarUrl: string | null }[]
	>([]);
	const [message, setMessage] = useState("");

	useEffect(() => {
		const timer = setTimeout(() => setDebouncedQuery(searchInput), 300);
		return () => clearTimeout(timer);
	}, [searchInput]);

	const { data: friends, isFetching } = useQuery(
		trpc.recommendation.searchFriends.queryOptions(
			debouncedQuery.length >= 1 ? { query: debouncedQuery } : skipToken,
		),
	);

	const sendRecommendation = useMutation(
		trpc.recommendation.send.mutationOptions({
			onSuccess: () => {
				const count = selectedFriends.length;
				toast.success(
					`Recommended ${titleName} to ${count} friend${count > 1 ? "s" : ""}`,
				);
				resetAndClose();
			},
			onError: (err) => {
				toast.error(err.message ?? "Failed to send recommendation");
			},
		}),
	);

	function resetAndClose() {
		setSearchInput("");
		setDebouncedQuery("");
		setSelectedFriends([]);
		setMessage("");
		onOpenChange(false);
	}

	function toggleFriend(friend: {
		id: string;
		username: string | null;
		avatarUrl: string | null;
	}) {
		setSelectedFriends((prev) => {
			const exists = prev.find((f) => f.id === friend.id);
			if (exists) return prev.filter((f) => f.id !== friend.id);
			return [...prev, friend];
		});
	}

	function handleSend() {
		if (selectedFriends.length === 0) return;
		sendRecommendation.mutate({
			recipientIds: selectedFriends.map((f) => f.id),
			tmdbId,
			mediaType,
			titleName,
			message: message.trim() || undefined,
		});
	}

	const filteredFriends = friends?.filter(
		(f) => !selectedFriends.some((s) => s.id === f.id),
	);
	const showResults = debouncedQuery.length >= 1 && filteredFriends;

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) resetAndClose();
				else onOpenChange(nextOpen);
			}}
		>
			<DialogContent className="bg-drive-in-card border border-drive-in-border rounded-xl max-w-md">
				<DialogHeader>
					<DialogTitle className="font-display text-cream">
						Recommend {titleName}
					</DialogTitle>
					<DialogDescription className="text-cream/40">
						Send this to a friend to watch.
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-3 py-2">
					{/* Selected friends chips */}
					{selectedFriends.length > 0 && (
						<div className="flex flex-wrap gap-1.5">
							{selectedFriends.map((f) => (
								<span
									key={f.id}
									className="inline-flex items-center gap-1 rounded-full border border-neon-amber/30 bg-neon-amber/10 px-2.5 py-1 text-xs text-neon-amber"
								>
									@{f.username}
									<button
										type="button"
										onClick={() => toggleFriend(f)}
										className="ml-0.5 hover:text-cream transition-colors"
									>
										<X className="h-3 w-3" />
									</button>
								</span>
							))}
						</div>
					)}

					{/* Search input */}
					<input
						type="text"
						value={searchInput}
						onChange={(e) => setSearchInput(e.target.value)}
						placeholder="Search friends..."
						disabled={sendRecommendation.isPending}
						autoFocus
						className="w-full rounded-lg border border-cream/12 bg-cream/6 px-3.5 py-3 text-sm text-cream placeholder:text-cream/30 focus:border-neon-amber/40 focus:outline-none disabled:opacity-50"
					/>

					{/* Loading */}
					{isFetching && (
						<div className="flex items-center gap-2 px-1 py-3 text-sm text-cream/40">
							<Loader2 className="h-4 w-4 animate-spin" />
							Searching...
						</div>
					)}

					{/* Results */}
					{showResults && !isFetching && filteredFriends.length > 0 && (
						<div className="flex flex-col max-h-[160px] overflow-y-auto">
							{filteredFriends.map((f) => (
								<button
									key={f.id}
									type="button"
									onClick={() => toggleFriend(f)}
									className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-cream/5 text-left transition-colors"
								>
									<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cream/10 text-xs font-semibold text-cream/60 uppercase">
										{f.avatarUrl ? (
											<img
												src={f.avatarUrl}
												alt=""
												className="h-8 w-8 rounded-full object-cover"
											/>
										) : (
											(f.username?.[0] ?? "?")
										)}
									</div>
									<span className="text-sm text-cream/70 truncate">
										@{f.username}
									</span>
								</button>
							))}
						</div>
					)}

					{/* Empty */}
					{showResults && !isFetching && filteredFriends.length === 0 && (
						<p className="px-1 py-3 text-sm text-cream/30">No friends found</p>
					)}

					{/* Message input */}
					{selectedFriends.length > 0 && (
						<>
							<textarea
								value={message}
								onChange={(e) => setMessage(e.target.value.slice(0, 150))}
								placeholder="Add a message (optional)"
								rows={2}
								className="w-full rounded-lg border border-cream/12 bg-cream/6 px-3.5 py-3 text-sm text-cream placeholder:text-cream/30 focus:border-neon-amber/40 focus:outline-none resize-none"
							/>
							<div className="flex items-center justify-between">
								<span className="text-[11px] text-cream/25">
									{message.length}/150
								</span>
								<button
									type="button"
									onClick={handleSend}
									disabled={sendRecommendation.isPending}
									className="inline-flex items-center gap-1.5 rounded-full border border-neon-amber/40 bg-neon-amber/10 px-4 py-1.5 text-sm font-semibold text-neon-amber transition-colors hover:bg-neon-amber/20 disabled:opacity-50"
								>
									<Send className="h-3.5 w-3.5" />
									{sendRecommendation.isPending ? "Sending..." : "Send"}
								</button>
							</div>
						</>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
