import type { LucideIcon } from "lucide-react";
import { useRef } from "react";
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
	active?: boolean;
	onClick?: () => void;
}

const colorConfig = {
	pink: {
		border: "border-neon-pink",
		bg: "bg-neon-pink/20",
		text: "text-neon-pink",
		shadow:
			"shadow-[0_5px_0_rgba(255,45,120,0.35),0_0_20px_rgba(255,45,120,0.2)]",
		shadowHover:
			"hover:shadow-[0_3px_0_rgba(255,45,120,0.35),0_0_20px_rgba(255,45,120,0.2)]",
		ringBorder: "border-neon-pink",
		// Plasma Core active state
		activeGradient:
			"linear-gradient(270deg, rgba(255,45,120,0.6), rgba(200,20,80,0.3), rgba(255,100,160,0.5), rgba(255,45,120,0.6))",
		activeShadow:
			"shadow-[0_2px_0_rgba(255,45,120,0.4),0_0_30px_rgba(255,45,120,0.35),0_0_60px_rgba(255,45,120,0.15)]",
		activeIconGlow: "drop-shadow(0 0 3px rgba(255,45,120,0.8))",
		activeLabel: "text-neon-pink",
	},
	cyan: {
		border: "border-neon-cyan",
		bg: "bg-neon-cyan/12",
		text: "text-neon-cyan",
		shadow:
			"shadow-[0_5px_0_rgba(0,229,255,0.2),0_0_12px_rgba(0,229,255,0.15)]",
		shadowHover:
			"hover:shadow-[0_3px_0_rgba(0,229,255,0.2),0_0_12px_rgba(0,229,255,0.15)]",
		ringBorder: "border-neon-cyan",
		// Plasma Core active state
		activeGradient:
			"linear-gradient(270deg, rgba(0,229,255,0.6), rgba(0,150,200,0.3), rgba(80,240,255,0.5), rgba(0,229,255,0.6))",
		activeShadow:
			"shadow-[0_2px_0_rgba(0,229,255,0.4),0_0_30px_rgba(0,229,255,0.35),0_0_60px_rgba(0,229,255,0.15)]",
		activeIconGlow: "drop-shadow(0 0 3px rgba(0,229,255,0.8))",
		activeLabel: "text-neon-cyan",
	},
	amber: {
		border: "border-neon-amber",
		bg: "bg-neon-amber/12",
		text: "text-neon-amber",
		shadow:
			"shadow-[0_5px_0_rgba(255,184,0,0.2),0_0_12px_rgba(255,184,0,0.12)]",
		shadowHover:
			"hover:shadow-[0_3px_0_rgba(255,184,0,0.2),0_0_12px_rgba(255,184,0,0.12)]",
		ringBorder: "border-neon-amber",
		// Plasma Core active state
		activeGradient:
			"linear-gradient(270deg, rgba(255,184,0,0.6), rgba(200,140,0,0.3), rgba(255,210,80,0.5), rgba(255,184,0,0.6))",
		activeShadow:
			"shadow-[0_2px_0_rgba(255,184,0,0.4),0_0_30px_rgba(255,184,0,0.35),0_0_60px_rgba(255,184,0,0.15)]",
		activeIconGlow: "drop-shadow(0 0 3px rgba(255,184,0,0.8))",
		activeLabel: "text-neon-amber",
	},
};

export function ArcadeButton({
	icon: Icon,
	label,
	color,
	active,
	onClick,
}: ArcadeButtonProps) {
	const c = colorConfig[color];
	const buttonRef = useRef<HTMLButtonElement>(null);

	function handleClick() {
		// Trigger bounce animation
		const btn = buttonRef.current;
		if (btn) {
			btn.style.animation = "none";
			btn.offsetHeight; // reflow
			btn.style.animation = "arcade-bounce 0.5s ease-out";
			btn.addEventListener(
				"animationend",
				() => {
					// Clear imperative override so React's style prop (plasma-shift) resumes
					btn.style.animation = "";
				},
				{ once: true },
			);
		}
		onClick?.();
	}

	return (
		<div className="text-center">
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<button
							ref={buttonRef}
							type="button"
							onClick={handleClick}
							className={cn(
								"size-16 rounded-full border-[3px] flex items-center justify-center",
								"relative cursor-pointer transition",
								"hover:translate-y-[2px]",
								c.border,
								active
									? cn(c.activeShadow, "translate-y-[2px]")
									: cn(c.bg, c.shadow, c.shadowHover),
							)}
							style={
								active
									? {
											background: c.activeGradient,
											backgroundSize: "300% 300%",
											animation: "plasma-shift 3s ease infinite",
										}
									: undefined
							}
						>
							{/* Outer glow ring */}
							<div
								aria-hidden="true"
								className={cn(
									"absolute rounded-full border opacity-30 pointer-events-none",
									"transition-[inset,opacity]",
									active ? "inset-[-10px] opacity-15" : "inset-[-6px]",
									"hover:inset-[-10px] hover:opacity-15",
									c.ringBorder,
								)}
							/>

							{/* Inner concave depth — only when inactive */}
							{!active && (
								<div
									aria-hidden="true"
									className={cn(
										"absolute rounded-full pointer-events-none",
										"inset-[3px]",
										c.bg,
									)}
									style={{ filter: "brightness(0.6)" }}
								/>
							)}

							{/* Icon */}
							<Icon
								className={cn(
									"w-6 h-6 relative z-10",
									active ? "text-white" : c.text,
								)}
								style={active ? { filter: c.activeIconGlow } : undefined}
							/>
						</button>
					</TooltipTrigger>
					<TooltipContent sideOffset={8}>{label}</TooltipContent>
				</Tooltip>
			</TooltipProvider>

			<div
				className={cn(
					"text-sm mt-2.5 text-center tracking-[0.3px]",
					active ? cn("font-bold", c.activeLabel) : "font-semibold",
				)}
				style={active ? undefined : { color: "#fffff0" }}
			>
				{label}
			</div>
		</div>
	);
}
