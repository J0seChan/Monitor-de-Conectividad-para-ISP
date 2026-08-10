// ============================================================
// Configuración de Supabase
// ------------------------------------------------------------
// La clave anónima (anon) es PÚBLICA por diseño: identifica el
// proyecto, pero no da acceso a los datos por sí sola. La
// seguridad real recae en las políticas RLS de Supabase, que
// exigen una sesión iniciada (rol authenticated) para leer o
// escribir. La clave service_role NUNCA debe ir aquí; esa solo
// vive en el worker (backend), nunca en el navegador.
// ============================================================

const SUPABASE_URL = "https://fiutwgogaatwhcehhewr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpdXR3Z29nYWF0d2hjZWhoZXdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwMDQ0MTAsImV4cCI6MjA5ODU4MDQxMH0.3UwYw9569iexdPb93IWBYkzCkdIe1QaI843xfNLaCHc";
