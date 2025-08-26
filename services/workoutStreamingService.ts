interface WorkoutStream {
  id: string;
  title: string;
  instructor: string;
  duration: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  category: string;
  thumbnailUrl: string;
  streamUrl: string;
  isLive: boolean;
  scheduledTime?: string;
  participants: number;
  description: string;
  equipment: string[];
}

interface StreamingStats {
  viewers: number;
  likes: number;
  comments: string[];
}

class WorkoutStreamingService {
  private currentStream: WorkoutStream | null = null;
  private isStreaming = false;
  private streamStats: StreamingStats = { viewers: 0, likes: 0, comments: [] };
  private statsCallback?: (stats: StreamingStats) => void;

  // Mock live workout streams
  private mockStreams: WorkoutStream[] = [
    {
      id: 'stream-1',
      title: 'Morning HIIT Blast',
      instructor: 'Sarah Johnson',
      duration: 30,
      difficulty: 'intermediate',
      category: 'HIIT',
      thumbnailUrl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400',
      streamUrl: 'https://example.com/stream/hiit-blast',
      isLive: true,
      participants: 1247,
      description: 'High-intensity interval training to kickstart your day',
      equipment: ['bodyweight']
    },
    {
      id: 'stream-2',
      title: 'Strength & Power',
      instructor: 'Mike Chen',
      duration: 45,
      difficulty: 'advanced',
      category: 'Strength',
      thumbnailUrl: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=400',
      streamUrl: 'https://example.com/stream/strength-power',
      isLive: true,
      participants: 892,
      description: 'Build muscle and power with compound movements',
      equipment: ['dumbbells', 'barbell']
    },
    {
      id: 'stream-3',
      title: 'Yoga Flow & Mindfulness',
      instructor: 'Emma Williams',
      duration: 60,
      difficulty: 'beginner',
      category: 'Yoga',
      thumbnailUrl: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400',
      streamUrl: 'https://example.com/stream/yoga-flow',
      isLive: false,
      scheduledTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      participants: 654,
      description: 'Gentle yoga flow for flexibility and mental clarity',
      equipment: ['yoga-mat']
    },
    {
      id: 'stream-4',
      title: 'Cardio Dance Party',
      instructor: 'Lisa Rodriguez',
      duration: 40,
      difficulty: 'intermediate',
      category: 'Cardio',
      thumbnailUrl: 'https://images.unsplash.com/photo-1594737625785-a6cbdabd333c?w=400',
      streamUrl: 'https://example.com/stream/cardio-dance',
      isLive: true,
      participants: 1856,
      description: 'Fun cardio workout with dance moves and great music',
      equipment: ['bodyweight']
    }
  ];

  getLiveStreams(): WorkoutStream[] {
    return this.mockStreams.filter(stream => stream.isLive);
  }

  getUpcomingStreams(): WorkoutStream[] {
    return this.mockStreams.filter(stream => !stream.isLive && stream.scheduledTime);
  }

  getAllStreams(): WorkoutStream[] {
    return [...this.mockStreams];
  }

  async joinStream(streamId: string): Promise<boolean> {
    const stream = this.mockStreams.find(s => s.id === streamId);
    if (!stream || !stream.isLive) {
      return false;
    }

    this.currentStream = stream;
    this.isStreaming = true;
    
    this.streamStats = {
      viewers: stream.participants + Math.floor(Math.random() * 100),
      likes: Math.floor(stream.participants * 0.3),
      comments: this.generateMockComments()
    };

    this.startStatsUpdates();
    
    return true;
  }

  leaveStream() {
    this.currentStream = null;
    this.isStreaming = false;
    this.statsCallback = undefined;
  }

  getCurrentStream(): WorkoutStream | null {
    return this.currentStream;
  }

  getStreamStats(): StreamingStats {
    return { ...this.streamStats };
  }

  setStatsCallback(callback: (stats: StreamingStats) => void) {
    this.statsCallback = callback;
  }

  private startStatsUpdates() {
    const updateInterval = setInterval(() => {
      if (!this.isStreaming) {
        clearInterval(updateInterval);
        return;
      }

      this.streamStats.viewers += Math.floor((Math.random() - 0.5) * 10);
      this.streamStats.viewers = Math.max(0, this.streamStats.viewers);
      
      if (Math.random() < 0.3) {
        this.streamStats.likes += Math.floor(Math.random() * 5);
      }
      
      if (Math.random() < 0.2) {
        this.streamStats.comments.push(this.generateRandomComment());
        if (this.streamStats.comments.length > 20) {
          this.streamStats.comments.shift();
        }
      }

      this.statsCallback?.(this.streamStats);
    }, 5000);
  }

  private generateMockComments(): string[] {
    const comments = [
      "Great workout! 💪",
      "Love this instructor!",
      "Feeling the burn already 🔥",
      "Thanks for the motivation!",
      "This is exactly what I needed today",
      "Amazing energy! Keep it up!",
      "Perfect form demonstration",
      "Can't wait for the next session"
    ];
    
    return comments.slice(0, Math.floor(Math.random() * 5) + 3);
  }

  private generateRandomComment(): string {
    const comments = [
      "Awesome workout! 💪",
      "Loving this session!",
      "Great music choice 🎵",
      "Perfect timing for this exercise",
      "Instructor is amazing!",
      "Feeling stronger already",
      "This is challenging but fun",
      "Thanks for the clear instructions",
      "Best workout of the week!",
      "Can't stop, won't stop! 🔥"
    ];
    
    return comments[Math.floor(Math.random() * comments.length)];
  }

  sendLike() {
    if (this.isStreaming) {
      this.streamStats.likes += 1;
      this.statsCallback?.(this.streamStats);
    }
  }

  sendComment(comment: string) {
    if (this.isStreaming && comment.trim()) {
      this.streamStats.comments.push(comment.trim());
      if (this.streamStats.comments.length > 20) {
        this.streamStats.comments.shift();
      }
      this.statsCallback?.(this.streamStats);
    }
  }

  isCurrentlyStreaming(): boolean {
    return this.isStreaming;
  }

  getStreamsByCategory(category: string): WorkoutStream[] {
    return this.mockStreams.filter(stream => 
      stream.category.toLowerCase() === category.toLowerCase()
    );
  }

  getStreamsByDifficulty(difficulty: WorkoutStream['difficulty']): WorkoutStream[] {
    return this.mockStreams.filter(stream => stream.difficulty === difficulty);
  }

  searchStreams(query: string): WorkoutStream[] {
    const searchTerm = query.toLowerCase();
    return this.mockStreams.filter(stream => 
      stream.title.toLowerCase().includes(searchTerm) ||
      stream.instructor.toLowerCase().includes(searchTerm) ||
      stream.category.toLowerCase().includes(searchTerm) ||
      stream.description.toLowerCase().includes(searchTerm)
    );
  }
}

export default new WorkoutStreamingService();
export type { WorkoutStream, StreamingStats };