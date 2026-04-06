const CARS = [
	{ id: "car-1", transform: "scale(0.8) translateY(6px)", opacity: 0.7 },
	{ id: "car-2", transform: "scale(0.9) translateY(2px)", opacity: 0.85 },
	{ id: "car-3", transform: "scale(1)", opacity: 1 },
	{ id: "car-4", transform: "scale(0.95) translateY(3px)", opacity: 0.9 },
	{ id: "car-5", transform: "scale(0.8) translateY(6px)", opacity: 0.7 },
];

function Car({ transform, opacity }: { transform: string; opacity: number }) {
	return (
		<div
			style={{
				width: "80px",
				height: "52px",
				position: "relative",
				transform,
				opacity,
			}}
		>
			{/* Car body */}
			<div
				style={{
					position: "absolute",
					bottom: 0,
					left: 0,
					width: "100%",
					height: "28px",
					background: "linear-gradient(180deg, #161628 0%, #111122 100%)",
					borderRadius: "4px 4px 2px 2px",
					border: "1px solid rgba(255,255,240,0.04)",
				}}
			/>

			{/* Car roof */}
			<div
				style={{
					position: "absolute",
					bottom: "24px",
					left: "12%",
					width: "76%",
					height: "22px",
					background: "linear-gradient(180deg, #141426 0%, #111122 100%)",
					borderRadius: "8px 8px 0 0",
				}}
			/>

			{/* Rear window */}
			<div
				style={{
					position: "absolute",
					bottom: "26px",
					left: "18%",
					width: "64%",
					height: "16px",
					background:
						"linear-gradient(180deg, rgba(180,200,255,0.06) 0%, rgba(180,200,255,0.02) 100%)",
					borderRadius: "5px 5px 0 0",
				}}
			/>

			{/* Bumper */}
			<div
				style={{
					position: "absolute",
					bottom: "2px",
					left: "5%",
					width: "90%",
					height: "4px",
					background: "rgba(255,255,240,0.03)",
				}}
			/>

			{/* License plate */}
			<div
				style={{
					position: "absolute",
					bottom: "4px",
					left: "50%",
					transform: "translateX(-50%)",
					width: "18px",
					height: "8px",
					background: "rgba(255,255,240,0.06)",
					border: "1px solid rgba(255,255,240,0.04)",
				}}
			/>

			{/* Left tail light */}
			<div
				style={{
					position: "absolute",
					bottom: "8px",
					left: "3px",
					width: "10px",
					height: "5px",
					borderRadius: "2px",
					background: "rgba(255,30,30,0.7)",
					boxShadow:
						"0 0 8px rgba(255,30,30,0.5), 0 0 20px rgba(255,30,30,0.2)",
				}}
			/>

			{/* Right tail light */}
			<div
				style={{
					position: "absolute",
					bottom: "8px",
					right: "3px",
					width: "10px",
					height: "5px",
					borderRadius: "2px",
					background: "rgba(255,30,30,0.7)",
					boxShadow:
						"0 0 8px rgba(255,30,30,0.5), 0 0 20px rgba(255,30,30,0.2)",
				}}
			/>
		</div>
	);
}

export function CarSilhouettes() {
	return (
		<div
			aria-hidden="true"
			className="flex items-end justify-center gap-[30px] max-w-[1100px] mx-auto px-6 h-[90px] -mt-[10px]"
		>
			{CARS.map((car) => (
				<Car key={car.id} transform={car.transform} opacity={car.opacity} />
			))}
		</div>
	);
}
