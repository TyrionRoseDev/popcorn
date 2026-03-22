import {
	createUploadthing,
	type FileRouter,
	UploadThingError,
} from "uploadthing/server";
import { auth } from "#/lib/auth";

const f = createUploadthing();

export const uploadRouter = {
	avatarUploader: f({
		image: {
			maxFileSize: "4MB",
			maxFileCount: 1,
		},
	})
		.middleware(async ({ req }) => {
			const session = await auth.api.getSession({
				headers: req.headers,
			});
			if (!session?.user) {
				throw new UploadThingError("Unauthorized");
			}
			return { userId: session.user.id };
		})
		.onUploadComplete(async ({ metadata, file }) => {
			return { uploadedBy: metadata.userId, url: file.ufsUrl };
		}),
} satisfies FileRouter;

export type UploadRouter = typeof uploadRouter;
