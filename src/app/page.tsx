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
  blowoutRisk: number;
  confidence: number; // New: Projection confidence %
}

// Advanced projection algorithm
function calculateAdvancedProjection(
  homeScore: number,
  awayScore: number,
  minutesPlayed: number,
  period: number,
  clockDisplayValue: string
) {
  const totalPoints = homeScore + awayScore;
  const gameLength = 40; // NCAA game length
  
  // Time-based weighting (more accurate as game progresses)
  const timeWeight = Math.min(minutesPlayed / gameLength, 0.95); // Cap at 95%
  
  // Calculate multiple pace metrics
  const currentPace = minutesPlayed > 0 ? (totalPoints / minutesPlayed) * gameLength : 70;
  
  // Period-based pace adjustment (games often slow down in 2nd half)
  let periodAdjustment = 1.0;
  if (period === 2) {
    // 2nd half typically 5-8% slower due to fouls, timeouts, strategy
    periodAdjustment = 0.94;
  }
  
  // Time remaining calculations
  let minutesRemaining;
  if (period === 1) {
    const clockParts = clockDisplayValue ? clockDisplayValue.split(':') : ['0', '00'];
    const minutesLeft = parseInt(clockParts[0]) + parseInt(clockParts[1]) / 60;
    minutesRemaining = 20 + minutesLeft; // Rest of 1st half + all of 2nd half
  } else {
    const clockParts = clockDisplayValue ? clockDisplayValue.split(':') : ['0', '00'];
    minutesRemaining = parseInt(clockParts[0]) + parseInt(clockParts[1]) / 60;
  }
  
  // Advanced pace prediction with multiple factors
  const recentPace = currentPace * periodAdjustment;
  
  // Regression to mean (games tend toward average pace over time)
  const averagePace = 70;
  const regressionFactor = Math.max(0.1, 1 - (minutesPlayed / gameLength) * 0.6);
  const adjustedPace = recentPace * (1 - regressionFactor) + averagePace * regressionFactor;
  
  // Score differential impact (blowouts often slow down)
  const scoreDiff = Math.abs(homeScore - awayScore);
  let blowoutAdjustment = 1.0;
  if (scoreDiff > 15 && minutesPlayed > 25) {
    blowoutAdjustment = 0.88; // Significant slowdown in blowouts
  } else if (scoreDiff > 10 && minutesPlayed > 20) {
    blowoutAdjustment = 0.94; // Moderate slowdown
  }
  
  // Final pace calculation
  const finalPace = adjustedPace * blowoutAdjustment;
  
  // Project remaining points
  const projectedRemainingPoints = (finalPace / gameLength) * minutesRemaining;
  const projectedTotal = Math.round(totalPoints + projectedRemainingPoints);
  
  // Confidence calculation (higher confidence as game progresses)
  const baseConfidence = 50 + (timeWeight * 45); // 50-95% range
  const stabilityBonus = Math.min(15, minutesPlayed * 0.5); // Bonus for game length
  const confidence = Math.min(95, Math.round(baseConfidence + stabilityBonus));
  
  return {
    projectedTotal,
    pace: Math.round(currentPace),
    confidence,
    finalPace: Math.round(finalPace)
  };
}

