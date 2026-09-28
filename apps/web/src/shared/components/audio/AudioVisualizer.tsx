import React, { useRef, useEffect, useState } from 'react';

interface AudioVisualizerProps {
  isRecording: boolean;
  mediaStream: MediaStream | null;
}

interface VisualizerConfig {
  // Bar settings
  barCount: number;          // Number of bars to display
  barWidth: number;          // Width of each bar (in pixels)
  barGap: number;           // Gap between bars (in pixels)
  barMinHeight: number;     // Minimum bar height (in pixels)
  barMaxHeight: number;     // Maximum bar height (percentage of canvas height)
  
  // Colors
  barColor: string;         // Main bar color
  barGradientTop: string;   // Gradient top color
  barGradientBottom: string; // Gradient bottom color
  backgroundColor: string;   // Canvas background
  
  // Audio processing
  fftSize: number;          // FFT size (must be power of 2: 32, 64, 128, 256, 512, 1024, 2048)
  smoothingTimeConstant: number; // Audio smoothing (0-1, higher = smoother)
  minDecibels: number;      // Minimum decibel level
  maxDecibels: number;      // Maximum decibel level
  
  // Animation
  animationSpeed: number;   // How fast bars respond (0-1, higher = faster)
  gravity: number;          // How fast bars fall (0-1, higher = faster fall)
  
