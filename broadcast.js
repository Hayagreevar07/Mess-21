const url = 'https://ergcorvheyilnlwisprg.supabase.co';
const key = 'sb_publishable_7DMgMr_96ZpytB5qJisGVg_zy-uCH_n';

async function broadcast() {
  // Get admin profile
  const pRes = await fetch(`${url}/rest/v1/profiles?email=eq.hayagreevar2007@gmail.com`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  const profiles = await pRes.json();
  const adminId = profiles[0]?.id;

  if (!adminId) {
    console.log("Admin profile not found!");
    return;
  }

  // Insert broadcast message
  const mRes = await fetch(`${url}/rest/v1/messages`, {
    method: 'POST',
    headers: { 
      'apikey': key, 
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      sender_id: adminId,
      content: "📢 SYSTEM UPDATE: MessManager v2.0 is officially LIVE! 🔥 The app has been fully updated with secure ownership tracking, a polished green chat aesthetic with read receipts, and significantly faster load times! Download the latest APK from the Settings page to enjoy all features!",
      receiver_id: null
    })
  });

  if (mRes.ok) {
    console.log("Broadcast sent successfully!");
  } else {
    console.log("Failed:", await mRes.text());
  }
}

broadcast();
