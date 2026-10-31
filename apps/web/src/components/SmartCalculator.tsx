import React, { useState } from 'react';
import {
  Calculator as CalcIcon,
  X,
  RotateCcw,
  Percent,
  Divide,
  Minus,
  Plus,
  Equal,
  Sparkles,
  Coins,
  Receipt,
  Users
} from 'lucide-react';
import { formatZMW } from '@lspot/shared';

interface SmartCalculatorProps {
  isOpen: boolean;
  onClose: () => void;
  defaultAmount?: number;
  onApplyAmount?: (amt: number) => void;
}

export function SmartCalculator({
  isOpen,
  onClose,
  defaultAmount,
  onApplyAmount
}: SmartCalculatorProps) {
  const [display, setDisplay] = useState(defaultAmount ? String(defaultAmount) : '0');
  const [prevValue, setPrevValue] = useState<number | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);
  const [history, setHistory] = useState<string[]>([]);

  // Intelligent restaurant quick features
  const [tenderAmount, setTenderAmount] = useState<number>(0);
  const [splitCount, setSplitCount] = useState<number>(1);

  if (!isOpen) return null;

  const currentNumber = parseFloat(display) || 0;

  const handleDigit = (digit: string) => {
    if (waitingForOperand) {
      setDisplay(digit);
      setWaitingForOperand(false);
    } else {
      setDisplay(display === '0' ? digit : display + digit);
    }
  };

  const handleDecimal = () => {
    if (waitingForOperand) {
      setDisplay('0.');
      setWaitingForOperand(false);
    } else if (!display.includes('.')) {
      setDisplay(display + '.');
    }
  };

  const handleClear = () => {
    setDisplay('0');
    setPrevValue(null);
    setOperator(null);
    setWaitingForOperand(false);
  };

  const handleOperator = (nextOp: string) => {
    const inputValue = parseFloat(display);

    if (prevValue === null) {
      setPrevValue(inputValue);
    } else if (operator) {
      const current = prevValue || 0;
      let result = current;
      if (operator === '+') result = current + inputValue;
      else if (operator === '-') result = current - inputValue;
      else if (operator === '×') result = current * inputValue;
      else if (operator === '÷') result = inputValue !== 0 ? current / inputValue : 0;

      setPrevValue(result);
      setDisplay(String(Number(result.toFixed(2))));
      setHistory((prev) => [`${current} ${operator} ${inputValue} = ${Number(result.toFixed(2))}`, ...prev.slice(0, 4)]);
    }

    setWaitingForOperand(true);
    setOperator(nextOp);
  };

  const handleEquals = () => {
    const inputValue = parseFloat(display);
    if (operator && prevValue !== null) {
      let result = prevValue;
      if (operator === '+') result = prevValue + inputValue;
      else if (operator === '-') result = prevValue - inputValue;
      else if (operator === '×') result = prevValue * inputValue;
      else if (operator === '÷') result = inputValue !== 0 ? prevValue / inputValue : 0;

      setHistory((prev) => [`${prevValue} ${operator} ${inputValue} = ${Number(result.toFixed(2))}`, ...prev.slice(0, 4)]);
      setDisplay(String(Number(result.toFixed(2))));
      setPrevValue(null);
      setOperator(null);
      setWaitingForOperand(true);
    }
  };

  // Zambian Fast Note Buttons (K 20, K 50, K 100, K 200)
  const addQuickCash = (amount: number) => {
    setTenderAmount((prev) => prev + amount);
  };

  const changeDue = Math.max(0, tenderAmount - currentNumber);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl p-5 space-y-4 text-slate-100 flex flex-col animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shadow-inner">
              <CalcIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                Intelligent Restaurant Calculator
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              </h3>
              <p className="text-[11px] text-slate-400">Cash change, VAT 16%, portion ratios & split-bills</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Display Screen */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 shadow-inner">
          <div className="text-right text-xs text-slate-500 font-mono h-4 truncate">
            {prevValue !== null && `${prevValue} ${operator || ''}`}
          </div>
          <div className="text-right text-3xl font-black font-mono tracking-tight text-amber-400 truncate mt-1">
            {display}
          </div>
          <div className="text-right text-xs text-slate-400 font-mono mt-1">
            ZMW {formatZMW(currentNumber)}
          </div>
        </div>

        {/* Quick Restaurant Tools Strip */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          {/* 16% VAT Calculation */}
          <button
            onClick={() => {
              const vat = currentNumber * 0.16;
              setDisplay(String(Number(vat.toFixed(2))));
            }}
            className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold flex items-center justify-center gap-1 border border-slate-700"
            title="Calculate 16% Zambian VAT"
          >
            <Percent className="w-3.5 h-3.5 text-amber-400" />
            <span>16% VAT</span>
          </button>

          {/* 10% Service Tip */}
          <button
            onClick={() => {
              const tip = currentNumber * 0.10;
              setDisplay(String(Number(tip.toFixed(2))));
            }}
            className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold flex items-center justify-center gap-1 border border-slate-700"
            title="Calculate 10% Tip"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>10% Tip</span>
          </button>

          {/* Split Bill */}
          <div className="flex items-center justify-between bg-slate-800 px-2 py-1 rounded-xl border border-slate-700 text-xs">
            <Users className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-[10px] text-slate-400">Split:</span>
            <select
              value={splitCount}
              onChange={(e) => {
                const count = Number(e.target.value);
                setSplitCount(count);
                if (count > 0 && currentNumber > 0) {
                  setDisplay(String(Number((currentNumber / count).toFixed(2))));
                }
              }}
              className="bg-slate-900 text-amber-400 font-bold rounded px-1 py-0.5 text-xs focus:outline-none"
            >
              {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
                <option key={n} value={n}>
                  {n}p
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Zambian Cash Drawer Quick Tender Calculator */}
        <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 flex items-center gap-1">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              Cash Tendered:
            </span>
            <div className="flex items-center gap-1.5">
              <span className="font-mono font-bold text-white">{formatZMW(tenderAmount)}</span>
              {tenderAmount > 0 && (
                <button
                  onClick={() => setTenderAmount(0)}
                  className="text-[10px] text-slate-500 hover:text-slate-300 underline"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {[20, 50, 100, 200].map((note) => (
              <button
                key={note}
                onClick={() => addQuickCash(note)}
                className="py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-lg text-xs font-bold font-mono transition"
              >
                +K {note}
              </button>
            ))}
          </div>

          {tenderAmount > 0 && (
            <div className="flex justify-between items-center pt-1 border-t border-slate-800/80 text-xs">
              <span className="text-slate-400">Change to Return:</span>
              <span className={`font-mono font-extrabold text-sm ${changeDue >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {changeDue >= 0 ? formatZMW(changeDue) : `Short by ${formatZMW(Math.abs(changeDue))}`}
              </span>
            </div>
          )}
        </div>

        {/* Standard Keypad Grid */}
        <div className="grid grid-cols-4 gap-2 text-base font-bold">
          <button
            onClick={handleClear}
            className="py-3 bg-rose-950/50 hover:bg-rose-900/60 text-rose-400 border border-rose-900/50 rounded-xl transition flex items-center justify-center text-sm"
          >
            AC
          </button>
          <button
            onClick={() => {
              const val = -1 * parseFloat(display);
              setDisplay(String(val));
            }}
            className="py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition flex items-center justify-center text-sm"
          >
            ±
          </button>
          <button
            onClick={() => handleOperator('÷')}
            className={`py-3 rounded-xl transition flex items-center justify-center ${
              operator === '÷'
                ? 'bg-amber-500 text-slate-950 font-black'
                : 'bg-slate-800 hover:bg-slate-700 text-amber-400'
            }`}
          >
            <Divide className="w-5 h-5" />
          </button>
          <button
            onClick={() => handleOperator('×')}
            className={`py-3 rounded-xl transition flex items-center justify-center ${
              operator === '×'
                ? 'bg-amber-500 text-slate-950 font-black'
                : 'bg-slate-800 hover:bg-slate-700 text-amber-400'
            }`}
          >
            ×
          </button>

          {/* 7, 8, 9, - */}
          <button
            onClick={() => handleDigit('7')}
            className="py-3 bg-slate-800/80 hover:bg-slate-700 text-white rounded-xl transition"
          >
            7
          </button>
          <button
            onClick={() => handleDigit('8')}
            className="py-3 bg-slate-800/80 hover:bg-slate-700 text-white rounded-xl transition"
          >
            8
          </button>
          <button
            onClick={() => handleDigit('9')}
            className="py-3 bg-slate-800/80 hover:bg-slate-700 text-white rounded-xl transition"
          >
            9
          </button>
          <button
            onClick={() => handleOperator('-')}
            className={`py-3 rounded-xl transition flex items-center justify-center ${
              operator === '-'
                ? 'bg-amber-500 text-slate-950 font-black'
                : 'bg-slate-800 hover:bg-slate-700 text-amber-400'
            }`}
          >
            <Minus className="w-5 h-5" />
          </button>

          {/* 4, 5, 6, + */}
          <button
            onClick={() => handleDigit('4')}
            className="py-3 bg-slate-800/80 hover:bg-slate-700 text-white rounded-xl transition"
          >
            4
          </button>
          <button
            onClick={() => handleDigit('5')}
            className="py-3 bg-slate-800/80 hover:bg-slate-700 text-white rounded-xl transition"
          >
            5
          </button>
          <button
            onClick={() => handleDigit('6')}
            className="py-3 bg-slate-800/80 hover:bg-slate-700 text-white rounded-xl transition"
          >
            6
          </button>
          <button
            onClick={() => handleOperator('+')}
            className={`py-3 rounded-xl transition flex items-center justify-center ${
              operator === '+'
                ? 'bg-amber-500 text-slate-950 font-black'
                : 'bg-slate-800 hover:bg-slate-700 text-amber-400'
            }`}
          >
            <Plus className="w-5 h-5" />
          </button>

          {/* 1, 2, 3 */}
          <button
            onClick={() => handleDigit('1')}
            className="py-3 bg-slate-800/80 hover:bg-slate-700 text-white rounded-xl transition"
          >
            1
          </button>
          <button
            onClick={() => handleDigit('2')}
            className="py-3 bg-slate-800/80 hover:bg-slate-700 text-white rounded-xl transition"
          >
            2
          </button>
          <button
            onClick={() => handleDigit('3')}
            className="py-3 bg-slate-800/80 hover:bg-slate-700 text-white rounded-xl transition"
          >
            3
          </button>
          <button
            onClick={handleEquals}
            className="py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-xl transition shadow-lg shadow-amber-500/20 flex items-center justify-center text-xl"
          >
            <Equal className="w-6 h-6" />
          </button>

          {/* 0, . */}
          <button
            onClick={() => handleDigit('0')}
            className="col-span-2 py-3 bg-slate-800/80 hover:bg-slate-700 text-white rounded-xl transition"
          >
            0
          </button>
          <button
            onClick={handleDecimal}
            className="py-3 bg-slate-800/80 hover:bg-slate-700 text-white rounded-xl transition"
          >
            .
          </button>
        </div>

        {/* Action Footer */}
        {onApplyAmount && (
          <div className="pt-2">
            <button
              onClick={() => {
                onApplyAmount(currentNumber);
                onClose();
              }}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5"
            >
              <span>Apply {formatZMW(currentNumber)} to Order</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
