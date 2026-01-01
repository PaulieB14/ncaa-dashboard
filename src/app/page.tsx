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
  confidence: number;
  algorithm: string;
  minutesRemaining: number; // Debug field
  projectedPoints: number; // Debug field
}

// FIXED: Real projection that actually calculates future points
function calculateRealProjection(
  homeScore: number,
  awayScore: number,
  clockDisplayValue: string,
  period: number,
  homeTeam: string,
  awayTeam: string
) {
  const currentTotal = homeScore + awayScore;
  
  // STEP 1: Parse the actual time remaining from ESPN format
  let minutesRemaining = 0;
  let minutesPlayed = 0;
  
  // Handle different clock formats from ESPN
  if (clockDisplayValue && clockDisplayValue.includes(':')) {
    const timePart = clockDisplayValue.split(' - ')[0]; // Get "8:09" from "8:09 - 2nd Half"
    const [mins, secs] = timePart.split(':').map(Number);
    const timeLeftInPeriod = mins + (secs || 0) / 60;
    
    if (period === 1) {
      // First half: 20 minutes total
      minutesPlayed = 20 - timeLeftInPeriod;
      minutesRemaining = timeLeftInPeriod + 20; // Rest of 1st + all of 2nd
    } else if (period === 2) {
      // Second half: Calculate total game time
      minutesPlayed = 20 + (20 - timeLeftInPeriod); // All 1st + elapsed 2nd
      minutesRemaining = timeLeftInPeriod; // Just time left in 2nd
    } else {
      // Overtime or other periods
      minutesPlayed = 40 + ((period - 2) * 5) + (5 - timeLeftInPeriod);
      minutesRemaining = timeLeftInPeriod;
    }
  } else {
    // Fallback if clock parsing fails
    minutesPlayed = period === 1 ? 10 : 30;
    minutesRemaining = period === 1 ? 30 : 10;
  }
  
  // Ensure we have valid time data
  if (minutesPlayed <= 0 || minutesRemaining <= 0) {
    return {
      projectedTotal: currentTotal + 30, // Conservative fallback
      pace: 70,
      confidence: 50,
      algorithm: 'Fallback',
      minutesRemaining: minutesRemaining,
      projectedPoints: 30
    };
  }
  
  // STEP 2: Calculate current pace (points per 40 minutes)
  const currentPace = (currentTotal / minutesPlayed) * 40;
  
  // STEP 3: Adjust pace based on game situation
  let adjustedPace = currentPace;
  
  // Second half slowdown (games typically slow 5-8%)
  if (period >= 2) {
    adjustedPace *= 0.94;
  }
  
  // Score differential effects
  const scoreDiff = Math.abs(homeScore - awayScore);
  if (scoreDiff > 20) {
    adjustedPace *= 0.85; // Big blowouts slow way down
  } else if (scoreDiff > 12) {
    adjustedPace *= 0.92; // Moderate blowouts slow down
  } else if (scoreDiff <= 3 && minutesRemaining < 5) {
    adjustedPace *= 1.15; // Close games speed up late
  }
  
  // Late game fouling (final 2 minutes of close games)
  if (minutesRemaining < 2 && scoreDiff > 4 && scoreDiff < 15) {
    adjustedPace *= 1.25; // Fouling strategy speeds up games
  }
  
  // Regression to mean (extreme paces normalize)
  const avgPace = 70;
  const regressionWeight = Math.min(0.3, minutesPlayed / 40);
  adjustedPace = adjustedPace * (1 - regressionWeight) + avgPace * regressionWeight;
  
  // STEP 4: Calculate projected remaining points
  const projectedRemainingPoints = (adjustedPace / 40) * minutesRemaining;
  
  // STEP 5: Final projection
  const projectedTotal = Math.round(currentTotal + projectedRemainingPoints);
  
  // STEP 6: Confidence calculation
  const gameProgress = minutesPlayed / (minutesPlayed + minutesRemaining);
  const baseConfidence = 55 + (gameProgress * 35); // 55-90%
  
  // Confidence adjustments
  let confidenceBonus = 0;
  if (Math.abs(currentPace - avgPace) < 15) confidenceBonus += 8; // Stable pace
  if (minutesPlayed > 25) confidenceBonus += 7; // Enough data
  if (scoreDiff < 25) confidenceBonus += 5; // Competitive game
  
  const finalConfidence = Math.min(95, Math.round(baseConfidence + confidenceBonus));
  
  return {
    projectedTotal: Math.max(currentTotal + 5, projectedTotal), // Always project at least 5 more points
    pace: Math.round(currentPace),
    confidence: finalConfidence,
    algorithm: 'Time-Based AI',
    minutesRemaining: Math.round(minutesRemaining * 10) / 10,
    projectedPoints: Math.round(projectedRemainingPoints)
  };
}

