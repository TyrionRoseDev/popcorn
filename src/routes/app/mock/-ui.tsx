import { useSearch } from "@tanstack/react-router";
import { Star } from "lucide-react";
import type { Person, Title } from "./-data";
import { img } from "./-data";

export type Direction = "restrained" | "literal";

export function useDirection(): Direction {
	return useSearch({ from: "/app/mock" }).d;
}

export function Poster({
	title,
	w,
	className = "",
}: {
	title: Title;
	w: number;
	className?: string;
}) {
	return (
		<img
			className={`pc-poster ${className}`}
			src={img(title.poster, w > 120 ? "w342" : "w185")}
			alt=""
			width={w}
			height={Math.round(w * 1.5)}
			style={{ width: w, height: Math.round(w * 1.5) }}
		/>
	);
}

export function Stars({ value }: { value: number }) {
	return (
		<span className="pc-stars" role="img" aria-label={`Rated ${value} of 5`}>
			{[1, 2, 3, 4, 5].map((n) => (
				<Star
					key={n}
					className={n <= value ? undefined : "off"}
					fill="currentColor"
					strokeWidth={0}
				/>
			))}
		</span>
	);
}

export function Avatar({
	person,
	size = 32,
}: {
	person: Person;
	size?: number;
}) {
	return (
		<span
			className="pc-avatar"
			aria-hidden="true"
			style={{
				width: size,
				height: size,
				fontSize: size >= 32 ? 14 : 12,
				background: `hsl(${person.hue} 70% 72%)`,
			}}
		>
			{person.name[0]}
		</span>
	);
}

export function Marquee({
	lines,
	sub,
	direction,
}: {
	lines: string[];
	sub: string;
	direction: Direction;
}) {
	if (direction === "literal") {
		return (
			<div>
				<div className="pc-board">
					<div className="pc-board__panel">
						{lines.map((line) => (
							<div className="pc-board__line" key={line}>
								<span className="pc-sr">{line}</span>
								{[...line].map((ch, i) => (
									// biome-ignore lint/suspicious/noArrayIndexKey: letters repeat, position is the identity
									<span key={i} aria-hidden="true">
										{ch === " " ? " " : ch}
									</span>
								))}
							</div>
						))}
						<div className="pc-board__line pc-board__line--red">{sub}</div>
					</div>
				</div>
				<div className="pc-board__posts" aria-hidden="true">
					<i />
					<i />
				</div>
			</div>
		);
	}
	return (
		<div className="pc-marquee">
			{lines.map((line) => (
				<p className="pc-display" key={line}>
					{line}
				</p>
			))}
			<p className="pc-small pc-t2 pc-data" style={{ margin: "4px 0 0" }}>
				{sub}
			</p>
		</div>
	);
}

const MONTHS = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function dateParts(iso: string) {
	const d = new Date(`${iso}T12:00:00`);
	return {
		day: String(d.getDate()),
		wd: DAYS[d.getDay()],
		mon: MONTHS[d.getMonth()],
	};
}

export function StubSerial({ no, iso }: { no: number; iso: string }) {
	const p = dateParts(iso);
	return (
		<div className="pc-stub__serial">
			<span className="no">No. {String(no).padStart(4, "0")}</span>
			<span className="day">{p.day}</span>
			<span className="mon">
				{p.mon} {p.wd}
			</span>
		</div>
	);
}
