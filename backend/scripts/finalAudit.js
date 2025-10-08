const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class FinalAudit {
  constructor() {
    this.results = {
      security: { score: 0, issues: [] },
      performance: { score: 0, issues: [] },
      quality: { score: 0, issues: [] },
      overall: 0
    };
  }

  async runFinalAudit() {
    console.log('🔍 Running Final Production Audit...\n');
    
    await this.auditSecurity();
    await this.auditPerformance();
    await this.auditCodeQuality();
    
    this.calculateOverallScore();
    this.generateFinalReport();
  }

  async auditSecurity() {
    console.log('🛡️ Security Audit...');
    let score = 100;
    
    // Check dependencies
    try {
      execSync('npm audit --audit-level high', { stdio: 'pipe' });
      console.log('✅ No high-risk vulnerabilities');
    } catch (error) {
      score -= 20;
      this.results.security.issues.push('High-risk vulnerabilities found');
    }

    // Check environment
    const envFile = path.join(__dirname, '../.env');
    if (fs.existsSync(envFile)) {
      const envContent = fs.readFileSync(envFile, 'utf8');
      if (envContent.includes('JWT_SECRET=secret')) {
        score -= 30;
        this.results.security.issues.push('Weak JWT secret');
      }
    }

    this.results.security.score = Math.max(0, score);
  }

  async auditPerformance() {
    console.log('⚡ Performance Audit...');
    let score = 100;
    
    // Check file sizes
    const serverFile = path.join(__dirname, '../server.js');
    const stats = fs.statSync(serverFile);
    if (stats.size > 50000) { // 50KB
      score -= 10;
      this.results.performance.issues.push('Large server file');
    }

    // Check dependencies count
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json')));
    const depCount = Object.keys(packageJson.dependencies || {}).length;
    if (depCount > 20) {
      score -= 5;
      this.results.performance.issues.push('Too many dependencies');
    }

    this.results.performance.score = Math.max(0, score);
  }

  async auditCodeQuality() {
    console.log('📝 Code Quality Audit...');
    let score = 100;
    
    // Check for TODO comments
    const files = ['server.js', 'routes/auth.js', 'routes/cards.js'];
    for (const file of files) {
      const filePath = path.join(__dirname, '..', file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        if (content.includes('TODO') || content.includes('FIXME')) {
          score -= 5;
          this.results.quality.issues.push(`TODO/FIXME found in ${file}`);
        }
      }
    }

    this.results.quality.score = Math.max(0, score);
  }

  calculateOverallScore() {
    this.results.overall = Math.round(
      (this.results.security.score + this.results.performance.score + this.results.quality.score) / 3
    );
  }

  generateFinalReport() {
    console.log('\n📊 Final Production Audit Report');
    console.log('================================\n');
    
    console.log(`🎯 Overall Score: ${this.results.overall}%\n`);
    
    console.log(`🛡️ Security: ${this.results.security.score}%`);
    if (this.results.security.issues.length > 0) {
      this.results.security.issues.forEach(issue => console.log(`  ❌ ${issue}`));
    } else {
      console.log('  ✅ All security checks passed');
    }
    
    console.log(`\n⚡ Performance: ${this.results.performance.score}%`);
    if (this.results.performance.issues.length > 0) {
      this.results.performance.issues.forEach(issue => console.log(`  ⚠️ ${issue}`));
    } else {
      console.log('  ✅ All performance checks passed');
    }
    
    console.log(`\n📝 Code Quality: ${this.results.quality.score}%`);
    if (this.results.quality.issues.length > 0) {
      this.results.quality.issues.forEach(issue => console.log(`  ⚠️ ${issue}`));
    } else {
      console.log('  ✅ All quality checks passed');
    }

    console.log(`\n${this.results.overall >= 90 ? '🎉 PRODUCTION READY!' : '⚠️ Issues need attention before production'}`);
  }
}

if (require.main === module) {
  const auditor = new FinalAudit();
  auditor.runFinalAudit().catch(console.error);
}

module.exports = FinalAudit;