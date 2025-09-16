// src/types/viewing.ts — empty skeleton file for copy & paste
export type Ratings = Record<string, number>;

export type Movie = {
  id?: number | string;
  title?: string;
  release_date?: string;
  release_year?: string | number;
  genres?: Array<{ id?: number; name: string }>;
  runtime?: number;
  overview?: string;
  poster_path?: string;
  imdb_id?: string;
  imdb_rating?: number;
  imdb_votes?: number;
  tmdb_vote_average?: number;
  tmdb_vote_count?: number;
  production_countries?: Array<{ iso_3166_1: string; name: string }>;
  origin_country?: string[];
  omdb?: { Country?: string };
  primary_country?: string; // dopo normalizeSingleCountry
};

export type Viewing = {
  id: any;
  started_at?: string;
  picked_by?: string;
  opened_by?: string;
  ratings?: Ratings;
  movie: Movie;
};
