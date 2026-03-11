require('dotenv').config();
const axios = require('axios');
const fs = require('fs-extra');
const moment = require('moment');

class RedditScout {
  constructor() {
    this.clientId = process.env.REDDIT_CLIENT_ID;
    this.clientSecret = process.env.REDDIT_CLIENT_SECRET;
    this.userAgent = process.env.REDDIT_USER_AGENT || 'factory-scout/1.0.0';
    this.accessToken = null;
    
    this.painPointPatterns = [
      'I wish there was a tool',
      'would pay for',
      'anyone know a tool that',
      'need a solution for',
      'looking for a tool',
      'wish someone would build',
      'would love an app',
      'is there an app',
      'need something that',
      'frustrated with',
      'hate having to',
      'tired of',
      'pain point',
      'problem with'
    ];

    this.targetSubreddits = [
      'Entrepreneur',
      'startups',
      'SaaS',
      'productivity',
      'webdev',
      'programming',
      'marketing',
      'freelance',
      'smallbusiness',
      'solopreneur',
      'indiehackers'
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
          }
        }
      );

      this.accessToken = response.data.access_token;
      console.log('🔑 Reddit API authenticated successfully');
      return true;
    } catch (error) {
      console.error('❌ Reddit authentication failed:', error.response?.data || error.message);
      return false;
    }
  }

  async searchSubreddit(subreddit, query, limit = 25) {
    try {
      const response = await axios.get(`https://oauth.reddit.com/r/${subreddit}/search`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'User-Agent': this.userAgent
        },
        params: {
          q: query,
          restrict_sr: 'true',
          sort: 'relevance',
          t: 'month', // Last month
          limit: limit
        }
      });

      return response.data.data.children.map(post => ({
        id: post.data.id,
        title: post.data.title,
        selftext: post.data.selftext,
        subreddit: post.data.subreddit,
        author: post.data.author,
        score: post.data.score,
        num_comments: post.data.num_comments,
        created_utc: post.data.created_utc,
        url: `https://reddit.com${post.data.permalink}`,
        upvote_ratio: post.data.upvote_ratio
      }));
    } catch (error) {
      console.error(`❌ Error searching r/${subreddit}:`, error.response?.data || error.message);
      return [];
    }
  }

  async scoutPainPoints(maxResults = 50) {
    console.log('🔍 Starting Reddit pain point scouting...');
    
    if (!await this.authenticate()) {
      throw new Error('Failed to authenticate with Reddit API');
    }

    const allPainPoints = [];

    // Search each subreddit for each pain point pattern
    for (const subreddit of this.targetSubreddits) {
      console.log(`📡 Scouting r/${subreddit}...`);
      
      for (const pattern of this.painPointPatterns.slice(0, 3)) { // Limit to top 3 patterns per subreddit
        const posts = await this.searchSubreddit(subreddit, pattern, 10);
        
        for (const post of posts) {
          // Filter and score pain points
          const painPoint = this.extractPainPoint(post, pattern);
          if (painPoint) {
            allPainPoints.push(painPoint);
          }
        }

        // Rate limiting - wait between requests
        await this.sleep(500);
      }

      await this.sleep(1000); // Longer wait between subreddits
    }

    // Remove duplicates and rank by score
    const uniquePainPoints = this.deduplicateAndRank(allPainPoints);
    
    // Limit to maxResults
    const topPainPoints = uniquePainPoints.slice(0, maxResults);

    console.log(`✅ Found ${topPainPoints.length} validated pain points`);
    return topPainPoints;
  }

  extractPainPoint(post, pattern) {
    const text = `${post.title} ${post.selftext}`.toLowerCase();
    
    // Check if post contains pain point indicators
    if (!text.includes(pattern.toLowerCase())) {
      return null;
    }

    // Calculate pain point score
    const score = this.calculatePainPointScore(post);
    
    // Extract problem description
    const problemDescription = this.extractProblemDescription(post, pattern);

    if (!problemDescription || problemDescription.length < 20) {
      return null; // Skip too short descriptions
    }

    return {
      id: `${post.subreddit}_${post.id}`,
      problem: problemDescription,
      original_title: post.title,
      original_text: post.selftext.substring(0, 500), // Truncate long text
      subreddit: post.subreddit,
      pattern_matched: pattern,
      score: score,
      upvotes: post.score,
      comments: post.num_comments,
      upvote_ratio: post.upvote_ratio,
      age_days: moment().diff(moment.unix(post.created_utc), 'days'),
      url: post.url,
      extracted_at: new Date().toISOString()
    };
  }

  extractProblemDescription(post, pattern) {
    const fullText = `${post.title} ${post.selftext}`;
    
    // Try to extract sentence containing the pattern
    const sentences = fullText.split(/[.!?]+/);
    const matchingSentence = sentences.find(sentence => 
      sentence.toLowerCase().includes(pattern.toLowerCase())
    );

    if (matchingSentence) {
      return matchingSentence.trim().substring(0, 200);
    }

    // Fallback to title if no good sentence found
    return post.title.substring(0, 150);
  }

  calculatePainPointScore(post) {
    const ageInDays = moment().diff(moment.unix(post.created_utc), 'days');
    const ageFactor = Math.max(0, 1 - (ageInDays / 30)); // Fresher is better
    
    const scoreFactor = Math.log(Math.max(1, post.score)) / 10; // Logarithmic score
    const commentsFactor = Math.log(Math.max(1, post.num_comments)) / 5;
    const ratioFactor = post.upvote_ratio || 0.5;

    return Math.round((scoreFactor + commentsFactor + ageFactor + ratioFactor) * 100);
  }

  deduplicateAndRank(painPoints) {
    // Simple deduplication by problem similarity
    const unique = [];
    const seen = new Set();

    for (const painPoint of painPoints) {
      const key = painPoint.problem.toLowerCase().substring(0, 50);
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(painPoint);
      }
    }

    // Sort by score (highest first)
    return unique.sort((a, b) => b.score - a.score);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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

// Standalone execution
async function main() {
  if (require.main === module) {
    try {
      const scout = new RedditScout();
      const count = process.argv[2] ? parseInt(process.argv[2]) : 10;
      
      console.log(`🚀 Scouting for top ${count} pain points...`);
      const painPoints = await scout.scoutPainPoints(count);
      await scout.savePainPoints(painPoints);
      
      // Display top 5
      console.log('\n🎯 Top 5 Pain Points Found:');
      painPoints.slice(0, 5).forEach((point, index) => {
        console.log(`${index + 1}. Score: ${point.score} | ${point.problem}`);
      });

    } catch (error) {
      console.error('❌ Scout failed:', error.message);
      process.exit(1);
    }
  }
}

main();

module.exports = { RedditScout };