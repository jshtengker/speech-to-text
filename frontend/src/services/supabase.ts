import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

export const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export async function uploadAudioToSupabase(file: File): Promise<string> {
  if (!supabase) {
    throw new Error('Supabase Storage is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment variables.');
  }

  const fileExt = file.name.split('.').pop() || 'mp3';
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
  const filePath = `uploads/${fileName}`;

  const { data, error } = await supabase.storage.from('speech-media').upload(filePath, file, {
    cacheControl: '3600',
    upsert: false
  });

  if (error) {
    throw new Error(`Storage Upload Error: ${error.message}`);
  }

  const { data: publicUrlData } = supabase.storage.from('speech-media').getPublicUrl(data.path);
  return publicUrlData.publicUrl;
}
