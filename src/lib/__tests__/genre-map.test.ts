import { describe, expect, it } from "vitest";
import {
  UNIFIED_GENRES,
  getMovieGenreId,
  getTvGenreId,
  getUnifiedGenreById,
  getGenreNameByTmdbId,
} from "../genre-map";

describe("UNIFIED_GENRES", () => {
  it("contains at least 10 genres", () => {
    expect(UNIFIED_GENRES.length).toBeGreaterThanOrEqual(10);
  });

  it("every genre has a unique id", () => {
    const ids = UNIFIED_GENRES.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every genre has a name and at least one TMDB id", () => {
    for (const genre of UNIFIED_GENRES) {
      expect(genre.name).toBeTruthy();
      expect(
        genre.movieGenreId !== null || genre.tvGenreId !== null
      ).toBe(true);
    }
  });
});

describe("getMovieGenreId", () => {
  it("returns the TMDB movie genre id for a unified genre", () => {
    const action = UNIFIED_GENRES.find((g) => g.name === "Action");
    expect(action).toBeDefined();
    expect(getMovieGenreId(action!.id)).toBe(28);
  });

  it("returns null for unknown id", () => {
    expect(getMovieGenreId(99999)).toBeNull();
  });
});

describe("getTvGenreId", () => {
  it("returns the TMDB TV genre id for a unified genre", () => {
    const action = UNIFIED_GENRES.find((g) => g.name === "Action");
    expect(action).toBeDefined();
    expect(getTvGenreId(action!.id)).toBe(10759);
  });
});

describe("getUnifiedGenreById", () => {
  it("returns the genre object for a valid id", () => {
    const genre = getUnifiedGenreById(1);
    expect(genre).toBeDefined();
    expect(genre!.name).toBeTruthy();
  });

  it("returns undefined for invalid id", () => {
    expect(getUnifiedGenreById(99999)).toBeUndefined();
  });
});

describe("getGenreNameByTmdbId", () => {
  it("returns genre name for a movie TMDB genre ID", () => {
    expect(getGenreNameByTmdbId(28)).toBe("Action");
  });

  it("returns genre name for a TV TMDB genre ID", () => {
    expect(getGenreNameByTmdbId(10759)).toBe("Action");
  });

  it("returns string of ID for unknown TMDB genre ID", () => {
    expect(getGenreNameByTmdbId(99999)).toBe("99999");
  });
});
