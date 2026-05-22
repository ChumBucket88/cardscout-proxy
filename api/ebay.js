const APP_ID = process.env.EBAY_APP_ID;
const CERT_ID = process.env.EBAY_CERT_ID;
const APIFY_TOKEN = process.env.APIFY_TOKEN;

async function getEbayToken() {
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

async function fetchSoldFromApify(query) {
  // Run the Apify actor synchronously and get results
  const url = `https://api.apify.com/v2/acts/caffein.dev~ebay-sold-listings/run-sync-get-dataset-items?token=${APIFY_TOKEN}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      keyword: query,
      maxItems: 25,
      country: "US",
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Apify error (${res.status}): ${txt.slice(0, 200)}`);
  }
  return res.json();
}

function normalizeSoldItems(items) {
  // Convert Apify sold-listing format to our standard item shape
  return (items || []).map(i => ({
    title: i.title || i.name || "",
    price: { value: String(i.price ?? i.soldPrice ?? 0), currency: i.currency || "USD" },
    itemWebUrl: i.url || i.link || "#",
    image: { imageUrl: i.image || i.imageUrl || i.thumbnail || null },
    condition: i.condition || "Unknown",
    itemEndDate: i.soldDate || i.dateSold || i.endDate || null,
    seller: { username: i.seller || "", feedbackPercentage: i.sellerFeedback || "" },
    buyingOptions: [i.listingType === "Auction" ? "AUCTION" : "FIXED_PRICE"],
    bidCount: i.bidCount || 0,
  }));
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { query, type } = req.query;
  if (!query) return res.status(400).json({ error: "Missing query" });

  try {
    if (type === "sold") {
      const apifyData = await fetchSoldFromApify(query);
      const items = normalizeSoldItems(apifyData);
      return res.json({ type: "sold", items, total: items.length, source: "apify" });
    }

    // Active listings via eBay Browse API
    const token = await getEbayToken();
    const params = new URLSearchParams({
      q: query,
      category_ids: "212",
      sort: "price",
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
    return res.json({ type: "active", items: data.itemSummaries || [], total: data.total || 0, source: "browse" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
