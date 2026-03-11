#!/usr/bin/env node

require('dotenv').config();
const yargs = require('yargs');
const fs = require('fs-extra');
const { RedditScout } = require('./modules/scout');
const { ProductGenerator } = require('./modules/generator');
const { ProductDeployer } = require('./modules/deployer');

class FactoryPipeline {
  constructor() {
    this.scout = new RedditScout();
    this.generator = new ProductGenerator();
    this.deployer = new ProductDeployer();
    
    this.outputDir = process.env.OUTPUT_DIR || './generated';
    this.deployDir = process.env.DEPLOY_DIR || './deployed';
  }

  async runFullPipeline(count = 5, options = {}) {
    console.log('🏭 THE FACTORY - Autonomous Product Validation Engine');
    console.log('=' .repeat(60));
    console.log(`🎯 Target: Generate and deploy ${count} products`);
    console.log(`📁 Output: ${this.outputDir}`);
    console.log(`🚀 Deploy: ${this.deployDir}`);
    console.log('=' .repeat(60));

    const startTime = Date.now();
    const results = {
      pipeline_id: `factory_${Date.now()}`,
      started_at: new Date().toISOString(),
      target_count: count,
      phases: {
        scout: { status: 'pending', duration_ms: 0 },
        generate: { status: 'pending', duration_ms: 0 },
        deploy: { status: 'pending', duration_ms: 0 }
      },
      pain_points: [],
      products: [],
      deployments: [],
      errors: []
    };

    try {
      // Phase 1: Scout for pain points
      console.log('\n🔍 PHASE 1: Scouting Reddit for pain points...');
      const scoutStart = Date.now();
      
      try {
        const painPoints = await this.scout.scoutPainPoints(count * 2); // Get 2x for filtering
        results.pain_points = painPoints.slice(0, count); // Take top N
        results.phases.scout = {
          status: 'completed',
          duration_ms: Date.now() - scoutStart,
          found: painPoints.length,
          selected: results.pain_points.length
        };
        
        console.log(`✅ Scout phase complete: ${results.pain_points.length} pain points selected`);
        
        // Save pain points
        await this.scout.savePainPoints(results.pain_points, 'pipeline-pain-points.json');
        
      } catch (scoutError) {
        results.phases.scout = {
          status: 'failed',
          duration_ms: Date.now() - scoutStart,
          error: scoutError.message
        };
        throw scoutError;
      }

      // Phase 2: Generate products
      console.log('\n🎨 PHASE 2: Generating products with AI...');
      const generateStart = Date.now();
      
      try {
        const generationResult = await this.generator.generateBatch(results.pain_points, this.outputDir);
        results.products = generationResult.products;
        results.phases.generate = {
          status: 'completed',
          duration_ms: Date.now() - generateStart,
          attempted: generationResult.total_attempted,
          successful: generationResult.successful,
          failed: generationResult.failed
        };
        
        console.log(`✅ Generation phase complete: ${results.products.length} products created`);
        
      } catch (generateError) {
        results.phases.generate = {
          status: 'failed',
          duration_ms: Date.now() - generateStart,
          error: generateError.message
        };
        throw generateError;
      }

      // Phase 3: Deploy products (optional)
      if (!options.skipDeploy && results.products.length > 0) {
        console.log('\n🚀 PHASE 3: Deploying products...');
        const deployStart = Date.now();
        
        try {
          const deploymentResult = await this.deployer.deployBatch(results.products);
          results.deployments = deploymentResult.deployments;
          results.phases.deploy = {
            status: 'completed',
            duration_ms: Date.now() - deployStart,
            attempted: deploymentResult.total_attempted,
            successful: deploymentResult.successful,
            failed: deploymentResult.failed
          };
          
          console.log(`✅ Deployment phase complete: ${results.deployments.length} products deployed`);
          
        } catch (deployError) {
          results.phases.deploy = {
            status: 'failed',
            duration_ms: Date.now() - deployStart,
            error: deployError.message
          };
          console.error(`⚠️ Deployment phase failed: ${deployError.message}`);
          // Don't throw here - we still have products generated
        }
      } else {
        console.log('\n⏭️ PHASE 3: Deployment skipped');
        results.phases.deploy = { status: 'skipped', duration_ms: 0 };
      }

      // Pipeline complete
      results.completed_at = new Date().toISOString();
      results.total_duration_ms = Date.now() - startTime;
      results.status = 'completed';

      // Save pipeline results
      await this.savePipelineResults(results);
      
      // Display summary
      this.displaySummary(results);
      
      return results;

    } catch (error) {
      results.completed_at = new Date().toISOString();
      results.total_duration_ms = Date.now() - startTime;
      results.status = 'failed';
      results.final_error = error.message;

      await this.savePipelineResults(results);
      
      console.error(`\n❌ Pipeline failed: ${error.message}`);
      throw error;
    }
  }

  async savePipelineResults(results) {
    await fs.ensureDir(this.outputDir);
    const resultsPath = `${this.outputDir}/pipeline-results.json`;
    await fs.writeJson(resultsPath, results, { spaces: 2 });
    
    console.log(`\n💾 Pipeline results saved to: ${resultsPath}`);
  }

