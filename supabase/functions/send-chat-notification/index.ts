import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { GoogleAuth } from "npm:google-auth-library@9.6.3";

serve(async (req) => {
  try {
    const payload = await req.json();

    // Check if it's an INSERT on public.messages
    if (payload.type !== "INSERT" || payload.table !== "messages") {
      return new Response("Not a new message", { status: 200 });
    }

    const message = payload.record;
    const senderId = message.sender_id;
    const receiverId = message.receiver_id; // null for group
    const content = message.content || "New message";

    // 1. Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Fetch sender profile
    const { data: sender } = await supabase
      .from("profiles")
      .select("full_name, role, rep_id")
      .eq("id", senderId)
      .single();
    const senderName = sender?.full_name || "Someone";

    // 3. Collect receiver FCM tokens
    let tokens: string[] = [];
    if (receiverId) {
      // Direct message
      const { data: receiver } = await supabase
        .from("profiles")
        .select("fcm_token")
        .eq("id", receiverId)
        .single();
      if (receiver?.fcm_token) tokens.push(receiver.fcm_token);
    } else {
      // Group message
      // Find the group of the sender
      const myGroupId = sender?.role === 'representative' ? senderId : sender?.rep_id;
      
      let groupUsersQuery = supabase
        .from("profiles")
        .select("fcm_token")
        .neq("id", senderId);
        
      if (myGroupId) {
        groupUsersQuery = groupUsersQuery.or(`id.eq.${myGroupId},rep_id.eq.${myGroupId}`);
      } else {
        // If sender has no group, do not send to everyone. Just themselves (which is filtered out) or none.
        groupUsersQuery = groupUsersQuery.eq("id", "none"); 
      }

      const { data: groupUsers } = await groupUsersQuery;
      
      if (groupUsers) {
        tokens = groupUsers
          .filter((u) => u.fcm_token)
          .map((u) => u.fcm_token);
      }
    }

    if (tokens.length === 0) {
      return new Response("No tokens found", { status: 200 });
    }

    // 4. Authenticate with Firebase using Service Account
    const serviceAccountJsonStr = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
    if (!serviceAccountJsonStr) {
      console.error("FIREBASE_SERVICE_ACCOUNT secret is missing");
      return new Response("FCM config missing", { status: 500 });
    }
    const serviceAccount = JSON.parse(serviceAccountJsonStr);
    
    // Initialize GoogleAuth
    const auth = new GoogleAuth({
      credentials: {
        client_email: serviceAccount.client_email,
        private_key: serviceAccount.private_key,
      },
      scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
    });

    const accessToken = await auth.getAccessToken();

    // 5. Send notifications via FCM v1 HTTP API
    const projectId = serviceAccount.project_id;
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    const title = receiverId ? senderName : `${senderName} (Group)`;
    const body = message.media_type ? `Sent a ${message.media_type}` : content;

    const sendPromises = tokens.map(async (token) => {
      const response = await fetch(fcmUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token: token,
            notification: {
              title: title,
              body: body,
            },
            android: {
              priority: "high",
              notification: {
                sound: "default",
                channel_id: "default",
              }
            },
            data: {
              url: "/messages" // Where to route when tapped
            }
          },
        }),
      });
      return response.json();
    });

    const results = await Promise.all(sendPromises);
    console.log("FCM send results:", results);

    return new Response("Notifications sent", { status: 200 });
  } catch (error: any) {
    console.error("Error sending push notification:", error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
});
