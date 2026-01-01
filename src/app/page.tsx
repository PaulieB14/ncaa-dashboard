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

// Demo data with varied tempo classifications
const demoGames: Game[] = [
  {
    id: 'demo1',
    homeTeam: 'Duke Blue Devils',
    awayTeam: 'North Carolina Tar Heels',
    homeScore: 72,
    awayScore: 68,
    clock: '8:45 - 2nd Half',
    period: 2,
    pace: 82,  // High pace = HOT
    projectedTotal: 145,
    paceVsAverage: 12,  // +12 over average = HOT
    overUnderEdge: 'OVER LEAN',
    gameTempo: 'HOT 🔥',
    blowoutRisk: 15
  },
  {
    id: 'demo2',
    homeTeam: 'Kentucky Wildcats',
    awayTeam: 'Louisville Cardinals',
    homeScore: 45,
    awayScore: 48,
    clock: '12:30 - 2nd Half',
    period: 2,
    pace: 58,  // Low pace = COLD
    projectedTotal: 128,
    paceVsAverage: -12,  // -12 under average = COLD
    overUnderEdge: 'UNDER LEAN',
    gameTempo: 'COLD 🥶',
    blowoutRisk: 5
  },
  {
    id: 'demo3',
    homeTeam: 'Gonzaga Bulldogs',
    awayTeam: 'UCLA Bruins',
    homeScore: 58,
    awayScore: 55,
    clock: '15:22 - 2nd Half',
    period: 2,
    pace: 71,  // Average pace = NEUTRAL
    projectedTotal: 135,
    paceVsAverage: 1,  // +1 over average = NEUTRAL
    overUnderEdge: 'NEUTRAL',
    gameTempo: 'NEUTRAL',
    blowoutRisk: 8
  }
];

export default function Home() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

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

          // --- Enhanced Betting Logic ---
          const averageNCAAPace = 70; // NCAA Men's Basketball average
          const paceVsAverage = Math.round(pace - averageNCAAPace);

          // More nuanced O/U logic
          let overUnderEdge: 'OVER LEAN' | 'UNDER LEAN' | 'NEUTRAL' = 'NEUTRAL';
          if (pace > 75 && projectedTotal > 140) {
            overUnderEdge = 'OVER LEAN';
          } else if (pace < 65 && projectedTotal < 130) {
            overUnderEdge = 'UNDER LEAN';
          } else if (paceVsAverage > 8) {
            overUnderEdge = 'OVER LEAN';
          } else if (paceVsAverage < -8) {
            overUnderEdge = 'UNDER LEAN';
          }

          // Fixed tempo classification
          let gameTempo: 'HOT 🔥' | 'COLD 🥶' | 'NEUTRAL' = 'NEUTRAL';
          if (pace > 78 || paceVsAverage > 10) {
            gameTempo = 'HOT 🔥';
          } else if (pace < 62 || paceVsAverage < -10) {
            gameTempo = 'COLD 🥶';
          }

          const scoreDifference = Math.abs(parseInt(home?.score || '0') - parseInt(away?.score || '0'));
          const blowoutRisk = scoreDifference > 15 ? Math.min(100, (scoreDifference - 15) * 5) : 0;

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

      if (liveGames.length === 0) {
        // No live games, show demo data
        setGames(demoGames);
        setIsDemo(true);
      } else {
        setGames(liveGames);
        setIsDemo(false);
      }
      setLoading(false);
    } catch (err) {
      console.error(err);
      // On error, show demo data
      setGames(demoGames);
      setIsDemo(true);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScores();
    const interval = setInterval(fetchScores, 8000);
    return () => clearInterval(interval);
  }, [fetchScores]);

  const getBadgeClass = (edge: string) => {
    switch (edge) {
      case 'OVER LEAN': return 'insight-badge badge-over';
      case 'UNDER LEAN': return 'insight-badge badge-under';
      default: return 'insight-badge badge-neutral';
    }
  };

  const getTempoBadgeClass = (tempo: string) => {
    if (tempo.includes('HOT')) return 'insight-badge badge-hot';
    if (tempo.includes('COLD')) return 'insight-badge badge-cold';
    return 'insight-badge badge-neutral';
  };

  const getPaceColor = (pace: number) => {
    if (pace > 0) return 'text-green-400';
    if (pace < 0) return 'text-red-400';
    return 'text-gray-400';
  };

  const getBlowoutColor = (risk: number) => {
    if (risk > 70) return 'text-red-400';
    if (risk > 40) return 'text-yellow-400';
    return 'text-green-400';
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 text-white p-8">
      <div className="text-center mb-12">
        <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-orange-400 via-red-500 to-purple-600 bg-clip-text text-transparent">
          🏀 Live NCAA Betting Analytics
        </h1>
        <p className="text-xl text-gray-300 mb-6">Real-time pace analysis & betting insights</p>
        
        {isDemo && (
          <div className="flex justify-center mb-8">
            <span className="demo-badge">
              🎮 DEMO MODE - No live games today
            </span>
          </div>
        )}
      </div>
      
      {loading ? (
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mb-4"></div>
          <p className="text-xl text-gray-300">Loading live games...</p>
        </div>
      ) : games.length === 0 ? (
        <p className="text-center text-3xl font-bold text-yellow-300 mt-32">Go build Legos.</p>
      ) : (
        <div className="game-grid">
          {games.map((game) => (
            <div key={game.id} className="game-card">
              <div className="text-center mb-6">
                <span className="clock-display">{game.clock}</span>
              </div>
              
              <div className="space-y-4 mb-8">
                <div className="flex justify-between items-center">
                  <span className="team-name">{game.awayTeam}</span>
                  <span className="team-score">{game.awayScore}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="team-name">{game.homeTeam}</span>
                  <span className="team-score">{game.homeScore}</span>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="stat-row">
                  <span className="stat-label">Current Pace:</span>
                  <span className="pace-value">{game.pace} pts/40 min</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Projected Final Total:</span>
                  <span className="projected-total">{game.projectedTotal}</span>
                </div>
              </div>

              <div className="insights-header">
                📊 BETTING INSIGHTS
              </div>
              
              <div className="space-y-3">
                <div className="stat-row">
                  <span className="stat-label">Pace vs Average:</span>
                  <span className={`stat-value ${getPaceColor(game.paceVsAverage)}`}>
                    {game.paceVsAverage > 0 ? '+' : ''}{game.paceVsAverage}
                  </span>
                </div>
                
                <div className="stat-row">
                  <span className="stat-label">O/U Edge:</span>
                  <span className={getBadgeClass(game.overUnderEdge)}>
                    {game.overUnderEdge}
                  </span>
                </div>
                
                <div className="stat-row">
                  <span className="stat-label">Game Tempo:</span>
                  <span className={getTempoBadgeClass(game.gameTempo)}>
                    {game.gameTempo}
                  </span>
                </div>
                
                <div className="stat-row">
                  <span className="stat-label">Blowout Risk:</span>
                  <span className={`stat-value ${getBlowoutColor(game.blowoutRisk)}`}>
                    {game.blowoutRisk}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}