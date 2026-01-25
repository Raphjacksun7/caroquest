// FILE: src/components/ai/AIAnalyticsDashboard.tsx
// PURPOSE: Display comprehensive AI learning statistics and controls

"use client";

import React, { useState, useEffect } from "react";
import { getAIStats } from "@/lib/ai/enhancedMCTS";
import { selfPlayTrainer, runQuickTraining, runExtensiveTraining } from "@/lib/ai/selfPlay";
import { neuralEvaluator } from "@/lib/ai/neuralEvaluator";
import { aiLearning } from "@/lib/ai/learning";
import { openingBook } from "@/lib/ai/openingBook";
import { transpositionTable } from "@/lib/ai/transpositionTable";
import { adaptiveDifficulty } from "@/lib/ai/adaptiveDifficulty";
import { redisAdapter } from "@/lib/ai/redisAdapter";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export function AIAnalyticsDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [isTraining, setIsTraining] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState("");

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 2000);
    return () => clearInterval(interval);
  }, []);

  const loadStats = () => {
    const currentStats = getAIStats();
    setStats(currentStats);
  };

  const handleQuickTraining = async () => {
    setIsTraining(true);
    setTrainingProgress("Starting quick training (50 games)...");
    
    try {
      const result = await runQuickTraining(50);
      setTrainingProgress(
        `Training complete! ${result.gamesCompleted} games, ` +
        `P1: ${result.player1Wins}, P2: ${result.player2Wins}, Draws: ${result.draws}`
      );
      loadStats();
    } catch (error) {
      setTrainingProgress(`Error: ${error}`);
    }
    
    setIsTraining(false);
  };

  const handleExtensiveTraining = async () => {
    setIsTraining(true);
    setTrainingProgress("Starting extensive training (200 games)...");
    
    try {
      const result = await runExtensiveTraining(200);
      setTrainingProgress(
        `Training complete! ${result.gamesCompleted} games in ${(result.duration / 1000).toFixed(1)}s`
      );
      loadStats();
    } catch (error) {
      setTrainingProgress(`Error: ${error}`);
    }
    
    setIsTraining(false);
  };

  const handleStopTraining = () => {
    selfPlayTrainer.stop();
    setTrainingProgress("Training stopped by user");
    setIsTraining(false);
  };

  const handleResetLearning = () => {
    if (confirm("Are you sure you want to reset ALL AI learning data?")) {
      aiLearning.clearLearning();
      neuralEvaluator.reset();
      openingBook.reset();
      transpositionTable.clear();
      adaptiveDifficulty.resetMetrics();
      loadStats();
      alert("AI learning data reset successfully");
    }
  };

  const handleExportData = () => {
    const data = aiLearning.exportLearningData();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `caroquest-ai-learning-${Date.now()}.json`;
    a.click();
  };

  const handleImportData = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (file) {
        const text = await file.text();
        const success = aiLearning.importLearningData(text);
        if (success) {
          loadStats();
          alert("AI learning data imported successfully");
        } else {
          alert("Failed to import data");
        }
      }
    };
    input.click();
  };

  if (!stats) {
    return <div className="p-4">Loading AI analytics...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">AI Analytics Dashboard</h1>

      {/* Player Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Player Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-500">Games Played</div>
              <div className="text-2xl font-bold">{stats.player.gamesPlayed}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Win Rate</div>
              <div className="text-2xl font-bold">
                {((stats.player.wins / (stats.player.gamesPlayed || 1)) * 100).toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Estimated ELO</div>
              <div className="text-2xl font-bold">{stats.player.estimatedElo}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Win Streak</div>
              <div className="text-2xl font-bold">{stats.player.winStreak}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Learning Stats */}
      <Card>
        <CardHeader>
          <CardTitle>AI Learning Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-gray-500">Games Recorded</div>
              <div className="text-2xl font-bold">{stats.learning.gamesRecorded}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Patterns Learned</div>
              <div className="text-2xl font-bold">{stats.learning.patternsLearned}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Total Moves Analyzed</div>
              <div className="text-2xl font-bold">{stats.learning.totalMoves}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Neural Network Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Neural Network</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-gray-500">Games Trained</div>
              <div className="text-2xl font-bold">{stats.neuralNetwork.trainedGames}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Training Examples</div>
              <div className="text-2xl font-bold">{stats.neuralNetwork.trainingExamples}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Network Size</div>
              <div className="text-sm">
                {stats.neuralNetwork.networkSize.input} → {stats.neuralNetwork.networkSize.hidden} → 1
              </div>
            </div>
          </div>
          <div className="mt-4">
            <div className="text-sm text-gray-500">Training Progress</div>
            <Progress 
              value={Math.min(100, (stats.neuralNetwork.trainedGames / 500) * 100)} 
              className="mt-2"
            />
            <div className="text-xs text-gray-400 mt-1">
              {stats.neuralNetwork.trainedGames} / 500 games (optimal training)
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Opening Book Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Opening Book</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-500">Total Openings</div>
              <div className="text-2xl font-bold">{stats.openingBook.totalOpenings}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Avg Win Rate</div>
              <div className="text-2xl font-bold">
                {(stats.openingBook.avgWinRate * 100).toFixed(1)}%
              </div>
            </div>
          </div>
          <div className="mt-4">
            <div className="text-sm font-semibold mb-2">Top Openings:</div>
            {stats.openingBook.topOpenings.slice(0, 3).map((opening: any, idx: number) => (
              <div key={idx} className="flex justify-between text-sm mb-1">
                <span>{opening.name}</span>
                <span>{(opening.winRate * 100).toFixed(1)}% ({opening.occurrences} games)</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Transposition Table Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Transposition Table (Cache)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-gray-500">Cached Positions</div>
              <div className="text-2xl font-bold">{stats.transpositionTable.size}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Hit Rate</div>
              <div className="text-2xl font-bold">{stats.transpositionTable.hitRatePercent}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Total Lookups</div>
              <div className="text-2xl font-bold">
                {stats.transpositionTable.hits + stats.transpositionTable.misses}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Training Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Self-Play Training</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                onClick={handleQuickTraining}
                disabled={isTraining}
                variant="default"
              >
                Quick Training (50 games)
              </Button>
              <Button
                onClick={handleExtensiveTraining}
                disabled={isTraining}
                variant="default"
              >
                Extensive Training (200 games)
              </Button>
              {isTraining && (
                <Button
                  onClick={handleStopTraining}
                  variant="destructive"
                >
                  Stop Training
                </Button>
              )}
            </div>
            {trainingProgress && (
              <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                {trainingProgress}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card>
        <CardHeader>
          <CardTitle>Data Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={handleExportData} variant="outline">
              Export Learning Data
            </Button>
            <Button onClick={handleImportData} variant="outline">
              Import Learning Data
            </Button>
            <Button onClick={handleResetLearning} variant="destructive">
              Reset All Learning
            </Button>
            <Button
              onClick={() => transpositionTable.clear()}
              variant="outline"
            >
              Clear Cache
            </Button>
          </div>
          
          <div className="mt-4 p-4 bg-blue-50 rounded">
            <div className="text-sm font-semibold mb-2">Redis Integration</div>
            <div className="text-xs text-gray-600">
              Status: {redisAdapter.isEnabled() ? "✅ Enabled" : "❌ Disabled"}
            </div>
            {!redisAdapter.isEnabled() && (
              <Button
                onClick={() => redisAdapter.enable()}
                size="sm"
                className="mt-2"
              >
                Enable Redis Persistence
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Difficulty Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Performance by Difficulty</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stats.difficulties.map((diff: any) => (
              <div key={diff.name} className="border-b pb-2">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-semibold capitalize">{diff.name}</span>
                  <span className="text-sm text-gray-500">
                    {diff.stats.gamesPlayed} games
                  </span>
                </div>
                <div className="text-sm text-gray-600">
                  Win Rate: {(diff.stats.winRate * 100).toFixed(1)}% |
                  Wins: {diff.stats.wins} |
                  Losses: {diff.stats.losses} |
                  Draws: {diff.stats.draws}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

