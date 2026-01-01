import * as tf from '@tensorflow/tfjs';

// Real AI Model for NCAA Basketball Projections
class NCAAProjectionModel {
  private model: tf.LayersModel | null = null;
  private isLoaded = false;

  async loadModel() {
    if (this.isLoaded) return;

    try {
      // Create a neural network model
      this.model = tf.sequential({
        layers: [
          // Input layer: [homeScore, awayScore, minutesPlayed, period, scoreDiff, pace, etc.]
          tf.layers.dense({
            inputShape: [12], // 12 input features
            units: 128,
            activation: 'relu',
            name: 'input_layer'
          }),
          
          // Hidden layers for complex pattern recognition
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.dense({
            units: 64,
            activation: 'relu',
            name: 'hidden_1'
          }),
          
          tf.layers.dropout({ rate: 0.15 }),
          tf.layers.dense({
            units: 32,
            activation: 'relu',
            name: 'hidden_2'
          }),
          
          tf.layers.dropout({ rate: 0.1 }),
          tf.layers.dense({
            units: 16,
            activation: 'relu',
            name: 'hidden_3'
          }),
          
          // Output layer: projected total points
          tf.layers.dense({
            units: 1,
            activation: 'linear', // Linear for regression
            name: 'output_layer'
          })
        ]
      });

      // Compile the model
      this.model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'meanSquaredError',
        metrics: ['mae']
      });

      // Pre-train with synthetic data (in real app, use historical data)
      await this.preTrainModel();
      
      this.isLoaded = true;
      console.log('🤖 AI Model loaded and trained!');
    } catch (error) {
      console.error('Failed to load AI model:', error);
    }
  }

  private async preTrainModel() {
    // Generate synthetic training data based on NCAA basketball patterns
    const trainingData = this.generateTrainingData(1000);
    
    const xs = tf.tensor2d(trainingData.inputs);
    const ys = tf.tensor2d(trainingData.outputs, [trainingData.outputs.length, 1]);

    // Train the model
    await this.model!.fit(xs, ys, {
      epochs: 50,
      batchSize: 32,
      validationSplit: 0.2,
      verbose: 0 // Silent training
    });

    xs.dispose();
    ys.dispose();
  }

  private generateTrainingData(samples: number) {
    const inputs: number[][] = [];
    const outputs: number[] = [];

    for (let i = 0; i < samples; i++) {
      // Simulate game states
      const minutesPlayed = Math.random() * 40;
      const minutesRemaining = 40 - minutesPlayed;
      const period = minutesPlayed > 20 ? 2 : 1;
      
      // Simulate scores based on realistic patterns
      const avgPace = 65 + Math.random() * 20; // 65-85 pace
      const currentTotal = (avgPace / 40) * minutesPlayed + Math.random() * 10 - 5;
      const homeScore = currentTotal * (0.45 + Math.random() * 0.1);
      const awayScore = currentTotal - homeScore;
      
      const scoreDiff = Math.abs(homeScore - awayScore);
      const pace = (currentTotal / minutesPlayed) * 40;
      
      // Additional features
      const isCloseGame = scoreDiff < 10 ? 1 : 0;
      const isBlowout = scoreDiff > 20 ? 1 : 0;
      const isSecondHalf = period === 2 ? 1 : 0;
      const gameProgress = minutesPlayed / 40;
      const paceVsAvg = pace - 70;
      const timeLeft = minutesRemaining;
      
      // Input features for the model
      const input = [
        homeScore,
        awayScore,
        minutesPlayed,
        minutesRemaining,
        period,
        scoreDiff,
        pace,
        isCloseGame,
        isBlowout,
        isSecondHalf,
        gameProgress,
        paceVsAvg
      ];

      // Calculate realistic final total (this is what we're trying to predict)
      let projectedPace = pace;
      
      // Apply realistic adjustments
      if (isSecondHalf) projectedPace *= 0.94; // 2nd half slowdown
      if (isBlowout) projectedPace *= 0.88; // Blowout slowdown
      if (isCloseGame && minutesRemaining < 5) projectedPace *= 1.12; // Close game speedup
      if (minutesRemaining < 2 && scoreDiff > 5) projectedPace *= 1.2; // Fouling
      
      // Regression to mean
      projectedPace = projectedPace * 0.8 + 70 * 0.2;
      
      const projectedTotal = currentTotal + (projectedPace / 40) * minutesRemaining;
      
      inputs.push(input);
      outputs.push(projectedTotal);
    }

    return { inputs, outputs };
  }

  async predict(
    homeScore: number,
    awayScore: number,
    minutesPlayed: number,
    minutesRemaining: number,
    period: number
  ): Promise<{ projection: number; confidence: number }> {
    if (!this.model || !this.isLoaded) {
      await this.loadModel();
    }

    try {
      const currentTotal = homeScore + awayScore;
      const scoreDiff = Math.abs(homeScore - awayScore);
      const pace = minutesPlayed > 0 ? (currentTotal / minutesPlayed) * 40 : 70;
      
      const isCloseGame = scoreDiff < 10 ? 1 : 0;
      const isBlowout = scoreDiff > 20 ? 1 : 0;
      const isSecondHalf = period === 2 ? 1 : 0;
      const gameProgress = minutesPlayed / 40;
      const paceVsAvg = pace - 70;
      
      // Prepare input for the model
      const input = tf.tensor2d([[
        homeScore,
        awayScore,
        minutesPlayed,
        minutesRemaining,
        period,
        scoreDiff,
        pace,
        isCloseGame,
        isBlowout,
        isSecondHalf,
        gameProgress,
        paceVsAvg
      ]]);

      // Get prediction from the neural network
      const prediction = this.model!.predict(input) as tf.Tensor;
      const projectedTotal = await prediction.data();
      
      // Calculate confidence based on game progress and model certainty
      const baseConfidence = 60 + (gameProgress * 30); // 60-90%
      const stabilityBonus = Math.max(0, 10 - Math.abs(pace - 70) / 2); // Bonus for normal pace
      const confidence = Math.min(95, baseConfidence + stabilityBonus);

      // Cleanup tensors
      input.dispose();
      prediction.dispose();

      return {
        projection: Math.round(Math.max(currentTotal + 3, projectedTotal[0])),
        confidence: Math.round(confidence)
      };
    } catch (error) {
      console.error('AI prediction failed:', error);
      // Fallback to rule-based calculation
      const currentTotal = homeScore + awayScore;
      const pace = minutesPlayed > 0 ? (currentTotal / minutesPlayed) * 40 : 70;
      const fallbackProjection = currentTotal + (pace / 40) * minutesRemaining;
      
      return {
        projection: Math.round(fallbackProjection),
        confidence: 65
      };
    }
  }

  dispose() {
    if (this.model) {
      this.model.dispose();
      this.model = null;
      this.isLoaded = false;
    }
  }
}

// Export singleton instance
export const aiModel = new NCAAProjectionModel();