// Demo data with more realistic projections
const DEMO_GAMES: Game[] = [
  {
    id: 'demo1',
    homeTeam: 'Duke Blue Devils',
    awayTeam: 'North Carolina Tar Heels',
    homeScore: 72,
    awayScore: 68,
    clock: '8:45 - 2nd Half',
    period: 2,
    pace: 82,
    projectedTotal: 152, // More realistic projection
    paceVsAverage: 12,
    overUnderEdge: 'OVER LEAN',
    gameTempo: 'HOT 🔥',
    blowoutRisk: 15,
    confidence: 87
  },
  {
    id: 'demo2',
    homeTeam: 'Kentucky Wildcats',
    awayTeam: 'Louisville Cardinals',
    homeScore: 45,
    awayScore: 48,
    clock: '12:30 - 2nd Half',
    period: 2,
    pace: 58,
    projectedTotal: 118, // Slower pace projection
    paceVsAverage: -12,
    overUnderEdge: 'UNDER LEAN',
    gameTempo: 'COLD 🥶',
    blowoutRisk: 5,
    confidence: 82
  },
  {
    id: 'demo3',
    homeTeam: 'Gonzaga Bulldogs',
    awayTeam: 'UCLA Bruins',
    homeScore: 58,
    awayScore: 55,
    clock: '15:22 - 2nd Half',
    period: 2,
    pace: 71,
    projectedTotal: 138, // Average pace
    paceVsAverage: 1,
    overUnderEdge: 'NEUTRAL',
    gameTempo: 'NEUTRAL',
    blowoutRisk: 8,
    confidence: 79
  },
  {
    id: 'demo4',
    homeTeam: 'Michigan State Spartans',
    awayTeam: 'Purdue Boilermakers',
    homeScore: 61,
    awayScore: 59,
    clock: '6:15 - 2nd Half',
    period: 2,
    pace: 75,
    projectedTotal: 144, // Close game, steady pace
    paceVsAverage: 5,
    overUnderEdge: 'OVER LEAN',
    gameTempo: 'NEUTRAL',
    blowoutRisk: 3,
    confidence: 91
  }
];

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
          
          // Use advanced projection algorithm
          const projection = calculateAdvancedProjection(
            parseInt(home.score || '0'),
            parseInt(away.score || '0'),
            minutesPlayed,
            period,
            comp.status.clockDisplayValue
          );

          // Enhanced betting logic
          const averageNCAAPace = 70;
          const paceVsAverage = Math.round(projection.pace - averageNCAAPace);

          // More sophisticated O/U logic
          let overUnderEdge: 'OVER LEAN' | 'UNDER LEAN' | 'NEUTRAL' = 'NEUTRAL';
          if (projection.projectedTotal > 145 && projection.pace > 75) {
            overUnderEdge = 'OVER LEAN';
          } else if (projection.projectedTotal < 125 && projection.pace < 65) {
            overUnderEdge = 'UNDER LEAN';
          } else if (paceVsAverage > 8 && projection.confidence > 75) {
            overUnderEdge = 'OVER LEAN';
          } else if (paceVsAverage < -8 && projection.confidence > 75) {
            overUnderEdge = 'UNDER LEAN';
          }

          // Enhanced tempo classification
          let gameTempo: 'HOT 🔥' | 'COLD 🥶' | 'NEUTRAL' = 'NEUTRAL';
          if (projection.pace > 78 || paceVsAverage > 10) {
            gameTempo = 'HOT 🔥';
          } else if (projection.pace < 62 || paceVsAverage < -10) {
            gameTempo = 'COLD 🥶';
          }

          const scoreDifference = Math.abs(parseInt(home.score || '0') - parseInt(away.score || '0'));
          const blowoutRisk = scoreDifference > 15 ? Math.min(100, (scoreDifference - 15) * 5) : 0;

          return {
            id: event.id,
            homeTeam: home.team.displayName,
            awayTeam: away.team.displayName,
            homeScore: parseInt(home.score || '0'),
            awayScore: parseInt(away.score || '0'),
            clock: comp.status.type.detail,
            period,
            pace: projection.pace,
            projectedTotal: projection.projectedTotal,
            paceVsAverage,
            overUnderEdge,
            gameTempo,
            blowoutRisk,
            confidence: projection.confidence,
          };
        });

      if (liveGames.length === 0) {
        setGames(DEMO_GAMES);
      } else {
        setGames(liveGames);
      }
      setLoading(false);
    } catch (err) {
      console.error(err);
      setGames(DEMO_GAMES);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScores();
    const interval = setInterval(fetchScores, 8000);
    return () => clearInterval(interval);
  }, [fetchScores]);

  const gamesToDisplay = games.length > 0 ? games : DEMO_GAMES;
  const isDemo = games.length === 0 || games === DEMO_GAMES;

  return (
    <main className=\"main-container\">
      <div className=\"header-container\">
        <h1 className=\"main-title\">🏀 Live NCAA Betting Analytics</h1>
        <div className=\"gradient-line\"></div>
        <p className=\"subtitle\">Advanced AI-powered projections & betting insights</p>
        {isDemo && (
          <p className=\"demo-mode-badge\">🎮 DEMO MODE - No live games today</p>
        )}
      </div>

      {loading && games.length === 0 ? (
        <div className=\"loading-spinner\"></div>
      ) : gamesToDisplay.length === 0 ? (
        <p className=\"no-games-message\">Go build Legos.</p>
      ) : (
        <div className=\"game-grid\">
          {gamesToDisplay.map((game) => (
            <div key={game.id} className=\"game-card\">
              <div className=\"game-clock\">{game.clock}</div>
              <div className=\"team-scores\">
                <div className=\"team-row\">
                  <span className=\"team-name\">{game.awayTeam}</span>
                  <span className=\"score\">{game.awayScore}</span>
                </div>
                <div className=\"team-row\">
                  <span className=\"team-name\">{game.homeTeam}</span>
                  <span className=\"score\">{game.homeScore}</span>
                </div>
              </div>
              <div className=\"game-stats\">
                <div className=\"stat-row\">
                  <span className=\"stat-label\">Current Pace:</span>
                  <span className=\"stat-value pace-value\">{game.pace} pts/40 min</span>
                </div>
                <div className=\"stat-row\">
                  <span className=\"stat-label\">AI Projected Total:</span>
                  <span className=\"stat-value projected-total-value\">
                    {game.projectedTotal}
                    <span className=\"confidence-badge\">({game.confidence}%)</span>
                  </span>
                </div>
                <div className=\"stat-row\">
                  <span className=\"stat-label\">Pace vs Average:</span>
                  <span className={`stat-value pace-vs-average ${game.paceVsAverage > 0 ? 'text-green-300' : game.paceVsAverage < 0 ? 'text-red-300' : 'text-gray-400'}`}>
                    {game.paceVsAverage > 0 ? '+' : ''}{game.paceVsAverage}
                  </span>
                </div>
                <div className=\"stat-row\">
                  <span className=\"stat-label\">O/U Edge:</span>
                  <span className={`stat-value ${game.overUnderEdge === 'OVER LEAN' ? 'text-green-300' : game.overUnderEdge === 'UNDER LEAN' ? 'text-red-300' : 'text-gray-400'}`}>
                    {game.overUnderEdge}
                  </span>
                </div>
                <div className=\"stat-row\">
                  <span className=\"stat-label\">Game Tempo:</span>
                  <span className={`stat-value ${game.gameTempo === 'HOT 🔥' ? 'text-red-300' : game.gameTempo === 'COLD 🥶' ? 'text-blue-300' : 'text-gray-400'}`}>
                    {game.gameTempo}
                  </span>
                </div>
                <div className=\"stat-row\">
                  <span className=\"stat-label\">Blowout Risk:</span>
                  <span className={`stat-value blowout-value ${game.blowoutRisk > 70 ? 'text-red-300' : game.blowoutRisk > 40 ? 'text-yellow-300' : game.blowoutRisk > 15 ? 'text-orange-300' : 'text-green-300'} font-bold`}>
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
}"