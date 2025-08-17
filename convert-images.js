#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

console.log('🚀 Starting PNG to WebP conversion...\n');

// Check if sharp is available (npm install sharp)
let useSharp = false;
try {
  require('sharp');
  useSharp = true;
  console.log('✅ Using Sharp for conversion (better quality)');
} catch (e) {
  console.log('⚠️  Sharp not found, trying ImageMagick...');

  // Check ImageMagick
  try {
    await execAsync('magick -version');
    console.log('✅ Using ImageMagick for conversion');
  } catch (e) {
    console.log('❌ Neither Sharp nor ImageMagick found!');
    console.log('Please install one of:');
    console.log('  • npm install sharp (recommended)');
    console.log('  • ImageMagick: https://imagemagick.org/script/download.php');
    process.exit(1);
  }
}

// Sharp conversion function
async function convertWithSharp(inputPath, outputPath, quality = 85) {
  const sharp = require('sharp');

  try {
    await sharp(inputPath)
      .webp({
        quality: quality,
        effort: 6, // Max compression effort
        lossless: false, // Use lossy for better compression
      })
      .toFile(outputPath);

    return true;
  } catch (error) {
    console.error(
      `❌ Sharp conversion failed for ${inputPath}:`,
      error.message
    );
    return false;
  }
}

// ImageMagick conversion function
async function convertWithImageMagick(inputPath, outputPath, quality = 85) {
  try {
    await execAsync(
      `magick "${inputPath}" -quality ${quality} "${outputPath}"`
    );
    return true;
  } catch (error) {
    console.error(
      `❌ ImageMagick conversion failed for ${inputPath}:`,
      error.message
    );
    return false;
  }
}

// Generic conversion function
async function convertToWebP(inputPath, outputPath, quality = 85) {
  if (useSharp) {
    return await convertWithSharp(inputPath, outputPath, quality);
  } else {
    return await convertWithImageMagick(inputPath, outputPath, quality);
  }
}

// Get file size
function getFileSize(filePath) {
  try {
    return fs.statSync(filePath).size;
  } catch (e) {
    return 0;
  }
}

// Find all PNG files
function findPngFiles(dir) {
  const files = [];

  function scanDir(currentDir) {
    try {
      const items = fs.readdirSync(currentDir);

      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          scanDir(fullPath);
        } else if (item.toLowerCase().endsWith('.png')) {
          files.push(fullPath);
        }
      }
    } catch (e) {
      console.error(`Error scanning ${currentDir}:`, e.message);
    }
  }

  scanDir(dir);
  return files;
}

// Main conversion process
async function main() {
  const publicDir = path.join(__dirname, 'public');

  if (!fs.existsSync(publicDir)) {
    console.error('❌ Public directory not found!');
    process.exit(1);
  }

  console.log('📁 Scanning for PNG files...\n');

  const pngFiles = findPngFiles(publicDir);
  console.log(`Found ${pngFiles.length} PNG files to convert\n`);

  let convertedCount = 0;
  let totalOriginalSize = 0;
  let totalWebPSize = 0;
  let failedFiles = [];

  // Process each file
  for (const pngFile of pngFiles) {
    const webpFile = pngFile.replace(/\.png$/i, '.webp');
    const relativePath = path.relative(publicDir, pngFile);

    // Determine quality based on file type
    let quality = 85; // Default for team logos
    if (pngFile.includes('league_logos')) {
      quality = 90; // Higher quality for league logos
    }

    console.log(`🔄 Converting ${relativePath}...`);

    const originalSize = getFileSize(pngFile);
    totalOriginalSize += originalSize;

    const success = await convertToWebP(pngFile, webpFile, quality);

    if (success) {
      const webpSize = getFileSize(webpFile);
      totalWebPSize += webpSize;

      const savings = ((originalSize - webpSize) / originalSize) * 100;
      const savingsKB = Math.round((originalSize - webpSize) / 1024);

      console.log(
        `  ✅ ${path.basename(webpFile)} (${savings.toFixed(
          1
        )}% smaller, -${savingsKB}KB)`
      );
      convertedCount++;
    } else {
      failedFiles.push(relativePath);
      console.log(`  ❌ Failed to convert ${relativePath}`);
    }
  }

  // Summary
  const totalSavings = totalOriginalSize - totalWebPSize;
  const overallSavings = (totalSavings / totalOriginalSize) * 100;
  const savingsKB = Math.round(totalSavings / 1024);
  const savingsMB = (totalSavings / 1024 / 1024).toFixed(2);

  console.log('\n🎉 CONVERSION COMPLETE!\n');
  console.log('📊 Summary:');
  console.log(`  • Files converted: ${convertedCount}/${pngFiles.length}`);
  console.log(`  • Space saved: ${savingsKB} KB (${savingsMB} MB)`);
  console.log(`  • Overall compression: ${overallSavings.toFixed(1)}%`);

  if (failedFiles.length > 0) {
    console.log('\n⚠️  Failed conversions:');
    failedFiles.forEach((file) => console.log(`  • ${file}`));
  }

  console.log('\n💡 Next steps:');
  console.log('  1. Test your application to ensure all images load correctly');
  console.log('  2. Consider removing original PNG files after testing');
  console.log('  3. Your app now has WebP images with PNG fallback support!');

  console.log('\n🚀 Performance improvement achieved! 🎯');
}

// Run the conversion
main().catch(console.error);
