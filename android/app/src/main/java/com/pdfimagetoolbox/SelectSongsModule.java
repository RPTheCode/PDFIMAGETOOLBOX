// android/app/src/main/java/com/pdfimagetoolbox/SelectSongsModule.java
package com.pdfimagetoolbox;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.bridge.ActivityEventListener;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.BaseActivityEventListener;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;

public class SelectSongsModule extends ReactContextBaseJavaModule {

    private static final int REQUEST_CODE_PICK_AUDIO = 101;
    private Promise pickerPromise;
    private final ReactApplicationContext reactContext;

    public SelectSongsModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;

        reactContext.addActivityEventListener(mActivityEventListener);
    }

    @NonNull
    @Override
    public String getName() {
        return "SelectSongs";
    }

    @ReactMethod
    public void pickAudio(Promise promise) {
        Activity currentActivity = getCurrentActivity();

        if (currentActivity == null) {
            promise.reject("NO_ACTIVITY", "Current activity is null");
            return;
        }

        pickerPromise = promise;

        try {
            Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("audio/*"); // Filter for audio files only
            currentActivity.startActivityForResult(intent, REQUEST_CODE_PICK_AUDIO);
        } catch (Exception e) {
            pickerPromise.reject("ERROR", e.getMessage());
            pickerPromise = null;
        }
    }

    private final ActivityEventListener mActivityEventListener = new BaseActivityEventListener() {
        @Override
        public void onActivityResult(Activity activity, int requestCode, int resultCode, @Nullable Intent data) {
            if (requestCode == REQUEST_CODE_PICK_AUDIO) {
                if (pickerPromise == null) {
                    return;
                }
                if (resultCode == Activity.RESULT_CANCELED) {
                    pickerPromise.reject("CANCELLED", "User cancelled audio picking");
                    pickerPromise = null;
                    return;
                }
                if (resultCode == Activity.RESULT_OK) {
                    if (data == null) {
                        pickerPromise.reject("NO_DATA", "No data received");
                        pickerPromise = null;
                        return;
                    }
                    Uri uri = data.getData();
                    if (uri == null) {
                        pickerPromise.reject("NO_URI", "No URI found in data");
                        pickerPromise = null;
                        return;
                    }
                    WritableMap resultMap = Arguments.createMap();
                    resultMap.putString("uri", uri.toString());

                    // Get file name
                    String fileName = getFileName(uri);
                    if (fileName != null) {
                        resultMap.putString("name", fileName);
                    } else {
                        resultMap.putString("name", "unknown");
                    }

                    pickerPromise.resolve(resultMap);
                    pickerPromise = null;
                }
            }
        }
    };

    private String getFileName(Uri uri) {
        String result = null;
        Cursor cursor = null;
        try {
            cursor = reactContext.getContentResolver().query(uri, null, null, null, null);
            if (cursor != null && cursor.moveToFirst()) {
                int idx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (idx >= 0)
                    result = cursor.getString(idx);
            }
        } catch (Exception e) {
            // Ignore
        } finally {
            if (cursor != null) {
                cursor.close();
            }
        }
        return result;
    }
}
