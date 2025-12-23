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
            
            // Read width and height from options
            int targetWidth = options.hasKey("width") ? options.getInt("width") : 0;
            int targetHeight = options.hasKey("height") ? options.getInt("height") : 0;

            if (outputPath == null) {
                promise.reject("INVALID_OUTPUT_PATH", "Output path is required.");
                return;
            }

            Log.d(TAG, "Quality: " + quality + ", Width: " + targetWidth + ", Height: " + targetHeight + ", Output: " + outputPath);

            // Check if file is already small - no need to compress further
            if (originalSize < 200 * 1024 && targetWidth == 0) { // Less than 200KB and no specific dimension target
                handleSmallFile(inputFile, quality, outputPath, originalSize, promise);
            } else {
                // Use compression for larger files or specific dimensions
                compressPdfSinglePass(inputFile, quality, targetWidth, targetHeight, outputPath, promise);
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
            long compressedSize = compressWithOptimizedSettings(renderer, outputFile, dpi, 0, 0);
            
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


    private void compressPdfSinglePass(File inputFile, String quality, int targetWidth, int targetHeight, String outputPath, Promise promise) {
        ParcelFileDescriptor fileDescriptor = null;
        PdfRenderer renderer = null;
        
        try {
            fileDescriptor = ParcelFileDescriptor.open(inputFile, ParcelFileDescriptor.MODE_READ_ONLY);
            renderer = new PdfRenderer(fileDescriptor);
            
            int pageCount = renderer.getPageCount();
            long originalSize = inputFile.length();
            
            Log.d(TAG, "Processing PDF - Pages: " + pageCount + ", Size: " + (originalSize / (1024 * 1024)) + "MB");

            // Use smart DPI values based on file size if no target dimensions provided
            int dpi = 0;
            if (targetWidth == 0 || targetHeight == 0) {
                 dpi = getSmartDpi(quality, originalSize, pageCount);
                 Log.d(TAG, "Using smart DPI: " + dpi);
            } else {
                Log.d(TAG, "Using Target Dimensions: " + targetWidth + "x" + targetHeight);
            }
            
            File outputFile = new File(outputPath);
            long compressedSize = compressWithOptimizedSettings(renderer, outputFile, dpi, targetWidth, targetHeight);
            
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
        return compressWithOptimizedSettings(renderer, outputFile, lowerDpi, 0, 0);
    }

    private long compressWithOptimizedSettings(PdfRenderer renderer, File outputFile, int dpi, int targetWidth, int targetHeight) throws IOException {
        PdfDocument document = new PdfDocument();
        FileOutputStream outputStream = null;
        
        try {
            // double scaleFactor = dpi / 72.0;
            int pageCount = renderer.getPageCount();
            
            Log.d(TAG, "Compressing " + pageCount + " pages. Target: " + (targetWidth > 0 ? targetWidth + "x" + targetHeight : "DPI " + dpi));
            
            for (int i = 0; i < pageCount; i++) {
                PdfRenderer.Page page = renderer.openPage(i);
                Bitmap bitmap = null;
                
                try {
                    int originalWidth = page.getWidth();
                    int originalHeight = page.getHeight();
                    
                    // Input validation to avoid division by zero
                    if (originalWidth <= 0 || originalHeight <= 0) {
                         Log.e(TAG, "Invalid page dimensions for page " + i);
                         page.close();
                         continue;
                    }

                    Log.d(TAG, "Page " + (i+1) + " original: " + originalWidth + "x" + originalHeight);
                    
                    int pageWidth, pageHeight;

                    if (targetWidth > 0 && targetHeight > 0) {
                        // Calculate scale to fit within target box while maintaining aspect ratio
                        float scaleX = (float) targetWidth / originalWidth;
                        float scaleY = (float) targetHeight / originalHeight;
                        float scale = Math.min(scaleX, scaleY);
                        
                        // Don't upscale if the image is already smaller than target (unless very small)
                        if (scale > 1.0f && originalWidth > 200) {
                            scale = 1.0f;
                        }

                        pageWidth = (int) (originalWidth * scale);
                        pageHeight = (int) (originalHeight * scale);
                    } else {
                         // Fallback to DPI based scaling
                         double scaleFactor = dpi / 72.0;
                         pageWidth = (int) (originalWidth * scaleFactor);
                         pageHeight = (int) (originalHeight * scaleFactor);
                         
                         // Apply optimized limits
                         int[] safeDims = getOptimizedDimensions(pageWidth, pageHeight, dpi);
                         pageWidth = safeDims[0];
                         pageHeight = safeDims[1];
                    }
                    
                    // Log.d(TAG, "Page " + (i+1) + " compressed: " + pageWidth + "x" + pageHeight);
                    
                    // Create bitmap with optimized dimensions
                    bitmap = Bitmap.createBitmap(pageWidth, pageHeight, Bitmap.Config.ARGB_8888);
                    
                    // Render with scaling matrix
                    Matrix matrix = new Matrix();
                    // float scaleX = (float) pageWidth / originalWidth;
                    // float scaleY = (float) pageHeight / originalHeight;
                    // matrix.postScale(scaleX, scaleY);
                    
                    // Correct way to scale for render
                    float scaleX = (float) pageWidth / originalWidth;
                    float scaleY = (float) pageHeight / originalHeight;
                    
                    // Use the Rect for rendering to ensure it fits exactly
                    // android.graphics.Rect destRect = new android.graphics.Rect(0, 0, pageWidth, pageHeight);
                    // page.render(bitmap, destRect, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY);
                    
                    // Using Matrix as used before but ensuring it matches
                    matrix.setScale(scaleX, scaleY);

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


