require('dotenv').config();
const { ProductGenerator } = require('./modules/generator');
const fs = require('fs-extra');

async function testFactory() {
  console.log('🧪 Testing Factory Components...\n');

  // Test data - simulated pain points
  const testPainPoints = [
    {
      problem: "I wish there was a tool that automatically tracks my freelance expenses and categorizes them for taxes",
      score: 85,
      upvotes: 47,
      comments: 23
    },
    {
      problem: "Need a solution for managing multiple social media accounts without switching between apps",
      score: 92,
      upvotes: 156,
      comments: 45
    }
  ];

  try {
    // Test Product Generator
    console.log('🎨 Testing AI Product Generation...');
    const generator = new ProductGenerator();
    
    const product = await generator.generateProduct(testPainPoints[0].problem);
    console.log(`✅ Generated: ${product.name} - ${product.tagline}`);
    console.log(`💰 Pricing: ${product.pricing}`);
    console.log(`📄 Landing page: ${product.landing_page_html.length} characters`);
    console.log(`📢 Ad copy: ${product.ad_copy.headline}`);

    // Save test product
    await fs.ensureDir('./generated');
    await generator.saveProduct(product);

    console.log('\n✅ Factory test successful!');
    console.log('🎯 Product generation working correctly');
    console.log('📁 Test product saved to ./generated/');

    return {
      success: true,
      product: product,
      message: 'Factory core functionality verified'
    };

  } catch (error) {
    console.error('\n❌ Factory test failed:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// Run test
if (require.main === module) {
  testFactory();
}

module.exports = { testFactory };