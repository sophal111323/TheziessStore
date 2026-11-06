const token = "da9d2ae31a57f7320ec9178d658b9be937c3adb16335bcb963821a8888d37efb";

async function testRealItem() {
  const res = await fetch("https://api.jlastore.com/api/reseller/order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_token: token,
      player_id: "99999999999",
      item_id: 602,
      reference: "TEST_REF_" + Date.now(),
      server_id: "1234"
    })
  });
  const data = await res.text();
  console.log("Status:", res.status);
  console.log("Data:", data);
}

testRealItem();

