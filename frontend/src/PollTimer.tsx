import { useState, useEffect, useRef } from 'react';
import { Clock } from 'lucide-react';

interface PollTimerProps {
  expiresAt: string;
  onExpire: () => void;
}

export default function PollTimer({ expiresAt, onExpire }: PollTimerProps) {
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isCritical, setIsCritical] = useState(false);
  const [isEnded, setIsEnded] = useState(false);

  // Zabezpieczenie przed pętlą spamowania backendu
  const hasExpiredRef = useRef(false);

  // Synchronizacja mrugania "indicatora"
  const [syncDelay] = useState(() => {
    const animationDuration = 2000;
    const now = Date.now();
    return `-${now % animationDuration}ms`;
  });

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date().getTime();
      const end = new Date(expiresAt).getTime();
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft("Zakończono");
        setIsEnded(true);
        setIsCritical(false);

        if (!hasExpiredRef.current) {
            hasExpiredRef.current = true;
            onExpire(); 
        }
        return;
      }

      hasExpiredRef.current = false;
      setIsEnded(false);

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / 1000 / 60) % 60);
      const seconds = Math.floor((diff / 1000) % 60);

      if (days > 0) {
        setTimeLeft(`${days} dni ${hours} godz.`);
        setIsCritical(false);
      } else if (hours > 0) {
        setTimeLeft(`${hours} godz. ${minutes} min.`);
        setIsCritical(false);
      } else if (minutes > 0) {
        setTimeLeft(`${minutes} min. ${seconds} sek.`);
        setIsCritical(false);
      } else {
        setTimeLeft(`${seconds} sek.`);
        setIsCritical(true);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, onExpire]);


  if (isEnded) {
    return (
      <span className="bg-gray-200 text-gray-600 px-2 py-1 rounded flex items-center gap-1 font-medium text-xs">
        <Clock size={14}/> ZAKOŃCZONA
      </span>
    );
  }

  return (
    <span 
      className={`px-2 py-1 rounded flex items-center gap-1 text-xs font-medium transition-colors
        ${isCritical 
          ? 'text-red-600 bg-red-100 animate-sync-pulse' 
          : 'text-green-700 bg-green-100'
        }`
      }
      style={isCritical ? { animationDelay: syncDelay } : {}}
    >
      <Clock size={14}/> AKTYWNA ({timeLeft})
    </span>
  );
}