const fs = require('fs');
const path = require('path');

// Read the CSS file
const cssPath = path.join(__dirname, 'frontend', 'src', 'index.css');
let css = fs.readFileSync(cssPath, 'utf8');

// Function to adjust pixel values by 85% (round to nearest integer)
function adjustValue(match, value) {
  const num = parseInt(value);
  // Don't adjust border widths (1-3px), very small values (1-2px), or line-height
  if (num <= 3) return match;

  const adjusted = Math.round(num * 0.85);
  return match.replace(value + 'px', adjusted + 'px');
}

// Adjust padding values
css = css.replace(/padding(-\w+)?:\s*(\d+)px/g, adjustValue);

// Adjust margin values
css = css.replace(/margin(-\w+)?:\s*(\d+)px/g, adjustValue);

// Adjust gap values
css = css.replace(/gap:\s*(\d+)px/g, adjustValue);

// Adjust height values (but be selective - only adjust heights > 10px)
css = css.replace(/height:\s*(\d+)px/g, (match, value) => {
  const num = parseInt(value);
  if (num <= 10) return match;
  const adjusted = Math.round(num * 0.85);
  return match.replace(value + 'px', adjusted + 'px');
});

// Adjust width values for specific components (not all widths)
css = css.replace(/(min-width|max-width):\s*(\d+)px/g, (match, prop, value) => {
  const num = parseInt(value);
  // Only adjust specific panel/sidebar widths
  if (num >= 200 && num <= 400) {
    const adjusted = Math.round(num * 0.85);
    return match.replace(value + 'px', adjusted + 'px');
  }
  return match;
});

// Write the adjusted CSS back
fs.writeFileSync(cssPath, css, 'utf8');

console.log('✓ CSS spacing adjusted to 85% density');
console.log('✓ Padding, margin, gap, and selective heights reduced');
console.log('✓ Border widths and small values preserved');
