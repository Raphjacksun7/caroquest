
"use client";

import { DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PAWNS_PER_PLAYER } from '@/lib/gameLogic'; // Import from gameLogic

interface RulesDialogProps {
  pawnsPerPlayer: number; // This prop will receive PAWNS_PER_PLAYER
}

export const RulesDialogContent = ({ pawnsPerPlayer }: RulesDialogProps) => {
  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-6 rounded-lg shadow-xl">
      <DialogHeader className="mb-4">
        <DialogTitle className="text-2xl font-bold text-center text-[hsl(var(--primary))]">Game Rules</DialogTitle>
        <DialogDescription className="text-center text-muted-foreground">
          Learn how to play Diagonal Domination.
        </DialogDescription>
      </DialogHeader>
      
      <Tabs defaultValue="basics" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 mb-4">
          <TabsTrigger value="basics">Basics</TabsTrigger>
          <TabsTrigger value="blocking">Blocking</TabsTrigger>
          <TabsTrigger value="winning">Winning</TabsTrigger>
          <TabsTrigger value="visuals">Visuals</TabsTrigger>
        </TabsList>
        
        <TabsContent value="basics" className="space-y-4 text-sm">
          <h3 className="text-lg font-semibold text-[hsl(var(--foreground))]">Board &amp; Pieces</h3>
          <p>Player 1 (Red) uses light squares. Player 2 (Blue) uses dark squares. Each player has {pawnsPerPlayer} pawns.</p>
          
          <h3 className="text-lg font-semibold text-[hsl(var(--foreground))]">Game Phases</h3>
          <ul className="list-disc ml-5 space-y-1">
            <li><strong>Placement:</strong> Players take turns placing pawns on empty squares of their color.</li>
            <li><strong>Movement:</strong> After all pawns are placed, players move a pawn to any empty square of their color (pawns can "teleport").</li>
          </ul>
        </TabsContent>
        
        <TabsContent value="blocking" className="space-y-4 text-sm">
          <h3 className="text-lg font-semibold text-[hsl(var(--foreground))]">Blocking Mechanics</h3>
          <ul className="list-disc ml-5 space-y-1">
            <li>Block an opponent's pawn by "sandwiching" it horizontally or vertically (YourPawn - OpponentPawn - YourPawn).</li>
            <li>A blocked pawn (visibly dimmed or marked) cannot be used in a winning diagonal.</li>
            <li>Pawns actively blocking (visibly marked, e.g., thicker border) cannot be used in a winning diagonal.</li>
            <li><strong>Restricted Placement:</strong> During placement, you cannot place a pawn in an empty square if it's already "sandwiched" by two of your opponent's pawns (e.g., OpponentPawn - YourEmptySquare - OpponentPawn).</li>
            <li><strong>Dead Zones:</strong> If you have two pawns on your color separated by one empty square of your color (YourPawn - EmptySquareOfYourColor - YourPawn) horizontally or vertically, that empty square becomes a "dead zone" (marked with '×') for the opponent. They cannot use it in their winning diagonal.</li>
             <li>Pawns creating a dead zone (visibly marked, e.g., different border) cannot be used in a winning diagonal.</li>
          </ul>
        </TabsContent>
        
        <TabsContent value="winning" className="space-y-4 text-sm">
          <h3 className="text-lg font-semibold text-[hsl(var(--foreground))]">Winning Condition</h3>
          <p>Be the first to align 4 of your pawns diagonally. Pawns must be on your assigned color and not involved in blocking/creating dead zones, nor can the line pass through an opponent's dead zone.</p>
        </TabsContent>

        <TabsContent value="visuals" className="space-y-4 text-sm">
            <h3 className="text-lg font-semibold text-[hsl(var(--foreground))]">Visual Cues</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-[hsl(var(--player1-pawn-color))] border-2 border-opacity-75 border-[hsl(var(--player1-pawn-color))]"></div> Player 1 Pawn (Red)
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-[hsl(var(--player2-pawn-color))] border-2 border-opacity-75 border-[hsl(var(--player2-pawn-color))]"></div> Player 2 Pawn (Blue)
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-[hsl(var(--player1-pawn-color))] opacity-60 border-2 border-[hsl(var(--player1-pawn-color))] relative">
                       <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-lock text-white absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    </div> Blocked Pawn
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-[hsl(var(--player1-pawn-color))] border-4 border-[hsl(var(--highlight-blocking-pawn-border))] relative">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-shield text-white absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/></svg>
                    </div> Pawn that IS Blocking
                </div>
                 <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-[hsl(var(--player1-pawn-color))] border-4 border-[hsl(var(--highlight-creating-dead-zone-pawn-border))]"></div> Pawn Creating Dead Zone
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-[hsl(var(--player1-pawn-color))] border-4 border-[hsl(var(--highlight-selected-pawn))]"></div> Selected Pawn
                </div>
                <div className="flex items-center gap-2">
                     <div className="w-5 h-5 rounded-full bg-[hsl(var(--player1-pawn-color))] border-4 border-[hsl(var(--highlight-win-line))] animate-pulse"></div> Winning Pawn
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 bg-[hsl(var(--board-light-square))] flex items-center justify-center relative">
                        <div className="absolute inset-0 flex items-center justify-center text-[hsl(var(--highlight-dead-zone))] opacity-50 text-2xl font-bold pointer-events-none">×</div>
                    </div> Dead Zone Square
                </div>
                 <div className="flex items-center gap-2">
                    <div className="w-5 h-5 bg-[hsl(var(--board-light-square))] flex items-center justify-center relative">
                         <div className="absolute w-2 h-2 bg-[hsl(var(--highlight-valid-move))] rounded-full opacity-70 pointer-events-none" />
                    </div> Valid Move Square
                </div>
            </div>
        </TabsContent>
      </Tabs>
    </DialogContent>
  );
};
