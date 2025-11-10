import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Grid, X } from "lucide-react";

type Props = { onClose?: () => void };

/**
 * Compact multiplication table helper (2–12) for the right sidebar.
 * Fixed height to avoid layout shifts.
 */
export const TableBoard: React.FC<Props> = ({ onClose }) => {
  const [activeTable, setActiveTable] = useState<number>(2);
  return (
    <div className="w-full bg-white/80 backdrop-blur rounded-2xl border-2 border-primary/20 p-3 shadow-lg">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Grid className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold">Tables (2–12)</h3>
        </div>
        {onClose && (
          <Button size="icon" variant="outline" className="h-7 w-7" onClick={onClose}>
            <X className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-1 mb-2">
        {[2,3,4,5,6,7,8,9,10,11,12].map(n => (
          <button
            key={n}
            onClick={() => setActiveTable(n)}
            className={`text-xs px-2 py-1 rounded-md border ${activeTable === n ? 'bg-primary/20 border-primary text-primary' : 'bg-white/70 border-muted-foreground/20 hover:bg-muted'}`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="max-h-64 overflow-y-auto rounded-md border bg-white/60 p-2 text-xs">
        {[...Array(12)].map((_, i) => (
          <div key={i} className="py-0.5 font-semibold tracking-tight">
            {activeTable}×{i+1}={activeTable * (i+1)}
          </div>
        ))}
      </div>
    </div>
  );
};
