import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase configuration. Please check your .env file."
  );
}

// Create Supabase client with anonymous authentication
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Get or create anonymous session
export async function initializeAnonymousAuth() {
  try {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) {
      console.error("Failed to initialize anonymous auth:", error);
      return null;
    }
    return data.user;
  } catch (err) {
    console.error("Error during anonymous auth initialization:", err);
    return null;
  }
}

// Get current user
export async function getCurrentUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// Get current session
export async function getCurrentSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}
