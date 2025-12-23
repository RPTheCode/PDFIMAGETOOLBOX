// PdfUnlockModule.java
package com.pdfimagetoolbox;
import androidx.annotation.NonNull;
import android.content.ContentUris;
import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.os.Environment;
import android.provider.DocumentsContract;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.tom_roush.pdfbox.pdmodel.PDDocument;
import com.tom_roush.pdfbox.pdmodel.encryption.AccessPermission;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
public class PdfUnlockModule extends ReactContextBaseJavaModule {
    public PdfUnlockModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }
    @Override
    @NonNull
    public String getName() {
        return "PdfUnlock";
    }
    private String getPathFromUri(Uri uri) throws IOException {
        // Handle different URI schemes
        String scheme = uri.getScheme();
        if (scheme == null) {
            return uri.getPath();
        }
        
        if (scheme.equals("content")) {
            // Content URI - copy to temp file
            return copyContentUriToTempFile(uri);
        } else if (scheme.equals("file")) {
            // File URI - return path directly
            return uri.getPath();
        }
        
        throw new IOException("Unsupported URI scheme: " + scheme);
    }
    private String copyContentUriToTempFile(Uri uri) throws IOException {
        Context context = getReactApplicationContext();
        InputStream inputStream = null;
        OutputStream outputStream = null;
        
        try {
            // Open input stream from content URI
            inputStream = context.getContentResolver().openInputStream(uri);
            if (inputStream == null) {
                throw new IOException("Cannot open input stream from URI: " + uri);
            }
            
            // Create temp file
            File tempDir = context.getCacheDir();
            String fileName = getFileNameFromUri(uri);
            if (fileName == null) {
                fileName = "temp_pdf_" + System.currentTimeMillis() + ".pdf";
            }
            
            File tempFile = new File(tempDir, fileName);
            
            // Copy content
            outputStream = new FileOutputStream(tempFile);
            byte[] buffer = new byte[4 * 1024];
            int read;
            while ((read = inputStream.read(buffer)) != -1) {
                outputStream.write(buffer, 0, read);
            }
            
            return tempFile.getAbsolutePath();
        } finally {
            if (inputStream != null) {
                try {
                    inputStream.close();
                } catch (IOException e) {
                    // Ignore
                }
            }
            if (outputStream != null) {
                try {
                    outputStream.close();
                } catch (IOException e) {
                    // Ignore
                }
            }
        }
    }
    private String getFileNameFromUri(Uri uri) {
        Context context = getReactApplicationContext();
        String fileName = null;
        
        if (uri.getScheme().equals("content")) {
            Cursor cursor = null;
            try {
                cursor = context.getContentResolver().query(uri, null, null, null, null);
                if (cursor != null && cursor.moveToFirst()) {
                    int nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                    if (nameIndex != -1) {
                        fileName = cursor.getString(nameIndex);
                    }
                }
            } finally {
                if (cursor != null) {
                    cursor.close();
                }
            }
        }
        
        if (fileName == null) {
            fileName = uri.getLastPathSegment();
        }
        
        return fileName;
    }
    @ReactMethod
    public void unlockPdf(String inputUri, String outputPath, String password, Promise promise) {
        try {
            // Convert content URI to file path
            String inputPath = getPathFromUri(Uri.parse(inputUri));
            File inputFile = new File(inputPath);
            File outputFile = new File(outputPath);
            
            PDDocument document = null;
            boolean passwordMatched = false;
            
            try {
                // First check if the PDF is encrypted
                document = PDDocument.load(inputFile, "");
                
                // If we get here, the PDF opened with empty password
                if (document.isEncrypted()) {
                    passwordMatched = true; // Empty password worked
                } else {
                    passwordMatched = true; // Not encrypted
                }
            } catch (IOException e) {
                // Failed with empty password, try with the provided password
                try {
                    if (document != null) {
                        document.close();
                    }
                    document = PDDocument.load(inputFile, password);
                    
                    // If we get here, the provided password worked
                    passwordMatched = true;
                } catch (IOException e2) {
                    // Both attempts failed, password doesn't match
                    passwordMatched = false;
                }
            }
            
            // Check if password matched
            if (!passwordMatched) {
                promise.reject("INVALID_PASSWORD", "The password you entered is incorrect. Please try again.");
                return;
            }
            
            // If we get here, password matched, now try to remove encryption
            try {
                // Reload the document with the correct password
                if (document != null) {
                    document.close();
                }
                
                // Determine which password to use
                String correctPassword = password.isEmpty() ? "" : password;
                document = PDDocument.load(inputFile, correctPassword);
                
                // Check if the document is encrypted
                if (document.isEncrypted()) {
                    // Check if we have owner permission to remove encryption
                    AccessPermission ap = document.getCurrentAccessPermission();
                    if (ap.isOwnerPermission()) {
                        // Remove encryption
                        document.setAllSecurityToBeRemoved(true);
                        document.save(outputFile);
                        promise.resolve("PDF password protection removed successfully. Saved as: " + outputPath);
                    } else {
                        // User password provided, but we need owner password to remove encryption
                        promise.reject("INSUFFICIENT_PERMISSION", "The provided password is the user password, not the owner password. Cannot remove encryption.");
                    }
                } else {
                    // Document is not encrypted, just copy it
                    document.close();
                    copyFile(inputFile, outputFile);
                    promise.resolve("PDF is not password protected. Saved as: " + outputPath);
                }
            } catch (IOException e) {
                promise.reject("PROCESSING_ERROR", "Failed to process the PDF: " + e.getMessage());
            } finally {
                if (document != null) {
                    document.close();
                }
            }
        } catch (Exception e) {
            promise.reject("UNEXPECTED_ERROR", e.getMessage());
        }
    }
    
    private void copyFile(File source, File destination) throws IOException {
        InputStream in = null;
        OutputStream out = null;
        
        try {
            in = new java.io.FileInputStream(source);
            out = new java.io.FileOutputStream(destination);
            
            byte[] buffer = new byte[1024];
            int length;
            while ((length = in.read(buffer)) > 0) {
                out.write(buffer, 0, length);
            }
        } finally {
            if (in != null) {
                in.close();
            }
            if (out != null) {
                out.close();
            }
        }
    }
}





