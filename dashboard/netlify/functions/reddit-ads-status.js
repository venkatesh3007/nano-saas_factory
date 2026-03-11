const axios = require('axios');

// Reddit Ads API configuration
const REDDIT_ADS_BASE = 'https://ads-api.reddit.com';
const AD_ACCOUNT_ID = 'a2_ine5sw3w9d9n';

// API endpoints
const ENDPOINTS = {
  campaigns: `/api/v3/ad_accounts/${AD_ACCOUNT_ID}/campaigns`,
  ad_groups: `/api/v3/ad_accounts/${AD_ACCOUNT_ID}/ad_groups`, 
  ads: `/api/v3/ad_accounts/${AD_ACCOUNT_ID}/ads`
};

// Required headers for Reddit Ads API
const getHeaders = (token) => ({
  'Authorization': `Bearer ${token}`,
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Origin': 'https://ads.reddit.com',
  'Referer': 'https://ads.reddit.com/',
  'Accept': 'application/json',
  'Content-Type': 'application/json'
});

// Fetch data from Reddit Ads API
async function fetchRedditAdsData(endpoint, token) {
  try {
    const url = `${REDDIT_ADS_BASE}${endpoint}`;
    console.log(`Fetching: ${url}`);
    
    const response = await axios.get(url, {
      headers: getHeaders(token),
      timeout: 10000 // 10 second timeout
    });
    
    return response.data;
  } catch (error) {
    console.error(`Error fetching ${endpoint}:`, error.response?.status, error.response?.data || error.message);
    throw {
      endpoint,
      status: error.response?.status || 500,
      message: error.response?.data?.message || error.message,
      details: error.response?.data
    };
  }
}

// Calculate summary statistics
function calculateSummary(campaigns, adGroups, ads) {
  const summary = {
    campaigns: {
      total: campaigns.length,
      active: campaigns.filter(c => c.status === 'ACTIVE' || c.status === 'RUNNING').length,
      paused: campaigns.filter(c => c.status === 'PAUSED').length,
      completed: campaigns.filter(c => c.status === 'COMPLETED' || c.status === 'ENDED').length
    },
    ad_groups: {
      total: adGroups.length,
      active: adGroups.filter(ag => ag.status === 'ACTIVE' || ag.status === 'RUNNING').length,
      paused: adGroups.filter(ag => ag.status === 'PAUSED').length
    },
    ads: {
      total: ads.length,
      active: ads.filter(ad => ad.status === 'ACTIVE' || ad.status === 'RUNNING').length,
      paused: ads.filter(ad => ad.status === 'PAUSED').length,
      rejected: ads.filter(ad => ad.status === 'REJECTED').length
    },
    budget: {
      total_budget: campaigns.reduce((sum, c) => sum + (parseFloat(c.total_budget) || 0), 0),
      daily_budget: campaigns.reduce((sum, c) => sum + (parseFloat(c.daily_budget) || 0), 0),
      currency: campaigns[0]?.currency || 'USD'
    },
    last_updated: new Date().toISOString(),
    account_id: AD_ACCOUNT_ID
  };

  return summary;
}

// Main Netlify Function handler
exports.handler = async (event, context) => {
  // Enable CORS
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Method not allowed',
        allowed_methods: ['GET'] 
      })
    };
  }

  try {
    // Get Reddit token from environment variables
    const token = process.env.REDDIT_TOKEN;
    
    if (!token) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Configuration error',
          message: 'REDDIT_TOKEN environment variable not configured'
        })
      };
    }

    console.log('Starting Reddit Ads API data fetch...');
    
    // Fetch data from all 3 endpoints concurrently
    const [campaignsData, adGroupsData, adsData] = await Promise.allSettled([
      fetchRedditAdsData(ENDPOINTS.campaigns, token),
      fetchRedditAdsData(ENDPOINTS.ad_groups, token),
      fetchRedditAdsData(ENDPOINTS.ads, token)
    ]);

    // Process results and handle errors
    const results = {
      campaigns: [],
      ad_groups: [],
      ads: [],
      errors: []
    };

    if (campaignsData.status === 'fulfilled') {
      results.campaigns = campaignsData.value?.data || campaignsData.value || [];
    } else {
      results.errors.push({ endpoint: 'campaigns', error: campaignsData.reason });
    }

    if (adGroupsData.status === 'fulfilled') {
      results.ad_groups = adGroupsData.value?.data || adGroupsData.value || [];
    } else {
      results.errors.push({ endpoint: 'ad_groups', error: adGroupsData.reason });
    }

    if (adsData.status === 'fulfilled') {
      results.ads = adsData.value?.data || adsData.value || [];
    } else {
      results.errors.push({ endpoint: 'ads', error: adsData.reason });
    }

    // Calculate summary statistics
    const summary = calculateSummary(results.campaigns, results.ad_groups, results.ads);

    // Prepare response
    const response = {
      success: true,
      data: {
        campaigns: results.campaigns,
        ad_groups: results.ad_groups,
        ads: results.ads,
        summary: summary
      },
      meta: {
        fetched_at: new Date().toISOString(),
        account_id: AD_ACCOUNT_ID,
        api_version: 'v3',
        endpoints_called: Object.keys(ENDPOINTS).length,
        errors: results.errors
      }
    };

    console.log(`Reddit Ads data fetch complete. Campaigns: ${results.campaigns.length}, Ad Groups: ${results.ad_groups.length}, Ads: ${results.ads.length}`);

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
      },
      body: JSON.stringify(response, null, 2)
    };

  } catch (error) {
    console.error('Reddit Ads API integration error:', error);

    const errorResponse = {
      success: false,
      error: 'Reddit Ads API integration failed',
      message: error.message || 'Unknown error occurred',
      details: error.details || null,
      timestamp: new Date().toISOString()
    };

    return {
      statusCode: error.status || 500,
      headers: corsHeaders,
      body: JSON.stringify(errorResponse, null, 2)
    };
  }
};