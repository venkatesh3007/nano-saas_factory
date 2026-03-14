require('dotenv').config();
const axios = require('axios');
const fs = require('fs-extra');

// Hardcoded fallback pain points - real developer problems solvable with a single function
const FALLBACK_PAIN_POINTS = [
  { id: 'csv-to-json', problem: 'Convert CSV to JSON', category: 'data-conversion', difficulty: 'easy', estimated_value: 5 },
  { id: 'json-to-csv', problem: 'Convert JSON to CSV', category: 'data-conversion', difficulty: 'easy', estimated_value: 5 },
  { id: 'regex-generator', problem: 'Generate regex from natural language description', category: 'developer-tools', difficulty: 'medium', estimated_value: 8 },
  { id: 'sql-formatter', problem: 'Format and beautify SQL queries', category: 'developer-tools', difficulty: 'easy', estimated_value: 5 },
  { id: 'js-minifier', problem: 'Minify JavaScript code', category: 'developer-tools', difficulty: 'easy', estimated_value: 5 },
  { id: 'markdown-to-html', problem: 'Convert Markdown to styled HTML', category: 'content', difficulty: 'easy', estimated_value: 5 },
  { id: 'gitignore-generator', problem: 'Generate .gitignore for any tech stack', category: 'developer-tools', difficulty: 'easy', estimated_value: 5 },
  { id: 'cron-expression', problem: 'Create cron expressions from natural language', category: 'developer-tools', difficulty: 'medium', estimated_value: 8 },
  { id: 'color-palette', problem: 'Generate color palettes from a base color', category: 'design', difficulty: 'medium', estimated_value: 8 },
  { id: 'json-validator', problem: 'Validate and format JSON with error highlighting', category: 'developer-tools', difficulty: 'easy', estimated_value: 5 },
  { id: 'base64-toolkit', problem: 'Encode/decode Base64 strings and files', category: 'developer-tools', difficulty: 'easy', estimated_value: 5 },
  { id: 'api-mock-generator', problem: 'Generate mock API responses from a schema', category: 'developer-tools', difficulty: 'medium', estimated_value: 10 },
  { id: 'dockerfile-generator', problem: 'Generate Dockerfile from project description', category: 'devops', difficulty: 'medium', estimated_value: 10 },
  { id: 'readme-generator', problem: 'Generate README.md from code or project description', category: 'documentation', difficulty: 'medium', estimated_value: 8 },
  { id: 'env-file-generator', problem: 'Generate .env file template from code analysis', category: 'developer-tools', difficulty: 'medium', estimated_value: 8 },
  { id: 'jwt-decoder', problem: 'Decode and inspect JWT tokens', category: 'security', difficulty: 'easy', estimated_value: 5 },
  { id: 'html-to-markdown', problem: 'Convert HTML to clean Markdown', category: 'content', difficulty: 'easy', estimated_value: 5 },
  { id: 'og-image-generator', problem: 'Generate Open Graph meta tags and preview', category: 'marketing', difficulty: 'medium', estimated_value: 8 },
  { id: 'license-picker', problem: 'Choose and generate the right open source license', category: 'legal', difficulty: 'easy', estimated_value: 5 },
  { id: 'commit-message', problem: 'Generate conventional commit messages from diff description', category: 'developer-tools', difficulty: 'medium', estimated_value: 8 },
];

class RedditScout {
  constructor() {
    this.clientId = process.env.REDDIT_CLIENT_ID;
    this.clientSecret = process.env.REDDIT_CLIENT_SECRET;
    this.userAgent = process.env.REDDIT_USER_AGENT || 'factory-scout/2.0.0';
    this.accessToken = null;

    this.painPointPatterns = [
      'I wish there was a tool',
      'would pay for',
      'anyone know a tool that',
      'need a solution for',
      'looking for a tool',
    ];

    this.targetSubreddits = [
      'Entrepreneur', 'startups', 'SaaS', 'webdev',
      'programming', 'freelance', 'smallbusiness', 'solopreneur',
    ];
  }

