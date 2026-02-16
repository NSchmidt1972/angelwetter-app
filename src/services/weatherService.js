// src/services/weatherService.js
import { supabase } from "../supabaseClient";
import { getActiveClubId } from '@/utils/clubId';

export async function getLatestWeather() {
  const clubId = getActiveClubId();
  const { data: weatherRow, error } = await supabase
    .from("weather_cache")
    .select("data")
    .eq('club_id', clubId)
    .eq("id", "latest")
    .single();

  if (error || !weatherRow?.data) throw error || new Error("No weather data");
  const { current, daily } = weatherRow.data;
  if (!current || !daily) throw new Error("Weather data incomplete");
  return { current, daily };
}