// // PdfUnlockModule.java
// package com.pdfimagetoolbox;

// import androidx.annotation.NonNull;
// import android.content.ContentUris;
// import android.content.Context;
// import android.database.Cursor;
// import android.net.Uri;
// import android.os.Environment;
// import android.provider.DocumentsContract;
// import android.provider.MediaStore;
// import android.provider.OpenableColumns;
// import com.facebook.react.bridge.Promise;
// import com.facebook.react.bridge.ReactApplicationContext;
// import com.facebook.react.bridge.ReactContextBaseJavaModule;
// import com.facebook.react.bridge.ReactMethod;
// import com.tom_roush.pdfbox.pdmodel.PDDocument;
// import java.io.File;
// import java.io.FileOutputStream;
// import java.io.IOException;
// import java.io.InputStream;
// import java.io.OutputStream;

// public class PdfUnlockModule extends ReactContextBaseJavaModule {
//     public PdfUnlockModule(ReactApplicationContext reactContext) {
//         super(reactContext);
//     }

//     @Override
//     @NonNull
//     public String getName() {
//         return "PdfUnlock";
//     }

//     private String getPathFromUri(Uri uri) throws IOException {
//         // Handle different URI schemes
//         String scheme = uri.getScheme();
//         if (scheme == null) {
//             return uri.getPath();
//         }
        
//         if (scheme.equals("content")) {
//             // Content URI - copy to temp file
//             return copyContentUriToTempFile(uri);
//         } else if (scheme.equals("file")) {
//             // File URI - return path directly
//             return uri.getPath();
//         }
        
//         throw new IOException("Unsupported URI scheme: " + scheme);
//     }

//     private String copyContentUriToTempFile(Uri uri) throws IOException {
//         Context context = getReactApplicationContext();
//         InputStream inputStream = null;
//         OutputStream outputStream = null;
        
//         try {
//             // Open input stream from content URI
//             inputStream = context.getContentResolver().openInputStream(uri);
//             if (inputStream == null) {
//                 throw new IOException("Cannot open input stream from URI: " + uri);
//             }
            
//             // Create temp file
//             File tempDir = context.getCacheDir();
//             String fileName = getFileNameFromUri(uri);
//             if (fileName == null) {
//                 fileName = "temp_pdf_" + System.currentTimeMillis() + ".pdf";
//             }
            
//             File tempFile = new File(tempDir, fileName);
            
//             // Copy content
//             outputStream = new FileOutputStream(tempFile);
//             byte[] buffer = new byte[4 * 1024];
//             int read;
//             while ((read = inputStream.read(buffer)) != -1) {
//                 outputStream.write(buffer, 0, read);
//             }
            
//             return tempFile.getAbsolutePath();
//         } finally {
//             if (inputStream != null) {
//                 try {
//                     inputStream.close();
//                 } catch (IOException e) {
//                     // Ignore
//                 }
//             }
//             if (outputStream != null) {
//                 try {
//                     outputStream.close();
//                 } catch (IOException e) {
//                     // Ignore
//                 }
//             }
//         }
//     }

//     private String getFileNameFromUri(Uri uri) {
//         Context context = getReactApplicationContext();
//         String fileName = null;
        
