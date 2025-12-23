

KeyStore Name :- PDFIMAGETOOLBOX.jks
KeyStore Password :- Sridix@123
KeyAlias :- PDFIMAGETOOLBOXANDROID



    

npm start -- --reset-cache


adb connect 192.168.00.00:5553


npm run build_android
npm run assemblePDFDispatchRelease


adb uninstall com.pdfimagetoolbox






































// android/app/src/main/java/com/yourapp/PdfResizerModule.java
package com.pdfimagetoolbox;

import android.util.Log;
import android.graphics.Bitmap;
import android.graphics.pdf.PdfRenderer;
import android.graphics.pdf.PdfDocument;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Matrix;
import android.os.ParcelFileDescriptor;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

public class PdfResizerModule extends ReactContextBaseJavaModule {
    private static final String TAG = "PdfResizerModule";
    private static final int MAX_BITMAP_PIXELS = 1024 * 1024; // 1MP limit
    
    public PdfResizerModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return "PdfResizer";
    }

    @ReactMethod
    public void generatePreview(String pdfPath, int pageIndex, Promise promise) {
        ParcelFileDescriptor fileDescriptor = null;
        PdfRenderer renderer = null;
        PdfRenderer.Page page = null;
        Bitmap bitmap = null;
        
        try {
            fileDescriptor = ParcelFileDescriptor.open(new File(pdfPath), ParcelFileDescriptor.MODE_READ_ONLY);
            renderer = new PdfRenderer(fileDescriptor);
            if (pageIndex >= renderer.getPageCount()) {
                promise.reject("INVALID_PAGE", "Page index out of bounds");
                return;
            }
            page = renderer.openPage(pageIndex);

            int width = page.getWidth();
            int height = page.getHeight();
            
            // Scale down for preview to prevent OOM
            float scale = calculateSafeScale(width, height);
            int scaledWidth = (int) (width * scale);
            int scaledHeight = (int) (height * scale);
            
            bitmap = Bitmap.createBitmap(scaledWidth, scaledHeight, Bitmap.Config.ARGB_8888);
            
            // Use matrix for scaling
            Matrix matrix = new Matrix();
            matrix.postScale(scale, scale);
            page.render(bitmap, null, matrix, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY);

            File cacheDir = getReactApplicationContext().getCacheDir();
            File imageFile = new File(cacheDir, "pdf_preview_" + System.currentTimeMillis() + ".png");
            FileOutputStream outputStream = new FileOutputStream(imageFile);
            bitmap.compress(Bitmap.CompressFormat.PNG, 85, outputStream);
            outputStream.close();

            promise.resolve(imageFile.getAbsolutePath());

        } catch (Exception e) {
            Log.e(TAG, "Preview generation failed: " + e.getMessage(), e);
            promise.reject("PREVIEW_ERROR", e.getMessage());
        } finally {
            // Always cleanup resources
            if (bitmap != null) bitmap.recycle();
            if (page != null) page.close();
            if (renderer != null) renderer.close();
            if (fileDescriptor != null) {
                try {
                    fileDescriptor.close();
                } catch (IOException e) {
                    Log.e(TAG, "Error closing file descriptor", e);
                }
            }
        }
    }
    
    @ReactMethod
    public void resizePdf(String inputPath, ReadableMap options, Promise promise) {
        Log.d(TAG, "=== STARTING PDF COMPRESSION ===");
        
        try {
            File inputFile = new File(inputPath);
            if (!inputFile.exists()) {
                promise.reject("FILE_NOT_FOUND", "Input PDF file not found at " + inputPath);
                return;
            }

            long originalSize = inputFile.length();
            Log.d(TAG, "Original file size: " + (originalSize / 1024) + " KB");
            
            String quality = options.hasKey("quality") ? options.getString("quality") : "medium";
            String outputPath = options.hasKey("outputPath") ? options.getString("outputPath") : null;
            
            if (outputPath == null) {
                promise.reject("INVALID_OUTPUT_PATH", "Output path is required.");
                return;
            }

            Log.d(TAG, "Quality: " + quality + ", Output: " + outputPath);

            // Check if file is already small - no need to compress further
            if (originalSize < 200 * 1024) { // Less than 200KB
                handleSmallFile(inputFile, quality, outputPath, originalSize, promise);
            } else {
                // Use compression for larger files
                compressPdfSinglePass(inputFile, quality, outputPath, promise);
            }
            
        } catch (Exception e) {
            Log.e(TAG, "Error in resizePdf: " + e.getMessage(), e);
            promise.reject("PDF_RESIZE_ERROR", "Error during PDF resize: " + e.getMessage(), e);
        }
    }

    private void handleSmallFile(File inputFile, String quality, String outputPath, long originalSize, Promise promise) {
        ParcelFileDescriptor fileDescriptor = null;
        PdfRenderer renderer = null;
        
        try {
            Log.d(TAG, "Small file detected (" + (originalSize/1024) + "KB), using optimized compression");
            
            fileDescriptor = ParcelFileDescriptor.open(inputFile, ParcelFileDescriptor.MODE_READ_ONLY);
            renderer = new PdfRenderer(fileDescriptor);
            
            int pageCount = renderer.getPageCount();
            
            // For small files, use very low DPI to ensure compression
            int dpi = getOptimizedDpiForSmallFile(quality, originalSize, pageCount);
            Log.d(TAG, "Using optimized DPI for small file: " + dpi);
            
            File outputFile = new File(outputPath);
            long compressedSize = compressWithOptimizedSettings(renderer, outputFile, dpi);
            
            // If compression made file larger, return the original file
            if (compressedSize >= originalSize) {
                Log.d(TAG, "Compression would increase file size, returning original file");
                // Copy original file to output path
                copyFile(inputFile, outputFile);
                compressedSize = originalSize;
                dpi = 0; // Indicates original file was used
            }
            
            double compressionRatio = (1 - (double) compressedSize / originalSize) * 100;
            
            WritableMap result = Arguments.createMap();
            result.putString("filePath", outputPath);
            result.putDouble("size", compressedSize);
            result.putDouble("originalSize", originalSize);
            result.putDouble("compressionRatio", compressionRatio);
            result.putInt("finalDpi", dpi);
            
            Log.d(TAG, "✅ SMALL FILE COMPRESSION: " + 
                  (originalSize / 1024) + "KB → " + 
                  (compressedSize / 1024) + "KB (" + 
                  String.format("%.1f", compressionRatio) + "% reduction)");
            
            promise.resolve(result);
            
        } catch (Exception e) {
            Log.e(TAG, "Small file compression failed: " + e.getMessage(), e);
            promise.reject("COMPRESSION_ERROR", "Failed to compress small PDF: " + e.getMessage(), e);
        } finally {
            if (renderer != null) renderer.close();
            if (fileDescriptor != null) {
                try {
                    fileDescriptor.close();
                } catch (IOException e) {
                    Log.e(TAG, "Error closing file descriptor", e);
                }
            }
        }
    }

    private void compressPdfSinglePass(File inputFile, String quality, String outputPath, Promise promise) {
        ParcelFileDescriptor fileDescriptor = null;
        PdfRenderer renderer = null;
        
        try {
            fileDescriptor = ParcelFileDescriptor.open(inputFile, ParcelFileDescriptor.MODE_READ_ONLY);
            renderer = new PdfRenderer(fileDescriptor);
            
            int pageCount = renderer.getPageCount();
            long originalSize = inputFile.length();
            
            Log.d(TAG, "Processing PDF - Pages: " + pageCount + ", Size: " + (originalSize / (1024 * 1024)) + "MB");

            // Use smart DPI values based on file size
            int dpi = getSmartDpi(quality, originalSize, pageCount);
            Log.d(TAG, "Using smart DPI: " + dpi);
            
            File outputFile = new File(outputPath);
            long compressedSize = compressWithOptimizedSettings(renderer, outputFile, dpi);
            
            // If compression made file larger, use fallback strategy
            if (compressedSize >= originalSize) {
                Log.d(TAG, "Compression ineffective, trying lower DPI");
                compressedSize = compressWithLowerDpi(renderer, outputFile, dpi);
            }
            
            // Final fallback - if still larger, return original
            if (compressedSize >= originalSize) {
                Log.d(TAG, "Compression would increase file size, returning original");
                copyFile(inputFile, outputFile);
                compressedSize = originalSize;
                dpi = 0; // Indicates original file was used
            }
            
            double compressionRatio = (1 - (double) compressedSize / originalSize) * 100;
            
            WritableMap result = Arguments.createMap();
            result.putString("filePath", outputPath);
            result.putDouble("size", compressedSize);
            result.putDouble("originalSize", originalSize);
            result.putDouble("compressionRatio", compressionRatio);
            result.putInt("finalDpi", dpi);
            
            Log.d(TAG, "✅ COMPRESSION SUCCESS: " + 
                  (originalSize / 1024) + "KB → " + 
                  (compressedSize / 1024) + "KB (" + 
                  String.format("%.1f", compressionRatio) + "% reduction)");
            
            promise.resolve(result);
            
        } catch (OutOfMemoryError e) {
            Log.e(TAG, "⚠️ OutOfMemory - File too large: " + e.getMessage());
            promise.reject("OUT_OF_MEMORY", "PDF is too large to process. Try a smaller file or lower quality.");
        } catch (Exception e) {
            Log.e(TAG, "❌ Compression failed: " + e.getMessage(), e);
            promise.reject("COMPRESSION_ERROR", "Failed to compress PDF: " + e.getMessage(), e);
        } finally {
            if (renderer != null) renderer.close();
            if (fileDescriptor != null) {
                try {
                    fileDescriptor.close();
                } catch (IOException e) {
                    Log.e(TAG, "Error closing file descriptor", e);
                }
            }
        }
    }

    private int getSmartDpi(String quality, long fileSize, int pageCount) {
        // Smart DPI calculation based on file size
        int baseDpi;
        switch (quality.toLowerCase()) {
            case "low": 
                baseDpi = 72;
                break;
            case "medium": 
                baseDpi = 96;
                break;
            case "high": 
                baseDpi = 120;
                break;
            default: 
                baseDpi = 96;
        }
        
        // Adjust DPI based on file size
        if (fileSize < 200 * 1024) { // < 200KB - very small files
            baseDpi = Math.max(40, baseDpi - 40);
        } else if (fileSize < 1024 * 1024) { // < 1MB - small files
            baseDpi = Math.max(50, baseDpi - 30);
        } else if (fileSize > 100 * 1024 * 1024) { // > 100MB - very large files
            baseDpi = Math.max(40, baseDpi - 40);
        } else if (fileSize > 50 * 1024 * 1024) { // > 50MB - large files
            baseDpi = Math.max(50, baseDpi - 30);
        } else if (fileSize > 10 * 1024 * 1024) { // > 10MB - medium files
            baseDpi = Math.max(60, baseDpi - 20);
        }
        
        // Adjust for page count
        if (pageCount > 50) {
            baseDpi = Math.max(40, baseDpi - 10);
        } else if (pageCount > 20) {
            baseDpi = Math.max(50, baseDpi - 5);
        }
        
        Log.d(TAG, "Smart DPI: " + baseDpi + " for " + (fileSize / 1024) + "KB, " + pageCount + " pages");
        return baseDpi;
    }

    private int getOptimizedDpiForSmallFile(String quality, long fileSize, int pageCount) {
        // Very low DPI for small files to ensure compression
        int baseDpi;
        switch (quality.toLowerCase()) {
            case "low": 
                baseDpi = 40;
                break;
            case "medium": 
                baseDpi = 50;
                break;
            case "high": 
                baseDpi = 60;
                break;
            default: 
                baseDpi = 50;
        }
        
        // Even lower for very small files
        if (fileSize < 100 * 1024) { // < 100KB
            baseDpi = Math.max(30, baseDpi - 10);
        }
        
        return baseDpi;
    }

    private long compressWithLowerDpi(PdfRenderer renderer, File outputFile, int originalDpi) throws IOException {
        // Try with even lower DPI
        int lowerDpi = Math.max(30, originalDpi - 20);
        Log.d(TAG, "Trying lower DPI: " + lowerDpi);
        return compressWithOptimizedSettings(renderer, outputFile, lowerDpi);
    }

    private long compressWithOptimizedSettings(PdfRenderer renderer, File outputFile, int dpi) throws IOException {
        PdfDocument document = new PdfDocument();
        FileOutputStream outputStream = null;
        
        try {
            double scaleFactor = dpi / 72.0;
            int pageCount = renderer.getPageCount();
            
            Log.d(TAG, "Compressing " + pageCount + " pages with DPI: " + dpi);
            
            for (int i = 0; i < pageCount; i++) {
                PdfRenderer.Page page = renderer.openPage(i);
                Bitmap bitmap = null;
                
                try {
                    int originalWidth = page.getWidth();
                    int originalHeight = page.getHeight();
                    
                    Log.d(TAG, "Page " + (i+1) + " original: " + originalWidth + "x" + originalHeight);
                    
                    // Calculate dimensions with DPI scaling
                    int pageWidth = (int) (originalWidth * scaleFactor);
                    int pageHeight = (int) (originalHeight * scaleFactor);
                    
                    // Apply optimized limits
                    int[] safeDims = getOptimizedDimensions(pageWidth, pageHeight, dpi);
                    pageWidth = safeDims[0];
                    pageHeight = safeDims[1];
                    
                    Log.d(TAG, "Page " + (i+1) + " compressed: " + pageWidth + "x" + pageHeight);
                    
                    // Create bitmap with optimized dimensions
                    bitmap = Bitmap.createBitmap(pageWidth, pageHeight, Bitmap.Config.ARGB_8888);
                    
                    // Render with scaling matrix
                    Matrix matrix = new Matrix();
                    float scaleX = (float) pageWidth / originalWidth;
                    float scaleY = (float) pageHeight / originalHeight;
                    matrix.postScale(scaleX, scaleY);
                    
                    page.render(bitmap, null, matrix, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY);
                    
                    // Create PDF page
                    PdfDocument.PageInfo pageInfo = new PdfDocument.PageInfo.Builder(pageWidth, pageHeight, i).create();
                    PdfDocument.Page newPage = document.startPage(pageInfo);
                    Canvas canvas = newPage.getCanvas();
                    canvas.drawColor(Color.WHITE);
                    canvas.drawBitmap(bitmap, 0, 0, null);
                    document.finishPage(newPage);
                    
                } finally {
                    // Always recycle bitmap immediately
                    if (bitmap != null) {
                        bitmap.recycle();
                    }
                    page.close();
                }
                
                // Force garbage collection every few pages
                if (i % 3 == 0) {
                    System.gc();
                }
            }
            
            // Ensure output directory
            File outputDir = outputFile.getParentFile();
            if (outputDir != null && !outputDir.exists()) {
                outputDir.mkdirs();
            }
            
            // Write PDF
            outputStream = new FileOutputStream(outputFile);
            document.writeTo(outputStream);
            
            Log.d(TAG, "PDF written successfully to: " + outputFile.getAbsolutePath());
            
        } finally {
            document.close();
            if (outputStream != null) {
                try {
                    outputStream.close();
                } catch (IOException e) {
                    Log.e(TAG, "Error closing output stream", e);
                }
            }
        }
        
        return outputFile.length();
    }
    
    private int[] getOptimizedDimensions(int width, int height, int dpi) {
        // Optimized limits based on DPI
        int maxDimension;
        if (dpi <= 50) {
            maxDimension = 800;  // Very low DPI - small dimensions
        } else if (dpi <= 80) {
            maxDimension = 1000; // Low DPI - medium dimensions
        } else {
            maxDimension = 1200; // Normal DPI - larger dimensions
        }
        
        if (width > maxDimension || height > maxDimension) {
            float scale = Math.min((float) maxDimension / width, (float) maxDimension / height);
            width = (int) (width * scale);
            height = (int) (height * scale);
            Log.d(TAG, "Scaled dimensions to: " + width + "x" + height);
        }
        
        // Ensure minimum dimensions
        width = Math.max(100, width);
        height = Math.max(100, height);
        
        return new int[]{width, height};
    }
    
    private void copyFile(File source, File dest) throws IOException {
        try (InputStream in = new java.io.FileInputStream(source);
             OutputStream out = new java.io.FileOutputStream(dest)) {
            byte[] buffer = new byte[1024];
            int length;
            while ((length = in.read(buffer)) > 0) {
                out.write(buffer, 0, length);
            }
        }
    }
    
    private float calculateSafeScale(int width, int height) {
        long pixels = (long) width * height;
        if (pixels > MAX_BITMAP_PIXELS) {
            return (float) Math.sqrt((double) MAX_BITMAP_PIXELS / pixels);
        }
        return 1.0f;
    }
}








