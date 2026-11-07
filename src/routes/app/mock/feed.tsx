import { createFileRoute, Link } from "@tanstack/react-router";
import { Bookmark, BookmarkCheck, UserPlus, Users } from "lucide-react";
import type { FeedItem } from "./-data";
import { feed, friends } from "./-data";
import { Avatar, type Direction, Poster, Stars, useDirection } from "./-ui";

export const Route = createFileRoute("/app/mock/feed")({
	component: FeedMock,
});

function FeedMock() {
	const d = useDirection();
	const { state } = Route.useSearch();
	const empty = state === "empty";
	return (
		<div className="pc-feedgrid">
			<div>
				<div className="pc-pagehead">
					<div>
						<h1 className="pc-h1">Friends</h1>
						<p className="pc-small pc-t3" style={{ margin: 0 }}>
							{empty
								? "Your friends' entries, newest watch first."
								: "4 friends. Newest watch first."}
						</p>
					</div>
					<button type="button" className="pc-btn pc-btn--secondary">
						<UserPlus size={16} aria-hidden="true" /> Add friend
					</button>
				</div>
				<div className="pc-tabs" role="tablist" aria-label="Friends">
					<button type="button" role="tab" aria-selected="true">
						Feed
					</button>
					<button type="button" role="tab" aria-selected="false">
						Friends ({empty ? 0 : 4})
					</button>
					<button type="button" role="tab" aria-selected="false">
						Requests (1)
					</button>
				</div>
				{empty ? (
					<Empty d={d} />
				) : (
					feed.map((group) => (
						<section key={group.day} aria-label={group.day}>
							<h2 className="pc-day">{group.day}</h2>
							{group.items.map((item) => (
								<Post
									key={
										item.kind === "entry"
											? `${item.who.id}-${item.no}`
											: item.name
									}
									item={item}
									d={d}
								/>
							))}
						</section>
					))
				)}
			</div>
			<aside style={{ display: "grid", gap: 24, alignContent: "start" }}>
				<div className="pc-card">
					<h2 className="pc-h3" style={{ marginBottom: 8 }}>
						Your friends
					</h2>
					{empty ? (
						<p className="pc-small pc-t2" style={{ margin: 0 }}>
							No friends yet.
						</p>
					) : (
						friends.map((p) => (
							<div className="pc-friendrow" key={p.id}>
								<Avatar person={p} />
								<div style={{ flex: 1, minWidth: 0 }}>
									<div className="pc-small pc-strong">{p.name}</div>
									<div className="pc-caption pc-t3">@{p.handle}</div>
								</div>
							</div>
						))
					)}
				</div>
				<div className="pc-card">
					<h2 className="pc-h3" style={{ marginBottom: 4 }}>
						1 request
					</h2>
					<div className="pc-friendrow">
						<Avatar person={{ id: "r", name: "Ray", handle: "ray", hue: 90 }} />
						<span className="pc-small pc-strong" style={{ flex: 1 }}>
							Ray
						</span>
						<button type="button" className="pc-btn pc-btn--primary">
							Accept
						</button>
					</div>
				</div>
			</aside>
		</div>
	);
}

function Post({ item, d }: { item: FeedItem; d: Direction }) {
	if (item.kind === "list") {
		return (
			<article className="pc-post">
				<div className="pc-post__who">
					<Avatar person={item.who} />
					<span className="pc-small">
						<span className="pc-strong">{item.who.name}</span>{" "}
						<span className="pc-t2">made a list</span>
					</span>
				</div>
				<div style={{ display: "flex", alignItems: "center", gap: 16 }}>
					<div className="pc-stack">
						{item.posters.map((p) => (
							<Poster key={p.id} title={p} w={48} />
						))}
					</div>
					<div>
						<div className="pc-strong">{item.name}</div>
						<div className="pc-small pc-t3">{item.count} titles</div>
					</div>
				</div>
			</article>
		);
	}
	const body = (
		<>
			<div className="pc-post__who">
				<Avatar person={item.who} />
				<span className="pc-small" style={{ flex: 1 }}>
					<span className="pc-strong">{item.who.name}</span>{" "}
					<span className="pc-t2">
						{item.rewatch ? "rewatched" : "watched"}
					</span>
				</span>
			</div>
			<div className="pc-post__body">
				<Poster title={item.title} w={64} />
				<div style={{ minWidth: 0 }}>
					<div className="pc-row__title">
						<Link to="/app/mock/title" search={{ d }}>
							{item.title.title}
						</Link>
						<span className="pc-small pc-t3" style={{ fontWeight: 400 }}>
							{item.title.year}
						</span>
					</div>
					<div className="pc-row__meta">
						{item.rating ? <Stars value={item.rating} /> : null}
						{item.with.length > 0 ? (
							<span className="pc-small pc-t2">
								with{" "}
								{item.with
									.map((p) => (p.id === "vera" ? "you" : p.name))
									.join(" and ")}
							</span>
						) : null}
					</div>
					{item.note ? <p className="pc-postnote">{item.note}</p> : null}
					<div className="pc-post__foot">
						<button
							type="button"
							className="pc-btn pc-btn--quiet"
							aria-pressed={item.saved}
						>
							{item.saved ? (
								<>
									<BookmarkCheck size={16} aria-hidden="true" /> In Want to
									watch
								</>
							) : (
								<>
									<Bookmark size={16} aria-hidden="true" /> Want to watch
								</>
							)}
						</button>
					</div>
				</div>
			</div>
		</>
	);
	if (d === "literal") {
		return (
			<article className="pc-stub">
				<div className="pc-stub__serial">
					<span className="no">{item.who.name}</span>
					<span className="day" style={{ fontSize: 14 }}>
						No.
					</span>
					<span className="mon">{String(item.no).padStart(4, "0")}</span>
				</div>
				<div className="pc-stub__body">{body}</div>
			</article>
		);
	}
	return <article className="pc-post">{body}</article>;
}

function Empty({ d }: { d: Direction }) {
	return (
		<div className="pc-empty">
			<span className="pc-empty__icon">
				<Users size={28} aria-hidden="true" />
			</span>
			<h2 className="pc-h2">
				{d === "literal"
					? "The lot is empty tonight"
					: "No entries from friends yet"}
			</h2>
			<p className="pc-body pc-t2" style={{ margin: 0, maxWidth: 420 }}>
				When a friend adds an entry to their diary, it shows here, newest watch
				first. Add someone you watch with.
			</p>
			<button type="button" className="pc-btn pc-btn--primary">
				<UserPlus size={16} aria-hidden="true" /> Find friends
			</button>
		</div>
	);
}
