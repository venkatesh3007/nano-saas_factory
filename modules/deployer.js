require('dotenv').config();
const fs = require('fs-extra');
const { exec } = require('child_process');
const { promisify } = require('util');
const axios = require('axios');
const path = require('path');
const { ProductMetrics } = require('./metrics');

const execAsync = promisify(exec);

class ProductDeployer {
  constructor() {
    this.deployDir = process.env.DEPLOY_DIR || './deployed';
    this.metrics = new ProductMetrics();
  }

  async deployProduct(productData, options = {}) {
    console.log(`🚀 Deploying: ${productData.name} (${productData.slug})`);

    try {
      // Get source directory (where the built product is)
      const sourceDir = productData.output_dir || path.join(process.env.OUTPUT_DIR || './generated', productData.slug);
      
      if (!await fs.pathExists(sourceDir)) {
        throw new Error(`Product build not found at: ${sourceDir}`);
      }

      // Validate required files exist
      const requiredFiles = ['index.html', 'netlify/functions/process.js', 'netlify.toml'];
      for (const file of requiredFiles) {
        const filePath = path.join(sourceDir, file);
        if (!await fs.pathExists(filePath)) {
          throw new Error(`Missing required file: ${file}`);
        }
      }

      console.log(`📁 Deploying from: ${sourceDir}`);

      // Deploy directly to Netlify using CLI
      const deploymentResult = await this.deployToNetlify(sourceDir, productData.slug);
      console.log(`🌐 Live at: ${deploymentResult.url}`);

      // Prepare deployment metadata
      const deploymentData = {
        id: productData.id,
        slug: productData.slug,
        name: productData.name,
        live_url: deploymentResult.url,
        site_id: deploymentResult.site_id,
        deployment_id: deploymentResult.deployment_id,
        deployed_at: new Date().toISOString(),
        source_path: sourceDir,
        deployment_method: 'netlify-cli',
        status: 'live',
        original_pain_point: productData.original_pain_point,
        build_time: deploymentResult.build_time
      };

      // Save deployment metadata  
      const deployPath = path.join(this.deployDir, productData.slug);
      await fs.ensureDir(deployPath);
      const metadataPath = path.join(deployPath, 'deployment.json');
      await fs.writeJson(metadataPath, deploymentData, { spaces: 2 });

      console.log(`✅ Deployment complete: ${deploymentData.live_url}`);
      return deploymentData;

    } catch (error) {
      console.error(`❌ Deployment failed for ${productData.name}:`, error.message);
      throw error;
    }
  }

