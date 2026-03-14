#!/usr/bin/env node

require('dotenv').config();
const yargs = require('yargs');
const fs = require('fs-extra');
const { RedditScout } = require('./modules/scout');
const { ProductBuilder } = require('./modules/builder');
const { ProductDeployer } = require('./modules/deployer');
const { ProductMetrics } = require('./modules/metrics');
const { ProductDecider } = require('./modules/decider');

class FactoryPipeline {
  constructor() {
    this.scout = new RedditScout();
    this.builder = new ProductBuilder();
    this.deployer = new ProductDeployer();
    this.metrics = new ProductMetrics();
    this.decider = new ProductDecider();
  }

  async runFullPipeline(count = 1, options = {}) {
    console.log('🏭 THE FACTORY v2 — Autonomous Product Machine');
    console.log('═'.repeat(60));
    console.log(`🎯 Target: ${count} working product(s)`);
    const startTime = Date.now();

    // Phase 1: Scout
    console.log('\n📡 PHASE 1: Scouting pain points...');
    const painPoints = await this.scout.scoutPainPoints(count);
    await this.scout.savePainPoints(painPoints);

    // Phase 2: Build
    console.log('\n🔧 PHASE 2: Building working tools...');
    const buildResults = await this.builder.buildBatch(painPoints);

    if (buildResults.products.length === 0) {
      console.log('\n❌ No products built successfully. Aborting.');
      return;
    }

    // Phase 3: Deploy
    if (!options.skipDeploy) {
      console.log('\n🚀 PHASE 3: Deploying to Netlify...');
      const deployResults = await this.deployer.deployBatch(buildResults.products);

      // Summary
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log('\n🎉 FACTORY RUN COMPLETE');
      console.log('═'.repeat(60));
      console.log(`⏱️  Time: ${elapsed}s`);
      console.log(`🔍 Pain points: ${painPoints.length}`);
      console.log(`🔧 Built: ${buildResults.successful}/${buildResults.total}`);
      console.log(`🚀 Deployed: ${deployResults.successful}/${deployResults.total_attempted}`);

      if (deployResults.deployments.length > 0) {
        console.log('\n🌐 Live Products:');
        deployResults.deployments.forEach((d, i) => {
          console.log(`   ${i + 1}. ${d.slug} → ${d.live_url}`);
        });
      }
    } else {
      console.log('\n⏭️  PHASE 3: Deployment skipped (--skip-deploy)');
    }

    console.log('═'.repeat(60));
  }
}

// CLI
yargs
  .scriptName('factory')
  .usage('Usage: $0 <command> [options]')

  .command(['run', '$0'], 'Run the full factory pipeline', (y) => {
    return y
      .option('count', { alias: 'c', type: 'number', default: 1, describe: 'Number of products' })
      .option('skip-deploy', { type: 'boolean', default: false, describe: 'Skip deployment' });
  }, async (argv) => {
    const factory = new FactoryPipeline();
    await factory.runFullPipeline(argv.count, { skipDeploy: argv.skipDeploy });
  })

  .command('scout [count]', 'Scout for pain points only', (y) => {
    return y.positional('count', { default: 5, type: 'number' });
  }, async (argv) => {
    const scout = new RedditScout();
    const points = await scout.scoutPainPoints(argv.count);
    await scout.savePainPoints(points);
  })

  .command('build <input>', 'Build products from pain points file', (y) => {
    return y.positional('input', { type: 'string', describe: 'Pain points JSON file or problem string' });
  }, async (argv) => {
    const builder = new ProductBuilder();
    if (argv.input.endsWith('.json')) {
      const data = await fs.readJson(argv.input);
      await builder.buildBatch(data.pain_points || data);
    } else {
      await builder.buildProduct(argv.input);
    }
  })

  .command('deploy <slug>', 'Deploy a single product', (y) => {
    return y.positional('slug', { type: 'string' });
  }, async (argv) => {
    const deployer = new ProductDeployer();
    await deployer.deployProduct(argv.slug);
  })

  .command('metrics', 'Show product metrics', {}, async () => {
    const metrics = new ProductMetrics();
    await metrics.showTable();
  })

  .command('decide', 'Show scale/kill recommendations', (y) => {
    return y.option('auto', { type: 'boolean', default: false, describe: 'Execute decisions' });
  }, async (argv) => {
    const decider = new ProductDecider();
    if (argv.auto) {
      await decider.executeDecisions();
    } else {
      await decider.showRecommendations();
    }
  })

  .command('list', 'List all products', {}, async () => {
    const deployer = new ProductDeployer();
    const deps = await deployer.listDeployments();
    if (deps.length === 0) {
      console.log('📋 No deployments yet.');
      return;
    }
    deps.forEach((d, i) => {
      console.log(`${i + 1}. ${d.slug} → ${d.live_url} [${d.status}] (${d.deployed_at})`);
    });
  })

  .help()
  .alias('help', 'h')
  .strict()
  .parse();
