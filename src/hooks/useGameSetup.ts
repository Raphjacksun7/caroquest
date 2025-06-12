"use client";

import { useState, useEffect } from "react";
import type { AIDifficulty } from "@/lib/types";

interface UseGameSetupProps {
  gameIdFromUrl?: string;
}

export function useGameSetup(props?: UseGameSetupProps) {
  const [player1NameLocal, setPlayer1NameLocal] = useState<string>("");
  const [player2NameLocal, setPlayer2NameLocal] = useState<string>("");
  const [remotePlayerNameInput, setRemotePlayerNameInput] = useState<string>("");
  const [remoteGameIdInput, setRemoteGameIdInput] = useState<string>(props?.gameIdFromUrl || "");
  const [currentAiDifficulty, setCurrentAiDifficulty] = useState<AIDifficulty>("medium");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedName = localStorage.getItem("playerName");
      if (storedName) {
        setPlayer1NameLocal(storedName);
        setRemotePlayerNameInput(storedName);
      }
    }
  }, []);

  useEffect(() => {
    if (props?.gameIdFromUrl && remoteGameIdInput !== props.gameIdFromUrl) {
      // This updates the input if the URL param changes (e.g., navigating to a new game link)
      // and the input doesn't already match it.
      setRemoteGameIdInput(props.gameIdFromUrl);
    }
  }, [props?.gameIdFromUrl]);

  return {
    player1NameLocal, setPlayer1NameLocal,
    player2NameLocal, setPlayer2NameLocal,
    remotePlayerNameInput, setRemotePlayerNameInput,
    remoteGameIdInput, setRemoteGameIdInput,
    currentAiDifficulty, setCurrentAiDifficulty,
  };
}