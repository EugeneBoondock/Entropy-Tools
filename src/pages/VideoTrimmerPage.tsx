import React, { useState, useRef, useEffect } from 'react';
import Navbar from '../components/Navbar';

interface VideoTrimSettings {
  startTime: number;
  endTime: number;
  duration: number;
}

const VideoTrimmerPage: React.FC = () => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const [trimSettings, setTrimSettings] = useState<VideoTrimSettings>({
    startTime: 0,
    endTime: 0,
    duration: 0
  });

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateTime = () => setCurrentTime(video.currentTime);
    const updateDuration = () => {
      setDuration(video.duration);
      setTrimSettings(prev => ({
        ...prev,
        endTime: video.duration,
        duration: video.duration
      }));
    };

    video.addEventListener('timeupdate', updateTime);
    video.addEventListener('loadedmetadata', updateDuration);
    video.addEventListener('ended', () => setIsPlaying(false));

    return () => {
      video.removeEventListener('timeupdate', updateTime);
      video.removeEventListener('loadedmetadata', updateDuration);
      video.removeEventListener('ended', () => setIsPlaying(false));
    };
  }, [videoFile]);

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('video/')) {
      setError('Please select a valid video file');
      return;
    }

    if (file.size > 500 * 1024 * 1024) { // 500MB limit
      setError('File size too large. Please select a file under 500MB');
      return;
    }

    setError(null);
    setVideoFile(file);
    
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }
    
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
    setIsPlaying(!isPlaying);
  };

  const seekTo = (time: number) => {
    const video = videoRef.current;
    if (!video) return;
    
    video.currentTime = time;
    setCurrentTime(time);
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const timeline = timelineRef.current;
    if (!timeline || !duration) return;

    const rect = timeline.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const time = percentage * duration;
    
    seekTo(Math.max(0, Math.min(duration, time)));
  };

  const setTrimStart = () => {
    setTrimSettings(prev => ({
      ...prev,
      startTime: currentTime,
      duration: prev.endTime - currentTime
    }));
  };

  const setTrimEnd = () => {
    setTrimSettings(prev => ({
      ...prev,
      endTime: currentTime,
      duration: currentTime - prev.startTime
    }));
  };

  const resetTrim = () => {
    setTrimSettings({
      startTime: 0,
      endTime: duration,
      duration: duration
    });
  };

  const downloadTrimmedVideo = async () => {
    if (!videoFile) return;

    setIsProcessing(true);
    setError(null);

    try {
      // Create a simple trimmed video using canvas and MediaRecorder
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const video = videoRef.current!;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const stream = canvas.captureStream(30);
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9'
      });

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `trimmed_${videoFile.name.split('.')[0]}.webm`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
        setIsProcessing(false);
      };

      // Start recording
      mediaRecorder.start();
      
      // Seek to start time and play
      video.currentTime = trimSettings.startTime;
      video.play();
      
      // Draw frames to canvas
      const drawFrame = () => {
        if (video.currentTime >= trimSettings.endTime) {
          mediaRecorder.stop();
          video.pause();
          return;
        }
        
        ctx!.drawImage(video, 0, 0, canvas.width, canvas.height);
        requestAnimationFrame(drawFrame);
      };
      
      video.addEventListener('play', drawFrame, { once: true });
      
    } catch (err) {
      setError('Failed to process video. Please try again.');
      console.error(err);
      setIsProcessing(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div 
      className="min-h-screen bg-cover bg-center bg-fixed"
      style={{
        backgroundImage: "url('/images/bg_image.png')",
        fontFamily: '"Space Grotesk", "Noto Sans", sans-serif'
      }}
    >
      {/* Background overlay */}
      <div className="min-h-screen bg-black/10">
        <Navbar />
        
        {/* Spacer for fixed navbar */}
        <div className="h-16"></div>
        
        <main className="px-4 sm:px-10 md:px-20 lg:px-40 py-8">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
              <div className="bg-white/20 backdrop-blur-md border border-white/30 rounded-2xl p-6 shadow-xl">
                <h1 className="text-white text-3xl font-bold mb-2">Video Trimmer</h1>
                <p className="text-white/80 text-lg">Trim videos to specific lengths with precision</p>
              </div>
              
              {videoFile && (
                <button
                  onClick={downloadTrimmedVideo}
                  disabled={isProcessing || trimSettings.duration <= 0}
                  className="bg-white/20 backdrop-blur-md border border-white/30 rounded-2xl px-6 py-3 text-white hover:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center gap-3 shadow-xl"
                >
                  {isProcessing ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  )}
                  {isProcessing ? 'Processing...' : 'Download Trimmed'}
                </button>
              )}
            </div>

            {/* Upload Area */}
            {!videoFile && (
              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-12 mb-8 shadow-xl">
                <div
                  className={`border-2 border-dashed rounded-xl p-12 text-center transition-all duration-300 ${
                    dragActive 
                      ? 'border-white/60 bg-white/10' 
                      : 'border-white/30 hover:border-white/50 hover:bg-white/5'
                  }`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                >
                  <div className="space-y-6">
                    <svg className="mx-auto w-16 h-16 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    
                    <div>
                      <p className="text-xl font-semibold text-white mb-3">
                        {dragActive ? 'Drop video here' : 'Drag and drop video here'}
                      </p>
                      <p className="text-white/70 mb-6">or</p>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-white/20 backdrop-blur-md border border-white/30 rounded-xl px-8 py-4 text-white hover:bg-white/30 transition-all duration-300 font-medium"
                      >
                        Select Video
                      </button>
                    </div>
                    
                    <p className="text-sm text-white/60">
                      Supports: MP4, MOV, AVI, WebM (Max 500MB)
                    </p>
                  </div>
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*"
                    onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                    className="hidden"
                  />
                </div>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="bg-red-500/20 backdrop-blur-md border border-red-500/30 text-white px-6 py-4 rounded-2xl mb-8 flex items-center justify-between shadow-xl">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </div>
                <button 
                  onClick={() => setError(null)} 
                  className="text-white/70 hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            {/* Video Player */}
            {videoFile && (
              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl overflow-hidden shadow-xl mb-8">
                <div className="bg-black relative">
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    className="w-full aspect-video object-contain"
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                  />
                  
                  {/* Play/Pause Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity">
                    <button
                      onClick={togglePlayPause}
                      className="bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-full p-4 transition-all duration-300"
                    >
                      {isPlaying ? (
                        <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                        </svg>
                      ) : (
                        <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Video Info */}
                <div className="p-6 border-b border-white/10">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-semibold text-white text-lg">{videoFile.name}</h3>
                      <p className="text-white/70 mt-1">
                        {formatFileSize(videoFile.size)} • {formatTime(duration)}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setVideoFile(null);
                        setVideoUrl('');
                        setTrimSettings({ startTime: 0, endTime: 0, duration: 0 });
                      }}
                      className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl px-4 py-2 text-white hover:bg-white/20 transition-all duration-300"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                {/* Timeline */}
                <div className="p-6">
                  <div className="mb-6">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-white font-medium">Timeline</span>
                      <span className="text-white/70">{formatTime(currentTime)} / {formatTime(duration)}</span>
                    </div>
                    
                    <div
                      ref={timelineRef}
                      className="relative h-3 bg-white/20 rounded-full cursor-pointer backdrop-blur-md"
                      onClick={handleTimelineClick}
                    >
                      {/* Trim range */}
                      <div
                        className="absolute h-full bg-blue-400/50 rounded-full"
                        style={{
                          left: `${(trimSettings.startTime / duration) * 100}%`,
                          width: `${((trimSettings.endTime - trimSettings.startTime) / duration) * 100}%`
                        }}
                      />
                      
                      {/* Current position */}
                      <div
                        className="absolute top-0 w-1 h-full bg-white rounded-full transform -translate-x-0.5"
                        style={{ left: `${(currentTime / duration) * 100}%` }}
                      />
                      
                      {/* Trim markers */}
                      <div
                        className="absolute top-0 w-4 h-full bg-green-400 rounded-full transform -translate-x-2 cursor-move shadow-lg"
                        style={{ left: `${(trimSettings.startTime / duration) * 100}%` }}
                        title="Start time"
                      />
                      <div
                        className="absolute top-0 w-4 h-full bg-red-400 rounded-full transform -translate-x-2 cursor-move shadow-lg"
                        style={{ left: `${(trimSettings.endTime / duration) * 100}%` }}
                        title="End time"
                      />
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={togglePlayPause}
                        className="bg-white/20 backdrop-blur-md border border-white/30 rounded-xl p-3 text-white hover:bg-white/30 transition-all duration-300"
                      >
                        {isPlaying ? (
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z"/>
                          </svg>
                        )}
                      </button>
                      
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => seekTo(Math.max(0, currentTime - 5))}
                          className="bg-white/10 backdrop-blur-md border border-white/20 rounded-lg px-3 py-2 text-white hover:bg-white/20 transition-all duration-300 text-sm"
                        >
                          -5s
                        </button>
                        <button
                          onClick={() => seekTo(Math.min(duration, currentTime + 5))}
                          className="bg-white/10 backdrop-blur-md border border-white/20 rounded-lg px-3 py-2 text-white hover:bg-white/20 transition-all duration-300 text-sm"
                        >
                          +5s
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={setTrimStart}
                        className="bg-green-500/20 backdrop-blur-md border border-green-400/30 rounded-xl px-4 py-2 text-green-100 hover:bg-green-500/30 transition-all duration-300 flex items-center gap-2"
                      >
                        <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                        Set Start
                      </button>
                      <button
                        onClick={setTrimEnd}
                        className="bg-red-500/20 backdrop-blur-md border border-red-400/30 rounded-xl px-4 py-2 text-red-100 hover:bg-red-500/30 transition-all duration-300 flex items-center gap-2"
                      >
                        <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                        Set End
                      </button>
                      <button
                        onClick={resetTrim}
                        className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl px-4 py-2 text-white hover:bg-white/20 transition-all duration-300"
                      >
                        Reset
                      </button>
                    </div>
                  </div>

                  {/* Trim Info */}
                  <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4">
                    <div className="grid grid-cols-3 gap-6 text-sm">
                      <div className="text-center">
                        <span className="text-white/70 block mb-1">Start</span>
                        <span className="font-medium text-white text-lg">{formatTime(trimSettings.startTime)}</span>
                      </div>
                      <div className="text-center">
                        <span className="text-white/70 block mb-1">End</span>
                        <span className="font-medium text-white text-lg">{formatTime(trimSettings.endTime)}</span>
                      </div>
                      <div className="text-center">
                        <span className="text-white/70 block mb-1">Duration</span>
                        <span className="font-medium text-white text-lg">{formatTime(trimSettings.duration)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Features Info */}
            {!videoFile && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-8 text-center shadow-xl">
                  <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M12 5v.01M12 19v.01M12 9a3 3 0 003-3V5a3 3 0 00-6 0v1a3 3 0 003 3z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-white text-xl mb-3">Precise Trimming</h3>
                  <p className="text-white/70">Set exact start and end points with frame-level precision</p>
                </div>
                
                <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-8 text-center shadow-xl">
                  <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-white text-xl mb-3">Real-time Preview</h3>
                  <p className="text-white/70">See your changes instantly with built-in video player</p>
                </div>
                
                <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-8 text-center shadow-xl">
                  <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-white text-xl mb-3">Easy Export</h3>
                  <p className="text-white/70">Download your trimmed video in high quality</p>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default VideoTrimmerPage; 