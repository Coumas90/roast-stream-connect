import React from "react";
import { Button } from "@/components/ui/button";
import { List, LayoutGrid } from "lucide-react";

interface ViewToggleProps {
  view: "list" | "kanban";
  onViewChange: (view: "list" | "kanban") => void;
}

export function ViewToggle({ view, onViewChange }: ViewToggleProps) {
  return (
    <div className="flex items-center space-x-1 bg-muted rounded-md p-1">
      <Button
        variant={view === "list" ? "default" : "ghost"}
        size="sm"
        onClick={() => onViewChange("list")}
        className="h-8 px-3"
      >
        <List className="w-4 h-4 mr-1" />
        Lista
      </Button>
      <Button
        variant={view === "kanban" ? "default" : "ghost"}
        size="sm"
        onClick={() => onViewChange("kanban")}
        className="h-8 px-3"
      >
        <LayoutGrid className="w-4 h-4 mr-1" />
        Kanban
      </Button>
    </div>
  );
}