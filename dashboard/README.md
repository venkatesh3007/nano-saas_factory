# Factory Dashboard - Reddit Ads API Integration

**Live Reddit Ads campaign data for the Factory dashboard**

## 🎯 Overview

This Netlify Function integrates with the Reddit Ads API v3 to fetch live campaign data for the Factory dashboard at https://buildjarvis-factory.netlify.app.

## 📁 Project Structure

```
factory/dashboard/
├── netlify/functions/
│   └── reddit-ads-status.js     # Main API function
├── netlify.toml                  # Netlify configuration
├── package.json                  # Dependencies
├── test-reddit-ads.html          # Test/demo page
└── README.md                     # This file
```

## 🔧 API Function

**Endpoint:** `/.netlify/functions/reddit-ads-status`

**Method:** `GET`

**Authentication:** Bearer token via `REDDIT_TOKEN` environment variable

### Reddit Ads API Endpoints Called

1. **Campaigns:** `GET /api/v3/ad_accounts/a2_ine5sw3w9d9n/campaigns`
2. **Ad Groups:** `GET /api/v3/ad_accounts/a2_ine5sw3w9d9n/ad_groups`  
3. **Ads:** `GET /api/v3/ad_accounts/a2_ine5sw3w9d9n/ads`

### Required Headers

- `Authorization: Bearer {token}`
- `User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36`
- `Origin: https://ads.reddit.com`
- `Referer: https://ads.reddit.com/`

## 📊 Response Format

```json
{
  "success": true,
  "data": {
    "campaigns": [
      {
        "id": "campaign_id",
        "name": "Campaign Name", 
        "status": "ACTIVE",
        "total_budget": 1000.00,
        "daily_budget": 50.00,
        "start_time": "2026-03-11T00:00:00Z",
        "end_time": "2026-04-11T23:59:59Z"
      }
    ],
    "ad_groups": [
      {
        "id": "ad_group_id",
        "name": "Ad Group Name",
        "status": "ACTIVE",
        "campaign_id": "campaign_id",
        "targeting_type": "INTERESTS"
      }
    ],
    "ads": [
      {
        "id": "ad_id", 
        "name": "Ad Name",
        "status": "ACTIVE",
        "ad_group_id": "ad_group_id",
        "creative_type": "TEXT"
      }
    ],
    "summary": {
      "campaigns": {
        "total": 5,
        "active": 3,
        "paused": 1,
        "completed": 1
      },
      "ad_groups": {
        "total": 12,
        "active": 8,
        "paused": 4
      },
      "ads": {
        "total": 25,
        "active": 18,
        "paused": 5,
        "rejected": 2
      },
      "budget": {
        "total_budget": 5000.00,
        "daily_budget": 250.00,
        "currency": "USD"
      },
      "last_updated": "2026-03-11T12:34:56.789Z",
      "account_id": "a2_ine5sw3w9d9n"
    }
  },
  "meta": {
    "fetched_at": "2026-03-11T12:34:56.789Z",
    "account_id": "a2_ine5sw3w9d9n", 
    "api_version": "v3",
    "endpoints_called": 3,
    "errors": []
  }
}
```

## 🚀 Deployment

### 1. Environment Variables

Set the Reddit Ads API token in Netlify:

```bash
# Via Netlify CLI
netlify env:set REDDIT_TOKEN "your_reddit_ads_bearer_token"

# Or via Netlify dashboard:
# Site Settings → Environment Variables → Add variable
# Key: REDDIT_TOKEN
# Value: your_reddit_ads_bearer_token
```

### 2. Deploy to Netlify

```bash
# Install dependencies
npm install

# Deploy to Netlify
netlify deploy --prod

# Or connect your git repo for automatic deployments
```

### 3. Netlify Configuration

The `netlify.toml` configures:
- Static site deployment (no build step)
- Functions directory: `netlify/functions`
- CORS headers for API endpoints
- Security headers for static files
- Environment variables

## 🧪 Testing

### Local Development

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Install dependencies  
npm install

# Set environment variable
export REDDIT_TOKEN="your_token"

# Start local development server
netlify dev

# Function will be available at:
# http://localhost:8888/.netlify/functions/reddit-ads-status
```

### Test Page

Open `test-reddit-ads.html` to test the integration:

```bash
# Serve locally
npx serve .

# Or open directly in browser:
open test-reddit-ads.html
```

## 📈 Usage in Factory Dashboard

### JavaScript Fetch

```javascript
async function getRedditAdsData() {
  try {
    const response = await fetch('/.netlify/functions/reddit-ads-status');
    const data = await response.json();
    
    if (data.success) {
      // Use data.data.campaigns, data.data.ad_groups, data.data.ads
      // Use data.data.summary for dashboard metrics
      updateDashboard(data.data);
    } else {
      console.error('API Error:', data.message);
    }
  } catch (error) {
    console.error('Network Error:', error);
  }
}

// Call every 5 minutes for live updates
setInterval(getRedditAdsData, 5 * 60 * 1000);
```

### Dashboard Integration

```javascript
function updateDashboard(adsData) {
  // Update campaign status cards
  document.getElementById('total-campaigns').textContent = adsData.summary.campaigns.total;
  document.getElementById('active-campaigns').textContent = adsData.summary.campaigns.active;
  
  // Update budget display
  document.getElementById('total-budget').textContent = `$${adsData.summary.budget.total_budget.toFixed(2)}`;
  document.getElementById('daily-budget').textContent = `$${adsData.summary.budget.daily_budget.toFixed(2)}`;
  
  // Update charts/graphs with campaign performance
  updateCampaignChart(adsData.campaigns);
  
  // Update last updated timestamp
  document.getElementById('last-updated').textContent = new Date(adsData.summary.last_updated).toLocaleString();
}
```

## ⚡ Performance & Caching

- **Response Caching:** 5 minutes (`Cache-Control: public, max-age=300`)
- **Timeout:** 10 seconds per Reddit API call
- **Concurrent Requests:** All 3 endpoints called simultaneously
- **Error Handling:** Partial failures handled gracefully
- **CORS:** Enabled for cross-origin requests

## 🔒 Security

- **Authentication:** Reddit Ads API Bearer token (server-side only)
- **CORS:** Configured for dashboard domain
- **Headers:** Required Reddit Ads API headers included
- **Rate Limiting:** Respects Reddit API rate limits
- **Error Handling:** No sensitive data exposed in error responses

## 🐛 Error Handling

The function handles various error scenarios:

- **Missing Token:** Returns 500 with configuration error
- **API Timeouts:** 10-second timeout per endpoint
- **Partial Failures:** If one endpoint fails, others still return data
- **Authentication Errors:** Properly formatted error responses
- **Network Issues:** Graceful error handling with details

## 📊 Monitoring

Monitor function performance via:

1. **Netlify Functions Dashboard:** Execution logs and metrics
2. **Console Logs:** Detailed request/response logging
3. **Error Tracking:** All errors logged with context
4. **Response Times:** Monitor API call latency

## 🔄 Updates

To update the function:

1. Modify `netlify/functions/reddit-ads-status.js`
2. Test locally with `netlify dev`
3. Deploy with `netlify deploy --prod`
4. Monitor function logs for any issues

---

## 📞 Support

**Integration Status:** ✅ **COMPLETE & READY**

- **Function:** Production-ready Netlify function
- **API:** Reddit Ads API v3 integration
- **Auth:** Bearer token authentication
- **Response:** Comprehensive campaign data + summary
- **Testing:** Full test page included
- **Documentation:** Complete integration guide

**Ready for deployment to https://buildjarvis-factory.netlify.app! 🚀**