  displaySummary(results) {
    console.log('\n🎉 FACTORY PIPELINE COMPLETE');
    console.log('=' .repeat(60));
    console.log(`⏱️  Total time: ${Math.round(results.total_duration_ms / 1000)}s`);
    console.log(`🔍 Pain points found: ${results.pain_points.length}`);
    console.log(`🎨 Products generated: ${results.products.length}`);
    console.log(`🚀 Products deployed: ${results.deployments.length}`);
    
    if (results.deployments.length > 0) {
      console.log('\n🌐 Live Products:');
      results.deployments.forEach((deployment, i) => {
        console.log(`${i + 1}. ${deployment.name}`);
        console.log(`   🔗 ${deployment.live_url}`);
        console.log(`   💰 ${deployment.checkout_url}`);
      });
    }

    if (results.products.length > 0 && results.deployments.length === 0) {
      console.log('\n📄 Generated Products:');
      results.products.forEach((product, i) => {
        console.log(`${i + 1}. ${product.name} - ${product.tagline}`);
        console.log(`   💰 ${product.pricing}`);
      });
    }
    
    console.log('\n💡 Next steps:');
    console.log('   • Review generated products in ./generated/');
    console.log('   • Deploy manually: node modules/deployer.js batch-results.json');
    console.log('   • Test checkout flows and update pricing');
    console.log('   • Launch marketing campaigns');
    console.log('=' .repeat(60));
  }

  async runScoutOnly(count = 10) {
    console.log(`🔍 Scout mode: Finding ${count} pain points`);
    const painPoints = await this.scout.scoutPainPoints(count);
    await this.scout.savePainPoints(painPoints);
    return painPoints;
  }

  async runGenerateOnly(inputFile) {
    console.log(`🎨 Generate mode: Processing ${inputFile}`);
    const data = await fs.readJson(inputFile);
    const painPoints = data.pain_points || data;
    return await this.generator.generateBatch(painPoints);
  }

  async runDeployOnly(inputFile) {
    console.log(`🚀 Deploy mode: Processing ${inputFile}`);
    const data = await fs.readJson(inputFile);
    const products = data.products || [data];
    return await this.deployer.deployBatch(products);
  }

  async listResults() {
    const generatedExists = await fs.pathExists(this.outputDir);
    const deployedExists = await fs.pathExists(this.deployDir);
    
    console.log('📋 Factory Results:');
    
    if (generatedExists) {
      const files = await fs.readdir(this.outputDir);
      const productFiles = files.filter(f => f.endsWith('.json') && !f.includes('pain-points'));
      console.log(`\n🎨 Generated Products: ${productFiles.length}`);
      productFiles.slice(0, 5).forEach((file, i) => {
        console.log(`  ${i + 1}. ${file}`);
      });
    }
    
    if (deployedExists) {
      const deployments = await this.deployer.listDeployments();
      console.log(`\n🚀 Deployed Products: ${deployments.length}`);
      deployments.slice(0, 5).forEach((dep, i) => {
        console.log(`  ${i + 1}. ${dep.name} - ${dep.live_url}`);
      });
    }
  }
}

// CLI Interface
const cli = yargs
  .usage('Usage: $0 [command] [options]')
  .command(
    ['$0', 'run'],
    'Run the full factory pipeline',
    (yargs) => {
      return yargs
        .option('count', {
          alias: 'c',
          type: 'number',
          default: 5,
          describe: 'Number of products to generate'
        })
        .option('skip-deploy', {
          type: 'boolean',
          default: false,
          describe: 'Skip deployment phase'
        });
    },
    async (argv) => {
      const factory = new FactoryPipeline();
      try {
        await factory.runFullPipeline(argv.count, { skipDeploy: argv.skipDeploy });
      } catch (error) {
        console.error('❌ Pipeline failed:', error.message);
        process.exit(1);
      }
    }
  )
  .command(
    'scout [count]',
    'Scout Reddit for pain points only',
    (yargs) => {
      return yargs.positional('count', {
        describe: 'Number of pain points to find',
        default: 10,
        type: 'number'
      });
    },
    async (argv) => {
      const factory = new FactoryPipeline();
      try {
        await factory.runScoutOnly(argv.count);
      } catch (error) {
        console.error('❌ Scout failed:', error.message);
        process.exit(1);
      }
    }
  )
  .command(
    'generate <input>',
    'Generate products from pain points file',
    (yargs) => {
      return yargs.positional('input', {
        describe: 'Pain points JSON file',
        type: 'string'
      });
    },
    async (argv) => {
      const factory = new FactoryPipeline();
      try {
        await factory.runGenerateOnly(argv.input);
      } catch (error) {
        console.error('❌ Generation failed:', error.message);
        process.exit(1);
      }
    }
  )
  .command(
    'deploy <input>',
    'Deploy products from generated products file',
    (yargs) => {
      return yargs.positional('input', {
        describe: 'Generated products JSON file',
        type: 'string'
      });
    },
    async (argv) => {
      const factory = new FactoryPipeline();
      try {
        await factory.runDeployOnly(argv.input);
      } catch (error) {
        console.error('❌ Deployment failed:', error.message);
        process.exit(1);
      }
    }
  )
  .command(
    'list',
    'List generated and deployed products',
    {},
    async (argv) => {
      const factory = new FactoryPipeline();
      await factory.listResults();
    }
  )
  .help()
  .alias('help', 'h')
  .version('1.0.0');

// Execute CLI
if (require.main === module) {
  cli.parse();
}

module.exports = { FactoryPipeline };