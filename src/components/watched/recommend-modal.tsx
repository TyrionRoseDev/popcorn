import { useMutation, useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogOverlay, DialogPortal } from "#/components/ui/dialog";
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

	const [search, setSearch] = useState("");
	const [selected, setSelected] = useState<
		Array<{ id: string; username: string | null }>
	>([]);
	const [message, setMessage] = useState("");

	const { data: friends } = useQuery(trpc.friend.list.queryOptions());

	const sendRecommendation = useMutation(
		trpc.recommendation.send.mutationOptions({
			onSuccess: () => {
				setSearch("");
				setSelected([]);
				setMessage("");
				onOpenChange(false);
			},
		}),
	);

	const filtered = (friends ?? []).filter((f) => {
		if (selected.some((s) => s.id === f.id)) return false;
		if (!search) return true;
		const q = search.toLowerCase().replace("@", "");
		return f.username?.toLowerCase().includes(q);
	});

	function toggleFriend(friend: { id: string; username: string | null }) {
		setSelected((prev) =>
			prev.some((s) => s.id === friend.id)
				? prev.filter((s) => s.id !== friend.id)
				: [...prev, friend],
		);
	}

	function removeFriend(id: string) {
		setSelected((prev) => prev.filter((s) => s.id !== id));
	}

	function handleSend() {
		if (selected.length === 0) return;
		sendRecommendation.mutate({
			recipientIds: selected.map((s) => s.id),
			tmdbId,
			mediaType,
			titleName,
			message: message.trim() || undefined,
		});
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogPortal>
				<DialogOverlay />
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
					<div className="w-full max-w-[360px] flex flex-col items-center">
						{/* Pink marquee header */}
						<div className="w-[calc(100%-16px)] border-2 border-neon-pink/30 border-b-0 rounded-t-lg bg-drive-in-card px-5 py-2.5 text-center shadow-[0_0_20px_rgba(255,45,120,0.08)]">
							<div className="flex justify-center gap-3 mb-1.5">
								{Array.from({ length: 8 }).map((_, i) => (
									<div
										key={`bulb-${i.toString()}`}
										className="w-1.5 h-1.5 rounded-full bg-neon-pink shadow-[0_0_4px_1px_rgba(255,45,120,0.6)] animate-[chase_1.2s_infinite]"
										style={{ animationDelay: `${i * 0.15}s` }}
									/>
								))}
							</div>
							<div className="font-display text-xl text-cream tracking-wide">
								Recommend
							</div>
							<div className="font-mono-retro text-[10px] tracking-[4px] uppercase text-neon-pink/50 mt-0.5">
								{titleName}
							</div>
						</div>

						{/* Card body */}
						<div className="w-full bg-gradient-to-b from-[#0c0c20] to-[#08081a] border border-cream/[0.06] rounded-b-lg shadow-[0_4px_24px_rgba(0,0,0,0.4)] overflow-hidden relative">
							<div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-neon-pink/70 to-transparent shadow-[0_0_10px_rgba(255,45,120,0.4)]" />

							<div className="p-5 flex flex-col gap-4 relative">
								{/* Close */}
								<div className="flex justify-end -mb-2">
									<button
										type="button"
										onClick={() => onOpenChange(false)}
										className="font-mono-retro text-[10px] tracking-[2px] uppercase text-cream/30 hover:text-cream/60 transition-colors duration-200"
									>
										close ✕
									</button>
								</div>

								{/* Search */}
								<div>
									<div className="font-mono-retro text-[10px] tracking-[3px] uppercase text-cream/30 mb-2">
										Send To
									</div>
									<input
										type="text"
										value={search}
										onChange={(e) => setSearch(e.target.value)}
										placeholder="@username..."
										className="w-full bg-black/30 border border-cream/[0.06] rounded-md px-3.5 py-2.5 font-mono-retro text-sm text-cream placeholder:text-cream/30 focus:outline-none focus:border-neon-pink/25 transition-colors duration-200"
									/>
								</div>

								{/* Autocomplete results */}
								{filtered.length > 0 && (
									<div className="flex flex-col gap-1 max-h-36 overflow-y-auto">
										{filtered.slice(0, 5).map((friend) => {
											const isPicked = selected.some((s) => s.id === friend.id);
											return (
												<button
													key={friend.id}
													type="button"
													onClick={() => toggleFriend(friend)}
													className={`flex items-center gap-2.5 px-3 py-2 rounded-md border transition-colors duration-200 text-left ${
														isPicked
															? "bg-neon-pink/[0.06] border-neon-pink/20"
															: "bg-black/20 border-cream/[0.05] hover:border-cream/10"
													}`}
												>
													<div
														className={`w-7 h-7 rounded-full flex items-center justify-center font-mono-retro text-xs shrink-0 border ${
															isPicked
																? "border-neon-pink/30 bg-neon-pink/10 text-neon-pink"
																: "border-cream/10 bg-cream/[0.06] text-cream/40"
														}`}
													>
														{friend.username?.slice(0, 2).toUpperCase() ?? "?"}
													</div>
													<span className="flex-1 text-sm text-cream/70">
														@{friend.username}
													</span>
													{isPicked && (
														<span className="text-sm text-neon-pink">✓</span>
													)}
												</button>
											);
										})}
									</div>
								)}

								{/* Selected chips */}
								{selected.length > 0 && (
									<div>
										<div className="font-mono-retro text-[10px] tracking-[3px] uppercase text-cream/30 mb-2">
											Selected
										</div>
										<div className="flex gap-1.5 flex-wrap">
											{selected.map((s) => (
												<div
													key={s.id}
													className="flex items-center gap-1 px-2.5 py-1 bg-neon-pink/[0.08] border border-neon-pink/25 rounded-full font-mono-retro text-xs text-neon-pink"
												>
													@{s.username}
													<button
														type="button"
														onClick={() => removeFriend(s.id)}
														className="opacity-40 hover:opacity-80 transition-opacity"
													>
														<X className="w-3 h-3" />
													</button>
												</div>
											))}
										</div>
									</div>
								)}

								<div className="h-px bg-gradient-to-r from-transparent via-cream/[0.06] to-transparent" />

								{/* Message */}
								<div>
									<div className="font-mono-retro text-[10px] tracking-[3px] uppercase text-cream/30 mb-2">
										Message (optional)
									</div>
									<textarea
										value={message}
										onChange={(e) => setMessage(e.target.value)}
										placeholder="You have to see this one…"
										className="w-full bg-black/30 border border-cream/[0.06] rounded-md px-3.5 py-2.5 min-h-14 font-sans text-sm text-cream placeholder:text-cream/25 placeholder:italic leading-relaxed shadow-[inset_0_2px_8px_rgba(0,0,0,0.3)] focus:outline-none focus:border-neon-pink/20 resize-none transition-colors duration-200"
									/>
								</div>

								{/* Send button */}
								<button
									type="button"
									onClick={handleSend}
									disabled={
										selected.length === 0 || sendRecommendation.isPending
									}
									className="w-full py-3 px-6 bg-neon-pink/[0.08] border-2 border-neon-pink/35 rounded-lg font-display text-base tracking-widest text-neon-pink text-center shadow-[0_4px_0_rgba(255,45,120,0.12),0_0_16px_rgba(255,45,120,0.08)] cursor-pointer hover:translate-y-0.5 hover:shadow-[0_2px_0_rgba(255,45,120,0.12),0_0_24px_rgba(255,45,120,0.12)] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
								>
									Send Recommendation
								</button>
							</div>
						</div>
					</div>
				</div>
			</DialogPortal>
		</Dialog>
	);
}