// import android.graphics.pdf.PdfDocument;
// import android.graphics.Canvas;
// import android.graphics.Color;
// import android.os.ParcelFileDescriptor;
// import com.facebook.react.bridge.Promise;
// import com.facebook.react.bridge.ReactApplicationContext;
// import com.facebook.react.bridge.ReactContextBaseJavaModule;
// import com.facebook.react.bridge.ReactMethod;
// import com.facebook.react.bridge.ReadableMap;
// import com.facebook.react.bridge.WritableMap;
// import com.facebook.react.bridge.Arguments;

// import java.io.File;
// import java.io.FileOutputStream;
// import java.io.IOException;
// import java.io.ByteArrayOutputStream;
// import java.io.InputStream;
// import java.io.FileInputStream;

// public class PdfResizerModule extends ReactContextBaseJavaModule {
//     private static final String TAG = "PdfResizerModule";
    
//     public PdfResizerModule(ReactApplicationContext reactContext) {
//         super(reactContext);
//     }

//     @Override
//     public String getName() {
//         return "PdfResizer";
//     }

//     @ReactMethod
//     public void generatePreview(String pdfPath, int pageIndex, Promise promise) {
//         try {
//             ParcelFileDescriptor fileDescriptor = ParcelFileDescriptor.open(new File(pdfPath), ParcelFileDescriptor.MODE_READ_ONLY);
//             PdfRenderer renderer = new PdfRenderer(fileDescriptor);
//             if (pageIndex >= renderer.getPageCount()) {
//                 promise.reject("INVALID_PAGE", "Page index out of bounds");
//                 return;
//             }
//             PdfRenderer.Page page = renderer.openPage(pageIndex);

