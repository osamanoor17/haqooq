import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Send, Scale, FileText, Download, Shield, Globe, ArrowRight, Plus, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './App.css';

const API_URL = 'http://127.0.0.1:8000';

function App() {
  // Session State
  const [sessions, setSessions] = useState([
    { id: Date.now(), title: 'New Consultation', messages: [] }
  ]);
  const [currentSessionId, setCurrentSessionId] = useState(sessions[0].id);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  
  const messagesContainerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const workspaceRef = useRef(null);

  const currentSession = sessions.find(s => s.id === currentSessionId) || sessions[0];
  const messages = currentSession.messages;

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isLoading]);

  const scrollToWorkspace = () => {
    workspaceRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const updateSessionMessages = (id, newMessages) => {
    setSessions(prev => prev.map(s => {
      if (s.id === id) {
        let title = s.title;
        // Auto-title if it's a new consultation
        if (title === 'New Consultation' && newMessages.length > 0) {
          const firstUserMsg = newMessages.find(m => m.role === 'user');
          if (firstUserMsg) {
            let content = firstUserMsg.content.replace('[Voice Note]', '').trim();
            title = content.substring(0, 30) + (content.length > 30 ? '...' : '');
          }
        }
        return { ...s, messages: newMessages, title };
      }
      return s;
    }));
  };

  const startNewChat = () => {
    // Don't create multiple empty chats
    if (messages.length === 0) return;
    
    const newId = Date.now();
    setSessions(prev => [{ id: newId, title: 'New Consultation', messages: [] }, ...prev]);
    setCurrentSessionId(newId);
  };

  const handleSendText = async (e) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput('');
    const newHistory = [...messages, { role: 'user', content: userMsg }];
    updateSessionMessages(currentSessionId, newHistory);
    setIsLoading(true);

    try {
      const res = await fetch(`${API_URL}/chat/text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, history: messages }) // send previous history
      });
      if (!res.ok) throw new Error('API Error');
      const data = await res.json();
      updateSessionMessages(currentSessionId, [...newHistory, { role: 'assistant', content: data.response }]);
    } catch (error) {
      updateSessionMessages(currentSessionId, [...newHistory, { role: 'assistant', content: 'Error connecting to server. Please try again.' }]);
    } finally {
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
      console.error("Microphone access denied or error:", err);
      alert("Please allow microphone access to use the Voice Agent.");
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
        { role: 'user', content: `[Voice Note] ${data.transcription}` },
        { role: 'assistant', content: data.response }
      ];
      updateSessionMessages(currentSessionId, newHistory);

      if (data.audio) {
        const audio = new Audio(`data:audio/mp3;base64,${data.audio}`);
        audio.play();
      }
    } catch (error) {
      updateSessionMessages(currentSessionId, [...messages, { role: 'assistant', content: 'Error processing audio. Please try again.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const downloadTranscript = () => {
    if (messages.length === 0) return;
    
    let transcriptText = `Haqooq AI - Legal Consultation Transcript\nSession: ${currentSession.title}\n`;
    transcriptText += "========================================\n\n";
    
    messages.forEach(msg => {
      const role = msg.role === 'user' ? "Client" : "Legal Advisor";
      transcriptText += `${role}:\n${msg.content}\n\n`;
    });

    const element = document.createElement("a");
    const file = new Blob([transcriptText], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `Haqooq_${currentSession.title.replace(/\s+/g, '_')}_Transcript.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="landing-page">
      {/* Navbar */}
      <nav className="navbar">
        <div className="nav-brand">
          <Scale size={32} className="nav-icon" />
          <span>Haqooq AI</span>
        </div>
        <div className="nav-links">
          <a href="#features">Features</a>
          <button className="nav-cta" onClick={scrollToWorkspace}>Consult Now</button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-section">
        <motion.div 
          className="hero-content" 
          initial={{ opacity: 0, y: 30 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.8 }}
        >
          <div className="badge">AI-Powered Legal Tech</div>
          <h1 className="hero-title">Your Personal <br/><span className="text-gradient">Pakistani Legal Assistant</span></h1>
          <p className="hero-subtitle">Get instant, highly accurate, and 100% confidential legal advice sourced directly from the official Constitution and Penal Code of Pakistan.</p>
          <button className="hero-btn" onClick={scrollToWorkspace}>
            Start Free Consultation <ArrowRight size={20} />
          </button>
        </motion.div>
      </section>

      {/* Features Section */}
      <section id="features" className="features-section">
        <div className="section-header">
          <h2>Why Choose Haqooq AI?</h2>
          <p>We leverage cutting-edge AI to bring justice to your fingertips.</p>
        </div>
        <div className="features-grid">
          <motion.div className="feature-card" whileHover={{ y: -5 }}>
            <div className="feature-icon"><Globe size={28} /></div>
            <h3>Urdu Voice Support</h3>
            <p>Speak naturally in Urdu or English. Haqooq understands your voice and responds accurately in your preferred language.</p>
          </motion.div>
          <motion.div className="feature-card" whileHover={{ y: -5 }}>
            <div className="feature-icon"><Shield size={28} /></div>
            <h3>Verified Context</h3>
            <p>Our AI is strictly bound to the Pakistan Penal Code. It does not guess—it provides answers backed by actual laws.</p>
          </motion.div>
          <motion.div className="feature-card" whileHover={{ y: -5 }}>
            <div className="feature-icon"><FileText size={28} /></div>
            <h3>Instant Transcripts</h3>
            <p>Automatically build a running case file as you chat, and download your complete consultation transcript anytime.</p>
          </motion.div>
        </div>
      </section>

      {/* Application Workspace */}
      <section ref={workspaceRef} className="workspace-section">
        <div className="section-header">
          <h2>Legal Consultation Room</h2>
          <p>Type your query below or tap the microphone to speak securely.</p>
        </div>
        
        <div className="app-container">
          <div className="workspace">
            {/* Left Pane: Sessions / Case File */}
            <div className="case-file-pane">
              <div className="sidebar-header">
                <button className="new-chat-btn" onClick={startNewChat}>
                  <Plus size={18} />
                  <span>New Consultation</span>
                </button>
              </div>
              
              <div className="sessions-list">
                <div className="sessions-label">Recent Consultations</div>
                {sessions.map(session => (
                  <div 
                    key={session.id} 
                    className={`session-item ${session.id === currentSessionId ? 'active' : ''}`}
                    onClick={() => setCurrentSessionId(session.id)}
                  >
                    <MessageSquare size={16} />
                    <span className="session-title">{session.title}</span>
                  </div>
                ))}
              </div>

              <div className="pane-footer">
                <button 
                  className="download-btn" 
                  onClick={downloadTranscript}
                  disabled={messages.length === 0}
                >
                  <Download size={18} />
                  Download Transcript
                </button>
              </div>
            </div>

            {/* Right Pane: Consultation Room */}
            <div className="chat-container">
              <div className="messages" ref={messagesContainerRef}>
                {messages.length === 0 && !isLoading && (
                   <div className="chat-placeholder">
                     <div className="placeholder-icon"><Scale size={48} /></div>
                     <h3>How can I help you today?</h3>
                     <p>Type your query or use the microphone to speak securely.</p>
                   </div>
                )}
                
                <AnimatePresence>
                  {messages.map((msg, idx) => (
                    <motion.div 
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`message ${msg.role}`}
                      dir="auto"
                    >
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {isLoading && <div className="loading">Haqooq is analyzing your case...</div>}
              </div>

              <div className="input-area">
                <form className="input-container" onSubmit={handleSendText}>
                  <input 
                    type="text" 
                    className="text-input" 
                    placeholder={isRecording ? "Recording... Speak now 🎙️" : "Message Haqooq AI..."} 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={isLoading || isRecording}
                  />
                  <div className="input-actions">
                    <button 
                      type="button"
                      onClick={toggleRecording} 
                      className={`mic-btn ${isRecording ? 'recording' : ''}`}
                      title={isRecording ? "Stop Recording" : "Start Recording"}
                    >
                      {isRecording ? <Square size={20} /> : <Mic size={20} />}
                    </button>
                    <button 
                      type="submit" 
                      className="send-btn" 
                      disabled={!input.trim() || isLoading || isRecording}
                    >
                      <Send size={20} />
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-brand">
            <Scale size={24} />
            <span>Haqooq AI</span>
          </div>
          <p className="footer-disclaimer">
            <strong>Disclaimer:</strong> Haqooq AI provides general legal information based on standard Pakistani law. It is not formal legal counsel. Please consult a licensed attorney for official legal representation.
          </p>
          <p className="footer-copyright">&copy; {new Date().getFullYear()} Haqooq AI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
