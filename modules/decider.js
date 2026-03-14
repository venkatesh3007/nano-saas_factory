const fs = require('fs-extra');
const path = require('path');
const moment = require('moment');
const { ProductMetrics } = require('./metrics');

class ProductDecider {
  constructor() {
    this.metrics = new ProductMetrics();
    
    // Decision rules configuration
    this.rules = {
      kill_age_days: 7, // Kill products older than 7 days
      keep_min_traffic: 100, // Keep if more than 100 page views
      keep_min_engagement: 5, // Keep if more than 5 function calls
      scale_traffic_threshold: 1000, // Scale if more than 1000 page views
      scale_engagement_threshold: 50, // Scale if more than 50 function calls
      grace_period_days: 3, // Don't make decisions on very new products
    };
  }

  async makeDecisions() {
    console.log('🤖 FACTORY DECIDER - Analyzing product performance...');
    console.log('=' .repeat(80));

    const products = await this.metrics.getAllMetrics();
    
    if (products.length === 0) {
      console.log('📊 No products to analyze');
      return { kill: [], keep: [], scale: [], total: 0 };
    }

    const decisions = {
      kill: [],
      keep: [],
      scale: [],
      no_action: [],
      total: products.length
    };

    console.log(`Analyzing ${products.length} products against decision rules...\n`);

    for (const product of products) {
      const decision = this.analyzeProduct(product);
      decisions[decision.action].push({
        slug: product.slug,
        reason: decision.reason,
        confidence: decision.confidence,
        data: decision.data,
        product: product
      });
    }

    this.displayDecisions(decisions);
    await this.saveDecisionReport(decisions);
    
    return decisions;
  }

  analyzeProduct(product) {
    const analysis = {
      slug: product.slug,
      action: 'no_action',
      reason: '',
      confidence: 0,
      data: {
        days_live: product.days_live,
        page_views: product.traffic_data?.page_views || 0,
        function_calls: product.engagement_data?.function_calls || 0,
        keep_flag: product.manual_keep_flag,
        status: product.status
      }
    };

    // Rule 1: Manual keep flag overrides everything
    if (product.manual_keep_flag) {
      analysis.action = 'keep';
      analysis.reason = 'Manual keep flag set';
      analysis.confidence = 100;
      return analysis;
    }

    // Rule 2: Don't decide on very new products (grace period)
    if (product.days_live <= this.rules.grace_period_days) {
      analysis.action = 'no_action';
      analysis.reason = `Grace period (${product.days_live}/${this.rules.grace_period_days} days)`;
      analysis.confidence = 100;
      return analysis;
    }

    // Rule 3: Already marked for kill
    if (product.status === 'marked_for_kill') {
      analysis.action = 'kill';
      analysis.reason = 'Already marked for kill';
      analysis.confidence = 100;
      return analysis;
    }

    // Rule 4: High performers should scale
    const pageViews = product.traffic_data?.page_views || 0;
    const functionCalls = product.engagement_data?.function_calls || 0;
    
    if (pageViews >= this.rules.scale_traffic_threshold || 
        functionCalls >= this.rules.scale_engagement_threshold) {
      analysis.action = 'scale';
      analysis.reason = `High performance: ${pageViews} views, ${functionCalls} calls`;
      analysis.confidence = 90;
      return analysis;
    }

    // Rule 5: Products with decent engagement should be kept
    if (pageViews >= this.rules.keep_min_traffic || 
        functionCalls >= this.rules.keep_min_engagement) {
      analysis.action = 'keep';
      analysis.reason = `Good engagement: ${pageViews} views, ${functionCalls} calls`;
      analysis.confidence = 80;
      return analysis;
    }

    // Rule 6: Old products with low engagement should be killed
    if (product.days_live >= this.rules.kill_age_days && 
        pageViews < this.rules.keep_min_traffic && 
        functionCalls < this.rules.keep_min_engagement) {
      analysis.action = 'kill';
      analysis.reason = `Low engagement after ${product.days_live} days (${pageViews} views, ${functionCalls} calls)`;
      analysis.confidence = 85;
      return analysis;
    }

    // Default: no action
    analysis.action = 'no_action';
    analysis.reason = `Monitoring: ${product.days_live}d old, ${pageViews} views, ${functionCalls} calls`;
    analysis.confidence = 60;
    
    return analysis;
  }

