import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Play, RotateCcw, Users, BarChart3, Cloud, ChevronLeft, ChevronRight, LogOut, RefreshCw, Zap } from 'lucide-react';
import socket from '../socket.js';

export default function Presenter({ joinCode }) {
  const [session, setSession] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [results, setResults] = useState({});
  const [activeCount, setActiveCount] = useState(0);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSimulating, setIsSimulating] = useState(false);

  const directJoinUrl = `${window.location.origin}/#/vote/${joinCode}`;

  useEffect(() => {
    // 1. Fetch Session Info
    const fetchSession = async () => {
      try {
        const res = await fetch(`/api/sessions/${joinCode}`);
        if (!res.ok) throw new Error('Session not found');
        const data = await res.json();
        
        setSession(data);
        setQuestions(data.questions);

        // Find active question
        const active = data.questions.find(q => q.id === data.active_question_id) || data.questions[0];
        setActiveQuestion(active);

        // Fetch initial results for this active question
        if (active) {
          const resQuery = await fetch(`/api/questions/${active.id}/results`);
          if (resQuery.ok) {
            const initialResults = await resQuery.json();
            setResults(initialResults);
          }
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSession();
  }, [joinCode]);

  useEffect(() => {
    if (!activeQuestion) return;

    // Connect to WebSocket and join session
    socket.connect();
    socket.emit('join-session', { joinCode, role: 'host' });

    // Socket Event Listeners
    socket.on('participant-count', (count) => {
      setActiveCount(count);
    });

    socket.on('results-update', (newResults) => {
      setResults(newResults);
    });

    socket.on('question-changed', async (newQuestion) => {
      setActiveQuestion(newQuestion);
      // Fetch results for the new question immediately
      try {
        const resQuery = await fetch(`/api/questions/${newQuestion.id}/results`);
        if (resQuery.ok) {
          const newResults = await resQuery.json();
          setResults(newResults);
        }
      } catch (err) {
        console.error("Failed to fetch new results:", err);
      }
    });

    socket.on('error', (errMsg) => {
      console.error("Socket error:", errMsg);
    });

    return () => {
      socket.off('participant-count');
      socket.off('results-update');
      socket.off('question-changed');
      socket.off('error');
    };
  }, [activeQuestion, joinCode]);

  // Navigate Questions (Advance/Back)
  const changeQuestion = (index) => {
    if (index < 0 || index >= questions.length) return;
    const targetQuestion = questions[index];
    socket.emit('change-question', { joinCode, questionId: targetQuestion.id });
  };

  // Reset Results
  const resetQuestion = () => {
    if (!activeQuestion) return;
    if (window.confirm("Are you sure you want to clear all votes for this question?")) {
      socket.emit('reset-question', { questionId: activeQuestion.id, joinCode });
    }
  };

  // Simulate incoming crowd votes
  const simulateVotes = (count = 100) => {
    if (!activeQuestion || isSimulating) return;
    setIsSimulating(true);
    socket.emit('simulate-votes', { questionId: activeQuestion.id, joinCode, count });
    setTimeout(() => {
      setIsSimulating(false);
    }, 2000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <RefreshCw className="w-8 h-8 text-brand-teal animate-spin" />
        <span className="text-slate-400">Loading your presentation...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="glass-card p-8 rounded-3xl border-brand-rose/20 max-w-md text-center">
          <h2 className="text-xl font-bold text-brand-rose mb-2">Error</h2>
          <p className="text-slate-300 mb-6">{error}</p>
          <button
            onClick={() => window.location.hash = '/'}
            className="bg-white/10 hover:bg-white/20 text-white font-semibold py-2.5 px-6 rounded-xl transition-all"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const activeIndex = questions.findIndex(q => q.id === activeQuestion?.id);

  // Word Cloud Generator calculations
  const renderWordCloud = () => {
    const words = Object.entries(results);
    if (words.length === 0) {
      return (
        <div className="h-full flex items-center justify-center text-slate-500 italic">
          Awaiting submissions from participants...
        </div>
      );
    }

    // Find min and max count for scaling
    const counts = words.map(([_, count]) => Number(count) || 0);
    const maxCount = Math.max(...counts);
    const minCount = Math.min(...counts);

    // Color array for words (Green palette)
    const colors = [
      'text-emerald-400 shadow-emerald-500/20',
      'text-teal-300 shadow-teal-500/20',
      'text-lime-400 shadow-lime-500/20',
      'text-emerald-300 shadow-emerald-400/20',
      'text-green-400 shadow-green-500/20',
      'text-lime-300 shadow-lime-400/20',
    ];

    return (
      <div className="flex flex-wrap items-center justify-center gap-4 p-8 min-h-[300px] max-h-[450px] overflow-y-auto">
        {words.map(([word, rawCount], i) => {
          const count = Number(rawCount) || 0;
          // Font size calculation (1rem to 3.5rem)
          const range = maxCount - minCount;
          const factor = range > 0 ? (count - minCount) / range : 0.5;
          const fontSize = 1 + factor * 2.5; // in rem
          
          const colorClass = colors[i % colors.length];

          return (
            <span
              key={word}
              style={{ fontSize: `${fontSize}rem` }}
              className={`font-bold tracking-wide transition-all duration-300 transform hover:scale-110 cursor-default px-3 py-1.5 rounded-2xl bg-white/5 border border-white/5 animate-float ${colorClass}`}
              title={`${count} vote(s)`}
            >
              {word}
              {count > 1 && (
                <span className="text-[10px] ml-1.5 bg-white/10 px-1.5 py-0.5 rounded-full align-middle font-normal text-slate-400">
                  {count}
                </span>
              )}
            </span>
          );
        })}
      </div>
    );
  };

  // Bar Chart calculations
  const renderBarChart = () => {
    const options = activeQuestion.options || [];
    const totalVotes = Object.values(results).reduce((acc, val) => acc + (Number(val) || 0), 0);

    return (
      <div className="space-y-4 p-4 md:p-6">
        {options.map((option, idx) => {
          const voteCount = Number(results[option]) || 0;
          const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
          
          // Generate a green gradient class based on index
          const gradients = [
            'from-emerald-500 to-green-600',
            'from-teal-400 to-emerald-600',
            'from-lime-500 to-emerald-600',
            'from-emerald-400 to-teal-700',
            'from-green-400 to-emerald-700'
          ];
          const gradientClass = gradients[idx % gradients.length];

          return (
            <div key={option} className="space-y-1">
              <div className="flex justify-between text-sm font-semibold">
                <span className="text-slate-300">{option}</span>
                <span className="text-slate-400">
                  {voteCount} vote{voteCount !== 1 ? 's' : ''} ({percentage}%)
                </span>
              </div>
              <div className="w-full bg-brand-dark/60 rounded-full h-8 overflow-hidden border border-white/5 relative">
                <div
                  className={`h-full bg-gradient-to-r ${gradientClass} rounded-full transition-all duration-500 ease-out`}
                  style={{ width: `${percentage}%` }}
                ></div>
                {percentage > 3 && (
                  <span className="absolute inset-y-0 left-3 flex items-center text-xs font-bold text-brand-dark">
                    {percentage}%
                  </span>
                )}
              </div>
            </div>
          );
        })}
        {options.length === 0 && (
          <div className="text-slate-500 italic text-center py-8">
            No options configured for this question.
          </div>
        )}
      </div>
    );
  };

  const totalVotesCount = Object.values(results).reduce((acc, val) => acc + (Number(val) || 0), 0);

  return (
    <div className="relative min-h-screen grid-bg p-4 md:p-8 flex flex-col justify-between">
      {/* Dynamic Background Blurs */}
      <div className="absolute top-10 left-10 w-96 h-96 bg-brand-glowPurple rounded-full blur-[140px] pointer-events-none"></div>
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-brand-glowTeal rounded-full blur-[140px] pointer-events-none"></div>

      {/* Presentation Bento Header */}
      <header className="glass-card p-4 md:p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 mb-6 z-10">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-brand-violet">Presentation Room</span>
          <h1 className="text-xl md:text-2xl font-black text-white leading-tight">{session.title}</h1>
        </div>

        {/* Join Block (Large code & URL) */}
        <div className="flex items-center gap-6 bg-brand-dark/50 border border-white/5 py-2.5 px-6 rounded-2xl">
          <div className="text-right">
            <span className="text-xs font-bold text-slate-500 block uppercase">Join URL</span>
            <span className="text-sm font-semibold text-brand-teal font-sans block">{directJoinUrl.replace('http://', '').replace('https://', '')}</span>
          </div>
          <div className="h-8 w-px bg-white/10"></div>
          <div>
            <span className="text-xs font-bold text-slate-500 block uppercase">Enter Code</span>
            <span className="text-2xl font-black text-white tracking-widest font-sans">{joinCode}</span>
          </div>
        </div>
      </header>

      {/* Main Bento Grid */}
      <main className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-stretch flex-grow mb-6 z-10">
        
        {/* Left Column: QR Code & Connections Info */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          {/* Bento Box: Join QR Code */}
          <div className="glass-card p-6 rounded-3xl flex flex-col items-center justify-center text-center flex-grow">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Scan to Join</h3>
            <div className="bg-white p-4 rounded-2xl shadow-lg border border-brand-teal/20 glow-teal mb-4 transform hover:scale-105 transition-transform duration-300">
              <QRCodeSVG value={directJoinUrl} size={150} level="M" includeMargin={false} />
            </div>
            <p className="text-xs text-slate-400 max-w-[180px] leading-relaxed">
              Open your smartphone camera to join and vote instantly.
            </p>
          </div>

          {/* Bento Box: Live Participant Count */}
          <div className="glass-card p-6 rounded-3xl flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Active Users</span>
              <span className="text-3xl font-black text-white leading-none font-sans mt-1 block">
                {activeCount}
              </span>
            </div>
            <div className="bg-brand-glowTeal p-4 rounded-2xl text-brand-teal border border-brand-teal/10">
              <Users className="w-7 h-7" />
            </div>
          </div>
        </div>

        {/* Center/Right Column: Live Chart Display */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          {/* Bento Box: Question Display & Live Chart */}
          <div className="glass-card p-6 md:p-8 rounded-3xl flex-grow flex flex-col justify-between">
            {/* Header info */}
            <div className="flex justify-between items-start border-b border-white/5 pb-4 mb-6">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 bg-white/5 py-1 px-3 rounded-full">
                  Question {activeIndex + 1} of {questions.length} • {activeQuestion.type === 'bar' ? 'Bar Chart' : 'Word Cloud'}
                </span>
                <h2 className="text-xl md:text-2xl font-extrabold text-white mt-3 font-sans">
                  {activeQuestion.text}
                </h2>
              </div>
              <div className="text-brand-violet bg-brand-glowPurple p-2 rounded-xl">
                {activeQuestion.type === 'bar' ? <BarChart3 className="w-6 h-6" /> : <Cloud className="w-6 h-6" />}
              </div>
            </div>

            {/* Live Chart Visualizer */}
            <div className="flex-grow flex flex-col justify-center">
              {activeQuestion.type === 'bar' ? renderBarChart() : renderWordCloud()}
            </div>

            {/* Footer count */}
            <div className="text-right text-xs text-slate-500 border-t border-white/5 pt-4 mt-6">
              Total Votes Submitted: {totalVotesCount}
            </div>
          </div>
        </div>
      </main>

      {/* Presenter Footer Control Board */}
      <footer className="glass-card p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 z-10">
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.location.hash = '/'}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 py-2 px-4 rounded-xl border border-white/5 transition-all font-semibold"
          >
            <LogOut className="w-3.5 h-3.5" /> End Session
          </button>
        </div>

        {/* Center Controls: Question Nav & Simulation Controls */}
        <div className="flex items-center gap-3">
          {/* Navigation buttons */}
          <div className="flex items-center gap-3 bg-brand-dark/50 p-1.5 rounded-xl border border-white/5">
            <button
              disabled={activeIndex === 0}
              onClick={() => changeQuestion(activeIndex - 1)}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
              title="Previous Question"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            <span className="text-xs font-bold text-slate-300 px-2 min-w-[70px] text-center font-sans">
              Slide {activeIndex + 1} / {questions.length}
            </span>

            <button
              disabled={activeIndex === questions.length - 1}
              onClick={() => changeQuestion(activeIndex + 1)}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
              title="Next Question"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Crowd Simulation Action Buttons */}
          <div className="flex items-center gap-1 bg-brand-dark/50 p-1.5 rounded-xl border border-white/5">
            <button
              disabled={isSimulating}
              onClick={() => simulateVotes(100)}
              className="flex items-center gap-1 text-xs font-bold text-brand-teal hover:text-teal-300 bg-brand-teal/10 hover:bg-brand-teal/20 px-3 py-2 rounded-lg border border-brand-teal/20 transition-all disabled:opacity-40"
              title="Simulate 100 live user votes"
            >
              <Zap className={`w-3.5 h-3.5 ${isSimulating ? 'animate-bounce text-brand-amber' : ''}`} />
              Simulate 100 Votes
            </button>
            <button
              disabled={isSimulating}
              onClick={() => simulateVotes(10)}
              className="text-[11px] font-semibold text-slate-400 hover:text-white hover:bg-white/5 px-2 py-2 rounded-lg transition-all disabled:opacity-40"
              title="Simulate 10 votes"
            >
              +10
            </button>
          </div>
        </div>

        {/* Reset Counter Button */}
        <div>
          <button
            onClick={resetQuestion}
            className="flex items-center gap-1.5 text-xs text-brand-rose hover:text-rose-400 bg-brand-rose/10 hover:bg-brand-rose/20 py-2 px-4 rounded-xl border border-brand-rose/20 transition-all font-semibold"
            title="Reset active question votes"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Clear Votes
          </button>
        </div>
      </footer>
    </div>
  );
}
