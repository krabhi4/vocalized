'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { cn } from '@/lib/utils';

type VisualizationType = 'straight' | 'circle' | 'bar';

interface AudioDevice {
  deviceId: string;
  label: string;
}

// Add WebKit audio context type
interface Window {
  webkitAudioContext: typeof AudioContext;
}

function AudioVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [visualizationType, setVisualizationType] = useState<VisualizationType>('straight');
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [debugInfo, setDebugInfo] = useState<string>('');
  const animationFrameId = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  // Load available audio devices
  useEffect(() => {
    let mounted = true;

    const loadAudioDevices = async () => {
      try {
        // First request permission to access audio
        const initialStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        initialStream.getTracks().forEach(track => track.stop()); // Stop the initial stream

        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices
          .filter(device => device.kind === 'audioinput')
          .map(device => ({
            deviceId: device.deviceId,
            label: device.label || `Microphone ${device.deviceId.slice(0, 5)}...`,
          }));

        if (mounted) {
          setAudioDevices(audioInputs);
          if (audioInputs.length > 0 && !selectedDevice) {
            setSelectedDevice(audioInputs[0].deviceId);
          }
          setDebugInfo('Audio devices loaded: ' + audioInputs.length);
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error loading audio devices:', error);
        if (mounted) {
          setDebugInfo('Error loading devices: ' + errorMessage);
        }
      }
    };

    loadAudioDevices();

    return () => {
      mounted = false;
    };
  }, []);

  // Cleanup effect
  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, []);

  const startRecording = async () => {
    try {
      if (!selectedDevice) {
        setDebugInfo('No device selected');
        return;
      }
      // Stop any existing recording
      stopRecording();
      // Create new audio context
      const context = new (window.AudioContext || (window as any).webkitAudioContext)();
      // Get the stream first
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: { exact: selectedDevice },
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      // Create and configure nodes
      const source = context.createMediaStreamSource(stream);
      const analyserNode = context.createAnalyser();
      // Configure analyser with optimal settings for visualization
      analyserNode.fftSize = 2048; // Increased FFT size for better resolution
      analyserNode.minDecibels = -90;
      analyserNode.maxDecibels = -10;
      analyserNode.smoothingTimeConstant = 0.85;
      // Connect nodes
      source.connect(analyserNode);
      // Save references
      streamRef.current = stream;
      sourceRef.current = source;
      setAudioContext(context);
      setAnalyser(analyserNode);
      setIsRecording(true);
      setDebugInfo('Recording started');
      // Start visualization
      draw(analyserNode);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error starting recording:', error);
      setDebugInfo('Error starting recording: ' + errorMessage);
      stopRecording();
    }
  };
  const stopRecording = () => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    if (audioContext) {
      audioContext.close();
      setAudioContext(null);
    }

    setAnalyser(null);
    setIsRecording(false);
    setDebugInfo('Recording stopped');

    // Clear canvas
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'rgb(20, 20, 20)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
  };
  const draw = (analyserNode: AnalyserNode) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');

    if (!canvas || !ctx || !analyserNode) {
      console.error('Missing required elements:', {
        canvas: !!canvas,
        context: !!ctx,
        analyser: !!analyserNode,
      });
      setDebugInfo('Cannot draw: missing canvas or context');
      return;
    }
    // In the draw function, update the canvas scaling code:
    // Ensure canvas dimensions match display size
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    // Set the canvas size
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Remove the ctx.scale(dpr, dpr) line as we'll handle scaling differently

    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    // In drawFrame function, update the debug logging
    function drawFrame() {
      // Only check recording state after getting data
      if (!isRecording) {
        console.log('Recording stopped, cleaning up animation frame');
        if (animationFrameId.current) {
          cancelAnimationFrame(animationFrameId.current);
          animationFrameId.current = null;
        }
        return;
      }
      // Get frequency data
      analyserNode.getByteFrequencyData(dataArray);
      // Ensure we still have valid context and canvas
      if (!ctx || !canvas) {
        console.error('Context or canvas lost during animation');
        stopRecording(); // This will handle cleanup
        return;
      }
      // Clear canvas with background color
      ctx.fillStyle = 'rgb(20, 20, 20)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // Draw visualization based on current type
      try {
        switch (visualizationType) {
          case 'straight':
            drawStraightLine(ctx, dataArray, rect);
            break;
          case 'circle':
            drawCircle(ctx, dataArray, rect);
            break;
          case 'bar':
            drawBars(ctx, dataArray, rect);
            break;
        }
      } catch (error) {
        console.error('Error in visualization:', error);
        stopRecording();
        return;
      }
      // Schedule next frame
      animationFrameId.current = requestAnimationFrame(drawFrame);
      // Update debug info with actual audio data
      let sum = 0;
      let max = 0;
      for (let i = 0; i < bufferLength; i++) {
        const value = dataArray[i];
        sum += value;
        if (value > max) max = value;
      }
      const avg = sum / bufferLength;
      setDebugInfo(
        `Avg: ${avg.toFixed(2)}, Max: ${max}, Buffer: ${bufferLength}, Canvas: ${rect.width}x${rect.height}`
      );
    }
    // Start the animation loop
    drawFrame();
  };
  const drawStraightLine = (
    ctx: CanvasRenderingContext2D,
    dataArray: Uint8Array,
    rect: DOMRectReadOnly
  ) => {
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgb(0, 255, 0)';
    ctx.beginPath();

    const sliceWidth = rect.width / dataArray.length;
    const centerY = rect.height / 2;
    let x = 0;

    for (let i = 0; i < dataArray.length; i++) {
      const percent = dataArray[i] / 255;
      const y = centerY - percent * (rect.height / 2);

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    ctx.stroke();

    // Draw the center line
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.moveTo(0, centerY);
    ctx.lineTo(rect.width, centerY);
    ctx.stroke();
  };
  const drawCircle = (
    ctx: CanvasRenderingContext2D,
    dataArray: Uint8Array,
    rect: DOMRectReadOnly
  ) => {
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const baseRadius = Math.min(centerX, centerY) * 0.8; // Adjusted to be 80% of the smaller dimension

    // Draw base circle
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.arc(centerX, centerY, baseRadius, 0, 2 * Math.PI);
    ctx.stroke();

    // Draw visualization
    ctx.beginPath();
    ctx.strokeStyle = 'rgb(0, 255, 0)';
    ctx.lineWidth = 2;

    for (let i = 0; i < dataArray.length; i++) {
      const percent = dataArray[i] / 255;
      const angle = (i * 2 * Math.PI) / dataArray.length;
      const radius = baseRadius * (1 + percent * 0.5); // Scale the effect

      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.closePath();
    ctx.stroke();
  };
  const drawBars = (
    ctx: CanvasRenderingContext2D,
    dataArray: Uint8Array,
    rect: DOMRectReadOnly
  ) => {
    const barCount = dataArray.length;
    const barWidth = (rect.width / barCount) * 0.8;
    const barSpacing = (rect.width / barCount) * 0.2;
    let x = 0;

    for (let i = 0; i < barCount; i++) {
      const percent = dataArray[i] / 255;
      const barHeight = rect.height * percent;

      // Create gradient for each bar
      const gradient = ctx.createLinearGradient(0, rect.height, 0, rect.height - barHeight);
      gradient.addColorStop(0, 'rgb(0, 255, 0)');
      gradient.addColorStop(1, 'rgb(0, 128, 0)');

      ctx.fillStyle = gradient;
      ctx.fillRect(x, rect.height - barHeight, barWidth, barHeight);

      x += barWidth + barSpacing;
    }
  };
  return (
    <div className="flex flex-col items-center gap-6 p-8">
      <h1 className="text-3xl font-bold">Audio Visualizer</h1>

      <div className="w-full max-w-md">
        <label htmlFor="microphone" className="block text-sm font-medium mb-2">
          Select Microphone
        </label>
        <select
          id="microphone"
          value={selectedDevice}
          onChange={e => setSelectedDevice(e.target.value)}
          className="w-full px-3 py-2 bg-slate-800 rounded-lg text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-green-500"
          disabled={isRecording}
        >
          {audioDevices.map(device => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label}
            </option>
          ))}
        </select>
      </div>

      {/* Debug info display */}
      <div className="text-sm text-gray-400 mt-2">{debugInfo}</div>

      <ToggleGroup.Root
        className="inline-flex bg-slate-800 rounded-lg p-1"
        type="single"
        value={visualizationType}
        onValueChange={value => value && setVisualizationType(value as VisualizationType)}
      >
        <ToggleGroup.Item
          className={cn(
            'px-3 py-2 rounded text-white',
            visualizationType === 'straight' && 'bg-slate-600'
          )}
          value="straight"
        >
          Straight
        </ToggleGroup.Item>
        <ToggleGroup.Item
          className={cn(
            'px-3 py-2 rounded text-white',
            visualizationType === 'circle' && 'bg-slate-600'
          )}
          value="circle"
        >
          Circle
        </ToggleGroup.Item>
        <ToggleGroup.Item
          className={cn(
            'px-3 py-2 rounded text-white',
            visualizationType === 'bar' && 'bg-slate-600'
          )}
          value="bar"
        >
          Bar
        </ToggleGroup.Item>
      </ToggleGroup.Root>

      <canvas
        ref={canvasRef}
        width={800}
        height={400}
        className="border border-slate-700 rounded-lg bg-slate-900"
      />

      <button
        onClick={isRecording ? stopRecording : startRecording}
        className={cn(
          'px-4 py-2 rounded-lg font-medium',
          isRecording
            ? 'bg-red-600 hover:bg-red-700 text-white'
            : 'bg-green-600 hover:bg-green-700 text-white'
        )}
      >
        {isRecording ? 'Stop Recording' : 'Start Recording'}
      </button>
    </div>
  );
}

// Export as a dynamic component with SSR disabled
// Export with dynamic import and no SSR
export default dynamic(() => Promise.resolve(AudioVisualizer), { ssr: false });
