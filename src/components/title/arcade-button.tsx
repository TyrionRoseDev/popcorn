import type { LucideIcon } from "lucide-react";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "#/components/ui/tooltip";
import { cn } from "#/lib/utils";

interface ArcadeButtonProps {
	icon: LucideIcon;
	label: string;
	color: "pink" | "cyan" | "amber";
	onClick?: () => void;
}

const colorConfig = {
	pink: {
		border: "border-neon-pink",
		bg: "bg-neon-pink/20",
		text: "text-neon-pink",
		shadow: "shadow-[0_5px_0_rgba(255,45,120,0.35),0_0_20px_rgba(255,45,120,0.2)]",
		shadowHover: "hover:shadow-[0_3px_0_rgba(255,45,120,0.35),0_0_20px_rgba(255,45,120,0.2)]",
		ringBorder: "border-neon-pink",
	},
	cyan: {
		border: "border-neon-cyan",
		bg: "bg-neon-cyan/12",
		text: "text-neon-cyan",
		shadow: "shadow-[0_5px_0_rgba(0,229,255,0.2),0_0_12px_rgba(0,229,255,0.15)]",
		shadowHover: "hover:shadow-[0_3px_0_rgba(0,229,255,0.2),0_0_12px_rgba(0,229,255,0.15)]",
		ringBorder: "border-neon-cyan",
	},
	amber: {
		border: "border-neon-amber",
		bg: "bg-neon-amber/12",
		text: "text-neon-amber",
		shadow: "shadow-[0_5px_0_rgba(255,184,0,0.2),0_0_12px_rgba(255,184,0,0.12)]",
		shadowHover: "hover:shadow-[0_3px_0_rgba(255,184,0,0.2),0_0_12px_rgba(255,184,0,0.12)]",
		ringBorder: "border-neon-amber",
	},
};

export function ArcadeButton({ icon: Icon, label, color, onClick }: ArcadeButtonProps) {
	const c = colorConfig[color];

	return (
		<div className="text-center">
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<button
							type="button"
							onClick={onClick}
							className={cn(
								"w-[72px] h-[72px] rounded-full border-[3px] flex items-center justify-center",
								"relative cursor-pointer transition",
								"hover:translate-y-[2px]",
								c.border,
								c.bg,
								c.shadow,
								c.shadowHover,
							)}
						>
							{/* Outer glow ring */}
							<div
								aria-hidden="true"
								className={cn(
									"absolute rounded-full border opacity-30 pointer-events-none",
									"transition-[inset,opacity]",
									"inset-[-6px]",
									"hover:inset-[-10px] hover:opacity-15",
									c.ringBorder,
								)}
							/>

							{/* Inner concave depth */}
							<div
								aria-hidden="true"
								className={cn(
									"absolute rounded-full pointer-events-none",
									"inset-[3px]",
									c.bg,
								)}
								style={{ filter: "brightness(0.6)" }}
							/>

							{/* Icon */}
							<Icon className={cn("w-6 h-6 relative z-10", c.text)} />
						</button>
					</TooltipTrigger>
					<TooltipContent sideOffset={8}>
						{label}
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>

			<div className="text-sm font-semibold mt-2.5 text-center tracking-[0.3px]" style={{ color: '#fffff0' }}>
				{label}
			</div>
		</div>
	);
}
