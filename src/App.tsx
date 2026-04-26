/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, useEffect, useRef, ReactNode, PointerEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CloudRain, 
  Map as MapIcon, 
  Compass,
  ShoppingBag, 
  Settings as SettingsIcon, 
  Bell, 
  Menu, 
  User, 
  Lock, 
  CheckCircle2, 
  X, 
  HelpCircle, 
  Sparkles,
  Zap,
  Moon,
  Heart,
  Volume2,
  ChevronRight,
  Info,
  Clock,
  Eye,
  ShieldAlert
} from 'lucide-react';
import { ASSETS } from './constants';
import { apiService } from './api/client';
import { getOrCreateDeviceId } from './lib/device';

type Screen = 'splash' | 'neighborhoods' | 'explore' | 'store' | 'dlc' | 'settings';

interface Toast {
  id: string;
  message: string;
}

interface Neighborhood {
  index: number;
  image: string;
  title: string;
  baseStatus: string;
  premiumOnly?: boolean;
}

const NEIGHBORHOODS: Neighborhood[] = [
  { index: 1, image: ASSETS.IMAGES.DISTRICT_SLATE, title: 'Slate Lane', baseStatus: 'Found 2/3 Stories' },
  { index: 2, image: ASSETS.IMAGES.DISTRICT_CLOCK, title: 'Clock Tower Square', baseStatus: 'Deep chimes & splashes' },
  { index: 3, image: ASSETS.IMAGES.DISTRICT_CRIMSON, title: 'Crimson Arch', baseStatus: 'Rain and echoing footsteps' },
  { index: 4, image: ASSETS.IMAGES.DISTRICT_MIST, title: 'Mist Grove', baseStatus: 'Low wind and distant bells', premiumOnly: true },
];