  async authenticate() {
    try {
      const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
      const response = await axios.post('https://www.reddit.com/api/v1/access_token',
        'grant_type=client_credentials',
        {
          headers: {
            'Authorization': `Basic ${credentials}`,
            'User-Agent': this.userAgent,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          timeout: 10000
        }
      );
      this.accessToken = response.data.access_token;
      console.log('🔑 Reddit API authenticated');
      return true;
    } catch (error) {
      console.warn('⚠️ Reddit auth failed, will use fallback pain points');
      return false;
    }
  }

  async searchSubreddit(subreddit, query, limit = 10) {
    try {
      const response = await axios.get(`https://oauth.reddit.com/r/${subreddit}/search`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'User-Agent': this.userAgent
        },
        params: { q: query, restrict_sr: 'true', sort: 'relevance', t: 'month', limit },
        timeout: 10000
      });
      return response.data.data.children.map(post => ({
        id: post.data.id,
        title: post.data.title,
        selftext: post.data.selftext,
        subreddit: post.data.subreddit,
        score: post.data.score,
        num_comments: post.data.num_comments,
        url: `https://reddit.com${post.data.permalink}`,
      }));
    } catch (error) {
      return [];
    }
  }

  async scoutPainPoints(maxResults = 10) {
    console.log(`🔍 Scouting for ${maxResults} pain points...`);

    // Try Reddit first
    const authenticated = await this.authenticate();
    if (authenticated) {
      try {
        const allPainPoints = [];
        for (const subreddit of this.targetSubreddits.slice(0, 3)) {
          for (const pattern of this.painPointPatterns.slice(0, 2)) {
            const posts = await this.searchSubreddit(subreddit, pattern, 5);
            for (const post of posts) {
              allPainPoints.push({
                id: `reddit_${post.subreddit}_${post.id}`,
                problem: post.title.substring(0, 150),
                category: 'reddit-discovered',
                difficulty: 'medium',
                estimated_value: Math.min(15, Math.max(5, Math.round(post.score / 10) + 5)),
                source: 'reddit',
                url: post.url,
              });
            }
            await new Promise(r => setTimeout(r, 500));
          }
        }
        if (allPainPoints.length >= maxResults) {
          const results = allPainPoints.slice(0, maxResults);
          console.log(`✅ Found ${results.length} pain points from Reddit`);
          return results;
        }
      } catch (err) {
        console.warn('⚠️ Reddit scouting failed, using fallback');
      }
    }

    // Fallback to curated list
    console.log('📋 Using curated fallback pain points');
    const shuffled = [...FALLBACK_PAIN_POINTS].sort(() => Math.random() - 0.5);
    const results = shuffled.slice(0, maxResults).map(p => ({
      ...p,
      source: 'curated',
      extracted_at: new Date().toISOString(),
    }));
    console.log(`✅ Selected ${results.length} curated pain points`);
    return results;
  }

  async savePainPoints(painPoints, filename = 'pain-points.json') {
    const outputPath = `./generated/${filename}`;
    await fs.ensureDir('./generated');
    await fs.writeJson(outputPath, {
      generated_at: new Date().toISOString(),
      total_count: painPoints.length,
      pain_points: painPoints
    }, { spaces: 2 });
    console.log(`💾 Saved ${painPoints.length} pain points to ${outputPath}`);
    return outputPath;
  }
}

if (require.main === module) {
  (async () => {
    const scout = new RedditScout();
    const count = process.argv[2] ? parseInt(process.argv[2]) : 5;
    const painPoints = await scout.scoutPainPoints(count);
    await scout.savePainPoints(painPoints);
    painPoints.forEach((p, i) => console.log(`${i + 1}. [${p.category}] ${p.problem}`));
  })().catch(err => { console.error('❌', err.message); process.exit(1); });
}

module.exports = { RedditScout };
