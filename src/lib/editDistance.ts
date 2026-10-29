// The implementation lives with the edge functions so the scholar function's
// name filter and the frontend share one definition; Deno can't import from
// src/, but the browser build can import from supabase/functions/_shared.
export { editDistance, editDistanceWithin } from '../../supabase/functions/_shared/editDistance.ts';
