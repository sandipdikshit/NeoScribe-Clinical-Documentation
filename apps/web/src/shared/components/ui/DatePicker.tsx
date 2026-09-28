'use client';

import React, { useState, useEffect } from 'react';
import { ChevronDownIcon, X } from 'lucide-react';
import { Button } from "@/shared/components/ui/button";
import { Calendar } from "@/shared/components/ui/calendar";
import { Label } from "@/shared/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/shared/components/ui/sheet";
import { format } from "date-fns";
import { cn } from "@/shared/lib/utils";

interface DatePickerProps {
  selected: Date | undefined;
  onSelect: (date: Date | undefined) => void;
  disabled?: (date: Date) => boolean;
  placeholder?: string;
  id?: string;
  label?: string;
  className?: string;
}

const DatePicker: React.FC<DatePickerProps> = ({
  selected,
  onSelect,
  disabled,
  placeholder = "Select date",
  id,
  label,
  className
}) => {
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile on mount
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleSelect = (date: Date | undefined) => {
    onSelect(date);
    setOpen(false);
  };

  const triggerButton = (
    <Button
      id={id}
      variant="outline"
      className={cn(
        "w-full justify-between font-normal",
        !selected && "text-muted-foreground",
        className
      )}
      type="button"
      onClick={isMobile ? () => setOpen(true) : undefined}
    >
      {selected ? format(selected, "PPP") : placeholder}
      <ChevronDownIcon className="h-4 w-4 opacity-50" />
    </Button>
  );

  return (
    <div className="flex flex-col gap-3">
      {label && (
        <Label htmlFor={id} className="px-1">
          {label}
        </Label>
      )}

      {/* Desktop Popover */}
      {!isMobile && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            {triggerButton}
          </PopoverTrigger>
          <PopoverContent
            className="w-auto p-0"
            align="start"
            sideOffset={5}
          >
            <Calendar
              mode="single"
              selected={selected}
              captionLayout="dropdown"
              onSelect={handleSelect}
              disabled={disabled}
              fromYear={1900}
              toYear={new Date().getFullYear()}
            />
          </PopoverContent>
        </Popover>
      )}

      {/* Mobile Sheet */}
      {isMobile && (
        <>
          {triggerButton}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetContent side="bottom" className="h-auto max-h-[85vh]">
              <SheetHeader className="text-left">
                <SheetTitle>{label || "Select Visit Date"}</SheetTitle>
              </SheetHeader>
              <div className="mt-4 flex justify-center overflow-auto">
                <Calendar
                  mode="single"
                  selected={selected}
                  captionLayout="dropdown"
                  onSelect={handleSelect}
                  disabled={disabled}
                  fromYear={1900}
                  toYear={new Date().getFullYear()}
                  className="rounded-md"
                  classNames={{
                    selected: "bg-blue-500 text-white rounded-md",
                  }}
                />
              </div>
            </SheetContent>
          </Sheet>
        </>
      )}
    </div>
  );
};

export default DatePicker;