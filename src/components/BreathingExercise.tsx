import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Play, Pause, RotateCcw } from 'lucide-react';

interface BreathingExerciseProps {
  onClose: () => void;
  type?: 'box' | '478' | 'equal';
}

const EXERCISES = {
  box: {
    name: "Box Breathing",
    description: "Inhale, hold, exhale, hold. 4 seconds each.",
    steps: [
      { action: 'Inhale', duration: 4 },
      { action: 'Hold', duration: 4 },
      { action: 'Exhale', duration: 4 },
      { action: 'Hold', duration: 4 },
    ]
  },
  '478': {
    name: "4-7-8 Technique",
    description: "Inhale for 4, hold for 7, exhale for 8.",
    steps: [
      { action: 'Inhale', duration: 4 },
      { action: 'Hold', duration: 7 },
      { action: 'Exhale', duration: 8 },
    ]
  },
  equal: {
    name: "Equal Breathing",
    description: "Inhale and exhale for equal counts.",
    steps: [
      { action: 'Inhale', duration: 4 },
      { action: 'Exhale', duration: 4 },
    ]
  }
};

export default function BreathingExercise({ onClose, type = 'box' }: BreathingExerciseProps) {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [timeLeft, setTimeLeft] = useState(EXERCISES[type].steps[0].duration);

  useEffect(() => {
    let timer: number;
    if (isActive) {
      timer = window.setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            const nextStep = (currentStep + 1) % EXERCISES[type].steps.length;
            setCurrentStep(nextStep);
            return EXERCISES[type].steps[nextStep].duration;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isActive, currentStep, type]);

  const toggleActive = () => setIsActive(!isActive);
  const reset = () => {
    setIsActive(false);
    setCurrentStep(0);
    setTimeLeft(EXERCISES[type].steps[0].duration);
  };

  const step = EXERCISES[type].steps[currentStep];

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-50/90 backdrop-blur-sm p-6"
    >
      <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl border border-stone-200 text-center relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-stone-100 rounded-full transition-colors"
        >
          <X className="w-5 h-5 text-stone-500" />
        </button>

        <h2 className="text-2xl font-serif text-stone-800 mb-2">{EXERCISES[type].name}</h2>
        <p className="text-stone-500 text-sm mb-8">{EXERCISES[type].description}</p>

        <div className="relative h-64 flex items-center justify-center mb-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={step.action}
              initial={{ scale: step.action === 'Inhale' ? 0.8 : 1.2, opacity: 0 }}
              animate={{ 
                scale: step.action === 'Inhale' ? 1.2 : step.action === 'Exhale' ? 0.8 : 1.1,
                opacity: 0.8 
              }}
              transition={{ duration: step.duration, ease: "easeInOut" }}
              className="absolute w-48 h-48 rounded-full bg-teal-100 border-2 border-teal-200"
            />
          </AnimatePresence>
          
          <div className="relative z-10 flex flex-col items-center">
            <motion.div 
              key={step.action + timeLeft}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl font-serif text-stone-800 mb-1"
            >
              {step.action}
            </motion.div>
            <div className="text-stone-400 font-mono text-lg">{timeLeft}s</div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-4">
          <button
            onClick={toggleActive}
            className="flex items-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-full hover:bg-teal-700 transition-colors shadow-lg shadow-teal-600/20"
          >
            {isActive ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            {isActive ? 'Pause' : 'Start'}
          </button>
          <button
            onClick={reset}
            className="p-3 border border-stone-200 text-stone-600 rounded-full hover:bg-stone-100 transition-colors"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
