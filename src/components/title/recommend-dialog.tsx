import { useMutation, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { Check, Send, Users, X } from "lucide-react";
import { useState } from "react";
import { useTRPC } from "#/integrations/trpc/react";

interface RecommendDialogProps {
	tmdbId: number;
	mediaType: string;
	titleName: string;
	onClose: () => void;
}

export function RecommendDialog({
	tmdbId,
	mediaType,
	titleName,
	onClose,
}: RecommendDialogProps) {
	const trpc = useTRPC();
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [sent, setSent] = useState(false);

	const { data: friends = [], isLoading } = useQuery(
		trpc.friend.list.queryOptions(),
	);

	const sendRec = useMutation(
		trpc.recommendation.send.mutationOptions({
			onSuccess: () => {
				setSent(true);
				setTimeout(onClose, 1400);
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

	function handleSend() {
		if (selectedIds.size === 0) return;
		sendRec.mutate({
			tmdbId,
			mediaType: mediaType as "movie" | "tv",
			friendIds: Array.from(selectedIds),
			titleName,
		});
	}

	const count = selectedIds.size;

	return (
		<AnimatePresence>
			<motion.div
				key="recommend-backdrop"
				className="fixed inset-0 z-[200] flex items-center justify-center p-4"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				transition={{ duration: 0.2 }}
				style={{
					background: "rgba(5,5,8,0.82)",
					backdropFilter: "blur(10px)",
					WebkitBackdropFilter: "blur(10px)",
				}}
				onClick={onClose}
			>
				<motion.div
					key="recommend-card"
					className="relative w-full max-w-sm"
					initial={{ scale: 0.92, y: 16, opacity: 0 }}
					animate={{ scale: 1, y: 0, opacity: 1 }}
					exit={{ scale: 0.92, y: 16, opacity: 0 }}
					transition={{ type: "spring", damping: 22, stiffness: 280 }}
					onClick={(e) => e.stopPropagation()}
				>
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
									onClick={onClose}
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
									Send{" "}
									<span className="text-cream/65">{titleName}</span>{" "}
									to your friends
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
											const initial = (friend.username ?? "?")[0]?.toUpperCase() ?? "?";

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
																	transition={{ type: "spring", damping: 18, stiffness: 300 }}
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
				</motion.div>
			</motion.div>
		</AnimatePresence>
	);
}
