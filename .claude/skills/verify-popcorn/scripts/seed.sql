-- verify-popcorn baseline seed. Runs once against the disposable verify DB after migrations.
-- Users are created already-onboarded so journeys start at /app. Sign-in still goes through
-- the real magic-link flow; no sessions are inserted here.
INSERT INTO "user" (id, name, email, email_verified, username, bio, onboarding_completed, created_at, updated_at)
VALUES
  ('vp-user-vera',  'Vera Verify',  'vera@popcorn.test',  true, 'veraverify',  'Verification account', true, NOW(), NOW()),
  ('vp-user-felix', 'Felix Friend', 'felix@popcorn.test', true, 'felixfriend', 'Seeded friend of Vera', true, NOW(), NOW())
ON CONFLICT (email) DO NOTHING;

INSERT INTO friendship (id, requester_id, addressee_id, status, created_at, updated_at)
VALUES ('vp-friendship-vera-felix', 'vp-user-vera', 'vp-user-felix', 'accepted', NOW(), NOW())
ON CONFLICT DO NOTHING;
