export type Gender = "male" | "female" | "other";

export interface Profile {
  id: string; // auth.users id
  full_name: string;
  age: number;
  gender: Gender;
  standard: string; // e.g., "Grade 6" / "Class 8"
  role?: 'student' | 'parent' | 'teacher' | 'principal';
  avatar_style?: string;
  created_at?: string;
  updated_at?: string;
}