//             int width = page.getWidth();
//             int height = page.getHeight();
//             Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
//             page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY);
//             page.close();
//             renderer.close();
//             fileDescriptor.close();

//             File cacheDir = getReactApplicationContext().getCacheDir();
//             File imageFile = new File(cacheDir, "pdf_preview_" + System.currentTimeMillis() + ".png");
//             FileOutputStream outputStream = new FileOutputStream(imageFile);
//             bitmap.compress(Bitmap.CompressFormat.PNG, 100, outputStream);
//             outputStream.close();

//             promise.resolve(imageFile.getAbsolutePath());

//         } catch (Exception e) {
//             e.printStackTrace();
//             promise.reject("PREVIEW_ERROR", e.getMessage());
//         }
//     }
    
//     @ReactMethod
//     public void resizePdf(String inputPath, ReadableMap options, Promise promise) {
//         try {
//             File inputFile = new File(inputPath);
//             if (!inputFile.exists()) {
//                 promise.reject("FILE_NOT_FOUND", "Input PDF file not found at " + inputPath);
//                 return;
//             }

//             // Get original file size
//             long originalSize = inputFile.length();
//             Log.d(TAG, "Original file size: " + originalSize + " bytes");
            
//             // Extract parameters
//             String quality = options.hasKey("quality") ? options.getString("quality") : "medium";
//             String outputPath = options.hasKey("outputPath") ? options.getString("outputPath") : null;
            
