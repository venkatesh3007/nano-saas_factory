require('dotenv').config();
const fs = require('fs-extra');
const path = require('path');

class ProductMetrics {
  constructor() {
    this.deployDir = process.env.DEPLOY_DIR || './deployed';
  }

  async getAll() {
    if (!await fs.pathExists(this.deployDir)) return [];
    const entries = await fs.readdir(this.deployDir);
    const products = [];

    for (const entry of entries) {
      const metricsPath = path.join(this.deployDir, entry, 'metrics.json');
      const deployPath = path.join(this.deployDir, entry, 'deployment.json');

      if (await fs.pathExists(metricsPath)) {
        const metrics = await fs.readJson(metricsPath);
        if (await fs.pathExists(deployPath)) {
          const dep = await fs.readJson(deployPath);
          metrics.live_url = dep.live_url;
        }
        metrics.days_live = Math.floor((Date.now() - new Date(metrics.deployed_at).getTime()) / 86400000);
        products.push(metrics);
      }
    }

    return products.sort((a, b) => new Date(b.deployed_at) - new Date(a.deployed_at));
  }

  async showTable() {
    const products = await this.getAll();

    if (products.length === 0) {
      console.log('📊 No products deployed yet.');
      return;
    }

    console.log('\n📊 FACTORY METRICS');
    console.log('═'.repeat(90));
    console.log(
      'Slug'.padEnd(30) +
      'Status'.padEnd(10) +
      'Days'.padEnd(6) +
      'Keep'.padEnd(6) +
      'URL'
    );
    console.log('─'.repeat(90));

    for (const p of products) {
      console.log(
        (p.slug || '?').substring(0, 28).padEnd(30) +
        (p.status || '?').padEnd(10) +
        String(p.days_live || 0).padEnd(6) +
        (p.keep ? '✓' : '✗').padEnd(6) +
        (p.live_url || 'N/A')
      );
    }

    console.log('─'.repeat(90));
    console.log(`Total: ${products.length} products | Active: ${products.filter(p => p.status === 'active').length}`);
  }

  async markKeep(slug, keep = true) {
    const metricsPath = path.join(this.deployDir, slug, 'metrics.json');
    if (!await fs.pathExists(metricsPath)) {
      throw new Error(`No metrics for: ${slug}`);
    }
    const metrics = await fs.readJson(metricsPath);
    metrics.keep = keep;
    await fs.writeJson(metricsPath, metrics, { spaces: 2 });
    console.log(`${keep ? '✅ Marked' : '❌ Unmarked'} ${slug} as keep`);
  }
}

if (require.main === module) {
  (async () => {
    const metrics = new ProductMetrics();
    const cmd = process.argv[2];

    if (cmd === 'keep' && process.argv[3]) {
      await metrics.markKeep(process.argv[3], true);
    } else if (cmd === 'unkeep' && process.argv[3]) {
      await metrics.markKeep(process.argv[3], false);
    } else {
      await metrics.showTable();
    }
  })().catch(err => { console.error('❌', err.message); process.exit(1); });
}

module.exports = { ProductMetrics };
