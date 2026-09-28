// Format time from seconds to HH:MM:SS
export const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
};

// Format timestamp to readable time
export const formatTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

export const formatDate = (dateString: string) => {
  try {
    const formattedDate = new Date(dateString);
    const month = formattedDate.getUTCMonth() + 1; // Months are zero-based
    const day = formattedDate.getUTCDate();
    const year = formattedDate.getUTCFullYear();

    return `${month.toString().padStart(2, '0')} / ${day.toString().padStart(2, '0')} / ${year}`;
  } catch (e) {
    return dateString;
  }
};
