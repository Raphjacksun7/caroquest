"use client";

import React, { useEffect } from "react";
import type { GameMode, AIDifficulty } from "@/lib/types";
import { useTranslation } from "@/hooks/useTranslation";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, Users, Wifi, Copy, Link as LinkIcon, Loader2 } from "lucide-react";

export interface SelectGameModeScreenProps {
  onStartGameMode: (mode: GameMode) => void;
  player1Name: string;
  setPlayer1Name: (name: string) => void;
  player2Name: string;
  setPlayer2Name: (name: string) => void;
  remotePlayerNameInput: string;
  setRemotePlayerNameInput: (name: string) => void;
  remoteGameIdInput: string;
  setRemoteGameIdInput: (id: string) => void;
  aiDifficulty: AIDifficulty;
  setAiDifficulty: (difficulty: AIDifficulty) => void;
  isConnecting: boolean;
  gameConnectionError?: string | null;
}

export const SelectGameModeScreen: React.FC<SelectGameModeScreenProps> = ({
  onStartGameMode,
  player1Name,
  setPlayer1Name,
  player2Name,
  setPlayer2Name,
  remotePlayerNameInput,
  setRemotePlayerNameInput,
  remoteGameIdInput,
  setRemoteGameIdInput,
  aiDifficulty,
  setAiDifficulty,
  isConnecting,
  gameConnectionError,
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();

  // This useEffect for loading playerName from localStorage is now handled in useGameSetup.
  // If SelectGameModeScreen needs to react to it for other reasons, it could be kept,
  // but for just setting initial values, useGameSetup is the source of truth.

  const handleRemoteAction = () => {
    if (!remotePlayerNameInput.trim()) {
      toast({
        title: t("errorTitle"),
        description: t("playerNameRequired"),
        variant: "destructive",
      });
      return;
    }
    if (typeof window !== "undefined") {
      localStorage.setItem("playerName", remotePlayerNameInput.trim());
    }
    onStartGameMode("remote");
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-background to-secondary p-4 sm:p-6 md:p-8">
      <Card className="w-full max-w-lg shadow-2xl bg-card rounded-xl overflow-hidden">
        <CardHeader className="text-center p-6 sm:p-8 bg-primary/10">
          <CardTitle className="text-3xl sm:text-4xl font-bold text-primary tracking-tight">
            {t("diagonalDomination")}
          </CardTitle>
          <CardDescription className="text-muted-foreground text-sm sm:text-base">
            {t("chooseHowToPlay")}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 sm:p-8 space-y-6">
          <Tabs defaultValue="local" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-muted p-1 rounded-lg">
              <TabsTrigger value="local" /* ...props */ > {/* ELIDED for brevity based on original */}
                <Users className="mr-2 h-5 w-5 inline-block" />{t("localTwoPlayer")}
              </TabsTrigger>
              <TabsTrigger value="ai" /* ...props */ >  {/* ELIDED for brevity based on original */}
                <Bot className="mr-2 h-5 w-5 inline-block" />{t("playVsAI")}
              </TabsTrigger>
              <TabsTrigger value="remote" /* ...props */ >  {/* ELIDED for brevity based on original */}
                <Wifi className="mr-2 h-5 w-5 inline-block" />{t("gameModeRemote")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="local" className="pt-6 space-y-4">
              {/* Content for Local Tab from original code */}
              <div className="space-y-2">
                <Label htmlFor="player1NameLocal" className="text-foreground/80">{t("player1Name")}</Label>
                <Input id="player1NameLocal" value={player1Name} onChange={(e) => setPlayer1Name(e.target.value)} placeholder={t("player1Name")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="player2NameLocal" className="text-foreground/80">{t("player2Name")}</Label>
                <Input id="player2NameLocal" value={player2Name} onChange={(e) => setPlayer2Name(e.target.value)} placeholder={t("player2Name")} />
              </div>
              <Button onClick={() => onStartGameMode("local")} className="w-full">
                <Users className="mr-2 h-5 w-5" />{t("startGame")}
              </Button>
            </TabsContent>

            <TabsContent value="ai" className="pt-6 space-y-4">
              {/* Content for AI Tab from original code */}
              <div className="space-y-2">
                <Label htmlFor="playerNameAI" className="text-foreground/80">{t("yourName")}</Label>
                <Input id="playerNameAI" value={player1Name} onChange={(e) => setPlayer1Name(e.target.value)} placeholder={t("enterYourName")} />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground/80">{t("aiDifficulty")}</Label>
                <RadioGroup value={aiDifficulty} onValueChange={(v: string) => setAiDifficulty(v as AIDifficulty)} className="flex space-x-2"> {/* ELIDED for brevity */}
                  {(["easy", "medium", "hard"] as AIDifficulty[]).map((d) => (
                    <Label key={d} htmlFor={`diff-${d}`} /* ...props */> {/* ELIDED for brevity */}
                      <RadioGroupItem value={d} id={`diff-${d}`} /> <span className="capitalize text-sm">{t(d)}</span>
                    </Label>
                  ))}
                </RadioGroup>
              </div>
              <Button onClick={() => onStartGameMode("ai")} className="w-full">
                <Bot className="mr-2 h-5 w-5" />{t("startGame")}
              </Button>
            </TabsContent>

            <TabsContent value="remote" className="pt-6 space-y-4">
              {/* Content for Remote Tab from original code */}
              <div className="space-y-2">
                <Label htmlFor="playerNameRemote" className="text-foreground/80">{t("yourName")}</Label>
                <Input id="playerNameRemote" value={remotePlayerNameInput} onChange={(e) => setRemotePlayerNameInput(e.target.value)} placeholder={t("enterYourName")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gameIdInput" className="text-foreground/80">{t("gameIdLabel")}</Label>
                <div className="flex gap-2">
                  <Input id="gameIdInput" value={remoteGameIdInput} onChange={(e) => setRemoteGameIdInput(e.target.value)} placeholder={t("enterGameIdToJoinOrCreate")} />
                  <Button onClick={() => navigator.clipboard.writeText(remoteGameIdInput) /* ... */} variant="outline" size="icon" disabled={!remoteGameIdInput}>
                    <Copy className="h-5 w-5" />
                  </Button>
                </div>
              </div>
              <Button onClick={handleRemoteAction} className="w-full" disabled={isConnecting || !remotePlayerNameInput.trim()}>
                {isConnecting ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />{t("connectingToServer")}</> : remoteGameIdInput.trim() ? <><LinkIcon className="mr-2 h-5 w-5" />{t("joinGameButton")}</> : <><Wifi className="mr-2 h-5 w-5" />{t("createGameButton")}</>}
              </Button>
              {gameConnectionError && <p className="text-xs text-destructive text-center pt-2">{gameConnectionError}</p>}
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="p-6 pt-0 text-center">
          <p className="text-xs text-muted-foreground">{t("selectLanguageInfo")}</p>
        </CardFooter>
      </Card>
    </div>
  );
};