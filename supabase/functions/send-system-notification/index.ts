import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { GoogleAuth } from "npm:google-auth-library@9.6.3";

serve(async (req) => {
  try {
    const payload = await req.json();
    const type = payload.type;
    const table = payload.table;
    const record = payload.record;

    if (!["meal_logs", "due_bills"].includes(table)) {
      return new Response("Not a monitored table", { status: 200 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let targetMemberId: string | null = null;
    let title = "";
    let body = "";

    if (table === "meal_logs" && type === "INSERT") {
      // Logic for meal logs
      const memberId = record.member_id;
      const loggedBy = record.logged_by;
      
      // We only notify the member if someone else (admin/rep) logged it for them
      if (memberId !== loggedBy) {
        targetMemberId = memberId;
        
        // Fetch menu item name and the name of who logged it
        const [menuRes, loggerRes] = await Promise.all([
          supabase.from("menu_items").select("name").eq("id", record.menu_item_id).single(),
          supabase.from("profiles").select("full_name").eq("id", loggedBy).single()
        ]);
        
        const menuName = menuRes.data?.name || "a meal";
        const loggerName = loggerRes.data?.full_name || "Admin";
        
        title = "Meal Logged";
        body = `${loggerName} logged ${record.quantity}x ${menuName} for your ${record.meal_type}.`;
      } else {
        return new Response("User logged their own meal, no notification needed.", { status: 200 });
      }
    } 
    else if (table === "due_bills") {
      targetMemberId = record.member_id;
      
      if (type === "INSERT") {
        title = "New Mess Bill";
        body = `Your bill for ${record.month} (₹${record.amount}) has been generated and is due on ${record.due_date}.`;
      } 
      else if (type === "UPDATE") {
        const oldRecord = payload.old_record;
        // Only notify if is_paid changed from false to true
        if (!oldRecord?.is_paid && record.is_paid) {
          title = "Payment Confirmed";
          body = `Your payment of ₹${record.amount} for ${record.month} has been successfully recorded.`;
        } else {
          return new Response("Bill update did not change payment status.", { status: 200 });
        }
      } else {
         return new Response("Unhandled bill event.", { status: 200 });
      }
    }

    if (!targetMemberId) {
      return new Response("No target member to notify", { status: 200 });
    }

    // Fetch the target member's FCM token
    const { data: receiver } = await supabase
      .from("profiles")
      .select("fcm_token")
      .eq("id", targetMemberId)
      .single();

    if (!receiver?.fcm_token) {
      return new Response("User has no FCM token", { status: 200 });
    }

    // Authenticate with Firebase using Service Account
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

    // Send notification via FCM v1 HTTP API
    const projectId = serviceAccount.project_id;
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    const response = await fetch(fcmUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token: receiver.fcm_token,
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
            url: table === "meal_logs" ? "/meals" : "/bills"
          }
        },
      }),
    });

    const fcmResult = await response.json();
    console.log("FCM send result:", fcmResult);

    return new Response("Notification sent successfully", { status: 200 });

  } catch (error: any) {
    console.error("Error sending system push notification:", error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
});
