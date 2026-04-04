import { Star, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

interface ReviewDialogProps {
	titleName: string;
	onSubmit: (data: {
		rating: number;
		text?: string;
		watchedAt?: string;
	}) => void;
	onSkip: () => void;
}

export function ReviewDialog({
	titleName,
	onSubmit,
	onSkip,
}: ReviewDialogProps) {
	const [rating, setRating] = useState(0);
	const [hoverRating, setHoverRating] = useState(0);
	const [text, setText] = useState("");
	const [watchedAt, setWatchedAt] = useState("");

	function handleSubmit() {
		if (rating === 0) return;
		onSubmit({
			rating,
			text: text.trim() || undefined,
			watchedAt: watchedAt || undefined,
		});
	}

	const displayRating = hoverRating || rating;

	return (
		<AnimatePresence>
			<motion.div
				key="review-backdrop"
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
				onClick={onSkip}
			>
				<motion.div
					key="review-card"
					className="relative w-full max-w-md"
					initial={{ scale: 0.92, y: 16, opacity: 0 }}
					animate={{ scale: 1, y: 0, opacity: 1 }}
					exit={{ scale: 0.92, y: 16, opacity: 0 }}
					transition={{ type: "spring", damping: 22, stiffness: 280 }}
					onClick={(e) => e.stopPropagation()}
				>
					{/* Outer glow border */}
					<div
						className="rounded-2xl p-px"
						style={{
							background:
								"linear-gradient(135deg, rgba(255,184,0,0.35) 0%, rgba(255,45,120,0.2) 50%, rgba(0,229,255,0.15) 100%)",
							boxShadow:
								"0 0 40px rgba(255,184,0,0.12), 0 24px 60px rgba(0,0,0,0.6)",
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

							{/* Header strip */}
							<div className="relative z-10 px-6 pt-6 pb-4 border-b border-cream/8">
								<button
									type="button"
									onClick={onSkip}
									className="absolute top-5 right-5 rounded-lg p-1.5 text-cream/30 hover:text-cream/60 hover:bg-cream/8 transition-colors"
									aria-label="Close"
								>
									<X className="h-4 w-4" />
								</button>

								<p
									className="font-mono text-[10px] uppercase tracking-[3px] text-neon-amber/60 mb-1"
									style={{ textShadow: "0 0 10px rgba(255,184,0,0.3)" }}
								>
									Now Showing
								</p>
								<h2
									className="font-display text-2xl text-cream"
									style={{ textShadow: "0 0 20px rgba(255,184,0,0.15)" }}
								>
									Rate &amp; Review
								</h2>
								<p className="mt-1 text-sm text-cream/45 truncate pr-6">
									{titleName}
								</p>
							</div>

							{/* Body */}
							<div className="relative z-10 px-6 py-5 space-y-5">
								{/* Star rating */}
								<div>
									<p className="font-mono text-[10px] uppercase tracking-[2px] text-cream/40 mb-3">
										Your Rating
									</p>
									{/* biome-ignore lint/a11y/noStaticElementInteractions: container for star buttons, onMouseLeave resets hover state */}
									<div
										className="flex items-center gap-2"
										onMouseLeave={() => setHoverRating(0)}
									>
										{[1, 2, 3, 4, 5].map((star) => (
											<button
												key={star}
												type="button"
												onClick={() => setRating(star)}
												onMouseEnter={() => setHoverRating(star)}
												className="transition-transform hover:scale-110 active:scale-95"
												aria-label={`${star} star${star !== 1 ? "s" : ""}`}
											>
												<Star
													className="h-8 w-8 transition-colors"
													style={
														star <= displayRating
															? {
																	fill: "#FFB800",
																	color: "#FFB800",
																	filter:
																		"drop-shadow(0 0 6px rgba(255,184,0,0.5))",
																}
															: {
																	fill: "rgba(255,255,255,0.08)",
																	color: "rgba(255,255,255,0.2)",
																}
													}
												/>
											</button>
										))}
										{displayRating > 0 && (
											<span className="ml-1 font-mono text-xs text-neon-amber/70">
												{displayRating}/5
											</span>
										)}
									</div>
								</div>

								{/* Review text */}
								<div>
									<label
										htmlFor="review-text"
										className="block font-mono text-[10px] uppercase tracking-[2px] text-cream/40 mb-2"
									>
										Your Review{" "}
										<span className="text-cream/25 normal-case tracking-normal">
											(optional)
										</span>
									</label>
									<textarea
										id="review-text"
										value={text}
										onChange={(e) => setText(e.target.value)}
										placeholder="What did you think?"
										rows={3}
										className="w-full resize-none rounded-xl border border-cream/10 bg-cream/[0.04] px-3.5 py-3 font-mono text-sm text-cream placeholder:text-cream/20 focus:border-neon-amber/40 focus:bg-cream/[0.06] focus:outline-none transition-colors"
									/>
								</div>

								{/* Watched at */}
								<div>
									<label
										htmlFor="watched-at"
										className="block font-mono text-[10px] uppercase tracking-[2px] text-cream/40 mb-2"
									>
										When did you watch it?{" "}
										<span className="text-cream/25 normal-case tracking-normal">
											(optional)
										</span>
									</label>
									<input
										id="watched-at"
										type="datetime-local"
										value={watchedAt}
										onChange={(e) => setWatchedAt(e.target.value)}
										className="w-full rounded-xl border border-cream/10 bg-cream/[0.04] px-3.5 py-3 font-mono text-sm text-cream/80 focus:border-neon-amber/40 focus:bg-cream/[0.06] focus:outline-none transition-colors [color-scheme:dark]"
									/>
								</div>

								{/* Actions */}
								<div className="flex gap-3 pt-1">
									<button
										type="button"
										onClick={onSkip}
										className="flex-1 rounded-xl border border-cream/12 bg-transparent px-4 py-2.5 font-mono text-xs uppercase tracking-[1.5px] text-cream/45 hover:border-cream/25 hover:text-cream/65 transition-all"
									>
										Skip
									</button>
									<button
										type="button"
										onClick={handleSubmit}
										disabled={rating === 0}
										className="flex-[2] rounded-xl border px-4 py-2.5 font-mono text-xs uppercase tracking-[1.5px] transition-all disabled:cursor-not-allowed"
										style={
											rating > 0
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
										Submit Review
									</button>
								</div>
							</div>
						</div>
					</div>
				</motion.div>
			</motion.div>
		</AnimatePresence>
	);
}
