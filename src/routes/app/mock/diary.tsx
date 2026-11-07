import { createFileRoute, Link } from "@tanstack/react-router";
import { Award, EyeOff, MoreHorizontal, Plus, X } from "lucide-react";
import type { Entry, ProgressLine } from "./-data";
import { diary, watching } from "./-data";
import {
	type Direction,
	dateParts,
	Marquee,
	Poster,
	Stars,
	StubSerial,
	useDirection,
} from "./-ui";

export const Route = createFileRoute("/app/mock/diary")({
	component: DiaryMock,
});

function DiaryMock() {
	const d = useDirection();
	return (
		<div className="pc-diary">
			<div>
				<div className="pc-pagehead">
					<div>
						<h1 className="pc-h1">Diary</h1>
						<p className="pc-small pc-t3" style={{ margin: 0 }}>
							128 entries. 9 this month.
						</p>
					</div>
					<button type="button" className="pc-btn pc-btn--primary">
						<Plus size={18} aria-hidden="true" /> Add entry
					</button>
				</div>

				<Celebration d={d} />
				<Tonight d={d} />

				<div
					className="pc-tabs"
					role="tablist"
					aria-label="Filter diary"
					style={{ marginTop: 24 }}
				>
					<button type="button" role="tab" aria-selected="true">
						All
					</button>
					<button type="button" role="tab" aria-selected="false">
						Films
					</button>
					<button type="button" role="tab" aria-selected="false">
						Shows
					</button>
				</div>

				{diary.map((group) => (
					<section key={group.month} aria-label={group.month}>
						<div className="pc-month">
							<h2 className="pc-h3">{group.month}</h2>
							<span className="pc-small pc-t3">{group.items.length} items</span>
						</div>
						{d === "literal" ? (
							<div className="pc-stublist">
								{group.items.map((item) =>
									item.kind === "entry" ? (
										<StubEntry key={item.no} e={item} />
									) : (
										<Progress key={`${item.title.id}-${item.date}`} p={item} />
									),
								)}
							</div>
						) : (
							group.items.map((item) =>
								item.kind === "entry" ? (
									<RowEntry key={item.no} e={item} />
								) : (
									<Progress key={`${item.title.id}-${item.date}`} p={item} />
								),
							)
						)}
					</section>
				))}
			</div>

			<aside style={{ display: "grid", gap: 24, alignContent: "start" }}>
				<div className="pc-card">
					<h2 className="pc-h3" style={{ marginBottom: 16 }}>
						2026 so far
					</h2>
					{d === "literal" ? (
						<div style={{ display: "grid", gap: 8 }}>
							<div className="pc-counter" role="img" aria-label="128 entries">
								{["0", "1", "2", "8"].map((n, i) => (
									// biome-ignore lint/suspicious/noArrayIndexKey: fixed digit positions
									<span key={i}>{n}</span>
								))}
							</div>
							<span className="pc-small pc-t2">
								entries, counted like cars through the gate
							</span>
						</div>
					) : null}
					<div
						className="pc-stats"
						style={{ marginTop: d === "literal" ? 16 : 0 }}
					>
						{[
							["128", "entries"],
							["96", "films"],
							["32", "shows"],
							["241 h", "watched"],
						].map(([n, label]) => (
							<div className="pc-stat" key={label}>
								<div className="n">{n}</div>
								<div className="pc-small pc-t3">{label}</div>
							</div>
						))}
					</div>
				</div>
				<div className="pc-card">
					<h2 className="pc-h3" style={{ marginBottom: 8 }}>
						Rated 5 this year
					</h2>
					<div style={{ display: "flex", gap: 8, marginTop: 12 }}>
						{diary
							.flatMap((g) => g.items)
							.filter((i): i is Entry => i.kind === "entry" && i.rating === 5)
							.map((e) => (
								<Poster key={e.no} title={e.title} w={56} />
							))}
					</div>
				</div>
			</aside>
		</div>
	);
}

function Celebration({ d }: { d: Direction }) {
	return (
		<output className="pc-banner">
			<div className="pc-banner__inner">
				<span className="pc-banner__icon">
					<Award size={20} aria-hidden="true" />
				</span>
				<div style={{ flex: 1, minWidth: 0 }}>
					<div className="pc-small pc-strong">New badge. Double feature.</div>
					<div className="pc-small pc-t2">
						{d === "literal"
							? "Two films in one night, like the old bills."
							: "Two films logged on the same day."}
					</div>
				</div>
				<button type="button" className="pc-iconbtn" aria-label="Dismiss">
					<X size={18} />
				</button>
			</div>
		</output>
	);
}

