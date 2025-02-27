'use client';

import { useState, useEffect, useRef } from 'react';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { cn } from '@/lib/utils';

type VisualizationType = 'line' | 'circle' | 'bar';

export default function AudioVisualizer() {
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicrophone, setSelectedMicrophone] = useState<string>('');
  const [visualizationType, setVisualizationType] = useState<VisualizationType>('line');
  const [isRecording, setIsRecording] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const visualizationTypeRef = useRef<VisualizationType>(visualizationType);

  // Update the ref when visualizationType changes
  useEffect(() => {
    visualizationTypeRef.current = visualizationType;
  }, [visualizationType]);

  // Get available microphones
  useEffect(() => {
    async function getMicrophones() {
      try {
        // Request permission to access audio devices
        await navigator.mediaDevices.getUserMedia({ audio: true });

        // Get list of audio input devices
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(device => device.kind === 'audioinput');

        setMicrophones(audioInputs);

        // Set default microphone if available
        if (audioInputs.length > 0) {
          setSelectedMicrophone(audioInputs[0].deviceId);
        }
      } catch (error) {
        console.error('Error accessing media devices:', error);
      }
    }

    getMicrophones();

    // Cleanup function
    return () => {
      stopVisualization();
    };
  }, []);

  const startVisualization = async () => {
    try {
      if (!selectedMicrophone) return;

      // Create audio context if it doesn't exist
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      // Get user media with selected microphone
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: selectedMicrophone } },
      });

      streamRef.current = stream;

      // Create analyzer node
      const audioContext = audioContextRef.current;
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;

      // Create source from microphone stream
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      // Store references
      analyserRef.current = analyser;
      sourceRef.current = source;

      // Start visualization loop
      setIsRecording(true);
      visualize();
    } catch (error) {
      console.error('Error starting visualization:', error);
    }
  };

  const stopVisualization = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    // Disconnect and clean up audio nodes
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    // Stop all tracks in the stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    setIsRecording(false);
  };

  const visualize = () => {
    if (!canvasRef.current || !analyserRef.current) return;

    const canvas = canvasRef.current;
    const canvasCtx = canvas.getContext('2d');
    if (!canvasCtx) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const width = canvas.width;
    const height = canvas.height;

    canvasCtx.clearRect(0, 0, width, height);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);

      // Get audio data based on current visualization type
      const currentVisualizationType = visualizationTypeRef.current;
      if (currentVisualizationType === 'bar') {
        analyser.getByteFrequencyData(dataArray);
      } else {
        analyser.getByteTimeDomainData(dataArray);
      }

      // Clear canvas
      canvasCtx.fillStyle = 'rgba(15, 23, 42, 0.2)';
      canvasCtx.fillRect(0, 0, width, height);

      // Draw visualization based on current type
      switch (currentVisualizationType) {
        case 'line':
          drawLine(canvasCtx, dataArray, bufferLength, width, height);
          break;
        case 'circle':
          drawCircle(canvasCtx, dataArray, bufferLength, width, height);
          break;
        case 'bar':
          drawBars(canvasCtx, dataArray, bufferLength, width, height);
          break;
      }
    };

    draw();
  };

  const drawLine = (
    ctx: CanvasRenderingContext2D,
    dataArray: Uint8Array,
    bufferLength: number,
    width: number,
    height: number
  ) => {
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#38bdf8';
    ctx.beginPath();

    const sliceWidth = width / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      // Normalize the value between 0 and 1 (audio data is in range 0-255)
      const v = dataArray[i] / 255.0;
      // Calculate y position - center at height/2 and scale appropriately
      const y = (height / 2) * (1 - v * 2) + height / 2;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    // Removed the line to the middle
    ctx.stroke();
  };

  const drawCircle = (
    ctx: CanvasRenderingContext2D,
    dataArray: Uint8Array,
    bufferLength: number,
    width: number,
    height: number
  ) => {
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 4;

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = '#a78bfa';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw data points around the circle
    for (let i = 0; i < bufferLength; i += 8) {
      const amplitude = dataArray[i] / 255;
      const angle = (i / bufferLength) * 2 * Math.PI;
      const pointRadius = radius + amplitude * 50;

      const x = centerX + Math.cos(angle) * pointRadius;
      const y = centerY + Math.sin(angle) * pointRadius;

      ctx.beginPath();
      ctx.arc(x, y, 2, 0, 2 * Math.PI);
      ctx.fillStyle = '#a78bfa';
      ctx.fill();

      if (i > 0) {
        const prevAmplitude = dataArray[i - 8] / 255;
        const prevAngle = ((i - 8) / bufferLength) * 2 * Math.PI;
        const prevPointRadius = radius + prevAmplitude * 50;

        const prevX = centerX + Math.cos(prevAngle) * prevPointRadius;
        const prevY = centerY + Math.sin(prevAngle) * prevPointRadius;

        ctx.beginPath();
        ctx.moveTo(prevX, prevY);
        ctx.lineTo(x, y);
        ctx.strokeStyle = '#a78bfa';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  };

  const drawBars = (
    ctx: CanvasRenderingContext2D,
    dataArray: Uint8Array,
    bufferLength: number,
    width: number,
    height: number
  ) => {
    const barWidth = (width / bufferLength) * 2.5;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const barHeight = (dataArray[i] / 255) * height;

      ctx.fillStyle = `rgb(${dataArray[i] + 100}, 134, 244)`;
      ctx.fillRect(x, height - barHeight, barWidth, barHeight);

      x += barWidth + 1;
      if (x > width) break;
    }
  };

  const handleToggleRecording = () => {
    if (isRecording) {
      stopVisualization();
    } else {
      startVisualization();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Vocalized - Interactive Audio Visualization</h1>
      <p className="text-slate-300 text-center max-w-2xl">
        Visualize your voice and audio in real-time with customizable waveform displays. Experiment with different visualization styles.  
      </p>

      <div className="w-full flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="w-full md:w-1/2">
          <label htmlFor="microphone-select" className="block text-sm font-medium mb-2">
            Select Microphone
          </label>
          <select
            id="microphone-select"
            value={selectedMicrophone}
            onChange={e => setSelectedMicrophone(e.target.value)}
            className="w-full px-4 py-2 rounded-md bg-slate-800 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isRecording}
          >
            {microphones.length === 0 && <option value="">No microphones found</option>}
            {microphones.map(mic => (
              <option key={mic.deviceId} value={mic.deviceId}>
                {mic.label || `Microphone ${mic.deviceId.slice(0, 5)}...`}
              </option>
            ))}
          </select>
        </div>

        <div className="w-full md:w-1/2 flex flex-col items-center space-y-2">
          <span className="text-sm font-medium">Visualization Type</span>
          <ToggleGroup.Root
            type="single"
            value={visualizationType}
            onValueChange={value => {
              if (value) setVisualizationType(value as VisualizationType);
            }}
            className="inline-flex bg-slate-800 rounded-md overflow-hidden"
          >
            <ToggleGroup.Item
              value="line"
              className={cn(
                'px-4 py-2 text-sm font-medium transition-colors',
                'focus:outline-none focus:z-10',
                visualizationType === 'line' ? 'bg-blue-600 text-white' : 'hover:bg-slate-700'
              )}
            >
              Line
            </ToggleGroup.Item>
            <ToggleGroup.Item
              value="circle"
              className={cn(
                'px-4 py-2 text-sm font-medium transition-colors',
                'focus:outline-none focus:z-10',
                visualizationType === 'circle' ? 'bg-purple-600 text-white' : 'hover:bg-slate-700'
              )}
            >
              Circle
            </ToggleGroup.Item>
            <ToggleGroup.Item
              value="bar"
              className={cn(
                'px-4 py-2 text-sm font-medium transition-colors',
                'focus:outline-none focus:z-10',
                visualizationType === 'bar' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-700'
              )}
            >
              Bar
            </ToggleGroup.Item>
          </ToggleGroup.Root>
        </div>
      </div>

      <div className="w-full aspect-video bg-slate-900 rounded-lg overflow-hidden border border-slate-800">
        <canvas ref={canvasRef} width={800} height={400} className="w-full h-full" />
      </div>

      <button
        onClick={handleToggleRecording}
        disabled={!selectedMicrophone}
        className={cn(
          'px-6 py-3 rounded-full font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2',
          isRecording
            ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
            : 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500',
          !selectedMicrophone && 'opacity-50 cursor-not-allowed'
        )}
      >
        {isRecording ? 'Stop' : 'Start'}
      </button>
    </div>
  );
}
