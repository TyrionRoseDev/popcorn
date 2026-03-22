import { useNavigate, useSearch } from "@tanstack/react-router";
import {
	Pagination,
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
} from "#/components/ui/pagination";

interface SearchPaginationProps {
	currentPage: number;
	totalPages: number;
}

function getPageNumbers(
	current: number,
	total: number,
): (number | "ellipsis")[] {
	if (total <= 7) {
		return Array.from({ length: total }, (_, i) => i + 1);
	}

	const pages: (number | "ellipsis")[] = [1];

	if (current > 3) {
		pages.push("ellipsis");
	}

	const start = Math.max(2, current - 1);
	const end = Math.min(total - 1, current + 1);

	for (let i = start; i <= end; i++) {
		pages.push(i);
	}

	if (current < total - 2) {
		pages.push("ellipsis");
	}

	pages.push(total);

	return pages;
}

function buildPageHref(search: Record<string, unknown>, page: number): string {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(search)) {
		if (value !== undefined && value !== "") {
			params.set(key, String(value));
		}
	}
	params.set("page", String(page));
	return `/app/search?${params.toString()}`;
}

export function SearchPagination({
	currentPage,
	totalPages,
}: SearchPaginationProps) {
	const navigate = useNavigate();
	const search = useSearch({ from: "/app/search" });

	if (totalPages <= 1) return null;

	function goToPage(e: React.MouseEvent, page: number) {
		e.preventDefault();
		navigate({
			to: "/app/search",
			search: (prev) => ({
				q: prev.q ?? "",
				type: prev.type ?? "all",
				sort: prev.sort ?? "relevance",
				page,
				genre: prev.genre,
				yearMin: prev.yearMin,
				yearMax: prev.yearMax,
				rating: prev.rating,
			}),
		});
		window.scrollTo({ top: 0, behavior: "smooth" });
	}

	const pages = getPageNumbers(currentPage, totalPages);

	return (
		<Pagination className="mt-8">
			<PaginationContent>
				<PaginationItem>
					<PaginationPrevious
						href={
							currentPage > 1
								? buildPageHref(search, currentPage - 1)
								: undefined
						}
						onClick={(e) => currentPage > 1 && goToPage(e, currentPage - 1)}
						className={
							currentPage <= 1
								? "pointer-events-none opacity-30"
								: "cursor-pointer text-cream/50 hover:text-cream"
						}
					/>
				</PaginationItem>

				{pages.map((page, i) =>
					page === "ellipsis" ? (
						<PaginationItem key={`ellipsis-before-${pages[i + 1]}`}>
							<PaginationEllipsis className="text-cream/30" />
						</PaginationItem>
					) : (
						<PaginationItem key={page}>
							<PaginationLink
								href={buildPageHref(search, page)}
								isActive={page === currentPage}
								onClick={(e) => goToPage(e, page)}
								className={`cursor-pointer ${
									page === currentPage
										? "bg-neon-pink/15 text-neon-pink border-neon-pink/30"
										: "text-cream/50 hover:text-cream hover:bg-cream/6"
								}`}
							>
								{page}
							</PaginationLink>
						</PaginationItem>
					),
				)}

				<PaginationItem>
					<PaginationNext
						href={
							currentPage < totalPages
								? buildPageHref(search, currentPage + 1)
								: undefined
						}
						onClick={(e) =>
							currentPage < totalPages && goToPage(e, currentPage + 1)
						}
						className={
							currentPage >= totalPages
								? "pointer-events-none opacity-30"
								: "cursor-pointer text-cream/50 hover:text-cream"
						}
					/>
				</PaginationItem>
			</PaginationContent>
		</Pagination>
	);
}
