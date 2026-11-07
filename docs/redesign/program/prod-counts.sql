-- Read-only usage counts for the Popcorn redesign. Returns numbers only, never names, emails or text.
-- Run against production with:  psql "$DATABASE_URL" -f docs/redesign/program/prod-counts.sql
BEGIN TRANSACTION READ ONLY;

SELECT 'users' AS metric, count(*)::text AS value FROM "user"
UNION ALL SELECT 'users onboarded', count(*)::text FROM "user" WHERE onboarding_completed
UNION ALL SELECT 'users with a session in 30 days', count(DISTINCT user_id)::text FROM session WHERE updated_at > now() - interval '30 days'
UNION ALL SELECT 'users with a session in 90 days', count(DISTINCT user_id)::text FROM session WHERE updated_at > now() - interval '90 days'
UNION ALL SELECT 'latest session update', max(updated_at)::text FROM session
UNION ALL SELECT 'watch_event rows', count(*)::text FROM watch_event
UNION ALL SELECT 'watch_event by scope: ' || coalesce(scope, 'null'), count(*)::text FROM watch_event GROUP BY scope
UNION ALL SELECT 'watch_event by visibility: ' || visibility, count(*)::text FROM watch_event GROUP BY visibility
UNION ALL SELECT 'watch_event with rating', count(*)::text FROM watch_event WHERE rating IS NOT NULL
UNION ALL SELECT 'watch_event with note', count(*)::text FROM watch_event WHERE note IS NOT NULL AND note <> ''
UNION ALL SELECT 'watch_event with review_text', count(*)::text FROM watch_event WHERE review_text IS NOT NULL AND review_text <> ''
UNION ALL SELECT 'watch_event reciprocal', count(*)::text FROM watch_event WHERE origin_event_id IS NOT NULL
UNION ALL SELECT 'watch_event watch_number above 1', count(*)::text FROM watch_event WHERE watch_number > 1
UNION ALL SELECT 'watch_event with null watched_at', count(*)::text FROM watch_event WHERE watched_at IS NULL
UNION ALL SELECT 'watch_event with empty title_name', count(*)::text FROM watch_event WHERE title_name = ''
UNION ALL SELECT 'watch_event with reminder set', count(*)::text FROM watch_event WHERE review_reminder_at IS NOT NULL
UNION ALL SELECT 'watch_event_companion rows', count(*)::text FROM watch_event_companion
UNION ALL SELECT 'watch_event_companion free-text', count(*)::text FROM watch_event_companion WHERE friend_id IS NULL
UNION ALL SELECT 'review rows', count(*)::text FROM review
UNION ALL SELECT 'journal_entry rows', count(*)::text FROM journal_entry
UNION ALL SELECT 'journal_entry public', count(*)::text FROM journal_entry WHERE is_public
UNION ALL SELECT 'journal_entry by scope: ' || scope, count(*)::text FROM journal_entry GROUP BY scope
UNION ALL SELECT 'users with journal entries', count(DISTINCT user_id)::text FROM journal_entry
UNION ALL SELECT 'journal_entry matching an entry with no note', count(*)::text FROM journal_entry j
  WHERE EXISTS (SELECT 1 FROM watch_event e WHERE e.user_id = j.user_id AND e.tmdb_id = j.tmdb_id
    AND coalesce(e.scope, 'show') = j.scope AND e.scope_season_number IS NOT DISTINCT FROM j.season_number
    AND e.scope_episode_number IS NOT DISTINCT FROM j.episode_number AND e.watch_number = j.watch_number
    AND (e.note IS NULL OR e.note = ''))
UNION ALL SELECT 'episode_watch rows', count(*)::text FROM episode_watch
UNION ALL SELECT 'episode_watch season 0 or runtime 0', count(*)::text FROM episode_watch WHERE season_number = 0 OR runtime = 0
UNION ALL SELECT 'users with episode progress', count(DISTINCT user_id)::text FROM episode_watch
UNION ALL SELECT 'user_title rows by media type: ' || media_type, count(*)::text FROM user_title GROUP BY media_type
UNION ALL SELECT 'user_title current_watch_number above 1', count(*)::text FROM user_title WHERE current_watch_number > 1
UNION ALL SELECT 'watchlist by type: ' || type, count(*)::text FROM watchlist GROUP BY type
UNION ALL SELECT 'users with more than one default watchlist', count(*)::text FROM (SELECT owner_id FROM watchlist WHERE type = 'default' GROUP BY owner_id HAVING count(*) > 1) d
UNION ALL SELECT 'shared watchlists (more than one member)', count(*)::text FROM (SELECT watchlist_id FROM watchlist_member GROUP BY watchlist_id HAVING count(*) > 1) s
UNION ALL SELECT 'watchlist_item rows', count(*)::text FROM watchlist_item
UNION ALL SELECT 'watchlist_item watched', count(*)::text FROM watchlist_item WHERE watched
UNION ALL SELECT 'watchlist_item watched with no entry', count(*)::text FROM watchlist_item wi
  JOIN watchlist w ON w.id = wi.watchlist_id
  WHERE wi.watched AND NOT EXISTS (SELECT 1 FROM watch_event e WHERE e.user_id = w.owner_id AND e.tmdb_id = wi.tmdb_id AND e.media_type = wi.media_type)
UNION ALL SELECT 'watchlist_item kept_in_watchlist', count(*)::text FROM watchlist_item WHERE kept_in_watchlist
UNION ALL SELECT 'watchlist_item with watched_seasons', count(*)::text FROM watchlist_item WHERE watched_seasons IS NOT NULL
UNION ALL SELECT 'shuffle_swipe rows', count(*)::text FROM shuffle_swipe
UNION ALL SELECT 'users who swiped', count(DISTINCT user_id)::text FROM shuffle_swipe
UNION ALL SELECT 'recommendation by status: ' || status, count(*)::text FROM recommendation GROUP BY status
UNION ALL SELECT 'friendship by status: ' || status, count(*)::text FROM friendship GROUP BY status
UNION ALL SELECT 'block rows', count(*)::text FROM block
UNION ALL SELECT 'notification rows', count(*)::text FROM notification
UNION ALL SELECT 'notification by type: ' || type, count(*)::text FROM notification GROUP BY type
UNION ALL SELECT 'earned_achievement rows', count(*)::text FROM earned_achievement
UNION ALL SELECT 'title_quote rows', count(*)::text FROM title_quote
UNION ALL SELECT 'applied drizzle migrations', count(*)::text FROM drizzle.__drizzle_migrations
ORDER BY 1;

ROLLBACK;
