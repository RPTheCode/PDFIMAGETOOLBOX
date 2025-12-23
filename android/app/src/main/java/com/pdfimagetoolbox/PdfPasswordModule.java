package com.pdfimagetoolbox;

import android.content.Context;
import android.util.Log;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;

// Use pdfbox-android imports
import com.tom_roush.pdfbox.pdmodel.PDDocument;
import com.tom_roush.pdfbox.pdmodel.encryption.AccessPermission;
import com.tom_roush.pdfbox.pdmodel.encryption.StandardProtectionPolicy;

import java.io.File;
import java.io.IOException;

public class PdfPasswordModule extends ReactContextBaseJavaModule {
    private static final String TAG = "PdfPasswordModule";
    private final Context context;

    public PdfPasswordModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.context = reactContext;
    }

    @Override
    public String getName() {
        return "PdfPassword";
    }

    @ReactMethod
    public void addPasswordProtection(ReadableMap options, Promise promise) {
        try {
            // Get input and output paths
            String inputPath = options.getString("inputPath");
            String outputPath = options.getString("outputPath");
            String password = options.getString("password");

            if (inputPath == null || outputPath == null || password == null) {
                promise.reject("INVALID_PARAMS", "Missing required parameters");
                return;
            }

            // Get permissions if provided
            boolean canPrint = true;
            boolean canModify = true;
            boolean canCopy = true;
            boolean canAnnotate = true;
            boolean canFillForms = true;

            if (options.hasKey("permissions")) {
                ReadableMap permissions = options.getMap("permissions");
                if (permissions != null) {
                    canPrint = permissions.hasKey("printing") && permissions.getBoolean("printing");
                    canModify = permissions.hasKey("modifying") && permissions.getBoolean("modifying");
                    canCopy = permissions.hasKey("copying") && permissions.getBoolean("copying");
                    canAnnotate = permissions.hasKey("annotating") && permissions.getBoolean("annotating");
                    canFillForms = permissions.hasKey("fillingForms") && permissions.getBoolean("fillingForms");
                }
            }

            // Load the PDF document
            File inputFile = new File(inputPath);
            if (!inputFile.exists()) {
                promise.reject("FILE_NOT_FOUND", "Input file not found: " + inputPath);
                return;
            }

            PDDocument document = PDDocument.load(inputFile);

            // Create access permission object
            AccessPermission ap = new AccessPermission();
            ap.setCanPrint(canPrint);
            ap.setCanModify(canModify);
            ap.setCanExtractContent(canCopy);
            ap.setCanModifyAnnotations(canAnnotate);
            ap.setCanFillInForm(canFillForms);

            // Create protection policy
            StandardProtectionPolicy spp = new StandardProtectionPolicy(password, password, ap);
            spp.setEncryptionKeyLength(128); // 128-bit encryption

            // Apply protection
            document.protect(spp);

            // Save the protected PDF
            File outputFile = new File(outputPath);
            document.save(outputFile);
            document.close();

            Log.i(TAG, "PDF password protected successfully: " + outputPath);
            promise.resolve(outputPath);

        } catch (IOException e) {
            Log.e(TAG, "Error protecting PDF: " + e.getMessage());
            promise.reject("PDF_PROTECT_ERROR", e.getMessage());
        } catch (Exception e) {
            Log.e(TAG, "Unexpected error: " + e.getMessage());
            promise.reject("UNEXPECTED_ERROR", e.getMessage());
        }
    }
}
