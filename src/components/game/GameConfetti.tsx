"use client";

import React, { useRef, useEffect } from "react";
import { Confetti, type ConfettiRef } from "@/components/magicui/confetti";
import { PlayerId } from "@/lib/types";

interface GameConfettiProps {
  winner: PlayerId;
}

export function GameConfetti({ winner }: GameConfettiProps) {
  const confettiRef = useRef<ConfettiRef>(null);

  useEffect(() => {
    if (winner && confettiRef.current) {
      confettiRef.current.fire({
        particleCount: 200,
        spread: 180, // Wider spread
        startVelocity: 55,
        colors:
          winner === 1
            ? ["#FFFFFF", "#E0E0E0", "#F0F0F0"]
            : ["#333333", "#444444", "#555555"],
        origin: { y: 0.7 }, // Start confetti a bit lower
      });
    }
  }, [winner]);

  return (
    <Confetti
      ref={confettiRef}
      className="absolute inset-0 z-[100] pointer-events-none"
      options={{
        particleCount: 150,
        gravity: 0.5,
        colors: ["#FFC700", "#FF0000", "#2E3191", "#41BBC7"],
      }}
    />
  );
}
