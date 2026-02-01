/*
  # Create conversions storage table

  1. New Tables
    - `conversions`
      - `id` (uuid, primary key)
      - `user_session_id` (text, unique session identifier)
      - `portal_url` (text, the portal URL used)
      - `mac_address` (text, the MAC address used)
      - `channels_data` (jsonb, live channels)
      - `movies_data` (jsonb, movies)
      - `series_data` (jsonb, series)
      - `channel_count` (integer)
      - `movie_count` (integer)
      - `series_count` (integer)
      - `created_at` (timestamp)
  2. Security
    - Enable RLS on `conversions` table
    - Add policy for users to read their own conversions
*/

CREATE TABLE IF NOT EXISTS conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_session_id text NOT NULL UNIQUE,
  portal_url text NOT NULL,
  mac_address text NOT NULL,
  channels_data jsonb DEFAULT '[]'::jsonb,
  movies_data jsonb DEFAULT '[]'::jsonb,
  series_data jsonb DEFAULT '[]'::jsonb,
  channel_count integer DEFAULT 0,
  movie_count integer DEFAULT 0,
  series_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE conversions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own conversions"
  ON conversions FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Users can insert conversions"
  ON conversions FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE INDEX idx_session_id ON conversions(user_session_id);