// android/app/src/main/java/com/pdfimagetoolbox/PdfCompressorModule.java
package com.pdfimagetoolbox;

import android.util.Log;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.pdf.PdfRenderer;
import android.os.ParcelFileDescriptor;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;

import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfReader;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.kernel.pdf.WriterProperties;
import com.itextpdf.kernel.pdf.CompressionConstants;

import java.io.File;
import java.io.FileOutputStream;

public class PdfCompressorModule extends ReactContextBaseJavaModule {
    private static final String TAG = "PdfCompressorModule";
    
    public PdfCompressorModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return "PdfCompressor";
    }

    @ReactMethod
    public void compressPdf(String inputPath, String quality, String outputPath, Promise promise) {
        Log.d(TAG, "=== STARTING HYBRID PDF COMPRESSION ===");
        
        try {
            File inputFile = new File(inputPath);
            if (!inputFile.exists()) {
                promise.reject("FILE_NOT_FOUND", "Input PDF file not found at " + inputPath);
                return;
            }

            long originalSize = inputFile.length();
            Log.d(TAG, "Original file size: " + (originalSize / 1024) + " KB");
            Log.d(TAG, "Quality setting: " + quality);
            
            // Get quality-specific settings
            CompressionSettings settings = getCompressionSettings(quality);
            Log.d(TAG, "Compression level: " + settings.compressionLevel);
            Log.d(TAG, "Image quality/DPI: " + settings.imageQuality);
            
            File outputFile = new File(outputPath);
            
            // Enable lenient/permissive PDF reading
            com.itextpdf.kernel.pdf.ReaderProperties readerProperties = new com.itextpdf.kernel.pdf.ReaderProperties();
            
            // Try to count images
            int imagesFound = 0;
            try {
                PdfDocument tempDoc = new PdfDocument(new PdfReader(inputFile.getAbsolutePath(), readerProperties));
                imagesFound = countImages(tempDoc);
                tempDoc.close();
                Log.d(TAG, "📊 Image detection: " + imagesFound + " images found");
            } catch (Exception e) {
                Log.d(TAG, "⚠️ Could not analyze PDF structure: " + e.getMessage());
            }
            
            // Choose compression strategy
            if (imagesFound > 0) {
                Log.d(TAG, "✨ Using IMAGE RECOMPRESSION (text stays vector-based)");
                PdfWriter writer = new PdfWriter(outputFile.getAbsolutePath(), new WriterProperties()
                    .setFullCompressionMode(true)
                    .setCompressionLevel(settings.compressionLevel));
                PdfReader reader = new PdfReader(inputFile.getAbsolutePath(), readerProperties);
                compressViaImageRecompression(reader, writer, settings);
            } else {
                Log.d(TAG, "✨ Using BITMAP CONVERSION (text-only PDF or analysis failed)");
                compressViaBitmaps(inputFile, outputFile, settings);
            }
            
            long compressedSize = outputFile.length();
            double compressionRatio = (1 - (double) compressedSize / originalSize) * 100;
            
            WritableMap result = Arguments.createMap();
            result.putString("filePath", outputPath);
            result.putDouble("size", compressedSize);
            result.putDouble("originalSize", originalSize);
            result.putDouble("compressionRatio", compressionRatio);
            result.putInt("imagesProcessed", imagesFound);
            result.putString("method", imagesFound > 0 ? "image_recompression" : "bitmap_conversion");
            
            Log.d(TAG, "✅ SUCCESS: " + (originalSize / 1024) + "KB → " + (compressedSize / 1024) + "KB (" +
                  String.format("%.1f", compressionRatio) + "% reduction)");
            
            promise.resolve(result);
            
        } catch (Exception e) {
            Log.e(TAG, "❌ Compression failed: " + e.getMessage(), e);
            promise.reject("COMPRESSION_ERROR", "Failed to compress PDF: " + e.getMessage(), e);
        }
    }
    
    /**
     * Count images in PDF
     */
    private int countImages(PdfDocument pdfDoc) {
        int imageCount = 0;
        try {
            for (int i = 1; i <= pdfDoc.getNumberOfPages(); i++) {
                com.itextpdf.kernel.pdf.PdfPage page = pdfDoc.getPage(i);
                com.itextpdf.kernel.pdf.PdfResources resources = page.getResources();
                
                if (resources != null) {
                    for (com.itextpdf.kernel.pdf.PdfName name : resources.getResourceNames()) {
                        com.itextpdf.kernel.pdf.PdfObject obj = resources.getResourceObject(
                            com.itextpdf.kernel.pdf.PdfName.XObject, name);
                        
                        if (obj != null && obj.isStream()) {
                            com.itextpdf.kernel.pdf.PdfStream stream = (com.itextpdf.kernel.pdf.PdfStream) obj;
                            com.itextpdf.kernel.pdf.PdfName subtype = stream.getAsName(com.itextpdf.kernel.pdf.PdfName.Subtype);
                            
                            if (com.itextpdf.kernel.pdf.PdfName.Image.equals(subtype)) {
                                imageCount++;
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error counting images: " + e.getMessage());
        }
        return imageCount;
    }
    
    /**
     * Compress via image recompression (for image-heavy PDFs)
     */
    private void compressViaImageRecompression(PdfReader reader, PdfWriter writer, CompressionSettings settings) throws Exception {
        PdfDocument pdfDoc = new PdfDocument(reader, writer);
        
        int successCount = 0;
        int pageCount = pdfDoc.getNumberOfPages();
        
        for (int i = 1; i <= pageCount; i++) {
            com.itextpdf.kernel.pdf.PdfPage page = pdfDoc.getPage(i);
            com.itextpdf.kernel.pdf.PdfResources resources = page.getResources();
            
            if (resources != null) {
                for (com.itextpdf.kernel.pdf.PdfName name : resources.getResourceNames()) {
                    com.itextpdf.kernel.pdf.PdfObject obj = resources.getResourceObject(
                        com.itextpdf.kernel.pdf.PdfName.XObject, name);
                    
                    if (obj != null && obj.isStream()) {
                        com.itextpdf.kernel.pdf.PdfStream stream = (com.itextpdf.kernel.pdf.PdfStream) obj;
                        com.itextpdf.kernel.pdf.PdfName subtype = stream.getAsName(com.itextpdf.kernel.pdf.PdfName.Subtype);
                        
                        if (com.itextpdf.kernel.pdf.PdfName.Image.equals(subtype)) {
                            if (recompressImage(stream, settings.imageQuality)) {
                                successCount++;
                            }
                        }
                    }
                }
            }
        }
        
        Log.d(TAG, "Recompressed " + successCount + " images");
        pdfDoc.close();
    }
    
    /**
     * Compress via bitmap conversion (for text-only PDFs)
     */
    private void compressViaBitmaps(File inputFile, File outputFile, CompressionSettings settings) throws Exception {
        ParcelFileDescriptor fd = ParcelFileDescriptor.open(inputFile, ParcelFileDescriptor.MODE_READ_ONLY);
        PdfRenderer renderer = new PdfRenderer(fd);
        
        int dpi = settings.imageQuality;  // Reuse imageQuality field as DPI
        int jpegQuality = getDPI(settings.imageQuality).jpegQuality;
        
        Log.d(TAG, "Rendering at " + dpi + " DPI with " + jpegQuality + "% JPEG quality");
        
        com.itextpdf.kernel.pdf.PdfDocument outputDoc = new com.itextpdf.kernel.pdf.PdfDocument(
            new com.itextpdf.kernel.pdf.PdfWriter(outputFile));
        
        for (int i = 0; i < renderer.getPageCount(); i++) {
            PdfRenderer.Page page = renderer.openPage(i);
            
            int width = (int) (page.getWidth() * dpi / 72f);
            int height = (int) (page.getHeight() * dpi / 72f);
            
            Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(bitmap);
            canvas.drawColor(Color.WHITE);
            page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_PRINT);
            page.close();
            
            // Convert to JPEG bytes
            java.io.ByteArrayOutputStream stream = new java.io.ByteArrayOutputStream();
            bitmap.compress(Bitmap.CompressFormat.JPEG, jpegQuality, stream);
            byte[] imageBytes = stream.toByteArray();
            stream.close();
            
            // Add to output PDF
            com.itextpdf.io.image.ImageData imageData = com.itextpdf.io.image.ImageDataFactory.create(imageBytes);
            com.itextpdf.layout.element.Image image = new com.itextpdf.layout.element.Image(imageData);
            
            com.itextpdf.kernel.geom.PageSize pageSize = new com.itextpdf.kernel.geom.PageSize(page.getWidth() * 72 / dpi, page.getHeight() * 72 / dpi);
            com.itextpdf.kernel.pdf.PdfPage pdfPage = outputDoc.addNewPage(pageSize);
            
            com.itextpdf.layout.Document doc = new com.itextpdf.layout.Document(outputDoc);
            doc.setMargins(0, 0, 0, 0);
            image.setFixedPosition(i + 1, 0, 0);
            image.scaleToFit(pageSize.getWidth(), pageSize.getHeight());
            doc.add(image);
            
            bitmap.recycle();
        }
        
        outputDoc.close();
        renderer.close();
        fd.close();
        
        Log.d(TAG, "Converted " + renderer.getPageCount() + " pages to bitmaps");
    }
    
    /**
     * Recompress a single image
     */
    private boolean recompressImage(com.itextpdf.kernel.pdf.PdfStream imageStream, int quality) {
        Bitmap bitmap = null;
        try {
            byte[] imageBytes = imageStream.getBytes();
            if (imageBytes == null || imageBytes.length == 0) return false;
            
            bitmap = android.graphics.BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.length);
            if (bitmap == null) return false;
            
            java.io.ByteArrayOutputStream outputStream = new java.io.ByteArrayOutputStream();
            bitmap.compress(Bitmap.CompressFormat.JPEG, quality, outputStream);
            byte[] compressedBytes = outputStream.toByteArray();
            outputStream.close();
            
            imageStream.setData(compressedBytes);
            imageStream.put(com.itextpdf.kernel.pdf.PdfName.Filter, com.itextpdf.kernel.pdf.PdfName.DCTDecode);
            imageStream.put(com.itextpdf.kernel.pdf.PdfName.Width, new com.itextpdf.kernel.pdf.PdfNumber(bitmap.getWidth()));
            imageStream.put(com.itextpdf.kernel.pdf.PdfName.Height, new com.itextpdf.kernel.pdf.PdfNumber(bitmap.getHeight()));
            
            return true;
        } catch (Exception e) {
            return false;
        } finally {
            if (bitmap != null) bitmap.recycle();
        }
    }
    
    /**
     * DPI settings helper
     */
    private static class DPISettings {
        int dpi;
        int jpegQuality;
        DPISettings(int dpi, int jpegQuality) {
            this.dpi = dpi;
            this.jpegQuality = jpegQuality;
        }
    }
    
    private DPISettings getDPI(int qualityValue) {
        // Map quality value to DPI and JPEG quality
        if (qualityValue <= 40) {
            return new DPISettings(72, 40);  // Low: 72 DPI, 40% JPEG
        } else if (qualityValue <= 65) {
            return new DPISettings(100, 65);  // Medium: 100 DPI, 65% JPEG
        } else {
            return new DPISettings(150, 80);  // High: 150 DPI, 80% JPEG
        }
    }
    
    /**
     * Compression settings
     */
    private static class CompressionSettings {
        int compressionLevel;
        int imageQuality;  // For images: JPEG quality %, for bitmaps: DPI
        
        CompressionSettings(int compressionLevel, int imageQuality) {
            this.compressionLevel = compressionLevel;
            this.imageQuality = imageQuality;
        }
    }
    
    /**
     * Get compression settings based on quality
     */
    private CompressionSettings getCompressionSettings(String quality) {
        switch (quality.toLowerCase()) {
            case "low":
                return new CompressionSettings(9, 30);  // 30% JPEG or 72 DPI
            case "medium":
                return new CompressionSettings(6, 60);  // 60% JPEG or 100 DPI
            case "high":
                return new CompressionSettings(3, 80);  // 80% JPEG or 150 DPI
            default:
                return new CompressionSettings(6, 60);
        }
    }
}