//             if (outputPath == null) {
//                 promise.reject("INVALID_OUTPUT_PATH", "Output path is required.");
//                 return;
//             }

//             // Calculate target size based on quality
//             long targetSize = calculateTargetSize(originalSize, quality);
//             Log.d(TAG, "Target size for " + quality + " quality: " + targetSize + " bytes");
            
//             resizePdfToTargetSize(inputFile, originalSize, targetSize, quality, outputPath, promise);
//         } catch (Exception e) {
//             Log.e(TAG, "Error in resizePdf: " + e.getMessage(), e);
//             promise.reject("PDF_RESIZE_ERROR", "Error during PDF resize operation: " + e.getMessage(), e);
//         }
//     }

//     private long calculateTargetSize(long originalSize, String quality) {
//         switch (quality.toLowerCase()) {
//            case "low":
//                 return (long) (originalSize * 0.3); // 30% of original size
//             case "medium":
//                 return (long) (originalSize * 0.55); // 50% of original size
//             case "high":
//                 return (long) (originalSize * 0.7); // 70% of original size
//             default:
//                 return (long) (originalSize * 0.5); // Default to 50%
//         }
//     }

//     private void resizePdfToTargetSize(File inputFile, long originalSize, long targetSize, String quality, String outputPath, Promise promise) {
//         ParcelFileDescriptor fileDescriptor = null;
//         PdfRenderer renderer = null;
        