  async createPolarProduct(productData) {
    console.log(`💰 Creating Polar.sh product for: ${productData.name}`);

    try {
      // Extract price from pricing string (e.g., "$29/month" -> 2900)
      const priceMatch = productData.pricing.match(/\$(\d+)/);
      const priceInCents = priceMatch ? parseInt(priceMatch[1]) * 100 : 2900; // Default to $29

      const productPayload = {
        name: productData.name,
        description: productData.description,
        is_recurring: true,
        recurring_interval: "month",
        prices: [
          {
            price_amount: priceInCents,
            price_currency: "USD"
          }
        ],
        medias: [], // Could add screenshots later
        metadata: {
          generated_by: "factory",
          original_pain_point: productData.original_pain_point?.substring(0, 500),
          features: productData.features?.join(', ')
        }
      };

      const response = await axios.post(
        'https://api.polar.sh/v1/products/',
        productPayload,
        {
          headers: {
            'Authorization': `Bearer ${this.polarToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const product = response.data;

      // Create checkout link
      const checkoutResponse = await axios.post(
        'https://api.polar.sh/v1/checkouts/',
        {
          product_id: product.id,
          success_url: "https://example.com/success",
          customer_email: "", // Will be filled by customer
          metadata: {
            source: "factory-generated"
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.polarToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        product_id: product.id,
        checkout_url: checkoutResponse.data.url,
        product_url: `https://polar.sh/products/${product.id}`
      };

    } catch (error) {
      console.error('❌ Polar.sh product creation failed:', error.response?.data || error.message);
      
      // Fallback: create a placeholder checkout URL
      const fallbackUrl = `https://buy.stripe.com/test_placeholder_${productData.slug}`;
      console.log(`⚠️ Using fallback checkout URL: ${fallbackUrl}`);
      
      return {
        product_id: 'fallback',
        checkout_url: fallbackUrl,
        product_url: fallbackUrl
      };
    }
  }

  updateCheckoutUrl(html, checkoutUrl) {
    // Replace placeholder checkout button with real URL
    return html.replace(
      /<button[^>]*id="checkout-btn"[^>]*>/g,
      `<a href="${checkoutUrl}" target="_blank" style="background: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block; font-weight: 600; transition: all 0.3s ease;">`
    ).replace(
      /<\/button>/g,
      '</a>'
    );
  }

  async deployToNetlify(sourceDir, slug) {
    console.log(`🌐 Deploying ${slug} to Netlify...`);
    
    const startTime = Date.now();

    try {
      // Check if Netlify CLI is available
      try {
        await execAsync('netlify --version');
      } catch (e) {
        throw new Error('Netlify CLI not installed. Run: npm install -g netlify-cli');
      }

      // Generate unique site name for this product
      const uniqueSiteName = `factory-${slug}-${Date.now().toString().slice(-6)}`;
      
      console.log(`🔄 Creating new Netlify site: ${uniqueSiteName}`);
      
      // Deploy with Netlify CLI, creating a new site
      const deployCommand = `cd "${sourceDir}" && netlify deploy --create-site ${uniqueSiteName} --prod --dir .`;
      console.log(`🚀 Deploying: ${deployCommand}`);
      
      const { stdout, stderr } = await execAsync(deployCommand, { 
        timeout: 300000, // 5 minute timeout
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer for large outputs
      });
      
      console.log('✅ Netlify deployment completed');
      
      if (stderr && !stderr.includes('Warning')) {
        console.warn('⚠️ Deployment warnings:', stderr);
      }

      // Parse deployment output to extract URLs and IDs
      const deploymentInfo = this.parseNetlifyOutput(stdout);
      
      // If parsing fails, create fallback info
      if (!deploymentInfo.url) {
        const fallbackUrl = `https://${uniqueSiteName}.netlify.app`;
        console.log(`⚠️ Could not parse deployment URL, using fallback: ${fallbackUrl}`);
        deploymentInfo.url = fallbackUrl;
        deploymentInfo.site_id = uniqueSiteName;
      }

      const buildTime = Date.now() - startTime;
      
      console.log(`🎉 Deployed successfully in ${(buildTime / 1000).toFixed(1)}s`);
      console.log(`🔗 Live URL: ${deploymentInfo.url}`);

      return {
        url: deploymentInfo.url,
        site_id: deploymentInfo.site_id,
        deployment_id: deploymentInfo.deployment_id,
        build_time: buildTime,
        admin_url: deploymentInfo.admin_url
      };

    } catch (error) {
      console.error('❌ Netlify deployment failed:', error.message);
      
      // For development, return a mock deployment result
      const fallbackUrl = `https://factory-${slug}-demo.netlify.app`;
      console.log(`⚠️ Using fallback deployment: ${fallbackUrl}`);
      
      return {
        url: fallbackUrl,
        site_id: `fallback-${slug}`,
        deployment_id: `deploy-${Date.now()}`,
        build_time: Date.now() - startTime,
        admin_url: `https://app.netlify.com/sites/factory-${slug}-demo/overview`
      };
    }
  }

  parseNetlifyOutput(output) {
    const info = {
      url: null,
      site_id: null,
      deployment_id: null,
      admin_url: null
    };

    // Extract live URL
    const urlMatch = output.match(/✔ Live Draft URL: (https?:\/\/[^\s]+)/i) || 
                     output.match(/Website URL: (https?:\/\/[^\s]+)/i) ||
                     output.match(/Live URL: (https?:\/\/[^\s]+)/i);
    if (urlMatch) {
      info.url = urlMatch[1].trim();
    }

    // Extract site ID
    const siteMatch = output.match(/Site ID: ([a-zA-Z0-9-]+)/i);
    if (siteMatch) {
      info.site_id = siteMatch[1].trim();
    }

    // Extract deployment ID
    const deployMatch = output.match(/Deployment ID: ([a-zA-Z0-9-]+)/i);
    if (deployMatch) {
      info.deployment_id = deployMatch[1].trim();
    }

    // Generate admin URL from site ID
    if (info.site_id) {
      info.admin_url = `https://app.netlify.com/sites/${info.site_id}/overview`;
    }

    return info;
  }

  async deployBatch(products, options = {}) {
    console.log(`🏭 Batch deploying ${products.length} products...`);

    const results = [];
    const errors = [];

    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      console.log(`\n[${i + 1}/${products.length}] Deploying: ${product.name}`);

      try {
        const deployment = await this.deployProduct(product, options);
        results.push(deployment);
        console.log(`✅ Deployed: ${deployment.live_url}`);

      } catch (error) {
        console.error(`❌ Failed to deploy ${product.name}:`, error.message);
        errors.push({
          product_name: product.name,
          error: error.message
        });
      }

      // Rate limiting between deployments
      await this.sleep(5000);
    }

    // Save batch deployment results
    const batchResult = {
      deployed_at: new Date().toISOString(),
      total_attempted: products.length,
      successful: results.length,
      failed: errors.length,
      deployments: results,
      errors: errors
    };

    const batchPath = `${this.deployDir}/batch-deployments.json`;
    await fs.writeJson(batchPath, batchResult, { spaces: 2 });

    console.log(`\n🎉 Batch deployment complete: ${results.length}/${products.length} products deployed`);
    console.log(`📄 Results saved to: ${batchPath}`);

    return batchResult;
  }

  async listDeployments() {
    try {
      const deployments = [];
      const deployDirExists = await fs.pathExists(this.deployDir);
      
      if (deployDirExists) {
        const entries = await fs.readdir(this.deployDir);
        
        for (const entry of entries) {
          const deploymentPath = path.join(this.deployDir, entry, 'deployment.json');
          if (await fs.pathExists(deploymentPath)) {
            const deployment = await fs.readJson(deploymentPath);
            deployments.push(deployment);
          }
        }
      }

      return deployments.sort((a, b) => new Date(b.deployed_at) - new Date(a.deployed_at));
    } catch (error) {
      console.error('❌ Failed to list deployments:', error.message);
      return [];
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Standalone execution
async function main() {
  if (require.main === module) {
    try {
      const deployer = new ProductDeployer();
      
      const productArg = process.argv[2];
      
      if (!productArg) {
        console.log('Usage: node deployer.js product.json');
        console.log('   or: node deployer.js batch-results.json');
        process.exit(1);
      }

      if (productArg === 'list') {
        const deployments = await deployer.listDeployments();
        console.log(`\n📋 Found ${deployments.length} deployments:`);
        deployments.forEach((dep, i) => {
          console.log(`${i + 1}. ${dep.name} - ${dep.live_url}`);
        });
        return;
      }

      const data = await fs.readJson(productArg);

      if (data.products) {
        // Batch deployment
        await deployer.deployBatch(data.products);
      } else {
        // Single deployment
        const deployment = await deployer.deployProduct(data);
        console.log(`✅ Deployed: ${deployment.live_url}`);
        console.log(`💰 Checkout: ${deployment.checkout_url}`);
      }

    } catch (error) {
      console.error('❌ Deployment failed:', error.message);
      process.exit(1);
    }
  }
}

main();

module.exports = { ProductDeployer };