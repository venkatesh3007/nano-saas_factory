require('dotenv').config();
const fs = require('fs-extra');
const path = require('path');
const { ProductMetrics } = require('./metrics');

class ProductDecider {
  constructor() {
    this.metrics = new ProductMetrics();
    this.killThresholdDays = 7;
  }

  async analyze() {
    const products = await this.metrics.getAll();
    const recommendations = [];

    for (const product of products) {
      if (product.status === 'killed') continue;

      const rec = {
        slug: product.slug,
        days_live: product.days_live,
        keep: product.keep,
        action: 'monitor',
        reason: '',
      };

      if (product.keep) {
        rec.action = 'keep';
        rec.reason = 'Manually marked as keep';
      } else if (product.days_live >= this.killThresholdDays) {
        rec.action = 'kill';
        rec.reason = `Live ${product.days_live} days with no keep flag`;
      } else {
        rec.action = 'monitor';
        rec.reason = `${this.killThresholdDays - product.days_live} days until review`;
      }

      recommendations.push(rec);
    }

    return recommendations;
  }

  async showRecommendations() {
    const recs = await this.analyze();

    if (recs.length === 0) {
      console.log('📋 No products to review.');
      return;
    }

    console.log('\n📋 FACTORY DECISIONS');
    console.log('═'.repeat(80));
    console.log(
      'Slug'.padEnd(30) +
      'Days'.padEnd(6) +
      'Action'.padEnd(10) +
      'Reason'
    );
    console.log('─'.repeat(80));

    for (const rec of recs) {
      const icon = rec.action === 'kill' ? '🔴' : rec.action === 'keep' ? '🟢' : '🟡';
      console.log(
        (rec.slug || '?').substring(0, 28).padEnd(30) +
        String(rec.days_live || 0).padEnd(6) +
        `${icon} ${rec.action}`.padEnd(10) +
        rec.reason
      );
    }

    const kills = recs.filter(r => r.action === 'kill');
    const keeps = recs.filter(r => r.action === 'keep');
    console.log('─'.repeat(80));
    console.log(`Kill candidates: ${kills.length} | Keeps: ${keeps.length} | Monitoring: ${recs.length - kills.length - keeps.length}`);

    if (kills.length > 0) {
      console.log(`\n💡 To execute kills: node pipeline.js decide --auto`);
    }
  }

  async executeDecisions() {
    const recs = await this.analyze();
    const kills = recs.filter(r => r.action === 'kill');

    if (kills.length === 0) {
      console.log('✅ No products to kill.');
      return;
    }

    for (const kill of kills) {
      const metricsPath = path.join(this.metrics.deployDir, kill.slug, 'metrics.json');
      if (await fs.pathExists(metricsPath)) {
        const metrics = await fs.readJson(metricsPath);
        metrics.status = 'killed';
        metrics.killed_at = new Date().toISOString();
        await fs.writeJson(metricsPath, metrics, { spaces: 2 });
        console.log(`🔴 Killed: ${kill.slug}`);
      }
    }

    console.log(`\n💀 Killed ${kills.length} products`);
  }
}

if (require.main === module) {
  (async () => {
    const decider = new ProductDecider();
    if (process.argv.includes('--auto')) {
      await decider.executeDecisions();
    } else {
      await decider.showRecommendations();
    }
  })().catch(err => { console.error('❌', err.message); process.exit(1); });
}

module.exports = { ProductDecider };
