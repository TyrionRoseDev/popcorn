import { Eye, EyeOff, Users } from "lucide-react";

export type Visibility = "public" | "companion" | "private";

interface VisibilitySelectorProps {
	value: Visibility | null;
	onChange: (value: Visibility) => void;
	hasCompanions: boolean;
}

const options: Array<{
	value: Visibility;
	label: string;
	description: string;
	icon: typeof Eye;
	requiresCompanions: boolean;
}> = [
	{
		value: "public",
		label: "Public",
		description: "Visible to all your friends",
		icon: Eye,
		requiresCompanions: false,
	},
	{
		value: "companion",
		label: "Companion",
		description: "Only you & who you watched with",
		icon: Users,
		requiresCompanions: true,
	},
	{
		value: "private",
		label: "Private",
		description: "Only visible to you",
		icon: EyeOff,
		requiresCompanions: false,
	},
];

export function VisibilitySelector({
	value,
	onChange,
	hasCompanions,
}: VisibilitySelectorProps) {
	const visibleOptions = options.filter(
		(o) => !o.requiresCompanions || hasCompanions,
	);

	return (
		<div>
			<div className="font-mono-retro text-[10px] tracking-[3px] uppercase text-cream/70 mb-2">
				Who can see this?
			</div>
			<div className="flex flex-col gap-1.5">
				{visibleOptions.map((option) => {
					const Icon = option.icon;
					const selected = value === option.value;
					return (
						<button
							key={option.value}
							type="button"
							onClick={() => onChange(option.value)}
							className={`flex items-center gap-3 px-3.5 py-2.5 rounded-md text-left transition-all duration-200 ${
								selected
									? "bg-neon-cyan/[0.04] border border-neon-cyan/25 shadow-[0_0_12px_rgba(0,229,255,0.06)]"
									: "bg-black/20 border border-cream/[0.10] hover:border-cream/20"
							}`}
						>
							<Icon
								className={`w-4 h-4 shrink-0 ${selected ? "text-neon-cyan/70" : "text-cream/60"}`}
							/>
							<div className="flex-1">
								<div
									className={`font-mono-retro text-xs tracking-wide ${selected ? "text-neon-cyan/85" : "text-cream/75"}`}
								>
									{option.label}
								</div>
								<div className="font-mono-retro text-[10px] text-cream/50 mt-0.5">
									{option.description}
								</div>
							</div>
							<div
								className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
									selected
										? "border-neon-cyan/50 bg-neon-cyan/15"
										: "border-cream/30"
								}`}
							>
								{selected && (
									<div className="w-2 h-2 rounded-full bg-neon-cyan/80" />
								)}
							</div>
						</button>
					);
				})}
			</div>
		</div>
	);
}
