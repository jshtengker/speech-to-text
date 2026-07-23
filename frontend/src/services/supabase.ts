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
    const errMsg = error.message.toLowerCase();
    if (errMsg.includes('exceeded') || errMsg.includes('maximum allowed size') || errMsg.includes('too large')) {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
      throw new Error(
        `File Size Limit Exceeded (${fileSizeMB} MB). The maximum allowed file size is 50 MB. Please select a shorter media file or audio recording.`
      );
    }

    if (errMsg.includes('row-level security') || errMsg.includes('unauthorized') || errMsg.includes('403')) {
      throw new Error(
        'Supabase Storage Access Denied: Please enable public INSERT/SELECT policies for the "speech-media" bucket in your Supabase Dashboard.'
      );
    }
    throw new Error(`Storage Upload Error: ${error.message}`);
  }


  const { data: publicUrlData } = supabase.storage.from('speech-media').getPublicUrl(data.path);
  return publicUrlData.publicUrl;
}
