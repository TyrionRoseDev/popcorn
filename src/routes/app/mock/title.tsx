import { createFileRoute } from "@tanstack/react-router";
import { Bookmark, Pencil, Play, Plus, Send } from "lucide-react";
import { img, matrixEntries, matrixFriends, t } from "./-data";
import { Avatar, Marquee, Poster, Stars, useDirection } from "./-ui";

export const Route = createFileRoute("/app/mock/title")({
	component: TitleMock,
});

const film = t("movie/603");
const hours = film.runtime
	? `${Math.floor(film.runtime / 60)}h ${film.runtime % 60}m`
	: "";

function TitleMock() {
	const d = useDirection();
	return (
		<article>
			<div className="pc-tower">
				<div
					className="pc-screen"
					style={{ backgroundImage: `url(${img(film.backdrop, "w1280")})` }}
					role="img"
					aria-label={`Still from ${film.title}`}
				>
					<div className="pc-screen__fade" />
					<button type="button" className="pc-btn pc-screen__play">
						<Play size={16} aria-hidden="true" /> Play trailer
					</button>
				</div>
			</div>
			<div className="pc-legs" aria-hidden="true">
				<i />
				<i />
			</div>
			{d === "literal" ? (
				<section className="pc-lot" aria-label="Friends who watched">
					<div className="pc-lot__cars">
						{matrixFriends.map((f) => (
							<div className="pc-car" key={f.who.id}>
								<div className="pc-car__body">
									<Avatar person={f.who} size={24} />
								</div>
								<span className="pc-small pc-strong">{f.who.name}</span>
								<Stars value={f.rating} />
							</div>
						))}
					</div>
					<p
						className="pc-small pc-t3"
						style={{ textAlign: "center", margin: "8px 0 0" }}
					>
						3 friends parked here. Each car is a friend who has an entry for
						this film.
					</p>
				</section>
			) : null}

			<div
				style={{
					maxWidth: 760,
					margin: d === "literal" ? "24px auto 0" : "24px auto 0",
					textAlign: "center",
				}}
			>
				<h1 className="pc-sr">{film.title}</h1>
				<Marquee
					direction={d}
					lines={[film.title]}
					sub={`${film.year} · ${hours} · ${film.certification} · ${film.director}`}
				/>
			</div>

			<div className="pc-titlegrid">
				<div className="pc-titleside">
					<div className="pc-actions">
						<button type="button" className="pc-btn pc-btn--primary">
							<Plus size={18} aria-hidden="true" /> Add to diary
						</button>
						<button
							type="button"
							className="pc-btn pc-btn--secondary"
							aria-pressed="false"
						>
							<Bookmark size={16} aria-hidden="true" /> Want to watch
						</button>
						<button type="button" className="pc-btn pc-btn--secondary">
							<Send size={16} aria-hidden="true" /> Recommend
						</button>
					</div>
					<p
						className="pc-small pc-t3"
						style={{ margin: 0, textAlign: "center" }}
					>
						In your diary 3 times. Your rating{" "}
						<span className="pc-t2 pc-strong">4 of 5</span>.
					</p>
					<Poster title={film} w={260} className="pc-poster--big" />
				</div>

				<div>
					<section className="pc-card pc-section" aria-labelledby="yours">
						<div className="pc-section__head">
							<h2 className="pc-h3" id="yours">
								Your entries
							</h2>
							<span className="pc-small pc-t3">3 entries</span>
						</div>
						<div className={d === "literal" ? "pc-stublist" : "pc-entrylist"}>
							{matrixEntries.map((e) =>
								d === "literal" ? (
									<div className="pc-stub" key={e.no}>
										<div className="pc-stub__serial">
											<span className="no">
												No. {String(e.no).padStart(4, "0")}
											</span>
											<span className="day">{e.date.split(" ")[0]}</span>
											<span className="mon">
												{e.date.split(" ")[1]} {e.date.split(" ")[2].slice(2)}
											</span>
										</div>
										<div className="pc-stub__body">
											<EntryBody e={e} />
										</div>
									</div>
								) : (
									<div className="pc-entry" key={e.no}>
										<div
											className="pc-small pc-t3 pc-data"
											style={{ marginBottom: 4 }}
										>
											{e.date}
										</div>
										<EntryBody e={e} />
									</div>
								),
							)}
						</div>
					</section>

					{d === "restrained" ? (
						<section className="pc-card pc-section" aria-labelledby="friends">
							<div className="pc-section__head">
								<h2 className="pc-h3" id="friends">
									Friends who watched
								</h2>
							</div>
							{matrixFriends.map((f) => (
								<div className="pc-friendrow" key={f.who.id}>
									<Avatar person={f.who} />
									<span className="pc-small pc-strong" style={{ flex: 1 }}>
										{f.who.name}
									</span>
									<Stars value={f.rating} />
								</div>
							))}
						</section>
					) : null}

					<section className="pc-card pc-section" aria-labelledby="about">
						<h2 className="pc-h3" id="about">
							About
						</h2>
						<p className="pc-body pc-t2" style={{ margin: "12px 0 0" }}>
							{film.overview}
						</p>
						<dl className="pc-dl">
							<div>
								<dt>Director</dt>
								<dd>{film.director}</dd>
							</div>
							<div>
								<dt>Runtime</dt>
								<dd>{hours}</dd>
							</div>
							<div>
								<dt>Rated</dt>
								<dd>{film.certification}</dd>
							</div>
							<div>
								<dt>TMDB score</dt>
								<dd>{film.vote} of 10</dd>
							</div>
						</dl>
						<div
							style={{
								display: "flex",
								gap: 8,
								marginTop: 16,
								flexWrap: "wrap",
							}}
						>
							{film.genres.map((g) => (
								<span className="pc-chip" key={g}>
									{g}
								</span>
							))}
						</div>
					</section>

					<section className="pc-card pc-section" aria-labelledby="cast">
						<h2 className="pc-h3" id="cast" style={{ marginBottom: 16 }}>
							Cast
						</h2>
						<div className="pc-cast">
							{film.cast.map((c) => (
								<figure key={c.name}>
									{c.profile ? (
										<img src={img(c.profile, "w185")} alt="" />
									) : null}
									<figcaption>
										<div className="pc-small pc-strong">{c.name}</div>
										<div className="pc-caption pc-t3">{c.character}</div>
									</figcaption>
								</figure>
							))}
						</div>
					</section>
				</div>
			</div>
		</article>
	);
}

function EntryBody({ e }: { e: (typeof matrixEntries)[number] }) {
	return (
		<div style={{ display: "flex", gap: 12, alignItems: "start" }}>
			<div style={{ flex: 1, minWidth: 0 }}>
				<div className="pc-row__meta" style={{ marginTop: 0 }}>
					<Stars value={e.rating} />
					<span className="pc-chip">{e.label}</span>
				</div>
				{e.note ? (
					<p className="pc-note">{e.note}</p>
				) : (
					<p className="pc-note pc-t3">No note</p>
				)}
			</div>
			<button
				type="button"
				className="pc-btn pc-btn--quiet"
				aria-label={`Edit entry from ${e.date}`}
			>
				<Pencil size={16} aria-hidden="true" /> Edit
			</button>
		</div>
	);
}
