import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { ArrowLeft, Send, CheckCircle2, CloudLightning, RefreshCw, AlertTriangle } from 'lucide-react';
import socket from '../socket.js';

export default function Participant({ joinCode }) {
  const [session, setSession] = useState(null);
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [selectedValue, setSelectedValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Voting feedback state
  const [hasVoted, setHasVoted] = useState(false);
  const [votedValue, setVotedValue] = useState('');
  const [votedCount, setVotedCount] = useState(0);

  // Network/Connection status
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 1. Fetch initial session details via REST
    const fetchSession = async () => {
      try {
        const res = await fetch(`/api/sessions/${joinCode}`);
        if (!res.ok) throw new Error('Session not found');
        const data = await res.json();
        setSession(data);

        const active = data.questions.find(q => q.id === data.active_question_id) || data.questions[0];
        setActiveQuestion(active);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSession();
  }, [joinCode]);

  useEffect(() => {
    // 2. Setup WS listeners
    socket.connect();

    const handleConnect = () => {
      setIsConnected(true);
      setReconnectAttempt(0);
      socket.emit('join-session', { joinCode, role: 'voter' });
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    const handleReconnectAttempt = (attempt) => {
      setReconnectAttempt(attempt);
    };

    if (socket.connected) {
      handleConnect();
    }

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('reconnect_attempt', handleReconnectAttempt);

    // Host advanced the question
    socket.on('question-changed', (newQuestion) => {
      setActiveQuestion(newQuestion);
      // Reset participant voting status for the new question
      setHasVoted(false);
      setVotedValue('');
      setVotedCount(0);
      setSelectedValue('');
      setIsSubmitting(false);
    });

    // Received feedback confirmation of vote
    socket.on('vote-confirmed', ({ value, count }) => {
      setVotedValue(value);
      setVotedCount(count);
      setHasVoted(true);
      setIsSubmitting(false);

      // Trigger beautiful confetti celebration
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#8b5cf6', '#14b8a6', '#d946ef']
      });
    });

    socket.on('error', (errMsg) => {
      setError(errMsg);
      setIsSubmitting(false);
    });

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('reconnect_attempt', handleReconnectAttempt);
      socket.off('question-changed');
      socket.off('vote-confirmed');
      socket.off('error');
    };
  }, [joinCode]);

  // Submit vote payload
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedValue.trim() || isSubmitting) return;

    setIsSubmitting(true);
    socket.emit('submit-vote', {
      questionId: activeQuestion.id,
      value: selectedValue.trim()
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <RefreshCw className="w-8 h-8 text-brand-teal animate-spin" />
        <span className="text-slate-400">Joining session...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="glass-card p-6 rounded-3xl border-brand-rose/20 text-center max-w-sm w-full">
          <h2 className="text-lg font-bold text-brand-rose mb-2">Failed to Join</h2>
          <p className="text-sm text-slate-300 mb-6">{error}</p>
          <button
            onClick={() => window.location.hash = '/'}
            className="w-full bg-white/10 hover:bg-white/20 text-white font-semibold py-3 rounded-xl transition-all"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid-bg flex flex-col justify-between p-4 relative">
      
      {/* Background blurs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-72 h-72 bg-brand-glowPurple rounded-full blur-[90px] pointer-events-none opacity-50"></div>

      {/* Header / Connection Status */}
      <header className="flex items-center justify-between z-10">
        <button
          onClick={() => window.location.hash = '/'}
          className="p-2 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl border border-white/5 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <span className="font-extrabold text-lg text-white font-sans">
          Vibe<span className="text-brand-teal">Poll</span>
        </span>

        {/* Dynamic connection indicator */}
        <div className="flex items-center gap-1.5 bg-brand-dark/60 border border-white/5 py-1 px-3 rounded-full">
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-brand-teal animate-pulse' : 'bg-brand-rose'}`}></span>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {isConnected ? 'Connected' : 'Reconnecting...'}
          </span>
        </div>
      </header>

      {/* Reconnection alert banner */}
      {!isConnected && (
        <div className="my-2 z-10 glass-card border-brand-rose/30 bg-brand-rose/5 p-3 rounded-xl flex items-center gap-2.5 text-xs text-brand-rose">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 animate-bounce" />
          <div>
            <span className="font-bold">Connection lost.</span> Attempting to reconnect (Attempt {reconnectAttempt})...
          </div>
        </div>
      )}

      {/* Main Form Area */}
      <main className="my-auto flex items-center justify-center py-6 z-10">
        <div className="w-full max-w-md glass-card p-6 md:p-8 rounded-3xl animate-scale-in">
          
          {!activeQuestion ? (
            <div className="text-center text-slate-400 py-8">
              <CloudLightning className="w-8 h-8 mx-auto mb-3 text-brand-violet animate-bounce" />
              <p className="font-semibold">Waiting for the presenter...</p>
              <p className="text-xs text-slate-500 mt-1">The host hasn't started presenting a slide yet.</p>
            </div>
          ) : !hasVoted ? (
            /* Voting Interface */
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <span className="text-xs font-bold text-brand-violet uppercase tracking-widest block mb-2">
                  Active Question
                </span>
                <h2 className="text-xl font-bold text-white font-sans leading-tight">
                  {activeQuestion.text}
                </h2>
              </div>

              {/* Form Input fields */}
              {activeQuestion.type === 'bar' ? (
                /* Multiple Choice Options */
                <div className="space-y-3">
                  {(activeQuestion.options || []).map((option) => {
                    const isSelected = selectedValue === option;
                    return (
                      <label
                        key={option}
                        className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-brand-violet/20 border-brand-violet text-white shadow-lg shadow-violet-500/10'
                            : 'bg-brand-dark/40 border-white/5 text-slate-300 hover:bg-white/5'
                        }`}
                      >
                        <span className="font-medium text-sm pr-4">{option}</span>
                        <input
                          type="radio"
                          name="bar-option"
                          value={option}
                          checked={isSelected}
                          onChange={(e) => setSelectedValue(e.target.value)}
                          className="w-4 h-4 text-brand-violet bg-brand-dark/50 border-white/10 focus:ring-brand-violet focus:ring-offset-brand-dark"
                        />
                      </label>
                    );
                  })}
                </div>
              ) : (
                /* Word Cloud Input Field */
                <div className="space-y-2">
                  <label htmlFor="wordInput" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Your Response (Max 25 characters)
                  </label>
                  <div className="relative">
                    <input
                      id="wordInput"
                      type="text"
                      maxLength={25}
                      value={selectedValue}
                      onChange={(e) => setSelectedValue(e.target.value)}
                      placeholder="Type a word or short phrase..."
                      className="w-full bg-brand-dark/50 border border-white/10 focus:border-brand-violet/60 focus:ring-1 focus:ring-brand-violet/30 outline-none text-white px-4 py-3.5 pr-10 rounded-xl transition-all font-sans text-sm"
                    />
                  </div>
                </div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={!selectedValue.trim() || isSubmitting || !isConnected}
                className="w-full bg-gradient-to-r from-brand-violet to-brand-teal text-white font-bold py-3.5 px-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed text-sm"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" /> Submit Vote
                  </>
                )}
              </button>
            </form>
          ) : (
            /* Vote Confirmed Screen (Immediate feedback) */
            <div className="text-center py-6 space-y-6">
              <div className="inline-flex bg-brand-teal/10 border border-brand-teal/20 p-4 rounded-full text-brand-teal glow-teal animate-scale-in">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              
              <div className="space-y-2">
                <h2 className="text-2xl font-black text-white font-sans">Vote Submitted!</h2>
                <p className="text-sm text-slate-400">Your answer was recorded successfully.</p>
              </div>

              {/* Instant feedback calculation box */}
              <div className="bg-brand-dark/60 border border-white/5 p-5 rounded-2xl text-center space-y-2.5">
                <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Your selection</div>
                <div className="text-lg font-black text-brand-teal font-sans">"{votedValue}"</div>
                
                <div className="h-px bg-white/5 my-2"></div>
                
                <p className="text-sm text-slate-300 leading-relaxed px-2">
                  This answer has been submitted <span className="font-bold text-brand-violet text-base">{votedCount}</span> time{votedCount !== 1 ? 's' : ''} across this session so far!
                </p>
              </div>

              <p className="text-xs text-slate-500 italic animate-pulse-slow">
                Keep this screen open. When the presenter switches to the next slide, your screen will update automatically.
              </p>
            </div>
          )}

        </div>
      </main>

      {/* Footer code display */}
      <footer className="text-center text-xs text-slate-500 py-2 z-10">
        Connected to session code: <span className="font-bold font-sans text-slate-400 tracking-wider">{joinCode}</span>
      </footer>

    </div>
  );
}