//         if (uri.getScheme().equals("content")) {
//             Cursor cursor = null;
//             try {
//                 cursor = context.getContentResolver().query(uri, null, null, null, null);
//                 if (cursor != null && cursor.moveToFirst()) {
//                     int nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
//                     if (nameIndex != -1) {
//                         fileName = cursor.getString(nameIndex);
//                     }
//                 }
//             } finally {
//                 if (cursor != null) {
//                     cursor.close();
//                 }
//             }
//         }
        
//         if (fileName == null) {
//             fileName = uri.getLastPathSegment();
//         }
        
//         return fileName;
//     }

//     @ReactMethod
//     public void unlockPdf(String inputUri, String outputPath, String password, Promise promise) {
//         try {
//             // Convert content URI to file path
//             String inputPath = getPathFromUri(Uri.parse(inputUri));
//             File inputFile = new File(inputPath);
//             File outputFile = new File(outputPath);
            
//             // Try to load the PDF without any password
//             PDDocument document;
//             try {
//                 document = PDDocument.load(inputFile);
                
//                 // If we get here, the PDF opened without a password
//                 if (document.isEncrypted()) {
//                     // It's encrypted but opened with empty password - remove encryption
//                     document.setAllSecurityToBeRemoved(true);
//                     document.save(outputFile);
//                     document.close();
                    
//                     if (outputFile.exists()) {
//                         promise.resolve("PDF password protection removed successfully. Saved as: " + outputPath);
//                     } else {
//                         promise.reject("SAVE_FAILED", "Failed to save unlocked PDF");
//                     }
//                 } else {
//                     // It's not encrypted at all - just copy the file
//                     document.close();
//                     copyFile(inputFile, outputFile);
//                     promise.resolve("PDF is not password protected. Saved as: " + outputPath);
//                 }
//                 return;
//             } catch (IOException e) {
//                 // Failed to open without password, try with empty string
//                 try {
//                     document = PDDocument.load(inputFile, "");
                    
//                     // If we get here, the PDF opened with empty password
//                     if (document.isEncrypted()) {
//                         // Remove encryption
//                         document.setAllSecurityToBeRemoved(true);
//                         document.save(outputFile);
//                         document.close();
                        
//                         if (outputFile.exists()) {
//                             promise.resolve("PDF password protection removed successfully. Saved as: " + outputPath);
//                         } else {
//                             promise.reject("SAVE_FAILED", "Failed to save unlocked PDF");
//                         }
//                     } else {
//                         // Not encrypted
//                         document.close();
//                         copyFile(inputFile, outputFile);
//                         promise.resolve("PDF is not password protected. Saved as: " + outputPath);
//                     }
//                     return;
//                 } catch (IOException e2) {
//                     // Both attempts failed, this is a password-protected PDF with a real password
//                     // Try common passwords
//                     String[] commonPasswords = {"", "password", "123456", "12345678", "123456789", "12345", "qwerty", "abc123"};
                    
//                     for (String commonPass : commonPasswords) {
//                         try {
//                             document = PDDocument.load(inputFile, commonPass);
                            
//                             if (document.isEncrypted()) {
//                                 // Remove encryption
//                                 document.setAllSecurityToBeRemoved(true);
//                                 document.save(outputFile);
//                                 document.close();
                                
//                                 if (outputFile.exists()) {
//                                     promise.resolve("PDF password protection removed successfully. Saved as: " + outputPath);
//                                 } else {
//                                     promise.reject("SAVE_FAILED", "Failed to save unlocked PDF");
//                                 }
//                                 return;
//                             } else {
//                                 document.close();
//                                 copyFile(inputFile, outputFile);
//                                 promise.resolve("PDF is not password protected. Saved as: " + outputPath);
//                                 return;
//                             }
//                         } catch (IOException e3) {
//                             // This password didn't work, try the next one
//                         }
//                     }
                    
//                     // If we get here, none of the common passwords worked
//                     // Just copy the file as-is
//                     copyFile(inputFile, outputFile);
//                     promise.resolve("PDF processed. Saved as: " + outputPath);
//                 }
//             }
//         } catch (Exception e) {
//             promise.reject("UNEXPECTED_ERROR", e.getMessage());
//         }
//     }
    
//     private void copyFile(File source, File destination) throws IOException {
//         InputStream in = null;
//         OutputStream out = null;
        
//         try {
//             in = new java.io.FileInputStream(source);
//             out = new java.io.FileOutputStream(destination);
            
//             byte[] buffer = new byte[1024];
//             int length;
//             while ((length = in.read(buffer)) > 0) {
//                 out.write(buffer, 0, length);
//             }
//         } finally {
//             if (in != null) {
//                 in.close();
//             }
//             if (out != null) {
//                 out.close();
//             }
//         }
//     }
// }