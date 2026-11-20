import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { formatPrice } from '@/lib/utils';
import { MousePointerClick, Bot, Coins, Zap, Clock } from 'lucide-react';

interface ClickerPageProps {
  onNavigate: (page: string) => void;
}

interface ClickerRow {
  user_id: string;
  click_level: number;
  auto_level: number;
  coins_earned: number;
  unclaimed: number;
}

// Upgrade costs: level N costs base * growth^(N-1)
const CLICK_BASE_COST = 25;
const CLICK_GROWTH = 1.6;
const AUTO_BASE_COST = 100;
const AUTO_GROWTH = 1.75;

function clickUpgradeCost(level: number): number {
  return Math.round(CLICK_BASE_COST * Math.pow(CLICK_GROWTH, level - 1) * 100) / 100;
}
function autoUpgradeCost(level: number): number {
  return Math.round(AUTO_BASE_COST * Math.pow(AUTO_GROWTH, level) * 100) / 100;
}
export function coinsPerClick(level: number): number {
  return level; // 1 coin per click at level 1, +1 per level
}
export function coinsPerMinute(level: number): number {
  return level; // auto_level coins per minute
}

interface FloatCoin {
  id: number;
  x: number;
  y: number;
  amount: number;
}

export default function ClickerPage({ onNavigate }: ClickerPageProps) {
  const { session, profile, refreshProfile } = useAuth();
  const [state, setState] = useState<ClickerRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [floatCoins, setFloatCoins] = useState<FloatCoin[]>([]);
  const [pulse, setPulse] = useState(false);
  const [collectMsg, setCollectMsg] = useState<string | null>(null);
  const floatIdRef = useRef(0);

  const loadState = useCallback(async () => {
    if (!session) return;
    // Accrue passive income server-side first, then read fresh state
    await supabase.rpc('clicker_accrue', { p_user_id: session.user.id });
    const { data } = await supabase
      .from('clicker_state')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (data) {
      setState(data as ClickerRow);
    }
    setLoading(false);
  }, [session]);

  useEffect(() => {
    loadState();
  }, [loadState]);

  // Optimistic passive income ticker for display between server accruals
  useEffect(() => {
    if (!state || state.auto_level === 0) return;
    const timer = setInterval(() => {
      setState((prev) =>
        prev
          ? { ...prev, unclaimed: Math.min(999999, prev.unclaimed + prev.auto_level / 60) }
          : prev,
      );
    }, 1000);
    return () => clearInterval(timer);
  }, [state?.auto_level, state === null]);

  async function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    if (!session || !state) return;

    const amount = coinsPerClick(state.click_level);

    // Optimistic UI
    setState({ ...state, coins_earned: state.coins_earned + amount });
    setPulse(true);
    setTimeout(() => setPulse(false), 90);

    const rect = e.currentTarget.getBoundingClientRect();
    const id = ++floatIdRef.current;
    setFloatCoins((prev) => [
      ...prev.slice(-10),
      { id, x: e.clientX - rect.left, y: e.clientY - rect.top, amount },
    ]);
    setTimeout(() => setFloatCoins((prev) => prev.filter((c) => c.id !== id)), 800);

    // Update DB: click coins go straight to coins_earned (they become collectable value)
    await supabase.rpc('clicker_collect_click' as never, { p_user_id: session.user.id }).catch(() => {});
    await supabase
      .from('clicker_state')
      .update({ coins_earned: state.coins_earned + amount })
      .eq('user_id', session.user.id);
  }

  async function buyClickUpgrade() {
    if (!session || !state) return;
    const cost = clickUpgradeCost(state.click_level);
    if (profile && profile.balance < cost) {
      setCollectMsg('Недостаточно средств на балансе');
      setTimeout(() => setCollectMsg(null), 2500);
      return;
    }

    const newBalance = (profile?.balance || 0) - cost;
    await supabase.from('profiles').update({ balance: newBalance }).eq('id', session.user.id);
    await supabase
      .from('clicker_state')
      .update({ click_level: state.click_level + 1 })
      .eq('user_id', session.user.id);

    await refreshProfile();
    await loadState();
  }

  async function buyAutoUpgrade() {
    if (!session || !state) return;
    const cost = autoUpgradeCost(state.auto_level);
    if (profile && profile.balance < cost) {
      setCollectMsg('Недостаточно средств на балансе');
      setTimeout(() => setCollectMsg(null), 2500);
      return;
    }

    const newBalance = (profile?.balance || 0) - cost;
    await supabase.from('profiles').update({ balance: newBalance }).eq('id', session.user.id);
    await supabase
      .from('clicker_state')
      .update({ auto_level: state.auto_level + 1 })
      .eq('user_id', session.user.id);

    await refreshProfile();
    await loadState();
  }

  async function collect() {
    if (!session || !state) return;
    const { data, error } = await supabase.rpc('clicker_collect', { p_user_id: session.user.id });
    if (!error && data !== null) {
      const collected = Number(data);
      setCollectMsg(collected > 0 ? `Собрано ${formatPrice(collected)}` : 'Нечего собирать');
      setTimeout(() => setCollectMsg(null), 2500);
      await refreshProfile();
      await loadState();
    }
  }

  if (!session) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <MousePointerClick size={48} className="text-gray-700 mx-auto mb-4" />
        <h1 className="font-display text-2xl uppercase tracking-wider text-white mb-2">Фармилка</h1>
        <p className="text-gray-500 font-body mb-6">Войдите, чтобы зарабатывать монеты</p>
        <button onClick={() => onNavigate('home')} className="text-css-orange hover:underline font-body">← На главную</button>
      </div>
    );
  }

  if (loading || !state) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <p className="text-gray-600 font-body animate-pulse">Загрузка кликера...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="font-display text-4xl uppercase tracking-wider text-white mb-2">Фармилка</h1>
        <p className="text-gray-500 font-body">Кликай, качай прокачку и зарабатывай монеты для открытия кейсов</p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-css-panel border border-css-border p-4 text-center">
          <Coins size={18} className="text-css-orange mx-auto mb-1" />
          <p className="font-mono-cs font-bold text-white text-lg">{formatPrice(profile?.balance || 0)}</p>
          <p className="text-[10px] text-gray-500 uppercase tracking-widest font-body">Баланс</p>
        </div>
        <div className="bg-css-panel border border-css-border p-4 text-center">
          <MousePointerClick size={18} className="text-css-orange mx-auto mb-1" />
          <p className="font-mono-cs font-bold text-white text-lg">{coinsPerClick(state.click_level)}</p>
          <p className="text-[10px] text-gray-500 uppercase tracking-widest font-body">За клик</p>
        </div>
        <div className="bg-css-panel border border-css-border p-4 text-center">
          <Bot size={18} className="text-css-orange mx-auto mb-1" />
          <p className="font-mono-cs font-bold text-white text-lg">{coinsPerMinute(state.auto_level)}/мин</p>
          <p className="text-[10px] text-gray-500 uppercase tracking-widest font-body">Пассив</p>
        </div>
      </div>

      {/* Clicker area */}
      <div className="flex flex-col items-center mb-8">
        <button
          onClick={handleClick}
          className={`relative w-44 h-44 rounded-full bg-gradient-to-br from-css-orange to-css-orange-dark border-4 border-css-orange-light shadow-[0_0_40px_rgba(232,123,30,0.4)] hover:shadow-[0_0_60px_rgba(232,123,30,0.6)] transition-all select-none ${
            pulse ? 'scale-90' : 'scale-100'
          } active:scale-75`}
        >
          <span className="font-display font-bold text-black text-xl uppercase tracking-wider pointer-events-none">
            Клик!
          </span>
          {floatCoins.map((c) => (
            <span
              key={c.id}
              className="absolute font-mono-cs font-bold text-css-orange text-lg pointer-events-none animate-float-up"
              style={{ left: c.x, top: c.y }}
            >
              +{c.amount}
            </span>
          ))}
        </button>

        <p className="text-gray-600 font-body text-xs mt-3">
          Всего заработано: <span className="text-css-tan font-mono-cs">{formatPrice(state.coins_earned)}</span>
        </p>

        {/* Collect passive income */}
        <button
          onClick={collect}
          disabled={state.unclaimed < 0.01}
          className="mt-4 flex items-center gap-2 bg-css-panel border border-css-border hover:border-css-orange disabled:opacity-40 text-white font-display uppercase tracking-wider px-6 py-2.5 transition-colors text-sm"
        >
          <Clock size={14} />
          Собрать пассив: {formatPrice(state.unclaimed)}
        </button>

        {collectMsg && (
          <p className="text-css-green font-body text-sm mt-2 animate-fade-in">{collectMsg}</p>
        )}
      </div>

      {/* Upgrades */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {/* Click upgrade */}
        <div className="bg-css-panel border border-css-border p-5">
          <div className="flex items-center gap-2 mb-2">
            <Zap size={18} className="text-css-orange" />
            <h3 className="font-display text-sm uppercase tracking-wider text-white">Сила клика</h3>
            <span className="ml-auto font-mono-cs text-css-orange font-bold">ур. {state.click_level}</span>
          </div>
          <p className="text-xs text-gray-500 font-body mb-4">
            +1 монета за каждый клик. Сейчас: {coinsPerClick(state.click_level)} за клик.
          </p>
          <button
            onClick={buyClickUpgrade}
            disabled={!profile || profile.balance < clickUpgradeCost(state.click_level)}
            className="w-full bg-css-orange hover:bg-css-orange-light disabled:opacity-40 text-black font-display font-bold uppercase tracking-wider py-2.5 transition-colors text-sm"
          >
            Улучшить за {formatPrice(clickUpgradeCost(state.click_level))}
          </button>
        </div>

        {/* Auto upgrade */}
        <div className="bg-css-panel border border-css-border p-5">
          <div className="flex items-center gap-2 mb-2">
            <Bot size={18} className="text-css-orange" />
            <h3 className="font-display text-sm uppercase tracking-wider text-white">Авто-доход</h3>
            <span className="ml-auto font-mono-cs text-css-orange font-bold">ур. {state.auto_level}</span>
          </div>
          <p className="text-xs text-gray-500 font-body mb-4">
            +1 монета в минуту, даже когда оффлайн (до 8 часов). Сейчас: {coinsPerMinute(state.auto_level)}/мин.
          </p>
          <button
            onClick={buyAutoUpgrade}
            disabled={!profile || profile.balance < autoUpgradeCost(state.auto_level)}
            className="w-full bg-css-orange hover:bg-css-orange-light disabled:opacity-40 text-black font-display font-bold uppercase tracking-wider py-2.5 transition-colors text-sm"
          >
            {state.auto_level === 0 ? 'Купить за ' : 'Улучшить за '}
            {formatPrice(autoUpgradeCost(state.auto_level))}
          </button>
        </div>
      </div>

      <p className="text-center text-gray-600 font-body text-xs">
        Улучшения покупаются за баланс. Монеты с клика и пассив добавляются к заработку и собираются кнопкой «Собрать пассив».
      </p>
    </div>
  );
}
