require('dotenv').config();
const fs = require('fs-extra');
const { exec, execSync } = require('child_process');
const { promisify } = require('util');
const path = require('path');

const execAsync = promisify(exec);

class ProductDeployer {
  constructor() {
    this.deployDir = process.env.DEPLOY_DIR || './deployed';
    this.generatedDir = process.env.OUTPUT_DIR || './generated';
  }

  async validateFunction(productDir) {
    const funcPath = path.join(productDir, 'netlify', 'functions', 'process.js');
    if (!await fs.pathExists(funcPath)) return { valid: false, error: 'Function file missing' };

    try {
      execSync(`node -c "${funcPath}"`, { encoding: 'utf8', stdio: 'pipe' });
      return { valid: true };
    } catch (err) {
      return { valid: false, error: err.stderr || err.message };
    }
  }

  async deployProduct(slugOrProduct) {
    const slug = typeof slugOrProduct === 'string' ? slugOrProduct : slugOrProduct.slug;
    const productDir = path.resolve(this.generatedDir, slug);

    if (!await fs.pathExists(productDir)) {
      throw new Error(`Product directory not found: ${productDir}`);
    }

    console.log(`🚀 Deploying: ${slug}`);

    // Validate function syntax first
    const validation = await this.validateFunction(productDir);
    if (!validation.valid) {
      throw new Error(`Function syntax error: ${validation.error}`);
    }
    console.log('   ✅ Function syntax valid');

    // Install function dependencies
    const funcDir = path.join(productDir, 'netlify', 'functions');
    if (await fs.pathExists(path.join(funcDir, 'package.json'))) {
      console.log('   📦 Installing function dependencies...');
      try {
        await execAsync('npm install --production', { cwd: funcDir, timeout: 60000 });
      } catch (err) {
        console.warn(`   ⚠️ npm install warning: ${err.message}`);
      }
    }

    // Use Netlify API to create a new site, then deploy to it
    console.log('   🌐 Creating new Netlify site via API...');
    const netlifyToken = 'nfc_J8e4H7SBSGjoWtopxADYEAgHdRN1fsge09d2';
    let siteId = null;
    const siteName = `factory-${slug.substring(0, 30)}-${Date.now().toString(36)}`;

    try {
      const { stdout: apiOut } = await execAsync(
        `curl -s -X POST https://api.netlify.com/api/v1/sites -H "Authorization: Bearer ${netlifyToken}" -H "Content-Type: application/json" -d '{"name": "${siteName}"}'`,
        { timeout: 15000 }
      );
      const siteInfo = JSON.parse(apiOut);
      if (siteInfo.id) {
        siteId = siteInfo.id;
        console.log(`   📍 Created site: ${siteInfo.ssl_url || siteInfo.url}`);
      } else {
        console.warn(`   ⚠️ API response: ${apiOut.substring(0, 200)}`);
      }
    } catch (createErr) {
      console.warn(`   ⚠️ Could not create new site: ${createErr.message}`);
    }

    // Deploy
    console.log('   🚀 Deploying to Netlify...');
    const siteFlag = siteId ? `--site ${siteId}` : '';
    let liveUrl = null;

    try {
      const { stdout } = await execAsync(
        `netlify deploy --prod --dir "${productDir}" --functions "${path.join(productDir, 'netlify', 'functions')}" ${siteFlag} --message "Factory: ${slug}"`,
        { timeout: 120000, env: { ...process.env, BROWSER: 'none' } }
      );

      const urlMatch = stdout.match(/Website URL:\s*(https:\/\/[^\s]+)/i)
        || stdout.match(/(https:\/\/[a-z0-9-]+\.netlify\.app)/i);
      if (urlMatch) liveUrl = urlMatch[1];
    } catch (err) {
      const errMatch = (err.stdout || '').match(/(https:\/\/[a-z0-9-]+\.netlify\.app)/i);
      if (errMatch) {
        liveUrl = errMatch[1];
      } else {
        throw new Error(`Deploy failed: ${err.message.substring(0, 200)}`);
      }
    }

    if (!liveUrl) {
      liveUrl = `https://${siteName}.netlify.app`;
    }

    // Save deployment metadata
    await fs.ensureDir(path.join(this.deployDir, slug));
    const deployment = {
      slug,
      site_id: siteId,
      live_url: liveUrl,
      deployed_at: new Date().toISOString(),
      status: 'active',
      local_path: productDir,
    };
    await fs.writeJson(path.join(this.deployDir, slug, 'deployment.json'), deployment, { spaces: 2 });

    const metrics = {
      slug,
      live_url: liveUrl,
      deployed_at: new Date().toISOString(),
      status: 'active',
      keep: false,
    };
    await fs.writeJson(path.join(this.deployDir, slug, 'metrics.json'), metrics, { spaces: 2 });

    console.log(`   ✅ Live at: ${liveUrl}`);
    return deployment;
  }

  async deployBatch(products) {
    console.log(`\n🏭 Deploying ${products.length} products...`);
    const results = { deployments: [], errors: [] };

    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      console.log(`\n[${i + 1}/${products.length}]`);

      try {
        const deployment = await this.deployProduct(product);
        results.deployments.push(deployment);
      } catch (err) {
        console.error(`   ❌ Deploy failed: ${err.message}`);
        results.errors.push({ slug: product.slug || product, error: err.message });
      }

      if (i < products.length - 1) await new Promise(r => setTimeout(r, 3000));
    }

    results.total_attempted = products.length;
    results.successful = results.deployments.length;
    results.failed = results.errors.length;

    console.log(`\n🎉 Deployed: ${results.successful}/${results.total_attempted}`);
    return results;
  }

  async listDeployments() {
    if (!await fs.pathExists(this.deployDir)) return [];
    const entries = await fs.readdir(this.deployDir);
    const deployments = [];
    for (const entry of entries) {
      const depPath = path.join(this.deployDir, entry, 'deployment.json');
      if (await fs.pathExists(depPath)) deployments.push(await fs.readJson(depPath));
    }
    return deployments.sort((a, b) => new Date(b.deployed_at) - new Date(a.deployed_at));
  }
}

if (require.main === module) {
  (async () => {
    const deployer = new ProductDeployer();
    const arg = process.argv[2];
    if (!arg) { console.log('Usage: node deployer.js <slug> | list'); process.exit(1); }
    if (arg === 'list') {
      const deps = await deployer.listDeployments();
      deps.forEach((d, i) => console.log(`${i + 1}. ${d.slug} → ${d.live_url} [${d.status}]`));
    } else {
      await deployer.deployProduct(arg);
    }
  })().catch(err => { console.error('❌', err.message); process.exit(1); });
}

module.exports = { ProductDeployer };