  displayDecisions(decisions) {
    console.log('🎯 DECISION SUMMARY:');
    console.log(`   🔥 KILL: ${decisions.kill.length} products`);
    console.log(`   ✅ KEEP: ${decisions.keep.length} products`);
    console.log(`   📈 SCALE: ${decisions.scale.length} products`);
    console.log(`   ⏸️  NO ACTION: ${decisions.no_action.length} products`);
    console.log('');

    // Kill recommendations
    if (decisions.kill.length > 0) {
      console.log('🔥 KILL RECOMMENDATIONS:');
      console.log('─'.repeat(80));
      decisions.kill.forEach(item => {
        console.log(`   ${item.slug.padEnd(25)} ${item.reason} (${item.confidence}% confidence)`);
      });
      console.log('');
    }

    // Scale recommendations  
    if (decisions.scale.length > 0) {
      console.log('📈 SCALE RECOMMENDATIONS:');
      console.log('─'.repeat(80));
      decisions.scale.forEach(item => {
        console.log(`   ${item.slug.padEnd(25)} ${item.reason} (${item.confidence}% confidence)`);
      });
      console.log('');
    }

    // Keep recommendations
    if (decisions.keep.length > 0) {
      console.log('✅ KEEP RECOMMENDATIONS:');
      console.log('─'.repeat(80));
      decisions.keep.forEach(item => {
        console.log(`   ${item.slug.padEnd(25)} ${item.reason} (${item.confidence}% confidence)`);
      });
      console.log('');
    }

    console.log('💡 NEXT ACTIONS:');
    if (decisions.kill.length > 0) {
      console.log(`   • Run: node pipeline.js kill ${decisions.kill[0].slug} (and ${decisions.kill.length - 1} others)`);
    }
    if (decisions.scale.length > 0) {
      console.log(`   • Manual: Consider promoting ${decisions.scale[0].slug} (${decisions.scale.length} candidates)`);
    }
    if (decisions.keep.length > 0) {
      console.log(`   • Run: node pipeline.js keep ${decisions.keep[0].slug} (and ${decisions.keep.length - 1} others)`);
    }
    console.log('');
  }

  async saveDecisionReport(decisions) {
    const timestamp = moment().format('YYYY-MM-DD_HH-mm');
    const reportPath = `decision_report_${timestamp}.json`;
    
    const report = {
      generated_at: new Date().toISOString(),
      rules_used: this.rules,
      decisions: decisions,
      summary: {
        total_products: decisions.total,
        kill_count: decisions.kill.length,
        keep_count: decisions.keep.length,
        scale_count: decisions.scale.length,
        no_action_count: decisions.no_action.length
      }
    };

    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 Decision report saved: ${reportPath}`);
    
    return reportPath;
  }

  async executeKillDecision(slug, confirm = false) {
    if (!confirm) {
      console.log(`⚠️  Kill decision for ${slug} requires confirmation.`);
      console.log(`Run: node pipeline.js kill ${slug} --confirm`);
      return false;
    }

    console.log(`🔥 Executing kill decision for: ${slug}`);
    
    // Mark for kill in metrics
    await this.metrics.markForKill(slug);
    
    // TODO: Actually shut down the Netlify site
    // This would require Netlify API integration
    console.log(`✅ ${slug} marked for kill (Netlify site shutdown would happen here)`);
    
    return true;
  }

  async executeKeepDecision(slug) {
    console.log(`✅ Executing keep decision for: ${slug}`);
    
    // Set manual keep flag
    await this.metrics.markForKeep(slug);
    
    console.log(`✅ ${slug} marked to keep permanently`);
    return true;
  }

  async executeScaleDecision(slug) {
    console.log(`📈 Scale recommendation for: ${slug}`);
    console.log(`   • Consider: Custom domain, SEO optimization, marketing budget`);
    console.log(`   • Consider: Feature expansion, user feedback collection`);
    console.log(`   • Consider: Analytics integration, conversion tracking`);
    
    // Mark as high performer
    await this.metrics.updateMetrics(slug, { 
      status: 'high_performer',
      scale_recommendation: {
        recommended_at: new Date().toISOString(),
        actions: ['custom_domain', 'seo_optimization', 'marketing_budget']
      }
    });
    
    return true;
  }

  updateRules(newRules) {
    this.rules = { ...this.rules, ...newRules };
    console.log('🔧 Decision rules updated:', newRules);
  }

  showRules() {
    console.log('🤖 CURRENT DECISION RULES:');
    console.log('─'.repeat(50));
    Object.entries(this.rules).forEach(([key, value]) => {
      console.log(`   ${key.replace(/_/g, ' ')}: ${value}`);
    });
    console.log('');
  }

  async getProductsRecommendedFor(action) {
    const decisions = await this.makeDecisions();
    return decisions[action] || [];
  }
}

module.exports = { ProductDecider };