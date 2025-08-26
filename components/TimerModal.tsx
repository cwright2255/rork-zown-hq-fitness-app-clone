import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { X, Play, Pause, RotateCcw, Clock } from 'lucide-react-native';
import Colors from '@/constants/colors';
import Card from '@/components/Card';
import Button from '@/components/Button';

interface TimerModalProps {
  visible: boolean;
  onClose: () => void;
}

const PRESET_TIMES = [
  { label: '5 min', seconds: 300 },
  { label: '10 min', seconds: 600 },
  { label: '15 min', seconds: 900 },
  { label: '20 min', seconds: 1200 },
  { label: '25 min', seconds: 1500 },
  { label: '30 min', seconds: 1800 },
];

export default function TimerModal({ visible, onClose }: TimerModalProps) {
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes default
  const [initialTime, setInitialTime] = useState(300);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setIsRunning(false);
            Alert.alert('Timer Complete!', 'Your timer has finished.', [
              { text: 'OK', onPress: () => {} }
            ]);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = () => {
    setIsRunning(!isRunning);
  };

  const handleReset = () => {
    setIsRunning(false);
    setTimeLeft(initialTime);
  };

  const handlePresetSelect = (seconds: number) => {
    setIsRunning(false);
    setTimeLeft(seconds);
    setInitialTime(seconds);
  };

  const handleCustomTime = () => {
    Alert.prompt(
      'Custom Timer',
      'Enter minutes:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Set',
          onPress: (value) => {
            const minutes = parseInt(value || '0');
            if (minutes > 0 && minutes <= 120) {
              const seconds = minutes * 60;
              setIsRunning(false);
              setTimeLeft(seconds);
              setInitialTime(seconds);
            } else {
              Alert.alert('Invalid Time', 'Please enter a number between 1 and 120 minutes.');
            }
          }
        }
      ],
      'plain-text',
      '',
      'numeric'
    );
  };

  const progress = initialTime > 0 ? (initialTime - timeLeft) / initialTime : 0;

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <Card style={styles.modal}>
        <View style={styles.header}>
          <Text style={styles.title}>Timer</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color={Colors.text.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {/* Timer Display */}
          <View style={styles.timerContainer}>
            <View style={[styles.progressRing, { borderColor: Colors.primary + '20' }]}>
              <View 
                style={[
                  styles.progressRingFill,
                  {
                    borderColor: Colors.primary,
                    transform: [{ rotate: `${progress * 360}deg` }]
                  }
                ]}
              />
              <View style={styles.timerDisplay}>
                <Text style={styles.timerText}>{formatTime(timeLeft)}</Text>
                <Text style={styles.timerLabel}>
                  {isRunning ? 'Running' : timeLeft === 0 ? 'Complete' : 'Ready'}
                </Text>
              </View>
            </View>
          </View>

          {/* Control Buttons */}
          <View style={styles.controls}>
            <TouchableOpacity
              style={[styles.controlButton, styles.resetButton]}
              onPress={handleReset}
              disabled={timeLeft === initialTime && !isRunning}
            >
              <RotateCcw size={24} color={Colors.text.secondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlButton, styles.playButton, isRunning && styles.pauseButton]}
              onPress={handlePlayPause}
              disabled={timeLeft === 0}
            >
              {isRunning ? (
                <Pause size={32} color={Colors.text.inverse} />
              ) : (
                <Play size={32} color={Colors.text.inverse} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlButton, styles.customButton]}
              onPress={handleCustomTime}
            >
              <Clock size={24} color={Colors.primary} />
            </TouchableOpacity>
          </View>

          {/* Preset Times */}
          <View style={styles.presetsContainer}>
            <Text style={styles.presetsTitle}>Quick Times</Text>
            <View style={styles.presetGrid}>
              {PRESET_TIMES.map((preset, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.presetButton,
                    initialTime === preset.seconds && styles.presetButtonActive
                  ]}
                  onPress={() => handlePresetSelect(preset.seconds)}
                >
                  <Text style={[
                    styles.presetButtonText,
                    initialTime === preset.seconds && styles.presetButtonTextActive
                  ]}>
                    {preset.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <Button
            title="Close"
            variant="outline"
            onPress={onClose}
            style={styles.closeButtonFooter}
          />
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modal: {
    width: '90%',
    maxWidth: 400,
    margin: 20,
    padding: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 20,
    alignItems: 'center',
  },
  timerContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  progressRing: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 8,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  progressRingFill: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 8,
    borderColor: 'transparent',
    borderTopColor: Colors.primary,
    borderRightColor: Colors.primary,
  },
  timerDisplay: {
    alignItems: 'center',
  },
  timerText: {
    fontSize: 36,
    fontWeight: '700',
    color: Colors.text.primary,
    fontFamily: 'monospace',
  },
  timerLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginBottom: 32,
  },
  controlButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resetButton: {
    backgroundColor: Colors.backgroundSecondary,
  },
  playButton: {
    backgroundColor: Colors.primary,
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  pauseButton: {
    backgroundColor: Colors.warning,
  },
  customButton: {
    backgroundColor: Colors.primary + '20',
  },
  presetsContainer: {
    width: '100%',
  },
  presetsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 12,
    textAlign: 'center',
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  presetButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  presetButtonActive: {
    backgroundColor: Colors.primary + '10',
    borderColor: Colors.primary,
  },
  presetButtonText: {
    fontSize: 14,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  presetButtonTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  closeButtonFooter: {
    width: '100%',
  },
});