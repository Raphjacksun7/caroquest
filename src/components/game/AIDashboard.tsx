// FILE: src/components/game/AIDashboard.tsx
// PURPOSE: Display AI learning statistics and difficulty metrics

"use client";

import React from "react";
import { getAIStats } from "@/lib/ai/enhancedMCTS";
import { adaptiveDifficulty, DIFFICULTY_LEVELS } from "@/lib/ai/adaptiveDifficulty";
import { aiLearning } from "@/lib/ai/learning";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export function AIDashboard() {
  const [stats, setStats] = React.useState<ReturnType<typeof getAIStats> | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);

  React.useEffect(() => {
    setStats(getAIStats());
  }, [refreshKey]);

  if (!stats) return null;

  const { learning, player, difficulties } = stats;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">AI Dashboard</h2>
          <p className="text-muted-foreground">
            Track AI learning progress and your performance
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setRefreshKey((k) => k + 1)}
          >
            Refresh
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (confirm("Clear all AI learning data? This cannot be undone.")) {
                aiLearning.clearLearning();
                adaptiveDifficulty.resetMetrics();
                setRefreshKey((k) => k + 1);
              }
            }}
          >
            Reset AI
          </Button>
        </div>
      </div>

      {/* Player Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Your Performance</CardTitle>
          <CardDescription>
            Track your skill progression and estimated rating
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Games Played</p>
              <p className="text-2xl font-bold">{player.gamesPlayed}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Win Rate</p>
              <p className="text-2xl font-bold">
                {player.gamesPlayed > 0
                  ? ((player.wins / player.gamesPlayed) * 100).toFixed(1)
                  : 0}
                %
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Estimated ELO</p>
              <p className="text-2xl font-bold">{player.estimatedElo}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Win Streak</p>
              <p className="text-2xl font-bold text-green-600">
                {player.winStreak}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Wins</span>
              <span className="font-medium">{player.wins}</span>
            </div>
            <Progress
              value={player.gamesPlayed > 0 ? (player.wins / player.gamesPlayed) * 100 : 0}
              className="h-2"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Move Quality</span>
              <span className="font-medium">
                {(player.avgMoveQuality * 100).toFixed(1)}%
              </span>
            </div>
            <Progress
              value={player.avgMoveQuality * 100}
              className="h-2"
            />
          </div>

          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground mb-2">
              Recommended Difficulty
            </p>
            <Badge variant="secondary" className="text-lg">
              {adaptiveDifficulty.getRecommendedDifficulty().name.toUpperCase()}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* AI Learning Stats */}
      <Card>
        <CardHeader>
          <CardTitle>AI Learning Progress</CardTitle>
          <CardDescription>
            The AI improves by learning from every game
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Games Recorded</p>
              <p className="text-2xl font-bold">{learning.gamesRecorded}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Patterns Learned</p>
              <p className="text-2xl font-bold">{learning.patternsLearned}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Total Moves</p>
              <p className="text-2xl font-bold">{learning.totalMoves}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Learning Active</p>
              <Badge variant={learning.patternsLearned > 100 ? "default" : "outline"}>
                {learning.patternsLearned > 100 ? "Active" : "Building"}
              </Badge>
            </div>
          </div>

          {learning.oldestGame && learning.newestGame && (
            <div className="pt-4 border-t text-sm text-muted-foreground">
              <p>
                Learning span:{" "}
                {Math.ceil(
                  (learning.newestGame - learning.oldestGame) / (1000 * 60 * 60 * 24)
                )}{" "}
                days
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Difficulty Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Performance by Difficulty</CardTitle>
          <CardDescription>
            Your record against each AI difficulty level
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {difficulties.map(({ name, config, stats: diffStats }) => (
              <div key={name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={
                        name === "easy"
                          ? "secondary"
                          : name === "medium"
                          ? "default"
                          : name === "hard"
                          ? "destructive"
                          : "outline"
                      }
                      className="w-20 justify-center"
                    >
                      {name.toUpperCase()}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {config.description}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {diffStats.gamesPlayed} games
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {diffStats.gamesPlayed > 0
                        ? `${((diffStats.wins / diffStats.gamesPlayed) * 100).toFixed(1)}% win rate`
                        : "No games"}
                    </p>
                  </div>
                </div>
                {diffStats.gamesPlayed > 0 && (
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Progress
                        value={
                          (diffStats.wins / diffStats.gamesPlayed) * 100
                        }
                        className="h-2"
                      />
                    </div>
                    <div className="flex gap-2 text-xs">
                      <span className="text-green-600">
                        W: {diffStats.wins}
                      </span>
                      <span className="text-red-600">
                        L: {diffStats.losses}
                      </span>
                      <span className="text-gray-600">
                        D: {diffStats.draws}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Export/Import */}
      <Card>
        <CardHeader>
          <CardTitle>Data Management</CardTitle>
          <CardDescription>
            Export or import AI learning data
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              const data = aiLearning.exportLearningData();
              const blob = new Blob([data], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `caroquest-ai-learning-${Date.now()}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Export Learning Data
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = ".json";
              input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    const data = event.target?.result as string;
                    if (aiLearning.importLearningData(data)) {
                      alert("Learning data imported successfully!");
                      setRefreshKey((k) => k + 1);
                    } else {
                      alert("Failed to import learning data.");
                    }
                  };
                  reader.readAsText(file);
                }
              };
              input.click();
            }}
          >
            Import Learning Data
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

