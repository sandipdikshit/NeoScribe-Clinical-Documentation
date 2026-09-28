import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Rewind,
  FastForward,
} from 'lucide-react';
import { formatTime } from '@/shared/utils/date.utils'; // Adjust the import path as necessary
import VariableSpeedController  from '@/shared/components/audio/VariableSpeedController';
interface AudioPlayerProps {
  audioUrl: string;
  title: string;
}

const AudioPlayer = ({ audioUrl, title }: AudioPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.addEventListener('loadedmetadata', () => {
        setDuration(audio.duration);
      });

      audio.addEventListener('timeupdate', () => {
        setCurrentTime(audio.currentTime);
      });

      return () => {
        audio.removeEventListener('loadedmetadata', () => { });
        audio.removeEventListener('timeupdate', () => { });
      };
    }
  }, [audioUrl]);

  // Reset player state when audioUrl changes
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
  }, [audioUrl]);

  const togglePlay = () => {
    if (!audioUrl) return;

    if (isPlaying) {
      audioRef.current?.pause();
    } else {
      audioRef.current?.play().catch(error => {
        console.error("Error playing audio:", error);
      });
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const timeValue = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = timeValue;
    }
    setCurrentTime(timeValue);
  };

  const skipBackward = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10);
    }
  };

  const skipForward = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.min(duration, audioRef.current.currentTime + 10);
    }
  };

  const progress = (currentTime / duration) * 100 || 0;

  return (
    <>
      {/* Audio player - increased height for mobile to accommodate stacked layout */}
      <div className="w-full h-20 sm:h-20 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 
        dark:border-gray-800 z-30 shadow-lg rounded-t-md">
        <div className="max-w-7xl mx-auto h-full bg-gray-50 px-3 sm:px-4 py-2 sm:py-3">
          {/* Mobile Layout - Stacked */}
          <div className="flex flex-col sm:hidden h-full justify-between">
            {/* Top Row - Title and Controls */}
            <div className="flex items-center justify-between gap-2">
              {/* Title */}
              <div className="flex min-w-0">
                <span className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate block">
                  {title}
                </span>
              </div>

              {/* Controls */}
              <div className="flex-1 flex items-center justify-center gap-1">
                {/* Skip Back Button */}
                <button
                  onClick={skipBackward}
                  className="p-1.5 text-gray-600 dark:text-gray-300 hover:text-gray-800 
                    dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full 
                    transition-colors"
                  disabled={!audioUrl}
                >
                  <Rewind className="h-3.5 w-3.5" />
                </button>

                {/* Play/Pause Button */}
                <button
                  onClick={togglePlay}
                  className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-full 
                    transition-colors shadow-sm"
                  disabled={!audioUrl}
                >
                  {isPlaying ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4 ml-0.5" />
                  )}
                </button>

                {/* Skip Forward Button */}
                <button
                  onClick={skipForward}
                  className="p-1.5 text-gray-600 dark:text-gray-300 hover:text-gray-800 
                    dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full 
                    transition-colors"
                  disabled={!audioUrl}
                > 
                  <FastForward className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Bottom Row - Progress Bar and Time */}
            <div className="flex items-center gap-2 mt-1">
              {/* Time Display */}
              <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 min-w-[65px]">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>

              {/* Progress Bar with Seek */}
              <div className="flex-1 relative group">
                <input
                  type="range"
                  value={currentTime || 0}
                  max={duration || 0}
                  step={0.1}
                  onChange={handleTimeChange}
                  className="absolute w-full h-8 appearance-none cursor-pointer z-10 opacity-0"
                  style={{ top: '50%', transform: 'translateY(-50%)' }}
                />
                <div className="relative w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg 
                  overflow-hidden">
                  <div
                    className="absolute h-full bg-blue-500 rounded-lg transition-all duration-100"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                {/* Hover indicator */}
                <div className="absolute w-3 h-3 bg-blue-600 rounded-full -top-0.5 
                  opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                  style={{ left: `${progress}%`, transform: 'translateX(-50%)' }}
                />
              </div>
            </div>
          </div>

          {/* Desktop Layout - Single Row */}
          <div className="hidden sm:flex items-center h-full gap-2 sm:gap-3">
            {/* Title */}
            <div className="flex-shrink-0 min-w-0 max-w-[150px] lg:max-w-[200px]">
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate block">
                {title}
              </span>
            </div>

            {/* Skip Back Button */}
            <button
              onClick={skipBackward}
              className="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 
                dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full 
                transition-colors flex-shrink-0"
              disabled={!audioUrl}
            >
              <SkipBack className="h-4 w-4" />
            </button>
            

            {/* Play/Pause Button */}
            <button
              onClick={togglePlay}
              className="p-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-full 
                flex-shrink-0 transition-colors shadow-sm"
              disabled={!audioUrl}
            >
              {isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4 ml-0.5" />
              )}
            </button>

            {/* Skip Forward Button */}
            <button
              onClick={skipForward}
              className="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 
                dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full 
                transition-colors flex-shrink-0"
              disabled={!audioUrl}
            >
              <SkipForward className="h-4 w-4" />
            </button>

            {/* Time Display */}
            <span className="text-sm text-gray-500 dark:text-gray-400 flex-shrink-0 
              min-w-[80px] text-center">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
   
     
            <VariableSpeedController audioRef={audioRef} />
             
            
            {/* Progress Bar with Seek */}
            <div className="flex-1 relative group">
              <input
                type="range"
                value={currentTime || 0}
                max={duration || 0}
                step={0.1}
                onChange={handleTimeChange}
                className="absolute w-full h-8 appearance-none cursor-pointer z-10 opacity-0"
                style={{ top: '50%', transform: 'translateY(-50%)' }}
              />
              <div className="relative w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg 
                overflow-hidden">
                <div
                  className="absolute h-full bg-blue-500 rounded-lg transition-all duration-100"
                  style={{ width: `${progress}%` }}
                />
              </div>
              {/* Hover indicator */}
              <div className="absolute w-3 h-3 bg-blue-600 rounded-full -top-0.5 
                opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                style={{ left: `${progress}%`, transform: 'translateX(-50%)' }}
              />
            </div>
          </div>
        </div>
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="metadata"
          onEnded={() => setIsPlaying(false)}
        />
      </div>
    </>
  );
};

export default AudioPlayer;