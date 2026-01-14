"use client";

import { useState, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

export function SearchInput({ 
  value, 
  onChange, 
  placeholder = "Search...",
  className 
}: SearchInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Close when value is cleared
  useEffect(() => {
    if (value === "" && isOpen) {
      // Don't auto-close, let user close manually
    }
  }, [value, isOpen]);

  const handleOpen = () => {
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    onChange("");
  };

  return (
    <div className={cn("relative flex items-center", className)}>
      {!isOpen ? (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleOpen}
          className="h-9 w-9"
          aria-label="Search"
        >
          <Search className="size-4" />
        </Button>
      ) : (
        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2 duration-200">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              className="pl-8 pr-8 h-9 w-[200px] sm:w-[250px]"
            />
            {value && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onChange("")}
                className="absolute right-0 top-1/2 -translate-y-1/2 h-7 w-7 hover:bg-transparent"
                aria-label="Clear search"
              >
                <X className="size-3.5 text-muted-foreground" />
              </Button>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="h-9 w-9"
            aria-label="Close search"
          >
            <X className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

