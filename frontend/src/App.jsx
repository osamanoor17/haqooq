import { useState, useRef, useEffect } from 'react';
import { 
  Mic, Square, Send, Scale, FileText, Download, Shield, Globe, 
  ArrowRight, Plus, MessageSquare, Copy, Check, Sparkles, BookOpen, 
  Cpu, Award, ExternalLink, RefreshCw, Trash2, Volume2, ShieldCheck, HelpCircle,
  Sun, Moon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const STARTER_QUERIES = [
  {
    icon: "🚨",
    title: "FIR & Police Refusal",
    desc: "Sections 154 & 22-A CrPC",
    query: "Meri motorcycle bazaar se chori ho gayi hai aur police station mein SHO FIR darj karne se inkar kar raha hai. Sessions Court mein 22-A petition ka kya legal procedure hai?"
  },
  {
    icon: "📱",
    title: "WhatsApp Scam & Harassment",
    desc: "PECA 2016 (Cybercrime)",
    query: "I was scammed online through a fake investment WhatsApp group and lost money. Under which sections of PECA 2016 can I report this to the FIA?"
  },
  {
    icon: "👨‍👩‍👧",
    title: "Khula & Maintenance",
    desc: "Muslim Family Laws 1961",
    query: "Muslim Family Laws Ordinance 1961 ke mutabiq Khula lene ka mukammal legal procedure aur court mein zaroori kaghzaat kya hain?"
  },
  {
    icon: "💳",
    title: "Dishonored Cheque",
    desc: "Section 489-F PPC",
    query: "Mujhe kisi shakhs ne karobar ke silsilay mein cheque diya tha jo bank se bounce ho gaya. Pakistan Penal Code ke Section 489-F ke mutabiq legal procedure kya hai?"
  }
];

const ENACTED_ACTS = [
  {
    icon: "⚖️",
    title: "Pakistan Penal Code (PPC 1860)",
    statute: "Act XLV of 1860",
    desc: "Primary criminal law of Pakistan covering offenses against person, property, fraud (415), theft (378), and dishonored cheques (489-F)."
  },
  {
    icon: "🚓",
    title: "Code of Criminal Procedure (CrPC 1898)",
    statute: "Act V of 1898",
    desc: "Regulates criminal trials, FIR registration (Section 154), Justice of Peace petitions (Section 22-A/22-B), and bail procedures."
  },
  {
    icon: "🛡️",
    title: "Prevention of Electronic Crimes Act",
    statute: "PECA 2016",
    desc: "Governs cybercrimes, online harassment (13/14), identity theft, financial scams (16), and FIA Cybercrime Wing procedure."
  },
  {
    icon: "📜",
    title: "Muslim Family Laws Ordinance",
    statute: "MFLO 1961",
    desc: "Regulates marriage registration, Khula, Talaq notices to Union Council, child custody (Hizanat), and spousal maintenance."
  },
  {
    icon: "🏠",
    title: "Transfer of Property Act",
    statute: "Act IV of 1882",
    desc: "Legal frameworks for property sale, lease agreements, tenant eviction notices, and land ownership rights."
  }
];

function App() {
  // Sessions State
  // Sessions State with localStorage persistence
  const [sessions, setSessions] = useState(() => {
    try {
      const saved = localStorage.getItem('haqooq_legal_sessions');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error("Failed to load sessions from localStorage", e);
    }
    return [{ id: Date.now(), title: 'New Legal Consultation', messages: [] }];
  });

  const [currentSessionId, setCurrentSessionId] = useState(() => {
    try {
      const savedId = localStorage.getItem('haqooq_current_session_id');
      if (savedId && sessions.some(s => s.id === Number(savedId))) {
        return Number(savedId);
      }
    } catch (e) {}
    return sessions[0]?.id || Date.now();
  });

  // Sync sessions to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('haqooq_legal_sessions', JSON.stringify(sessions));
    } catch (e) {}
  }, [sessions]);

  // Sync currentSessionId to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('haqooq_current_session_id', String(currentSessionId));
    } catch (e) {}
  }, [currentSessionId]);

  // Theme state (light / dark)
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('haqooq_theme') || 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('haqooq_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  
  const messagesContainerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const workspaceRef = useRef(null);

  const currentSession = sessions.find(s => s.id === currentSessionId) || sessions[0] || { id: Date.now(), title: 'New Legal Consultation', messages: [] };
  const messages = currentSession ? currentSession.messages : [];

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isLoading]);

  useEffect(() => {
    if (isRecording) {
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(recordingTimerRef.current);
      setRecordingDuration(0);
    }
    return () => clearInterval(recordingTimerRef.current);
  }, [isRecording]);

  const scrollToWorkspace = () => {
    workspaceRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const updateSessionMessages = (id, newMessages) => {
    setSessions(prev => prev.map(s => {
      if (s.id === id) {
        let title = s.title;
        if (title === 'New Legal Consultation' && newMessages.length > 0) {
          const firstUserMsg = newMessages.find(m => m.role === 'user');
          if (firstUserMsg) {
            let content = firstUserMsg.content.replace('[Voice Note]', '').trim();
            title = content.substring(0, 32) + (content.length > 32 ? '...' : '');
          }
        }
        return { ...s, messages: newMessages, title };
      }
      return s;
    }));
  };

  const startNewChat = () => {
    if (messages.length === 0) return;
    const newId = Date.now();
    setSessions(prev => [{ id: newId, title: 'New Legal Consultation', messages: [] }, ...prev]);
    setCurrentSessionId(newId);
  };

  const deleteSession = (id, e) => {
    e.stopPropagation();
    if (sessions.length === 1) {
      setSessions([{ id: Date.now(), title: 'New Legal Consultation', messages: [] }]);
      return;
    }
    const filtered = sessions.filter(s => s.id !== id);
    setSessions(filtered);
    if (currentSessionId === id) {
      setCurrentSessionId(filtered[0].id);
    }
  };

  const handleSendText = async (e, customQuery = null) => {
    e?.preventDefault();
    const queryToSend = customQuery || input;
    if (!queryToSend.trim() || isLoading) return;

    const userMsg = queryToSend.trim();
    setInput('');
    const newHistory = [...messages, { role: 'user', content: userMsg }];
    updateSessionMessages(currentSessionId, newHistory);
    setIsLoading(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 35000);

    try {
      const res = await fetch(`${API_URL}/chat/text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, history: messages }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Server returned ${res.status}: ${errText}`);
      }
      const data = await res.json();
      updateSessionMessages(currentSessionId, [...newHistory, { role: 'assistant', content: data.response || "No response received." }]);
    } catch (error) {
      console.error("Fetch error:", error);
      const errorMsg = error.name === 'AbortError' 
        ? '⚠️ Request timed out. Please ensure the backend server is running.'
        : `⚠️ Error connecting to server: ${error.message}`;
      updateSessionMessages(currentSessionId, [...newHistory, { role: 'assistant', content: errorMsg }]);
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await handleSendAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone access error:", err);
      alert("Please allow microphone permissions to speak with Haqooq AI.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleSendAudio = async (audioBlob) => {
    setIsLoading(true);
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    formData.append('history', JSON.stringify(messages));

    try {
      const res = await fetch(`${API_URL}/chat/audio`, {
        method: 'POST',
        body: formData
      });
      if (!res.ok) throw new Error('API Error');
      const data = await res.json();
      
      const newHistory = [
        ...messages, 
        { role: 'user', content: `🎙️ [Voice Consultation] ${data.transcription}` },
        { role: 'assistant', content: data.response, audio: data.audio }
      ];
      updateSessionMessages(currentSessionId, newHistory);

      if (data.audio) {
        const audio = new Audio(`data:audio/mp3;base64,${data.audio}`);
        audio.play().catch(e => console.log("Audio autoplay prevented:", e));
      }
    } catch (error) {
      updateSessionMessages(currentSessionId, [...messages, { role: 'assistant', content: '⚠️ Error processing voice query. Please try again.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const playVoiceResponse = (audioBase64) => {
    if (!audioBase64) return;
    const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
    audio.play();
  };

  const downloadTranscript = () => {
    if (messages.length === 0) return;
    
    let transcriptText = `HAQOOQ AI - OFFICIAL LEGAL CONSULTATION TRANSCRIPT\n`;
    transcriptText += `Session: ${currentSession.title}\n`;
    transcriptText += `Date: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}\n`;
    transcriptText += `Jurisdiction: Islamic Republic of Pakistan\n`;
    transcriptText += `==========================================================\n\n`;
    
    messages.forEach((msg, idx) => {
      const role = msg.role === 'user' ? "CITIZEN / CLIENT" : "HAQOOQ AI LEGAL ADVISOR";
      transcriptText += `[${idx + 1}] ${role}:\n${msg.content}\n\n----------------------------------------------------------\n\n`;
    });

    transcriptText += `Disclaimer: This document is generated for informational guidance based on Pakistani statutory law and does not substitute licensed legal representation in court.\n`;

    const element = document.createElement("a");
    const file = new Blob([transcriptText], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = `Haqooq_Consultation_${Date.now()}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="app-layout">
      {/* Top Banner Status Bar */}
      <div className="top-status-bar">
        <div className="status-container">
          <div className="status-pill">
            <span className="pulse-dot"></span>
            <span>AI Legal Engine Online</span>
          </div>
          <div className="status-divider">|</div>
          <div className="statutes-badge">
            <ShieldCheck size={14} className="statute-icon" />
            <span>1,280+ Enacted Pakistani Legal Statutes (PPC, CrPC, PECA 2016, Family Laws)</span>
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <nav className="navbar">
        <div className="nav-container">
          <div className="nav-brand">
            <div className="brand-icon-wrapper">
              <Scale size={24} className="brand-icon" />
            </div>
            <div className="brand-text">
              <span className="brand-name">Haqooq AI</span>
              <span className="brand-tag">Pakistani Legal Advisor</span>
            </div>
          </div>

          <div className="nav-actions">
            <a href="#how-rag-works" className="nav-link">
              <Cpu size={16} />
              <span>How RAG Works</span>
            </a>
            <a href="#statutes" className="nav-link">
              <BookOpen size={16} />
              <span>Acts Covered</span>
            </a>
            <button 
              className="theme-toggle-btn" 
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button className="nav-cta-btn" onClick={scrollToWorkspace}>
              <Sparkles size={16} />
              <span>Consult Now</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-container">
          <motion.div 
            className="hero-left"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7 }}
          >
            <div className="hero-badge">
              <Award size={15} />
              <span>Bilingual Legal Artificial Intelligence</span>
            </div>
            <h1 className="hero-heading">
              Democratizing <span className="gradient-text">Justice & Rights</span> for Every Pakistani.
            </h1>
            <p className="hero-subtext">
              Instant, confidential, and verified legal counsel grounded strictly in the <strong>Constitution of Pakistan</strong>, <strong>Pakistan Penal Code</strong>, <strong>CrPC</strong>, and <strong>PECA Cybercrime Laws</strong>.
            </p>

            <div className="hero-cta-group">
              <button className="primary-cta-btn" onClick={scrollToWorkspace}>
                <span>Start Legal Consultation</span>
                <ArrowRight size={18} />
              </button>
              <div className="trust-indicator">
                <Shield size={18} className="trust-icon" />
                <span>100% Free & Confidential</span>
              </div>
            </div>

            <div className="hero-metrics">
              <div className="metric-item">
                <span className="metric-num">5+</span>
                <span className="metric-label">Enacted Acts</span>
              </div>
              <div className="metric-divider"></div>
              <div className="metric-item">
                <span className="metric-num">3</span>
                <span className="metric-label">Languages (Urdu/Eng/Roman)</span>
              </div>
              <div className="metric-divider"></div>
              <div className="metric-item">
                <span className="metric-num">&lt; 1s</span>
                <span className="metric-label">Sub-Second Retrieval</span>
              </div>
            </div>
          </motion.div>

          <motion.div 
            className="hero-right"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.1 }}
          >
            <div className="hero-image-card">
              <img 
                src="/hero_illustration.jpg" 
                alt="Haqooq AI Legal Justice Illustration" 
                className="hero-img"
              />
            </div>

            <div className="hero-card-badges-row">
              <div className="hero-feature-badge">
                <Scale size={16} className="badge-icon" />
                <span>Fair & Impartial</span>
              </div>
              <div className="hero-feature-badge">
                <ShieldCheck size={16} className="badge-icon" />
                <span>Verified Law Citations</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* How RAG Works Section */}
      <section id="how-rag-works" className="rag-showcase-section">
        <div className="section-header">
          <div className="section-pill">
            <Cpu size={14} />
            <span>Architecture & Verification</span>
          </div>
          <h2>How Haqooq AI's RAG Pipeline Works</h2>
          <p>Unlike generic AI models that guess, Haqooq utilizes a strict Retrieval-Augmented Generation pipeline.</p>
        </div>

        <div className="rag-content-wrapper">
          <motion.div 
            className="rag-visual-box"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <img 
              src="/rag_visual.jpg" 
              alt="Haqooq AI RAG Knowledge Network" 
              className="rag-img"
            />
          </motion.div>

          <div className="rag-steps-grid">
            <div className="rag-step-card">
              <div className="step-number">01</div>
              <div className="step-content">
                <h3>Query Understanding & Translation</h3>
                <p>Translates colloquial Urdu and Roman Urdu queries into structured Pakistani legal search vectors.</p>
              </div>
            </div>

            <div className="rag-step-card">
              <div className="step-number">02</div>
              <div className="step-content">
                <h3>Pinecone Cloud Vector Retrieval</h3>
                <p>Dense similarity search extracts relevant legal clauses from 2,800+ indexed chunks of Pakistani Law.</p>
              </div>
            </div>

            <div className="rag-step-card">
              <div className="step-number">03</div>
              <div className="step-content">
                <h3>Synthesis & Required Documents</h3>
                <p>Generates actionable legal advice with step-by-step procedures, evidentiary checklists, and clickable citations.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Enacted Acts Covered Section */}
      <section id="statutes" className="statutes-section">
        <div className="section-header">
          <div className="section-pill">
            <BookOpen size={14} />
            <span>Statutory Coverage</span>
          </div>
          <h2>Acts & Laws Covered in Database</h2>
          <p>Grounding every AI advice strictly in enacted Pakistani legislation and statutory codes.</p>
        </div>

        <div className="statutes-grid">
          {ENACTED_ACTS.map((act, idx) => (
            <motion.div 
              key={idx}
              className="statute-card"
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: idx * 0.08 }}
            >
              <div className="statute-card-top">
                <span className="statute-card-icon">{act.icon}</span>
                <span className="statute-badge">{act.statute}</span>
              </div>
              <h3>{act.title}</h3>
              <p>{act.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Interactive Consultation Workspace */}
      <section ref={workspaceRef} className="workspace-section">
        <div className="workspace-header">
          <div className="section-pill">
            <MessageSquare size={14} />
            <span>Interactive Legal Room</span>
          </div>
          <h2>Live Consultation Workspace</h2>
          <p>Type your query or click on a pre-configured legal scenario below.</p>
        </div>

        {/* Quick Starter Chips */}
        <div className="starter-chips-container">
          {STARTER_QUERIES.map((starter, idx) => (
            <motion.div 
              key={idx}
              className="starter-chip"
              whileHover={{ y: -3, scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleSendText(null, starter.query)}
            >
              <div className="chip-icon">{starter.icon}</div>
              <div className="chip-details">
                <span className="chip-title">{starter.title}</span>
                <span className="chip-desc">{starter.desc}</span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Workspace Main Panel */}
        <div className="workspace-card">
          {/* Left Sidebar: Sessions */}
          <aside className="workspace-sidebar">
            <div className="sidebar-top">
              <button className="new-session-btn" onClick={startNewChat}>
                <Plus size={18} />
                <span>New Consultation</span>
              </button>
            </div>

            <div className="sessions-container">
              <div className="sessions-header-label">Previous Consultations</div>
              <div className="sessions-scroll">
                {sessions.map(session => (
                  <div 
                    key={session.id} 
                    className={`session-card ${session.id === currentSessionId ? 'active' : ''}`}
                    onClick={() => setCurrentSessionId(session.id)}
                  >
                    <MessageSquare size={16} className="session-card-icon" />
                    <span className="session-card-title">{session.title}</span>
                    <button 
                      className="delete-session-btn"
                      onClick={(e) => deleteSession(session.id, e)}
                      title="Delete Consultation"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="sidebar-bottom">
              <button 
                className="export-transcript-btn"
                onClick={downloadTranscript}
                disabled={messages.length === 0}
              >
                <Download size={16} />
                <span>Export Case Transcript</span>
              </button>
            </div>
          </aside>

          {/* Right Chat Area */}
          <main className="workspace-chat">
            {messages.length > 0 && (
              <div className="workspace-chat-header">
                <div className="chat-header-info">
                  <Scale size={18} className="chat-header-icon" />
                  <span className="chat-header-title">{sessions.find(s => s.id === currentSessionId)?.title || 'Legal Consultation'}</span>
                </div>
                <button 
                  className="clear-chat-btn"
                  onClick={(e) => deleteSession(currentSessionId, e)}
                  title="Clear or delete this chat session"
                >
                  <Trash2 size={15} />
                  <span>Clear Chat</span>
                </button>
              </div>
            )}
            <div className="chat-messages-scroll" ref={messagesContainerRef}>
              {messages.length === 0 && !isLoading && (
                <div className="chat-empty-state">
                  <div className="empty-icon-circle">
                    <Scale size={42} />
                  </div>
                  <h3>Welcome to Haqooq AI Legal Consultation</h3>
                  <p>Describe your legal scenario in English, Roman Urdu, or Urdu. You can also tap the microphone to speak.</p>
                </div>
              )}

              <AnimatePresence>
                {messages.map((msg, idx) => (
                  <motion.div 
                    key={idx}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className={`chat-bubble-wrapper ${msg.role}`}
                  >
                    <div className="chat-bubble-avatar">
                      {msg.role === 'user' ? '👤' : '⚖️'}
                    </div>

                    <div className="chat-bubble-body">
                      <div className="chat-bubble-header">
                        <span className="sender-name">
                          {msg.role === 'user' ? 'You' : 'Haqooq Legal Advisor'}
                        </span>
                        {msg.role === 'assistant' && (
                          <div className="assistant-tools">
                            {msg.audio && (
                              <button 
                                className="action-icon-btn" 
                                onClick={() => playVoiceResponse(msg.audio)}
                                title="Listen to Advice"
                              >
                                <Volume2 size={15} />
                              </button>
                            )}
                            <button 
                              className="action-icon-btn" 
                              onClick={() => copyToClipboard(msg.content, idx)}
                              title="Copy Advice"
                            >
                              {copiedIndex === idx ? <Check size={15} className="copied-icon" /> : <Copy size={15} />}
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="chat-bubble-content" dir="auto">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {isLoading && (
                <motion.div 
                  className="chat-bubble-wrapper assistant loading-state"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <div className="chat-bubble-avatar">⚖️</div>
                  <div className="chat-bubble-body loading-bubble">
                    <RefreshCw size={18} className="spinner-icon" />
                    <span>Searching Pakistani Statutes & Generating Legal Advice...</span>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Input & Voice Controls */}
            <div className="chat-input-bar">
              {isRecording && (
                <div className="recording-indicator-strip">
                  <span className="rec-dot"></span>
                  <span className="rec-text">Listening to your consultation... ({recordingDuration}s)</span>
                  <div className="waveform-animation">
                    <span className="wave-bar"></span>
                    <span className="wave-bar"></span>
                    <span className="wave-bar"></span>
                    <span className="wave-bar"></span>
                    <span className="wave-bar"></span>
                  </div>
                </div>
              )}

              <form className="input-form" onSubmit={handleSendText}>
                <input 
                  type="text" 
                  className="chat-text-input"
                  placeholder={isRecording ? "Listening... speak in Urdu or English" : "Describe your legal situation (e.g., bike chori, police refusal, WhatsApp scam)..."}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={isLoading || isRecording}
                />

                <div className="input-btn-group">
                  <button 
                    type="button" 
                    className={`mic-toggle-btn ${isRecording ? 'active-recording' : ''}`}
                    onClick={toggleRecording}
                    title={isRecording ? "Stop Recording" : "Voice Consultation"}
                  >
                    {isRecording ? <Square size={18} /> : <Mic size={18} />}
                  </button>

                  <button 
                    type="submit" 
                    className="send-query-btn"
                    disabled={!input.trim() || isLoading || isRecording}
                    title="Send Query"
                  >
                    <Send size={18} />
                  </button>
                </div>
              </form>
            </div>
          </main>
        </div>
      </section>

      {/* Footer */}
      <footer className="app-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <Scale size={20} />
            <span>Haqooq AI</span>
          </div>
          <p className="footer-disclaimer">
            <strong>Legal Notice:</strong> Haqooq AI is an AI-powered legal awareness agent for the Islamic Republic of Pakistan. It does not replace licensed legal representation in court.
          </p>
          <div className="footer-copyright">
            © {new Date().getFullYear()} Haqooq AI. Dedicated to Legal Access in Pakistan 🇵🇰
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
