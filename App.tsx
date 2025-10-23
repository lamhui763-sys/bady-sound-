import React, { useState, useEffect, useRef } from 'react';
import { CryRecord, CryType, TranslationResult, Subject } from './types';
import { translateAudio, analyzeVideoFrames } from './services/geminiService';
import { ANALYSIS_DETAILS } from './constants';

type Status = 'idle' | 'recording' | 'processing' | 'result';
type RecordMode = 'audio' | 'video';

const SUBJECT_CONFIG: Record<Subject, { title: string; subtitle: string; recordPlaceholder: (mode: RecordMode) => string }> = {
  Baby: {
    title: '寶寶行為解讀器',
    subtitle: 'AI 助您解讀寶寶的聲音、表情與動作',
    recordPlaceholder: (mode) => mode === 'audio' ? '錄製聲音' : '錄製行為'
  },
  Dog: {
    title: '狗狗行為解讀器',
    subtitle: 'AI 助您解讀汪星人的吠叫與肢體語言',
    recordPlaceholder: (mode) => mode === 'audio' ? '錄製吠叫聲' : '錄製行為'
  },
  Cat: {
    title: '貓咪行為解讀器',
    subtitle: 'AI 助您解讀喵星語及身體信號',
    recordPlaceholder: (mode) => mode === 'audio' ? '錄製喵喵聲' : '錄製行為'
  }
}

