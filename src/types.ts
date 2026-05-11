export interface Story {
  id: string;
  userId: string;
  title: string;
  content: string;
  theme: string;
  character: string;
  language: string;
  mode: 'story' | 'story_image';
  imageUrl?: string;
  audioUrl?: string;
  createdAt: number;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  bio?: string;
  favoriteColor?: string;
  createdAt: number;
}
