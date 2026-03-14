require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs-extra');
const slugify = require('slugify');
const path = require('path');

class ProductBuilder {
  constructor() {
    this.anthropic = new Anthropic();
    this.model = 'claude-sonnet-4-20250514';
    this.outputDir = process.env.OUTPUT_DIR || './generated';
  }

  async buildProduct(painPoint) {
    const problem = typeof painPoint === 'string' ? painPoint : painPoint.problem;
    const slug = slugify(problem, { lower: true, strict: true }).substring(0, 40);
    const productDir = path.join(this.outputDir, slug);

    console.log(`\n🔧 Building: ${problem}`);
    console.log(`   📁 Output: ${productDir}`);

    await fs.ensureDir(productDir);
    await fs.ensureDir(path.join(productDir, 'netlify', 'functions'));

    // Step 1: Generate the Netlify Function
    console.log('   ⚙️  Generating Netlify Function...');
    const functionCode = await this.generateFunction(problem);
    await fs.writeFile(path.join(productDir, 'netlify', 'functions', 'process.js'), functionCode);

    // Step 2: Generate the HTML frontend
    console.log('   🎨 Generating frontend...');
    const html = await this.generateFrontend(problem, slug);
    await fs.writeFile(path.join(productDir, 'index.html'), html);

    // Step 3: Generate netlify.toml
    const netlifyToml = `[build]
  functions = "netlify/functions"
  publish = "."

[functions]
  node_bundler = "esbuild"

[[headers]]
  for = "/*"
  [headers.values]
    Access-Control-Allow-Origin = "*"
    Access-Control-Allow-Methods = "GET, POST, OPTIONS"
    Access-Control-Allow-Headers = "Content-Type"
`;
    await fs.writeFile(path.join(productDir, 'netlify.toml'), netlifyToml);

    // Step 4: Generate package.json for the functions
    const funcPkg = {
      name: slug,
      version: '1.0.0',
      dependencies: {
        '@anthropic-ai/sdk': '^0.30.0'
      }
    };
    await fs.writeJson(path.join(productDir, 'netlify', 'functions', 'package.json'), funcPkg, { spaces: 2 });

    // Step 5: Product metadata
    const product = {
      id: `product_${Date.now()}`,
      slug,
      name: this.titleCase(problem),
      problem,
      category: painPoint.category || 'general',
      built_at: new Date().toISOString(),
      files: ['index.html', 'netlify.toml', 'netlify/functions/process.js'],
      status: 'built'
    };
    await fs.writeJson(path.join(productDir, 'product.json'), product, { spaces: 2 });

    // Step 6: Validate
    const valid = await this.validate(productDir);
    product.validated = valid;

    console.log(`   ${valid ? '✅' : '⚠️'} Build ${valid ? 'validated' : 'has issues'}: ${slug}`);
    return product;
  }

