import { WeatherProvider } from '@/hooks/useWeatherCache';

export default function ProtectedWeatherProvider({ children }) {
  return <WeatherProvider>{children}</WeatherProvider>;
}
