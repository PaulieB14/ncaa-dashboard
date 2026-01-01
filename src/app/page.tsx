'use client';
import { useEffect, useState, useCallback } from 'react';
import { aiModel } from './ai-model';

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

// REAL AI PROJECTION using TensorFlow.js Neural Network
async function realAIProjection(
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
      algorithm: 'Fallback',
      minutesRemaining: minutesRemaining,
      projectedPoints: 25
    };
  }
  
  try {
    // 🤖 USE REAL AI MODEL FOR PREDICTION
    const aiPrediction = await aiModel.predict(
      homeScore,
      awayScore,
      minutesPlayed,
      minutesRemaining,
      period
    );
    
    const currentPace = (currentTotal / minutesPlayed) * 40;
    const projectedPoints = aiPrediction.projection - currentTotal;
    
    return {
      projectedTotal: aiPrediction.projection,
      pace: Math.round(currentPace),
      confidence: aiPrediction.confidence,
      algorithm: 'Neural Network AI',
      minutesRemaining: Math.round(minutesRemaining * 10) / 10,
      projectedPoints: Math.round(projectedPoints)
    };
  } catch (error) {
    console.error('AI model failed, using fallback:', error);
    
    // Fallback to rule-based if AI fails
    const currentPace = (currentTotal / minutesPlayed) * 40;
    let adjustedPace = currentPace;
    
    if (period >= 2) adjustedPace *= 0.94;
    
    const scoreDiff = Math.abs(homeScore - awayScore);
    if (scoreDiff > 20) adjustedPace *= 0.85;
    else if (scoreDiff <= 3 && minutesRemaining < 5) adjustedPace *= 1.15;
    
    const projectedRemainingPoints = (adjustedPace / 40) * minutesRemaining;
    const projectedTotal = Math.round(currentTotal + projectedRemainingPoints);
    
    return {
      projectedTotal: Math.max(currentTotal + 5, projectedTotal),
      pace: Math.round(currentPace),
      confidence: 70,
      algorithm: 'Rule-Based Fallback',
      minutesRemaining: Math.round(minutesRemaining * 10) / 10,
      projectedPoints: Math.round(projectedRemainingPoints)
    };
  }
}

export default function Home() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiLoaded, setAiLoaded] = useState(false);

  // Initialize AI model on component mount
  useEffect(() => {
    const initAI = async () => {
      try {
        await aiModel.loadModel();
        setAiLoaded(true);
        console.log('🤖 AI Model ready!');
      } catch (error) {
        console.error('Failed to load AI model:', error);
      }
    };
    
    initAI();
    
    // Cleanup on unmount
    return () => {
      aiModel.dispose();
    };
  }, []);

  const fetchScores = useCallback(async () => {
    try {
      const res = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard');
      const data = await res.json();

      const liveGames: Game[] = await Promise.all(
        data.events
          .filter((event: any) => event.status.type.name !== 'STATUS_FINAL' && event.competitions[0].status.type.detail.includes(' - '))
          .map(async (event: any) => {
            const comp = event.competitions[0];
            const home = comp.competitors.find((c: any) => c.homeAway === 'home');
            const away = comp.competitors.find((c: any) => c.homeAway === 'away');

            const homeScore = parseInt(home?.score || '0');
            const awayScore = parseInt(away?.score || '0');
            const period = comp.status.period;
            const clockDisplay = comp.status.type.detail;

            // Use REAL AI projection
            const projection = await realAIProjection(
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
          })
      );

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
          Real Neural Network AI projections & betting insights
          {aiLoaded && <span className="ai-status"> 🤖 AI Loaded</span>}
        </p>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p className="loading-text">
            {!aiLoaded ? 'Loading AI Model...' : 'Loading live games...'}
          </p>
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
                  <span className="stat-label">{game.algorithm}:</span>
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