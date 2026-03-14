require('dotenv').config();
const { Anthropic } = require('@anthropic-ai/sdk');
const fs = require('fs-extra');
const slugify = require('slugify');
const path = require('path');

class ProductBuilder {
  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    
    // Updated to use latest Claude model
    this.model = 'claude-sonnet-4-20250514';
  }

  async buildProduct(painPoint, options = {}) {
    console.log(`🏗️ Building functional product for: "${painPoint.title || painPoint.description?.substring(0, 80)}..."`);

    try {
      // Phase 1: Generate product concept
      const productConcept = await this.generateProductConcept(painPoint);
      console.log(`📝 Product concept: ${productConcept.name}`);

      // Phase 2: Generate working Netlify Function
      const netlifyFunction = await this.generateNetlifyFunction(productConcept, painPoint);
      console.log(`⚡ Generated Netlify Function (${netlifyFunction.length} chars)`);

      // Phase 3: Generate functional HTML frontend
      const htmlFrontend = await this.generateHtmlFrontend(productConcept, painPoint);
      console.log(`🌐 Generated HTML frontend (${htmlFrontend.length} chars)`);

      // Phase 4: Generate Netlify config
      const netlifyConfig = this.generateNetlifyConfig(productConcept);
      console.log(`⚙️ Generated netlify.toml`);

      // Create product directory structure
      const slug = slugify(productConcept.name, { lower: true, strict: true });
      const outputDir = path.join(process.env.OUTPUT_DIR || './generated', slug);
      
      await fs.ensureDir(outputDir);
      await fs.ensureDir(path.join(outputDir, 'netlify', 'functions'));

      // Write files
      await fs.writeFile(path.join(outputDir, 'index.html'), htmlFrontend);
      await fs.writeFile(path.join(outputDir, 'netlify', 'functions', 'process.js'), netlifyFunction);
      await fs.writeFile(path.join(outputDir, 'netlify.toml'), netlifyConfig);

      // Save product metadata
      const productData = {
        id: `product_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        slug: slug,
        name: productConcept.name,
        tagline: productConcept.tagline,
        description: productConcept.description,
        target_audience: productConcept.target_audience,
        pricing: productConcept.pricing,
        features: productConcept.features,
        tool_type: productConcept.tool_type,
        original_pain_point: painPoint,
        generated_at: new Date().toISOString(),
        output_dir: outputDir,
        status: 'built'
      };

      await fs.writeFile(path.join(outputDir, 'product.json'), JSON.stringify(productData, null, 2));

      // Validate the build
      const validation = await this.validateBuild(outputDir);
      console.log(`✅ Build validation: ${validation.valid ? 'PASSED' : 'FAILED'}`);
      
      if (!validation.valid) {
        console.log('❌ Validation errors:', validation.errors);
      }

      return {
        ...productData,
        validation: validation
      };

    } catch (error) {
      console.error('❌ Product build failed:', error.message);
      throw error;
    }
  }

  async generateProductConcept(painPoint) {
    const prompt = `You're building a WORKING web tool to solve this problem: "${painPoint.description || painPoint.title}"

    Create a product concept for a single-purpose tool that can be built with:
    1. An HTML frontend (file upload OR text input form)
    2. A Netlify Function that processes the input using Claude API or pure logic
    3. Must be buildable in one sitting and actually functional

    Examples of good tools:
    - PDF to clean CSV converter (upload PDF → extract tables → return CSV)
    - README to landing page generator (paste README → generate marketing page)
    - Code to architecture diagram (paste code → generate visual diagram)
    - Meeting notes to action items extractor
    - Long article to tweet thread generator

    Return ONLY JSON:
    {
      "name": "Tool Name (3-4 words max)",
      "tagline": "One sentence value prop",
      "description": "What it does and why developers/creators need it",
      "target_audience": "Who needs this most",
      "pricing": "Free with tip jar",
      "features": ["3-4 key features"],
      "tool_type": "converter|generator|analyzer|formatter",
      "input_method": "file_upload|text_input|url_input",
      "processing_approach": "claude_api|pure_logic|hybrid"
    }`;

    const response = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    // Clean up the response text to handle markdown code blocks
    let responseText = response.content[0].text.trim();
    
    // Remove markdown code blocks if present
    responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    
    // Try to parse as JSON
    try {
      return JSON.parse(responseText);
    } catch (error) {
      console.error('Failed to parse JSON response:', responseText.substring(0, 200));
      throw new Error(`Invalid JSON response from Claude: ${error.message}`);
    }
  }

  async generateNetlifyFunction(productConcept, painPoint) {
    const prompt = `Generate a working Netlify Function for: "${productConcept.name}"

    Requirements:
    - Tool type: ${productConcept.tool_type}
    - Input method: ${productConcept.input_method}
    - Processing approach: ${productConcept.processing_approach}
    - Must handle CORS properly
    - Must process real input and return real output
    - Use Anthropic Claude API if needed (ANTHROPIC_API_KEY env var available)

    The function should:
    1. Accept POST requests with ${productConcept.input_method === 'file_upload' ? 'file data (FormData)' : 'JSON body'}
    2. Process the input ${productConcept.processing_approach === 'claude_api' ? 'using Claude API' : 'with pure JavaScript logic'}
    3. Return processed result as JSON

    Example input/output:
    ${this.getExampleIO(productConcept)}

    Return ONLY the complete JavaScript code for netlify/functions/process.js:`;

    const response = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    // Clean up the response to remove markdown formatting
    let code = response.content[0].text.trim();
    code = code.replace(/```javascript\n?/g, '').replace(/```js\n?/g, '').replace(/```\n?/g, '');
    return code;
  }

  async generateHtmlFrontend(productConcept, painPoint) {
    const prompt = `Generate a complete HTML frontend for: "${productConcept.name}"

    Requirements:
    - Single HTML file with inline CSS and JavaScript
    - ${productConcept.input_method === 'file_upload' ? 'File upload interface' : 'Text input form'}
    - Calls /.netlify/functions/process for backend processing
    - Shows loading state and results
    - Professional design using Tailwind CSS (CDN)
    - Mobile-responsive
    - Include tip jar link: "Buy me a coffee ☕" → https://buymeacoffee.com/factory

    Features to implement:
    ${productConcept.features.map(f => `- ${f}`).join('\n    ')}

    The interface should be clean, focused, and immediately usable.
    
    Return ONLY the complete HTML code:`;

    const response = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: 3000,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    // Clean up the response to remove markdown formatting
    let html = response.content[0].text.trim();
    html = html.replace(/```html\n?/g, '').replace(/```\n?/g, '');
    return html;
  }

  generateNetlifyConfig(productConcept) {
    return `[build]
  functions = "netlify/functions"

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"

[[headers]]
  for = "/.netlify/functions/*"
  [headers.values]
    Access-Control-Allow-Origin = "*"
    Access-Control-Allow-Headers = "Content-Type"
    Access-Control-Allow-Methods = "GET, POST, OPTIONS"

[functions]
  node_bundler = "esbuild"
`;
  }

  getExampleIO(productConcept) {
    const examples = {
      converter: `Input: PDF file with tables
Output: { success: true, csv: "Name,Email,Phone\\nJohn,john@example.com,123..." }`,
      
      generator: `Input: { content: "My awesome project does X, Y, Z..." }
Output: { success: true, result: "Generated landing page HTML..." }`,
      
      analyzer: `Input: { text: "Long meeting transcript..." }
Output: { success: true, analysis: "Key points: 1. Decision made...", action_items: [...] }`,
      
      formatter: `Input: { code: "function messy() { return 'ugly code'; }" }
Output: { success: true, formatted: "function clean() {\\n  return 'beautiful code';\\n}" }`
    };

    return examples[productConcept.tool_type] || examples.converter;
  }

  async validateBuild(outputDir) {
    const validation = {
      valid: true,
      errors: []
    };

    try {
      // Check required files exist
      const requiredFiles = [
        'index.html',
        'netlify/functions/process.js',
        'netlify.toml',
        'product.json'
      ];

      for (const file of requiredFiles) {
        const filePath = path.join(outputDir, file);
        if (!await fs.pathExists(filePath)) {
          validation.valid = false;
          validation.errors.push(`Missing file: ${file}`);
        }
      }

      // Validate HTML
      const htmlPath = path.join(outputDir, 'index.html');
      if (await fs.pathExists(htmlPath)) {
        const html = await fs.readFile(htmlPath, 'utf8');
        if (!html.includes('<!DOCTYPE html>')) {
          validation.valid = false;
          validation.errors.push('HTML missing DOCTYPE declaration');
        }
        if (!html.includes('netlify/functions/process')) {
          validation.valid = false;
          validation.errors.push('HTML not calling Netlify Function');
        }
      }

      // Validate Netlify Function
      const functionPath = path.join(outputDir, 'netlify/functions/process.js');
      if (await fs.pathExists(functionPath)) {
        const functionCode = await fs.readFile(functionPath, 'utf8');
        if (!functionCode.includes('exports.handler') && !functionCode.includes('export')) {
          validation.valid = false;
          validation.errors.push('Netlify Function missing proper export');
        }
      }

      // Validate product.json
      const productPath = path.join(outputDir, 'product.json');
      if (await fs.pathExists(productPath)) {
        try {
          const product = JSON.parse(await fs.readFile(productPath, 'utf8'));
          if (!product.name || !product.slug) {
            validation.valid = false;
            validation.errors.push('product.json missing required fields');
          }
        } catch (e) {
          validation.valid = false;
          validation.errors.push('product.json is not valid JSON');
        }
      }

    } catch (error) {
      validation.valid = false;
      validation.errors.push(`Validation error: ${error.message}`);
    }

    return validation;
  }

  async listBuiltProducts() {
    const outputDir = process.env.OUTPUT_DIR || './generated';
    
    if (!await fs.pathExists(outputDir)) {
      return [];
    }

    const products = [];
    const dirs = await fs.readdir(outputDir);

    for (const dir of dirs) {
      const productPath = path.join(outputDir, dir, 'product.json');
      if (await fs.pathExists(productPath)) {
        try {
          const product = JSON.parse(await fs.readFile(productPath, 'utf8'));
          products.push(product);
        } catch (error) {
          console.warn(`Warning: Could not read product.json for ${dir}`);
        }
      }
    }

    return products.sort((a, b) => new Date(b.generated_at) - new Date(a.generated_at));
  }
}

module.exports = { ProductBuilder };