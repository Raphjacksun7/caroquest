"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

export default function SharedGamePage() {
  const params = useParams();
  const router = useRouter();
  const [gameId, setGameId] = useState<string>("");

  useEffect(() => {
    // Extract gameId from URL parameters
    const extractedGameId = Array.isArray(params?.gameId) 
      ? params.gameId[0] 
      : params?.gameId;

    console.log("SHARED LINK: Processing shared game link", { extractedGameId, params });

    if (extractedGameId && extractedGameId !== "local" && extractedGameId !== "ai") {
      console.log("SHARED LINK: Valid game ID detected:", extractedGameId);
      setGameId(extractedGameId);
      
      // Store the gameId in sessionStorage for the main page to pick up
      sessionStorage.setItem("sharedGameId", extractedGameId);
      sessionStorage.setItem("fromSharedLink", "true");
      
      console.log("SHARED LINK: Stored in sessionStorage, redirecting to root");
      
      // Redirect to root
      router.replace("/");
      
    } else {
      // If no valid gameId, redirect to root
      console.log("SHARED LINK: No valid game ID, redirecting to root");
      router.replace("/");
    }
  }, [params, router]);

  // Show loading while processing the shared link
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-500" />
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-900">
            Processing Game Invitation...
          </h2>
          {gameId && (
            <p className="text-sm text-gray-600">
              Game ID: <span className="font-mono font-medium">{gameId}</span>
            </p>
          )}
          <p className="text-sm text-gray-500">
            Redirecting to game...
          </p>
        </div>
      </div>
    </div>
  );
}