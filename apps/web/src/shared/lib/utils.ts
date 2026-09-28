import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const monthMap: { [key: number]: string } = {
  0: "January",
  1: "February", 
  2: "March",
  3: "April",
  4: "May",
  5: "June",
  6: "July",
  7: "August",
  8: "September", 
  9: "October",
  10: "November",
  11: "December"
};

/**
 * Formats a date string into a human readable format
 * @param dateString - ISO date string or Date object
 * @returns Formatted date string like "April 25, 2024"
 */
export function formatDate(dateString: string | Date): string {
  const date = new Date(dateString);
  
  // Return invalid date if date is invalid
  if (isNaN(date.getTime())) {
    return "Invalid Date";
  }

  const day = date.getDate();
  const month = monthMap[date.getMonth()];
  const year = date.getFullYear();

  return `${month} ${day}, ${year}`;
}

/**
 * Formats a date string into a short format
 * @param dateString - ISO date string or Date object 
 * @returns Formatted date string like "Apr 25, 2024"
 */
export function formatShortDate(dateString: string | Date): string {
  const date = new Date(dateString);
  
  // Return invalid date if date is invalid
  if (isNaN(date.getTime())) {
    return "Invalid Date";
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric", 
    year: "numeric"
  });
}
