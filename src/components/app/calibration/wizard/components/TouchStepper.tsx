import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface TouchStepperProps {
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
  size?: "default" | "large";
}

export function TouchStepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = Infinity,
  unit = "",
  size = "default",
}: TouchStepperProps) {
  const [isHoldingMinus, setIsHoldingMinus] = useState(false);
  const [isHoldingPlus, setIsHoldingPlus] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const buttonSize = size === "large" ? "h-14 w-14" : "h-10 w-10";
  const fontSize = size === "large" ? "text-3xl" : "text-xl";
  const valueSize = size === "large" ? "min-w-[120px]" : "min-w-[80px]";

  const handleIncrement = () => {
    onChange(Math.min(max, value + step));
  };

  const handleDecrement = () => {
    onChange(Math.max(min, value - step));
  };

  const startHold = (direction: "plus" | "minus") => {
    const action = direction === "plus" ? handleIncrement : handleDecrement;
    
    if (direction === "plus") {
      setIsHoldingPlus(true);
    } else {
      setIsHoldingMinus(true);
    }
    
    // Primera ejecución inmediata al presionar
    action();
    
    // Esperar 500ms antes de comenzar el auto-repeat
    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(action, 200);
    }, 500);
  };

  const stopHold = () => {
    setIsHoldingPlus(false);
    setIsHoldingMinus(false);
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const decimals = step < 1 ? 1 : 0;

  return (
    <div className="flex items-center justify-center gap-4">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={cn(
          buttonSize,
          "touch-manipulation transition-all",
          isHoldingMinus && "scale-95 bg-muted"
        )}
        onClick={handleDecrement}
        onMouseDown={() => startHold("minus")}
        onMouseUp={stopHold}
        onMouseLeave={stopHold}
        onTouchStart={() => startHold("minus")}
        onTouchEnd={stopHold}
        disabled={value <= min}
      >
        <Minus className="h-6 w-6" />
      </Button>

      <div className={cn("text-center font-bold", fontSize, valueSize)}>
        {value.toFixed(decimals)}
        {unit && <span className="text-muted-foreground text-lg ml-1">{unit}</span>}
      </div>

      <Button
        type="button"
        variant="outline"
        size="icon"
        className={cn(
          buttonSize,
          "touch-manipulation transition-all",
          isHoldingPlus && "scale-95 bg-muted"
        )}
        onClick={handleIncrement}
        onMouseDown={() => startHold("plus")}
        onMouseUp={stopHold}
        onMouseLeave={stopHold}
        onTouchStart={() => startHold("plus")}
        onTouchEnd={stopHold}
        disabled={value >= max}
      >
        <Plus className="h-6 w-6" />
      </Button>
    </div>
  );
}
