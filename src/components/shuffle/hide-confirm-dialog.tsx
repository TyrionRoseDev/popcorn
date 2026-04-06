import { EyeOff } from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";

interface HideConfirmDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void;
}

export function HideConfirmDialog({
	open,
	onOpenChange,
	onConfirm,
}: HideConfirmDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				showCloseButton={false}
				className="max-w-[340px] border-cream/10 bg-[#0c0c1c] p-0 overflow-hidden"
			>
				{/* Neon top accent line */}
				<div
					className="h-[2px] w-full"
					style={{
						background:
							"linear-gradient(90deg, transparent, rgba(255,45,120,0.6), transparent)",
					}}
				/>

				<div className="px-6 pt-5 pb-6">
					<DialogHeader className="items-center text-center gap-3">
						{/* Icon */}
						<div
							className="flex size-12 items-center justify-center rounded-full"
							style={{
								background: "rgba(255,45,120,0.1)",
								border: "1px solid rgba(255,45,120,0.2)",
								boxShadow: "0 0 20px rgba(255,45,120,0.08)",
							}}
						>
							<EyeOff
								className="size-5"
								style={{
									color: "rgba(255,45,120,0.85)",
									filter: "drop-shadow(0 0 6px rgba(255,45,120,0.4))",
								}}
							/>
						</div>

						<DialogTitle className="font-display text-lg text-cream">
							Hide this title?
						</DialogTitle>

						<DialogDescription asChild>
							<div className="space-y-3 text-left">
								<p className="text-[13px] leading-relaxed text-cream/50">
									Hiding removes this title from your{" "}
									<span className="text-cream/70">Shuffle feed</span> so it
									won't show up again while swiping.
								</p>
								<p className="text-[13px] leading-relaxed text-cream/50">
									You can unhide it anytime from the{" "}
									<span className="text-cream/70">Hidden Titles</span> page in
									Shuffle settings, or from the title's detail page.
								</p>
							</div>
						</DialogDescription>
					</DialogHeader>

					<DialogFooter className="mt-5 flex-row gap-2.5 sm:flex-row">
						<button
							type="button"
							onClick={() => onOpenChange(false)}
							className="flex-1 rounded-lg px-4 py-2.5 font-mono-retro text-[10px] uppercase tracking-[2px] text-cream/50 transition-all hover:bg-cream/5 hover:text-cream/70 cursor-pointer"
							style={{
								border: "1px solid rgba(255,255,240,0.08)",
							}}
						>
							Cancel
						</button>
						<button
							type="button"
							onClick={() => {
								onConfirm();
								onOpenChange(false);
							}}
							className="flex-1 rounded-lg px-4 py-2.5 font-mono-retro text-[10px] uppercase tracking-[2px] transition-all cursor-pointer"
							style={{
								background: "rgba(255,45,120,0.15)",
								border: "1px solid rgba(255,45,120,0.3)",
								color: "rgba(255,45,120,0.9)",
								boxShadow: "0 0 15px rgba(255,45,120,0.08)",
							}}
						>
							Hide
						</button>
					</DialogFooter>
				</div>
			</DialogContent>
		</Dialog>
	);
}
