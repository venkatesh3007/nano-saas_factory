const fs = require('fs-extra');
const path = require('path');
const moment = require('moment');

class ProductMetrics {
  constructor() {
    this.deployDir = process.env.DEPLOY_DIR || './deployed';
    this.outputDir = process.env.OUTPUT_DIR || './generated';
  }

  async trackDeployment(slug, deploymentData) {
    console.log(`📊 Tracking deployment metrics for: ${slug}`);
    
    const deployPath = path.join(this.deployDir, slug);
    await fs.ensureDir(deployPath);
    
    const metrics = {
      slug: slug,
      deployed_at: new Date().toISOString(),
      status: 'live',
      deployment_url: deploymentData.url || null,
      deployment_id: deploymentData.id || null,
      site_id: deploymentData.site_id || null,
      days_live: 0,
      manual_keep_flag: false,
      traffic_data: {
        page_views: 0,
        unique_visitors: 0,
        last_visit: null
      },
      performance_data: {
        build_time_ms: deploymentData.build_time || null,
        bundle_size_kb: null,
        lighthouse_score: null
      },
      engagement_data: {
        tip_jar_clicks: 0,
        function_calls: 0,
        error_rate: 0,
        avg_response_time_ms: null
      },
      metadata: {
        created_from: deploymentData.original_pain_point || null,
        deployment_method: 'netlify',
        last_updated: new Date().toISOString()
      }
    };

    const metricsPath = path.join(deployPath, 'metrics.json');
    await fs.writeFile(metricsPath, JSON.stringify(metrics, null, 2));
    
    console.log(`✅ Metrics tracking initialized for ${slug}`);
    return metrics;
  }

  async updateMetrics(slug, updates) {
    const deployPath = path.join(this.deployDir, slug);
    const metricsPath = path.join(deployPath, 'metrics.json');
    
    if (!await fs.pathExists(metricsPath)) {
      console.warn(`⚠️ No metrics file found for ${slug}`);
      return null;
    }

    const metrics = JSON.parse(await fs.readFile(metricsPath, 'utf8'));
    
    // Update metrics
    Object.assign(metrics, updates);
    metrics.metadata.last_updated = new Date().toISOString();
    
    // Recalculate days live
    metrics.days_live = moment().diff(moment(metrics.deployed_at), 'days');
    
    await fs.writeFile(metricsPath, JSON.stringify(metrics, null, 2));
    return metrics;
  }

  async getAllMetrics() {
    if (!await fs.pathExists(this.deployDir)) {
      return [];
    }

    const products = [];
    const dirs = await fs.readdir(this.deployDir);

    for (const dir of dirs) {
      const metricsPath = path.join(this.deployDir, dir, 'metrics.json');
      if (await fs.pathExists(metricsPath)) {
        try {
          const metrics = JSON.parse(await fs.readFile(metricsPath, 'utf8'));
          
          // Update days_live on read
          metrics.days_live = moment().diff(moment(metrics.deployed_at), 'days');
          
          products.push(metrics);
        } catch (error) {
          console.warn(`Warning: Could not read metrics for ${dir}: ${error.message}`);
        }
      }
    }

    return products.sort((a, b) => new Date(b.deployed_at) - new Date(a.deployed_at));
  }

  async getProductMetrics(slug) {
    const metricsPath = path.join(this.deployDir, slug, 'metrics.json');
    
    if (!await fs.pathExists(metricsPath)) {
      return null;
    }

    const metrics = JSON.parse(await fs.readFile(metricsPath, 'utf8'));
    metrics.days_live = moment().diff(moment(metrics.deployed_at), 'days');
    
    return metrics;
  }

  async markForKeep(slug) {
    return await this.updateMetrics(slug, { 
      manual_keep_flag: true,
      metadata: { keep_reason: 'Manual override', keep_date: new Date().toISOString() }
    });
  }

  async markForKill(slug) {
    return await this.updateMetrics(slug, { 
      status: 'marked_for_kill',
      metadata: { kill_reason: 'Manual override', kill_date: new Date().toISOString() }
    });
  }