//         try {
//             fileDescriptor = ParcelFileDescriptor.open(inputFile, ParcelFileDescriptor.MODE_READ_ONLY);
//             renderer = new PdfRenderer(fileDescriptor);
            
//             // Start with high quality and gradually reduce until we reach target size
//             int currentDpi = getInitialDpi(quality);
//             int minDpi = 50; // Minimum DPI to maintain readability
//             int maxDpi = 300; // Maximum DPI
            
//             File bestOutputFile = null;
//             long bestSize = originalSize;
//             int bestDpi = currentDpi;
            
//             // Try multiple DPI values to find the best match for target size
//             for (int attempt = 0; attempt < 5; attempt++) {
//                 File outputFile = new File(outputPath + "_attempt_" + attempt + ".pdf");
                
//                 try {
//                     long compressedSize = compressPdfWithDpi(renderer, outputFile, currentDpi);
//                     Log.d(TAG, "Attempt " + attempt + " with DPI " + currentDpi + ": " + compressedSize + " bytes");
                    
//                     // Check if this is better than our previous best
//                     if (Math.abs(compressedSize - targetSize) < Math.abs(bestSize - targetSize)) {
//                         bestSize = compressedSize;
//                         bestDpi = currentDpi;
//                         bestOutputFile = outputFile;
//                     }
                    
//                     // If we're close enough to target, stop
//                     if (compressedSize <= targetSize * 1.1) { // Within 10% of target
//                         break;
//                     }
                    
//                     // Adjust DPI for next attempt
//                     if (compressedSize > targetSize) {
//                         // File too big, reduce DPI
//                         currentDpi = Math.max(minDpi, (int)(currentDpi * 0.7));
//                     } else {
//                         // File too small, increase DPI slightly
//                         currentDpi = Math.min(maxDpi, (int)(currentDpi * 1.1));
//                     }
                    
//                 } catch (Exception e) {
//                     Log.e(TAG, "Compression attempt failed: " + e.getMessage());
//                     continue;
//                 }
//             }
            
//             // Use the best result we found
//             if (bestOutputFile != null && bestOutputFile.exists()) {
//                 // Rename the best file to the final output path
//                 File finalOutputFile = new File(outputPath);
//                 if (bestOutputFile.renameTo(finalOutputFile)) {
//                     double compressionRatio = (1 - (double) bestSize / originalSize) * 100;
                    
//                     WritableMap result = Arguments.createMap();
//                     result.putString("filePath", outputPath);
//                     result.putDouble("size", bestSize);
//                     result.putDouble("originalSize", originalSize);
//                     result.putDouble("compressionRatio", compressionRatio);
//                     result.putInt("finalDpi", bestDpi);
                    
//                     Log.d(TAG, "Final compression - Original: " + originalSize + 
//                           ", Compressed: " + bestSize + 
//                           ", Ratio: " + String.format("%.2f", compressionRatio) + "%" +
//                           ", DPI: " + bestDpi);
                    
