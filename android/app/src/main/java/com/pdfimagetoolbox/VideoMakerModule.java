// android/app/src/main/java/com/pdfimagetoolbox/VideoMakerModule.java
package com.pdfimagetoolbox;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.MediaCodec;
import android.media.MediaCodecInfo;
import android.media.MediaExtractor;
import android.media.MediaFormat;
import android.media.MediaMuxer;
import android.util.Log;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import java.io.File;
import java.nio.ByteBuffer;
import android.os.Build;

public class VideoMakerModule extends ReactContextBaseJavaModule {
    private static final String TAG = "VideoMakerModule";
    private static final String MODULE_NAME = "VideoMakerModule";
    private static final int VIDEO_BIT_RATE = 2000000;
    private static final int FRAME_RATE = 30;
    private static final int I_FRAME_INTERVAL = 1;
    private static final String MIME_TYPE = "video/avc";
    private static final int TIMEOUT_US = 10000;

    public VideoMakerModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return MODULE_NAME;
    }

    // Single image without audio
    @ReactMethod
    public void convertImageToVideo(String imagePath, int durationSeconds, Promise promise) {
        try {
            Log.d(TAG, "════════════════════════════════════════");
            Log.d(TAG, "🎬 Converting SINGLE image to video (NO AUDIO)");
            Log.d(TAG, "📸 Image: " + imagePath);
            Log.d(TAG, "⏱️  Duration: " + durationSeconds + " seconds");
            
            String cleanedImagePath = cleanFilePath(imagePath);
            File imageFile = new File(cleanedImagePath);
            if (!imageFile.exists()) {
                promise.reject("IMAGE_ERROR", "Image file does not exist: " + cleanedImagePath);
                return;
            }

            BitmapFactory.Options options = new BitmapFactory.Options();
            options.inJustDecodeBounds = true;
            BitmapFactory.decodeFile(cleanedImagePath, options);
            
            if (options.outWidth <= 0 || options.outHeight <= 0) {
                promise.reject("IMAGE_ERROR", "Invalid image dimensions");
                return;
            }
            
            int[] videoDimensions = calculateVideoDimensions(options.outWidth, options.outHeight);
            Log.d(TAG, "📐 Video dimensions: " + videoDimensions[0] + "x" + videoDimensions[1]);

            Bitmap bitmap = loadAndFitBitmap(cleanedImagePath, videoDimensions[0], videoDimensions[1]);
            if (bitmap == null) {
                promise.reject("IMAGE_ERROR", "Failed to load image");
                return;
            }

            File outputFile = createOutputFile();
            generateVideoFromBitmap(bitmap, outputFile, durationSeconds, videoDimensions[0], videoDimensions[1]);
            bitmap.recycle();

            Log.d(TAG, "✅ Video created successfully: " + outputFile.getAbsolutePath());
            promise.resolve(outputFile.getAbsolutePath());
            
        } catch (Exception e) {
            Log.e(TAG, "💥 Error converting image to video", e);
            promise.reject("VIDEO_CREATION_ERROR", e.getMessage(), e);
        }
    }

    // Multiple images without audio
    @ReactMethod
    public void convertImagesToVideo(ReadableArray imagePaths, int totalDurationSeconds, Promise promise) {
        try {
            if (imagePaths.size() == 0) {
                promise.reject("ERROR", "No images provided");
                return;
            }

            Log.d(TAG, "════════════════════════════════════════");
            Log.d(TAG, "🎬 Creating slideshow (NO AUDIO)");
            Log.d(TAG, "📸 Images: " + imagePaths.size());
            Log.d(TAG, "⏱️  Total Duration: " + totalDurationSeconds + " seconds");
            Log.d(TAG, "════════════════════════════════════════");

            String firstImage = cleanFilePath(imagePaths.getString(0));
            BitmapFactory.Options options = new BitmapFactory.Options();
            options.inJustDecodeBounds = true;
            BitmapFactory.decodeFile(firstImage, options);
            int[] videoDimensions = calculateVideoDimensions(options.outWidth, options.outHeight);
            Log.d(TAG, "📐 Video dimensions: " + videoDimensions[0] + "x" + videoDimensions[1]);

            File outputFile = createOutputFile();
            
            Log.d(TAG, "⏱️  Requested total duration: " + totalDurationSeconds + " seconds");
            
            // Pass total duration so generator can distribute frames precisely
            generateMultiImageVideo(imagePaths, totalDurationSeconds, videoDimensions[0], videoDimensions[1], outputFile);
            
            Log.d(TAG, "✅ Slideshow created successfully: " + outputFile.getAbsolutePath());
            promise.resolve(outputFile.getAbsolutePath());
            
        } catch (Exception e) {
            Log.e(TAG, "💥 Error creating slideshow", e);
            promise.reject("VIDEO_CREATION_ERROR", e.getMessage(), e);
        }
    }

    // Single image with audio
    @ReactMethod
    public void convertImageToVideoWithAudio(String imagePath, String audioPath, int durationSeconds, Promise promise) {
        File tempVideo = null;
        File processedAudio = null;
        try {
            Log.d(TAG, "════════════════════════════════════════");
            Log.d(TAG, "🎵 Converting SINGLE image to video WITH AUDIO");
            Log.d(TAG, "📸 Image: " + imagePath);
            Log.d(TAG, "🎵 Audio: " + audioPath);
            Log.d(TAG, "⏱️  Duration: " + durationSeconds + " seconds");

            String cleanedImagePath = cleanFilePath(imagePath);
            String cleanedAudioPath = cleanFilePath(audioPath);

            File audioFile = new File(cleanedAudioPath);
            if (!audioFile.exists()) {
                promise.reject("AUDIO_ERROR", "Audio file does not exist: " + cleanedAudioPath);
                return;
            }
            Log.d(TAG, "✅ Audio file exists: " + audioFile.length() + " bytes");

            // Get audio duration
            long audioDurationUs = getAudioDuration(cleanedAudioPath);
            long audioDurationSeconds = audioDurationUs / 1000000;
            Log.d(TAG, "🎵 Audio duration: " + audioDurationSeconds + " seconds");
            Log.d(TAG, "📹 Video duration: " + durationSeconds + " seconds");

            // Process audio based on duration comparison
            if (audioDurationSeconds < durationSeconds) {
                Log.d(TAG, "🔁 Audio is shorter than video - will loop audio");
                processedAudio = loopAudio(cleanedAudioPath, durationSeconds);
                cleanedAudioPath = processedAudio.getAbsolutePath();
            } else if (audioDurationSeconds > durationSeconds) {
                Log.d(TAG, "✂️  Audio is longer than video - will trim audio");
            } else {
                Log.d(TAG, "✅ Audio and video durations match");
            }

            BitmapFactory.Options options = new BitmapFactory.Options();
            options.inJustDecodeBounds = true;
            BitmapFactory.decodeFile(cleanedImagePath, options);
            int[] dims = calculateVideoDimensions(options.outWidth, options.outHeight);

            Bitmap bitmap = loadAndFitBitmap(cleanedImagePath, dims[0], dims[1]);
            if (bitmap == null) {
                promise.reject("IMAGE_ERROR", "Failed to load image");
                return;
            }

            Log.d(TAG, "📹 Step 1: Creating temporary video without audio...");
            tempVideo = new File(getReactApplicationContext().getCacheDir(), "temp_video_" + System.currentTimeMillis() + ".mp4");
            generateVideoFromBitmap(bitmap, tempVideo, durationSeconds, dims[0], dims[1]);
            bitmap.recycle();
            
            if (!tempVideo.exists() || tempVideo.length() == 0) {
                throw new Exception("Temporary video file was not created properly");
            }
            Log.d(TAG, "✅ Temp video created successfully: " + tempVideo.length() + " bytes");
            
            Log.d(TAG, "🎵 Step 2: Merging audio with video...");
            File outputFile = createOutputFile();
            mergeAudioWithVideo(tempVideo.getAbsolutePath(), cleanedAudioPath, outputFile.getAbsolutePath(), durationSeconds);
            
            if (!outputFile.exists() || outputFile.length() == 0) {
                throw new Exception("Final video file was not created properly");
            }
            Log.d(TAG, "✅ Final video created: " + outputFile.length() + " bytes");

            Log.d(TAG, "✅ Video WITH AUDIO created: " + outputFile.getAbsolutePath());
            promise.resolve(outputFile.getAbsolutePath());

        } catch (Exception e) {
            Log.e(TAG, "💥 Error creating video with audio", e);
            promise.reject("VIDEO_AUDIO_ERROR", e.getMessage(), e);
        } finally {
            if (tempVideo != null && tempVideo.exists()) {
                boolean deleted = tempVideo.delete();
                Log.d(TAG, "🗑️  Temp video deleted: " + deleted);
            }
            if (processedAudio != null && processedAudio.exists()) {
                boolean deleted = processedAudio.delete();
                Log.d(TAG, "🗑️  Processed audio deleted: " + deleted);
            }
        }
    }

    // Multiple images with audio
    @ReactMethod
    public void convertImagesToVideoWithAudio(ReadableArray imagePaths, String audioPath, int totalDurationSeconds, Promise promise) {
        File tempVideo = null;
        File processedAudio = null;
        try {
            if (imagePaths.size() == 0) {
                promise.reject("ERROR", "No images provided");
                return;
            }

            Log.d(TAG, "════════════════════════════════════════");
            Log.d(TAG, "🎵 Creating slideshow WITH AUDIO");
            Log.d(TAG, "📸 Images: " + imagePaths.size());
            Log.d(TAG, "🎵 Audio: " + audioPath);
            Log.d(TAG, "⏱️  Total Duration: " + totalDurationSeconds + " seconds");
            Log.d(TAG, "════════════════════════════════════════");

            String cleanedAudioPath = cleanFilePath(audioPath);

            File audioFile = new File(cleanedAudioPath);
            if (!audioFile.exists()) {
                promise.reject("AUDIO_ERROR", "Audio file does not exist: " + cleanedAudioPath);
                return;
            }
            Log.d(TAG, "✅ Audio file exists: " + audioFile.length() + " bytes");

            // Get audio duration
            long audioDurationUs = getAudioDuration(cleanedAudioPath);
            long audioDurationSeconds = audioDurationUs / 1000000;
            Log.d(TAG, "🎵 Audio duration: " + audioDurationSeconds + " seconds");
            Log.d(TAG, "📹 Video duration: " + totalDurationSeconds + " seconds");

            // Process audio based on duration comparison
            if (audioDurationSeconds < totalDurationSeconds) {
                Log.d(TAG, "🔁 Audio is shorter than video - will loop audio");
                processedAudio = loopAudio(cleanedAudioPath, totalDurationSeconds);
                cleanedAudioPath = processedAudio.getAbsolutePath();
            } else if (audioDurationSeconds > totalDurationSeconds) {
                Log.d(TAG, "✂️  Audio is longer than video - will trim audio");
            } else {
                Log.d(TAG, "✅ Audio and video durations match");
            }

            String firstImage = cleanFilePath(imagePaths.getString(0));
            BitmapFactory.Options options = new BitmapFactory.Options();
            options.inJustDecodeBounds = true;
            BitmapFactory.decodeFile(firstImage, options);
            int[] dims = calculateVideoDimensions(options.outWidth, options.outHeight);

            Log.d(TAG, "📹 Step 1: Creating temporary video without audio...");
            tempVideo = new File(getReactApplicationContext().getCacheDir(), "temp_slideshow_" + System.currentTimeMillis() + ".mp4");
            
            Log.d(TAG, "⏱️  Requested total duration: " + totalDurationSeconds + " seconds");
            
            // Pass total duration so generator can distribute frames precisely
            generateMultiImageVideo(imagePaths, totalDurationSeconds, dims[0], dims[1], tempVideo);
            
            if (!tempVideo.exists() || tempVideo.length() == 0) {
                throw new Exception("Temporary video file was not created properly");
            }
            Log.d(TAG, "✅ Temp video created successfully: " + tempVideo.length() + " bytes");
            
            Log.d(TAG, "🎵 Step 2: Merging audio with video...");
            File outputFile = createOutputFile();
            mergeAudioWithVideo(tempVideo.getAbsolutePath(), cleanedAudioPath, outputFile.getAbsolutePath(), totalDurationSeconds);
            
            if (!outputFile.exists() || outputFile.length() == 0) {
                throw new Exception("Final video file was not created properly");
            }
            Log.d(TAG, "✅ Final video created: " + outputFile.length() + " bytes");

            Log.d(TAG, "✅ Slideshow WITH AUDIO created: " + outputFile.getAbsolutePath());
            promise.resolve(outputFile.getAbsolutePath());

        } catch (Exception e) {
            Log.e(TAG, "💥 Error creating slideshow with audio", e);
            promise.reject("SLIDESHOW_AUDIO_ERROR", e.getMessage(), e);
        } finally {
            if (tempVideo != null && tempVideo.exists()) {
                boolean deleted = tempVideo.delete();
                Log.d(TAG, "🗑️  Temp video deleted: " + deleted);
            }
            if (processedAudio != null && processedAudio.exists()) {
                boolean deleted = processedAudio.delete();
                Log.d(TAG, "🗑️  Processed audio deleted: " + deleted);
            }
        }
    }

    // ============================================
    // NEW METHOD: Get Audio Duration
    // ============================================
    
    private long getAudioDuration(String audioPath) throws Exception {
        MediaExtractor extractor = new MediaExtractor();
        try {
            extractor.setDataSource(audioPath);
            
            for (int i = 0; i < extractor.getTrackCount(); i++) {
                MediaFormat format = extractor.getTrackFormat(i);
                String mime = format.getString(MediaFormat.KEY_MIME);
                
                if (mime.startsWith("audio/")) {
                    long durationUs = format.getLong(MediaFormat.KEY_DURATION);
                    return durationUs;
                }
            }
            
            throw new Exception("No audio track found in file");
            
        } finally {
            extractor.release();
        }
    }

    // ============================================
    // NEW METHOD: Loop Audio to Match Video Duration
    // ============================================
    
    private File loopAudio(String audioPath, int targetDurationSeconds) throws Exception {
        Log.d(TAG, "🔁 Starting audio loop process...");
        
        MediaExtractor extractor = new MediaExtractor();
        
        try {
            extractor.setDataSource(audioPath);
            
            int audioTrackIndex = -1;
            MediaFormat audioFormat = null;
            
            for (int i = 0; i < extractor.getTrackCount(); i++) {
                MediaFormat format = extractor.getTrackFormat(i);
                String mime = format.getString(MediaFormat.KEY_MIME);
                if (mime.startsWith("audio/")) {
                    audioTrackIndex = i;
                    audioFormat = format;
                    break;
                }
            }
            
            if (audioTrackIndex == -1) {
                throw new Exception("No audio track found");
            }
            
            String audioMime = audioFormat.getString(MediaFormat.KEY_MIME);
            Log.d(TAG, "🎵 Audio format: " + audioMime);
            
            // If MP3, convert to AAC first before looping
            if (audioMime != null && (audioMime.equalsIgnoreCase("audio/mpeg") || audioMime.contains("mpeg") || audioMime.contains("mp3"))) {
                Log.d(TAG, "🔁 MP3 detected - converting to AAC before looping");
                extractor.release();
                
                String aacPath = convertMp3ToAac(audioPath);
                if (aacPath == null) {
                    throw new Exception("Failed to convert MP3 to AAC");
                }
                
                Log.d(TAG, "✅ MP3 converted to AAC, now looping AAC file");
                
                File result = loopAacAudio(aacPath, targetDurationSeconds);
                
                // Clean up temp converted file
                try {
                    new File(aacPath).delete();
                } catch (Exception e) {
                    Log.w(TAG, "Could not delete temp AAC file");
                }
                
                return result;
            } else {
                extractor.release();
                return loopAacAudio(audioPath, targetDurationSeconds);
            }
            
        } catch (Exception e) {
            extractor.release();
            throw e;
        }
    }
    
    private File loopAacAudio(String audioPath, int targetDurationSeconds) throws Exception {
        Log.d(TAG, "🔁 Looping AAC audio...");
        
        MediaExtractor extractor = new MediaExtractor();
        MediaMuxer muxer = null;
        
        try {
            extractor.setDataSource(audioPath);
            
            int audioTrackIndex = -1;
            MediaFormat audioFormat = null;
            
            for (int i = 0; i < extractor.getTrackCount(); i++) {
                MediaFormat format = extractor.getTrackFormat(i);
                String mime = format.getString(MediaFormat.KEY_MIME);
                if (mime.startsWith("audio/")) {
                    audioTrackIndex = i;
                    audioFormat = format;
                    break;
                }
            }
            
            if (audioTrackIndex == -1) {
                throw new Exception("No audio track found");
            }
            
            long audioDurationUs = audioFormat.getLong(MediaFormat.KEY_DURATION);
            long targetDurationUs = targetDurationSeconds * 1000000L;
            
            int loopCount = (int) Math.ceil((double) targetDurationUs / audioDurationUs);
            Log.d(TAG, "🔁 Will loop audio " + loopCount + " times");
            
            File loopedAudio = new File(getReactApplicationContext().getCacheDir(), 
                "looped_audio_" + System.currentTimeMillis() + ".m4a");
            
            muxer = new MediaMuxer(loopedAudio.getAbsolutePath(), 
                MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4);
            
            // Sanitize format before adding
            MediaFormat sanitizedFormat = sanitizeMediaFormat(audioFormat);
            int muxerTrackIndex = muxer.addTrack(sanitizedFormat);
            muxer.start();
            
            extractor.selectTrack(audioTrackIndex);
            
            ByteBuffer buffer = ByteBuffer.allocate(512 * 1024);
            MediaCodec.BufferInfo bufferInfo = new MediaCodec.BufferInfo();
            
            long totalWrittenUs = 0;
            
            for (int loop = 0; loop < loopCount; loop++) {
                extractor.seekTo(0, MediaExtractor.SEEK_TO_CLOSEST_SYNC);
                
                while (true) {
                    buffer.clear();
                    int sampleSize = extractor.readSampleData(buffer, 0);
                    if (sampleSize < 0) break;
                    
                    long sampleTime = extractor.getSampleTime();
                    long adjustedTime = totalWrittenUs + sampleTime;
                    
                    if (adjustedTime >= targetDurationUs) {
                        Log.d(TAG, "✅ Reached target duration, stopping audio loop");
                        break;
                    }
                    
                    bufferInfo.set(0, sampleSize, adjustedTime, extractor.getSampleFlags());
                    muxer.writeSampleData(muxerTrackIndex, buffer, bufferInfo);
                    
                    extractor.advance();
                }
                
                totalWrittenUs += audioDurationUs;
                
                if (totalWrittenUs >= targetDurationUs) {
                    break;
                }
            }
            
            Log.d(TAG, "✅ Audio looped successfully");
            return loopedAudio;
            
        } finally {
            extractor.release();
            if (muxer != null) {
                try {
                    muxer.stop();
                    muxer.release();
                    Log.d(TAG, "Muxer released");
                } catch (Exception e) {
                    Log.e(TAG, "Error releasing muxer", e);
                }
            }
        }
    }

    // ============================================
    // VIDEO GENERATION METHODS
    // ============================================

    private void generateVideoFromBitmap(Bitmap bitmap, File outputFile, int duration, int width, int height) throws Exception {
        Log.d(TAG, "🎥 Starting video generation from single bitmap");
        
        MediaCodec encoder = null;
        MediaMuxer muxer = null;
        
        try {
            MediaFormat format = MediaFormat.createVideoFormat(MIME_TYPE, width, height);
            format.setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420Flexible);
            format.setInteger(MediaFormat.KEY_BIT_RATE, VIDEO_BIT_RATE);
            format.setInteger(MediaFormat.KEY_FRAME_RATE, FRAME_RATE);
            format.setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, I_FRAME_INTERVAL);
            // Ensure encoder has enough input buffer size for our YUV frames
            format.setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, width * height * 3 / 2);
            // Ensure encoder has enough input buffer size for our YUV frames
            format.setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, width * height * 3 / 2);
            
            encoder = MediaCodec.createEncoderByType(MIME_TYPE);
            encoder.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE);
            encoder.start();
            Log.d(TAG, "✅ Encoder started");
            
            muxer = new MediaMuxer(outputFile.getAbsolutePath(), MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4);
            
            MediaCodec.BufferInfo bufferInfo = new MediaCodec.BufferInfo();
            int trackIndex = -1;
            boolean muxerStarted = false;
            
            int totalFrames = FRAME_RATE * duration;
            byte[] yuvData = convertBitmapToYUV420(bitmap, width, height);
            
            long presentationTimeUs = 0;
            int frameIndex = 0;
            boolean encodingDone = false;
            
            Log.d(TAG, "📹 Encoding " + totalFrames + " frames for " + duration + " seconds...");
            
            while (!encodingDone) {
                if (frameIndex < totalFrames) {
                    int inputBufferIndex = encoder.dequeueInputBuffer(TIMEOUT_US);
                    if (inputBufferIndex >= 0) {
                        ByteBuffer inputBuffer = encoder.getInputBuffer(inputBufferIndex);
                        inputBuffer.clear();
                        long pts = computePresentationTimeUs(frameIndex);

                        // Defensive: ensure buffer can hold data
                        if (inputBuffer.remaining() >= yuvData.length) {
                            inputBuffer.put(yuvData);
                            encoder.queueInputBuffer(inputBufferIndex, 0, yuvData.length, pts, 0);
                        } else {
                            // If input buffer is smaller than expected, write in chunks
                            int offset = 0;
                            while (offset < yuvData.length) {
                                int toWrite = Math.min(inputBuffer.remaining(), yuvData.length - offset);
                                inputBuffer.put(yuvData, offset, toWrite);
                                encoder.queueInputBuffer(inputBufferIndex, 0, toWrite, pts, 0);
                                offset += toWrite;
                                // try get next input buffer for remaining data
                                inputBufferIndex = encoder.dequeueInputBuffer(TIMEOUT_US);
                                if (inputBufferIndex < 0) break;
                                inputBuffer = encoder.getInputBuffer(inputBufferIndex);
                                inputBuffer.clear();
                            }
                        }

                        presentationTimeUs = pts;
                        frameIndex++;
                    }
                } else if (frameIndex == totalFrames) {
                    int inputBufferIndex = encoder.dequeueInputBuffer(TIMEOUT_US);
                    if (inputBufferIndex >= 0) {
                        long pts = computePresentationTimeUs(frameIndex - 1);
                        encoder.queueInputBuffer(inputBufferIndex, 0, 0, pts, MediaCodec.BUFFER_FLAG_END_OF_STREAM);
                        frameIndex++;
                        Log.d(TAG, "🏁 End of stream signaled");
                    }
                }
                
                int outputBufferIndex = encoder.dequeueOutputBuffer(bufferInfo, TIMEOUT_US);
                
                if (outputBufferIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                    if (muxerStarted) {
                        throw new RuntimeException("Format changed twice");
                    }
                    MediaFormat newFormat = encoder.getOutputFormat();
                    trackIndex = muxer.addTrack(newFormat);
                    muxer.start();
                    muxerStarted = true;
                    Log.d(TAG, "✅ Muxer started with track index: " + trackIndex);
                    
                } else if (outputBufferIndex >= 0) {
                    ByteBuffer outputBuffer = encoder.getOutputBuffer(outputBufferIndex);
                    
                    if ((bufferInfo.flags & MediaCodec.BUFFER_FLAG_CODEC_CONFIG) != 0) {
                        bufferInfo.size = 0;
                    }
                    
                    if (bufferInfo.size > 0 && muxerStarted) {
                        outputBuffer.position(bufferInfo.offset);
                        outputBuffer.limit(bufferInfo.offset + bufferInfo.size);
                        muxer.writeSampleData(trackIndex, outputBuffer, bufferInfo);
                    }
                    
                    encoder.releaseOutputBuffer(outputBufferIndex, false);
                    
                    if ((bufferInfo.flags & MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) {
                        encodingDone = true;
                        Log.d(TAG, "✅ Encoding complete");
                    }
                }
            }
            
        } finally {
            if (encoder != null) {
                try {
                    encoder.stop();
                    encoder.release();
                    Log.d(TAG, "Encoder released");
                } catch (Exception e) {
                    Log.e(TAG, "Error releasing encoder", e);
                }
            }
            if (muxer != null) {
                try {
                    muxer.stop();
                    muxer.release();
                    Log.d(TAG, "Muxer released");
                } catch (Exception e) {
                    Log.e(TAG, "Error releasing muxer", e);
                }
            }
        }
    }

    // durationSeconds is the total requested video duration (seconds).
    private void generateMultiImageVideo(ReadableArray imagePaths, int durationSeconds, 
                                        int width, int height, File outputFile) throws Exception {
        Log.d(TAG, "🎥 Starting multi-image video generation");
        
        MediaCodec encoder = null;
        MediaMuxer muxer = null;
        
        try {
            MediaFormat format = MediaFormat.createVideoFormat(MIME_TYPE, width, height);
            format.setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420Flexible);
            format.setInteger(MediaFormat.KEY_BIT_RATE, VIDEO_BIT_RATE);
            format.setInteger(MediaFormat.KEY_FRAME_RATE, FRAME_RATE);
            format.setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, I_FRAME_INTERVAL);
            
            encoder = MediaCodec.createEncoderByType(MIME_TYPE);
            encoder.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE);
            encoder.start();
            Log.d(TAG, "✅ Encoder started");
            
            muxer = new MediaMuxer(outputFile.getAbsolutePath(), MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4);
            
            MediaCodec.BufferInfo bufferInfo = new MediaCodec.BufferInfo();
            int trackIndex = -1;
            boolean muxerStarted = false;
            
            // Compute exact frame distribution so sum(framesPerImage) == FRAME_RATE * durationSeconds
            int imageCount = imagePaths.size();
            int totalFrames = FRAME_RATE * durationSeconds;
            if (totalFrames <= 0) totalFrames = FRAME_RATE; // fallback to 1 second

            int base = totalFrames / imageCount;
            int rem = totalFrames % imageCount; // distribute the remainder across first images

            int[] framesPerImageArr = new int[imageCount];
            for (int i = 0; i < imageCount; i++) {
                framesPerImageArr[i] = base + (i < rem ? 1 : 0);
            }

            long presentationTimeUs = 0;
            int globalFrameIndex = 0;
            boolean inputEOS = false;
            boolean outputEOS = false;

            Log.d(TAG, "📹 Encoding " + totalFrames + " total frames (distributed across " + imageCount + " images)");
            Log.d(TAG, "⏱️  Total video duration: " + (totalFrames / (float) FRAME_RATE) + " seconds");
            
            while (!outputEOS) {
                if (!inputEOS) {
                    int inputBufferIndex = encoder.dequeueInputBuffer(TIMEOUT_US);
                    if (inputBufferIndex >= 0) {
                        // Determine current image index by walking the framesPerImageArr
                        int remaining = globalFrameIndex;
                        int imageIndex = 0;
                        while (imageIndex < framesPerImageArr.length && remaining >= framesPerImageArr[imageIndex]) {
                            remaining -= framesPerImageArr[imageIndex];
                            imageIndex++;
                        }
                        int frameInImage = remaining;

                        if (imageIndex >= imagePaths.size()) {
                            encoder.queueInputBuffer(inputBufferIndex, 0, 0, presentationTimeUs,
                                MediaCodec.BUFFER_FLAG_END_OF_STREAM);
                            inputEOS = true;
                            Log.d(TAG, "🏁 End of stream signaled");
                        } else {
                            if (frameInImage == 0) {
                                String imagePath = cleanFilePath(imagePaths.getString(imageIndex));
                                Log.d(TAG, "📸 Processing image " + (imageIndex + 1) + "/" + imagePaths.size());
                            }

                            byte[] yuvData = getYUVDataForImage(imagePaths, imageIndex, width, height);
                            if (yuvData != null) {
                                ByteBuffer inputBuffer = encoder.getInputBuffer(inputBufferIndex);
                                inputBuffer.clear();
                                long pts = computePresentationTimeUs(globalFrameIndex);

                                if (inputBuffer.remaining() >= yuvData.length) {
                                    inputBuffer.put(yuvData);
                                    encoder.queueInputBuffer(inputBufferIndex, 0, yuvData.length, pts, 0);
                                } else {
                                    // chunked write if encoder input buffer is small
                                    int offset = 0;
                                    while (offset < yuvData.length) {
                                        int toWrite = Math.min(inputBuffer.remaining(), yuvData.length - offset);
                                        inputBuffer.put(yuvData, offset, toWrite);
                                        encoder.queueInputBuffer(inputBufferIndex, 0, toWrite, pts, 0);
                                        offset += toWrite;
                                        inputBufferIndex = encoder.dequeueInputBuffer(TIMEOUT_US);
                                        if (inputBufferIndex < 0) break;
                                        inputBuffer = encoder.getInputBuffer(inputBufferIndex);
                                        inputBuffer.clear();
                                    }
                                }

                                presentationTimeUs = pts;
                                globalFrameIndex++;
                            }
                        }
                    }
                }
                
                int outputBufferIndex = encoder.dequeueOutputBuffer(bufferInfo, TIMEOUT_US);
                
                switch (outputBufferIndex) {
                    case MediaCodec.INFO_OUTPUT_FORMAT_CHANGED:
                        MediaFormat newFormat = encoder.getOutputFormat();
                        trackIndex = muxer.addTrack(newFormat);
                        muxer.start();
                        muxerStarted = true;
                        Log.d(TAG, "✅ Muxer started with track index: " + trackIndex);
                        break;
                        
                    case MediaCodec.INFO_TRY_AGAIN_LATER:
                        break;
                        
                    default:
                        if (outputBufferIndex >= 0) {
                            ByteBuffer outputBuffer = encoder.getOutputBuffer(outputBufferIndex);
                            
                            if ((bufferInfo.flags & MediaCodec.BUFFER_FLAG_CODEC_CONFIG) != 0) {
                                bufferInfo.size = 0;
                            }
                            
                            if (bufferInfo.size > 0 && muxerStarted) {
                                outputBuffer.position(bufferInfo.offset);
                                outputBuffer.limit(bufferInfo.offset + bufferInfo.size);
                                muxer.writeSampleData(trackIndex, outputBuffer, bufferInfo);
                            }
                            
                            encoder.releaseOutputBuffer(outputBufferIndex, false);
                            
                            if ((bufferInfo.flags & MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) {
                                outputEOS = true;
                                Log.d(TAG, "✅ Encoding complete - received EOS");
                            }
                        }
                        break;
                }
            }
            
        } finally {
            if (encoder != null) {
                try {
                    encoder.stop();
                    encoder.release();
                    Log.d(TAG, "Encoder released");
                } catch (Exception e) {
                    Log.e(TAG, "Error releasing encoder", e);
                }
            }
            if (muxer != null) {
                try {
                    muxer.stop();
                    muxer.release();
                    Log.d(TAG, "Muxer released");
                } catch (Exception e) {
                    Log.e(TAG, "Error releasing muxer", e);
                }
            }
        }
    }

    private byte[] getYUVDataForImage(ReadableArray imagePaths, int imageIndex, int width, int height) {
        try {
            String imagePath = cleanFilePath(imagePaths.getString(imageIndex));
            Bitmap bitmap = loadAndFitBitmap(imagePath, width, height);
            if (bitmap == null) {
                Log.w(TAG, "⚠️  Failed to load image, using black frame: " + imagePath);
                return createBlackYUVFrame(width, height);
            }
            
            byte[] yuvData = convertBitmapToYUV420(bitmap, width, height);
            bitmap.recycle();
            return yuvData;
            
        } catch (Exception e) {
            Log.e(TAG, "Error getting YUV data for image", e);
            return createBlackYUVFrame(width, height);
        }
    }

    private byte[] createBlackYUVFrame(int width, int height) {
        byte[] yuv = new byte[width * height * 3 / 2];
        for (int i = 0; i < width * height; i++) {
            yuv[i] = 0;
        }
        for (int i = width * height; i < yuv.length; i++) {
            yuv[i] = (byte) 128;
        }
        return yuv;
    }




    // ============================================
    // UPDATED AUDIO MERGING - Handles both trimming and looping
    // ============================================

    private void mergeAudioWithVideo(String videoPath, String audioPath, String outputPath, int targetDurationSeconds) throws Exception {
        Log.d(TAG, "🔀 Merging audio with video");
        
        MediaMuxer muxer = null;
        MediaExtractor videoExtractor = null;
        MediaExtractor audioExtractor = null;
        
        String convertedTempAudioPath = null;
        // If device API < 18, MediaMuxer is not available / supported reliably.
        // Avoid attempting to merge audio on very old devices to prevent IllegalStateException.
        if (Build.VERSION.SDK_INT < 18) {
            Log.w(TAG, "⚠️  Device API < 18 - MediaMuxer unsupported. Returning video-only output.");
            // Try to copy videoPath to outputPath and return gracefully
            try {
                java.io.File src = new java.io.File(videoPath);
                java.io.File dst = new java.io.File(outputPath);
                java.io.FileInputStream fis = new java.io.FileInputStream(src);
                java.io.FileOutputStream fos = new java.io.FileOutputStream(dst);
                java.nio.channels.FileChannel in = fis.getChannel();
                java.nio.channels.FileChannel out = fos.getChannel();
                in.transferTo(0, in.size(), out);
                in.close();
                out.close();
                fis.close();
                fos.close();
                Log.d(TAG, "✅ Copied video to output (no audio) for API<18 device");
                return;
            } catch (Exception e) {
                Log.e(TAG, "❌ Failed to copy video for API<18 fallback: " + e.getMessage());
                // Fall through to regular path and let the existing logic handle/throw
            }
        }
        try {
            muxer = new MediaMuxer(outputPath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4);

            // Setup video extractor
            videoExtractor = new MediaExtractor();
            videoExtractor.setDataSource(videoPath);

            int videoTrackIndex = -1;
            MediaFormat videoFormat = null;

            for (int i = 0; i < videoExtractor.getTrackCount(); i++) {
                MediaFormat format = videoExtractor.getTrackFormat(i);
                String mime = format.getString(MediaFormat.KEY_MIME);
                if (mime != null && mime.startsWith("video/")) {
                    videoTrackIndex = i;
                    videoFormat = format;
                    Log.d(TAG, "✅ Found video track: " + mime);
                    break;
                }
            }

            if (videoTrackIndex == -1) {
                throw new Exception("No video track found");
            }

            // Setup audio extractor
            audioExtractor = new MediaExtractor();
            audioExtractor.setDataSource(audioPath);

            int audioTrackIndex = -1;
            MediaFormat audioFormat = null;

            for (int i = 0; i < audioExtractor.getTrackCount(); i++) {
                MediaFormat format = audioExtractor.getTrackFormat(i);
                String mime = format.getString(MediaFormat.KEY_MIME);
                if (mime != null && mime.startsWith("audio/")) {
                    audioTrackIndex = i;
                    audioFormat = format;
                    Log.d(TAG, "✅ Found audio track: " + mime);
                    break;
                }
            }

            boolean audioAvailable = true;
            if (audioTrackIndex == -1 || audioFormat == null) {
                Log.w(TAG, "⚠️  No audio track found in audio file - proceeding without audio");
                audioAvailable = false;
            }

            // If input audio is MP3, convert to AAC first to avoid muxer/format issues
            if (audioAvailable) {
                String audioMime = audioFormat.getString(MediaFormat.KEY_MIME);
                if (audioMime != null && (audioMime.equalsIgnoreCase("audio/mpeg") || audioMime.contains("mpeg") || audioMime.contains("mp3"))) {
                    Log.d(TAG, "🔁 Detected MP3 audio, attempting to convert to AAC to avoid muxer issues...");
                    try {
                        String converted = convertMp3ToAac(audioPath);
                        if (converted != null) {
                            convertedTempAudioPath = converted;
                            Log.d(TAG, "🔁 MP3 converted to AAC at: " + converted);
                            // release and re-create extractor for converted file
                            audioExtractor.release();
                            audioExtractor = new MediaExtractor();
                            audioExtractor.setDataSource(converted);

                            // re-find track
                            audioTrackIndex = -1;
                            audioFormat = null;
                            for (int i = 0; i < audioExtractor.getTrackCount(); i++) {
                                MediaFormat format = audioExtractor.getTrackFormat(i);
                                String mime = format.getString(MediaFormat.KEY_MIME);
                                if (mime != null && mime.startsWith("audio/")) {
                                    audioTrackIndex = i;
                                    audioFormat = format;
                                    Log.d(TAG, "✅ Found converted audio track: " + mime);
                                    break;
                                }
                            }
                            if (audioTrackIndex == -1 || audioFormat == null) {
                                Log.w(TAG, "⚠️  Converted audio file has no audio track - dropping audio");
                                audioAvailable = false;
                            }
                        } else {
                            Log.w(TAG, "⚠️  Conversion returned null path - dropping audio");
                            audioAvailable = false;
                        }
                    } catch (Exception convEx) {
                        Log.e(TAG, "Error converting MP3 to AAC, dropping audio: " + convEx.getMessage());
                        audioAvailable = false;
                    }
                }
            }

            // Add video track first (must be added before muxer.start())
            int muxerVideoTrackIndex = -1;
            Integer muxerAudioTrackIndex = null;
            try {
                // Sanitize video format before adding to avoid IllegalStateException
                MediaFormat sanitizedVideoFormat = sanitizeMediaFormat(videoFormat);
                muxerVideoTrackIndex = muxer.addTrack(sanitizedVideoFormat);
                Log.d(TAG, "✅ Video track added - index: " + muxerVideoTrackIndex);
            } catch (IllegalStateException iae) {
                Log.e(TAG, "❌ Failed to add VIDEO track to muxer: " + iae.getMessage());
                
                // Log detailed format information
                try {
                    if (videoFormat != null) {
                        Log.e(TAG, "VIDEO FORMAT DUMP:");
                        Log.e(TAG, "  MIME: " + videoFormat.getString(MediaFormat.KEY_MIME));
                        Log.e(TAG, "  Width: " + videoFormat.getInteger(MediaFormat.KEY_WIDTH));
                        Log.e(TAG, "  Height: " + videoFormat.getInteger(MediaFormat.KEY_HEIGHT));
                        if (videoFormat.containsKey(MediaFormat.KEY_BIT_RATE)) {
                            Log.e(TAG, "  Bitrate: " + videoFormat.getInteger(MediaFormat.KEY_BIT_RATE));
                        }
                        if (videoFormat.containsKey(MediaFormat.KEY_FRAME_RATE)) {
                            Log.e(TAG, "  Frame rate: " + videoFormat.getInteger(MediaFormat.KEY_FRAME_RATE));
                        }
                    }
                } catch (Exception e) {
                    Log.w(TAG, "Could not log format details", e);
                }
                
                // Release and fallback to video-only copy
                try {
                    muxer.release();
                } catch (Exception ex) {
                    Log.w(TAG, "Error releasing muxer during fallback", ex);
                }
                
                // Copy video file as-is
                try {
                    java.io.File src = new java.io.File(videoPath);
                    java.io.File dst = new java.io.File(outputPath);
                    java.io.FileInputStream fis = new java.io.FileInputStream(src);
                    java.io.FileOutputStream fos = new java.io.FileOutputStream(dst);
                    java.nio.channels.FileChannel in = fis.getChannel();
                    java.nio.channels.FileChannel out = fos.getChannel();
                    in.transferTo(0, in.size(), out);
                    in.close(); out.close(); fis.close(); fos.close();
                    Log.d(TAG, "✅ Fallback: copied video to output (no audio merge)");
                    return;
                } catch (Exception ex) {
                    Log.e(TAG, "Fallback copy failed", ex);
                    throw new Exception("Failed to add video track to muxer and fallback copy failed: " + ex.getMessage());
                }
            }

            // Try to add audio track if available and looks compatible
            if (audioAvailable && audioFormat != null) {
                try {
                    // Sanitize audio format before adding to avoid IllegalStateException
                    MediaFormat sanitizedAudioFormat = sanitizeMediaFormat(audioFormat);
                    muxerAudioTrackIndex = muxer.addTrack(sanitizedAudioFormat);
                    Log.d(TAG, "✅ Audio track added - index: " + muxerAudioTrackIndex);
                } catch (IllegalStateException iae) {
                    Log.e(TAG, "❌ Failed to add audio track to muxer, dropping audio: " + iae.getMessage());
                    
                    // Log audio format details
                    try {
                        if (audioFormat != null) {
                            Log.e(TAG, "AUDIO FORMAT DUMP:");
                            Log.e(TAG, "  MIME: " + audioFormat.getString(MediaFormat.KEY_MIME));
                            Log.e(TAG, "  Sample rate: " + audioFormat.getInteger(MediaFormat.KEY_SAMPLE_RATE));
                            Log.e(TAG, "  Channels: " + audioFormat.getInteger(MediaFormat.KEY_CHANNEL_COUNT));
                        }
                    } catch (Exception e) {
                        Log.w(TAG, "Could not log audio format details", e);
                    }
                    
                    audioAvailable = false;
                    muxerAudioTrackIndex = null;
                }
            }

            // Start muxer after adding available tracks
            muxer.start();
            Log.d(TAG, "✅ Muxer started");

            // Select tracks
            videoExtractor.selectTrack(videoTrackIndex);
            if (audioAvailable && audioExtractor != null && audioTrackIndex >= 0) {
                audioExtractor.selectTrack(audioTrackIndex);
            }

            ByteBuffer buffer = ByteBuffer.allocate(512 * 1024);
            MediaCodec.BufferInfo bufferInfo = new MediaCodec.BufferInfo();

            // Copy video samples
            Log.d(TAG, "📹 Copying video samples...");
            videoExtractor.seekTo(0, MediaExtractor.SEEK_TO_CLOSEST_SYNC);
            int videoSampleCount = 0;
            long videoDurationUs = 0;

            while (true) {
                buffer.clear();
                int sampleSize = videoExtractor.readSampleData(buffer, 0);
                if (sampleSize < 0) break;

                long sampleTime = videoExtractor.getSampleTime();
                videoDurationUs = Math.max(videoDurationUs, sampleTime);
                bufferInfo.set(0, sampleSize, sampleTime, videoExtractor.getSampleFlags());
                muxer.writeSampleData(muxerVideoTrackIndex, buffer, bufferInfo);
                videoSampleCount++;
                videoExtractor.advance();
            }
            Log.d(TAG, "✅ Video copied - " + videoSampleCount + " samples");
            Log.d(TAG, "⏱️  Video duration: " + (videoDurationUs / 1000000.0) + " seconds");

            // Copy audio samples (trimmed to video duration) if audio is available
            if (audioAvailable && muxerAudioTrackIndex != null) {
                Log.d(TAG, "🔊 Copying audio samples (capped to video duration)...");
                audioExtractor.seekTo(0, MediaExtractor.SEEK_TO_CLOSEST_SYNC);
                int audioSampleCount = 0;
                long targetDurationUs = targetDurationSeconds * 1000000L;

                while (true) {
                    buffer.clear();
                    int sampleSize = audioExtractor.readSampleData(buffer, 0);
                    if (sampleSize < 0) break;

                    long audioSampleTime = audioExtractor.getSampleTime();

                    // Only include audio up to target duration
                    if (audioSampleTime <= Math.min(videoDurationUs, targetDurationUs)) {
                        bufferInfo.set(0, sampleSize, audioSampleTime, audioExtractor.getSampleFlags());
                        muxer.writeSampleData(muxerAudioTrackIndex, buffer, bufferInfo);
                        audioSampleCount++;
                    } else {
                        Log.d(TAG, "✂️  Trimming audio beyond target duration");
                        break;
                    }

                    audioExtractor.advance();
                }
                Log.d(TAG, "✅ Audio copied - " + audioSampleCount + " samples");
            } else {
                Log.d(TAG, "🔇 Audio not available or was dropped - final file will be video-only");
            }

            Log.d(TAG, "✅ Audio-video merge completed successfully");

        } catch (Exception e) {
            Log.e(TAG, "💥 Error in mergeAudioWithVideo: " + e.getMessage());
            throw e;
        } finally {
            if (muxer != null) {
                try {
                    muxer.stop();
                    muxer.release();
                } catch (Exception e) {
                    Log.e(TAG, "Error releasing muxer", e);
                }
            }
            if (videoExtractor != null) {
                videoExtractor.release();
            }
            if (audioExtractor != null) {
                audioExtractor.release();
            }

            // Clean up any temporary converted audio file we created
            if (convertedTempAudioPath != null) {
                try {
                    File conv = new File(convertedTempAudioPath);
                    if (conv.exists()) {
                        boolean deleted = conv.delete();
                        Log.d(TAG, "🗑️  Deleted temp converted audio: " + deleted + " -> " + convertedTempAudioPath);
                    }
                } catch (Exception e) {
                    Log.w(TAG, "Could not delete temporary converted audio", e);
                }
            }
        }
    }

    // ============================================
    // UTILITY METHODS
    // ============================================

    // Key fix: Sanitize MediaFormat before adding to muxer to avoid IllegalStateException
    private MediaFormat sanitizeMediaFormat(MediaFormat format) {
        try {
            String mime = format.getString(MediaFormat.KEY_MIME);
            
            if (mime.startsWith("video/")) {
                int width = format.getInteger(MediaFormat.KEY_WIDTH);
                int height = format.getInteger(MediaFormat.KEY_HEIGHT);
                MediaFormat newFormat = MediaFormat.createVideoFormat(mime, width, height);
                
                // Copy only safe, essential keys
                if (format.containsKey(MediaFormat.KEY_COLOR_FORMAT)) {
                    newFormat.setInteger(MediaFormat.KEY_COLOR_FORMAT, 
                        format.getInteger(MediaFormat.KEY_COLOR_FORMAT));
                }
                if (format.containsKey(MediaFormat.KEY_BIT_RATE)) {
                    newFormat.setInteger(MediaFormat.KEY_BIT_RATE, 
                        format.getInteger(MediaFormat.KEY_BIT_RATE));
                }
                if (format.containsKey(MediaFormat.KEY_FRAME_RATE)) {
                    newFormat.setInteger(MediaFormat.KEY_FRAME_RATE, 
                        format.getInteger(MediaFormat.KEY_FRAME_RATE));
                }
                if (format.containsKey(MediaFormat.KEY_I_FRAME_INTERVAL)) {
                    newFormat.setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 
                        format.getInteger(MediaFormat.KEY_I_FRAME_INTERVAL));
                }
                
                // Copy CSD buffers (codec-specific data)
                for (int i = 0; i < 3; i++) {
                    String csdKey = "csd-" + i;
                    if (format.containsKey(csdKey)) {
                        newFormat.setByteBuffer(csdKey, format.getByteBuffer(csdKey));
                    }
                }
                
                return newFormat;
                
            } else if (mime.startsWith("audio/")) {
                int sampleRate = format.getInteger(MediaFormat.KEY_SAMPLE_RATE);
                int channelCount = format.getInteger(MediaFormat.KEY_CHANNEL_COUNT);
                MediaFormat newFormat = MediaFormat.createAudioFormat(mime, sampleRate, channelCount);
                
                if (format.containsKey(MediaFormat.KEY_BIT_RATE)) {
                    newFormat.setInteger(MediaFormat.KEY_BIT_RATE, 
                        format.getInteger(MediaFormat.KEY_BIT_RATE));
                }
                if (format.containsKey(MediaFormat.KEY_AAC_PROFILE)) {
                    newFormat.setInteger(MediaFormat.KEY_AAC_PROFILE, 
                        format.getInteger(MediaFormat.KEY_AAC_PROFILE));
                }
                if (format.containsKey(MediaFormat.KEY_MAX_INPUT_SIZE)) {
                    newFormat.setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, 
                        format.getInteger(MediaFormat.KEY_MAX_INPUT_SIZE));
                }
                
                // Copy CSD buffers
                for (int i = 0; i < 3; i++) {
                    String csdKey = "csd-" + i;
                    if (format.containsKey(csdKey)) {
                        newFormat.setByteBuffer(csdKey, format.getByteBuffer(csdKey));
                    }
                }
                
                return newFormat;
            }
            
            return format;
            
        } catch (Exception e) {
            Log.e(TAG, "Error sanitizing format", e);
            return format;
        }
    }

    private String cleanFilePath(String filePath) {
        if (filePath == null) return null;
        return filePath.replace("file://", "").replace("%20", " ").trim();
    }

    private long computePresentationTimeUs(int frameIndex) {
        return frameIndex * 1000000L / FRAME_RATE;
    }

    private int[] calculateVideoDimensions(int originalWidth, int originalHeight) {
        int videoWidth, videoHeight;
        float aspect = (float) originalWidth / originalHeight;

        if (originalHeight > originalWidth) {
            videoHeight = 1280;
            videoWidth = Math.round(videoHeight * aspect);
        } else {
            videoWidth = 1280;
            videoHeight = Math.round(videoWidth / aspect);
        }

        videoWidth = (videoWidth / 2) * 2;
        videoHeight = (videoHeight / 2) * 2;
        
        if (videoWidth < 480) videoWidth = 480;
        if (videoHeight < 480) videoHeight = 480;
        
        return new int[]{videoWidth, videoHeight};
    }

    private Bitmap loadAndFitBitmap(String path, int targetW, int targetH) {
        try {
            BitmapFactory.Options opts = new BitmapFactory.Options();
            opts.inJustDecodeBounds = true;
            BitmapFactory.decodeFile(path, opts);
            
            if (opts.outWidth <= 0 || opts.outHeight <= 0) {
                Log.e(TAG, "Invalid image dimensions");
                return null;
            }
            
            float scale = Math.min((float) targetW / opts.outWidth, (float) targetH / opts.outHeight);
            int scaledW = Math.round(opts.outWidth * scale);
            int scaledH = Math.round(opts.outHeight * scale);
            
            opts.inJustDecodeBounds = false;
            opts.inSampleSize = calculateInSampleSize(opts, scaledW, scaledH);
            opts.inPreferredConfig = Bitmap.Config.ARGB_8888;
            
            Bitmap src = BitmapFactory.decodeFile(path, opts);
            if (src == null) {
                Log.e(TAG, "Failed to decode bitmap: " + path);
                return null;
            }

            if (src.getWidth() != scaledW || src.getHeight() != scaledH) {
                Bitmap scaled = Bitmap.createScaledBitmap(src, scaledW, scaledH, true);
                src.recycle();
                src = scaled;
            }

            Bitmap output = Bitmap.createBitmap(targetW, targetH, Bitmap.Config.ARGB_8888);
            android.graphics.Canvas canvas = new android.graphics.Canvas(output);
            canvas.drawColor(0xFF000000);
            
            int left = (targetW - scaledW) / 2;
            int top = (targetH - scaledH) / 2;
            canvas.drawBitmap(src, left, top, null);
            
            src.recycle();
            return output;
            
        } catch (Exception e) {
            Log.e(TAG, "Error loading bitmap: " + path, e);
            return null;
        }
    }

    private int calculateInSampleSize(BitmapFactory.Options options, int reqW, int reqH) {
        int height = options.outHeight;
        int width = options.outWidth;
        int inSampleSize = 1;

        if (height > reqH || width > reqW) {
            int halfHeight = height / 2;
            int halfWidth = width / 2;

            while ((halfHeight / inSampleSize) >= reqH && (halfWidth / inSampleSize) >= reqW) {
                inSampleSize *= 2;
            }
        }
        return inSampleSize;
    }

    private byte[] convertBitmapToYUV420(Bitmap bitmap, int width, int height) {
        int[] argb = new int[width * height];
        bitmap.getPixels(argb, 0, width, 0, 0, width, height);
        
        byte[] yuv = new byte[width * height * 3 / 2];
        
        // Y plane
        for (int j = 0; j < height; j++) {
            for (int i = 0; i < width; i++) {
                int color = argb[j * width + i];
                int R = (color >> 16) & 0xff;
                int G = (color >> 8) & 0xff;
                int B = color & 0xff;
                
                int Y = ((66 * R + 129 * G + 25 * B + 128) >> 8) + 16;
                yuv[j * width + i] = (byte) clamp(Y, 0, 255);
            }
        }
        
        // UV planes (NV12 format)
        int uvIndex = width * height;
        for (int j = 0; j < height / 2; j++) {
            for (int i = 0; i < width / 2; i++) {
                int index = (j * 2) * width + (i * 2);
                int color = argb[index];
                int R = (color >> 16) & 0xff;
                int G = (color >> 8) & 0xff;
                int B = color & 0xff;
                
                int U = ((-38 * R - 74 * G + 112 * B + 128) >> 8) + 128;
                int V = ((112 * R - 94 * G - 18 * B + 128) >> 8) + 128;
                
                yuv[uvIndex++] = (byte) clamp(U, 0, 255);
                yuv[uvIndex++] = (byte) clamp(V, 0, 255);
            }
        }
        
        return yuv;
    }

    private int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }

    private File createOutputFile() throws Exception {
        File dir = new File(getReactApplicationContext().getFilesDir(), "videos");
        if (!dir.exists()) {
            if (!dir.mkdirs()) {
                throw new Exception("Failed to create videos directory");
            }
        }
        return new File(dir, "video_" + System.currentTimeMillis() + ".mp4");
    }

    // ============================================
    // MP3 → AAC CONVERSION (decode -> encode -> mux)
    // Robust conversion to avoid writing MP3 samples into an AAC track
    // Requires API 18+ (MediaMuxer)
    // ============================================
    private String convertMp3ToAac(String mp3Path) throws Exception {
        if (Build.VERSION.SDK_INT < 18) {
            throw new UnsupportedOperationException("Audio conversion requires API 18+");
        }

        MediaExtractor extractor = new MediaExtractor();
        MediaCodec decoder = null;
        MediaCodec encoder = null;
        MediaMuxer muxer = null;

        try {
            extractor.setDataSource(mp3Path);

            int audioTrackIndex = -1;
            MediaFormat mp3Format = null;

            for (int i = 0; i < extractor.getTrackCount(); i++) {
                MediaFormat f = extractor.getTrackFormat(i);
                String mime = f.getString(MediaFormat.KEY_MIME);
                if (mime != null && mime.startsWith("audio/")) {
                    audioTrackIndex = i;
                    mp3Format = f;
                    break;
                }
            }

            if (audioTrackIndex < 0 || mp3Format == null) {
                throw new Exception("No audio track found in MP3 file");
            }

            String mp3Mime = mp3Format.getString(MediaFormat.KEY_MIME);
            extractor.selectTrack(audioTrackIndex);

            // Create decoder for the source (MP3)
            decoder = MediaCodec.createDecoderByType(mp3Mime);
            decoder.configure(mp3Format, null, null, 0);
            decoder.start();

            // Prepare AAC encoder with same sample rate / channel count
            int sampleRate = mp3Format.getInteger(MediaFormat.KEY_SAMPLE_RATE);
            int channelCount = mp3Format.getInteger(MediaFormat.KEY_CHANNEL_COUNT);

            MediaFormat aacFormat = MediaFormat.createAudioFormat(MediaFormat.MIMETYPE_AUDIO_AAC, sampleRate, channelCount);
            aacFormat.setInteger(MediaFormat.KEY_AAC_PROFILE, MediaCodecInfo.CodecProfileLevel.AACObjectLC);
            aacFormat.setInteger(MediaFormat.KEY_BIT_RATE, 128000);
            aacFormat.setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, 16384);

            encoder = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_AUDIO_AAC);
            encoder.configure(aacFormat, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE);
            encoder.start();

            File outputAac = new File(getReactApplicationContext().getCacheDir(), "converted_" + System.currentTimeMillis() + ".m4a");
            muxer = new MediaMuxer(outputAac.getAbsolutePath(), MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4);

            MediaCodec.BufferInfo decInfo = new MediaCodec.BufferInfo();
            MediaCodec.BufferInfo encInfo = new MediaCodec.BufferInfo();

            boolean extractorDone = false;
            boolean decoderDone = false;
            boolean encoderDone = false;
            boolean muxerStarted = false;
            int muxerTrackIndex = -1;

            final int timeoutUs = TIMEOUT_US;

            while (!encoderDone) {
                // Feed extractor -> decoder
                if (!extractorDone) {
                    int inIndex = decoder.dequeueInputBuffer(timeoutUs);
                    if (inIndex >= 0) {
                        ByteBuffer dst = decoder.getInputBuffer(inIndex);
                        dst.clear();
                        int sampleSize = extractor.readSampleData(dst, 0);
                        if (sampleSize < 0) {
                            decoder.queueInputBuffer(inIndex, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM);
                            extractorDone = true;
                        } else {
                            long sampleTime = extractor.getSampleTime();
                            decoder.queueInputBuffer(inIndex, 0, sampleSize, sampleTime, 0);
                            extractor.advance();
                        }
                    }
                }

                // Drain decoder -> push decoded PCM into encoder input
                int decOutIndex = decoder.dequeueOutputBuffer(decInfo, timeoutUs);
                if (decOutIndex >= 0) {
                    ByteBuffer decodedBuf = decoder.getOutputBuffer(decOutIndex);
                    if ((decInfo.flags & MediaCodec.BUFFER_FLAG_CODEC_CONFIG) != 0) {
                        decoder.releaseOutputBuffer(decOutIndex, false);
                    } else {
                        int decodedSize = decInfo.size;
                        byte[] pcm = new byte[decodedSize];
                        decodedBuf.position(decInfo.offset);
                        decodedBuf.limit(decInfo.offset + decInfo.size);
                        decodedBuf.get(pcm);

                        // Try to queue into encoder
                        boolean queued = false;
                        while (!queued) {
                            int encInIndex = encoder.dequeueInputBuffer(timeoutUs);
                            if (encInIndex >= 0) {
                                ByteBuffer encInBuf = encoder.getInputBuffer(encInIndex);
                                encInBuf.clear();
                                encInBuf.put(pcm, 0, pcm.length);
                                encoder.queueInputBuffer(encInIndex, 0, pcm.length, decInfo.presentationTimeUs, 0);
                                queued = true;
                            } else {
                                // Drain encoder output to make room
                                int encOutIdx = encoder.dequeueOutputBuffer(encInfo, timeoutUs);
                                if (encOutIdx == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                                    MediaFormat newFormat = encoder.getOutputFormat();
                                    try {
                                        MediaFormat sanitizedFormat = sanitizeMediaFormat(newFormat);
                                        muxerTrackIndex = muxer.addTrack(sanitizedFormat);
                                        muxer.start();
                                        muxerStarted = true;
                                    } catch (IllegalStateException iae) {
                                        Log.e(TAG, "❌ Failed to add converted audio track to muxer: " + iae.getMessage());
                                        try { muxer.release(); } catch (Exception ignored) {}
                                        return null;
                                    }
                                } else if (encOutIdx >= 0) {
                                    ByteBuffer encodedBuf = encoder.getOutputBuffer(encOutIdx);
                                    if ((encInfo.flags & MediaCodec.BUFFER_FLAG_CODEC_CONFIG) != 0) {
                                        encInfo.size = 0;
                                    }
                                    if (encInfo.size > 0 && muxerStarted) {
                                        encodedBuf.position(encInfo.offset);
                                        encodedBuf.limit(encInfo.offset + encInfo.size);
                                        muxer.writeSampleData(muxerTrackIndex, encodedBuf, encInfo);
                                    }
                                    encoder.releaseOutputBuffer(encOutIdx, false);
                                    if ((encInfo.flags & MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) {
                                        encoderDone = true;
                                    }
                                } else {
                                    // nothing to do, continue waiting
                                }
                            }
                        }

                        decoder.releaseOutputBuffer(decOutIndex, false);
                        if ((decInfo.flags & MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) {
                            decoderDone = true;
                        }
                    }
                } else if (decOutIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                    // decoder format changed — ignore for audio
                }

                // Drain encoder output
                int encOutIndex = encoder.dequeueOutputBuffer(encInfo, timeoutUs);
                if (encOutIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                    MediaFormat newFormat = encoder.getOutputFormat();
                    if (!muxerStarted) {
                        try {
                            MediaFormat sanitizedFormat = sanitizeMediaFormat(newFormat);
                            muxerTrackIndex = muxer.addTrack(sanitizedFormat);
                            muxer.start();
                            muxerStarted = true;
                        } catch (IllegalStateException iae) {
                            Log.e(TAG, "❌ Failed to add converted audio track to muxer: " + iae.getMessage());
                            try { muxer.release(); } catch (Exception ignored) {}
                            return null;
                        }
                    }
                } else if (encOutIndex >= 0) {
                    ByteBuffer encodedBuf = encoder.getOutputBuffer(encOutIndex);
                    if ((encInfo.flags & MediaCodec.BUFFER_FLAG_CODEC_CONFIG) != 0) {
                        encInfo.size = 0;
                    }
                    if (encInfo.size > 0 && muxerStarted) {
                        encodedBuf.position(encInfo.offset);
                        encodedBuf.limit(encInfo.offset + encInfo.size);
                        muxer.writeSampleData(muxerTrackIndex, encodedBuf, encInfo);
                    }
                    encoder.releaseOutputBuffer(encOutIndex, false);
                    if ((encInfo.flags & MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) {
                        encoderDone = true;
                    }
                }

                // If decoder is done but encoder not yet signaled EOS, signal it by queueing empty buffer
                if (decoderDone && !encoderDone) {
                    int encInIndex = encoder.dequeueInputBuffer(timeoutUs);
                    if (encInIndex >= 0) {
                        encoder.queueInputBuffer(encInIndex, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM);
                    }
                }
            }

            return outputAac.getAbsolutePath();

        } finally {
            try { if (extractor != null) extractor.release(); } catch (Exception ignored) {}
            try { if (decoder != null) { decoder.stop(); decoder.release(); } } catch (Exception ignored) {}
            try { if (encoder != null) { encoder.stop(); encoder.release(); } } catch (Exception ignored) {}
            try { if (muxer != null) { muxer.stop(); muxer.release(); } } catch (Exception ignored) {}
        }
    }
}