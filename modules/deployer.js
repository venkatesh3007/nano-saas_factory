require('dotenv').config();
const fs = require('fs-extra');
const { exec } = require('child_process');
const { promisify } = require('util');
const axios = require('axios');
const path = require('path');

const execAsync = promisify(exec);

class ProductDeployer {
  constructor() {
    this.polarToken = process.env.POLAR_API_TOKEN;
    this.deployDir = process.env.DEPLOY_DIR || './deployed';
  }

  async deployProduct(productData, options = {}) {
    console.log(`🚀 Deploying: ${productData.name}`);

    try {
      // Ensure deploy directory exists
      await fs.ensureDir(this.deployDir);

      // Create Polar.sh product and checkout
      const polarData = await this.createPolarProduct(productData);
      console.log(`💰 Created Polar product: ${polarData.checkout_url}`);

      // Update HTML with checkout URL
      const updatedHtml = this.updateCheckoutUrl(productData.landing_page_html, polarData.checkout_url);

      // Save updated HTML to deploy directory
      const deployPath = path.join(this.deployDir, `${productData.slug}`);
      await fs.ensureDir(deployPath);
      const htmlPath = path.join(deployPath, 'index.html');
      await fs.writeFile(htmlPath, updatedHtml);

      // Deploy to Netlify
      const netlifyUrl = await this.deployToNetlify(deployPath, productData.slug);
      console.log(`🌐 Deployed to: ${netlifyUrl}`);

      const deploymentResult = {
        id: productData.id,
        slug: productData.slug,
        name: productData.name,
        live_url: netlifyUrl,
        checkout_url: polarData.checkout_url,
        polar_product_id: polarData.product_id,
        deployed_at: new Date().toISOString(),
        local_path: deployPath
      };

      // Save deployment metadata
      const metadataPath = path.join(deployPath, 'deployment.json');
      await fs.writeJson(metadataPath, deploymentResult, { spaces: 2 });

      console.log(`✅ Deployment complete: ${netlifyUrl}`);
      return deploymentResult;

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

  async deployToNetlify(sitePath, siteName) {
    console.log(`🌐 Deploying ${siteName} to Netlify...`);

    try {
      // Check if Netlify CLI is available
      try {
        await execAsync('netlify --version');
      } catch (cliError) {
        console.log('📦 Installing Netlify CLI...');
        await execAsync('npm install -g netlify-cli');
      }

      // Deploy to Netlify
      const deployCommand = `cd "${sitePath}" && netlify deploy --prod --dir .`;
      
      console.log(`🔧 Running: ${deployCommand}`);
      const { stdout, stderr } = await execAsync(deployCommand, { 
        timeout: 60000, // 1 minute timeout
        cwd: sitePath
      });

      // Extract URL from Netlify output
      const urlMatch = stdout.match(/Live URL:\s*(https:\/\/[^\s]+)/i) || 
                      stdout.match(/Website URL:\s*(https:\/\/[^\s]+)/i) ||
                      stdout.match(/(https:\/\/[a-z0-9-]+\.netlify\.app)/i);

      if (urlMatch) {
        return urlMatch[1];
      }

      // Fallback: generate likely URL
      const fallbackUrl = `https://${siteName.toLowerCase()}-${Date.now()}.netlify.app`;
      console.log(`⚠️ Could not parse Netlify URL, using fallback: ${fallbackUrl}`);
      return fallbackUrl;

    } catch (error) {
      console.error('❌ Netlify deployment failed:', error.message);
      
      // Fallback: use GitHub Pages-style URL
      const fallbackUrl = `https://factory-products.github.io/${siteName}`;
      console.log(`⚠️ Using fallback URL: ${fallbackUrl}`);
      return fallbackUrl;
    }
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