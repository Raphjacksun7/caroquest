"use client";

import React, { useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  Bot, 
  Crown,
  AlertCircle, 
  ExternalLink, 
  Gamepad2,
  Swords,
  Trophy
} from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

interface SelectScreenProps {
  onStartGameMode: (mode: "local" | "ai" | "remote") => Promise<void>;
  player1Name: string;
  setPlayer1Name: (name: string) => void;
  player2Name: string;
  setPlayer2Name: (name: string) => void;
  remotePlayerNameInput: string;
  setRemotePlayerNameInput: (name: string) => void;
  remoteGameIdInput: string;
  setRemoteGameIdInput: (id: string) => void;
  aiDifficulty: 'easy' | 'medium' | 'hard';
  setAiDifficulty: (difficulty: 'easy' | 'medium' | 'hard') => void;
  isConnecting: boolean;
  gameConnectionError: string | null;
  isFromSharedLink?: boolean;
  isProcessingSharedLink?: boolean;
}

export const SelectScreen: React.FC<SelectScreenProps> = ({
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
  isFromSharedLink = false,
  isProcessingSharedLink = false,
}) => {
  const { t } = useTranslation();
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Focus and clear name input when coming from shared link
  useEffect(() => {
    if (isFromSharedLink && nameInputRef.current) {
      nameInputRef.current.value = '';
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isFromSharedLink]);

  const handleNameInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (isFromSharedLink) {
      e.target.value = '';
      setRemotePlayerNameInput('');
    }
  };

  const handleNameInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setRemotePlayerNameInput(value);
  };

  const handleNameInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && remotePlayerNameInput.trim()) {
      e.preventDefault();
      onStartGameMode('remote');
    }
  };

  if (isProcessingSharedLink) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="p-6 border border-gray-200 rounded-sm bg-white text-center space-y-4">
          <div className="w-8 h-8 mx-auto">
            <ExternalLink className="h-8 w-8 text-gray-600 animate-pulse" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-medium text-gray-900">Processing Game Invitation</h3>
            <p className="text-sm text-gray-600">Setting up your game...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        {/* Header with vintage boardgame styling */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Crown className="h-8 w-8 text-amber-600" />
            <h1 className="text-4xl font-bold text-gray-900 tracking-wide">CaroQuest</h1>
            <Crown className="h-8 w-8 text-amber-600" />
          </div>
          <p className="text-lg text-gray-600 font-medium">Choose Your Quest</p>
          <div className="flex items-center justify-center gap-2 mt-2">
            <div className="w-16 h-px bg-amber-400"></div>
            <Trophy className="h-4 w-4 text-amber-600" />
            <div className="w-16 h-px bg-amber-400"></div>
          </div>
        </div>

        {/* Show shared link banner - SidePanel style */}
        {isFromSharedLink && remoteGameIdInput && (
          <div className="mb-6 p-4 border border-blue-200 rounded-sm bg-blue-50">
            <div className="flex items-center gap-3">
              <ExternalLink className="h-5 w-5 text-blue-600" />
              <div className="flex-1">
                <h3 className="font-medium text-blue-900">Game Invitation</h3>
                <p className="text-sm text-blue-700">
                  You've been invited to join game: <span className="font-mono font-bold">{remoteGameIdInput}</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Main Game Mode Selection - SidePanel grid style */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* Online Quest - Primary Option */}
          <div className={`p-6 border rounded-sm bg-white hover:bg-gray-50 transition-colors ${isFromSharedLink ? 'border-amber-300 bg-amber-50' : 'border-gray-200'}`}>
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 flex items-center justify-center border border-gray-200 rounded-sm bg-amber-50">
                    <Swords className="h-6 w-6 text-amber-700" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Online Quest</h2>
                    <p className="text-sm text-gray-600">Challenge a worthy opponent</p>
                  </div>
                </div>
                {isFromSharedLink && <Badge variant="secondary" className="bg-amber-100 text-amber-800">Invited</Badge>}
              </div>

              {/* Form */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="remoteName" className="text-sm font-medium text-gray-700">Your Name</Label>
                  <Input
                    ref={nameInputRef}
                    id="remoteName"
                    value={remotePlayerNameInput}
                    onChange={handleNameInputChange}
                    onFocus={handleNameInputFocus}
                    onKeyDown={handleNameInputKeyDown}
                    placeholder="Enter your noble name"
                    className="mt-1 border-gray-300 focus:border-amber-500 focus:ring-amber-500"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
                    data-form-type="other"
                    data-lpignore="true"
                  />
                </div>

                {!isFromSharedLink && (
                  <div>
                    <Label htmlFor="gameId" className="text-sm font-medium text-gray-700">Game ID (Optional)</Label>
                    <Input
                      id="gameId"
                      value={remoteGameIdInput}
                      onChange={(e) => setRemoteGameIdInput(e.target.value.toUpperCase())}
                      placeholder="Enter Game ID to join"
                      className="mt-1 border-gray-300 focus:border-amber-500 focus:ring-amber-500 font-mono"
                      autoComplete="off"
                    />
                  </div>
                )}

                {isFromSharedLink && (
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Game ID</Label>
                    <div className="mt-1 p-3 bg-gray-50 rounded-md border border-gray-200">
                      <span className="font-mono text-gray-900">{remoteGameIdInput}</span>
                      <p className="text-xs text-gray-500 mt-1">Pre-filled from invitation</p>
                    </div>
                  </div>
                )}

                {gameConnectionError && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-md border border-red-200">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm">{gameConnectionError}</span>
                  </div>
                )}

                <Button 
                  onClick={() => onStartGameMode('remote')}
                  disabled={!remotePlayerNameInput.trim() || isConnecting}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white font-medium py-2"
                >
                  {isConnecting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                      {remoteGameIdInput ? 'Joining Quest...' : 'Creating Quest...'}
                    </>
                  ) : (
                    <>
                      <Gamepad2 className="h-4 w-4 mr-2" />
                      {remoteGameIdInput ? 'Join Quest' : 'Create Quest'}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* AI Quest */}
          <div className="p-6 border border-gray-200 rounded-sm bg-white hover:bg-gray-50 transition-colors">
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 flex items-center justify-center border border-gray-200 rounded-sm bg-blue-50">
                  <Bot className="h-6 w-6 text-blue-700" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">AI Training</h2>
                  <p className="text-sm text-gray-600">Practice with the court wizard</p>
                </div>
              </div>

              {/* Form */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="playerName" className="text-sm font-medium text-gray-700">Your Name</Label>
                  <Input
                    id="playerName"
                    value={player1Name}
                    onChange={(e) => setPlayer1Name(e.target.value)}
                    placeholder="Enter your name"
                    className="mt-1 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    autoComplete="off"
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-700">Wizard Difficulty</Label>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {(['easy', 'medium', 'hard'] as const).map((level) => (
                      <Button
                        key={level}
                        variant={aiDifficulty === level ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setAiDifficulty(level)}
                        className={aiDifficulty === level 
                          ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                          : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                        }
                      >
                        {level.charAt(0).toUpperCase() + level.slice(1)}
                      </Button>
                    ))}
                  </div>
                </div>

                <Button 
                  onClick={() => onStartGameMode('ai')} 
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2"
                >
                  <Bot className="h-4 w-4 mr-2" />
                  Begin Training
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Local Play - SidePanel style secondary option */}
        <div className="p-6 border border-gray-200 rounded-sm bg-white hover:bg-gray-50 transition-colors">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 flex items-center justify-center border border-gray-200 rounded-sm bg-green-50">
                <Users className="h-6 w-6 text-green-700" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Local Duel</h3>
                <p className="text-sm text-gray-600">Challenge a friend beside you</p>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-600 block">First Knight</Label>
                  <Input
                    value={player1Name}
                    onChange={(e) => setPlayer1Name(e.target.value)}
                    placeholder="Player 1 name"
                    className="w-full sm:w-32 text-sm border-gray-300 focus:border-green-500 focus:ring-green-500"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-600 block">Second Knight</Label>
                  <Input
                    value={player2Name}
                    onChange={(e) => setPlayer2Name(e.target.value)}
                    placeholder="Player 2 name"
                    className="w-full sm:w-32 text-sm border-gray-300 focus:border-green-500 focus:ring-green-500"
                    autoComplete="off"
                  />
                </div>
              </div>
              <Button 
                onClick={() => onStartGameMode('local')} 
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 h-9 w-full sm:w-auto"
              >
                <Users className="h-4 w-4 mr-2" />
                Start Duel
              </Button>
            </div>
          </div>
        </div>

        {/* Footer with vintage style */}
        <div className="text-center mt-8 text-sm text-gray-500">
          <div className="flex items-center justify-center gap-2">
            <div className="w-8 h-px bg-gray-300"></div>
            <span>May the best strategist prevail</span>
            <div className="w-8 h-px bg-gray-300"></div>
          </div>
        </div>
      </div>
    </div>
  );
};