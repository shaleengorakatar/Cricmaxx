-- Drop and recreate friend_profiles with 'name' column
DROP VIEW IF EXISTS friend_profiles;
CREATE VIEW friend_profiles AS
SELECT 
  id,
  username,
  display_name,
  name,
  avatar_url,
  rating_score,
  predictions_total,
  predictions_correct,
  share_trades_with_friends,
  last_active_at
FROM profiles p
WHERE EXISTS (
  SELECT 1 FROM friendships f
  WHERE f.status = 'accepted'
    AND (
      (f.user_id = auth.uid() AND f.friend_id = p.id)
      OR (f.friend_id = auth.uid() AND f.user_id = p.id)
    )
);

-- Drop and recreate leaderboard_profiles with 'name' column
DROP VIEW IF EXISTS leaderboard_profiles;
CREATE VIEW leaderboard_profiles AS
SELECT 
  id,
  username,
  display_name,
  name,
  avatar_url,
  rating_score,
  predictions_total,
  predictions_correct,
  show_on_leaderboard
FROM profiles
WHERE show_on_leaderboard = true;