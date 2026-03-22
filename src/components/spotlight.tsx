function SpotlightBeam({ className }: { className?: string }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 1000 900"
			fill="none"
			className={className}
		>
			<defs>
				<filter
					id="bl-h"
					colorInterpolationFilters="sRGB"
					x="-200"
					y="-200"
					width="1400"
					height="1300"
					filterUnits="userSpaceOnUse"
				>
					<feGaussianBlur stdDeviation="110" />
				</filter>
				<filter
					id="bl-m"
					colorInterpolationFilters="sRGB"
					x="-100"
					y="-100"
					width="1200"
					height="1100"
					filterUnits="userSpaceOnUse"
				>
					<feGaussianBlur stdDeviation="55" />
				</filter>
				<filter
					id="bl-l"
					colorInterpolationFilters="sRGB"
					x="-50"
					y="-50"
					width="1100"
					height="1000"
					filterUnits="userSpaceOnUse"
				>
					<feGaussianBlur stdDeviation="25" />
				</filter>
				<linearGradient
					id="bg"
					x1="800"
					y1="200"
					x2="200"
					y2="750"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#fff" stopOpacity="0" />
					<stop offset="1" stopColor="#fff" />
				</linearGradient>
				<linearGradient
					id="bgc"
					x1="700"
					y1="300"
					x2="250"
					y2="700"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#fff" stopOpacity="0" />
					<stop offset="0.3" stopColor="#fff" stopOpacity="0.12" />
					<stop offset="0.6" stopColor="#fff" stopOpacity="0.3" />
					<stop offset="1" stopColor="#fff" />
				</linearGradient>
			</defs>
			<path
				d="M150 820 L600 80 L880 300 Z"
				fill="url(#bg)"
				fillOpacity="0.35"
				filter="url(#bl-h)"
			/>
			<path
				d="M150 820 L600 80 L880 300 Z"
				fill="url(#bg)"
				fillOpacity="0.25"
				filter="url(#bl-m)"
			/>
			<path
				d="M180 810 L580 130 L820 330 Z"
				fill="url(#bgc)"
				fillOpacity="0.45"
				filter="url(#bl-l)"
			/>
		</svg>
	);
}

export function Spotlights() {
	return (
		<div aria-hidden="true" className="pointer-events-none hidden md:block">
			{/* Left spotlight */}
			<div
				className="absolute"
				style={{
					width: "55vw",
					maxWidth: "750px",
					bottom: "-8%",
					left: "0%",
					transformOrigin: "20% 95%",
					animationName: "sway-left",
					animationDuration: "5s",
					animationTimingFunction: "ease-in-out",
					animationIterationCount: "infinite",
					animationDirection: "alternate",
					zIndex: 1,
				}}
			>
				<SpotlightBeam />
			</div>

			{/* Right spotlight (mirrored) */}
			<div
				className="absolute"
				style={{
					width: "48vw",
					maxWidth: "650px",
					bottom: "-8%",
					right: "0%",
					transformOrigin: "80% 95%",
					animationName: "sway-right",
					animationDuration: "4.5s",
					animationTimingFunction: "ease-in-out",
					animationIterationCount: "infinite",
					animationDirection: "alternate",
					animationDelay: "-3s",
					zIndex: 1,
				}}
			>
				<SpotlightBeam className="[transform:rotateY(180deg)]" />
			</div>
		</div>
	);
}
