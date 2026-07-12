const sharp = require('sharp');
const assert = require('assert');

async function testResolutionRejection(width, height) {
  const buf = await sharp({
    create: { width, height, channels: 3, background: { r: 255, g: 0, b: 0 } }
  }).png().toBuffer();

  const meta = await sharp(buf).metadata();
  const minDim = Math.min(meta.width, meta.height);
  const accepted = minDim >= 768;

  console.log('  ' + width + 'x' + height + ' -> minDim=' + minDim + ', ' + (accepted ? 'ACCEPTED' : 'REJECTED'));
  return { width, height, minDim, accepted };
}

async function main() {
  console.log('Resolution rejection test (min dimension >= 768):');

  // Thumbnail-sized (should reject)
  const t1 = await testResolutionRejection(768, 559);
  assert.ok(!t1.accepted, '768x559 should be rejected (min=559 < 768)');

  const t2 = await testResolutionRejection(800, 600);
  assert.ok(!t2.accepted, '800x600 should be rejected (min=600 < 768)');

  const t3 = await testResolutionRejection(500, 500);
  assert.ok(!t3.accepted, '500x500 should be rejected (min=500 < 768)');

  // Full-resolution (should accept)
  const f1 = await testResolutionRejection(2816, 1536);
  assert.ok(f1.accepted, '2816x1536 should be accepted (min=1536 >= 768)');

  const f2 = await testResolutionRejection(1920, 1080);
  assert.ok(f2.accepted, '1920x1080 should be accepted (min=1080 >= 768)');

  const f3 = await testResolutionRejection(768, 768);
  assert.ok(f3.accepted, '768x768 should be accepted (min=768 >= 768)');

  const f4 = await testResolutionRejection(2048, 768);
  assert.ok(f4.accepted, '2048x768 should be accepted (min=768 >= 768)');

  console.log('\nAll 7 resolution check tests PASSED');
}

main().catch(err => { console.error('FAILED:', err.message); process.exit(1); });
