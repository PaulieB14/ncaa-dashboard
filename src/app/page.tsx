'use client';
import { useEffect, useState, useCallback } from 'react';

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
  paceVsAverage: number;
  overUnderEdge: 'OVER LEAN' | 'UNDER LEAN' | 'NEUTRAL';
  gameTempo: 'HOT 🔥' | 'COLD 🥶' | 'NEUTRAL';
  blowoutRisk: number; // Percentage
}

export default function Home() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchScores = useCallback(async () => {
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
          const totalPoints = parseInt(home?.score || '0') + parseInt(away?.score || '0');
          const pace = minutesPlayed > 0 ? (totalPoints / minutesPlayed) * 40 : 0;
          const minutesRemaining = period <= 1 ? 20 + minutesLeftInPeriod : minutesLeftInPeriod;
          const projectedTotal = Math.round(totalPoints + (pace / 40) * minutesRemaining);

          // --- Betting Enhancements ---
          const averageNCAAPace = 70; // Example average pace for NCAA Men's Basketball
          const paceVsAverage = Math.round(pace - averageNCAAPace);

          let overUnderEdge: 'OVER LEAN' | 'UNDER LEAN' | 'NEUTRAL' = 'NEUTRAL';
          if (projectedTotal > 140 && paceVsAverage > 5) { // Example logic
            overUnderEdge = 'OVER LEAN';
          } else if (projectedTotal < 130 && paceVsAverage < -5) {
            overUnderEdge = 'UNDER LEAN';
          }

          let gameTempo: 'HOT 🔥' | 'COLD 🥶' | 'NEUTRAL' = 'NEUTRAL';
          if (paceVsAverage > 10) {
            gameTempo = 'HOT 🔥';
          } else if (paceVsAverage < -10) {
            gameTempo = 'COLD 🥶';
          }

          const scoreDifference = Math.abs(parseInt(home?.score || '0') - parseInt(away?.score || '0'));
          const blowoutRisk = scoreDifference > 15 ? Math.min(100, (scoreDifference - 15) * 5) : 0; // Example logic

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
            paceVsAverage,
            overUnderEdge,
            gameTempo,
            blowoutRisk,
          };
        });

      setGames(liveGames);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScores();
    const interval = setInterval(fetchScores, 8000);
    return () => clearInterval(interval);
  }, [fetchScores]);

  return (
    <main className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-4xl font-bold text-center mb-2">🏀 Live NCAA Betting Analytics</h1>
      <p className="text-center text-xl text-gray-400 mb-8">Real-time pace analysis & betting insights</p>
      {loading ? (
        <p className="text-center text-xl">Loading live games...</p>
      ) : games.length === 0 ? (
        <p className="text-center text-3xl font-bold text-yellow-300 mt-32">Go build Legos.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
          {games.map((game) => (
            <div key={game.id} className="bg-gray-800 rounded-lg p-6 shadow-lg">
              <div className="text-center text-sm text-gray-400 mb-4">{game.clock}</div>
              
              <div className="space-y-3 mb-6">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-lg">{game.awayTeam}</span>
                  <span className="text-3xl font-bold">{game.awayScore}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-lg">{game.homeTeam}</span>
                  <span className="text-3xl font-bold">{game.homeScore}</span>
                </div>
              </div>

              <div className="space-y-3 mb-4">
                <div className="flex justify-between">
                  <span className="text-gray-300">Current Pace:</span>
                  <span className="font-bold text-yellow-400">{game.pace} pts/40 min</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Projected Final Total:</span>
                  <span className="font-bold text-green-400">{game.projectedTotal}</span>
                </div>
              </div>

              <div className="border-t border-gray-700 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-red-400 text-sm font-semibold">📊 BETTING INSIGHTS</span>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Pace vs Average:</span>
                    <span className={`font-bold ${game.paceVsAverage > 0 ? 'text-green-500' : game.paceVsAverage < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                      {game.paceVsAverage > 0 ? '+' : ''}{game.paceVsAverage}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span>O/U Edge:</span>
                    <span className={`font-bold px-2 py-1 rounded text-xs ${
                      game.overUnderEdge === 'OVER LEAN' ? 'bg-green-600 text-white' : 
                      game.overUnderEdge === 'UNDER LEAN' ? 'bg-blue-600 text-white' : 
                      'bg-gray-600 text-white'
                    }`}>
                      {game.overUnderEdge}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span>Game Tempo:</span>
                    <span className={`font-bold px-2 py-1 rounded text-xs ${
                      game.gameTempo === 'HOT 🔥' ? 'bg-red-600 text-white' : 
                      game.gameTempo === 'COLD 🥶' ? 'bg-blue-600 text-white' : 
                      'bg-gray-600 text-white'
                    }`}>
                      {game.gameTempo}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span>Blowout Risk:</span>
                    <span className={`font-bold ${
                      game.blowoutRisk > 70 ? 'text-red-500' : 
                      game.blowoutRisk > 40 ? 'text-yellow-500' : 
                      'text-green-500'
                    }`}>
                      {game.blowoutRisk}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}