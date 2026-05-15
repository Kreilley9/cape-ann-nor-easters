import { useState, useEffect } from "react";

interface BlizzardSnowflake {
  id: number;
  left: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
}

export default function BlizzardIntro({ onComplete }: { onComplete: () => void }) {
  const [snowflakes, setSnowflakes] = useState<BlizzardSnowflake[]>([]);
  const [phase, setPhase] = useState<"storm" | "flash" | "calm">("storm");
  const [logoOpacity, setLogoOpacity] = useState(0);
  const [shake, setShake] = useState(true);

  useEffect(() => {
    // Play wind sound
    const audio = new Audio("https://qbtfofrikbawvjwpmbob.supabase.co/storage/v1/object/public/assets/dragon-studio-blizzard-wind-463217.mp3");
    audio.volume = 0.6;
    audio.play().catch(() => {});

    // Generate INTENSE blizzard snowflakes - MASSIVE particle count
    const flakes: BlizzardSnowflake[] = [];
    for (let i = 0; i < 500; i++) {
      flakes.push({
        id: i,
        left: Math.random() * 150 - 25,
        size: Math.random() * 1.8 + 0.2,
        duration: Math.random() * 0.7 + 0.3, // Even faster for chaos
        delay: Math.random() * 2,
        opacity: Math.random() * 0.9 + 0.1,
      });
    }
    setSnowflakes(flakes);

    // Phase timing - extended 50%
    const flashTimer = setTimeout(() => {
      setPhase("flash");
      setLogoOpacity(1);
      setShake(false);
    }, 3000);

    const logoFadeTimer = setTimeout(() => {
      setLogoOpacity(0);
    }, 5700);

    const calmTimer = setTimeout(() => {
      setPhase("calm");
    }, 6450);

    const completeTimer = setTimeout(() => {
      audio.pause();
      onComplete();
    }, 8000);

    return () => {
      audio.pause();
      clearTimeout(flashTimer);
      clearTimeout(logoFadeTimer);
      clearTimeout(calmTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <div 
      className={`fixed inset-0 z-[100] transition-opacity duration-1000 ${
        phase === "calm" ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      style={{
        background: "linear-gradient(180deg, #050a0f 0%, #0a1018 50%, #101820 100%)",
        animation: shake ? "screenShake 0.1s infinite" : "none",
      }}
    >
      {/* Whiteout overlay that pulses */}
      <div 
        className="absolute inset-0 pointer-events-none transition-opacity duration-500"
        style={{
          background: "radial-gradient(ellipse at center, rgba(255,255,255,0.15) 0%, transparent 70%)",
          opacity: phase === "storm" ? 1 : 0,
        }}
      />

      {/* Wind streaks - MASSIVE */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(60)].map((_, i) => (
          <div
            key={`wind-${i}`}
            className="absolute"
            style={{
              top: `${(i / 60) * 100}%`,
              left: "-100%",
              width: `${Math.random() * 700 + 400}px`,
              height: `${Math.random() * 4 + 1}px`,
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.6), rgba(255,255,255,0.4), transparent)",
              animation: `blizzardWind ${Math.random() * 0.35 + 0.15}s linear infinite`,
              animationDelay: `${(i / 60) * 0.5}s`,
            }}
          />
        ))}
      </div>

      {/* Heavy snow */}
      <div className="absolute inset-0 overflow-hidden">
        {snowflakes.map((flake) => (
          <div
            key={flake.id}
            className="absolute text-white"
            style={{
              left: `${flake.left}%`,
              top: "-5%",
              fontSize: `${flake.size}em`,
              opacity: flake.opacity,
              textShadow: "0 0 10px rgba(255,255,255,0.8)",
              animation: `blizzardSnow ${flake.duration}s linear infinite`,
              animationDelay: `${flake.delay}s`,
            }}
          >
            ❄
          </div>
        ))}
      </div>

      {/* Additional small particles - ICE SHARDS */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(250)].map((_, i) => (
          <div
            key={`particle-${i}`}
            className="absolute bg-white"
            style={{
              left: `${Math.random() * 150 - 25}%`,
              top: "-2%",
              width: `${Math.random() * 4 + 1}px`,
              height: `${Math.random() * 2 + 1}px`,
              opacity: Math.random() * 0.8 + 0.2,
              animation: `swirlingShard ${Math.random() * 0.5 + 0.25}s linear infinite`,
              animationDelay: `${Math.random() * 1.5}s`,
              transform: "rotate(45deg)",
            }}
          />
        ))}
      </div>

      {/* Horizontal snow blast */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(120)].map((_, i) => (
          <div
            key={`blast-${i}`}
            className="absolute w-2 h-0.5 bg-white/70 rounded-full"
            style={{
              top: `${Math.random() * 100}%`,
              left: "-5%",
              animation: `horizontalBlast ${Math.random() * 0.25 + 0.12}s linear infinite`,
              animationDelay: `${Math.random() * 1.5}s`,
            }}
          />
        ))}
      </div>

      {/* Swirling vortex layers */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(8)].map((_, i) => (
          <div
            key={`vortex-${i}`}
            className="absolute inset-0"
            style={{
              background: `conic-gradient(from ${i * 45}deg, transparent 0%, rgba(255,255,255,0.05) 10%, transparent 20%)`,
              animation: `vortexSpin ${3 + i * 0.5}s linear infinite`,
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>

      {/* Fog/mist layers */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at center, transparent 0%, rgba(255,255,255,0.1) 100%)",
          animation: "pulse 3s ease-in-out infinite",
        }}
      />

      {/* Logo flash */}
      <div 
        className="absolute inset-0 flex items-center justify-center transition-opacity duration-500"
        style={{ opacity: logoOpacity }}
      >
        <div className="relative">
          {/* Glow effect */}
          <div 
            className="absolute -inset-20 bg-[#007ba7]/30 blur-3xl rounded-full"
            style={{ animation: "pulse 1s ease-in-out infinite" }}
          />
          <img
            src="https://qbtfofrikbawvjwpmbob.supabase.co/storage/v1/object/public/assets/Noreasters%20Snow%20Logo%20No%20Background.png"
            alt="Cape Ann Nor'easters"
            className="relative w-80 h-80 md:w-[500px] md:h-[500px] object-contain drop-shadow-2xl"
            style={{
              filter: "drop-shadow(0 0 30px rgba(0, 196, 255, 0.5))",
            }}
          />
        </div>
      </div>

      {/* Vignette */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.6) 100%)",
        }}
      />

      <style>{`
        @keyframes blizzardSnow {
          0% {
            transform: translateY(-10vh) translateX(0) rotate(0deg);
          }
          100% {
            transform: translateY(110vh) translateX(500px) rotate(1440deg);
          }
        }

        @keyframes swirlingShard {
          0% {
            transform: translateY(-10vh) translateX(0) rotate(0deg);
          }
          50% {
            transform: translateY(50vh) translateX(300px) rotate(720deg);
          }
          100% {
            transform: translateY(110vh) translateX(-200px) rotate(1440deg);
          }
        }
        
        @keyframes blizzardWind {
          0% {
            transform: translateX(0) skewX(-25deg);
          }
          100% {
            transform: translateX(calc(100vw + 700px)) skewX(-25deg);
          }
        }

        @keyframes horizontalBlast {
          0% {
            transform: translateX(0);
            opacity: 0.9;
          }
          100% {
            transform: translateX(110vw);
            opacity: 0;
          }
        }

        @keyframes vortexSpin {
          0% {
            transform: rotate(0deg) scale(1);
          }
          50% {
            transform: rotate(180deg) scale(1.1);
          }
          100% {
            transform: rotate(360deg) scale(1);
          }
        }

        @keyframes screenShake {
          0%, 100% { transform: translate(0, 0); }
          10% { transform: translate(-3px, 2px); }
          20% { transform: translate(3px, -2px); }
          30% { transform: translate(-2px, 3px); }
          40% { transform: translate(2px, -3px); }
          50% { transform: translate(-3px, -2px); }
          60% { transform: translate(3px, 2px); }
          70% { transform: translate(-2px, -2px); }
          80% { transform: translate(2px, 3px); }
          90% { transform: translate(-3px, 3px); }
        }
      `}</style>
    </div>
  );
}
