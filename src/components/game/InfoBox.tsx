"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { InfoType, InfoBoxData } from "@/lib/types";

interface InfoBoxProps {
  data: InfoBoxData;
  className?: string;
}

const getInfoTextColor = (type: InfoType) => {
  switch (type) {
    case "error":
      return "text-red-600";
    case "success":
      return "text-green-600";
    case "warning":
      return "text-yellow-600";
    case "request":
      return "text-blue-600";
    case "turn":
      return "text-gray-500"; 
    case "winner":
      return "text-green-600"; 
    case "waiting":
      return "text-gray-500";
    case "connection":
      return "text-orange-600";
    case "notification":
      return "text-indigo-600";
    case "info":
    default:
      return "text-gray-500";
  }
};

export const InfoBox: React.FC<InfoBoxProps> = ({ data, className }) => {
  const textColor = getInfoTextColor(data.type);

  return (
    <div className={cn("mt-2", className)}>
      {/* Main message in the same style as your original */}
      <div className={cn(
        "inline-flex items-center text-lg font-medium",
        textColor
      )}>
        {data.message}
        
        {/* Dismiss button for dismissible messages */}
        {data.dismissible && data.onDismiss && (
          <Button
            onClick={data.onDismiss}
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0 ml-2 hover:bg-transparent opacity-50 hover:opacity-100"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
      
      {/* Actions - only show if they exist, in minimalist style */}
      {data.actions && data.actions.length > 0 && (
        <div className="flex gap-2 mt-2">
          {data.actions.map((action, index) => (
            <Button
              key={index}
              onClick={action.onClick}
              size="sm"
              variant={action.variant === "default" ? "default" : "outline"}
              disabled={action.disabled || action.loading}
              className="h-7 px-3 text-xs font-medium"
            >
              {action.loading && (
                <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin mr-1" />
              )}
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
};