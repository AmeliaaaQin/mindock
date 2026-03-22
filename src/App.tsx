/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence, useAnimation } from 'motion/react';
import { 
  MessageCircle, 
  BarChart3, 
  BookOpen, 
  Wind, 
  Heart, 
  Send, 
  Calendar as CalendarIcon,
  Plus,
  Trash2,
  ChevronRight,
  Sparkles,
  CloudRain,
  Moon,
  Zap
} from 'lucide-react';
import { getMindockResponse, Mode } from './services/geminiService';

// --- Types ---
interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
}

interface EmotionRecord {
  id: string;
  timestamp: number;
  label: string;
  intensity: number;
  color: string;
  report: string;
}

interface DiaryAnnotation {
  original: string;
  feedback: string;
}

interface DiaryEntry {
  id: string;
  type: 'diary';
  timestamp: number;
  content: string;
  annotations?: DiaryAnnotation[];
}

interface DreamEntry {
  id: string;
  type: 'dream';
  timestamp: number;
  content: string;
  emotions: string[];
  clarity: number;
  isRecurring: boolean;
  aiResponse: {
    echo: string;
    clue: string;
  };
}

type NotebookEntry = DiaryEntry | DreamEntry;

interface UserSettings {
  userName: string;
  aiName: string;
  hasOnboarded: boolean;
}

interface MemoryLayer {
  shortTerm: Message[]; // Recent N messages
  midTerm: string[];    // Summaries
  longTerm: string[];   // Key events
}

const FeedbackCard: React.FC<{ annotation: DiaryAnnotation, index: number, onHover: (hovered: boolean) => void }> = ({ annotation, index, onHover }) => {
  const colors = [
    { bg: 'bg-amber-100/95', text: 'text-amber-900', border: 'border-amber-200' },
    { bg: 'bg-purple-100/95', text: 'text-purple-900', border: 'border-purple-200' },
    { bg: 'bg-pink-100/95', text: 'text-pink-900', border: 'border-pink-200' }
  ];
  const c = colors[index % colors.length];

  return (
    <motion.div 
      initial={{ x: 30, opacity: 0 }} 
      animate={{ x: 0, opacity: 1 }}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      className={`${c.bg} p-5 rounded-2xl shadow-xl border ${c.border} transform ${index % 2 === 0 ? 'rotate-1' : '-rotate-1'} hover:rotate-0 transition-all cursor-default relative z-10`}
    >
      <div className="absolute -top-3 -left-2 w-8 h-8 bg-white/40 rounded-full blur-sm" />
      <div className={`text-[10px] font-bold ${c.text} opacity-40 uppercase tracking-widest mb-2`}>
        批注 #{index + 1}
      </div>
      <p className={`text-sm leading-relaxed handwriting ${c.text}`}>{annotation.feedback}</p>
    </motion.div>
  );
};

// --- Constants ---
const EMOTION_COLORS: Record<string, string> = {
  '平静': '#60a5fa', // 蓝
  '放松': '#22d3ee', // 青
  '开心': '#facc15', // 黄
  '期待': '#f472b6', // 粉
  '焦虑': '#fb923c', // 橙
  '紧张': '#ea580c', // 深橙
  '低落': '#9ca3af', // 灰
  '孤独': '#7c3aed', // 深紫
  '愤怒': '#f87171', // 红
  '委屈': '#e11d48'  // 玫红
};

const GLOBAL_TRANSITION = { duration: 0.5, ease: [0.4, 0, 0.2, 1] };
const FADE_UP_ANIMATION = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: GLOBAL_TRANSITION
};

// --- Components ---

