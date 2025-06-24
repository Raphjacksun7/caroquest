"use client";
import React, { useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, CheckCircle } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useState } from "react";

interface WaitingRoomProps {
  gameId: string;
  playerName: string;
}

export const WaitingRoom: React.FC<WaitingRoomProps> = ({
  gameId,
  playerName,
}) => {
  const { t } = useTranslation();
  const [linkCopied, setLinkCopied] = useState(false);
  const [idCopied, setIdCopied] = useState(false);

  const gameLink =
    typeof window !== "undefined"
      ? `${window.location.origin}/game/${gameId}`
      : "";

  const handleCopyLink = useCallback(() => {
    navigator.clipboard
      .writeText(gameLink)
      .then(() => {
        console.log("Shareable link copied to clipboard:", gameLink);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
      })
      .catch((err) => {
        console.error("Failed to copy link: ", err);
      });
  }, [gameLink]);

  const handleCopyGameId = useCallback(() => {
    navigator.clipboard
      .writeText(gameId)
      .then(() => {
        console.log("Game ID copied to clipboard:", gameId);
        setIdCopied(true);
        setTimeout(() => setIdCopied(false), 2000);
      })
      .catch((err) => {
        console.error("Failed to copy game ID: ", err);
      });
  }, [gameId]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-lg shadow-xl text-center">
        <CardHeader>
          <CardTitle className="text-2xl">
            {t("waitingForOpponentTitle")}
          </CardTitle>
          <CardDescription>
            {t("welcomePlayer", { playerName })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-gray-800 font-medium">
            {t("shareGameIdOrLink")}
          </p>

          {/* Game ID Section with Copy Button */}
          <div className="space-y-2">
            <Label htmlFor="gameIdDisplay" className="text-sm font-medium">
              {t("gameIdLabel")}
            </Label>
            <div className="flex gap-2">
              <div className="flex-1 flex items-center justify-center p-3 bg-muted rounded-md border">
                <span
                  id="gameIdDisplay"
                  className="text-2xl font-mono tracking-widest font-bold"
                >
                  {gameId}
                </span>
              </div>
              <Button
                onClick={handleCopyGameId}
                variant="outline"
                size="icon"
                aria-label="Copy Game ID"
                className={idCopied ? "bg-green-50 border-green-300" : ""}
              >
                {idCopied ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            {idCopied && (
              <p className="text-xs text-green-600 font-medium">
                Game ID copied!
              </p>
            )}
          </div>

          {/* Shareable Link Section */}
          <div className="space-y-2">
            <Label htmlFor="gameLinkDisplay" className="text-sm font-medium">
              {t("shareableLink")}
            </Label>
            <div className="flex gap-2">
              <Input
                id="gameLinkDisplay"
                value={gameLink}
                readOnly
                className="text-center font-mono text-sm bg-muted"
              />
              <Button
                onClick={handleCopyLink}
                variant="outline"
                size="icon"
                aria-label={t("copyLink")}
                className={linkCopied ? "bg-green-50 border-green-300" : ""}
              >
                {linkCopied ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            {linkCopied && (
              <p className="text-xs text-green-600 font-medium">Link copied!</p>
            )}
          </div>

          <div className="pt-4">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <div className="animate-pulse w-2 h-2 bg-blue-500 rounded-full"></div>
              <div
                className="animate-pulse w-2 h-2 bg-blue-500 rounded-full"
                style={{ animationDelay: "0.2s" }}
              ></div>
              <div
                className="animate-pulse w-2 h-2 bg-blue-500 rounded-full"
                style={{ animationDelay: "0.4s" }}
              ></div>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              {t("waitingMessage")}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
