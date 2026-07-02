import React, { useState } from 'react';
import { Sparkles, Users, Presentation, Plus, Trash2, ArrowRight } from 'lucide-react';

export default function Landing() {
  // Join Session State
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  // Create Session State
  const [sessionTitle, setSessionTitle] = useState('');
  const [questions, setQuestions] = useState([
    { type: 'bar', text: 'Which programming language do you prefer?', options: ['JavaScript', 'Go', 'Rust', 'Python'] },
    { type: 'wordcloud', text: 'Describe web development in ONE word.', options: null }
  ]);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Handle Join Session
  const handleJoin = async (e) => {
    e.preventDefault();
    if (joinCode.length !== 6) {
      setJoinError('Please enter a valid 6-digit code.');
      return;
    }
    setJoinError('');
    setIsJoining(true);

    try {
      const res = await fetch(`/api/sessions/${joinCode}`);
      if (!res.ok) {
        throw new Error('Session not found. Check the code and try again.');
      }
      const data = await res.json();
      window.location.hash = `#/vote/${data.join_code}`;
    } catch (err) {
      setJoinError(err.message);
      setIsJoining(false);
    }
  };

  // Add a new question to the builder
  const addQuestion = (type) => {
    if (type === 'bar') {
      setQuestions([
        ...questions,
        { type: 'bar', text: '', options: ['Option 1', 'Option 2'] }
      ]);
    } else {
      setQuestions([
        ...questions,
        { type: 'wordcloud', text: '', options: null }
      ]);
    }
  };

  // Remove a question
  const removeQuestion = (index) => {
    if (questions.length === 1) return;
    setQuestions(questions.filter((_, i) => i !== index));
  };

  // Modify question text
  const updateQuestionText = (index, val) => {
    const updated = [...questions];
    updated[index].text = val;
    setQuestions(updated);
  };

  // Modify options for MC questions
  const updateQuestionOption = (qIndex, optIndex, val) => {
    const updated = [...questions];
    updated[qIndex].options[optIndex] = val;
    setQuestions(updated);
  };

  // Add an option to a MC question
  const addOption = (qIndex) => {
    const updated = [...questions];
    updated[qIndex].options.push(`Option ${updated[qIndex].options.length + 1}`);
    setQuestions(updated);
  };

  // Remove an option from MC question
  const removeOption = (qIndex, optIndex) => {
    const updated = [...questions];
    if (updated[qIndex].options.length <= 2) return;
    updated[qIndex].options.splice(optIndex, 1);
    setQuestions(updated);
  };

  // Handle Create Session
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!sessionTitle.trim()) {
      setCreateError('Please enter a session title.');
      return;
    }
    
    // Validate question fields
    for (const [i, q] of questions.entries()) {
      if (!q.text.trim()) {
        setCreateError(`Please fill in the text for question #${i + 1}`);
        return;
      }
      if (q.type === 'bar') {
        const cleanOpts = q.options.filter(opt => opt.trim() !== '');
        if (cleanOpts.length < 2) {
          setCreateError(`Multiple Choice question #${i + 1} must have at least 2 options.`);
          return;
        }
      }
    }

    setCreateError('');
    setIsCreating(true);

    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: sessionTitle,
          questions: questions.map(q => ({
            type: q.type,
            text: q.text,
            options: q.type === 'bar' ? q.options.filter(o => o.trim() !== '') : null
          }))
        })
      });

      if (!res.ok) {
        throw new Error('Failed to create session. Please try again.');
      }

      const data = await res.json();
      // Redirect to host dashboard
      window.location.hash = `#/presenter/${data.join_code}`;
    } catch (err) {
      setCreateError(err.message);
      setIsCreating(false);
    }
  };

  return (
    <div className="relative min-h-screen grid-bg flex flex-col items-center justify-center p-4 md:p-8">
      {/* Dynamic Background Light Blurs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-glowPurple rounded-full blur-[120px] pointer-events-none animate-pulse-slow"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-brand-glowTeal rounded-full blur-[120px] pointer-events-none animate-pulse-slow"></div>

      {/* Header */}
      <div className="text-center mb-8 animate-fade-in">
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="bg-gradient-to-tr from-brand-violet to-brand-teal p-3 rounded-2xl glow-purple animate-float">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <span className="font-extrabold text-4xl md:text-5xl tracking-tight text-white font-sans">
            Vibe<span className="text-brand-teal">Poll</span>
          </span>
        </div>
        <p className="text-slate-400 font-medium">High-Performance Real-Time Presentations & Live Voting</p>
      </div>

      {/* Main Containers Grid */}
      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        
        {/* Panel 1: Join Session */}
        <div className="glass-card p-6 md:p-8 rounded-3xl animate-scale-in flex flex-col justify-between min-h-[400px]">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-brand-glowTeal p-2.5 rounded-xl border border-brand-teal/20 text-brand-teal">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white font-sans">Join as Participant</h2>
                <p className="text-sm text-slate-400">Enter a code to vote in real-time</p>
              </div>
            </div>

            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label htmlFor="joinCode" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  6-Digit Join Code
                </label>
                <input
                  id="joinCode"
                  type="text"
                  maxLength={6}
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="e.g. 123456"
                  className={`w-full bg-brand-dark/60 border ${joinError ? 'border-brand-rose animate-shake' : 'border-white/10'} focus:border-brand-teal/60 focus:ring-1 focus:ring-brand-teal/30 outline-none text-center font-bold text-3xl tracking-widest text-brand-teal py-4 rounded-2xl transition-all font-sans placeholder:text-slate-600 placeholder:tracking-normal placeholder:font-normal`}
                />
              </div>

              {joinError && (
                <div className="text-brand-rose text-sm font-medium bg-brand-rose/10 py-2.5 px-4 rounded-xl border border-brand-rose/20">
                  {joinError}
                </div>
              )}

              <button
                type="submit"
                disabled={isJoining || joinCode.length !== 6}
                className="w-full bg-gradient-to-r from-brand-teal to-teal-500 hover:from-teal-400 hover:to-teal-500 text-brand-dark font-bold text-lg py-4 rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                {isJoining ? 'Joining...' : 'Enter Session'}
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </button>
            </form>
          </div>

          <div className="mt-8 border-t border-white/5 pt-6 text-center text-xs text-slate-500">
            Scanning a QR code will automatically redirect you here.
          </div>
        </div>

        {/* Panel 2: Create Session */}
        <div className="glass-card p-6 md:p-8 rounded-3xl animate-scale-in flex flex-col justify-between min-h-[400px]">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-brand-glowPurple p-2.5 rounded-xl border border-brand-violet/20 text-brand-violet">
                <Presentation className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white font-sans">Create a Presentation</h2>
                <p className="text-sm text-slate-400">Design interactive slides in seconds</p>
              </div>
            </div>

            <form onSubmit={handleCreate} className="space-y-6">
              <div>
                <label htmlFor="sessionTitle" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Presentation Title
                </label>
                <input
                  id="sessionTitle"
                  type="text"
                  value={sessionTitle}
                  onChange={(e) => setSessionTitle(e.target.value)}
                  placeholder="e.g. Q3 Roadmap Brainstorm"
                  className="w-full bg-brand-dark/50 border border-white/10 focus:border-brand-violet/60 focus:ring-1 focus:ring-brand-violet/30 outline-none text-white px-4 py-3 rounded-xl transition-all font-sans"
                />
              </div>

              {/* Slide/Question Builder */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Slides ({questions.length})
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => addQuestion('bar')}
                      className="text-xs bg-brand-glowPurple text-brand-violet border border-brand-violet/20 py-1.5 px-3 rounded-lg hover:bg-brand-violet/20 transition-all flex items-center gap-1 font-semibold"
                    >
                      <Plus className="w-3.5 h-3.5" /> Multiple Choice
                    </button>
                    <button
                      type="button"
                      onClick={() => addQuestion('wordcloud')}
                      className="text-xs bg-brand-glowTeal text-brand-teal border border-brand-teal/20 py-1.5 px-3 rounded-lg hover:bg-brand-teal/20 transition-all flex items-center gap-1 font-semibold"
                    >
                      <Plus className="w-3.5 h-3.5" /> Word Cloud
                    </button>
                  </div>
                </div>

                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                  {questions.map((q, qIndex) => (
                    <div key={qIndex} className="bg-brand-dark/30 border border-white/5 rounded-2xl p-4 space-y-3 relative group">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold px-2 py-1 rounded bg-white/5 text-slate-300 uppercase tracking-wide">
                          #{qIndex + 1}: {q.type === 'bar' ? 'Multiple Choice' : 'Word Cloud'}
                        </span>
                        {questions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeQuestion(qIndex)}
                            className="text-slate-500 hover:text-brand-rose p-1 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <input
                        type="text"
                        value={q.text}
                        onChange={(e) => updateQuestionText(qIndex, e.target.value)}
                        placeholder={q.type === 'bar' ? 'Enter multiple choice question...' : 'Enter word cloud prompt...'}
                        className="w-full bg-brand-dark/50 border border-white/5 focus:border-white/20 outline-none text-sm text-white px-3 py-2 rounded-lg transition-all"
                      />

                      {/* Options for Bar Charts */}
                      {q.type === 'bar' && (
                        <div className="space-y-2 pl-3 border-l border-white/5">
                          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Choices</span>
                          <div className="grid grid-cols-2 gap-2">
                            {q.options.map((opt, optIndex) => (
                              <div key={optIndex} className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={opt}
                                  onChange={(e) => updateQuestionOption(qIndex, optIndex, e.target.value)}
                                  className="w-full bg-brand-dark/40 border border-white/5 outline-none text-xs text-slate-300 px-2 py-1.5 rounded-md focus:border-brand-violet/50"
                                />
                                {q.options.length > 2 && (
                                  <button
                                    type="button"
                                    onClick={() => removeOption(qIndex, optIndex)}
                                    className="text-slate-600 hover:text-brand-rose text-xs"
                                  >
                                    &times;
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => addOption(qIndex)}
                            className="text-[10px] text-brand-violet hover:underline font-semibold"
                          >
                            + Add Option
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {createError && (
                <div className="text-brand-rose text-sm font-medium bg-brand-rose/10 py-2.5 px-4 rounded-xl border border-brand-rose/20">
                  {createError}
                </div>
              )}

              <button
                type="submit"
                disabled={isCreating}
                className="w-full bg-gradient-to-r from-brand-violet to-fuchsia-500 hover:from-violet-500 hover:to-fuchsia-500 text-white font-bold text-lg py-4 rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 group"
              >
                {isCreating ? 'Creating...' : 'Create Presentation'}
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </button>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
