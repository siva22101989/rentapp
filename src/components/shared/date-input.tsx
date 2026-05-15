'use client';

import * as React from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface DateInputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  ({ className, ...props }, ref) => {
    return (
      <div className="relative group">
        <Input
          {...props}
          ref={ref}
          className={cn(
            "rounded-full border-primary/20 focus-visible:ring-primary/30 pr-10 h-10 text-sm bg-background",
            className
          )}
        />
        <CalendarIcon className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors pointer-events-none" />
      </div>
    )
  }
)
DateInput.displayName = "DateInput"

export { DateInput }