//                     promise.resolve(result);
//                 } else {
//                     promise.reject("RENAME_ERROR", "Failed to rename output file");
//                 }
//             } else {
//                 promise.reject("COMPRESSION_FAILED", "No suitable compression level found");
//             }
            
//         } catch (Exception e) {
//             promise.reject("PDFRESIZEERROR", e.getMessage(), e);
//         } finally {
//             if (renderer != null) renderer.close();
//             if (fileDescriptor != null) {
//     try {
//         fileDescriptor.close();
//     } catch (IOException e) {
//         Log.e(TAG, "Error closing file descriptor: " + e.getMessage());
//     }
// }
            
//         }
//     }
    
// private int getInitialDpi(String quality) {
//     switch (quality.toLowerCase()) {
//         case "low": return 100;    // Increased from 60
//         case "medium": return 150; // Increased from 100
//         case "high": return 200;   // Increased from 150
//         default: return 150;
//     }
// }
    
//     private long compressPdfWithDpi(PdfRenderer renderer, File outputFile, int dpi) throws IOException {
//         PdfDocument document = null;
//         FileOutputStream outputStream = null;
        
//         try {
//             document = new PdfDocument();
//             double scaleFactor = dpi / 72.0;
//             int pageCount = renderer.getPageCount();
            
//             for (int i = 0; i < pageCount; i++) {
//                 PdfRenderer.Page page = renderer.openPage(i);
                
//                 try {
//                     int pageWidth = (int) (page.getWidth() * scaleFactor);
//                     int pageHeight = (int) (page.getHeight() * scaleFactor);
                    
//                     // Ensure minimum dimensions
//                     pageWidth = Math.max(100, pageWidth);
//                     pageHeight = Math.max(100, pageHeight);
                    
//                     Bitmap bitmap = Bitmap.createBitmap(pageWidth, pageHeight, Bitmap.Config.ARGB_8888);
//                     page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY);
                    
//                     PdfDocument.PageInfo pageInfo = new PdfDocument.PageInfo.Builder(pageWidth, pageHeight, i).create();
//                     PdfDocument.Page newPage = document.startPage(pageInfo);
//                     Canvas canvas = newPage.getCanvas();
//                     canvas.drawColor(Color.WHITE);
//                     canvas.drawBitmap(bitmap, 0, 0, null);
//                     document.finishPage(newPage);
                    
//                     bitmap.recycle();
//                 } finally {
//                     page.close();
//                 }
//             }
            
//             // Ensure output directory exists
//             File outputDir = outputFile.getParentFile();
//             if (outputDir != null && !outputDir.exists()) {
//                 outputDir.mkdirs();
//             }
            
//             outputStream = new FileOutputStream(outputFile);
//             document.writeTo(outputStream);
            
//         } finally {
//             if (document != null) document.close();
//             if (outputStream != null) outputStream.close();
//         }
        
//         return outputFile.length();
//     }
    
    
//     private byte[] readFileToBytes(File file) throws IOException {
//         ByteArrayOutputStream ous = null;
//         InputStream ios = null;
//         try {
//             ous = new ByteArrayOutputStream();
//             ios = new FileInputStream(file);
//             byte[] buffer = new byte[4096];
//             int read = 0;
//             while ((read = ios.read(buffer)) != -1) {
//                 ous.write(buffer, 0, read);
//             }
//         } finally {
//             try {
//                 if (ous != null) {
//                     ous.close();
//                 }
//             } catch (IOException e) {
//                 Log.w(TAG, "Error closing output stream: " + e.getMessage());
//             }
//             try {
//                 if (ios != null) {
//                     ios.close();
//                 }
//             } catch (IOException e) {
//                 Log.w(TAG, "Error closing input stream: " + e.getMessage());
//             }
//         }
//         return ous.toByteArray();
//     }
// }









// // android/app/src/main/java/com/pdfimagetoolbox/PdfResizerModule.java
// package com.pdfimagetoolbox;

// import android.util.Log;
// import android.graphics.Bitmap;
// import android.graphics.pdf.PdfRenderer;
// import android.graphics.pdf.PdfDocument;
// import android.graphics.Canvas;
// import android.graphics.Color;
// import android.graphics.Rect;
// import android.os.ParcelFileDescriptor;
// import com.facebook.react.bridge.Promise;
// import com.facebook.react.bridge.ReactApplicationContext;
// import com.facebook.react.bridge.ReactContextBaseJavaModule;
// import com.facebook.react.bridge.ReactMethod;
// import com.facebook.react.bridge.ReadableMap;
// import com.facebook.react.bridge.WritableMap;
// import com.facebook.react.bridge.Arguments;
// import java.io.File;
// import java.io.FileOutputStream;
// import java.io.IOException;
// import java.io.ByteArrayOutputStream;
// import java.io.InputStream;
// import java.io.FileInputStream;
// import android.util.Base64;

// public class PdfResizerModule extends ReactContextBaseJavaModule {
//     private static final String TAG = "PdfResizerModule";
    
