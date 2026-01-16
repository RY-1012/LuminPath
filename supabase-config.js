// supabase-config.js
// Supabase configuration - FREE tier
const SUPABASE_URL = 'https://your-project-url.supabase.co'; // add project Url
const SUPABASE_KEY = 'your-anon-key-here'; // add anon key

// Initialize Supabase client
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Export for use
window.supabase = supabaseClient;
console.log('Supabase initialized successfully!');