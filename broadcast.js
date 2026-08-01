const url = 'https://ergcorvheyilnlwisprg.supabase.co';
const key = 'sb_publishable_7DMgMr_96ZpytB5qJisGVg_zy-uCH_n';

async function broadcast() {
  // Get any existing profile for sender_id
  const pRes = await fetch(`${url}/rest/v1/profiles?limit=1`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  const profiles = await pRes.json();
  let senderId = profiles[0]?.id;

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
      sender_id: senderId || null,
      content: "📢 SYSTEM UPDATE: MessManager v3.2.0 is officially LIVE! 🚀 Enjoy detailed date-by-date daily meal bills, CSV statement exports, member filters, and printable monthly invoices!",
      receiver_id: null
    })
  });

  if (mRes.ok) {
    console.log("Broadcast update sent successfully!");
  } else {
    console.log("Failed:", await mRes.text());
  }
}

broadcast();
