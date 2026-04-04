import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogOverlay, DialogPortal } from "#/components/ui/dialog";
import { useTRPC } from "#/integrations/trpc/react";

export interface Companion {
	friendId?: string;
	name: string;
}

interface WatchedWithModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	value: Companion[];
	onChange: (companions: Companion[]) => void;
}

export function WatchedWithModal({
	open,
	onOpenChange,
	value,
	onChange,
}: WatchedWithModalProps) {
	const trpc = useTRPC();
	const [search, setSearch] = useState("");

	const { data: friends } = useQuery(trpc.friend.list.queryOptions());

	const filtered = (friends ?? []).filter((f) => {
		if (value.some((c) => c.friendId === f.id)) return false;
		if (!search) return true;
		const q = search.toLowerCase().replace("@", "");
		return f.username?.toLowerCase().includes(q);
	});

	function addFriend(friend: { id: string; username: string | null }) {
		onChange([
			...value,
			{ friendId: friend.id, name: friend.username ?? friend.id },
		]);
	}

	function addFreeText() {
		const trimmed = search.trim();
		if (!trimmed) return;
		if (value.some((c) => !c.friendId && c.name === trimmed)) return;
		onChange([...value, { name: trimmed }]);
		setSearch("");
	}

	function remove(index: number) {
		onChange(value.filter((_, i) => i !== index));
	}

	function handleDone() {
		onOpenChange(false);
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogPortal>
				<DialogOverlay />
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
					<div className="w-full max-w-[360px] flex flex-col items-center">
						{/* Cyan marquee header */}
						<div className="w-[calc(100%-16px)] border-2 border-neon-cyan/30 border-b-0 rounded-t-lg bg-drive-in-card px-5 py-2.5 text-center shadow-[0_0_20px_rgba(0,229,255,0.08)]">
							<div className="flex justify-center gap-3 mb-1.5">
								{Array.from({ length: 8 }).map((_, i) => (
									<div
										key={`bulb-${i.toString()}`}
										className="w-1.5 h-1.5 rounded-full bg-neon-cyan shadow-[0_0_4px_1px_rgba(0,229,255,0.6)] animate-[chase_1.2s_infinite]"
										style={{ animationDelay: `${i * 0.15}s` }}
									/>
								))}
							</div>
							<div className="font-display text-xl text-cream tracking-wide">
								Watched With
							</div>
							<div className="font-mono-retro text-[10px] tracking-[4px] uppercase text-neon-cyan/50 mt-0.5">
								Who did you watch with?
							</div>
						</div>

						{/* Card body */}
						<div className="w-full bg-gradient-to-b from-[#0c0c20] to-[#08081a] border border-cream/[0.06] rounded-b-lg shadow-[0_4px_24px_rgba(0,0,0,0.4)] overflow-hidden relative">
							<div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-neon-cyan/70 to-transparent shadow-[0_0_10px_rgba(0,229,255,0.4)]" />

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
										Search Friends or Type a Name
									</div>
									<input
										type="text"
										value={search}
										onChange={(e) => setSearch(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === "Enter" && search.trim()) {
												const exactMatch = filtered.find(
													(f) =>
														f.username?.toLowerCase() ===
														search.trim().toLowerCase(),
												);
												if (exactMatch) {
													addFriend(exactMatch);
												} else {
													addFreeText();
												}
											}
										}}
										placeholder="@friend or a name…"
										className="w-full bg-black/30 border border-cream/[0.06] rounded-md px-3.5 py-2.5 font-mono-retro text-sm text-cream placeholder:text-cream/30 focus:outline-none focus:border-neon-cyan/25 transition-colors duration-200"
									/>
								</div>

								{/* Autocomplete results */}
								{search.trim() && (
									<div className="flex flex-col gap-1 max-h-36 overflow-y-auto">
										{filtered.slice(0, 5).map((friend) => (
											<button
												key={friend.id}
												type="button"
												onClick={() => addFriend(friend)}
												className="flex items-center gap-2.5 px-3 py-2 rounded-md border bg-black/20 border-cream/[0.05] hover:border-cream/10 transition-colors duration-200 text-left"
											>
												<div className="w-7 h-7 rounded-full flex items-center justify-center font-mono-retro text-xs shrink-0 border border-cream/10 bg-cream/[0.06] text-cream/40">
													{friend.username?.slice(0, 2).toUpperCase() ?? "?"}
												</div>
												<span className="flex-1 text-sm text-cream/70">
													@{friend.username}
												</span>
												<span className="text-[10px] text-cream/25">
													friend
												</span>
											</button>
										))}
										{/* Free text option */}
										{search.trim() &&
											!filtered.some(
												(f) =>
													f.username?.toLowerCase() ===
													search.trim().toLowerCase(),
											) && (
												<button
													type="button"
													onClick={addFreeText}
													className="flex items-center gap-2.5 px-3 py-2 rounded-md border bg-black/20 border-neon-amber/10 hover:border-neon-amber/20 transition-colors duration-200 text-left"
												>
													<div className="w-7 h-7 rounded-full flex items-center justify-center font-mono-retro text-xs shrink-0 border border-neon-amber/15 bg-neon-amber/[0.06] text-neon-amber/50">
														+
													</div>
													<span className="flex-1 text-sm text-cream/50">
														Add "{search.trim()}"
													</span>
												</button>
											)}
									</div>
								)}

								{/* Selected chips */}
								{value.length > 0 && (
									<div>
										<div className="font-mono-retro text-[10px] tracking-[3px] uppercase text-cream/30 mb-2">
											Watching With
										</div>
										<div className="flex gap-1.5 flex-wrap">
											{value.map((c, i) => (
												<div
													key={c.friendId ?? `text-${c.name}`}
													className={`flex items-center gap-1 px-2.5 py-1 border rounded-full font-mono-retro text-xs ${
														c.friendId
															? "bg-neon-cyan/[0.08] border-neon-cyan/25 text-neon-cyan"
															: "bg-neon-amber/[0.08] border-neon-amber/25 text-neon-amber"
													}`}
												>
													{c.friendId ? `@${c.name}` : c.name}
													<button
														type="button"
														onClick={() => remove(i)}
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

								{/* Done button */}
								<button
									type="button"
									onClick={handleDone}
									className="w-full py-3 px-6 bg-neon-cyan/[0.08] border-2 border-neon-cyan/35 rounded-lg font-display text-base tracking-widest text-neon-cyan text-center shadow-[0_4px_0_rgba(0,229,255,0.15),0_0_16px_rgba(0,229,255,0.1)] cursor-pointer hover:translate-y-0.5 hover:shadow-[0_2px_0_rgba(0,229,255,0.15),0_0_24px_rgba(0,229,255,0.15)] transition-all duration-200"
								>
									Done
								</button>
							</div>
						</div>
					</div>
				</div>
			</DialogPortal>
		</Dialog>
	);
}
