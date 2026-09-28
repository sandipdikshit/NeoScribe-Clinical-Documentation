import React, { useState } from 'react';

interface VariableSpeedController {
  audioRef: React.RefObject<HTMLAudioElement>;
}

const speeds = [ 1, 1.5, 2, 2.5]; 

const PlaybackSpeedControl: React.FC<VariableSpeedController> = ({ audioRef }) => {
  const [playbackRate, setPlaybackRate] = useState(1);

  const changeSpeed = (delta: number) => {
    const currentIndex = speeds.indexOf(playbackRate);
    if (currentIndex === -1) return;

    let newIndex = currentIndex + delta;
    if (newIndex < 0) newIndex = 0;
    if (newIndex >= speeds.length) newIndex = speeds.length - 1;

    const newSpeed = speeds[newIndex];
    setPlaybackRate(newSpeed);

    if (audioRef.current) {
      audioRef.current.playbackRate = newSpeed;
    }
  };

  return (
    <div className="flex items-center border px-2 rounded-md gap-1">
      <button
        onClick={() => changeSpeed(-1)}
        disabled={playbackRate === speeds[0]}
        className={` p-1  ${ 
          playbackRate === speeds[0]
            ? 'text-gray-400   cursor-not-allowed'
            : 'text-gray-600   '
        }`}
        aria-label="Decrease playback speed"
        type="button"
      >
        −
      </button>

      <span className="max-w-[30px] min-w-[30px] mx-auto text-center text-sm text-gray-600">
        {playbackRate}x
      </span>

      <button
        onClick={() => changeSpeed(1)}
        disabled={playbackRate === speeds[speeds.length - 1]}
        className={`${
          playbackRate === speeds[speeds.length - 1]
            ? 'text-gray-400 '
            : 'text-gray-600 '
        }`}
        aria-label="Increase playback speed"
        type="button"
      >
        +
      </button>
    </div>
  );
};

export default PlaybackSpeedControl;
