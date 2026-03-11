require('dotenv').config();
const { Anthropic } = require('@anthropic-ai/sdk');
const fs = require('fs-extra');
const slugify = require('slugify');

class ProductGenerator {
  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async generateProduct(painPointDescription, options = {}) {
    console.log(`🎨 Generating product for: "${painPointDescription.substring(0, 100)}..."`);

    try {
      // Generate product concept
      const productConcept = await this.generateProductConcept(painPointDescription);
      console.log(`📝 Generated concept: ${productConcept.name}`);

      // Generate landing page HTML
      const landingPage = await this.generateLandingPage(productConcept, painPointDescription);
      console.log(`🌐 Generated landing page (${landingPage.length} chars)`);

      // Generate ad copy
      const adCopy = await this.generateAdCopy(productConcept, painPointDescription);
      console.log(`📢 Generated ad copy`);

      // Create slug for file naming
      const slug = slugify(productConcept.name, { lower: true, strict: true });

      const result = {
        id: `product_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        slug: slug,
        name: productConcept.name,
        tagline: productConcept.tagline,
        description: productConcept.description,
        target_audience: productConcept.target_audience,
        pricing: productConcept.pricing,
        features: productConcept.features,
        landing_page_html: landingPage,
        ad_copy: adCopy,
        original_pain_point: painPointDescription,
        generated_at: new Date().toISOString()
      };

      return result;

    } catch (error) {
      console.error('❌ Product generation failed:', error.message);
      throw error;
    }
  }

  async generateProductConcept(painPoint) {
    const prompt = `You are a product strategist and entrepreneur. Based on this pain point from Reddit, create a viable SaaS product concept.

Pain Point: "${painPoint}"

Generate a product concept with:
1. Product name (2-4 words, memorable, brandable)
2. Tagline (under 10 words, clear value proposition)
3. Description (2-3 sentences explaining what it does)
4. Target audience (specific user type)
5. Pricing (simple tier: $9-99/month)
6. 3-5 key features

Respond in this exact JSON format:
{
  "name": "Product Name",
  "tagline": "Clear tagline",
  "description": "What the product does and how it solves the pain point",
  "target_audience": "Specific user type",
  "pricing": "$X/month",
  "features": [
    "Feature 1 description",
    "Feature 2 description",
    "Feature 3 description"
  ]
}`;

    const message = await this.anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    });

    try {
      return JSON.parse(message.content[0].text);
    } catch (parseError) {
      console.error('Failed to parse product concept JSON:', message.content[0].text);
      throw new Error('Invalid JSON response from AI');
    }
  }

  async generateLandingPage(productConcept, painPoint) {
    const prompt = `Create a complete HTML landing page for this SaaS product. Use a dark theme, modern design, and make it conversion-focused.

Product: ${productConcept.name}
Tagline: ${productConcept.tagline}
Description: ${productConcept.description}
Features: ${productConcept.features.join(', ')}
Pricing: ${productConcept.pricing}
Target Audience: ${productConcept.target_audience}

Requirements:
- Complete HTML with embedded CSS
- Dark theme (dark backgrounds, light text)
- Modern, clean design with good typography
- Responsive (mobile-friendly)
- Include sections: Hero, Features, Pricing, CTA
- Use a placeholder checkout button: <button id="checkout-btn">Get Started - ${productConcept.pricing}</button>
- Include meta tags and OpenGraph tags
- Use modern CSS (flexbox/grid, smooth animations)
- Professional and trustworthy appearance
- Strong call-to-action throughout

Return complete HTML code only:`;

    const message = await this.anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 4000,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    });

    let html = message.content[0].text;
    
    // Clean up HTML if wrapped in markdown
    html = html.replace(/```html\n?/, '').replace(/\n?```$/, '').trim();
    
    return html;
  }

  async generateAdCopy(productConcept, painPoint) {
    const prompt = `Create Reddit ad copy for this SaaS product. Make it native, helpful, and non-salesy.

Product: ${productConcept.name}
Tagline: ${productConcept.tagline}
Original Pain Point: "${painPoint}"

Create:
1. Headline (attention-grabbing, max 80 chars)
2. Body text (helpful, addresses pain point, max 200 chars)
3. CTA (action-oriented, max 20 chars)

Format as JSON:
{
  "headline": "Attention-grabbing headline",
  "body": "Body text that addresses the pain point naturally",
  "cta": "Try it free"
}`;

    const message = await this.anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    });

    try {
      return JSON.parse(message.content[0].text);
    } catch (parseError) {
      console.error('Failed to parse ad copy JSON:', message.content[0].text);
      return {
        headline: `${productConcept.name} - ${productConcept.tagline}`,
        body: productConcept.description,
        cta: "Get Started"
      };
    }
  }

  async generateBatch(painPoints, outputDir = './generated') {
    console.log(`🏭 Generating ${painPoints.length} products...`);
    
    await fs.ensureDir(outputDir);
    const results = [];
    const errors = [];

    for (let i = 0; i < painPoints.length; i++) {
      const painPoint = painPoints[i];
      console.log(`\n[${i + 1}/${painPoints.length}] Generating: ${painPoint.problem || painPoint}`);

      try {
        const problem = typeof painPoint === 'string' ? painPoint : painPoint.problem;
        const product = await this.generateProduct(problem);
        
        // Save individual files
        await this.saveProduct(product, outputDir);
        results.push(product);

        console.log(`✅ Generated: ${product.name}`);

      } catch (error) {
        console.error(`❌ Failed to generate product for pain point ${i + 1}:`, error.message);
        errors.push({
          pain_point: painPoint,
          error: error.message
        });
      }

      // Rate limiting
      await this.sleep(2000);
    }

    // Save batch results
    const batchResult = {
      generated_at: new Date().toISOString(),
      total_attempted: painPoints.length,
      successful: results.length,
      failed: errors.length,
      products: results,
      errors: errors
    };

    const batchPath = `${outputDir}/batch-results.json`;
    await fs.writeJson(batchPath, batchResult, { spaces: 2 });

    console.log(`\n🎉 Batch complete: ${results.length}/${painPoints.length} products generated`);
    console.log(`📄 Results saved to: ${batchPath}`);

    return batchResult;
  }

  async saveProduct(product, outputDir = './generated') {
    await fs.ensureDir(outputDir);

    // Save HTML landing page
    const htmlPath = `${outputDir}/${product.slug}.html`;
    await fs.writeFile(htmlPath, product.landing_page_html);

    // Save product data
    const jsonPath = `${outputDir}/${product.slug}.json`;
    await fs.writeJson(jsonPath, product, { spaces: 2 });

    console.log(`💾 Saved: ${htmlPath} and ${jsonPath}`);
    return { htmlPath, jsonPath };
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Standalone execution
async function main() {
  if (require.main === module) {
    try {
      const generator = new ProductGenerator();
      
      // Check for pain point file or direct input
      const painPointArg = process.argv[2];
      
      if (!painPointArg) {
        console.log('Usage: node generator.js "pain point description"');
        console.log('   or: node generator.js pain-points.json');
        process.exit(1);
      }

      if (painPointArg.endsWith('.json')) {
        // Batch mode
        const painPointsData = await fs.readJson(painPointArg);
        const painPoints = painPointsData.pain_points || painPointsData;
        await generator.generateBatch(painPoints);
      } else {
        // Single mode
        const product = await generator.generateProduct(painPointArg);
        await generator.saveProduct(product);
        console.log(`✅ Generated: ${product.name} - ${product.tagline}`);
      }

    } catch (error) {
      console.error('❌ Generation failed:', error.message);
      process.exit(1);
    }
  }
}

main();

module.exports = { ProductGenerator };