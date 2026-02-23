// Supabase Configuration
// Replace with your actual values from Supabase Project Settings > API
const SUPABASE_URL = 'https://rzeppouvcbrntiegfdask.supabase.co';
// PLEASE PASTE YOUR FULL ANON KEY BELOW (from the 'Publishable key' section)
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6ZXBwb3V2Y2JudGllZ2ZkYXNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4MzA0OTksImV4cCI6MjA4NzQwNjQ5OX0.zD62j60-DHaYymjRTfJ1GV9YE0ivgbV5lKDVPXjdxIg';

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

window.supabaseClient = supabaseClient; 