// Helper component for displaying the translation result
const TranslationCard: React.FC<{ record: CryRecord }> = ({ record }) => {
  const details = ANALYSIS_DETAILS[record.subject][record.cryType] || ANALYSIS_DETAILS[record.subject]['Unknown'];

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 w-full transform transition-all duration-500 hover:scale-105">
      <div className="flex items-center mb-4">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mr-4 ${details.bgColor} ${details.color}`}>
          {details.icon}
        </div>
        <div>
          <h3 className={`text-xl font-bold ${details.color}`}>{details.label}</h3>
          <p className="text-sm text-gray-500">{new Date(record.timestamp).toLocaleString()}</p>
        </div>
        <div className="ml-auto text-right">
            <div className={`text-lg font-semibold ${details.color}`}>{(record.confidence * 100).toFixed(0)}%</div>
            <div className="text-xs text-gray-400">信心指數</div>
        </div>
      </div>
      <div className="space-y-3">
        <p className="text-gray-700 font-medium">{record.suggestion}</p>
        <p className="text-gray-600 text-sm">{details.advice}</p>
      </div>
       {record.behavior && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <h4 className="font-semibold text-gray-800 mb-1">行為分析</h4>
          <p className="text-gray-600 text-sm">{record.behavior}</p>
        </div>
      )}
    </div>
  );
};

const SubjectSelector: React.FC<{ selected: Subject, onSelect: (subject: Subject) => void }> = ({ selected, onSelect }) => {
    const subjects: { key: Subject; icon: React.ReactNode; label: string }[] = [
        { key: 'Baby', label: '寶寶', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor"><path d="M10 3.5a1.5 1.5 0 013 0V4a1 1 0 001 1h.5a1.5 1.5 0 010 3h-.5a1 1 0 00-1 1v1.5a1.5 1.5 0 01-3 0V9a1 1 0 00-1-1h-.5a1.5 1.5 0 010-3h.5a1 1 0 001-1V3.5zM3.5 6.5a1.5 1.5 0 013 0V7a1 1 0 001 1h.5a1.5 1.5 0 010 3h-.5a1 1 0 00-1 1v1.5a1.5 1.5 0 01-3 0V11a1 1 0 00-1-1h-.5a1.5 1.5 0 010-3h.5a1 1 0 001-1V6.5zM10 12.5a1.5 1.5 0 013 0V13a1 1 0 001 1h.5a1.5 1.5 0 010 3h-.5a1 1 0 00-1 1v1.5a1.5 1.5 0 01-3 0V17a1 1 0 00-1-1h-.5a1.5 1.5 0 010-3h.5a1 1 0 001-1v-1.5z" /></svg> },
        { key: 'Dog', label: '狗狗', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 100-2 1 1 0 000 2zm7-1a1 1 0 11-2 0 1 1 0 012 0zm-7.536 5.879a.75.75 0 001.072 0l1.464-1.464a.75.75 0 00-1.072-1.072L8.464 12l-1.992-1.992a.75.75 0 00-1.072 1.072l2.52 2.52zM12 13a.75.75 0 000 1.5h.008a.75.75 0 000-1.5H12z" clipRule="evenodd" /></svg> },
        { key: 'Cat', label: '貓咪', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a1 1 0 00-1 1v1a1 1 0 002 0V3a1 1 0 00-1-1z" /><path d="M4 6a1 1 0 011-1h.5a1 1 0 01.7.3l1.5 1.5a1 1 0 001.4 0l1.5-1.5a1 1 0 01.7-.3H15a1 1 0 011 1v.5a1 1 0 01-.3.7l-1.5 1.5a1 1 0 000 1.4l1.5 1.5a1 1 0 01.3.7V14a1 1 0 01-1 1h-.5a1 1 0 01-.7-.3l-1.5-1.5a1 1 0 00-1.4 0l-1.5 1.5a1 1 0 01-.7.3H5a1 1 0 01-1-1v-.5a1 1 0 01.3-.7l1.5-1.5a1 1 0 000-1.4l-1.5-1.5a1 1 0 01-.3-.7V6z" /></svg> },
    ];
    return (
        <div className="flex justify-center gap-3 p-2 bg-blue-100 rounded-full mb-8">
            {subjects.map(({key, icon, label}) => (
                <button
                    key={key}
                    onClick={() => onSelect(key)}
                    className={`px-4 py-2 rounded-full flex items-center gap-2 transition-all duration-300
                        ${selected === key ? 'bg-white text-blue-700 shadow-md' : 'bg-transparent text-gray-500 hover:bg-blue-200'}
                    `}
                    aria-label={`選擇 ${label}`}
                >
                    {icon}
                    <span className="font-semibold">{label}</span>
                </button>
            ))}
        </div>
    )
}

const RecordModeSelector: React.FC<{ selected: RecordMode, onSelect: (mode: RecordMode) => void }> = ({ selected, onSelect }) => {
    return (
        <div className="flex justify-center p-1 bg-blue-200 rounded-full">
            <button
                onClick={() => onSelect('audio')}
                className={`px-6 py-2 rounded-full text-sm font-semibold transition-colors ${selected === 'audio' ? 'bg-white text-blue-700 shadow' : 'text-gray-600'}`}
            >
                錄音
            </button>
            <button
                onClick={() => onSelect('video')}
                className={`px-6 py-2 rounded-full text-sm font-semibold transition-colors ${selected === 'video' ? 'bg-white text-blue-700 shadow' : 'text-gray-600'}`}
            >
                錄影
            </button>
        </div>
    );
};

// Main App Component
export default function App() {
  const [subject, setSubject] = useState<Subject>('Baby');
  const [status, setStatus] = useState<Status>('idle');
  const [recordMode, setRecordMode] = useState<RecordMode>('audio');
  const [cameraFacingMode, setCameraFacingMode] = useState<'user' | 'environment'>('environment');
  const [statusText, setStatusText] = useState('');
  const [history, setHistory] = useState<CryRecord[]>([]);
  const [currentTranslation, setCurrentTranslation] = useState<CryRecord | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    try {
      const storedHistory = localStorage.getItem('cryHistory');
      if (storedHistory) {
        setHistory(JSON.parse(storedHistory));
      }
    } catch (error) {
      console.error("Failed to load history from localStorage", error);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('cryHistory', JSON.stringify(history));
    } catch (error) {
      console.error("Failed to save history to localStorage", error);
    }
  }, [history]);
  
  const extractFramesFromVideo = (videoFile: File, frameCount: number = 3): Promise<string[]> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const frames: string[] = [];
  
      if (!ctx) {
        return reject(new Error('Canvas context not available'));
      }
  
      video.preload = 'metadata';
      video.src = URL.createObjectURL(videoFile);
  
      video.onloadedmetadata = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const duration = video.duration;
        let framesExtracted = 0;
  
        if (duration < 1) {
            video.currentTime = 0;
            return;
        }

        const captureFrame = (time: number) => {
          video.currentTime = time;
        };
  
        video.onseeked = () => {
          ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
          const base64 = canvas.toDataURL('image/jpeg').split(',')[1];
          frames.push(base64);
          framesExtracted++;
  
          if (framesExtracted >= frameCount || video.currentTime >= duration) {
            URL.revokeObjectURL(video.src);
            resolve(frames);
          } else {
            const nextTime = (duration / (frameCount + 1)) * (framesExtracted + 1);
            if (nextTime <= duration) {
                captureFrame(nextTime);
            } else {
                URL.revokeObjectURL(video.src);
                resolve(frames);
            }
          }
        };
  
        video.onerror = (e) => {
            URL.revokeObjectURL(video.src);
            reject(new Error('Error loading video file for frame extraction'));
        }
        
        const firstTime = duration / (frameCount + 1);
        captureFrame(firstTime > 0 ? firstTime : 0);
      };

      video.load();
    });
  };

  const processFile = async (file: File) => {
    setStatus('processing');
    setCurrentTranslation(null);
    let result: TranslationResult;

    try {
      if (file.type.startsWith('audio/')) {
        setStatusText('AI 分析中...');
        result = await translateAudio(file, subject);
      } else if (file.type.startsWith('video/')) {
        setStatusText('正在提取影片畫面...');
        const frames = await extractFramesFromVideo(file);
        setStatusText('AI 分析中...');
        result = await analyzeVideoFrames(frames, subject);
      } else {
        throw new Error("Unsupported file type");
      }
        
      const newRecord: CryRecord = {
        id: new Date().toISOString(),
        timestamp: new Date().toISOString(),
        subject: subject,
        cryType: result.cryType || 'Unknown',
        confidence: result.confidence || 0.5,
        suggestion: result.suggestion || '無法提供建議。',
        behavior: result.behavior,
      };

      setCurrentTranslation(newRecord);
      setHistory(prevHistory => [newRecord, ...prevHistory]);
      setStatus('result');
    } catch (error) {
      console.error("Processing failed:", error);
      const errorRecord: CryRecord = {
          id: new Date().toISOString(),
          timestamp: new Date().toISOString(),
          subject: subject,
          cryType: 'Unknown',
          confidence: 0,
          suggestion: '分析失敗，請稍後再試。'
      };
      setCurrentTranslation(errorRecord);
      setStatus('result');
    }
  };


  const handleStopAndProcess = () => {
    const mimeType = recordMode === 'audio' ? 'audio/webm' : 'video/webm';
    const blob = new Blob(mediaChunksRef.current, { type: mimeType });
    const fileName = recordMode === 'audio' ? 'recording.webm' : 'recording.mp4';
    processFile(new File([blob], fileName, {type: mimeType}));

    mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());
    if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = null;
        videoPreviewRef.current.style.transform = 'none';
    }
    mediaRecorderRef.current = null;
    mediaChunksRef.current = [];
  };

  const handleStartRecording = async () => {
    setStatus('recording');
    setCurrentTranslation(null);
    try {
      const constraints = {
        audio: true,
        video: recordMode === 'video' ? { facingMode: cameraFacingMode } : false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (recordMode === 'video' && videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.style.transform = cameraFacingMode === 'user' ? 'scaleX(-1)' : 'none';
        videoPreviewRef.current.play().catch(console.error);
      }
      
      mediaRecorderRef.current = new MediaRecorder(stream);
      mediaChunksRef.current = [];
      mediaRecorderRef.current.addEventListener('dataavailable', (event) => mediaChunksRef.current.push(event.data));
      mediaRecorderRef.current.addEventListener('stop', handleStopAndProcess);
      mediaRecorderRef.current.start();
    } catch (error) {
      console.error("Error accessing media devices:", error);
      setStatus('idle');
      alert("無法取用麥克風或攝影機。請確認已授權使用。");
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && status === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };
  
  const handleCameraSwitch = () => {
    setCameraFacingMode(prev => (prev === 'user' ? 'environment' : 'user'));
  };

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processFile(file);
    }
    if (event.target) event.target.value = '';
  };

  const handleHistoryClick = (record: CryRecord) => {
    setCurrentTranslation(record);
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  useEffect(() => {
    switch (status) {
      case 'recording':
        setStatusText(recordMode === 'audio' ? '正在錄音...' : '正在錄影...');
        break;
      case 'result':
        setStatusText('分析結果');
        break;
      case 'idle':
        setStatusText(`點擊按鈕開始${SUBJECT_CONFIG[subject].recordPlaceholder(recordMode)}`);
        break;
      // 'processing' status text is set within processFile
    }
  }, [status, subject, recordMode]);
  
  const emptyStateMessages: Record<Subject, string> = {
    Baby: "錄下寶寶的聲音或行為影片，<br/>讓 AI 幫您解讀背後的需求。",
    Dog: "錄下狗狗的叫聲或行為影片，<br/>讓 AI 幫您了解牠的情緒。",
    Cat: "錄下貓咪的叫聲或行為影片，<br/>讓 AI 幫您破解牠的心思。"
  };


  return (
    <div className="min-h-screen bg-blue-50 font-sans p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto">
        <header className="text-center mb-4">
          <h1 className="text-4xl font-bold text-blue-800">{SUBJECT_CONFIG[subject].title}</h1>
          <p className="text-gray-500 mt-2">{SUBJECT_CONFIG[subject].subtitle}</p>
        </header>

        <main className="flex flex-col items-center gap-6">
          <SubjectSelector selected={subject} onSelect={(s) => { setSubject(s); setCurrentTranslation(null); setStatus('idle'); }} />

          {status === 'recording' && recordMode === 'video' && (
              <div className="w-full max-w-md bg-black rounded-lg shadow-lg overflow-hidden mb-4">
                  <video ref={videoPreviewRef} muted className="w-full h-auto"></video>
              </div>
          )}

          <div className="flex justify-center items-center gap-2 mb-4">
            <RecordModeSelector selected={recordMode} onSelect={(mode) => { setRecordMode(mode); setStatus('idle'); }} />
             {recordMode === 'video' && status !== 'recording' && status !== 'processing' && (
              <button
                onClick={handleCameraSwitch}
                className="p-3 bg-blue-200 rounded-full text-gray-600 hover:bg-blue-300 transition-colors shadow-sm"
                aria-label={cameraFacingMode === 'user' ? '切換至後置鏡頭' : '切換至前置鏡頭'}
                title={cameraFacingMode === 'user' ? '切換至後置鏡頭' : '切換至前置鏡頭'}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 9a9 9 0 0114.65-5.65L20 5M20 15a9 9 0 01-14.65 5.65L4 19" />
                </svg>
              </button>
            )}
          </div>
          
          <div className="relative w-48 h-48 flex items-center justify-center">
            {status === 'recording' && <div className="absolute inset-0 bg-yellow-300 rounded-full animate-ping"></div>}
            <button
              onClick={status === 'recording' ? handleStopRecording : handleStartRecording}
              disabled={status === 'processing'}
              className={`relative w-40 h-40 rounded-full flex items-center justify-center transition-all duration-300 ${status === 'recording' ? 'bg-red-500 hover:bg-red-600' : 'bg-yellow-400 hover:bg-yellow-500'} ${status === 'processing' ? 'bg-gray-400 cursor-not-allowed' : ''} shadow-xl text-white`}
              aria-label={status === 'recording' ? (recordMode === 'audio' ? '停止錄音' : '停止錄影') : (recordMode === 'audio' ? '開始錄音' : '開始錄影')}
            >
              {recordMode === 'audio' ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-20 w-20" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H7a1 1 0 100 2h6a1 1 0 100-2h-2v-2.07z" clipRule="evenodd" /></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-20 w-20" viewBox="0 0 20 20" fill="currentColor"><path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" /><path d="M14.553 7.106A1 1 0 0014 8v4a1 1 0 001.553.832l3-2a1 1 0 000-1.664l-3-2z" /></svg>
              )}
            </button>
          </div>
          <p className="text-lg text-blue-700 font-medium h-6">{statusText}</p>

          <div className="text-center">
            <button onClick={handleUploadClick} disabled={status === 'processing' || status === 'recording'} className="flex items-center gap-2 px-6 py-2 bg-white border border-blue-300 text-blue-700 rounded-full hover:bg-blue-100 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
              <span>上傳檔案</span>
            </button>
          </div>
          <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="audio/*,video/*" className="hidden" />

          {currentTranslation && <div className="w-full mt-4"><TranslationCard record={currentTranslation} /></div>}

          {history.length > 0 && (
            <section className="w-full mt-8">
              <h2 className="text-2xl font-bold text-blue-800 mb-4 text-center">歷史紀錄</h2>
              <div className="space-y-4">
                {history.map(record => {
                  const details = ANALYSIS_DETAILS[record.subject]?.[record.cryType] || ANALYSIS_DETAILS[record.subject]?.['Unknown'];
                  return (
                    <div 
                      key={record.id} 
                      onClick={() => handleHistoryClick(record)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleHistoryClick(record); }}
                      className="bg-white rounded-lg p-4 shadow-md flex items-center gap-4 cursor-pointer hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
                      role="button"
                      tabIndex={0}
                      aria-label={`查看 ${new Date(record.timestamp).toLocaleString()} 的分析紀錄`}
                    >
                       <div className={`w-10 h-10 rounded-full flex items-center justify-center ${details.bgColor} ${details.color}`}>
                         {details.icon}
                       </div>
                       <div className="flex-grow">
                          <p className="font-semibold text-gray-800">{details.label}</p>
                          <p className="text-sm text-gray-500">{new Date(record.timestamp).toLocaleTimeString()}</p>
                       </div>
                       <p className="text-gray-600 text-sm w-1/3 truncate" title={record.suggestion}>{record.suggestion}</p>
                       {record.behavior && (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 001.553.832l3-2a1 1 0 000-1.664l-3-2z" /></svg>
                       )}
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {history.length === 0 && !currentTranslation && (
             <div className="text-center text-gray-500 mt-12 p-8 bg-blue-100 rounded-2xl">
                <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                <p className="mt-4 text-lg" dangerouslySetInnerHTML={{ __html: emptyStateMessages[subject] }}></p>
             </div>
          )}

        </main>
      </div>
    </div>
  );
}