import { useEffect, useState } from 'react';

interface Game {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  clock: string;
  period: number;
  pace: number;
  projectedTotal: number;
}

export default function Home() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchScores = async () => {
    try {
      const res = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard');
      const data = await res.json();

      const liveGames: Game[] = data.events
        .filter((event: any) => event.status.type.name !== 'STATUS_FINAL' && event.competitions[0].status.type.detail.includes(' - '))
        .map((event: any) => {
          const comp = event.competitions[0];
          const home = comp.competitors.find((c: any) => c.homeAway === 'home');
          const away = comp.competitors.find((c: any) => c.homeAway === 'away');

          const clockParts = comp.status.clockDisplayValue ? comp.status.clockDisplayValue.split(':') : ['0', '00'];
          const minutesLeftInPeriod = parseInt(clockParts[0]) + parseInt(clockParts[1]) / 60;
          const period = comp.status.period;

          const minutesPlayed = period <= 1 ? (20 - minutesLeftInPeriod) : (40 - minutesLeftInPeriod);
          const totalPoints = (home?.score || 0) + (away?.score || 0);
          const pace = minutesPlayed > 0 ? (totalPoints / minutesPlayed) * 40 : 0;
          const minutesRemaining = period <= 1 ? 20 + minutesLeftInPeriod : minutesLeftInPeriod;
          const projectedTotal = Math.round(totalPoints + (pace / 40) * minutesRemaining);

          return {
            id: event.id,
            homeTeam: home.team.displayName,
            awayTeam: away.team.displayName,
            homeScore: parseInt(home.score || '0'),
            awayScore: parseInt(away.score || '0'),
            clock: comp.status.type.detail,
            period,
            pace: Math.round(pace),
            projectedTotal,
          };
        });

      setGames(liveGames);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScores();
    const interval = setInterval(fetchScores, 8000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-4xl font-bold text-center mb-8">Live NCAA Men's Basketball Pace Dashboard</h1>
      {loading ? (
        <p className="text-center text-xl">Loading live games...</p>
      ) : games.length === 0 ? (
        <p className="text-center text-3xl font-bold text-yellow-300 mt-32">Go build Legos.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
          {games.map((game) => (
            <div key={game.id} className="bg-gray-800 rounded-lg p-6 shadow-lg">
              <div className="text-center text-sm text-gray-400 mb-2">{game.clock}</div>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">{game.awayTeam}</span>
                  <span className="text-2xl font-bold">{game.awayScore}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-semibold">{game.homeTeam}</span>
                  <span className="text-2xl font-bold">{game.homeScore}</span>
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-gray-700 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Current Pace:</span>
                  <span className="font-bold text-yellow-400">{game.pace} pts/40 min</span>
                </div>
                <div className="flex justify-between">
                  <span>Projected Final Total:</span>
                  <span className="font-bold text-green-400">{game.projectedTotal}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