  // Style
  rounded: boolean;         // Rounded bar tops
  mirror: boolean;          // Show mirrored bars
  centerLine: boolean;      // Show center line
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isRecording, mediaStream }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number>();
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const previousHeights = useRef<number[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // CUSTOMIZABLE CONFIGURATION - Tweak these values!
  const config: VisualizerConfig = {
    // Bar settings
    barCount: 64,              // Increase for more bars, decrease for fewer
    barWidth: 4,               // Make bars thicker or thinner
    barGap: 2,                 // Space between bars
    barMinHeight: 2,           // Minimum height even when silent
    barMaxHeight: 0.8,         // Maximum height as percentage (0.8 = 80% of canvas)
    
    // Colors
    barColor: '#10b981',       // Emerald-500
    barGradientTop: '#34d399', // Emerald-400
    barGradientBottom: '#059669', // Emerald-600
    backgroundColor: '#FFFFFF', // Emerald-800
    
    // Audio processing
    fftSize: 256,              // Lower = faster response, less detail. Higher = more detail, slower
    smoothingTimeConstant: 0.4, // 0 = no smoothing (very jumpy), 1 = max smoothing (very smooth)
    minDecibels: -70,          // Increase to reduce sensitivity to quiet sounds
    maxDecibels: -10,          // Decrease to reduce sensitivity to loud sounds
    
    // Animation
    animationSpeed: 1,       // How quickly bars rise (0.1 = slow, 1 = instant)
    gravity: 0.9,              // How quickly bars fall (0.9 = slow fall, 0.1 = fast fall)
    
    // Style
    rounded: true,             // Round bar tops
    mirror: true,              // Show reflection
    centerLine: false,         // Show center divider
  };

  useEffect(() => {
    if (!isRecording || !mediaStream || !canvasRef.current) {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      return;
    }

    const initializeAudio = async () => {
      try {
        if (!audioContextRef.current) {
          const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
          audioContextRef.current = new AudioContext();
          
          if (audioContextRef.current.state === 'suspended') {
            await audioContextRef.current.resume();
          }
          
          analyserRef.current = audioContextRef.current.createAnalyser();
          analyserRef.current.fftSize = config.fftSize;
          analyserRef.current.smoothingTimeConstant = config.smoothingTimeConstant;
          analyserRef.current.minDecibels = config.minDecibels;
          analyserRef.current.maxDecibels = config.maxDecibels;
          
          const source = audioContextRef.current.createMediaStreamSource(mediaStream);
          source.connect(analyserRef.current);
          
          // Initialize previous heights array
          previousHeights.current = new Array(config.barCount).fill(0);
          
          setIsInitialized(true);
        }
      } catch (error) {
        console.error('Error initializing audio:', error);
      }
    };

    initializeAudio();

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      if (!isRecording && audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
        analyserRef.current = null;
        setIsInitialized(false);
      }
    };
  }, [isRecording, mediaStream, config.fftSize]);

  useEffect(() => {
    if (!isInitialized || !canvasRef.current || !analyserRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    // Set canvas size
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const draw = () => {
      const width = rect.width;
      const height = rect.height;
      
      // Get frequency data
      analyser.getByteFrequencyData(dataArray);
      
      // Clear canvas
      ctx.fillStyle = config.backgroundColor;
      ctx.fillRect(0, 0, width, height);
      
      // Calculate bar dimensions
      const totalBarWidth = config.barWidth + config.barGap;
      const startX = (width - (config.barCount * totalBarWidth)) / 2;
      
      // Create gradient for bars
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, config.barGradientTop);
      gradient.addColorStop(0.5, config.barColor);
      gradient.addColorStop(1, config.barGradientBottom);
      
      // Process and draw bars
      for (let i = 0; i < config.barCount; i++) {
        // Get frequency data for this bar
        const dataIndex = Math.floor((i / config.barCount) * bufferLength * 0.5); // Use lower half of frequencies
        const value = dataArray[dataIndex] / 255; // Normalize to 0-1
        
        // Calculate target height with minimum
        const targetHeight = Math.max(
          config.barMinHeight,
          value * height * config.barMaxHeight
        );
        
        // Smooth animation with gravity
        const currentHeight = previousHeights.current[i];
        let newHeight;
        
        if (targetHeight > currentHeight) {
          // Rising - use animation speed
          newHeight = currentHeight + (targetHeight - currentHeight) * config.animationSpeed;
        } else {
          // Falling - use gravity
          newHeight = currentHeight * config.gravity;
        }
        
        previousHeights.current[i] = newHeight;
        
        // Draw bar
        const x = startX + (i * totalBarWidth);
        const barHeight = newHeight;
        const y = config.mirror ? (height / 2) - (barHeight / 2) : height - barHeight;
        
        ctx.fillStyle = gradient;
        
        if (config.rounded) {
          // Rounded rectangle
          const radius = config.barWidth / 2;
          ctx.beginPath();
          ctx.moveTo(x + radius, y);
          ctx.lineTo(x + config.barWidth - radius, y);
          ctx.quadraticCurveTo(x + config.barWidth, y, x + config.barWidth, y + radius);
          ctx.lineTo(x + config.barWidth, y + barHeight - radius);
          ctx.quadraticCurveTo(x + config.barWidth, y + barHeight, x + config.barWidth - radius, y + barHeight);
          ctx.lineTo(x + radius, y + barHeight);
          ctx.quadraticCurveTo(x, y + barHeight, x, y + barHeight - radius);
          ctx.lineTo(x, y + radius);
          ctx.quadraticCurveTo(x, y, x + radius, y);
          ctx.closePath();
          ctx.fill();
        } else {
          // Regular rectangle
          ctx.fillRect(x, y, config.barWidth, barHeight);
        }
        
        // Draw mirror if enabled
        if (config.mirror) {
          ctx.globalAlpha = 0.3;
          const mirrorY = (height / 2);
          
          if (config.rounded) {
            const radius = config.barWidth / 2;
            ctx.beginPath();
            ctx.moveTo(x + radius, mirrorY);
            ctx.lineTo(x + config.barWidth - radius, mirrorY);
            ctx.quadraticCurveTo(x + config.barWidth, mirrorY, x + config.barWidth, mirrorY + radius);
            ctx.lineTo(x + config.barWidth, mirrorY + barHeight - radius);
            ctx.quadraticCurveTo(x + config.barWidth, mirrorY + barHeight, x + config.barWidth - radius, mirrorY + barHeight);
            ctx.lineTo(x + radius, mirrorY + barHeight);
            ctx.quadraticCurveTo(x, mirrorY + barHeight, x, mirrorY + barHeight - radius);
            ctx.lineTo(x, mirrorY + radius);
            ctx.quadraticCurveTo(x, mirrorY, x + radius, mirrorY);
            ctx.closePath();
            ctx.fill();
          } else {
            ctx.fillRect(x, mirrorY, config.barWidth, barHeight);
          }
          
          ctx.globalAlpha = 1;
        }
      }
      
      // Draw center line if enabled
      if (config.centerLine && config.mirror) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
      }
      
      animationFrameId.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [isInitialized, config]);

  if (!isRecording || !mediaStream) {
    return (
      <div className="w-full h-28 rounded-lg bg-emerald-800 flex items-center justify-center">
        <div className="flex space-x-1">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="w-1 bg-emerald-400 rounded-full animate-pulse"
              style={{ 
                height: `${10 + Math.random() * 30}px`,
                animationDelay: `${i * 0.05}s`
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full">
      <canvas 
        ref={canvasRef} 
        className="w-full h-32"
        style={{ 
          width: '100%', 
          height: '128px',
        }}
      />
      {!isInitialized && (
        <div className="absolute inset-0 flex items-center justify-center bg-emerald-800 bg-opacity-90 rounded-lg">
          <div className="text-sm text-emerald-100">Initializing audio...</div>
        </div>
      )}
    </div>
  );
};

export default AudioVisualizer;