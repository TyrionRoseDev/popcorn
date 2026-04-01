-- Custom migration: copy review data into watch_event table
INSERT INTO watch_event (id, user_id, tmdb_id, media_type, rating, note, watched_at, created_at)
SELECT id, user_id, tmdb_id, media_type, rating, text, created_at, created_at
FROM review
WHERE NOT EXISTS (
  SELECT 1 FROM watch_event we
  WHERE we.user_id = review.user_id
    AND we.tmdb_id = review.tmdb_id
    AND we.media_type = review.media_type
);
