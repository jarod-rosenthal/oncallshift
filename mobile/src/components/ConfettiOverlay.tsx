import React, { useEffect, useRef, useState, createContext, useContext, useCallback } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import { Portal } from 'react-native-paper';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Particle {
  id: number;
  x: Animated.Value;
  y: Animated.Value;
  rotation: Animated.Value;
  scale: Animated.Value;
  color: string;
  initialX: number;
}

// Sophisticated celebration colors - elegant, restrained professional joy
// Replaces carnival-like palette with refined tones
const CONFETTI_COLORS = [
  '#A0AEC0', // Silver
  '#4FD1C5', // Teal
  '#63B3ED', // Sky
  '#68D391', // Mint
  '#EDF2F7', // Pearl
  '#9F7AEA', // Lavender
  '#81E6D9', // Seafoam
  '#CBD5E0', // Platinum
];

interface ConfettiContextType {
  showConfetti: () => void;
}

const ConfettiContext = createContext<ConfettiContextType | null>(null);

export function useConfetti() {
  const context = useContext(ConfettiContext);
  if (!context) {
    throw new Error('useConfetti must be used within a ConfettiProvider');
  }
  return context;
}

export function ConfettiProvider({ children }: { children: React.ReactNode }) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const particleIdRef = useRef(0);

  const createParticle = useCallback((): Particle => {
    const id = particleIdRef.current++;
    const startX = Math.random() * SCREEN_WIDTH;

    return {
      id,
      x: new Animated.Value(startX),
      y: new Animated.Value(-20),
      rotation: new Animated.Value(0),
      scale: new Animated.Value(1),
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      initialX: startX,
    };
  }, []);

  const animateParticle = useCallback((particle: Particle) => {
    const duration = 2000 + Math.random() * 1000;
    const endX = particle.initialX + (Math.random() - 0.5) * 200;

    Animated.parallel([
      Animated.timing(particle.y, {
        toValue: SCREEN_HEIGHT + 50,
        duration,
        useNativeDriver: true,
      }),
      Animated.timing(particle.x, {
        toValue: endX,
        duration,
        useNativeDriver: true,
      }),
      Animated.timing(particle.rotation, {
        toValue: Math.random() * 10 - 5,
        duration,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(particle.scale, {
          toValue: 1.2,
          duration: duration * 0.3,
          useNativeDriver: true,
        }),
        Animated.timing(particle.scale, {
          toValue: 0,
          duration: duration * 0.7,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  const showConfetti = useCallback(() => {
    setIsVisible(true);

    // Create particles in waves
    const newParticles: Particle[] = [];
    const particleCount = 30;

    for (let i = 0; i < particleCount; i++) {
      const particle = createParticle();
      newParticles.push(particle);
    }

    setParticles(newParticles);

    // Animate each particle with slight delay
    newParticles.forEach((particle, index) => {
      setTimeout(() => {
        animateParticle(particle);
      }, index * 30);
    });

    // Clean up after animation
    setTimeout(() => {
      setIsVisible(false);
      setParticles([]);
    }, 3500);
  }, [createParticle, animateParticle]);

  return (
    <ConfettiContext.Provider value={{ showConfetti }}>
      {children}
      {isVisible && (
        <Portal>
          <View style={styles.container} pointerEvents="none">
            {particles.map((particle) => (
              <Animated.View
                key={particle.id}
                style={[
                  styles.particle,
                  {
                    backgroundColor: particle.color,
                    transform: [
                      { translateX: particle.x },
                      { translateY: particle.y },
                      {
                        rotate: particle.rotation.interpolate({
                          inputRange: [-5, 5],
                          outputRange: ['-180deg', '180deg'],
                        }),
                      },
                      { scale: particle.scale },
                    ],
                  },
                ]}
              />
            ))}
          </View>
        </Portal>
      )}
    </ConfettiContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
  particle: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 2,
  },
});
