import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.11.0";
// Import firebase-admin if we want to do it directly, or just send a raw FCM REST request
// Since we might not have a firebase-admin dependency readily available in deno without some setup, 
// using the FCM v1 HTTP API is a reliable alternative if the user has the service account key.

// Alternatively, we can use a simpler fetch to the FCM API.
// We'll require a FIREBASE_SERVER_KEY (for legacy HTTP API) or FIREBASE_SERVICE_ACCOUNT (for HTTP v1).
// For simplicity in edge functions, the legacy API is often still used if the key is available, but HTTP v1 is recommended.
// Assuming the user has `FCM_SERVER_KEY` configured in Supabase secrets for the legacy API to make this simple and robust,
// OR they can update this function to use Google Auth Library for HTTP v1.

serve(async (req) => {
  try {
    // 1. Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const fcmServerKey = Deno.env.get('FCM_SERVER_KEY'); // Requires user to add this to secrets

    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ error: 'Missing Supabase configuration' }), { status: 500 });
    }
    
    if (!fcmServerKey) {
       console.warn('FCM_SERVER_KEY is missing. Cannot send notifications.');
       return new Response(JSON.stringify({ error: 'FCM_SERVER_KEY is not configured in secrets.' }), { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 2. Fetch all profiles with an FCM token
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, fcm_token, full_name')
      .not('fcm_token', 'is', null);

    if (profileError) {
      throw profileError;
    }

    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ message: 'No users with FCM tokens found' }), { status: 200 });
    }

    // 3. Send notifications
    const tokens = profiles.map(p => p.fcm_token);
    
    const fcmPayload = {
      registration_ids: tokens,
      notification: {
        title: "Meal Reminder 🍽️",
        body: "Don't forget to log your meal for today!",
        icon: "ic_notification"
      },
      data: {
        action: "LOG_MEAL"
      }
    };

    const fcmResponse = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `key=${fcmServerKey}`
      },
      body: JSON.stringify(fcmPayload)
    });

    const fcmData = await fcmResponse.json();

    return new Response(JSON.stringify({
      message: 'Meal reminders sent',
      successCount: fcmData.success,
      failureCount: fcmData.failure
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
