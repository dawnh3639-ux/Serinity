import { useState, useEffect, useRef, ReactNode, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Heart, 
  Wind, 
  Brain, 
  PenTool, 
  Volume2, 
  Bell, 
  X, 
  Plus, 
  Check, 
  Trash2,
  Calendar,
  Clock,
  ChevronRight,
  Sparkles,
  Camera,
  Image as ImageIcon,
  History,
  Moon,
  TrendingUp,
  Activity,
  LifeBuoy,
  Phone,
  Search,
  ExternalLink,
  MapPin
} from 'lucide-react';
import { analyzeMood, generateSleepMoodInsights, findSupportResources, generateDailyQuote } from './services/geminiService';
import { Reminder, MoodAnalysis, ActivityType, PictureEntry, MoodLog, SleepLog } from './types';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

// Fix for default marker icon in Leaflet
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Constants
const STORAGE_KEY = 'serenity_reminders';
const PICTURE_JOURNAL_KEY = 'serenity_picture_journal';
const MOOD_HISTORY_KEY = 'serenity_mood_history';
const SLEEP_LOGS_KEY = 'serenity_sleep_logs';
const QUOTE_KEY = 'serenity_daily_quote';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function App() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'checkin' | 'activities' | 'reminders' | 'insights' | 'support' | 'calendar'>('checkin');
  const [userInput, setUserInput] = useState('');
  const [analysis, setAnalysis] = useState<MoodAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeActivity, setActiveActivity] = useState<ActivityType | null>(null);
  const [triggeredReminder, setTriggeredReminder] = useState<Reminder | null>(null);
  const [pictureEntries, setPictureEntries] = useState<PictureEntry[]>([]);
  const [showGallery, setShowGallery] = useState(false);
  const [moodLogs, setMoodLogs] = useState<MoodLog[]>([]);
  const [sleepLogs, setSleepLogs] = useState<SleepLog[]>([]);
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const [sleepInsights, setSleepInsights] = useState<string>('');
  const [showSleepForm, setShowSleepForm] = useState(false);
  const [supportLocation, setSupportLocation] = useState('');
  const [supportResources, setSupportResources] = useState<{ title: string; link: string; description: string }[]>([]);
  const [isSearchingSupport, setIsSearchingSupport] = useState(false);
  const [dailyQuote, setDailyQuote] = useState<{ quote: string; author: string } | null>(null);

  // Load data
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setReminders(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse reminders", e);
      }
    }
    
    const savedPictures = localStorage.getItem(PICTURE_JOURNAL_KEY);
    if (savedPictures) {
      try {
        setPictureEntries(JSON.parse(savedPictures));
      } catch (e) {
        console.error("Failed to parse picture entries", e);
      }
    }

    const savedMoods = localStorage.getItem(MOOD_HISTORY_KEY);
    if (savedMoods) {
      try {
        setMoodLogs(JSON.parse(savedMoods));
      } catch (e) {
        console.error("Failed to parse mood logs", e);
      }
    }

    const savedSleep = localStorage.getItem(SLEEP_LOGS_KEY);
    if (savedSleep) {
      try {
        setSleepLogs(JSON.parse(savedSleep));
      } catch (e) {
        console.error("Failed to parse sleep logs", e);
      }
    }
  }, []);

  // Save data
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
  }, [reminders]);

  useEffect(() => {
    localStorage.setItem(PICTURE_JOURNAL_KEY, JSON.stringify(pictureEntries));
  }, [pictureEntries]);

  useEffect(() => {
    localStorage.setItem(MOOD_HISTORY_KEY, JSON.stringify(moodLogs));
  }, [moodLogs]);

  useEffect(() => {
    localStorage.setItem(SLEEP_LOGS_KEY, JSON.stringify(sleepLogs));
  }, [sleepLogs]);

  // Reminder Checker Hook
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const currentDay = now.getDay();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      reminders.forEach(reminder => {
        if (!reminder.enabled) return;
        
        const isToday = reminder.days.includes(currentDay);
        const isTime = reminder.time === currentTime;
        
        // Check if already triggered today at this minute
        const lastDate = reminder.lastTriggered ? new Date(reminder.lastTriggered) : null;
        const alreadyTriggered = lastDate && 
          lastDate.getDate() === now.getDate() && 
          lastDate.getHours() === now.getHours() && 
          lastDate.getMinutes() === now.getMinutes();

        if (isToday && isTime && !alreadyTriggered) {
          triggerReminder(reminder);
        }
      });
    }, 15000); // Check every 15 seconds

    return () => clearInterval(interval);
  }, [reminders]);

  // Daily Quote logic
  useEffect(() => {
    const loadQuote = async () => {
      const saved = localStorage.getItem(QUOTE_KEY);
      const today = new Date().toDateString();
      
      if (saved) {
        const { quote, date } = JSON.parse(saved);
        if (date === today) {
          setDailyQuote(quote);
          return;
        }
      }

      const newQuote = await generateDailyQuote();
      setDailyQuote(newQuote);
      localStorage.setItem(QUOTE_KEY, JSON.stringify({ quote: newQuote, date: today }));
    };

    loadQuote();
  }, []);

  const triggerReminder = (reminder: Reminder) => {
    setTriggeredReminder(reminder);
    setReminders(prev => prev.map(r => 
      r.id === reminder.id ? { ...r, lastTriggered: new Date().toISOString() } : r
    ));
  };

  const handleAnalysis = async () => {
    if (!userInput.trim()) return;
    setIsAnalyzing(true);
    const result = await analyzeMood(userInput);
    setAnalysis(result);
    setIsAnalyzing(false);

    // Save to mood logs
    const newMoodLog: MoodLog = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      anxietyLevel: result.anxietyLevel,
      isOverwhelmed: result.isOverwhelmed,
      text: userInput
    };
    setMoodLogs(prev => [newMoodLog, ...prev]);
  };

  const addReminder = (newReminder: Omit<Reminder, 'id' | 'enabled'>) => {
    const reminder: Reminder = {
      ...newReminder,
      id: crypto.randomUUID(),
      enabled: true
    };
    setReminders(prev => [...prev, reminder]);
    setShowReminderForm(false);
  };

  const deleteReminder = (id: string) => {
    setReminders(prev => prev.filter(r => r.id !== id));
  };

  const toggleReminder = (id: string) => {
    setReminders(prev => prev.map(r => 
      r.id === id ? { ...r, enabled: !r.enabled } : r
    ));
  };

  const savePictureEntry = (entry: Omit<PictureEntry, 'id' | 'createdAt'>) => {
    const newEntry: PictureEntry = {
      ...entry,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString()
    };
    setPictureEntries(prev => [newEntry, ...prev]);
  };

  return (
    <div className="min-h-screen bg-[#fdfaf6] text-[#4a4a40] font-serif selection:bg-[#5a5a40]/10 overflow-x-hidden">
      {/* Immersive Background */}
      <div className="fixed inset-0 pointer-events-none opacity-30">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-olive-100 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-beige-200 rounded-full blur-[100px]" />
      </div>

      {/* Main Content Area */}
      <main className="relative z-10 max-w-2xl mx-auto px-6 pt-12 pb-32 min-h-screen flex flex-col">
        {/* Header */}
        <header className="mb-12 text-center">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#5a5a40]/5 text-[#5a5a40] text-sm mb-4"
          >
            <Sparkles size={14} />
            <span className="tracking-widest uppercase text-[10px] font-sans font-bold">Serenity</span>
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl font-light text-[#2a2a20] mb-2"
          >
            Find your center.
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg opacity-60 italic"
          >
            A mindful space for your emotional well-being.
          </motion.p>
        </header>

        {/* Tab Content */}
        <div className="flex-1">
          <AnimatePresence mode="wait">
            {activeTab === 'checkin' && (
              <motion.div
                key="checkin"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="space-y-8"
              >
                {/* Daily Quote Card */}
                {dailyQuote && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="relative overflow-hidden bg-[#5a5a40] text-white rounded-[32px] p-8 shadow-sm group"
                  >
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-700">
                      <Sparkles size={120} />
                    </div>
                    <div className="relative z-10">
                      <p className="text-[10px] font-sans font-bold uppercase tracking-[0.2em] opacity-60 mb-4">Daily Reflection</p>
                      <h3 className="text-2xl font-light italic leading-relaxed mb-6">
                        "{dailyQuote.quote}"
                      </h3>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-[1px] bg-white opacity-40"></div>
                        <p className="text-xs font-sans font-bold uppercase tracking-widest opacity-60">
                          {dailyQuote.author}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}

                <div className="bg-white rounded-[32px] p-8 shadow-sm border border-[#5a5a40]/5">
                  <h2 className="text-xl mb-4 font-sans font-semibold tracking-tight">How are you feeling right now?</h2>
                  <textarea 
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    placeholder="Describe your thoughts, feelings, or what's on your mind..."
                    className="w-full h-32 bg-transparent border-none focus:ring-0 resize-none text-lg text-[#4a4a40] placeholder:text-[#5a5a40]/30 font-serif leading-relaxed"
                  />
                  <div className="flex justify-end pt-4 border-t border-[#5a5a40]/5">
                    <button 
                      onClick={handleAnalysis}
                      disabled={isAnalyzing || !userInput.trim()}
                      className="inline-flex items-center gap-2 bg-[#5a5a40] text-white px-6 py-3 rounded-full hover:bg-[#4a4a40] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-sans text-sm font-semibold tracking-wide"
                    >
                      {isAnalyzing ? "Reflecting..." : "Analyze Mood"}
                      {!isAnalyzing && <ChevronRight size={18} />}
                    </button>
                  </div>
                </div>

                {analysis && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[#5a5a40]/5 rounded-[32px] p-8 border border-[#5a5a40]/10"
                  >
                    <div className="flex items-start gap-6">
                      <div className={`p-4 rounded-2xl ${analysis.anxietyLevel > 0.6 ? 'bg-orange-100/50 text-orange-700' : 'bg-blue-100/50 text-blue-700'}`}>
                        <Heart className={analysis.anxietyLevel > 0.6 ? 'animate-pulse' : ''} />
                      </div>
                      <div>
                        <p className="text-lg leading-snug mb-4 font-medium italic">"{analysis.message}"</p>
                        <div className="flex flex-wrap gap-2">
                          <span className="px-3 py-1 rounded-full bg-white text-xs font-sans font-bold uppercase tracking-wider text-[#5a5a40]">
                            Anxiety: {Math.round(analysis.anxietyLevel * 100)}%
                          </span>
                          {analysis.isOverwhelmed && (
                            <span className="px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-sans font-bold uppercase tracking-wider">
                              Overwhelmed
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-8 pt-8 border-t border-[#5a5a40]/10 text-center">
                      <p className="text-sm font-sans font-bold text-[#5a5a40]/60 uppercase tracking-widest mb-4">Recommended for you</p>
                      <button 
                        onClick={() => {
                          setActiveActivity(analysis.recommendedActivity);
                          setActiveTab('activities');
                        }}
                        className="w-full flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-[#5a5a40]/5 hover:border-[#5a5a40]/20 transition-all group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-3 rounded-xl bg-[#fdfaf6] text-[#5a5a40]">
                            {getActivityIcon(analysis.recommendedActivity)}
                          </div>
                          <div className="text-left">
                            <p className="font-semibold text-lg capitalize">{analysis.recommendedActivity} Activity</p>
                            <p className="text-sm opacity-60">A gentle exercise to help you find calm.</p>
                          </div>
                        </div>
                        <ChevronRight className="group-hover:translate-x-1 transition-transform" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}

            {activeTab === 'activities' && (
              <motion.div
                key="activities"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="space-y-6"
              >
                {activeActivity ? (
                  <ActivityViewer 
                    type={activeActivity} 
                    onClose={() => setActiveActivity(null)} 
                    onSavePicture={savePictureEntry}
                  />
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    <ActivityCard 
                      title="Breathing" 
                      desc="Deep rhythm for physical calm." 
                      icon={<Wind />} 
                      onClick={() => setActiveActivity('breathing')} 
                    />
                    <ActivityCard 
                      title="Grounding" 
                      desc="Reconnect with your surroundings." 
                      icon={<Brain />} 
                      onClick={() => setActiveActivity('grounding')} 
                    />
                    <ActivityCard 
                      title="Journaling" 
                      desc="Let your thoughts flow onto paper." 
                      icon={<PenTool />} 
                      onClick={() => setActiveActivity('journaling')} 
                    />
                    <ActivityCard 
                      title="Guided Audio" 
                      desc="Soothing sounds and guidance." 
                      icon={<Volume2 />} 
                      onClick={() => setActiveActivity('listening')} 
                    />
                    <ActivityCard 
                      title="Picture Journaling" 
                      desc="Capture moments of peace and reflection." 
                      icon={<Camera />} 
                      onClick={() => setActiveActivity('picture_journaling')} 
                    />
                    
                    {pictureEntries.length > 0 && (
                      <button 
                        onClick={() => setShowGallery(true)}
                        className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl bg-[#5a5a40]/5 text-[#5a5a40] font-sans font-bold text-sm uppercase tracking-widest hover:bg-[#5a5a40]/10 transition-colors"
                      >
                        <History size={16} />
                        View Picture Gallery
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'reminders' && (
              <motion.div
                key="reminders"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
              >
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-light">Your Daily Reminders</h2>
                  <button 
                    onClick={() => setShowReminderForm(true)}
                    className="p-3 rounded-full bg-[#5a5a40] text-white hover:bg-[#4a4a40] transition-colors"
                  >
                    <Plus size={20} />
                  </button>
                </div>

                <div className="space-y-4">
                  {reminders.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-[32px] border-2 border-dashed border-[#5a5a40]/10">
                      <Bell className="mx-auto mb-4 opacity-20" size={48} />
                      <p className="opacity-60 italic">No reminders set yet. Add one to stay centered.</p>
                    </div>
                  ) : (
                    reminders.map(r => (
                      <div 
                        key={r.id} 
                        className={`bg-white p-6 rounded-[24px] border transition-all ${r.enabled ? 'border-[#5a5a40]/10 shadow-sm' : 'border-transparent opacity-50 gray-scale'}`}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <Clock size={16} className="text-[#5a5a40]" />
                            <span className="text-2xl font-sans font-bold tracking-tight">{r.time}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => deleteReminder(r.id)}
                              className="p-2 text-red-400 hover:text-red-600 transition-colors"
                            >
                              <Trash2 size={18} />
                            </button>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input type="checkbox" checked={r.enabled} onChange={() => toggleReminder(r.id)} className="sr-only peer" />
                              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#5a5a40]"></div>
                            </label>
                          </div>
                        </div>
                        <p className="text-lg font-medium italic mb-4">"{r.message}"</p>
                        <div className="flex gap-1">
                          {DAYS.map((day, idx) => (
                            <span key={day} className={`text-[10px] font-sans font-bold px-2 py-1 rounded-md ${r.days.includes(idx) ? 'bg-[#5a5a40] text-white' : 'bg-[#5a5a40]/5 opacity-40'}`}>
                              {day}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'insights' && (
              <motion.div
                key="insights"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="space-y-8"
              >
                <div className="bg-white rounded-[32px] p-8 shadow-sm border border-[#5a5a40]/5">
                   <div className="flex items-center justify-between mb-6">
                      <h2 className="text-2xl font-light">Wellness Insights</h2>
                      <div className="p-3 bg-[#5a5a40]/5 text-[#5a5a40] rounded-full">
                        <TrendingUp size={24} />
                      </div>
                   </div>

                   {/* Insight Box */}
                   <div className="bg-[#5a5a40]/5 rounded-2xl p-6 border border-[#5a5a40]/10 mb-8">
                      <div className="flex items-center gap-2 mb-3">
                        <Brain size={16} className="text-[#5a5a40]" />
                        <span className="text-[10px] font-sans font-bold uppercase tracking-widest text-[#5a5a40]/60">Gemini Mindful Coach</span>
                      </div>
                      <p className="text-lg italic leading-relaxed text-[#4a4a40]">
                        {isGeneratingInsights ? "Connecting patterns in your wellness data..." : (sleepInsights || "Try logging both your mood and sleep for a few days to get personalized insights.")}
                      </p>
                      <button 
                        onClick={async () => {
                          setIsGeneratingInsights(true);
                          const insights = await generateSleepMoodInsights(moodLogs, sleepLogs);
                          setSleepInsights(insights);
                          setIsGeneratingInsights(false);
                        }}
                        disabled={isGeneratingInsights || moodLogs.length === 0 || sleepLogs.length === 0}
                        className="mt-4 text-xs font-sans font-bold uppercase tracking-widest text-[#5a5a40] hover:underline flex items-center gap-2 disabled:opacity-30"
                      >
                        <Activity size={12} />
                        Refresh Insights
                      </button>
                   </div>

                   {/* Stats Grid */}
                   <div className="grid grid-cols-2 gap-4">
                      <div className="bg-[#fdfaf6] p-6 rounded-2xl border border-[#5a5a40]/5">
                        <span className="text-[10px] font-sans font-bold uppercase tracking-widest text-[#5a5a40]/40 block mb-1">Avg Anxiety</span>
                        <p className="text-3xl font-sans font-bold text-[#5a5a40]">
                          {moodLogs.length > 0 ? `${Math.round((moodLogs.reduce((acc, m) => acc + m.anxietyLevel, 0) / moodLogs.length) * 100)}%` : '--'}
                        </p>
                      </div>
                      <div className="bg-[#fdfaf6] p-6 rounded-2xl border border-[#5a5a40]/5">
                        <span className="text-[10px] font-sans font-bold uppercase tracking-widest text-[#5a5a40]/40 block mb-1">Avg Sleep</span>
                        <p className="text-3xl font-sans font-bold text-[#5a5a40]">
                          {sleepLogs.length > 0 ? `${(sleepLogs.reduce((acc, s) => acc + s.duration, 0) / sleepLogs.length).toFixed(1)}h` : '--'}
                        </p>
                      </div>
                   </div>
                </div>

                {/* Sleep Log Flow */}
                <div className="bg-white rounded-[32px] p-8 shadow-sm border border-[#5a5a40]/5">
                   <div className="flex items-center justify-between mb-6">
                      <h2 className="text-2xl font-light">Sleep Logs</h2>
                      <button 
                        onClick={() => setShowSleepForm(true)}
                        className="p-3 rounded-full bg-[#5a5a40]/5 text-[#5a5a40] hover:bg-[#5a5a40] hover:text-white transition-all"
                      >
                        <Plus size={20} />
                      </button>
                   </div>
                   
                   <div className="space-y-4">
                      {sleepLogs.length === 0 ? (
                        <p className="text-center py-12 opacity-40 italic">No sleep entries found.</p>
                      ) : (
                        sleepLogs.slice(0, 5).map(log => (
                          <div key={log.id} className="flex items-center gap-4 p-4 rounded-2xl bg-[#5a5a40]/5 border border-[#5a5a40]/5">
                            <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center text-[#5a5a40]">
                              <Moon size={24} />
                            </div>
                            <div className="flex-1">
                              <p className="font-sans font-bold tracking-tight text-[#2a2a20]">{log.duration} hours</p>
                              <p className="text-xs opacity-60 font-medium">{new Date(log.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} • Quality: {log.quality}/5</p>
                            </div>
                            <button 
                              onClick={() => setSleepLogs(prev => prev.filter(s => s.id !== log.id))}
                              className="p-2 text-red-300 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))
                      )}
                   </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'support' && (
              <SupportView 
                location={supportLocation} 
                setLocation={setSupportLocation} 
                resources={supportResources} 
                setResources={setSupportResources} 
                isSearching={isSearchingSupport} 
                setIsSearching={setIsSearchingSupport} 
              />
            )}

            {activeTab === 'calendar' && (
              <CalendarView 
                moodLogs={moodLogs}
                sleepLogs={sleepLogs}
                pictureEntries={pictureEntries}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Floating Navigation */}
        <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-xl border border-[#5a5a40]/10 px-4 py-3 rounded-full shadow-lg flex items-center gap-2 z-50 overflow-x-auto no-scrollbar max-w-[95vw]">
          <NavButton 
            active={activeTab === 'checkin'} 
            onClick={() => setActiveTab('checkin')} 
            icon={<Heart size={20} />} 
            label="Check-in" 
          />
          <NavButton 
            active={activeTab === 'activities'} 
            onClick={() => setActiveTab('activities')} 
            icon={<Wind size={20} />} 
            label="Practice" 
          />
          <NavButton 
            active={activeTab === 'reminders'} 
            onClick={() => setActiveTab('reminders')} 
            icon={<Bell size={20} />} 
            label="Reminders" 
          />
          <NavButton 
            active={activeTab === 'insights'} 
            onClick={() => setActiveTab('insights')} 
            icon={<TrendingUp size={20} />} 
            label="Insights" 
          />
          <NavButton 
            active={activeTab === 'support'} 
            onClick={() => setActiveTab('support')} 
            icon={<LifeBuoy size={20} />} 
            label="Support" 
          />
          <NavButton 
            active={activeTab === 'calendar'} 
            onClick={() => setActiveTab('calendar')} 
            icon={<Calendar size={20} />} 
            label="Calendar" 
          />
        </nav>
      </main>

      {/* Reminder Notification Overlay */}
      <AnimatePresence>
        {triggeredReminder && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-white/90 backdrop-blur-3xl flex items-center justify-center px-6 text-center"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="max-w-md w-full"
            >
              <div className="w-20 h-20 bg-[#5a5a40] text-white rounded-full flex items-center justify-center mx-auto mb-8 animate-pulse">
                <Bell size={32} />
              </div>
              <p className="text-sm font-sans font-bold uppercase tracking-[0.2em] text-[#5a5a40] mb-4">Mindful Check-in</p>
              <h2 className="text-3xl font-light mb-8 leading-tight italic">"{triggeredReminder.message}"</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button 
                  onClick={() => {
                    setTriggeredReminder(null);
                    setActiveTab('checkin');
                  }}
                  className="bg-[#5a5a40] text-white px-8 py-4 rounded-full font-sans font-bold"
                >
                  I'm Ready
                </button>
                <button 
                  onClick={() => setTriggeredReminder(null)}
                  className="bg-[#5a5a40]/5 text-[#5a5a40] px-8 py-4 rounded-full font-sans font-bold"
                >
                  Not Now
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Reminder Modal */}
      <AnimatePresence>
        {showReminderForm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowReminderForm(false)}
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-md rounded-[40px] p-8 shadow-2xl relative z-10"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-light">New Reminder</h3>
                <button onClick={() => setShowReminderForm(false)} className="opacity-30 hover:opacity-100 transition-opacity">
                  <X />
                </button>
              </div>
              
              <ReminderForm onSave={addReminder} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Picture Gallery Modal */}
      <AnimatePresence>
        {showGallery && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowGallery(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-[40px] p-8 shadow-2xl relative z-10 max-h-[80vh] overflow-hidden flex flex-col"
            >
              <div className="flex justify-between items-center mb-8 shrink-0">
                <h3 className="text-2xl font-light">Memory Gallery</h3>
                <button onClick={() => setShowGallery(false)} className="opacity-30 hover:opacity-100 transition-opacity p-2">
                  <X />
                </button>
              </div>
              
              <div className="overflow-y-auto pr-2 grid grid-cols-1 md:grid-cols-2 gap-6 pb-4">
                {pictureEntries.map(entry => (
                  <div key={entry.id} className="group">
                    <div className="aspect-square rounded-2xl overflow-hidden bg-gray-100 mb-2 relative">
                      <img src={entry.imageUrl} alt="Journal" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                      <div className="absolute top-2 right-2 flex gap-1">
                        <button 
                          onClick={() => setPictureEntries(prev => prev.filter(p => p.id !== entry.id))}
                          className="bg-white/90 p-2 rounded-full text-red-500 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs font-sans font-bold uppercase tracking-widest text-[#5a5a40]/40 mb-1">
                      {new Date(entry.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                    <p className="text-sm italic opacity-80 leading-relaxed">"{entry.notes}"</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sleep Log Modal */}
      <AnimatePresence>
        {showSleepForm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSleepForm(false)}
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-md rounded-[40px] p-8 shadow-2xl relative z-10"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-light">Log Sleep</h3>
                <button onClick={() => setShowSleepForm(false)} className="opacity-30 hover:opacity-100 transition-opacity">
                  <X />
                </button>
              </div>
              
              <SleepForm onSave={(log) => {
                const newLog = { ...log, id: crypto.randomUUID() };
                setSleepLogs(prev => [newLog, ...prev]);
                setShowSleepForm(false);
              }} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Sub-components
function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-2 px-5 py-2.5 rounded-full transition-all ${active ? 'bg-[#5a5a40] text-white shadow-md' : 'text-[#5a5a40]/60 hover:text-[#5a5a40] hover:bg-[#5a5a40]/5'}`}
    >
      {icon}
      {active && <span className="text-sm font-sans font-bold tracking-tight">{label}</span>}
    </button>
  );
}

function ActivityCard({ title, desc, icon, onClick }: { title: string, desc: string, icon: ReactNode, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="bg-white p-6 rounded-[24px] border border-[#5a5a40]/10 shadow-sm text-left hover:border-[#5a5a40]/30 hover:shadow-md transition-all group flex items-center gap-6"
    >
      <div className="p-4 rounded-2xl bg-[#5a5a40]/5 text-[#5a5a40] group-hover:bg-[#5a5a40] group-hover:text-white transition-all">
        {icon}
      </div>
      <div>
        <h3 className="text-lg font-sans font-bold tracking-tight mb-1">{title}</h3>
        <p className="opacity-60 text-sm italic">{desc}</p>
      </div>
      <ChevronRight className="ml-auto opacity-20 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
    </button>
  );
}

function ReminderForm({ onSave }: { onSave: (r: any) => void }) {
  const [time, setTime] = useState('09:00');
  const [message, setMessage] = useState('Take a deep breath and check in with yourself.');
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);

  const toggleDay = (idx: number) => {
    setSelectedDays(prev => prev.includes(idx) ? prev.filter(d => d !== idx) : [...prev, idx]);
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="text-[10px] font-sans font-bold uppercase tracking-widest text-[#5a5a40]/60 block mb-2">Time</label>
        <div className="flex items-center gap-3 bg-[#5a5a40]/5 p-4 rounded-2xl border border-[#5a5a40]/5">
          <Clock size={20} className="text-[#5a5a40]" />
          <input 
            type="time" 
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="bg-transparent border-none focus:ring-0 text-3xl font-sans font-bold tracking-tight p-0 w-full text-[#2a2a20]"
          />
        </div>
      </div>

      <div>
        <label className="text-[10px] font-sans font-bold uppercase tracking-widest text-[#5a5a40]/60 block mb-2">Message</label>
        <textarea 
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full bg-[#5a5a40]/5 p-4 rounded-2xl border border-[#5a5a40]/5 focus:ring-0 italic text-[#4a4a40]"
          rows={3}
          placeholder="Enter a calming message..."
        />
      </div>

      <div>
        <label className="text-[10px] font-sans font-bold uppercase tracking-widest text-[#5a5a40]/60 block mb-4">Repeat</label>
        <div className="flex justify-between gap-1">
          {DAYS.map((day, idx) => (
            <button
              key={day}
              onClick={() => toggleDay(idx)}
              className={`w-10 h-10 rounded-full text-xs font-sans font-bold transition-all ${selectedDays.includes(idx) ? 'bg-[#5a5a40] text-white shadow-sm' : 'bg-[#5a5a40]/5 text-[#5a5a40]/40'}`}
            >
              {day[0]}
            </button>
          ))}
        </div>
      </div>

      <button 
        onClick={() => onSave({ time, message, days: selectedDays })}
        className="w-full bg-[#5a5a40] text-white py-4 rounded-full font-sans font-bold flex items-center justify-center gap-2"
      >
        <Check size={20} />
        Save Reminder
      </button>
    </div>
  );
}

function ActivityViewer({ type, onClose, onSavePicture }: { type: ActivityType, onClose: () => void, onSavePicture?: (entry: Omit<PictureEntry, 'id' | 'createdAt'>) => void }) {
  const [step, setStep] = useState(0);

  if (type === 'picture_journaling') {
    return <PictureJournalActivity onClose={onClose} onSave={onSavePicture!} />;
  }
  
  const content = {
    breathing: {
      title: "Box Breathing",
      steps: [
        { label: "Breathe in slowly through your nose for 4 seconds.", color: "bg-blue-300" },
        { label: "Hold your breath for 4 seconds.", color: "bg-green-300" },
        { label: "Exhale slowly through your mouth for 4 seconds.", color: "bg-yellow-300" },
        { label: "Wait for 4 seconds before next breath.", color: "bg-orange-300" }
      ]
    },
    grounding: {
      title: "5-4-3-2-1 Technique",
      steps: [
        { label: "Acknowledge 5 things you see around you.", color: "bg-purple-300" },
        { label: "Acknowledge 4 things you can touch.", color: "bg-indigo-300" },
        { label: "Acknowledge 3 things you hear.", color: "bg-blue-300" },
        { label: "Acknowledge 2 things you can smell.", color: "bg-pink-300" },
        { label: "Acknowledge 1 thing you can taste.", color: "bg-red-300" }
      ]
    },
    journaling: {
      title: "Stream of Consciousness",
      steps: [
        { label: "Set a timer for 5 minutes.", color: "bg-amber-300" },
        { label: "Write anything that comes to mind without judgment.", color: "bg-orange-300" },
        { label: "Focus on how your hand feels moving with the thoughts.", color: "bg-rose-300" }
      ]
    },
    listening: {
      title: "White Noise & Guidance",
      steps: [
        { label: "Find a quiet space and close your eyes.", color: "bg-slate-300" },
        { label: "Imagine a gentle wave washing away tension.", color: "bg-cyan-300" },
        { label: "Focus on the sound of your own heartbeat.", color: "bg-teal-300" }
      ]
    }
  };

  const current = content[type];

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-[40px] p-8 shadow-sm border border-[#5a5a40]/5 min-h-[400px] flex flex-col relative overflow-hidden"
    >
      <button onClick={onClose} className="absolute top-6 right-6 p-2 rounded-full hover:bg-black/5">
        <X size={20} />
      </button>

      <div className="text-center flex-1 flex flex-col items-center justify-center">
        <motion.div 
          key={step}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          <div className="w-24 h-24 rounded-full mx-auto relative">
             <motion.div 
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
              className={`absolute inset-0 rounded-full opacity-30 ${current.steps[step].color}`}
             />
             <div className={`absolute inset-4 rounded-full ${current.steps[step].color} shadow-lg`} />
          </div>
          <h3 className="text-sm font-sans font-bold uppercase tracking-widest opacity-40">{current.title}</h3>
          <p className="text-2xl font-light italic leading-snug px-4">"{current.steps[step].label}"</p>
        </motion.div>
      </div>

      <div className="mt-12 flex justify-between items-center">
        <div className="flex gap-2">
          {current.steps.map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-8 bg-[#5a5a40]' : 'w-2 bg-[#5a5a40]/10'}`} />
          ))}
        </div>
        <div className="flex gap-2">
           {step > 0 && (
             <button onClick={() => setStep(s => s - 1)} className="p-4 rounded-full bg-[#5a5a40]/5 text-[#5a5a40]">
               Back
             </button>
           )}
           <button 
            onClick={() => step < current.steps.length - 1 ? setStep(s => s + 1) : onClose()} 
            className="bg-[#5a5a40] text-white px-8 py-4 rounded-full font-sans font-bold"
           >
             {step < current.steps.length - 1 ? "Next" : "Done"}
           </button>
        </div>
      </div>
    </motion.div>
  );
}

function getActivityIcon(type: ActivityType) {
  switch (type) {
    case 'breathing': return <Wind />;
    case 'grounding': return <Brain />;
    case 'journaling': return <PenTool />;
    case 'listening': return <Volume2 />;
    case 'picture_journaling': return <Camera />;
  }
}

function PictureJournalActivity({ onClose, onSave }: { onClose: () => void, onSave: (entry: Omit<PictureEntry, 'id' | 'createdAt'>) => void }) {
  const [image, setImage] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    if (image && notes) {
      onSave({ imageUrl: image, notes });
      onClose();
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-[40px] p-8 shadow-sm border border-[#5a5a40]/5 min-h-[500px] flex flex-col relative"
    >
      <button onClick={onClose} className="absolute top-6 right-6 p-2 rounded-full hover:bg-black/5 z-10">
        <X size={20} />
      </button>

      <div className="flex-1 flex flex-col gap-8">
        <header className="text-center">
          <h3 className="text-sm font-sans font-bold uppercase tracking-widest opacity-40 mb-2">Visual Reflection</h3>
          <h2 className="text-2xl font-light italic">Capture a moment of peace.</h2>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          {image ? (
            <div className="w-full aspect-video rounded-3xl overflow-hidden relative shadow-inner group">
              <img src={image} alt="Reflection" className="w-full h-full object-cover" />
              <button 
                onClick={() => setImage(null)} 
                className="absolute top-4 right-4 bg-white/90 p-2 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={18} />
              </button>
            </div>
          ) : (
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="w-full aspect-video rounded-3xl border-2 border-dashed border-[#5a5a40]/10 flex flex-col items-center justify-center gap-4 hover:border-[#5a5a40]/30 hover:bg-[#5a5a40]/5 transition-all text-[#5a5a40]"
            >
              <div className="p-6 rounded-full bg-[#5a5a40]/5">
                <Camera size={40} strokeWidth={1.5} />
              </div>
              <p className="font-sans font-bold text-sm uppercase tracking-widest opacity-60">Upload or Take Photo</p>
            </button>
          )}

          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="image/*" 
            className="hidden" 
          />

          <textarea 
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What does this moment mean to you? How do you feel looking at this?"
            className="w-full h-32 bg-[#5a5a40]/5 p-6 rounded-3xl border-none focus:ring-0 text-lg italic text-[#4a4a40]"
          />
        </div>

        <button 
          onClick={handleSave}
          disabled={!image || !notes.trim()}
          className="w-full bg-[#5a5a40] text-white py-4 rounded-full font-sans font-bold tracking-wide shadow-sm flex items-center justify-center gap-2 hover:bg-[#4a4a40] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Check size={20} />
          Save to Memory Gallery
        </button>
      </div>
    </motion.div>
  );
}

function SleepForm({ onSave }: { onSave: (log: Omit<SleepLog, 'id'>) => void }) {
  const [duration, setDuration] = useState(8);
  const [quality, setQuality] = useState(3);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  return (
    <div className="space-y-6">
      <div>
        <label className="text-[10px] font-sans font-bold uppercase tracking-widest text-[#5a5a40]/60 block mb-2">Duration (Hours)</label>
        <input 
          type="range" 
          min="1" 
          max="12" 
          step="0.5"
          value={duration}
          onChange={(e) => setDuration(parseFloat(e.target.value))}
          className="w-full accent-[#5a5a40]"
        />
        <p className="text-center text-2xl font-sans font-bold mt-2">{duration}h</p>
      </div>

      <div>
        <label className="text-[10px] font-sans font-bold uppercase tracking-widest text-[#5a5a40]/60 block mb-2">Quality (1-5)</label>
        <div className="flex justify-between gap-2">
           {[1, 2, 3, 4, 5].map(q => (
             <button
              key={q}
              onClick={() => setQuality(q)}
              className={`w-12 h-12 rounded-xl text-lg font-sans font-bold transition-all ${quality === q ? 'bg-[#5a5a40] text-white shadow-md scale-110' : 'bg-[#5a5a40]/5 text-[#5a5a40]/40'}`}
             >
               {q}
             </button>
           ))}
        </div>
      </div>

      <div>
        <label className="text-[10px] font-sans font-bold uppercase tracking-widest text-[#5a5a40]/60 block mb-2">Date</label>
        <input 
          type="date" 
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full bg-[#5a5a40]/5 p-4 rounded-2xl border border-[#5a5a40]/5 focus:ring-0 text-[#2a2a20] font-sans"
        />
      </div>

      <button 
        onClick={() => onSave({ duration, quality, date })}
        className="w-full bg-[#5a5a40] text-white py-4 rounded-full font-sans font-bold flex items-center justify-center gap-2"
      >
        <Check size={20} />
        Log Sleep
      </button>
    </div>
  );
}

function ResourceMap({ resources }: { resources: any[] }) {
  const map = useMap();

  useEffect(() => {
    if (resources.length > 0) {
      const validResources = resources.filter(r => r.lat && r.lng);
      if (validResources.length > 0) {
        const bounds = L.latLngBounds(validResources.map(r => [r.lat, r.lng]));
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [resources, map]);

  return null;
}

function SupportView({ 
  location, 
  setLocation, 
  resources, 
  setResources, 
  isSearching, 
  setIsSearching 
}: { 
  location: string;
  setLocation: (l: string) => void;
  resources: any[];
  setResources: (r: any[]) => void;
  isSearching: boolean;
  setIsSearching: (s: boolean) => void;
}) {
  const handleSearch = async (type: 'support group' | 'professional') => {
    if (!location.trim()) return;
    setIsSearching(true);
    const results = await findSupportResources(location, type);
    setResources(results);
    setIsSearching(false);
  };

  const mapCenter: [number, number] = [37.7749, -122.4194]; // Default center

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 pb-12"
    >
      <div className="bg-white rounded-[32px] p-8 shadow-sm border border-[#5a5a40]/5">
        <h2 className="text-2xl font-light mb-6">Expert Support</h2>
        <p className="opacity-60 italic mb-8">Finding someone to talk to is a vital step toward healing. We can help you find local resources.</p>
        
        <div className="space-y-6">
          <div className="relative">
            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5a5a40]/40" size={20} />
            <input 
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Enter your city or area..."
              className="w-full pl-12 pr-6 py-4 bg-[#5a5a40]/5 rounded-2xl border border-[#5a5a40]/10 focus:ring-0 font-sans"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={() => handleSearch('support group')}
              disabled={isSearching || !location.trim()}
              className="bg-[#5a5a40]/5 text-[#5a5a40] p-6 rounded-2xl border border-[#5a5a40]/10 hover:bg-[#5a5a40] hover:text-white transition-all flex flex-col items-center gap-3 disabled:opacity-30 group"
            >
              <LifeBuoy size={24} className="group-hover:scale-110 transition-transform" />
              <span className="text-xs font-sans font-bold uppercase tracking-widest">Support Groups</span>
            </button>
            <button 
              onClick={() => handleSearch('professional')}
              disabled={isSearching || !location.trim()}
              className="bg-[#5a5a40]/5 text-[#5a5a40] p-6 rounded-2xl border border-[#5a5a40]/10 hover:bg-[#5a5a40] hover:text-white transition-all flex flex-col items-center gap-3 disabled:opacity-30 group"
            >
              <Phone size={24} className="group-hover:scale-110 transition-transform" />
              <span className="text-xs font-sans font-bold uppercase tracking-widest">Professionals</span>
            </button>
          </div>
        </div>

        {isSearching && (
          <div className="mt-8 text-center py-12">
            <Sparkles className="mx-auto mb-4 animate-spin text-[#5a5a40]/40" />
            <p className="italic opacity-60">Scanning local listings for reputable support...</p>
          </div>
        )}

        {resources.length > 0 && !isSearching && (
          <div className="mt-8 space-y-6">
            <div className="h-64 rounded-3xl overflow-hidden border border-[#5a5a40]/10 shadow-inner relative z-0">
              <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <ResourceMap resources={resources} />
                {resources.filter(r => r.lat && r.lng).map((res, i) => (
                  <Marker key={i} position={[res.lat, res.lng]}>
                    <Popup>
                      <div className="p-1">
                        <h4 className="font-bold text-[#5a5a40] mb-1">{res.title}</h4>
                        <p className="text-xs italic opacity-80 mb-2 truncate max-w-[150px]">{res.description}</p>
                        <a 
                          href={res.link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-[10px] font-bold text-[#5a5a40] uppercase tracking-widest underline decoration-[#5a5a40]/30 underline-offset-2"
                        >
                          View Website
                        </a>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-sans font-bold uppercase tracking-widest opacity-40">Recommended Resources</h3>
              {resources.map((res, i) => (
                <a 
                  key={i}
                  href={res.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-4 rounded-2xl bg-white border border-[#5a5a40]/10 hover:border-[#5a5a40]/30 transition-all shadow-sm group"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-sans font-bold text-[#2a2a20]">{res.title}</h4>
                    <ExternalLink size={14} className="opacity-20 group-hover:opacity-100" />
                  </div>
                  <p className="text-sm italic opacity-60 leading-relaxed">{res.description}</p>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-[#5a5a40] text-white rounded-[32px] p-8 shadow-sm">
        <h3 className="text-xl font-light mb-6">Need Immediate Support?</h3>
        <div className="space-y-4">
          <div className="p-4 bg-white/10 rounded-2xl border border-white/5">
            <p className="text-[10px] font-sans font-bold uppercase tracking-widest opacity-60 mb-1">National Crisis Line</p>
            <p className="text-xl font-sans font-bold">Call or Text 988</p>
          </div>
          <div className="p-4 bg-white/10 rounded-2xl border border-white/5">
            <p className="text-[10px] font-sans font-bold uppercase tracking-widest opacity-60 mb-1">Crisis Text Line</p>
            <p className="text-xl font-sans font-bold">Text HOME to 741741</p>
          </div>
        </div>
        <p className="mt-6 text-xs italic opacity-80 leading-relaxed text-center">
          Available 24/7. Your safety is our priority.
        </p>
      </div>
    </motion.div>
  );
}

function CalendarView({ moodLogs, sleepLogs, pictureEntries }: { 
  moodLogs: MoodLog[], 
  sleepLogs: SleepLog[], 
  pictureEntries: PictureEntry[] 
}) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

  const daysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));

  const days = [];
  const totalDays = daysInMonth(currentDate);
  const startDay = firstDayOfMonth(currentDate);

  // Buffer for start of month
  for (let i = 0; i < startDay; i++) {
    days.push(null);
  }
  for (let i = 1; i <= totalDays; i++) {
    days.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), i));
  }

  const getLogsForDate = (date: Date) => {
    const dStr = date.toISOString().split('T')[0];
    return {
      mood: moodLogs.filter(m => m.timestamp.split('T')[0] === dStr),
      sleep: sleepLogs.filter(s => s.date === dStr),
      pictures: pictureEntries.filter(p => (p.createdAt || '').split('T')[0] === dStr)
    };
  };

  const selectedLogs = selectedDate ? getLogsForDate(selectedDate) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 pb-32"
    >
      <div className="bg-white rounded-[32px] p-8 shadow-sm border border-[#5a5a40]/5">
        <div className="flex items-center justify-between mb-8">
           <div>
             <h2 className="text-3xl font-light">{currentDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
             <p className="text-[10px] font-sans font-bold uppercase tracking-[0.2em] opacity-40">Your wellness journey</p>
           </div>
           <div className="flex gap-2">
             <button onClick={prevMonth} className="p-2 rounded-full hover:bg-[#5a5a40]/5 transition-colors">
               <ChevronRight size={20} className="rotate-180" />
             </button>
             <button onClick={nextMonth} className="p-2 rounded-full hover:bg-[#5a5a40]/5 transition-colors">
               <ChevronRight size={20} />
             </button>
           </div>
        </div>

        <div className="grid grid-cols-7 gap-2 mb-4">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => (
            <div key={d} className="text-center text-[10px] font-sans font-black opacity-20 py-2">{d}</div>
          ))}
          {days.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`} />;
            
            const logs = getLogsForDate(day);
            const isSelected = selectedDate?.toDateString() === day.toDateString();
            const hasActivity = logs.mood.length > 0 || logs.sleep.length > 0 || logs.pictures.length > 0;
            const isToday = day.toDateString() === new Date().toDateString();

            return (
              <button
                key={idx}
                onClick={() => setSelectedDate(day)}
                className={`
                  aspect-square rounded-2xl flex flex-col items-center justify-center relative transition-all border
                  ${isSelected ? 'bg-[#5a5a40] text-white border-[#5a5a40]' : 'bg-white border-transparent hover:border-[#5a5a40]/20'}
                  ${isToday && !isSelected ? 'text-[#5a5a40] font-bold' : ''}
                `}
              >
                <span className="text-sm font-sans font-bold">{day.getDate()}</span>
                {hasActivity && !isSelected && (
                  <div className="flex gap-0.5 mt-1">
                    {logs.mood.length > 0 && <div className="w-1 h-1 rounded-full bg-[#5a5a40]/40" />}
                    {logs.sleep.length > 0 && <div className="w-1 h-1 rounded-full bg-blue-300" />}
                    {logs.pictures.length > 0 && <div className="w-1 h-1 rounded-full bg-orange-300" />}
                  </div>
                )}
                {isToday && !isSelected && (
                  <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#5a5a40]" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {selectedDate && (
        <motion.div
          key={selectedDate.toISOString()}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-[32px] p-8 shadow-sm border border-[#5a5a40]/5"
        >
          <div className="flex items-baseline gap-4 mb-8">
            <span className="text-6xl font-serif font-black text-[#5a5a40]/10 leading-none">
              {selectedDate.getDate()}
            </span>
            <div>
              <h3 className="text-xl font-light">{selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
              <p className="text-[10px] font-sans font-bold uppercase tracking-widest opacity-40">Daily Log Summary</p>
            </div>
          </div>

          <div className="space-y-6">
            {selectedLogs && selectedLogs.mood.length === 0 && selectedLogs.sleep.length === 0 && selectedLogs.pictures.length === 0 && (
              <p className="text-center py-8 opacity-40 italic">No activity recorded for this day.</p>
            )}

            {selectedLogs && selectedLogs.mood.length > 0 && (
              <div>
                <h4 className="text-[10px] font-sans font-bold uppercase mb-3 opacity-40 tracking-widest flex items-center gap-2">
                  <Heart size={10} /> Mood Check-ins
                </h4>
                <div className="space-y-2">
                  {selectedLogs.mood.map((log, i) => (
                    <div key={i} className="p-4 rounded-2xl bg-[#5a5a40]/5 border border-[#5a5a40]/5">
                      <div className="flex justify-between items-start mb-1">
                        <p className="text-sm italic font-medium">"{log.text}"</p>
                        <span className="text-[10px] font-sans font-bold text-[#5a5a40]">
                          {Math.round(log.anxietyLevel * 100)}% Anxiety
                        </span>
                      </div>
                      <p className="text-[9px] opacity-40 font-bold uppercase tracking-tighter">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedLogs && selectedLogs.sleep.length > 0 && (
              <div>
                <h4 className="text-[10px] font-sans font-bold uppercase mb-3 opacity-40 tracking-widest flex items-center gap-2">
                  <Moon size={10} /> Sleep Data
                </h4>
                <div className="space-y-2">
                  {selectedLogs.sleep.map(log => (
                    <div key={log.id} className="p-4 rounded-2xl bg-[#5a5a40]/5 border border-[#5a5a40]/5 flex items-center justify-between">
                      <div>
                        <p className="font-sans font-bold text-sm tracking-tight">{log.duration} hours</p>
                        <p className="text-[10px] opacity-40">Quality: {log.quality}/5</p>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
                        <Moon size={14} className="text-[#5a5a40]" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedLogs && selectedLogs.pictures.length > 0 && (
              <div>
                <h4 className="text-[10px] font-sans font-bold uppercase mb-3 opacity-40 tracking-widest flex items-center gap-2">
                   <Camera size={10} /> Picture Journal
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {selectedLogs.pictures.map(entry => (
                    <div key={entry.id} className="group relative aspect-square rounded-xl overflow-hidden bg-gray-100">
                      <img src={entry.imageUrl} alt="Journal" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
                        <p className="text-white text-[10px] italic truncate">{entry.notes}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
