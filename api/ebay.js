const fetch = require("node-fetch");

const EBAY_APP_ID = "TaylorLa-TradingC-PRD-b18338082-58ae9d13";
const FINDING_API = "https://svcs.ebay.com/services/search/FindingService/v1";

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { query, type } = req.query;
  if (!query) return res.status(400).json({ error: "Missing query" });

  const completed = type === "sold";
  const operation = completed ? "findCompletedItems" : "findItemsAdvanced";

  const params = new URLSearchParams({
    "OPERATION-NAME": operation,
    "SERVICE-VERSION": "1.0.0",
    "SECURITY-APPNAME": EBAY_APP_ID,
    "RESPONSE-DATA-FORMAT": "JSON",
    "REST-PAYLOAD": "",
    "keywords": query,
    "categoryId": "212",
    "paginationInput.entriesPerPage": "25",
    "sortOrder": completed ? "EndTimeSoonest" : "PricePlusShippingLowest",
  });

  if (completed) {
    params.append("itemFilter(0).name", "SoldItemsOnly");
    params.append("itemFilter(0).value", "true");
  }
  params.append("itemFilter(1).name", "ListingType");
  params.append("itemFilter(1).value(0)", "Auction");
  params.append("itemFilter(1).value(1)", "AuctionWithBIN");
  params.append("itemFilter(1).value(2)", "FixedPrice");

  try {
    const response = await fetch(FINDING_API + "?" + params.toString());
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "eBay API error: " + err.message });
  }
};
