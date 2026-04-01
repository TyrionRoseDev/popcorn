import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "./init";
import { friendRouter } from "./routers/friend";
import { notificationRouter } from "./routers/notification";
import { recommendationRouter } from "./routers/recommendation";
import { searchRouter } from "./routers/search";
import { shuffleRouter } from "./routers/shuffle";
import { tasteProfileRouter } from "./routers/taste-profile";
import { titleRouter } from "./routers/title";
import { userRouter } from "./routers/user";
import { watchEventRouter } from "./routers/watch-event";
import { watchedRouter } from "./routers/watched";
import { watchlistRouter } from "./routers/watchlist";

const todos = [
	{ id: 1, name: "Get groceries" },
	{ id: 2, name: "Buy a new phone" },
	{ id: 3, name: "Finish the project" },
];

const todosRouter = {
	list: publicProcedure.query(() => todos),
	add: publicProcedure
		.input(z.object({ name: z.string() }))
		.mutation(({ input }) => {
			const newTodo = { id: todos.length + 1, name: input.name };
			todos.push(newTodo);
			return newTodo;
		}),
} satisfies TRPCRouterRecord;

export const trpcRouter = createTRPCRouter({
	todos: todosRouter,
	friend: friendRouter,
	tasteProfile: tasteProfileRouter,
	search: searchRouter,
	shuffle: shuffleRouter,
	title: titleRouter,
	notification: notificationRouter,
	recommendation: recommendationRouter,
	watched: watchedRouter,
	watchEvent: watchEventRouter,
	watchlist: watchlistRouter,
	user: userRouter,
});
export type TRPCRouter = typeof trpcRouter;