const ChatMode = ({ onInteract, userSettings, memory, onUpdateMemory }: { 
  onInteract: (text: string) => void, 
  userSettings: UserSettings,
  memory: MemoryLayer,
  onUpdateMemory: (msg: Message) => void
}) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem('mindock_chat_v2');
    return saved ? JSON.parse(saved) : [
      { id: '1', role: 'ai', content: '你好，我是心泊。在这片静谧的星空下，你想聊聊什么？' }
    ];
  });

  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('mindock_chat_v2', JSON.stringify(messages));
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    scrollToBottom();
  }, [isTyping]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;
    
    const userMsg = input;
    setInput('');
    const newUserMsg: Message = { id: Date.now().toString(), role: 'user', content: userMsg };
    setMessages(prev => [...prev, newUserMsg]);
    onUpdateMemory(newUserMsg);
    setIsTyping(true);
    onInteract(userMsg);

    // Construct context for memory
    const context = `用户名称：${userSettings.userName}\nAI名称：${userSettings.aiName}\n近期对话记忆：\n${memory.shortTerm.map(m => `${m.role === 'user' ? userSettings.userName : userSettings.aiName}: ${m.content}`).join('\n')}`;

    const response = await getMindockResponse('chat', userMsg, context);
    const parts = response.split('[SPLIT]').filter(p => p.trim());
    
    // Simulate human-like typing with segments
    for (let i = 0; i < parts.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 1200 + Math.random() * 1000));
      const newAiMsg: Message = { id: `${Date.now()}-${i}`, role: 'ai', content: parts[i].trim() };
      setMessages(prev => [...prev, newAiMsg]);
      onUpdateMemory(newAiMsg);
      if (i === 0) setIsTyping(false); 
    }
    setIsTyping(false);
  };

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto relative">
      <div 
        ref={scrollRef} 
        className="flex-1 overflow-y-auto px-6 pt-6 pb-40 space-y-8 scroll-smooth"
      >
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[85%] p-4 rounded-2xl shadow-lg ${
              msg.role === 'user' 
                ? 'bg-indigo-600/90 text-white rounded-tr-none glow-pink' 
                : 'glass-card text-blue-100 rounded-tl-none border-blue-400/20 glow-blue'
            }`}>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
            </div>
          </motion.div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="glass-card p-4 rounded-2xl rounded-tl-none border-blue-400/20 glow-blue">
              <div className="flex space-x-2">
                <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.5 }} className="w-1.5 h-1.5 bg-blue-300 rounded-full" />
                <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.2 }} className="w-1.5 h-1.5 bg-blue-300 rounded-full" />
                <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.4 }} className="w-1.5 h-1.5 bg-blue-300 rounded-full" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="absolute bottom-24 left-0 right-0 px-6 z-10">
        <div className="max-w-2xl mx-auto glass-card rounded-full p-2 flex items-center gap-2 border-white/10 shadow-2xl glow-border">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="在这里说说你的心情..."
            className="flex-1 bg-transparent px-6 py-2 outline-none text-sm text-white placeholder-white/30"
          />
          <button
            onClick={handleSend}
            disabled={isTyping || !input.trim()}
            className="p-3 bg-indigo-500 text-white rounded-full hover:bg-indigo-400 transition-all disabled:opacity-30 shadow-lg shadow-indigo-500/20 jelly-button"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

const DreamMode = ({ onInteract, onSave }: { onInteract: (text: string) => void, onSave: (entry: DreamEntry) => void }) => {
  const [content, setContent] = useState('');
  const [selectedEmotions, setSelectedEmotions] = useState<string[]>([]);
  const [clarity, setClarity] = useState(3);
  const [isRecurring, setIsRecurring] = useState(false);
  const [loading, setLoading] = useState(false);

  const emotions = ['平静', '快乐', '焦虑', '害怕', '迷茫', '温暖', '混乱', '清晰'];

  const handleSave = async () => {
    if (!content.trim() || loading) return;
    setLoading(true);
    onInteract(content);

    const response = await getMindockResponse('dream', content);
    const echoMatch = response.match(/回响：([\s\S]*?)(?:\n线索|$)/);
    const clueMatch = response.match(/线索：([\s\S]*?)(?:\n|$)/);

    const newEntry: DreamEntry = {
      id: Date.now().toString(),
      type: 'dream',
      timestamp: Date.now(),
      content,
      emotions: selectedEmotions,
      clarity,
      isRecurring,
      aiResponse: {
        echo: echoMatch ? echoMatch[1].trim() : "梦境在晨光中消散，但它的余温仍在你心中。",
        clue: clueMatch ? clueMatch[1].trim() : "这是一个值得回味的梦。"
      }
    };

    onSave(newEntry);
    setContent('');
    setSelectedEmotions([]);
    setClarity(3);
    setIsRecurring(false);
    setLoading(false);
  };

  return (
    <div className="h-full flex flex-col p-12 overflow-y-auto">
      <div className="max-w-3xl mx-auto w-full flex-1 flex flex-col">
        <div className="flex items-center gap-2 mb-6 text-amber-200/60">
          <Moon size={16} />
          <span className="text-sm font-serif italic">昨晚的梦...</span>
        </div>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="记录你昨晚的梦境..."
          maxLength={800}
          className="w-full h-64 p-8 rounded-3xl glass-card border-white/5 outline-none focus:border-amber-400/30 transition-all resize-none font-serif text-xl leading-relaxed text-blue-50 glow-border"
        />

        <div className="space-y-6">
          <div className="space-y-3">
            <p className="text-sm text-blue-300/60 font-medium">梦境情绪</p>
            <div className="flex flex-wrap gap-2">
              {emotions.map(emo => (
                <button
                  key={emo}
                  onClick={() => setSelectedEmotions(prev => 
                    prev.includes(emo) ? prev.filter(e => e !== emo) : [...prev, emo]
                  )}
                  className={`px-4 py-2 rounded-full text-xs transition-all border ${
                    selectedEmotions.includes(emo) 
                      ? 'bg-amber-500/20 border-amber-400/50 text-amber-200' 
                      : 'bg-white/5 border-white/10 text-blue-300/60 hover:bg-white/10'
                  }`}
                >
                  {emo}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <p className="text-sm text-blue-300/60 font-medium">梦境清晰度</p>
                <span className="text-xs text-amber-200/60">{clarity === 1 ? '模糊' : clarity === 5 ? '清晰' : '中等'}</span>
              </div>
              <input 
                type="range" min="1" max="5" step="1" 
                value={clarity} 
                onChange={(e) => setClarity(parseInt(e.target.value))}
                className="w-full accent-amber-500 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-4 glass-card rounded-2xl border-white/5">
              <span className="text-sm text-blue-300/60">这是一个重复出现的梦</span>
              <button 
                onClick={() => setIsRecurring(!isRecurring)}
                className={`w-12 h-6 rounded-full transition-all relative ${isRecurring ? 'bg-amber-500' : 'bg-white/10'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isRecurring ? 'left-7' : 'left-1'}`} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button
            onClick={handleSave}
            disabled={loading || !content.trim()}
            className="px-12 py-4 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-full hover:from-amber-500 hover:to-orange-500 transition-all disabled:opacity-30 shadow-xl shadow-amber-600/20 font-medium jelly-button"
          >
            {loading ? '心泊正在聆听梦语...' : '保存梦境'}
          </button>
        </div>
      </div>
    </div>
  );
};

const NotebookMode = ({ onInteract }: { onInteract: (text: string) => void }) => {
  const [mode, setMode] = useState<'diary' | 'dream'>('diary');
  const [entries, setEntries] = useState<NotebookEntry[]>(() => {
    const saved = localStorage.getItem('mindock_notebook_v3');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeEntry, setActiveEntry] = useState<NotebookEntry | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const sentenceRefs = useRef<(HTMLSpanElement | null)[]>([]);

  const handleSaveDiary = (entry: DiaryEntry) => {
    const updated = [entry, ...entries];
    setEntries(updated);
    localStorage.setItem('mindock_notebook_v3', JSON.stringify(updated));
    setActiveEntry(entry);
  };

  const handleSaveDream = (entry: DreamEntry) => {
    const updated = [entry, ...entries];
    setEntries(updated);
    localStorage.setItem('mindock_notebook_v3', JSON.stringify(updated));
    setActiveEntry(entry);
  };

  const deleteEntry = (id: string) => {
    const updated = entries.filter(e => e.id !== id);
    setEntries(updated);
    localStorage.setItem('mindock_notebook_v3', JSON.stringify(updated));
    setActiveEntry(null);
  };

  const renderedDiaryContent = useMemo(() => {
    if (!activeEntry || activeEntry.type !== 'diary') return null;
    const text = activeEntry.content;
    const annotations = activeEntry.annotations || [];
    
    if (annotations.length === 0) return <span>{text}</span>;

    let matches: { start: number, end: number, annotationIndex: number }[] = [];
    annotations.forEach((a, index) => {
      let startPos = 0;
      while ((startPos = text.indexOf(a.original, startPos)) !== -1) {
        matches.push({ start: startPos, end: startPos + a.original.length, annotationIndex: index });
        startPos += a.original.length;
      }
      if (matches.filter(m => m.annotationIndex === index).length === 0) {
        const fuzzyOriginal = a.original.replace(/[。！？，,.!?]$/, '').trim();
        if (fuzzyOriginal.length > 3) {
          startPos = 0;
          while ((startPos = text.indexOf(fuzzyOriginal, startPos)) !== -1) {
            matches.push({ start: startPos, end: startPos + fuzzyOriginal.length, annotationIndex: index });
            startPos += fuzzyOriginal.length;
          }
        }
      }
    });

    matches.sort((a, b) => a.start - b.start);
    const filteredMatches: typeof matches = [];
    let lastEnd = 0;
    matches.forEach(m => {
      if (m.start >= lastEnd) {
        filteredMatches.push(m);
        lastEnd = m.end;
      }
    });

    const result: React.ReactNode[] = [];
    let currentPos = 0;
    filteredMatches.forEach((m, i) => {
      if (m.start > currentPos) result.push(<span key={`text-${i}`}>{text.substring(currentPos, m.start)}</span>);
      result.push(
        <span 
          key={`match-${i}`} 
          ref={el => sentenceRefs.current[m.annotationIndex] = el}
          className={`transition-colors duration-300 ${hoveredIndex === m.annotationIndex ? 'bg-indigo-500/20 underline decoration-indigo-400/50 decoration-dashed underline-offset-4' : ''}`}
        >
          {text.substring(m.start, m.end)}
        </span>
      );
      currentPos = m.end;
    });
    if (currentPos < text.length) result.push(<span key="text-end">{text.substring(currentPos)}</span>);
    return result;
  }, [activeEntry, hoveredIndex]);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <div className="w-[320px] border-r border-white/5 bg-white/5 flex flex-col overflow-hidden">
        <div className="p-6 space-y-4">
          <div className="flex gap-2">
            <button 
              onClick={() => { setMode('diary'); setActiveEntry(null); }}
              className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${mode === 'diary' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white/5 text-blue-300/60 hover:bg-white/10'}`}
            >
              <BookOpen size={16} /> 日记
            </button>
            <button 
              onClick={() => { setMode('dream'); setActiveEntry(null); }}
              className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${mode === 'dream' ? 'bg-amber-600 text-white shadow-lg' : 'bg-white/5 text-blue-300/60 hover:bg-white/10'}`}
            >
              <Moon size={16} /> 梦境
            </button>
          </div>
          <div className="h-px bg-white/5" />
          <div className="text-[10px] font-bold text-blue-400/40 uppercase tracking-widest">时光轴</div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
          {entries.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center text-center p-6 opacity-20">
              <Sparkles size={32} className="mb-2" />
              <p className="text-xs">还没有记录，开始书写你的星尘吧。</p>
            </div>
          ) : (
            entries.map(entry => (
              <button
                key={entry.id}
                onClick={() => setActiveEntry(entry)}
                className={`w-full text-left p-4 rounded-2xl transition-all group relative border ${
                  activeEntry?.id === entry.id 
                    ? (entry.type === 'diary' ? 'glass-card border-indigo-400/30 glow-blue' : 'glass-card border-amber-400/30 glow-amber') 
                    : 'bg-white/5 border-transparent hover:bg-white/10'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] text-blue-300/40 font-mono">
                    {new Date(entry.timestamp).toLocaleDateString()}
                  </span>
                  <span className="text-sm">{entry.type === 'diary' ? '📝' : '🌙'}</span>
                </div>
                <div className="text-sm text-gray-300 group-hover:text-white transition-colors line-clamp-2 leading-relaxed">
                  {entry.content}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <div className="flex-1 overflow-y-auto">
          {activeEntry ? (
            <div className="flex flex-col lg:flex-row h-full">
              <div className="flex-1 p-12 overflow-y-auto">
                <div className="max-w-3xl mx-auto space-y-8">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${activeEntry.type === 'diary' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-amber-500/20 text-amber-300'}`}>
                        {activeEntry.type === 'diary' ? '星尘日记' : '梦境回响'}
                      </span>
                      <span className="text-xs font-mono text-blue-300/40">{new Date(activeEntry.timestamp).toLocaleString()}</span>
                    </div>
                    <button onClick={() => deleteEntry(activeEntry.id)} className="p-2 text-gray-500 hover:text-red-400 transition-colors">
                      <Trash2 size={18} />
                    </button>
                  </div>

                  <div className="font-serif text-2xl leading-relaxed text-blue-50/90 whitespace-pre-wrap">
                    {activeEntry.type === 'diary' ? renderedDiaryContent : activeEntry.content}
                  </div>

                  {activeEntry.type === 'dream' && (
                    <div className="space-y-6 pt-8 border-t border-white/5">
                      <div className="flex flex-wrap gap-2">
                        {activeEntry.emotions.map(emo => (
                          <span key={emo} className="px-3 py-1 rounded-full text-xs bg-amber-500/10 text-amber-200/60 border border-amber-500/20">
                            {emo}
                          </span>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 glass-card rounded-2xl border-white/5">
                          <div className="text-[10px] text-blue-300/40 mb-1">梦境清晰度</div>
                          <div className="flex gap-1">
                            {[...Array(5)].map((_, i) => (
                              <div key={i} className={`w-3 h-1 rounded-full ${i < activeEntry.clarity ? 'bg-amber-400' : 'bg-white/10'}`} />
                            ))}
                          </div>
                        </div>
                        <div className="p-4 glass-card rounded-2xl border-white/5">
                          <div className="text-[10px] text-blue-300/40 mb-1">是否重复梦</div>
                          <div className="text-sm text-amber-200">{activeEntry.isRecurring ? '是的' : '不是'}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* AI Feedback Panel */}
              <div className={`w-96 p-8 border-l border-white/5 overflow-y-auto space-y-8 ${activeEntry.type === 'diary' ? 'bg-indigo-950/20' : 'bg-amber-950/20'}`}>
                <div className="text-xs font-bold text-blue-400/40 uppercase tracking-[0.2em] mb-8">
                  {activeEntry.type === 'diary' ? '心泊的批注' : '梦境的回响'}
                </div>
                
                {activeEntry.type === 'diary' ? (
                  <div className="space-y-8">
                    {activeEntry.annotations?.map((a, i) => (
                      <FeedbackCard key={i} index={i} annotation={a} onHover={(h) => setHoveredIndex(h ? i : null)} />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-8">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-amber-100/95 p-6 rounded-3xl shadow-xl border border-amber-200 relative">
                      <div className="text-[10px] font-bold text-amber-900/40 uppercase tracking-widest mb-3">回响</div>
                      <p className="text-sm leading-relaxed handwriting text-amber-900">{activeEntry.aiResponse.echo}</p>
                    </motion.div>
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-orange-100/95 p-6 rounded-3xl shadow-xl border border-orange-200 relative">
                      <div className="text-[10px] font-bold text-orange-900/40 uppercase tracking-widest mb-3">线索</div>
                      <p className="text-sm leading-relaxed handwriting text-orange-900 italic">“{activeEntry.aiResponse.clue}”</p>
                    </motion.div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            mode === 'diary' ? (
              <div className="h-full flex flex-col p-12">
                <div className="max-w-3xl mx-auto w-full flex-1 flex flex-col">
                  <div className="flex items-center gap-2 mb-6 text-blue-300/60">
                    <Sparkles size={16} />
                    <span className="text-sm font-serif italic">记录醒时心事...</span>
                  </div>
                  <textarea
                    value={sentenceRefs.current.length > 0 ? '' : ''} // Reset refs
                    onChange={(e) => {}} // Placeholder
                    className="hidden"
                  />
                  <DiaryEditor onSave={handleSaveDiary} onInteract={onInteract} />
                </div>
              </div>
            ) : (
              <DreamMode onSave={handleSaveDream} onInteract={onInteract} />
            )
          )}
        </div>
      </div>
    </div>
  );
};

const DiaryEditor = ({ onSave, onInteract }: { onSave: (entry: DiaryEntry) => void, onInteract: (text: string) => void }) => {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!content.trim() || loading) return;
    setLoading(true);
    onInteract(content);
    
    const response = await getMindockResponse('diary', content);
    const annotations: DiaryAnnotation[] = [];
    const blocks = response.split('---');
    
    blocks.forEach(block => {
      const originalMatch = block.match(/原文：(.*?)(?:\n|$)/);
      const feedbackMatch = block.match(/批注：([\s\S]*?)(?:\n|$)/);
      if (originalMatch && feedbackMatch) {
        annotations.push({
          original: originalMatch[1].trim(),
          feedback: feedbackMatch[1].trim()
        });
      }
    });

    const newEntry: DiaryEntry = {
      id: Date.now().toString(),
      type: 'diary',
      timestamp: Date.now(),
      content,
      annotations
    };

    onSave(newEntry);
    setContent('');
    setLoading(false);
  };

  return (
    <div className="flex-1 flex flex-col">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="亲爱的星空..."
        className="flex-1 w-full p-8 rounded-3xl glass-card border-white/5 outline-none focus:border-blue-400/30 transition-all resize-none font-serif text-xl leading-relaxed text-blue-50 glow-border"
      />
      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSave}
          disabled={loading || !content.trim()}
          className="px-10 py-4 bg-indigo-600 text-white rounded-full hover:bg-indigo-500 transition-all disabled:opacity-30 shadow-xl shadow-indigo-600/20 font-medium jelly-button"
        >
          {loading ? '心泊正在阅读...' : '封存星尘'}
        </button>
      </div>
    </div>
  );
};

const ReleaseMode = ({ onInteract }: { onInteract: (text: string) => void }) => {
  const [input, setInput] = useState('');
  const [balloonContent, setBalloonContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isReleased, setIsReleased] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const controls = useAnimation();
  const dragStartPos = useRef<{ y: number }>({ y: 0 });

  // 注入情绪：虚线气球变成实体，缩小并移动到下方
  const handleInject = async () => {
    if (!input.trim() || loading) return;
    setLoading(true);
    onInteract(input);
    
    const response = await getMindockResponse('release', input);
    const content = response.replace('气球内容：', '').trim();
    setBalloonContent(content);
    
    setLoading(false);
    setIsReleased(false);
    
    // 动画：从中间缩小并移动到下方等待位置
    controls.set({ 
      scale: 1, 
      opacity: 1, 
      y: 0,
      x: 0
    });
    controls.start({
      scale: 0.85,
      y: 150,
      transition: { 
        type: "spring", 
        stiffness: 400, 
        damping: 25,
        duration: 0.6
      }
    });
  };

  const handleDragStart = (_: any, info: any) => {
    dragStartPos.current = { y: info.point.y };
    setIsDragging(true);
  };

  const handleDragEnd = (_: any, info: any) => {
    setIsDragging(false);
    const dragDistance = info.point.y - dragStartPos.current.y;
    // 向上拖拽超过60px触发释放
    if (dragDistance < -60) {
      setIsReleased(true);
      controls.start({
        y: -1000,
        x: (Math.random() - 0.5) * 200,
        scale: 0.2,
        opacity: 0,
        rotate: Math.random() * 40 - 20,
        transition: { duration: 1.8, ease: [0.36, 0.66, 0.04, 1] }
      });
    } else {
      // 回弹到等待位置
      controls.start({ 
        scale: 0.85,
        y: 150,
        x: 0,
        transition: { type: "spring", stiffness: 400, damping: 25 } 
      });
    }
  };

  const reset = () => {
    setBalloonContent(null);
    setInput('');
    setIsReleased(false);
    setIsDragging(false);
    controls.set({ scale: 1, opacity: 1, y: 0 });
  };

  // 判断当前阶段
  const isPhaseOne = balloonContent === null && !isReleased;      // 虚线气球阶段
  const isPhaseTwo = balloonContent !== null && !isReleased;      // 实体拖拽阶段
  const isPhaseThree = balloonContent !== null && isReleased;     // 释放成功阶段

  return (
    <div className="h-full flex flex-col relative overflow-hidden">
      {/* 释放时的星光特效 */}
      <AnimatePresence>
        {isPhaseThree && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-0 pointer-events-none"
          >
            <div className="absolute inset-0 bg-gradient-to-t from-indigo-950/40 via-transparent to-transparent" />
            {[...Array(60)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ 
                  x: window.innerWidth / 2 + (Math.random() - 0.5) * 200,
                  y: window.innerHeight - 100,
                  opacity: 0,
                  scale: 0
                }}
                animate={{ 
                  y: [null, Math.random() * -600 - 200],
                  x: [null, (Math.random() - 0.5) * 400],
                  opacity: [0, 0.8, 0],
                  scale: [0, 1 + Math.random() * 2, 0]
                }}
                transition={{ 
                  duration: 1.5 + Math.random() * 1.5,
                  delay: Math.random() * 0.8
                }}
                className="absolute w-1 h-1 bg-yellow-200 rounded-full"
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* 主内容区 */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10">
        
        {/* 拖拽提示 - 放在页面上部，只在阶段二显示 */}
        <AnimatePresence>
          {isPhaseTwo && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full flex justify-center pt-8"
            >
              <p className="text-xs text-blue-300/60 font-serif italic tracking-wide">
                ↑ 向上拖拽气球，让情绪飞向太空 ↑
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 输入区域 - 只在第一阶段显示 */}
        {isPhaseOne && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-md px-6"
          >
            <div className="glass-card rounded-2xl p-4 flex gap-3 border-white/10">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleInject()}
                placeholder="写下此刻的心情，让它随风飘走..."
                className="flex-1 bg-transparent px-4 py-3 outline-none text-sm text-white placeholder-white/30"
                autoFocus
              />
              <button
                onClick={handleInject}
                disabled={loading || !input.trim()}
                className="px-5 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-500 hover:to-purple-500 transition-all disabled:opacity-30 flex items-center gap-2 jelly-button text-sm font-medium"
              >
                {loading ? <Zap className="animate-spin" size={16} /> : <Sparkles size={16} />}
                注入情绪
              </button>
            </div>
            <p className="text-xs text-center text-blue-300/40 mt-3">
               写下文字，让气球承载你的情绪 
            </p>
          </motion.div>
        )}

        {/* 气球区域 - 居中显示 */}
        <div className="flex-1 flex items-center justify-center w-full relative min-h-[400px]">
          <AnimatePresence mode="wait">
            {/* 阶段一：虚线气球轮廓 */}
            {isPhaseOne && (
              <motion.div 
                key="outline-balloon"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="relative flex flex-col items-center mt-8"
              >
                <div 
                  className="w-56 h-68 rounded-full flex items-center justify-center p-6 text-center"
                  style={{
                    border: '2px dashed rgba(139, 92, 246, 0.5)',
                    background: 'rgba(139, 92, 246, 0.05)',
                    boxShadow: '0 0 30px rgba(139, 92, 246, 0.1)'
                  }}
                >
                  <span className="text-blue-300/30 text-sm handwriting">
                    等待你的情绪注入...
                  </span>
                </div>
                <div className="w-0.5 h-16 bg-gradient-to-b from-purple-400/30 to-transparent mt-1" />
                <Wind className="text-purple-400/30 mt-4" size={24} />
              </motion.div>
            )}

            {/* 阶段二：实体气球，可拖拽 */}
            {isPhaseTwo && (
              <motion.div
                key="real-balloon"
                drag
                dragMomentum={false}
                dragElastic={0.15}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                animate={controls}
                initial={{ scale: 0.85, y: 150 }}
                style={{ 
                  cursor: isDragging ? 'grabbing' : 'grab',
                  touchAction: 'none'
                }}
                className="relative flex flex-col items-center z-20 group"
              >
                {/* 气球主体 */}
                <div className="relative">
                  <motion.div 
                    className="w-56 h-68 rounded-full flex items-center justify-center p-6 text-center shadow-2xl"
                    animate={{
                      scale: isDragging ? 1.05 : 1,
                      transition: { duration: 0.1 }
                    }}
                    style={{
                      background: 'radial-gradient(circle at 35% 40%, rgba(139, 92, 246, 0.85), rgba(79, 70, 229, 0.7), rgba(168, 85, 247, 0.8))',
                      backdropFilter: 'blur(8px)',
                      border: '1px solid rgba(255, 255, 255, 0.4)',
                      boxShadow: '0 0 50px rgba(139, 92, 246, 0.6), inset 0 0 20px rgba(255, 255, 255, 0.3)'
                    }}
                  >
                    <span className="text-white text-base leading-relaxed break-words max-h-64 overflow-auto handwriting drop-shadow-lg px-2">
                      {balloonContent}
                    </span>
                  </motion.div>
                  {/* 气球结点 */}
                  <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-4 h-4 bg-purple-500/70 rounded-sm rotate-45" />
                </div>
                {/* 绳子 */}
                <div className="w-0.5 h-20 bg-gradient-to-b from-white/50 to-transparent" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 阶段三：释放成功画面 */}
        <AnimatePresence>
          {isPhaseThree && (
            <motion.div 
              key="success"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="text-center space-y-6 absolute inset-0 flex flex-col items-center justify-center"
            >
              <motion.div
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="space-y-3"
              >
                <div className="w-16 h-16 mx-auto bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center shadow-xl">
                  <Sparkles size={28} className="text-white" />
                </div>
                <p className="text-blue-100/80 font-serif text-xl italic">
                  气球带着你的情绪，飞向星空了
                </p>
                <p className="text-blue-300/40 text-sm">愿此刻的轻盈，伴你入眠</p>
              </motion.div>
              <button 
                onClick={reset}
                className="mt-4 px-6 py-2 glass-card text-blue-300 hover:text-white rounded-full transition-all text-sm border-blue-400/30 jelly-button"
              >
                再写一个情绪
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const EmotionMode = () => {
  const [history, setHistory] = useState<EmotionRecord[]>(() => {
    const saved = localStorage.getItem('mindock_emotions_v2');
    return saved ? JSON.parse(saved) : [];
  });
  const [hovered, setHovered] = useState<EmotionRecord | null>(null);

  const timelineData = useMemo(() => {
    // Group by day for the display
    const groups: Record<string, EmotionRecord[]> = {};
    history.forEach(record => {
      const day = new Date(record.timestamp).toLocaleDateString();
      if (!groups[day]) groups[day] = [];
      groups[day].push(record);
    });
    return Object.entries(groups).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());
  }, [history]);

  return (
    <div className="max-w-5xl mx-auto p-8 space-y-12 pb-32">
      <header className="text-center space-y-2">
        <h2 className="text-3xl font-serif text-blue-50">情绪光谱时间轴</h2>
        <p className="text-blue-300/40 text-sm">记录你每一个细微的情绪起伏</p>
      </header>

      <div className="space-y-20">
        {timelineData.map(([day, records]) => (
          <section key={day} className="space-y-10">
            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-sm font-mono text-blue-300/40 uppercase tracking-widest font-bold">{day}</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <div className="relative h-64 flex items-center px-6 glass-card rounded-[40px] border-white/10 overflow-visible">
              {/* Time axis */}
              <div className="absolute bottom-10 left-10 right-10 h-px bg-white/20 flex justify-between">
                {[0, 4, 8, 12, 16, 20, 23].map(h => (
                  <span key={h} className="text-xs text-white/30 mt-3 font-medium">{h}:00</span>
                ))}
              </div>

              {/* Data points */}
              <div className="flex-1 relative h-full mx-10">
                {records.map((record, idx) => {
                  const date = new Date(record.timestamp);
                  const hours = date.getHours() + date.getMinutes() / 60;
                  const left = (hours / 24) * 100;
                  
                  // Staggered layout + Slight random scatter
                  const staggerY = (idx % 5 - 2) * 35; // -70, -35, 0, 35, 70
                  const scatterX = (Math.sin(idx) * 0.6); 
                  
                  return (
                    <motion.div
                      key={record.id}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: idx * 0.05 }}
                      onMouseEnter={() => setHovered(record)}
                      onMouseLeave={() => setHovered(null)}
                      className="absolute cursor-pointer group z-20"
                      style={{ 
                        left: `${left + scatterX}%`, 
                        top: `calc(42% + ${staggerY}px)`,
                        transform: 'translate(-50%, -50%)'
                      }}
                    >
                      <div 
                        className="w-7 h-7 rounded-full shadow-2xl transition-all duration-500 group-hover:scale-150 group-hover:glow-blue"
                        style={{ 
                          backgroundColor: record.color, 
                          boxShadow: `0 0 30px ${record.color}cc`,
                          opacity: record.intensity / 100 + 0.4
                        }}
                      />
                      
                      {/* Tooltip */}
                      <AnimatePresence>
                        {hovered?.id === record.id && (
                          <motion.div
                            initial={{ opacity: 0, y: 15, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.25 }}
                            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-8 w-72 glass-card p-6 rounded-[24px] border-white/20 z-[9999] pointer-events-none shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
                            style={{ background: 'rgba(15, 15, 25, 0.95)' }}
                          >
                            <div className="flex justify-between items-center mb-4">
                              <span className="text-sm font-bold px-3 py-1 rounded-lg bg-white/10" style={{ color: record.color }}>{record.label}</span>
                              <span className="text-xs text-white/50 font-mono">{new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <p className="text-sm text-blue-50/90 leading-relaxed italic font-serif">“{record.report}”</p>
                            <div className="mt-5 space-y-2">
                              <div className="flex justify-between text-[10px] text-white/40 uppercase tracking-widest font-bold">
                                <span>情绪强度</span>
                                <span>{record.intensity}%</span>
                              </div>
                              <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full transition-all duration-1000" style={{ width: `${record.intensity}%`, backgroundColor: record.color }} />
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </section>
        ))}

        {history.length === 0 && (
          <div className="py-20 text-center space-y-4 opacity-20">
            <CalendarIcon size={48} className="mx-auto" />
            <p className="italic">还没有情绪记录。当你与心泊交流、写日记或释放情绪时，我会自动为你记录。</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default function App() {
  const [mode, setMode] = useState<Mode>('chat');
  const [showSettings, setShowSettings] = useState(() => {
    const saved = localStorage.getItem('mindock_settings_v2');
    if (!saved) return true; // Show on first visit
    const settings = JSON.parse(saved);
    return !settings.hasOnboarded;
  });
  const [userSettings, setUserSettings] = useState<UserSettings>(() => {
    const saved = localStorage.getItem('mindock_settings_v2');
    return saved ? JSON.parse(saved) : { userName: '旅人', aiName: '心泊', hasOnboarded: false };
  });

  const [memory, setMemory] = useState<MemoryLayer>(() => {
    const saved = localStorage.getItem('mindock_memory_v2');
    return saved ? JSON.parse(saved) : { shortTerm: [], midTerm: [], longTerm: [] };
  });

  const handleSaveSettings = () => {
    setUserSettings(prev => ({ ...prev, hasOnboarded: true }));
    setShowSettings(false);
  };

  useEffect(() => {
    localStorage.setItem('mindock_settings_v2', JSON.stringify(userSettings));
  }, [userSettings]);

  useEffect(() => {
    localStorage.setItem('mindock_memory_v2', JSON.stringify(memory));
  }, [memory]);

  const updateMemory = (newMsg: Message) => {
    setMemory(prev => {
      const updatedShortTerm = [...prev.shortTerm, newMsg].slice(-10); // Keep last 10
      return { ...prev, shortTerm: updatedShortTerm };
    });
  };

  const logEmotion = async (text: string) => {
    try {
      const response = await getMindockResponse('emotion', text);
      const lines = response.split('\n');
      const label = lines.find(l => l.startsWith('情绪：'))?.replace('情绪：', '').trim() || '平静';
      const intensity = parseInt(lines.find(l => l.startsWith('强度：'))?.replace('强度：', '').trim() || '50');
      const colorName = lines.find(l => l.startsWith('颜色：'))?.replace('颜色：', '').trim() || '蓝色';
      const report = lines.find(l => l.startsWith('报告：'))?.replace('报告：', '').trim() || '';

      const saved = localStorage.getItem('mindock_emotions_v2');
      const history: EmotionRecord[] = saved ? JSON.parse(saved) : [];
      
      // Deduplication: 10-minute window
      const now = Date.now();
      const tenMinutes = 10 * 60 * 1000;
      const recentDuplicate = history.find(r => 
        r.label === label && (now - r.timestamp) < tenMinutes
      );

      if (recentDuplicate) return;

      const newRecord: EmotionRecord = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        label,
        intensity,
        color: EMOTION_COLORS[label] || '#60a5fa',
        report
      };

      localStorage.setItem('mindock_emotions_v2', JSON.stringify([newRecord, ...history]));
    } catch (e) {
      console.error("Failed to log emotion automatically", e);
    }
  };

  const navItems = [
    { id: 'chat', label: 'AI 接泊员', icon: MessageCircle, color: 'text-blue-400' },
    { id: 'diary', label: '星尘日记', icon: BookOpen, color: 'text-indigo-400' },
    { id: 'release', label: '情绪释放舱', icon: Wind, color: 'text-teal-400' },
    { id: 'emotion', label: '情绪光谱仪', icon: BarChart3, color: 'text-orange-400' },
  ];

  return (
    <div className="min-h-screen flex flex-col relative">
      <div className="universe-bg" />
      <div className="stars-far" />
      <div className="stars-mid" />
      <div className="stars-near" />
      <div className="meteor meteor-1" />
      <div className="meteor meteor-2" />
      <div className="meteor meteor-3" />
      
      {/* Header */}
      <header className="px-8 py-6 flex justify-between items-center z-50">
        <motion.div 
          initial={{ opacity: 0, x: -20 }} 
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3"
        >
          <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-[0_0_20px_rgba(79,70,229,0.4)]">
            <Heart size={22} fill="currentColor" />
          </div>
          <div>
            <h1 className="text-2xl font-serif font-bold tracking-tight text-white">Mindock <span className="text-indigo-400">心泊</span></h1>
            <p className="text-[10px] text-blue-300/40 uppercase tracking-[0.3em] font-medium">Emotional Sanctuary</p>
          </div>
        </motion.div>
        
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 text-xs text-blue-200/30 font-serif italic mr-4">
            <Sparkles size={14} />
            先被接住，再被理解
          </div>
          <button 
            onClick={() => setShowSettings(true)}
            className="p-2 glass-card rounded-xl text-blue-300 hover:text-white transition-all border-white/5"
          >
            <Zap size={18} />
          </button>
        </div>
      </header>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card max-w-md w-full p-8 rounded-[32px] border-white/10 shadow-2xl space-y-8"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-serif text-white">偏好设置</h2>
                <button onClick={() => setShowSettings(false)} className="text-blue-300/60 hover:text-white">✕</button>
              </div>
              
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs text-blue-300/40 uppercase tracking-widest font-bold">你的称呼</label>
                  <input 
                    type="text" 
                    value={userSettings.userName}
                    onChange={(e) => setUserSettings(prev => ({ ...prev, userName: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500/50 transition-all"
                    placeholder="旅人"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-blue-300/40 uppercase tracking-widest font-bold">AI 的名字</label>
                  <input 
                    type="text" 
                    value={userSettings.aiName}
                    onChange={(e) => setUserSettings(prev => ({ ...prev, aiName: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500/50 transition-all"
                    placeholder="心泊"
                  />
                </div>
              </div>

              <button 
                onClick={handleSaveSettings}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-medium shadow-xl shadow-indigo-600/20 hover:bg-indigo-500 transition-all"
              >
                保存设置
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            {...FADE_UP_ANIMATION}
            exit={{ opacity: 0, y: -10 }}
            className="h-full"
          >
            {mode === 'chat' && (
              <ChatMode 
                onInteract={logEmotion} 
                userSettings={userSettings} 
                memory={memory} 
                onUpdateMemory={updateMemory} 
              />
            )}
            {mode === 'diary' && <NotebookMode onInteract={logEmotion} />}
            {mode === 'release' && <ReleaseMode onInteract={logEmotion} />}
            {mode === 'emotion' && <EmotionMode />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-2 py-2 glass-card rounded-full border-white/10 shadow-2xl flex items-center gap-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setMode(item.id as Mode)}
            className={`relative flex items-center gap-2 px-5 py-3 rounded-full transition-all duration-500 group ${
              mode === item.id ? 'bg-white/10 glow-selected' : 'hover:bg-white/5'
            }`}
          >
            <item.icon 
              size={18} 
              className={`${mode === item.id ? item.color : 'text-white/40'} transition-colors duration-500`} 
            />
            <AnimatePresence initial={false}>
              {mode === item.id && (
                <motion.span
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 'auto', opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  className="text-xs font-medium text-white overflow-hidden whitespace-nowrap"
                >
                  {item.label}
                </motion.span>
              )}
            </AnimatePresence>
            {mode === item.id && (
              <motion.div
                layoutId="nav-glow"
                className="absolute inset-0 rounded-full border border-blue-400/30 pointer-events-none"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}
