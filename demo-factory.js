#!/usr/bin/env node

require('dotenv').config();
const fs = require('fs-extra');

class DemoFactory {
  constructor() {
    this.outputDir = './generated';
  }

  async runDemo(count = 3) {
    console.log('🏭 THE FACTORY - DEMO MODE');
    console.log('=' .repeat(60));
    console.log('🎯 Simulating complete pipeline without external APIs');
    console.log(`📁 Output: ${this.outputDir}`);
    console.log('=' .repeat(60));

    await fs.ensureDir(this.outputDir);

    // Demo pain points (simulated Reddit data)
    const demoPainPoints = [
      {
        id: "entrepreneur_demo1",
        problem: "I wish there was a tool that automatically tracks my freelance expenses and categorizes them for taxes",
        score: 85,
        upvotes: 47,
        comments: 23,
        subreddit: "Entrepreneur"
      },
      {
        id: "productivity_demo2", 
        problem: "Need a solution for managing multiple social media accounts without switching between apps",
        score: 92,
        upvotes: 156,
        comments: 45,
        subreddit: "productivity"
      },
      {
        id: "saas_demo3",
        problem: "Would pay for a tool that automatically generates professional invoices from project data",
        score: 78,
        upvotes: 89,
        comments: 34,
        subreddit: "SaaS"
      }
    ];

    console.log('\n🔍 PHASE 1: Pain Point Discovery (Simulated)');
    const selectedPainPoints = demoPainPoints.slice(0, count);
    console.log(`✅ Found ${selectedPainPoints.length} validated pain points`);
    
    await fs.writeJson(`${this.outputDir}/demo-pain-points.json`, {
      generated_at: new Date().toISOString(),
      total_count: selectedPainPoints.length,
      pain_points: selectedPainPoints
    }, { spaces: 2 });

    // Demo products (simulated AI generation)
    const demoProducts = this.generateDemoProducts(selectedPainPoints);

    console.log('\n🎨 PHASE 2: Product Generation (Simulated)');
    console.log(`✅ Generated ${demoProducts.length} complete products with AI`);

    // Save demo products
    for (const product of demoProducts) {
      await this.saveProduct(product);
    }

    // Demo deployments (simulated)
    console.log('\n🚀 PHASE 3: Deployment (Simulated)');
    const demoDeployments = this.generateDemoDeployments(demoProducts);
    
    await fs.writeJson(`${this.outputDir}/demo-deployments.json`, {
      deployed_at: new Date().toISOString(),
      deployments: demoDeployments
    }, { spaces: 2 });

    console.log(`✅ Deployed ${demoDeployments.length} products to live URLs`);

    this.displayResults(selectedPainPoints, demoProducts, demoDeployments);

    return {
      pain_points: selectedPainPoints,
      products: demoProducts,
      deployments: demoDeployments
    };
  }

  generateDemoProducts(painPoints) {
    const products = [
      {
        id: "product_demo_1",
        slug: "taxflow-pro",
        name: "TaxFlow Pro",
        tagline: "Automated expense tracking for freelancers",
        description: "Stop losing money on missed deductions. TaxFlow Pro automatically tracks, categorizes, and optimizes your freelance expenses for maximum tax savings.",
        target_audience: "Freelancers and independent contractors",
        pricing: "$19/month",
        features: [
          "Automatic expense detection from bank accounts",
          "Smart tax category assignment",
          "Real-time deduction optimization",
          "Export to popular tax software",
          "Receipt photo scanning and storage"
        ],
        landing_page_html: this.generateLandingPageHtml("TaxFlow Pro", "$19/month"),
        ad_copy: {
          headline: "Stop losing money on missed tax deductions",
          body: "TaxFlow Pro automatically tracks every freelance expense and maximizes your tax savings. Save hours and hundreds of dollars.",
          cta: "Start Free Trial"
        },
        original_pain_point: painPoints[0]?.problem
      },
      {
        id: "product_demo_2", 
        slug: "social-commander",
        name: "Social Commander",
        tagline: "All your social media accounts in one dashboard",
        description: "Manage Instagram, Twitter, LinkedIn, and Facebook from a single, powerful dashboard. Schedule posts, track engagement, and grow your audience effortlessly.",
        target_audience: "Small business owners and content creators",
        pricing: "$29/month",
        features: [
          "Unified social media dashboard",
          "Advanced post scheduling",
          "Cross-platform analytics",
          "Team collaboration tools",
          "AI-powered content suggestions"
        ],
        landing_page_html: this.generateLandingPageHtml("Social Commander", "$29/month"),
        ad_copy: {
          headline: "Manage all social media from one place",
          body: "Stop switching between apps. Social Commander gives you a unified dashboard for all your social accounts with powerful scheduling and analytics.",
          cta: "Try Free for 14 Days"
        },
        original_pain_point: painPoints[1]?.problem
      },
      {
        id: "product_demo_3",
        slug: "invoice-genie",
        name: "Invoice Genie",
        tagline: "Professional invoices generated automatically",
        description: "Transform your project data into beautiful, professional invoices instantly. Smart automation ensures you never miss a billable hour or expense.",
        target_audience: "Consultants and service providers",
        pricing: "$15/month", 
        features: [
          "Automatic invoice generation from time tracking",
          "Professional templates and branding",
          "Payment tracking and reminders",
          "Client portal for easy payments",
          "Integration with popular project tools"
        ],
        landing_page_html: this.generateLandingPageHtml("Invoice Genie", "$15/month"),
        ad_copy: {
          headline: "Never write another invoice manually",
          body: "Invoice Genie automatically creates professional invoices from your project data. Get paid faster with automated billing.",
          cta: "Generate Free Invoice"
        },
        original_pain_point: painPoints[2]?.problem
      }
    ];

    return products.slice(0, painPoints.length);
  }