// Demo data with REAL time-based projections
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
    projectedTotal: 158, // 140 current + 18 more points in 8:45
    paceVsAverage: 12,
    overUnderEdge: 'OVER LEAN',
    gameTempo: 'HOT 🔥',
    blowoutRisk: 15,
    confidence: 87,
    algorithm: 'Time-Based AI',
    minutesRemaining: 8.75,
    projectedPoints: 18
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
    projectedTotal: 111, // 93 current + 18 more points in 12:30
    paceVsAverage: -12,
    overUnderEdge: 'UNDER LEAN',
    gameTempo: 'COLD 🥶',
    blowoutRisk: 5,
    confidence: 82,
    algorithm: 'Time-Based AI',
    minutesRemaining: 12.5,
    projectedPoints: 18
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
    projectedTotal: 140, // 113 current + 27 more points in 15:22
    paceVsAverage: 1,
    overUnderEdge: 'NEUTRAL',
    gameTempo: 'NEUTRAL',
    blowoutRisk: 8,
    confidence: 79,
    algorithm: 'Time-Based AI',
    minutesRemaining: 15.37,
    projectedPoints: 27
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
    projectedTotal: 132, // 120 current + 12 more points in 6:15
    paceVsAverage: 5,
    overUnderEdge: 'NEUTRAL',
    gameTempo: 'NEUTRAL',
    blowoutRisk: 3,
    confidence: 91,
    algorithm: 'Time-Based AI',
    minutesRemaining: 6.25,
    projectedPoints: 12
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

          const homeScore = parseInt(home?.score || '0');
          const awayScore = parseInt(away?.score || '0');
          const period = comp.status.period;
          const clockDisplay = comp.status.type.detail;

          // Use FIXED projection algorithm
          const projection = calculateRealProjection(
            homeScore,
            awayScore,
            clockDisplay, // Use the full clock display
            period,
            home?.team.displayName || 'Unknown',
            away?.team.displayName || 'Unknown'
          );

          const averageNCAAPace = 70;
          const paceVsAverage = Math.round(projection.pace - averageNCAAPace);

          let overUnderEdge: 'OVER LEAN' | 'UNDER LEAN' | 'NEUTRAL' = 'NEUTRAL';
          if (projection.projectedTotal > 145 && projection.confidence > 80) {
            overUnderEdge = 'OVER LEAN';
          } else if (projection.projectedTotal < 125 && projection.confidence > 80) {
            overUnderEdge = 'UNDER LEAN';
          } else if (paceVsAverage > 8 && projection.confidence > 75) {
            overUnderEdge = 'OVER LEAN';
          } else if (paceVsAverage < -8 && projection.confidence > 75) {
            overUnderEdge = 'UNDER LEAN';
          }

          let gameTempo: 'HOT 🔥' | 'COLD 🥶' | 'NEUTRAL' = 'NEUTRAL';
          if (projection.pace > 78 || paceVsAverage > 10) {
            gameTempo = 'HOT 🔥';
          } else if (projection.pace < 62 || paceVsAverage < -10) {
            gameTempo = 'COLD 🥶';
          }

          const scoreDifference = Math.abs(homeScore - awayScore);
          const blowoutRisk = scoreDifference > 15 ? Math.min(100, (scoreDifference - 15) * 5) : 0;

          return {
            id: event.id,
            homeTeam: home?.team.displayName || 'Unknown',
            awayTeam: away?.team.displayName || 'Unknown',
            homeScore,
            awayScore,
            clock: clockDisplay,
            period,
            pace: projection.pace,
            projectedTotal: projection.projectedTotal,
            paceVsAverage,
            overUnderEdge,
            gameTempo,
            blowoutRisk,
            confidence: projection.confidence,
            algorithm: projection.algorithm,
            minutesRemaining: projection.minutesRemaining,
            projectedPoints: projection.projectedPoints,
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
    <main className="main-container">
      <div className="header-container">
        <h1 className="main-title">🏀 Live NCAA Betting Analytics</h1>
        <div className="gradient-line"></div>
        <p className="subtitle">Time-based AI projections & betting insights</p>
        {isDemo && (
          <p className="demo-mode-badge">🎮 DEMO MODE - No live games today</p>
        )}
      </div>

      {loading && games.length === 0 ? (
        <div className="loading-spinner"></div>
      ) : gamesToDisplay.length === 0 ? (
        <p className="no-games-message">Go build Legos.</p>
      ) : (
        <div className="game-grid">
          {gamesToDisplay.map((game) => (
            <div key={game.id} className="game-card">
              <div className="game-clock">{game.clock}</div>
              <div className="team-scores">
                <div className="team-row">
                  <span className="team-name">{game.awayTeam}</span>
                  <span className="score">{game.awayScore}</span>
                </div>
                <div className="team-row">
                  <span className="team-name">{game.homeTeam}</span>
                  <span className="score">{game.homeScore}</span>
                </div>
              </div>
              <div className="game-stats">
                <div className="stat-row">
                  <span className="stat-label">Current Pace:</span>
                  <span className="stat-value pace-value">{game.pace} pts/40 min</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">{game.algorithm} Projection:</span>
                  <span className="stat-value projected-total-value">
                    {game.projectedTotal}
                    <span className="confidence-badge">({game.confidence}%)</span>
                  </span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Current Total:</span>
                  <span className="stat-value current-total-value">
                    {game.homeScore + game.awayScore}
                  </span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Time Remaining:</span>
                  <span className="stat-value time-remaining-value">
                    {game.minutesRemaining} min
                  </span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Projected +Points:</span>
                  <span className="stat-value projected-points-value">
                    +{game.projectedPoints}
                  </span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Pace vs Average:</span>
                  <span className={`stat-value pace-vs-average ${game.paceVsAverage > 0 ? 'text-green-300' : game.paceVsAverage < 0 ? 'text-red-300' : 'text-gray-400'}`}>
                    {game.paceVsAverage > 0 ? '+' : ''}{game.paceVsAverage}
                  </span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">O/U Edge:</span>
                  <span className={`stat-value ${game.overUnderEdge === 'OVER LEAN' ? 'text-green-300' : game.overUnderEdge === 'UNDER LEAN' ? 'text-red-300' : 'text-gray-400'}`}>
                    {game.overUnderEdge}
                  </span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Game Tempo:</span>
                  <span className={`stat-value ${game.gameTempo === 'HOT 🔥' ? 'text-red-300' : game.gameTempo === 'COLD 🥶' ? 'text-blue-300' : 'text-gray-400'}`}>
                    {game.gameTempo}
                  </span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Blowout Risk:</span>
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
}