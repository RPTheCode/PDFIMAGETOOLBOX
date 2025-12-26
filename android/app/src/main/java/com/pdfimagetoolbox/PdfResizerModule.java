package com.pdfimagetoolbox;

import android.graphics.Bitmap;
import android.graphics.pdf.PdfRenderer;
import android.os.ParcelFileDescriptor;
import android.net.Uri;
import android.util.Log;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;

// iText for creating the output PDF (better compression handling than valid Android PdfDocument)
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.io.image.ImageData;
import com.itextpdf.io.image.ImageDataFactory;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.element.Image;
import com.itextpdf.kernel.geom.PageSize;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

public class PdfResizerModule extends ReactContextBaseJavaModule {
    private final ReactApplicationContext reactContext;
    private static final String TAG = "PdfResizerModule";

    public PdfResizerModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return "PdfResizer";
    }

    // Original method provided by user (keeps functionality for other potential uses)
    @ReactMethod
    public void generateCompressedImages(String inputPath, String quality, Promise promise) {
        try {
            int compressQuality = 50;
            if (quality.equalsIgnoreCase("low")) {
                compressQuality = 30; 
            } else if (quality.equalsIgnoreCase("medium")) {
                compressQuality = 50;
            } else if (quality.equalsIgnoreCase("high")) {
                compressQuality = 70;
            }

            WritableArray imagePaths = Arguments.createArray();
            List<String> paths = extractAndCompressPages(inputPath, compressQuality);
            
            for (String path : paths) {
                imagePaths.pushString(path);
            }
            
            promise.resolve(imagePaths);
        } catch (Exception e) {
            promise.reject("create_error", e);
        }
    }

    // New method to match ResizePdf.jsx expectations and fix the error
    @ReactMethod
    public void compressPdf(String inputPath, String quality, String outputPath, Promise promise) {
        try {
            Log.d(TAG, "Starting Safe PDF Compression (Native Read -> iText Write)");
            File inputFile = new File(inputPath);
            if (!inputFile.exists()) {
                 promise.reject("FILE_NOT_FOUND", "Input file not found");
                 return;
            }

            // Quality Settings
            int compressQuality = 60; // Default Medium
            float scale = 1.5f;       // Default Medium
            
            if (quality.equalsIgnoreCase("low")) {
                compressQuality = 40;
                scale = 1.0f; // 72 DPI
            } else if (quality.equalsIgnoreCase("medium")) {
                compressQuality = 60;
                scale = 1.5f; // ~108 DPI
            } else if (quality.equalsIgnoreCase("high")) {
                compressQuality = 80;
                scale = 2.0f; // 144 DPI
            }
            
            // Use Native PdfRenderer (Robust against parsing errors)
            ParcelFileDescriptor fileDescriptor = ParcelFileDescriptor.open(inputFile, ParcelFileDescriptor.MODE_READ_ONLY);
            PdfRenderer pdfRenderer = new PdfRenderer(fileDescriptor);
            
            // Setup Output PDF
            PdfWriter writer = new PdfWriter(outputPath);
            PdfDocument outPdf = new PdfDocument(writer);
            Document doc = new Document(outPdf);
            doc.setMargins(0, 0, 0, 0);

            int pageCount = pdfRenderer.getPageCount();
            Log.d(TAG, "Processing " + pageCount + " pages...");

            for (int i = 0; i < pageCount; i++) {
                PdfRenderer.Page page = pdfRenderer.openPage(i);
                
                int width = (int) (page.getWidth() * scale);
                int height = (int) (page.getHeight() * scale);
                
                // Render to Bitmap
                Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
                // Fill white background (PDF transparency is black otherwise)
                android.graphics.Canvas canvas = new android.graphics.Canvas(bitmap);
                canvas.drawColor(android.graphics.Color.WHITE);
                
                page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY);
                page.close();

                // Compress to JPEG
                ByteArrayOutputStream stream = new ByteArrayOutputStream();
                bitmap.compress(Bitmap.CompressFormat.JPEG, compressQuality, stream);
                byte[] imageBytes = stream.toByteArray();
                
                // Add to new PDF using iText
                ImageData imageData = ImageDataFactory.create(imageBytes);
                Image image = new Image(imageData);
                
                // Set page size to match the image (or original PDF points)
                // Using 72 DPI for PDF points
                float pdfWidth = width * 72f / (scale * 72f); // = page.getWidth()
                // Actually simple logic: iText page size from image
                // But we want to preserve physical size approx? 
                // Let's just fit image to page.
                
                PageSize pageSize = new PageSize(image.getImageWidth(), image.getImageHeight());
                // Or use original page dimensions? Native Page gives size in points (1/72 inch).
                // Let's rely on the image size being the source of truth for the new PDF.
                
                outPdf.addNewPage(pageSize);
                image.setFixedPosition(i + 1, 0, 0);
                doc.add(image);
                
                bitmap.recycle();
                stream.close();
            }

            doc.close();
            pdfRenderer.close();
            fileDescriptor.close();
            
            long originalSize = inputFile.length();
            long compressedSize = new File(outputPath).length();
            double ratio = (1 - (double) compressedSize / originalSize) * 100;

            WritableMap result = Arguments.createMap();
            result.putString("filePath", outputPath);
            result.putDouble("originalSize", (double) originalSize);
            result.putDouble("size", (double) compressedSize);
            result.putDouble("compressionRatio", ratio);
            
            Log.d(TAG, "Compression Complete: " + outputPath);
            promise.resolve(result);

        } catch (Exception e) {
            Log.e(TAG, "Compression Error", e);
            promise.reject("COMPRESSION_ERROR", e.getMessage());
        }
    }

    private List<String> extractAndCompressPages(String inputPath, int quality) throws IOException {
        List<String> paths = new ArrayList<>();
        File inputFile = new File(inputPath);
        
        if (inputPath.startsWith("file://")) {
            inputFile = new File(inputPath.replace("file://", ""));
        }

        ParcelFileDescriptor fileDescriptor = ParcelFileDescriptor.open(inputFile, ParcelFileDescriptor.MODE_READ_ONLY);
        PdfRenderer pdfRenderer = new PdfRenderer(fileDescriptor);

        File cacheDir = reactContext.getCacheDir();

        for (int i = 0; i < pdfRenderer.getPageCount(); i++) {
            PdfRenderer.Page page = pdfRenderer.openPage(i);
            
            float scale = 1.5f;
            if (quality < 40) scale = 1.0f;
            else if (quality > 60) scale = 2.0f;
            
            int width = (int) (page.getWidth() * scale);
            int height = (int) (page.getHeight() * scale);
            
            Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.RGB_565);
            bitmap.eraseColor(android.graphics.Color.WHITE);
            
            page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY);
            
            File outputFile = new File(cacheDir, "page_" + UUID.randomUUID().toString() + ".jpg");
            try (FileOutputStream out = new FileOutputStream(outputFile)) {
                bitmap.compress(Bitmap.CompressFormat.JPEG, quality, out);
            }
            
            paths.add("file://" + outputFile.getAbsolutePath());
            
            page.close();
            bitmap.recycle();
        }

        pdfRenderer.close();
        fileDescriptor.close();
        
        return paths;
    }
}