//     public PdfResizerModule(ReactApplicationContext context) {
//         super(context);
//     }
    
//     @Override
//     public String getName() {
//         return "PdfResizer";
//     }
    
//     @ReactMethod
//     public void resizePdf(String inputPath, ReadableMap options, Promise promise) {
//         try {
//             Log.d(TAG, "=== PDF RESIZE START ===");
//             Log.d(TAG, "Input path received: " + inputPath);
            
//             double width = options.hasKey("width") ? options.getDouble("width") : 0;
//             double height = options.hasKey("height") ? options.getDouble("height") : 0;
//             String outputPath = options.hasKey("outputPath") ? options.getString("outputPath") : 
//                 inputPath.replace(".pdf", "_resized.pdf");
            
//             Log.d(TAG, "Width: " + width + ", Height: " + height);
//             Log.d(TAG, "Output path: " + outputPath);
            
//             if (width <= 0 || height <= 0) {
//                 promise.reject("INVALID_DIMENSIONS", "Width and height must be positive");
//                 return;
//             }
            
//             // Try to find the file with different path formats
//             File inputFile = findInputFile(inputPath);
//             if (inputFile == null || !inputFile.exists()) {
//                 Log.e(TAG, "File not found after all attempts");
//                 promise.reject("FILE_NOT_FOUND", "Input file not found at: " + inputPath);
//                 return;
//             }
            
//             Log.d(TAG, "Final file path: " + inputFile.getAbsolutePath());
//             Log.d(TAG, "File exists: " + inputFile.exists());
//             Log.d(TAG, "File size: " + inputFile.length() + " bytes");
            
//             resizePdfFile(inputFile, (int) width, (int) height, outputPath, promise);
//         } catch (Exception e) {
//             Log.e(TAG, "Error in resizePdf: " + e.getMessage(), e);
//             promise.reject("PDF_ERROR", "Failed to resize PDF: " + e.getMessage(), e);
//         }
//     }
    
//     private File findInputFile(String inputPath) {
//         Log.d(TAG, "Attempting to find input file...");
        
//         // Try the original path first
//         File file = new File(inputPath);
//         if (file.exists()) {
//             Log.d(TAG, "File found at original path: " + file.getAbsolutePath());
//             return file;
//         }
        
//         // Try removing "file://" prefix if present
//         if (inputPath.startsWith("file://")) {
//             String cleanPath = inputPath.substring(7); // Remove "file://"
//             file = new File(cleanPath);
//             if (file.exists()) {
//                 Log.d(TAG, "File found after removing file:// prefix: " + file.getAbsolutePath());
//                 return file;
//             }
//         }
        
//         // Try with URI decoding
//         try {
//             String decodedPath = java.net.URLDecoder.decode(inputPath, "UTF-8");
//             file = new File(decodedPath);
//             if (file.exists()) {
//                 Log.d(TAG, "File found after URI decoding: " + file.getAbsolutePath());
//                 return file;
//             }
//         } catch (Exception e) {
//             Log.w(TAG, "URI decoding failed: " + e.getMessage());
//         }
        
//         // Try in external storage directories
//         String[] possiblePaths = {
//             "/sdcard/" + new File(inputPath).getName(),
//             android.os.Environment.getExternalStorageDirectory() + "/" + new File(inputPath).getName(),
//             android.os.Environment.getExternalStoragePublicDirectory(android.os.Environment.DIRECTORY_DOWNLOADS) + "/" + new File(inputPath).getName(),
//             getReactApplicationContext().getExternalFilesDir(null) + "/" + new File(inputPath).getName(),
//             getReactApplicationContext().getFilesDir() + "/" + new File(inputPath).getName(),
//             getReactApplicationContext().getCacheDir() + "/" + new File(inputPath).getName()
//         };
        
//         for (String path : possiblePaths) {
//             file = new File(path);
//             if (file.exists()) {
//                 Log.d(TAG, "File found in alternative location: " + file.getAbsolutePath());
//                 return file;
//             }
//         }
        
//         Log.e(TAG, "File not found in any location");
//         return null;
//     }
    
//     private void resizePdfFile(File inputFile, int width, int height, String outputPath, Promise promise) {
//         try {
//             Log.d(TAG, "=== RESIZE PDF FILE START ===");
//             Log.d(TAG, "Input file: " + inputFile.getAbsolutePath());
//             Log.d(TAG, "Target size: " + width + "x" + height);
            
//             // Make sure the output directory exists
//             File outputFile = new File(outputPath);
//             File outputDir = outputFile.getParentFile();
//             if (outputDir != null && !outputDir.exists()) {
//                 boolean dirCreated = outputDir.mkdirs();
//                 Log.d(TAG, "Output directory created: " + dirCreated + " at " + outputDir.getAbsolutePath());
//             }
            
//             // Input PDF open karo
//             ParcelFileDescriptor fileDescriptor = null;
//             PdfRenderer renderer = null;
//             PdfDocument document = null;
//             FileOutputStream outputStream = null;
            
