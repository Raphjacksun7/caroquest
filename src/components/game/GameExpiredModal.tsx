"use client";

import React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Plus, Home } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

interface GameExpiredModalProps {
  isOpen: boolean;
  onCreateNew: () => void;
  onGoHome: () => void;
  errorType?: "GAME_NOT_FOUND" | "GAME_FULL" | "JOIN_FAILED" | "SERVER_ERROR";
  gameId?: string;
}

export function GameExpiredModal({
  isOpen,
  onCreateNew,
  onGoHome,
  errorType = "GAME_NOT_FOUND",
  gameId,
}: GameExpiredModalProps) {
  const { t } = useTranslation();

  const getModalContent = () => {
    switch (errorType) {
      case "GAME_NOT_FOUND":
        return {
          title: "Game Session Expired",
          description: `The game session ${
            gameId ? `"${gameId}"` : "you're looking for"
          } has expired or no longer exists. This can happen when a game has been inactive for more than 24 hours.`,
          icon: <AlertTriangle className="h-6 w-6 text-amber-500" />,
        };
      case "GAME_FULL":
        return {
          title: "Game is Full",
          description: `The game session ${
            gameId ? `"${gameId}"` : ""
          } already has 2 players and cannot accept more participants.`,
          icon: <AlertTriangle className="h-6 w-6 text-blue-500" />,
        };
      case "JOIN_FAILED":
        return {
          title: "Unable to Join Game",
          description:
            "There was an issue joining the game session. The session may be full or no longer available.",
          icon: <AlertTriangle className="h-6 w-6 text-red-500" />,
        };
      case "SERVER_ERROR":
        return {
          title: "Connection Error",
          description:
            "A server error occurred while trying to access the game. Please try again in a moment.",
          icon: <AlertTriangle className="h-6 w-6 text-red-500" />,
        };
      default:
        return {
          title: "Game Session Issue",
          description: "There was a problem with the game session.",
          icon: <AlertTriangle className="h-6 w-6 text-gray-500" />,
        };
    }
  };

  const { title, description, icon } = getModalContent();

  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
            {icon}
          </div>
          <AlertDialogTitle className="text-lg font-semibold">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-muted-foreground leading-relaxed">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <Button
            variant="outline"
            onClick={onGoHome}
            className="w-full sm:w-auto flex items-center gap-2"
          >
            <Home className="h-4 w-4" />
            Back to Menu
          </Button>
          <AlertDialogAction asChild>
            <Button
              onClick={onCreateNew}
              className="w-full sm:w-auto flex items-center gap-2 bg-primary hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Create New Game
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