  async generateFunction(problem) {
    const message = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: `Write a Netlify Function (Node.js) that solves this problem: "${problem}"

Requirements:
- Export a handler function compatible with Netlify Functions v2
- Accept POST requests with JSON body containing an "input" field (string)
- Process the input and return useful output
- For AI-powered processing, use the @anthropic-ai/sdk package (already installed)
- Read API key from process.env.ANTHROPIC_API_KEY
- Handle errors gracefully with proper HTTP status codes
- Handle OPTIONS requests for CORS
- Return JSON with { success: true, output: "..." } or { success: false, error: "..." }

If the problem can be solved with pure JavaScript (no AI needed), do it without the API call.
If it requires AI (like "generate regex from description"), use Claude API.

IMPORTANT: Keep the function UNDER 80 lines. Simple and focused. If the task can be done with pure JavaScript, do NOT use the AI SDK.

Return ONLY the JavaScript code, no markdown fences, no explanation.`
      }]
    });

    let code = message.content[0].text;
    // Strip markdown fences if present
    code = code.replace(/^```(?:javascript|js)?\n?/, '').replace(/\n?```$/, '').trim();
    return code;
  }

  async generateFrontend(problem, slug) {
    const title = this.titleCase(problem);
    const message = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: `Create a complete HTML page for a developer tool: "${problem}"

Requirements:
- Complete standalone HTML with embedded CSS and JS
- Dark theme (#0a0a0a background, #e2e8f0 text, #6366f1 accent)
- Clean modern design, good typography (system fonts)
- A textarea input for the user to paste/type their input
- A "Process" button that POSTs to /.netlify/functions/process with JSON body { input: "user input" }
- A results area that shows the output (use a <pre> tag for code output)
- Loading spinner/state while processing
- Error handling (show errors in red)
- Mobile responsive
- Title: "${title}"
- Subtitle: "Free developer tool — powered by AI"
- Footer: "Built by NanoSaaS Factory 🏭"

Return ONLY the HTML code, no markdown fences.`
      }]
    });

    let html = message.content[0].text;
    html = html.replace(/^```html?\n?/, '').replace(/\n?```$/, '').trim();
    return html;
  }

  async validate(productDir) {
    const requiredFiles = [
      'index.html',
      'netlify.toml',
      'netlify/functions/process.js',
      'product.json'
    ];

    for (const file of requiredFiles) {
      const exists = await fs.pathExists(path.join(productDir, file));
      if (!exists) {
        console.log(`   ❌ Missing: ${file}`);
        return false;
      }
    }

    // Syntax check the function
    const funcPath = path.join(productDir, 'netlify/functions/process.js');
    try {
      const { execSync } = require('child_process');
      execSync(`node -c "${funcPath}"`, { encoding: 'utf8', stdio: 'pipe' });
    } catch (err) {
      console.log(`   ❌ Function syntax error: ${(err.stderr || err.message).split('\n')[0]}`);
      return false;
    }

    // Check function has an export
    const funcCode = await fs.readFile(funcPath, 'utf8');
    if (!funcCode.includes('export') && !funcCode.includes('module.exports') && !funcCode.includes('handler')) {
      console.log('   ❌ Function missing handler export');
      return false;
    }

    // Check HTML has form elements
    const html = await fs.readFile(path.join(productDir, 'index.html'), 'utf8');
    if (!html.includes('textarea') && !html.includes('input')) {
      console.log('   ❌ HTML missing input elements');
      return false;
    }

    return true;
  }

  async buildBatch(painPoints) {
    console.log(`\n🏭 Building ${painPoints.length} products...`);
    await fs.ensureDir(this.outputDir);

    const results = { products: [], errors: [], started_at: new Date().toISOString() };

    for (let i = 0; i < painPoints.length; i++) {
      const pp = painPoints[i];
      console.log(`\n[${i + 1}/${painPoints.length}]`);

      try {
        const product = await this.buildProduct(pp);
        results.products.push(product);
      } catch (err) {
        console.error(`   ❌ Failed: ${err.message}`);
        results.errors.push({ pain_point: pp, error: err.message });
      }

      // Rate limit between builds
      if (i < painPoints.length - 1) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    results.completed_at = new Date().toISOString();
    results.total = painPoints.length;
    results.successful = results.products.length;
    results.failed = results.errors.length;

    const batchPath = path.join(this.outputDir, 'batch-results.json');
    await fs.writeJson(batchPath, results, { spaces: 2 });

    console.log(`\n🎉 Build complete: ${results.successful}/${results.total} products built`);
    return results;
  }

  titleCase(str) {
    return str.replace(/\b\w/g, c => c.toUpperCase());
  }
}

if (require.main === module) {
  (async () => {
    const builder = new ProductBuilder();
    const arg = process.argv[2];

    if (!arg) {
      console.log('Usage: node builder.js "problem description"');
      console.log('   or: node builder.js pain-points.json');
      process.exit(1);
    }

    if (arg.endsWith('.json')) {
      const data = await fs.readJson(arg);
      const painPoints = data.pain_points || data;
      await builder.buildBatch(painPoints);
    } else {
      await builder.buildProduct(arg);
    }
  })().catch(err => { console.error('❌', err.message); process.exit(1); });
}

module.exports = { ProductBuilder };