//             try {
//                 fileDescriptor = ParcelFileDescriptor.open(inputFile, ParcelFileDescriptor.MODE_READ_ONLY);
//                 renderer = new PdfRenderer(fileDescriptor);
                
//                 // Naya PDF document create karo
//                 document = new PdfDocument();
                
//                 // Har page ko process karo
//                 final int pageCount = renderer.getPageCount();
//                 Log.d(TAG, "Processing " + pageCount + " pages");
                
//                 for (int i = 0; i < pageCount; i++) {
//                     Log.d(TAG, "Processing page " + (i + 1) + "/" + pageCount);
//                     PdfRenderer.Page page = renderer.openPage(i);
                    
//                     try {
//                         // Scaling calculate karo
//                         int pageWidth = page.getWidth();
//                         int pageHeight = page.getHeight();
//                         float scale = Math.min((float) width / pageWidth, (float) height / pageHeight);
//                         int scaledWidth = (int) (pageWidth * scale);
//                         int scaledHeight = (int) (pageHeight * scale);
                        
//                         Log.d(TAG, "Page " + i + " original size: " + pageWidth + "x" + pageHeight);
//                         Log.d(TAG, "Page " + i + " scaled size: " + scaledWidth + "x" + scaledHeight);
                        
//                         // Bitmap create karo aur page render karo
//                         Bitmap bitmap = Bitmap.createBitmap(scaledWidth, scaledHeight, Bitmap.Config.ARGB_8888);
//                         page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_PRINT);
                        
//                         // Naya page create karo
//                         PdfDocument.PageInfo pageInfo = new PdfDocument.PageInfo.Builder(width, height, i).create();
//                         PdfDocument.Page newPage = document.startPage(pageInfo);
                        
//                         // Bitmap ko new page mein draw karo (centered)
//                         Canvas canvas = newPage.getCanvas();
//                         canvas.drawColor(Color.WHITE);
//                         int left = (width - scaledWidth) / 2;
//                         int top = (height - scaledHeight) / 2;
//                         canvas.drawBitmap(bitmap, left, top, null);
                        
//                         // Page finish karo
//                         document.finishPage(newPage);
                        
//                         // Bitmap recycle karo memory free karne ke liye
//                         bitmap.recycle();
//                     } finally {
//                         page.close();
//                     }
//                 }
                
//                 // Output PDF save karo
//                 outputStream = new FileOutputStream(outputFile);
//                 document.writeTo(outputStream);
                
//                 Log.d(TAG, "PDF saved to: " + outputFile.getAbsolutePath());
//                 Log.d(TAG, "Output file size: " + outputFile.length() + " bytes");
                
//                 // PDF file ko Base64 string mein convert karo
//                 byte[] pdfBytes = readFileToBytes(outputFile);
//                 String base64Pdf = Base64.encodeToString(pdfBytes, Base64.DEFAULT);
                
//                 // Response object create karo
//                 WritableMap response = Arguments.createMap();
//                 response.putString("filePath", outputPath);
//                 response.putString("base64", base64Pdf);
//                 response.putString("fileName", outputFile.getName());
//                 response.putInt("fileSize", (int) outputFile.length());
                
//                 Log.d(TAG, "=== RESIZE PDF FILE SUCCESS ===");
                
//                 // Promise resolve karo response ke saath
//                 promise.resolve(response);
                 
//             } finally {
//                 // Resources properly close karo
//                 if (document != null) {
//                     document.close();
//                 }
//                 if (renderer != null) {
//                     renderer.close();
//                 }
//                 if (fileDescriptor != null) {
//                     fileDescriptor.close();
//                 }
//                 if (outputStream != null) {
//                     outputStream.close();
//                 }
//             }
            
//         } catch (IOException e) {
//             Log.e(TAG, "Error processing PDF: " + e.getMessage(), e);
//             promise.reject("PDF_PROCESS_ERROR", "Error processing PDF: " + e.getMessage(), e);
//         }
//     }
    
//     // Helper method to read file to bytes
//     private byte[] readFileToBytes(File file) throws IOException {
//         ByteArrayOutputStream ous = null;
//         InputStream ios = null;
//         try {
//             ous = new ByteArrayOutputStream();
//             ios = new FileInputStream(file);
//             byte[] buffer = new byte[4096];
//             int read = 0;
//             while ((read = ios.read(buffer)) != -1) {
//                 ous.write(buffer, 0, read);
//             }
//         } finally {
//             try {
//                 if (ous != null) {
//                     ous.close();
//                 }
//             } catch (IOException e) {
//                 Log.w(TAG, "Error closing output stream: " + e.getMessage());
//             }
//             try {
//                 if (ios != null) {
//                     ios.close();
//                 }
//             } catch (IOException e) {
//                 Log.w(TAG, "Error closing input stream: " + e.getMessage());
//             }
//         }
//         return ous.toByteArray();
//     }
// }


