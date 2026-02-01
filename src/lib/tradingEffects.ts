// Confetti burst effect
export function triggerConfetti() {
  const colors = ['#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#3b82f6'];
  const confettiCount = 50;
  
  for (let i = 0; i < confettiCount; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti-particle';
    confetti.style.cssText = `
      position: fixed;
      width: ${Math.random() * 10 + 5}px;
      height: ${Math.random() * 10 + 5}px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      left: ${50 + (Math.random() - 0.5) * 40}%;
      top: 50%;
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
      pointer-events: none;
      z-index: 9999;
      animation: confetti-fall ${1.5 + Math.random()}s ease-out forwards;
      --confetti-x: ${(Math.random() - 0.5) * 400}px;
      --confetti-y: ${-Math.random() * 500 - 200}px;
      --confetti-rotate: ${Math.random() * 720 - 360}deg;
    `;
    document.body.appendChild(confetti);
    
    setTimeout(() => confetti.remove(), 2500);
  }
}

// Haptic feedback (for mobile devices)
export function triggerHaptic(type: 'light' | 'medium' | 'heavy' | 'success' | 'error' = 'medium') {
  if ('vibrate' in navigator) {
    const patterns: Record<string, number[]> = {
      light: [10],
      medium: [30],
      heavy: [50, 30, 50],
      success: [20, 50, 20, 50, 20],
      error: [100, 50, 100],
    };
    navigator.vibrate(patterns[type] || patterns.medium);
  }
}

// Sound effects - enhanced with trading-specific sounds
const audioContext = typeof window !== 'undefined' ? new (window.AudioContext || (window as any).webkitAudioContext)() : null;

export type SoundType = 'success' | 'error' | 'click' | 'streak' | 'submit' | 'filling' | 'complete' | 'partial';

export function playSound(type: SoundType) {
  if (!audioContext) return;
  
  // Resume audio context if suspended (required for some browsers)
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  
  switch (type) {
    case 'success':
    case 'complete':
      playSuccessSound();
      break;
    case 'error':
      playErrorSound();
      break;
    case 'click':
      playClickSound();
      break;
    case 'streak':
      playStreakSound();
      break;
    case 'submit':
      playSubmitSound();
      break;
    case 'filling':
      playFillingSound();
      break;
    case 'partial':
      playPartialSound();
      break;
  }
}

function playSuccessSound() {
  if (!audioContext) return;
  
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
  oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
  oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2); // G5
  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.4);
}

function playErrorSound() {
  if (!audioContext) return;
  
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  oscillator.type = 'sawtooth';
  oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
  oscillator.frequency.setValueAtTime(150, audioContext.currentTime + 0.1);
  gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.2);
}

function playClickSound() {
  if (!audioContext) return;
  
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
  gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05);
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.05);
}

function playStreakSound() {
  if (!audioContext) return;
  
  // Ascending arpeggio for streak celebrations
  const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
  notes.forEach((freq, i) => {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, audioContext.currentTime + i * 0.08);
    gain.gain.setValueAtTime(0.2, audioContext.currentTime + i * 0.08);
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + i * 0.08 + 0.15);
    osc.start(audioContext.currentTime + i * 0.08);
    osc.stop(audioContext.currentTime + i * 0.08 + 0.15);
  });
}

function playSubmitSound() {
  if (!audioContext) return;
  
  // Quick ascending "whoosh" for order submission
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(300, audioContext.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + 0.15);
  gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.15);
}

function playFillingSound() {
  if (!audioContext) return;
  
  // Subtle "cha-ching" for order filling
  const osc1 = audioContext.createOscillator();
  const osc2 = audioContext.createOscillator();
  const gain1 = audioContext.createGain();
  const gain2 = audioContext.createGain();
  
  osc1.connect(gain1);
  osc2.connect(gain2);
  gain1.connect(audioContext.destination);
  gain2.connect(audioContext.destination);
  
  osc1.type = 'triangle';
  osc1.frequency.setValueAtTime(1200, audioContext.currentTime);
  gain1.gain.setValueAtTime(0.1, audioContext.currentTime);
  gain1.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.08);
  
  osc2.type = 'triangle';
  osc2.frequency.setValueAtTime(1500, audioContext.currentTime + 0.05);
  gain2.gain.setValueAtTime(0.1, audioContext.currentTime + 0.05);
  gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.13);
  
  osc1.start(audioContext.currentTime);
  osc1.stop(audioContext.currentTime + 0.08);
  osc2.start(audioContext.currentTime + 0.05);
  osc2.stop(audioContext.currentTime + 0.13);
}

function playPartialSound() {
  if (!audioContext) return;
  
  // Mixed tone for partial fills - success with a hint of "not quite"
  const osc1 = audioContext.createOscillator();
  const osc2 = audioContext.createOscillator();
  const gain1 = audioContext.createGain();
  const gain2 = audioContext.createGain();
  
  osc1.connect(gain1);
  osc2.connect(gain2);
  gain1.connect(audioContext.destination);
  gain2.connect(audioContext.destination);
  
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(523.25, audioContext.currentTime);
  gain1.gain.setValueAtTime(0.2, audioContext.currentTime);
  gain1.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
  
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(493.88, audioContext.currentTime + 0.1); // B4 - slightly dissonant
  gain2.gain.setValueAtTime(0.15, audioContext.currentTime + 0.1);
  gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.25);
  
  osc1.start(audioContext.currentTime);
  osc1.stop(audioContext.currentTime + 0.2);
  osc2.start(audioContext.currentTime + 0.1);
  osc2.stop(audioContext.currentTime + 0.25);
}

// Streak celebration
export function celebrateStreak(streak: number) {
  if (streak < 2) return;
  
  // Show streak toast element
  const toast = document.createElement('div');
  toast.className = 'streak-celebration';
  toast.innerHTML = `
    <span class="streak-fire">🔥</span>
    <span class="streak-count">${streak} in a row!</span>
  `;
  toast.style.cssText = `
    position: fixed;
    top: 20%;
    left: 50%;
    transform: translateX(-50%) scale(0);
    background: linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)));
    color: white;
    padding: 12px 24px;
    border-radius: 9999px;
    font-weight: bold;
    font-size: 1.25rem;
    display: flex;
    align-items: center;
    gap: 8px;
    z-index: 9999;
    animation: streak-pop 0.5s ease-out forwards, streak-fade 0.5s ease-in 1.5s forwards;
    box-shadow: 0 10px 40px -10px hsl(var(--primary) / 0.5);
  `;
  
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
  
  // Extra confetti for milestones
  if (streak % 5 === 0) {
    triggerConfetti();
    triggerConfetti();
  }
}

// Screen flash effect for trade feedback
export function flashScreen(type: 'success' | 'error' | 'warning') {
  const flash = document.createElement('div');
  const colors = {
    success: 'rgba(16, 185, 129, 0.15)',
    error: 'rgba(239, 68, 68, 0.15)',
    warning: 'rgba(245, 158, 11, 0.15)',
  };
  
  flash.style.cssText = `
    position: fixed;
    inset: 0;
    background: ${colors[type]};
    pointer-events: none;
    z-index: 9998;
    animation: flash-fade 0.5s ease-out forwards;
  `;
  
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 500);
}
