import { Platform } from 'react-native';
import * as Speech from 'expo-speech';

interface VoiceCommand {
  command: string;
  action: () => void;
  phrases: string[];
}

class VoiceCommandService {
  private isListening = false;
  private recognition: any = null;
  private commands: VoiceCommand[] = [];
  private onCommandCallback?: (command: string) => void;

  constructor() {
    if (Platform.OS === 'web') {
      this.initializeWebSpeechRecognition();
    }
  }

  private initializeWebSpeechRecognition() {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      // @ts-ignore
      this.recognition = new window.webkitSpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = false;
      this.recognition.lang = 'en-US';

      this.recognition.onresult = (event: any) => {
        const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
        this.processCommand(transcript);
      };

      this.recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        this.isListening = false;
      };

      this.recognition.onend = () => {
        this.isListening = false;
      };
    }
  }

  registerCommands(commands: VoiceCommand[]) {
    this.commands = commands;
  }

  setCommandCallback(callback: (command: string) => void) {
    this.onCommandCallback = callback;
  }

  private processCommand(transcript: string) {
    console.log('Voice command received:', transcript);
    
    for (const command of this.commands) {
      for (const phrase of command.phrases) {
        if (transcript.includes(phrase.toLowerCase())) {
          console.log('Executing command:', command.command);
          command.action();
          this.onCommandCallback?.(command.command);
          this.speak(`${command.command} executed`);
          return;
        }
      }
    }
    
    // If no command matched, provide feedback
    this.speak('Command not recognized');
  }

  async startListening(): Promise<boolean> {
    if (Platform.OS === 'web' && this.recognition) {
      try {
        this.recognition.start();
        this.isListening = true;
        return true;
      } catch (error) {
        console.error('Failed to start voice recognition:', error);
        return false;
      }
    }
    return false;
  }

  stopListening() {
    if (Platform.OS === 'web' && this.recognition) {
      this.recognition.stop();
      this.isListening = false;
    }
  }

  async speak(text: string) {
    try {
      if (Platform.OS !== 'web') {
        await Speech.speak(text, {
          language: 'en-US',
          pitch: 1.0,
          rate: 0.8,
        });
      } else {
        // Web speech synthesis
        if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = 'en-US';
          utterance.rate = 0.8;
          utterance.pitch = 1.0;
          window.speechSynthesis.speak(utterance);
        }
      }
    } catch (error) {
      console.error('Speech synthesis error:', error);
    }
  }

  getIsListening(): boolean {
    return this.isListening;
  }

  isSupported(): boolean {
    if (Platform.OS === 'web') {
      return typeof window !== 'undefined' && 'webkitSpeechRecognition' in window;
    }
    return true; // Assume mobile platforms support speech
  }
}

export default new VoiceCommandService();
export type { VoiceCommand };