const ACTIVE_NEIGHBORHOOD_INDEX = 1;

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('splash');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [unlocks, setUnlocks] = useState<number[]>([]);
  const [isLoadingUnlocks, setIsLoadingUnlocks] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Splash auto-transition
  useEffect(() => {
    if (currentScreen === 'splash') {
      const timer = setTimeout(() => {
        setCurrentScreen('neighborhoods');
      }, 1500); // Specified 1.5s splash
      return () => clearTimeout(timer);
    }
  }, [currentScreen]);

  const addToast = (message: string) => {
    const id = Math.random().toString(36);
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2800); // 2.5s display + 0.3s fade as specified
  };

  const loadUnlocks = useCallback(async () => {
    setIsLoadingUnlocks(true);
    setLoadError(null);

    try {
      const currentDeviceId = getOrCreateDeviceId();
      setDeviceId(currentDeviceId);
      await apiService.register(currentDeviceId);
      const unlockResponse = await apiService.getUnlocks(currentDeviceId);
      setUnlocks(unlockResponse.unlocks.sort((a, b) => a - b));
    } catch (error) {
      console.error(error);
      setLoadError('Failed to sync unlock data. Showing local fallback.');
    } finally {
      setIsLoadingUnlocks(false);
    }
  }, []);

  useEffect(() => {
    void loadUnlocks();
  }, [loadUnlocks]);

  const handleStoryFound = useCallback(
    async (storyId: string, message: string) => {
      addToast(message);
      if (!deviceId) {
        return;
      }
      try {
        await apiService.postStory({
          deviceId,
          neighborhoodIndex: ACTIVE_NEIGHBORHOOD_INDEX,
          storyId,
        });
      } catch (error) {
        console.error(error);
      }
    },
    [deviceId],
  );

  const handleExploreSessionEnd = useCallback(
    async (durationSeconds: number) => {
      if (!deviceId || durationSeconds <= 0) {
        return;
      }
      try {
        await apiService.postStats({
          deviceId,
          neighborhoodIndex: ACTIVE_NEIGHBORHOOD_INDEX,
          durationSeconds,
        });
      } catch (error) {
        console.error(error);
      }
    },
    [deviceId],
  );

  const handleVerifyPurchase = useCallback(
    async (productId: 'complete_city' | 'dream_dlc') => {
      if (!deviceId) {
        addToast('Device not ready. Please wait a moment.');
        return;
      }
      try {
        const result = await apiService.verifyPurchase({
          deviceId,
          productId,
          receiptData: 'mock-receipt-data',
          platform: 'ios',
        });
        setUnlocks(result.unlocks.sort((a, b) => a - b));
        addToast(result.message);
      } catch (error) {
        console.error(error);
        addToast('Purchase verification failed. Please try again.');
      }
    },
    [deviceId],
  );

  const renderScreen = () => {
    switch (currentScreen) {
      case 'splash':
        return <SplashScreen />;
      case 'neighborhoods':
        return (
          <NeighborhoodsScreen 
            onExplore={() => setCurrentScreen('explore')} 
            onSettings={() => setCurrentScreen('settings')}
            neighborhoods={NEIGHBORHOODS}
            unlocks={unlocks}
            isLoading={isLoadingUnlocks}
            loadError={loadError}
            onRetry={loadUnlocks}
          />
        );
      case 'explore':
        return (
          <ExploreScreen 
            onBack={() => setCurrentScreen('neighborhoods')} 
            onStoryFound={handleStoryFound}
            onSessionEnd={handleExploreSessionEnd}
          />
        );
      case 'store':
        return (
          <StoreScreen
            onOpenDLC={() => setCurrentScreen('dlc')}
            onVerifyPurchase={handleVerifyPurchase}
          />
        );
      case 'dlc':
        return <DLCScreen onBack={() => setCurrentScreen('store')} />;
      case 'settings':
        return <SettingsScreen onBack={() => setCurrentScreen('neighborhoods')} />;
      default:
        return <SplashScreen />;
    }
  };

  return (
    <div className="relative w-full h-screen bg-[#0A0F1A] overflow-hidden select-none">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentScreen}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          className="h-full"
        >
          {renderScreen()}
        </motion.div>
      </AnimatePresence>

      {/* Global Story Toasts */}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="px-5 py-3 rounded-story bg-black/60 backdrop-blur-[10px] text-white text-sm font-light text-center border border-white/5 whitespace-nowrap shadow-xl"
            >
              {toast.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Persistent Bottom Nav - except splash/explore/dlc */}
      <AnimatePresence>
        {currentScreen !== 'splash' && currentScreen !== 'explore' && currentScreen !== 'dlc' && (
          <motion.nav 
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-0 left-0 right-0 z-50 px-6 pt-3 pb-8 flex justify-around items-center bg-zinc-950/60 backdrop-blur-3xl border-t border-white/5 rounded-t-[32px] shadow-[0_-10px_40px_rgba(0,0,0,0.5)]"
          >
            <NavButton 
              active={currentScreen === 'explore'} 
              onClick={() => setCurrentScreen('explore')}
              icon={<Compass size={24} />}
              label="Explore"
            />
            <NavButton 
              active={currentScreen === 'neighborhoods'} 
              onClick={() => setCurrentScreen('neighborhoods')}
              icon={<MapIcon size={24} />}
              label="Neighborhoods"
            />
            <NavButton 
              active={currentScreen === 'store' || currentScreen === 'dlc'} 
              onClick={() => setCurrentScreen('store')}
              icon={<ShoppingBag size={24} />}
              label="Store"
            />
            <NavButton 
              active={currentScreen === 'settings'} 
              onClick={() => setCurrentScreen('settings')}
              icon={<SettingsIcon size={24} />}
              label="Settings"
            />
          </motion.nav>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-1 transition-all duration-300 ${active ? 'text-primary drop-shadow-[0_0_8px_rgba(255,238,187,0.4)]' : 'text-zinc-500'}`}
    >
      {icon}
      <span className="text-[10px] uppercase tracking-widest font-light">{label}</span>
    </button>
  );
}

// 1. Splash Screen
function SplashScreen() {
  return (
    <div className="h-full bg-gradient-to-b from-[#0A0F1A] to-[#101826] flex flex-col items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 splash-glow pointer-events-none opacity-40" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 flex flex-col items-center"
      >
        <h1 className="text-4xl font-light tracking-[0.4em] text-white uppercase font-sans">Rainlight</h1>
        <h1 className="text-4xl font-light tracking-[0.4em] text-white uppercase font-sans mt-2">Alley</h1>
        <span className="mt-8 text-[8px] text-zinc-600 tracking-[1em] opacity-40">V3.0.1</span>
      </motion.div>
    </div>
  );
}

// 2. Explore Screen (Immersion Scene)
function ExploreScreen({
  onBack,
  onStoryFound,
  onSessionEnd,
}: {
  onBack: () => void;
  onStoryFound: (storyId: string, message: string) => void;
  onSessionEnd: (durationSeconds: number) => void;
}) {
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
  const [radius, setRadius] = useState(100); // Radius in pixels (approx 80pt)
  const [focusMode, setFocusMode] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const sessionStartRef = useRef<number>(Date.now());

  useEffect(() => {
    sessionStartRef.current = Date.now();
    return () => {
      const durationSeconds = Math.floor((Date.now() - sessionStartRef.current) / 1000);
      onSessionEnd(durationSeconds);
    };
  }, [onSessionEnd]);

  const handlePointerMove = (e: PointerEvent) => {
    if (!focusMode && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setMousePos({
        x: ((e.clientX - rect.left) / rect.width) * 100,
        y: ((e.clientY - rect.top) / rect.height) * 100,
      });
    }
  };

  const startLongPress = () => {
    longPressTimer.current = setTimeout(() => {
      setFocusMode(true);
      onStoryFound('focus_mode', 'Focus Mode Activated: Listening Intensively');
    }, 2000);
  };

  const endLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
    setFocusMode(false);
  };

  const testDiscovery = () => {
    const stories = [
      { id: 'forgotten_station', message: "You discovered the story of 'Forgotten Station'" },
      { id: 'slate_lane_secret', message: 'Secrets of Slate Lane +1' },
      { id: 'rain_melody', message: 'A faint melody echoes in the rain...' },
    ];
    const pick = stories[Math.floor(Math.random() * stories.length)];
    onStoryFound(pick.id, pick.message);
  };

  return (
    <div 
      ref={containerRef}
      className="relative h-full overflow-hidden bg-zinc-950 cursor-none"
      onPointerMove={handlePointerMove}
      onPointerDown={startLongPress}
      onPointerUp={endLongPress}
      onPointerLeave={endLongPress}
    >
      <div className="absolute inset-0 z-0 scale-110">
        <img src={ASSETS.IMAGES.EXPLORATION_BG} className="w-full h-full object-cover grayscale brightness-[0.2]" alt="Scene" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/80" />
      </div>

      {/* Flashlight Overlay Logic */}
      <motion.div 
        animate={{ 
          background: focusMode 
            ? 'rgba(0,0,0,0.95)' 
            : `radial-gradient(circle ${radius}px at ${mousePos.x}% ${mousePos.y}%, rgba(255, 238, 187, 0.15) 0%, rgba(16, 20, 26, 0.85) 60%, rgba(10, 14, 20, 1) 100%)` 
        }}
        transition={{ duration: 0.05, ease: "linear" }}
        className="absolute inset-0 z-10 pointer-events-none" 
      />

      {/* Visual Flashlight Pointer */}
      {!focusMode && (
        <motion.div 
          animate={{ left: `${mousePos.x}%`, top: `${mousePos.y}%` }}
          transition={{ duration: 0.02, ease: "linear" }} // Smooth follow lag as specified
          className="absolute z-20 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full border border-primary/5 shadow-[inset_0_0_80px_10px_rgba(244,208,63,0.05)] flex items-center justify-center pointer-events-none"
        >
          <div className="w-1 h-1 rounded-full bg-primary/40 blur-[1px]" />
        </motion.div>
      )}

      {/* UI Controls */}
      <div className="absolute top-0 left-0 right-0 z-30 p-8 flex justify-between">
        <button onClick={onBack} className="text-zinc-500 hover:text-white transition-colors cursor-pointer">
          <X size={24} />
        </button>
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/5">
           <Moon size={14} className="text-primary-container" />
           <span className="text-[10px] text-white/60 font-light">20:00</span>
        </div>
      </div>

      <div className="absolute bottom-16 left-0 right-0 z-30 flex flex-col items-center">
        <span className="text-[10px] tracking-[0.4em] uppercase text-zinc-500 font-light opacity-60">Drag to Explore</span>
        <button onClick={testDiscovery} className="mt-4 p-2 text-white/10 hover:text-white/30 transition-colors">
          <Sparkles size={16} />
        </button>
      </div>
    </div>
  );
}

// 3. Neighborhood Map List
function NeighborhoodsScreen({
  onExplore,
  onSettings,
  neighborhoods,
  unlocks,
  isLoading,
  loadError,
  onRetry,
}: {
  onExplore: () => void;
  onSettings: () => void;
  neighborhoods: Neighborhood[];
  unlocks: number[];
  isLoading: boolean;
  loadError: string | null;
  onRetry: () => void;
}) {
  const unlockedSet = new Set(unlocks);
  const unlockedCount = neighborhoods.filter((n) => unlockedSet.has(n.index)).length;
  const firstUnlocked = neighborhoods.find((n) => unlockedSet.has(n.index))?.index ?? null;

  return (
    <div className="h-full bg-[#121826] overflow-y-auto scrollbar-hide pb-32">
      <header className="sticky top-0 z-[60] flex items-center justify-between px-6 h-16 bg-zinc-950/40 backdrop-blur-3xl border-b border-white/5">
        <h1 className="text-lg font-medium text-white">Neighborhood Map</h1>
        <button onClick={onSettings} className="text-zinc-400">
          <SettingsIcon size={20} />
        </button>
      </header>
      
      <main className="px-4 pt-6 space-y-6">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-xs uppercase tracking-[0.2em] text-zinc-500 font-medium">Explore Districts</h3>
          <span className="text-xs text-primary-container">
            {isLoading ? 'Syncing...' : `${unlockedCount} Unlocked`}
          </span>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          {neighborhoods.map((neighborhood) => {
            const unlocked = unlockedSet.has(neighborhood.index);
            const status = unlocked
              ? neighborhood.baseStatus
              : neighborhood.premiumOnly
                ? 'Premium Only'
                : 'Locked by daily unlock schedule';

            return (
              <div key={neighborhood.index}>
                <DistrictCard
                  image={neighborhood.image}
                  title={neighborhood.title}
                  status={status}
                  unlocked={unlocked}
                  locked={!unlocked}
                  active={unlocked && firstUnlocked === neighborhood.index}
                  isNew={unlocked && firstUnlocked === neighborhood.index}
                  onClick={unlocked ? onExplore : undefined}
                />
              </div>
            );
          })}

          {loadError && (
            <div className="rounded-card border border-red-500/20 bg-red-500/10 p-4 text-xs text-red-200 flex items-center justify-between gap-4">
              <span>{loadError}</span>
              <button onClick={onRetry} className="text-red-100 underline underline-offset-2">
                Retry
              </button>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}

function DistrictCard({ image, title, status, unlocked, locked, active, isNew, onClick }: { image: string, title: string, status: string, unlocked?: boolean, locked?: boolean, active?: boolean, isNew?: boolean, onClick?: () => void }) {
  return (
    <motion.div 
      whileTap={{ scale: 0.98 }}
      className={`glass-card p-3 rounded-card flex items-center gap-4 border border-white/10 transition-all ${isNew ? 'border-[#E6B85C]/40 shadow-[0_0_15px_rgba(230,184,92,0.1)]' : ''}`}
      onClick={onClick}
    >
      <div className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border border-white/10">
        <img src={image} className={`w-full h-full object-cover ${locked ? 'grayscale' : ''}`} alt={title} />
        {isNew && <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-[#E6B85C] text-[8px] font-bold text-black rounded-sm">NEW</div>}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-[17px] font-bold text-white leading-tight">{title}</h4>
        <p className="text-[13px] text-[#8E9AAB] font-light mt-0.5">{status}</p>
      </div>
      <div className="pr-2">
        {locked ? <Lock size={18} className="text-[#5A6A7F]" /> : active ? <Eye size={18} className="text-[#4BC0C8]" /> : <CheckCircle2 size={18} className="text-[#34C759]" />}
      </div>
    </motion.div>
  );
}

// 4. Settings Screen
function SettingsScreen({ onBack }: { onBack: () => void }) {
  const [timer, setTimer] = useState(20);
  
  return (
    <div className="h-full bg-background overflow-y-auto scrollbar-hide pb-32">
      <header className="flex items-center px-6 h-16 bg-zinc-950/40 border-b border-white/5 gap-4">
        <button onClick={onBack}><X size={20} /></button>
        <h1 className="text-lg font-medium">Settings</h1>
      </header>

      <main className="p-6 space-y-10">
        <div className="space-y-4">
          <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-widest pl-1">Sleep Assistance</h3>
          <div className="bg-zinc-900/40 rounded-3xl overflow-hidden border border-white/5">
             <div className="p-4 flex items-center justify-between border-b border-white/5">
                <div>
                   <h4 className="text-sm">Sleep Timer</h4>
                   <p className="text-xs text-zinc-500">20 / 40 / 60 minutes</p>
                </div>
                <div className="flex gap-2">
                   {[20, 40, 60].map(m => (
                     <button 
                       key={m} 
                       onClick={() => setTimer(m)} 
                       className={`w-10 h-10 rounded-full text-xs transition-colors ${timer === m ? 'bg-primary text-black font-bold' : 'bg-zinc-800 text-zinc-400'}`}
                     >
                       {m}
                     </button>
                   ))}
                </div>
             </div>
             <SettingRow title="No-flicker Mode" sub="Smooths out light pulses" active />
             <SettingRow title="Low Brightness Override" sub="Reduces brightness lower" active />
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-widest pl-1">Experience</h3>
          <div className="bg-zinc-900/40 rounded-3xl overflow-hidden border border-white/5">
             <SettingRow title="Reduce Motion" sub="Disable all smooth animations" />
             <SettingRow title="Health Integration" sub="Sync sleep quality data" icon={<ShieldAlert size={14} className="text-zinc-600 inline ml-1 align-text-bottom" />} />
          </div>
        </div>

        <div className="space-y-4 pt-4">
           <button className="w-full py-4 text-sm text-zinc-400 font-medium hover:bg-white/5 transition-colors rounded-2xl">Restore Default Settings</button>
           <button className="w-full py-4 text-sm text-zinc-500 font-light">Privacy Policy</button>
           <p className="text-center text-[10px] text-zinc-700">VERSION 3.0.1</p>
        </div>
      </main>
    </div>
  );
}

function SettingRow({ title, sub, active, icon }: { title: string, sub: string, active?: boolean, icon?: ReactNode }) {
  return (
    <div className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
      <div className="space-y-0.5">
        <h4 className="text-sm font-medium">{title} {icon}</h4>
        <p className="text-xs text-[#9AA4B2]">{sub}</p>
      </div>
      <Switch active={active} />
    </div>
  );
}

function Switch({ active }: { active?: boolean }) {
  return (
    <div className={`w-[52pt] h-[32pt] rounded-[16pt] p-1 flex items-center transition-colors duration-300 ${active ? 'bg-[#1A73E8]' : 'bg-[#5E5E5E]'}`}>
      <div className={`w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-300 ${active ? 'translate-x-[20pt]' : 'translate-x-0'}`} />
    </div>
  );
}

// 5. Store & DLC
function StoreScreen({
  onOpenDLC,
  onVerifyPurchase,
}: {
  onOpenDLC: () => void;
  onVerifyPurchase: (productId: 'complete_city' | 'dream_dlc') => void;
}) {
  return (
    <div className="h-full bg-background overflow-y-auto scrollbar-hide pb-32">
      <header className="sticky top-0 z-[60] flex items-center justify-between px-6 h-16 bg-zinc-950/40 backdrop-blur-3xl border-b border-white/5">
        <h1 className="text-lg font-medium text-white">Rainlight · Store</h1>
        <button className="text-xs text-zinc-500 font-medium">Restore Purchases</button>
      </header>
      
      <main className="p-4 space-y-6">
        <PackCard 
          title="Complete City" 
          price="$4.99" 
          desc="30 districts + All Stories + Permanent Unlock" 
          btnText="Buy Now"
          accent
          onClick={() => {
            onVerifyPurchase('complete_city');
            onOpenDLC();
          }}
        />
        <PackCard 
          title="Dream DLC" 
          price="$1.99/mo" 
          desc="2 Monthly Dream Districts + Exclusive Sounds" 
          btnText="7-Day Free Trial"
          onClick={() => onVerifyPurchase('dream_dlc')}
        />
        <PackCard 
          title="Season Expansion" 
          price="$1.99" 
          desc="Snowy Nights, Foggy City, Sakura Rain Themes" 
          btnText="Buy Pack"
        />

        <p className="text-[10px] text-zinc-600 font-light text-center px-8 leading-relaxed">
           Payment will be confirmed via App Store/Google Play. Auto-renewal can be canceled anytime.
        </p>
      </main>
    </div>
  );
}

function PackCard({ title, price, desc, btnText, accent, onClick }: { title: string, price: string, desc: string, btnText: string, accent?: boolean, onClick?: () => void }) {
  return (
    <div className="p-6 rounded-[2rem] glass-card border border-white/10 flex flex-col items-center text-center gap-4">
      <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center text-primary-container mb-2">
         {title.includes('City') ? <Zap size={32} /> : title.includes('Dream') ? <Moon size={32} /> : <CloudRain size={32} />}
      </div>
      <h3 className="text-xl font-bold">{title}</h3>
      <p className="text-xs text-zinc-400 font-light px-4">{desc}</p>
      <div className="text-2xl font-light py-2">{price}</div>
      <button 
        onClick={onClick}
        className={`w-full py-3.5 rounded-[24pt] text-sm font-bold transition-all active:scale-95 ${accent ? 'bg-[#E6B85C] text-[#121212]' : 'bg-white/10 text-white'}`}
      >
        {btnText}
      </button>
    </div>
  );
}

function DLCScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="relative h-full overflow-y-auto scrollbar-hide bg-zinc-950">
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 h-16 bg-zinc-950/70 backdrop-blur-2xl">
        <button onClick={onBack} className="text-primary"><X size={24} /></button>
        <span className="text-primary text-sm tracking-[0.2em] font-light">RAINLIGHT</span>
        <button className="text-zinc-600"><HelpCircle size={24} /></button>
      </header>

      <main className="pt-24 pb-12 flex flex-col items-center px-8 text-center min-h-full">
        <div className="absolute inset-0 opacity-20 pointer-events-none" style={{
           backgroundImage: `linear-gradient(to bottom, rgba(16, 20, 26, 0.8), rgba(16, 20, 26, 1)), url(https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?ixlib=rb-4.0.3&auto=format&fit=crop&w=1600&q=80)`
        }} />

        <div className="relative z-10 w-full flex flex-col items-center">
          <div className="inline-block px-4 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary text-[10px] uppercase tracking-[0.3em] mb-8">Monthly Pass</div>
          <h2 className="text-6xl font-thin tracking-tighter mb-4 text-white">Dream DLC</h2>
          <p className="text-sm text-zinc-400 font-light leading-relaxed max-w-xs mb-12">Unlock the full sensory landscape of Rainlight Alley. Deeper sleep, clearer focus, curated stillness.</p>
          
          <div className="w-full glass-card rounded-[2.5rem] p-8 text-left space-y-8 shadow-[0_0_50px_rgba(244,208,63,0.1)] border-white/10">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="text-primary text-sm font-medium mb-1">Premium Access</h4>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extralight text-white">$1.99</span>
                  <span className="text-zinc-500 text-xs">/mo</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-primary-container flex items-center justify-center text-on-primary">
                <Sparkles size={24} fill="currentColor" />
              </div>
            </div>

            <ul className="space-y-6">
              <BenefitItem title="Lossless Soundscapes" desc="High-fidelity 3D spatial audio recording." />
              <BenefitItem title="Infinite Rain Duration" desc="No interruptions or looping artifacts." />
              <BenefitItem title="Exclusive 'Storm' Layers" desc="Deep thunder and rhythmic mist patterns." />
              <BenefitItem title="Offline Listening" desc="Download your favorite alleys anywhere." />
            </ul>

            <div className="space-y-4 pt-4">
              <button className="w-full py-4 rounded-[24pt] bg-[#E6B85C] text-[#121212] font-bold text-sm shadow-[0_4px_30px_rgba(244,208,63,0.3)] hover:brightness-110 active:scale-[0.98] transition-all">
                Subscribe Now
              </button>
              <button className="w-full py-4 rounded-[24pt] bg-white/5 border border-white/10 text-white font-bold text-sm hover:bg-white/10 active:scale-[0.98] transition-all">
                7-Day Free Trial
              </button>
            </div>
          </div>

          <p className="mt-12 text-[9px] text-zinc-600 uppercase tracking-widest leading-loose max-w-[200px]">
            Restore Purchases<br />
            Terms of Service • Privacy Policy<br />
            Renews monthly at $1.99 until cancelled.
          </p>
        </div>
      </main>
    </div>
  );
}

function BenefitItem({ title, desc }: { title: string, desc: string }) {
  return (
    <li className="flex gap-5 items-start">
      <CheckCircle2 size={24} className="text-primary flex-shrink-0 mt-0.5" fill="currentColor" fillOpacity={0.2} />
      <div className="space-y-0.5">
        <h5 className="text-sm font-medium text-white">{title}</h5>
        <p className="text-[11px] text-zinc-500 leading-normal">{desc}</p>
      </div>
    </li>
  );
}