function Tonight({ d }: { d: Direction }) {
	if (d === "literal") {
		return (
			<section aria-label="Watching next">
				<Marquee
					direction="literal"
					lines={watching.map((w) => `${w.title.title} ${w.next}`)}
					sub="Up next in your diary"
				/>
				<div className="pc-tonight" style={{ marginTop: 4 }}>
					{watching.map((w) => (
						<NextSlot key={w.title.id} w={w} />
					))}
				</div>
			</section>
		);
	}
	return (
		<section
			aria-label="Watching next"
			className="pc-marquee"
			style={{ padding: 16 }}
		>
			<h2 className="pc-small pc-strong pc-t2" style={{ margin: "0 0 12px" }}>
				Up next
			</h2>
			<div className="pc-tonight">
				{watching.map((w) => (
					<NextSlot key={w.title.id} w={w} />
				))}
			</div>
		</section>
	);
}

function NextSlot({ w }: { w: (typeof watching)[number] }) {
	return (
		<div className="pc-slot">
			<Poster title={w.title} w={40} />
			<div style={{ minWidth: 0 }}>
				<div className="pc-small pc-strong">{w.title.title}</div>
				<div className="pc-small pc-t3 pc-data">
					{w.next}
					{w.airs ? `, airs ${w.airs}` : ""}
				</div>
				<div
					className="pc-meter"
					role="img"
					aria-label={`${w.seen} of ${w.total} episodes`}
				>
					<i style={{ width: `${(w.seen / w.total) * 100}%` }} />
				</div>
			</div>
			<button
				type="button"
				className="pc-btn pc-btn--secondary"
				disabled={Boolean(w.airs)}
			>
				{w.airs ? "Not out" : `Watched ${w.next.split(" ")[1]}`}
			</button>
		</div>
	);
}

function EntryText({ e }: { e: Entry }) {
	const d = useDirection();
	return (
		<>
			<div className="pc-row__title">
				<Link to="/app/mock/title" search={{ d }}>
					{e.title.title}
				</Link>
				<span className="pc-small pc-t3" style={{ fontWeight: 400 }}>
					{e.scope ?? e.title.year}
				</span>
			</div>
			<div className="pc-row__meta">
				{e.rating ? (
					<Stars value={e.rating} />
				) : (
					<span className="pc-small pc-t3">No rating</span>
				)}
				{e.rewatch ? (
					<span className="pc-chip">Rewatch {e.rewatch}</span>
				) : null}
				{e.with.length > 0 ? (
					<span className="pc-small pc-t2">
						with {e.with.map((p) => p.name).join(" and ")}
					</span>
				) : null}
				{e.visibility === "Only me" ? (
					<span
						className="pc-small pc-t3"
						style={{ display: "inline-flex", gap: 4, alignItems: "center" }}
					>
						<EyeOff size={14} aria-hidden="true" /> Only me
					</span>
				) : null}
			</div>
			{e.note ? <p className="pc-note">{e.note}</p> : null}
		</>
	);
}

function RowEntry({ e }: { e: Entry }) {
	const p = dateParts(e.date);
	return (
		<article className="pc-row">
			<div className="pc-row__date">
				<div className="day">{p.day}</div>
				<div className="wd">{p.wd}</div>
			</div>
			<Poster title={e.title} w={48} />
			<div style={{ minWidth: 0 }}>
				<EntryText e={e} />
			</div>
			<button
				type="button"
				className="pc-iconbtn"
				aria-label={`Options for ${e.title.title} entry`}
			>
				<MoreHorizontal size={20} />
			</button>
		</article>
	);
}

function StubEntry({ e }: { e: Entry }) {
	return (
		<article className="pc-stub">
			<StubSerial no={e.no} iso={e.date} />
			<div className="pc-stub__body pc-stub-row">
				<Poster title={e.title} w={48} />
				<div style={{ minWidth: 0 }}>
					<EntryText e={e} />
				</div>
				<button
					type="button"
					className="pc-iconbtn"
					aria-label={`Options for ${e.title.title} entry`}
				>
					<MoreHorizontal size={20} />
				</button>
			</div>
		</article>
	);
}

function Progress({ p }: { p: ProgressLine }) {
	const dp = dateParts(p.date);
	return (
		<div className="pc-progress">
			<div className="pc-row__date">
				<div className="day">{dp.day}</div>
				<div className="wd">{dp.wd}</div>
			</div>
			<Poster title={p.title} w={32} className="pc-progress__poster" />
			<p className="pc-small pc-t2" style={{ margin: 0 }}>
				Watched {p.count} episodes of{" "}
				<span className="pc-strong" style={{ color: "var(--pc-text-1)" }}>
					{p.title.title}
				</span>{" "}
				<span className="pc-t3 pc-data">{p.range}</span>
			</p>
		</div>
	);
}