  generateLandingPageHtml(productName, pricing) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${productName} - Solve Your Business Pain Points</title>
    <meta name="description" content="${productName} - Generated by The Factory autonomous product validation engine">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0f0f0f;
            color: #ffffff;
            line-height: 1.6;
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 0 20px; }
        .hero {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 100px 0;
            text-align: center;
        }
        .hero h1 { font-size: 3.5rem; font-weight: 700; margin-bottom: 20px; }
        .hero p { font-size: 1.3rem; margin-bottom: 40px; opacity: 0.9; }
        .cta-button {
            background: #6366f1;
            color: white;
            padding: 15px 40px;
            border-radius: 8px;
            text-decoration: none;
            font-size: 1.1rem;
            font-weight: 600;
            display: inline-block;
            transition: all 0.3s ease;
        }
        .cta-button:hover { background: #5855f7; transform: translateY(-2px); }
        .features {
            background: #1a1a1a;
            padding: 80px 0;
        }
        .features h2 { text-align: center; font-size: 2.5rem; margin-bottom: 60px; }
        .feature-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 40px; }
        .feature-card {
            background: #2a2a2a;
            padding: 40px;
            border-radius: 12px;
            border: 1px solid #333;
        }
        .feature-card h3 { font-size: 1.5rem; margin-bottom: 15px; color: #6366f1; }
        .pricing {
            background: #0f0f0f;
            padding: 80px 0;
            text-align: center;
        }
        .pricing h2 { font-size: 2.5rem; margin-bottom: 40px; }
        .price-tag { font-size: 3rem; font-weight: 700; color: #6366f1; margin-bottom: 30px; }
        .footer { background: #1a1a1a; padding: 40px 0; text-align: center; border-top: 1px solid #333; }
        @media (max-width: 768px) {
            .hero h1 { font-size: 2.5rem; }
            .hero p { font-size: 1.1rem; }
            .feature-grid { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <section class="hero">
        <div class="container">
            <h1>${productName}</h1>
            <p>The solution you've been waiting for</p>
            <a href="#" id="checkout-btn" class="cta-button">Get Started - ${pricing}</a>
        </div>
    </section>

    <section class="features">
        <div class="container">
            <h2>Why Choose ${productName}?</h2>
            <div class="feature-grid">
                <div class="feature-card">
                    <h3>🚀 Fast Setup</h3>
                    <p>Get started in minutes with our intuitive onboarding process.</p>
                </div>
                <div class="feature-card">
                    <h3>🎯 Precision Tools</h3>
                    <p>Built specifically for your use case with advanced features.</p>
                </div>
                <div class="feature-card">
                    <h3>📊 Analytics</h3>
                    <p>Track your progress with detailed insights and reporting.</p>
                </div>
            </div>
        </div>
    </section>

    <section class="pricing">
        <div class="container">
            <h2>Simple, Transparent Pricing</h2>
            <div class="price-tag">${pricing}</div>
            <a href="#" class="cta-button">Start Your Free Trial</a>
        </div>
    </section>

    <footer class="footer">
        <div class="container">
            <p>&copy; 2026 ${productName} - Generated by The Factory</p>
        </div>
    </footer>
</body>
</html>`;
  }

  generateDemoDeployments(products) {
    return products.map((product, index) => ({
      id: product.id,
      slug: product.slug,
      name: product.name,
      live_url: `https://${product.slug}-factory.netlify.app`,
      checkout_url: `https://buy.stripe.com/test_${product.slug}_${Date.now()}`,
      polar_product_id: `polar_${product.slug}`,
      deployed_at: new Date().toISOString(),
      status: 'live'
    }));
  }

  async saveProduct(product) {
    // Save HTML landing page
    const htmlPath = `${this.outputDir}/${product.slug}.html`;
    await fs.writeFile(htmlPath, product.landing_page_html);

    // Save product data
    const jsonPath = `${this.outputDir}/${product.slug}.json`;
    await fs.writeJson(jsonPath, product, { spaces: 2 });

    console.log(`💾 Saved: ${product.name}`);
  }

  displayResults(painPoints, products, deployments) {
    console.log('\n🎉 FACTORY DEMO COMPLETE');
    console.log('=' .repeat(60));
    console.log(`🔍 Pain points discovered: ${painPoints.length}`);
    console.log(`🎨 Products generated: ${products.length}`);
    console.log(`🚀 Products deployed: ${deployments.length}`);
    
    console.log('\n🌐 Live Demo Products:');
    deployments.forEach((dep, i) => {
      console.log(`${i + 1}. ${dep.name}`);
      console.log(`   🔗 ${dep.live_url}`);
      console.log(`   💰 ${dep.checkout_url}`);
    });

    console.log('\n📄 Generated Files:');
    products.forEach((product, i) => {
      console.log(`${i + 1}. ${this.outputDir}/${product.slug}.html`);
      console.log(`   ${this.outputDir}/${product.slug}.json`);
    });
    
    console.log('\n💡 Demo shows complete pipeline:');
    console.log('   • Reddit pain point discovery');
    console.log('   • AI product generation'); 
    console.log('   • Automated deployment & monetization');
    console.log('   • Professional landing pages');
    console.log('   • Real checkout integration');
    console.log('=' .repeat(60));
  }
}

// CLI execution
async function main() {
  const count = process.argv[2] ? parseInt(process.argv[2]) : 3;
  const demo = new DemoFactory();
  await demo.runDemo(count);
}

if (require.main === module) {
  main();
}

module.exports = { DemoFactory };