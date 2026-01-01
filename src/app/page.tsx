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
  minutesRemaining: number;
  projectedPoints: number;
}

// Simplified AI-like projection (no TensorFlow dependency issues)
function smartAIProjection(
  homeScore: number,
  awayScore: number,
  clockDisplayValue: string,
  period: number,
  homeTeam: string,
  awayTeam: string
) {
  const currentTotal = homeScore + awayScore;
  
  // Parse time remaining
  let minutesRemaining = 0;
  let minutesPlayed = 0;
  
  if (clockDisplayValue && clockDisplayValue.includes(':')) {
    const timePart = clockDisplayValue.split(' - ')[0];
    const [mins, secs] = timePart.split(':').map(Number);
    const timeLeftInPeriod = mins + (secs || 0) / 60;
    
    if (period === 1) {
      minutesPlayed = 20 - timeLeftInPeriod;
      minutesRemaining = timeLeftInPeriod + 20;
    } else if (period === 2) {
      minutesPlayed = 20 + (20 - timeLeftInPeriod);
      minutesRemaining = timeLeftInPeriod;
    } else {
      minutesPlayed = 40 + ((period - 2) * 5) + (5 - timeLeftInPeriod);
      minutesRemaining = timeLeftInPeriod;
    }
  } else {
    minutesPlayed = period === 1 ? 10 : 30;
    minutesRemaining = period === 1 ? 30 : 10;
  }
  
  if (minutesPlayed <= 0 || minutesRemaining <= 0) {
    return {
      projectedTotal: currentTotal + 25,
      pace: 70,
      confidence: 55,
      algorithm: 'Smart AI',
      minutesRemaining: minutesRemaining,
      projectedPoints: 25
    };
  }
  
  // Advanced multi-factor calculation (AI-like without TensorFlow)
  const currentPace = (currentTotal / minutesPlayed) * 40;
  let adjustedPace = currentPace;
  
  // Factor 1: Game flow analysis
  const gameProgress = minutesPlayed / 40;
  const scoreDiff = Math.abs(homeScore - awayScore);
  
  // Factor 2: Period-based adjustments
  if (period >= 2) {
    adjustedPace *= (0.94 - (gameProgress * 0.03)); // Progressive slowdown
  }
  
  // Factor 3: Score differential impact (AI pattern recognition)
  if (scoreDiff > 20) {
    adjustedPace *= (0.82 - (scoreDiff / 200)); // Severe blowout slowdown
  } else if (scoreDiff > 12) {
    adjustedPace *= (0.91 - (scoreDiff / 300)); // Moderate blowout
  } else if (scoreDiff <= 3 && minutesRemaining < 5) {
    adjustedPace *= (1.18 + (5 - minutesRemaining) * 0.02); // Close game acceleration
  }
  
  // Factor 4: Late game fouling strategy
  if (minutesRemaining < 2 && scoreDiff > 4 && scoreDiff < 15) {
    adjustedPace *= (1.25 + (2 - minutesRemaining) * 0.1); // Fouling increases pace
  }
  
  // Factor 5: Team-specific adjustments (simulated ML)
  const teamMultiplier = getTeamPaceMultiplier(homeTeam, awayTeam);
  adjustedPace *= teamMultiplier;
  
  // Factor 6: Regression to mean with confidence weighting
  const avgPace = 70;
  const regressionWeight = Math.min(0.25, gameProgress * 0.3);
  adjustedPace = adjustedPace * (1 - regressionWeight) + avgPace * regressionWeight;
  
  // Factor 7: Momentum and variance analysis
  const paceVariance = Math.abs(currentPace - avgPace);
  const momentumFactor = 1 + (paceVariance / 100) * (gameProgress > 0.7 ? -0.5 : 0.2);
  adjustedPace *= momentumFactor;
  
  // Calculate projection
  const projectedRemainingPoints = (adjustedPace / 40) * minutesRemaining;
  const projectedTotal = Math.round(currentTotal + projectedRemainingPoints);
  
  // AI-style confidence calculation
  const baseConfidence = 60 + (gameProgress * 30); // 60-90%
  const stabilityBonus = Math.max(0, 10 - paceVariance / 3); // Bonus for stable pace
  const dataQualityBonus = Math.min(8, minutesPlayed / 5); // More data = higher confidence
  const finalConfidence = Math.min(95, Math.round(baseConfidence + stabilityBonus + dataQualityBonus));
  
  return {
    projectedTotal: Math.max(currentTotal + 3, projectedTotal),
    pace: Math.round(currentPace),
    confidence: finalConfidence,
    algorithm: 'Smart AI',
    minutesRemaining: Math.round(minutesRemaining * 10) / 10,
    projectedPoints: Math.round(projectedRemainingPoints)
  };
}

// Simulated team pace factors (AI-like analysis)
function getTeamPaceMultiplier(homeTeam: string, awayTeam: string): number {
  const teamFactors: { [key: string]: number } = {
    // High-pace teams
    'Duke': 1.08, 'North Carolina': 1.05, 'Gonzaga': 1.04, 'Auburn': 1.07,
    'Houston': 1.03, 'Arizona': 1.06, 'UCLA': 1.02, 'Kansas': 1.04,
    
    // Defensive/slower teams  
    'Virginia': 0.88, 'Wisconsin': 0.91, 'Michigan State': 0.94, 'Purdue': 0.96,
    'Kentucky': 0.92, 'Louisville': 0.89, 'Tennessee': 0.93, 'Texas Tech': 0.90,
    
    // Balanced teams
    'Villanova': 0.98, 'Michigan': 0.99, 'Ohio State': 1.01, 'Illinois': 1.00
  };
  
  // Extract team names for matching
  const getTeamKey = (fullName: string) => {
    const words = fullName.split(' ');
    return words.find(word => teamFactors[word]) || 'Unknown';
  };
  
  const homeKey = getTeamKey(homeTeam);
  const awayKey = getTeamKey(awayTeam);
  
  const homeFactor = teamFactors[homeKey] || 1.0;
  const awayFactor = teamFactors[awayKey] || 1.0;
  
  // Combined team effect with home court advantage
  return ((homeFactor * 1.02) + awayFactor) / 2; // Slight home advantage
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

          const homeScore = parseInt(home?.score || '0');
          const awayScore = parseInt(away?.score || '0');
          const period = comp.status.period;
          const clockDisplay = comp.status.type.detail;

          // Use Smart AI projection (no TensorFlow issues)
          const projection = smartAIProjection(
            homeScore,
            awayScore,
            clockDisplay,
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

      setGames(liveGames);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setGames([]);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScores();
    const interval = setInterval(fetchScores, 8000);
    return () => clearInterval(interval);
  }, [fetchScores]);

  return (
    <main className="main-container">
      <div className="header-container">
        <h1 className="main-title">🏀 Live NCAA Betting Analytics</h1>
        <div className="gradient-line"></div>
        <p className="subtitle">
          Smart AI projections & betting insights
        </p>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading live games...</p>
        </div>
      ) : games.length === 0 ? (
        <div className="no-games-container">
          <p className="no-games-message">No live games currently</p>
          <p className="no-games-subtitle">Check back during game time for live AI projections!</p>
        </div>
      ) : (
        <div className="game-grid">
          {games.map((game) => (
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
                  <span className="stat-label">AI Projected +Points:</span>
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