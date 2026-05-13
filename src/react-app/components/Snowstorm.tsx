import { useEffect, useState } from "react";

interface Snowflake {
  id: number;
  left: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
}

interface WindStreak {
  id: number;
  top: number;
  width: number;
  delay: number;
  duration: number;
}

export default function Snowstorm({ intensity = "heavy" }: { intensity?: "light" | "medium" | "heavy" }) {
  const [snowflakes, setSnowflakes] = useState<Snowflake[]>([]);
  const [windStreaks, setWindStreaks] = useState<WindStreak[]>([]);

  useEffect(() => {
    const count = intensity === "heavy" ? 80 : intensity === "medium" ? 50 : 25;
    const streakCount = intensity === "heavy" ? 8 : intensity === "medium" ? 5 : 3;

    // Generate snowflakes
    const flakes: Snowflake[] = [];
    for (let i = 0; i < count; i++) {
      flakes.push({
        id: i,
        left: Math.random() * 100,
        size: Math.random() * 0.8 + 0.4,
        duration: Math.random() * 8 + 6,
        delay: Math.random() * 10,
        opacity: Math.random() * 0.5 + 0.5,
      });
    }
    setSnowflakes(flakes);

    // Generate wind streaks
    const streaks: WindStreak[] = [];
    for (let i = 0; i < streakCount; i++) {
      streaks.push({
        id: i,
        top: Math.random() * 100,
        width: Math.random() * 300 + 200,
        delay: Math.random() * 5,
        duration: Math.random() * 2 + 2,
      });
    }
    setWindStreaks(streaks);
  }, [intensity]);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-40">
      {/* Snowflakes */}
      {snowflakes.map((flake) => (
        <div
          key={flake.id}
          className="snowflake"
          style={{
            left: `${flake.left}%`,
            fontSize: `${flake.size}em`,
            animationDuration: `${flake.duration}s`,
            animationDelay: `${flake.delay}s`,
            opacity: flake.opacity,
          }}
        >
          ❄
        </div>
      ))}

      {/* Wind streaks */}
      {windStreaks.map((streak) => (
        <div
          key={streak.id}
          className="wind-streak"
          style={{
            top: `${streak.top}%`,
            width: `${streak.width}px`,
            animationDuration: `${streak.duration}s`,
            animationDelay: `${streak.delay}s`,
          }}
        />
      ))}

      {/* Fog/mist overlay at bottom */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
        style={{
          background: "linear-gradient(to top, rgba(255,255,255,0.15), transparent)",
        }}
      />
    </div>
  );
}
