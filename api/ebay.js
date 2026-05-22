const APP_ID = process.env.EBAY_APP_ID;
const CERT_ID = process.env.EBAY_CERT_ID;

async function getToken() {
  const credentials = Buffer.from(`${APP_ID}:${CERT_ID}`).toString("base64");
  const res = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope",
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("Token error: " + JSON.stringify(data));
  return data.access_token;
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { query, type } = req.query;
  if (!query) return res.status(400).json({ error: "Missing query" });

  try {
    const token = await getToken();
    const params = new URLSearchParams({
      q: query,
      category_ids: "212",
      sort: type === "sold" ? "endingSoonest" : "price",
      limit: "25",
    });

    const r = await fetch(`https://api.ebay.com/buy/browse/v1/item_summary/search?${params}`, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
        "Content-Type": "application/json",
      },
    });
    const data = await r.json();
    res.json({ type, items: data.itemSummaries || [], total: data.total || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