  async displayMetricsTable() {
    const products = await this.getAllMetrics();
    
    if (products.length === 0) {
      console.log('📊 No deployed products found');
      return;
    }

    console.log('\n📊 PRODUCT METRICS DASHBOARD');
    console.log('=' .repeat(120));
    console.log('Slug'.padEnd(25) + 
                'Status'.padEnd(15) + 
                'Days Live'.padEnd(12) + 
                'URL'.padEnd(50) + 
                'Keep'.padEnd(8) + 
                'Deployed');
    console.log('─'.repeat(120));

    for (const product of products) {
      const slug = (product.slug || 'unknown').substring(0, 24).padEnd(25);
      const status = (product.status || 'unknown').padEnd(15);
      const daysLive = product.days_live.toString().padEnd(12);
      const url = (product.deployment_url || 'no-url').substring(0, 49).padEnd(50);
      const keepFlag = (product.manual_keep_flag ? '✅ YES' : '   no').padEnd(8);
      const deployed = moment(product.deployed_at).format('MMM DD HH:mm');

      console.log(slug + status + daysLive + url + keepFlag + deployed);
    }

    console.log('─'.repeat(120));
    console.log(`Total: ${products.length} products | Live: ${products.filter(p => p.status === 'live').length} | Marked for keep: ${products.filter(p => p.manual_keep_flag).length}`);
    console.log('');

    // Summary stats
    const liveProducts = products.filter(p => p.status === 'live');
    const avgDaysLive = liveProducts.length > 0 ? 
      (liveProducts.reduce((sum, p) => sum + p.days_live, 0) / liveProducts.length).toFixed(1) : 0;
    
    console.log(`📈 SUMMARY STATS:`);
    console.log(`   • Average days live: ${avgDaysLive}`);
    console.log(`   • Oldest product: ${Math.max(...liveProducts.map(p => p.days_live), 0)} days`);
    console.log(`   • Newest product: ${Math.min(...liveProducts.map(p => p.days_live), 0)} days`);
    console.log(`   • Products with keep flag: ${products.filter(p => p.manual_keep_flag).length}`);
    
    return products;
  }

  async getProductsByStatus(status = 'live') {
    const allProducts = await this.getAllMetrics();
    return allProducts.filter(product => product.status === status);
  }

  async getProductsOlderThan(days) {
    const allProducts = await this.getAllMetrics();
    return allProducts.filter(product => product.days_live > days);
  }

  async getProductsYoungerThan(days) {
    const allProducts = await this.getAllMetrics();
    return allProducts.filter(product => product.days_live <= days);
  }

  async exportMetrics(format = 'json') {
    const products = await this.getAllMetrics();
    const timestamp = moment().format('YYYY-MM-DD_HH-mm');
    
    if (format === 'csv') {
      const csv = [
        'slug,status,days_live,deployed_at,deployment_url,manual_keep_flag',
        ...products.map(p => `${p.slug},${p.status},${p.days_live},${p.deployed_at},${p.deployment_url || ''},${p.manual_keep_flag}`)
      ].join('\n');
      
      const csvPath = `metrics_export_${timestamp}.csv`;
      await fs.writeFile(csvPath, csv);
      console.log(`📄 Metrics exported to: ${csvPath}`);
      return csvPath;
    }

    // Default JSON export
    const jsonPath = `metrics_export_${timestamp}.json`;
    await fs.writeFile(jsonPath, JSON.stringify(products, null, 2));
    console.log(`📄 Metrics exported to: ${jsonPath}`);
    return jsonPath;
  }

  async simulateTraffic(slug, pageViews = null, visitors = null) {
    // For development/testing - simulate traffic data
    const updates = {
      traffic_data: {
        page_views: pageViews || Math.floor(Math.random() * 1000) + 50,
        unique_visitors: visitors || Math.floor(Math.random() * 200) + 10,
        last_visit: new Date().toISOString()
      }
    };
    
    return await this.updateMetrics(slug, updates);
  }
}

module.exports = { ProductMetrics };