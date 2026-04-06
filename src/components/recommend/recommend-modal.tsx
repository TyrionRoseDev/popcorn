import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Send, Users, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "#/components/ui/dialog";
import { useTRPC } from "#/integrations/trpc/react";

interface RecommendModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	tmdbId: number;
	mediaType: "movie" | "tv";
	titleName: string;
	/** Include optional message textarea (default: false) */
	showMessage?: boolean;
	/** Visual theme variant (default: "scanline") */
	variant?: "scanline" | "marquee";
}

export function RecommendModal({
	open,
	onOpenChange,
	tmdbId,
	mediaType,
	titleName,
	showMessage = false,
	variant = "scanline",
}: RecommendModalProps) {
	const trpc = useTRPC();

	// Shared state
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [sent, setSent] = useState(false);
	const [message, setMessage] = useState("");

	// Marquee-only state
	const [search, setSearch] = useState("");
	const [selectedFriends, setSelectedFriends] = useState<
		Array<{ id: string; username: string | null }>
	>([]);

	const { data: friends = [], isLoading } = useQuery({
		...trpc.friend.list.queryOptions(),
		enabled: open,
	});

	function handleClose() {
		setSelectedIds(new Set());
		setSent(false);
		setMessage("");
		setSearch("");
		setSelectedFriends([]);
		onOpenChange(false);
	}

	const sendRec = useMutation(
		trpc.recommendation.send.mutationOptions({
			onSuccess: () => {
				if (variant === "marquee") {
					toast.success("Recommendation sent!");
					handleClose();
				} else {
					setSent(true);
					setTimeout(handleClose, 1400);
				}
			},
			onError: (error) => {
				toast.error(error.message || "Failed to send recommendation");
			},
		}),
	);

	function toggleFriend(id: string) {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	}

	function toggleFriendMarquee(friend: {
		id: string;
		username: string | null;
	}) {
		setSelectedFriends((prev) =>
			prev.some((s) => s.id === friend.id)
				? prev.filter((s) => s.id !== friend.id)
				: [...prev, friend],
		);
	}

	function removeFriendMarquee(id: string) {
		setSelectedFriends((prev) => prev.filter((s) => s.id !== id));
	}

	function handleSend() {
		if (variant === "marquee") {
			if (selectedFriends.length === 0) return;
			sendRec.mutate({
				tmdbId,
				mediaType,
				recipientIds: selectedFriends.map((s) => s.id),
				titleName,
				message: message.trim() || undefined,
			});
		} else {
			if (selectedIds.size === 0) return;
			sendRec.mutate({
				tmdbId,
				mediaType,
				recipientIds: Array.from(selectedIds),
				titleName,
				message: message.trim() || undefined,
			});
		}
	}

	if (variant === "marquee") {
		const filtered = friends.filter((f) => {
			if (selectedFriends.some((s) => s.id === f.id)) return false;
			if (!search) return true;
			const q = search.toLowerCase().replace("@", "");
			return f.username?.toLowerCase().includes(q);
		});

		return (
			<Dialog
				open={open}
				onOpenChange={(v) => {
					if (!v) handleClose();
				}}
			>
				<DialogContent
					className="max-w-[360px] border-none bg-transparent p-0 gap-0 shadow-none"
					showCloseButton={false}
					aria-describedby={undefined}
				>
					<DialogTitle className="sr-only">Recommend</DialogTitle>
					<div className="w-full flex flex-col items-center">
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
										onClick={handleClose}
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
										{filtered.slice(0, 5).map((friend) => (
											<button
												key={friend.id}
												type="button"
												onClick={() => toggleFriendMarquee(friend)}
												className="flex items-center gap-2.5 px-3 py-2 rounded-md border border-cream/[0.05] bg-black/20 transition-colors duration-200 text-left hover:border-cream/10"
											>
												<div className="w-7 h-7 rounded-full flex items-center justify-center font-mono-retro text-xs shrink-0 border border-cream/10 bg-cream/[0.06] text-cream/40">
													{friend.username?.slice(0, 2).toUpperCase() ?? "?"}
												</div>
												<span className="flex-1 text-sm text-cream/70">
													@{friend.username}
												</span>
											</button>
										))}
									</div>
								)}

								{/* Selected chips */}
								{selectedFriends.length > 0 && (
									<div>
										<div className="font-mono-retro text-[10px] tracking-[3px] uppercase text-cream/30 mb-2">
											Selected
										</div>
										<div className="flex gap-1.5 flex-wrap">
											{selectedFriends.map((s) => (
												<div
													key={s.id}
													className="flex items-center gap-1 px-2.5 py-1 bg-neon-pink/[0.08] border border-neon-pink/25 rounded-full font-mono-retro text-xs text-neon-pink"
												>
													@{s.username}
													<button
														type="button"
														onClick={() => removeFriendMarquee(s.id)}
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
								{showMessage && (
									<div>
										<div className="font-mono-retro text-[10px] tracking-[3px] uppercase text-cream/30 mb-2">
											Message (optional)
										</div>
										<textarea
											value={message}
											onChange={(e) => setMessage(e.target.value.slice(0, 150))}
											maxLength={150}
											placeholder="You have to see this one…"
											className="w-full bg-black/30 border border-cream/[0.06] rounded-md px-3.5 py-2.5 min-h-14 font-sans text-sm text-cream placeholder:text-cream/25 placeholder:italic leading-relaxed shadow-[inset_0_2px_8px_rgba(0,0,0,0.3)] focus:outline-none focus:border-neon-pink/20 resize-none transition-colors duration-200"
										/>
									</div>
								)}

								{/* Send button */}
								<button
									type="button"
									onClick={handleSend}
									disabled={selectedFriends.length === 0 || sendRec.isPending}
									className="w-full py-3 px-6 bg-neon-pink/[0.08] border-2 border-neon-pink/35 rounded-lg font-display text-base tracking-widest text-neon-pink text-center shadow-[0_4px_0_rgba(255,45,120,0.12),0_0_16px_rgba(255,45,120,0.08)] cursor-pointer hover:translate-y-0.5 hover:shadow-[0_2px_0_rgba(255,45,120,0.12),0_0_24px_rgba(255,45,120,0.12)] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
								>
									Send Recommendation
								</button>
							</div>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		);
	}

	// Scanline variant (default) — amber/gold theme
	const count = selectedIds.size;

	return (
		<Dialog
			open={open}
			onOpenChange={(v) => {
				if (!v) handleClose();
			}}
		>
			<DialogContent
				className="max-w-sm rounded-2xl border-none bg-transparent p-0 gap-0 shadow-none"
				overlayClassName="bg-[rgba(5,5,8,0.82)] backdrop-blur-[10px]"
				showCloseButton={false}
				aria-describedby={undefined}
			>
				<DialogTitle className="sr-only">Recommend</DialogTitle>
				<div
					className="rounded-2xl p-px"
					style={{
						background:
							"linear-gradient(135deg, rgba(255,184,0,0.3) 0%, rgba(255,45,120,0.2) 60%, rgba(0,229,255,0.1) 100%)",
						boxShadow:
							"0 0 40px rgba(255,184,0,0.1), 0 24px 60px rgba(0,0,0,0.6)",
					}}
				>
					<div
						className="relative rounded-2xl overflow-hidden"
						style={{ background: "#0b0b18" }}
					>
						{/* Scanline texture */}
						<div
							aria-hidden="true"
							className="pointer-events-none absolute inset-0 z-0"
							style={{
								backgroundImage:
									"repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.012) 2px, rgba(255,255,255,0.012) 4px)",
							}}
						/>

						{/* Header */}
						<div className="relative z-10 px-5 pt-5 pb-4 border-b border-cream/8">
							<button
								type="button"
								onClick={handleClose}
								className="absolute top-4 right-4 rounded-lg p-1.5 text-cream/30 hover:text-cream/60 hover:bg-cream/8 transition-colors"
								aria-label="Close"
							>
								<X className="h-4 w-4" />
							</button>

							<p
								className="font-mono text-[10px] uppercase tracking-[3px] text-neon-amber/60 mb-1"
								style={{ textShadow: "0 0 10px rgba(255,184,0,0.3)" }}
							>
								Share the Reel
							</p>
							<h2
								className="font-display text-xl text-cream"
								style={{ textShadow: "0 0 20px rgba(255,184,0,0.15)" }}
							>
								Recommend
							</h2>
							<p className="mt-0.5 text-xs text-cream/40 pr-6 truncate">
								Send <span className="text-cream/65">{titleName}</span> to your
								friends
							</p>
						</div>

						{/* Friend list */}
						<div className="relative z-10 px-3 py-3 max-h-64 overflow-y-auto">
							{isLoading ? (
								<div className="py-8 text-center">
									<div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-neon-amber/30 border-t-neon-amber/80" />
								</div>
							) : friends.length === 0 ? (
								<div className="py-8 text-center">
									<Users className="mx-auto mb-2 h-7 w-7 text-cream/15" />
									<p className="font-mono text-xs text-cream/30 uppercase tracking-wider">
										No friends yet
									</p>
								</div>
							) : (
								<ul className="space-y-1">
									{friends.map((friend) => {
										const isSelected = selectedIds.has(friend.id);
										const initial =
											(friend.username ?? "?")[0]?.toUpperCase() ?? "?";

										return (
											<li key={friend.id}>
												<button
													type="button"
													onClick={() => toggleFriend(friend.id)}
													className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-all text-left"
													style={
														isSelected
															? {
																	background: "rgba(255,184,0,0.1)",
																	border: "1px solid rgba(255,184,0,0.3)",
																}
															: {
																	background: "transparent",
																	border: "1px solid transparent",
																}
													}
												>
													{/* Avatar */}
													{friend.avatarUrl ? (
														<img
															src={friend.avatarUrl}
															alt={friend.username ?? "Friend"}
															className="h-8 w-8 rounded-full object-cover flex-shrink-0 border border-cream/10"
														/>
													) : (
														<div
															className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold"
															style={{
																background: isSelected
																	? "rgba(255,184,0,0.2)"
																	: "rgba(255,255,255,0.06)",
																color: isSelected
																	? "#FFB800"
																	: "rgba(255,255,255,0.4)",
																border: isSelected
																	? "1px solid rgba(255,184,0,0.3)"
																	: "1px solid rgba(255,255,255,0.08)",
															}}
														>
															{initial}
														</div>
													)}

													{/* Username */}
													<span
														className="flex-1 font-mono text-sm truncate"
														style={{
															color: isSelected
																? "rgba(255,184,0,0.9)"
																: "rgba(255,255,255,0.6)",
														}}
													>
														@{friend.username ?? friend.id.slice(0, 8)}
													</span>

													{/* Check icon */}
													<AnimatePresence>
														{isSelected && (
															<motion.div
																initial={{ scale: 0, opacity: 0 }}
																animate={{ scale: 1, opacity: 1 }}
																exit={{ scale: 0, opacity: 0 }}
																transition={{
																	type: "spring",
																	damping: 18,
																	stiffness: 300,
																}}
															>
																<Check
																	className="h-4 w-4"
																	style={{ color: "#FFB800" }}
																/>
															</motion.div>
														)}
													</AnimatePresence>
												</button>
											</li>
										);
									})}
								</ul>
							)}
						</div>

						{/* Optional message textarea (between friend list and footer) */}
						{showMessage && (
							<div className="relative z-10 px-5 pt-2 pb-3 border-t border-cream/8">
								<p className="font-mono text-[10px] uppercase tracking-[2px] text-cream/30 mb-2">
									Message (optional)
								</p>
								<textarea
									value={message}
									onChange={(e) => setMessage(e.target.value.slice(0, 150))}
									maxLength={150}
									placeholder="You have to see this one…"
									className="w-full bg-black/30 border border-cream/[0.06] rounded-md px-3.5 py-2.5 min-h-14 font-sans text-sm text-cream placeholder:text-cream/25 placeholder:italic leading-relaxed shadow-[inset_0_2px_8px_rgba(0,0,0,0.3)] focus:outline-none focus:border-neon-amber/20 resize-none transition-colors duration-200"
								/>
							</div>
						)}

						{/* Footer */}
						<div className="relative z-10 px-5 pb-5 pt-3 border-t border-cream/8">
							{sent ? (
								<motion.div
									initial={{ opacity: 0, y: 4 }}
									animate={{ opacity: 1, y: 0 }}
									className="flex items-center justify-center gap-2 py-2"
								>
									<Check className="h-4 w-4 text-neon-cyan" />
									<span className="font-mono text-xs uppercase tracking-[2px] text-neon-cyan">
										Sent!
									</span>
								</motion.div>
							) : (
								<button
									type="button"
									onClick={handleSend}
									disabled={count === 0 || sendRec.isPending}
									className="flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 font-mono text-xs uppercase tracking-[1.5px] transition-all disabled:cursor-not-allowed"
									style={
										count > 0
											? {
													background: "rgba(255,184,0,0.12)",
													borderColor: "rgba(255,184,0,0.45)",
													color: "#FFB800",
													boxShadow: "0 0 16px rgba(255,184,0,0.12)",
												}
											: {
													background: "transparent",
													borderColor: "rgba(255,255,255,0.08)",
													color: "rgba(255,255,255,0.2)",
												}
									}
								>
									<Send className="h-3.5 w-3.5" />
									{count > 0
										? `Send to ${count} friend${count !== 1 ? "s" : ""}`
										: "Select friends"}
								</button>
							)}
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
