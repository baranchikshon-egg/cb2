import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Transaction } from '@/lib/types';
import { formatPrice, timeAgo } from '@/lib/utils';
import { Wallet, AlertTriangle, Clock, CheckCircle, XCircle, Lock } from 'lucide-react';

interface DepositPageProps {
  onNavigate: (page: string) => void;
}

const QUICK_AMOUNTS = [5, 10, 25, 50, 100];

export default function DepositPage({ onNavigate }: DepositPageProps) {
  const { profile, session, refreshProfile } = useAuth();
  const [amount, setAmount] = useState<number>(10);
  const [method, setMethod] = useState<'card' | 'steam' | 'crypto'>('card');
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Transaction[]>([]);

  useEffect(() => {
    if (!session) return;
    supabase
      .from('transactions')
      .select('*')
      .eq('user_id', session.user.id)
      .in('type', ['deposit', 'withdraw'])
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }) => {
        if (data) setHistory(data as Transaction[]);
      });
  }, [session]);

  async function handleDeposit() {
    if (!profile || !session) return;
    setError(null);

    if (amount < 1) {
      setError('Минимальная сумма пополнения — $1');
      return;
    }

    setProcessing(true);

    // Simulate deposit processing
    await new Promise((r) => setTimeout(r, 1500));

    const newBalance = profile.balance + amount;
    const { error: balanceError } = await supabase
      .from('profiles')
      .update({ balance: newBalance, total_deposited: profile.total_deposited + amount })
      .eq('id', profile.id);

    if (balanceError) {
      setError('Ошибка при зачислении средств');
      setProcessing(false);
      return;
    }

    await supabase.from('transactions').insert({
      user_id: profile.id,
      type: 'deposit',
      amount,
      status: 'completed',
      method,
      description: `Пополнение через ${method === 'card' ? 'карту' : method === 'steam' ? 'Steam' : 'криптовалюту'}`,
    });

    // Update local history
    setHistory((prev) => [{
      id: 'temp-' + Date.now(),
      user_id: profile.id,
      type: 'deposit',
      amount,
      status: 'completed',
      method,
      description: `Пополнение через ${method === 'card' ? 'карту' : method === 'steam' ? 'Steam' : 'криптовалюту'}`,
      created_at: new Date().toISOString(),
    }, ...prev]);

    setProcessing(false);
    setSuccess(true);
    await refreshProfile();

    setTimeout(() => setSuccess(false), 3000);
  }

  async function handleWithdraw() {
    if (!profile || !session) return;

    // "Very complicated" withdrawal: require min $50, 10 cases opened, and 80% fee
    if (profile.balance < 50) {
      setError('Минимальная сумма вывода — $50. Таковы правила площадки.');
      return;
    }
    if (profile.cases_opened < 10) {
      setError(`Для вывода нужно открыть минимум 10 кейсов. У вас: ${profile.cases_opened}.`);
      return;
    }

    const withdrawAmount = Math.min(amount || profile.balance, profile.balance);
    const fee = withdrawAmount * 0.8; // 80% "commission"
    const actual = withdrawAmount - fee;

    if (actual < 5) {
      setError(`После комиссии 80% вы получите $${actual.toFixed(2)}. Минимальная выплата — $5.`);
      return;
    }

    setError(null);
    setProcessing(true);
    await new Promise((r) => setTimeout(r, 1500));

    const newBalance = profile.balance - withdrawAmount;
    await supabase
      .from('profiles')
      .update({ balance: newBalance, total_withdrawn: profile.total_withdrawn + actual })
      .eq('id', profile.id);

    await supabase.from('transactions').insert({
      user_id: profile.id,
      type: 'withdraw',
      amount: -actual,
      status: 'pending',
      method,
      description: `Вывод (комиссия 80%: -$${fee.toFixed(2)})`,
    });

    setHistory((prev) => [{
      id: 'temp-' + Date.now(),
      user_id: profile.id,
      type: 'withdraw',
      amount: -actual,
      status: 'pending',
      method,
      description: `Вывод (комиссия 80%: -$${fee.toFixed(2)})`,
      created_at: new Date().toISOString(),
    }, ...prev]);

    setProcessing(false);
    await refreshProfile();
  }

  if (!session) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <Wallet size={48} className="text-gray-700 mx-auto mb-4" />
        <h1 className="font-display text-2xl uppercase tracking-wider text-white mb-2">Пополнение баланса</h1>
        <p className="text-gray-500 font-body mb-6">Войдите, чтобы пополнить баланс</p>
        <button onClick={() => onNavigate('home')} className="text-css-orange hover:underline font-body">← На главную</button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="font-display text-4xl uppercase tracking-wider text-white mb-2">Пополнение баланса</h1>
        <p className="text-gray-500 font-body">Текущий баланс: <span className="text-css-tan font-mono-cs font-bold">{formatPrice(profile?.balance || 0)}</span></p>
      </div>

      {error && (
        <div className="bg-css-red/20 border border-css-red text-css-red px-4 py-3 text-center font-body text-sm mb-6 animate-shake flex items-center justify-center gap-2">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {success && (
        <div className="bg-css-green/20 border border-css-green text-css-green px-4 py-3 text-center font-body text-sm mb-6 animate-slide-up flex items-center justify-center gap-2">
          <CheckCircle size={16} /> Пополнение успешно! Средства зачислены.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Deposit card */}
        <div className="bg-css-panel border border-css-border p-6">
          <h2 className="font-display text-lg uppercase tracking-wider text-white mb-4">Пополнить</h2>

          {/* Quick amounts */}
          <div className="grid grid-cols-5 gap-2 mb-4">
            {QUICK_AMOUNTS.map((amt) => (
              <button
                key={amt}
                onClick={() => setAmount(amt)}
                className={`py-2.5 font-mono-cs font-bold text-sm border transition-colors ${
                  amount === amt
                    ? 'bg-css-orange text-black border-css-orange'
                    : 'bg-css-dark text-gray-400 border-css-border hover:border-css-orange'
                }`}
              >
                ${amt}
              </button>
            ))}
          </div>

          {/* Custom amount */}
          <div className="mb-4">
            <label className="text-xs text-gray-400 font-body uppercase tracking-wide mb-1 block">Своя сумма</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 font-mono-cs">$</span>
              <input
                type="number"
                min="1"
                step="1"
                value={amount}
                onChange={(e) => setAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full bg-css-dark border border-css-border pl-8 pr-3 py-2.5 text-white font-mono-cs text-lg focus:border-css-orange focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Method selection */}
          <div className="mb-4">
            <label className="text-xs text-gray-400 font-body uppercase tracking-wide mb-2 block">Способ оплаты</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'card' as const, label: 'Карта' },
                { id: 'steam' as const, label: 'Steam' },
                { id: 'crypto' as const, label: 'Crypto' },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMethod(m.id)}
                  className={`py-2.5 font-display text-xs uppercase tracking-wider border transition-colors ${
                    method === m.id
                      ? 'bg-css-orange/10 text-css-orange border-css-orange'
                      : 'bg-css-dark text-gray-400 border-css-border hover:border-css-orange'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleDeposit}
            disabled={processing || amount < 1}
            className="w-full bg-css-orange hover:bg-css-orange-light disabled:opacity-50 text-black font-display font-bold uppercase tracking-wider py-3 transition-colors"
          >
            {processing ? 'Обработка...' : `Пополнить на ${formatPrice(amount)}`}
          </button>
        </div>

        {/* Withdraw card */}
        <div className="bg-css-panel border border-css-border p-6 relative">
          <div className="absolute top-3 right-3">
            <div className="flex items-center gap-1 px-2 py-1 bg-css-red/10 border border-css-red/30">
              <Lock size={10} className="text-css-red" />
              <span className="text-[8px] font-body uppercase tracking-widest text-css-red">Ограничено</span>
            </div>
          </div>

          <h2 className="font-display text-lg uppercase tracking-wider text-white mb-4">Вывод средств</h2>

          <div className="space-y-3 mb-4">
            <div className="bg-css-dark border border-css-border p-3">
              <div className="flex items-center justify-between text-xs font-body">
                <span className="text-gray-500">Минимальная сумма</span>
                <span className="text-gray-300 font-mono-cs">$50.00</span>
              </div>
            </div>
            <div className="bg-css-dark border border-css-border p-3">
              <div className="flex items-center justify-between text-xs font-body">
                <span className="text-gray-500">Открыто кейсов нужно</span>
                <span className="text-gray-300 font-mono-cs">10 (у вас: {profile?.cases_opened || 0})</span>
              </div>
            </div>
            <div className="bg-css-dark border border-css-border p-3">
              <div className="flex items-center justify-between text-xs font-body">
                <span className="text-gray-500">Комиссия площадки</span>
                <span className="text-css-red font-mono-cs font-bold">80%</span>
              </div>
            </div>
          </div>

          <div className="mb-4">
            <label className="text-xs text-gray-400 font-body uppercase tracking-wide mb-1 block">Сумма вывода</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 font-mono-cs">$</span>
              <input
                type="number"
                min="50"
                step="1"
                placeholder="50"
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                className="w-full bg-css-dark border border-css-border pl-8 pr-3 py-2.5 text-white font-mono-cs text-lg focus:border-css-orange focus:outline-none transition-colors"
              />
            </div>
            {amount > 0 && (
              <p className="text-[10px] text-gray-600 font-body mt-1">
                После комиссии вы получите: <span className="text-css-tan font-mono-cs">${(amount * 0.2).toFixed(2)}</span>
              </p>
            )}
          </div>

          <button
            onClick={handleWithdraw}
            disabled={processing}
            className="w-full bg-css-dark border border-css-border hover:border-css-red text-gray-400 hover:text-css-red font-display font-bold uppercase tracking-wider py-3 transition-colors disabled:opacity-50"
          >
            {processing ? 'Обработка...' : 'Запросить вывод'}
          </button>

          <p className="text-[10px] text-gray-600 font-body mt-3 text-center">
            Вывод обрабатывается вручную и может занять до 30 дней
          </p>
        </div>
      </div>

      {/* History */}
      <div className="mt-8">
        <h2 className="font-display text-lg uppercase tracking-wider text-white mb-3">История операций</h2>
        <div className="bg-css-panel border border-css-border">
          {history.length === 0 ? (
            <p className="text-gray-600 font-body text-center py-8">Нет операций</p>
          ) : (
            <div className="divide-y divide-css-border">
              {history.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    {tx.type === 'deposit' ? (
                      <CheckCircle size={16} className="text-css-green" />
                    ) : (
                      <XCircle size={16} className="text-css-red" />
                    )}
                    <div>
                      <p className="font-body text-sm text-white">{tx.description}</p>
                      <p className="text-[10px] text-gray-500 font-body flex items-center gap-1">
                        <Clock size={10} /> {timeAgo(tx.created_at)} · {tx.method}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`font-mono-cs font-bold text-sm ${tx.amount >= 0 ? 'text-css-green' : 'text-css-red'}`}>
                      {tx.amount >= 0 ? '+' : ''}{formatPrice(tx.amount)}
                    </span>
                    <p className="text-[9px] text-gray-600 uppercase">{tx.status}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
