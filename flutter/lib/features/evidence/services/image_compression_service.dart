import 'dart:async';
import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';

// ============================================================================
// Project Panopticon-Vision — Image Compression & Watermark Service
// ============================================================================
// Pure-dart image processing using dart:ui (no external packages required).
// Handles compression, thumbnail generation, and GPS/timestamp watermarking.
// ============================================================================

class ImageCompressionService {
  ImageCompressionService._();
  static final instance = ImageCompressionService._();

  // ── Compress / resize an image ──────────────────────────────────────────
  /// Decodes [bytes], scales down to [maxWidth] preserving aspect ratio,
  /// and re-encodes as JPEG at the given [quality] (0–100).
  Future<Uint8List> compressImage(
    Uint8List bytes, {
    int maxWidth = 1920,
    int quality = 80,
  }) async {
    final codec = await ui.instantiateImageCodec(bytes);
    final frame = await codec.getNextFrame();
    final image = frame.image;

    try {
      // Calculate scaled dimensions
      final targetWidth =
          image.width > maxWidth ? maxWidth : image.width;
      final scale = targetWidth / image.width;
      final targetHeight = (image.height * scale).round();

      // Draw scaled image
      final recorder = ui.PictureRecorder();
      final canvas = ui.Canvas(recorder);
      final srcRect = ui.Rect.fromLTWH(
        0,
        0,
        image.width.toDouble(),
        image.height.toDouble(),
      );
      final dstRect = ui.Rect.fromLTWH(
        0,
        0,
        targetWidth.toDouble(),
        targetHeight.toDouble(),
      );
      canvas.drawImageRect(image, srcRect, dstRect, ui.Paint());

      final picture = recorder.endRecording();
      final resized =
          await picture.toImage(targetWidth, targetHeight);

      // Encode to PNG (dart:ui does not expose JPEG quality parameter
      // directly — we use PNG for lossless fidelity; a future upgrade
      // can swap in flutter_image_compress for true JPEG quality control)
      final byteData =
          await resized.toByteData(format: ui.ImageByteFormat.png);
      resized.dispose();

      if (byteData == null) return bytes; // fallback to original
      return byteData.buffer.asUint8List();
    } finally {
      image.dispose();
    }
  }

  // ── Add GPS / timestamp watermark ───────────────────────────────────────
  /// Draws a semi-transparent watermark strip at the bottom-right corner
  /// with location coordinates, timestamp, and user ID.
  Future<Uint8List> addWatermark(
    Uint8List bytes, {
    required double lat,
    required double lng,
    required String timestamp,
    required String userId,
  }) async {
    final codec = await ui.instantiateImageCodec(bytes);
    final frame = await codec.getNextFrame();
    final image = frame.image;

    try {
      final w = image.width.toDouble();
      final h = image.height.toDouble();

      final recorder = ui.PictureRecorder();
      final canvas = ui.Canvas(recorder);

      // Draw original image
      canvas.drawImage(image, ui.Offset.zero, ui.Paint());

      // ── Watermark background strip ──────────────────────────────
      final stripHeight = h * 0.06; // 6% of image height
      final stripRect = ui.Rect.fromLTWH(0, h - stripHeight, w, stripHeight);
      final bgPaint = ui.Paint()
        ..color = const ui.Color.fromARGB(160, 0, 0, 0); // 63% opaque black
      canvas.drawRect(stripRect, bgPaint);

      // ── Watermark text ──────────────────────────────────────────
      final fontSize = (stripHeight * 0.4).clamp(10.0, 24.0);
      final lines = [
        '${lat.toStringAsFixed(6)}, ${lng.toStringAsFixed(6)}',
        '$timestamp  |  $userId',
      ];

      for (var i = 0; i < lines.length; i++) {
        final builder = ui.ParagraphBuilder(
          ui.ParagraphStyle(
            textAlign: ui.TextAlign.right,
            fontSize: fontSize,
          ),
        )
          ..pushStyle(ui.TextStyle(
            color: const ui.Color.fromARGB(220, 255, 255, 255),
            fontSize: fontSize,
          ))
          ..addText(lines[i]);

        final paragraph = builder.build()
          ..layout(ui.ParagraphConstraints(width: w - 16));

        final yOffset =
            h - stripHeight + 4 + (i * (fontSize + 4));
        canvas.drawParagraph(paragraph, ui.Offset(8, yOffset));
      }

      // Encode result
      final picture = recorder.endRecording();
      final result =
          await picture.toImage(image.width, image.height);
      final byteData =
          await result.toByteData(format: ui.ImageByteFormat.png);
      result.dispose();

      if (byteData == null) return bytes;
      return byteData.buffer.asUint8List();
    } finally {
      image.dispose();
    }
  }

  // ── Generate a square thumbnail ─────────────────────────────────────────
  /// Center-crops the image to a square and scales to [size] × [size].
  Future<Uint8List> generateThumbnail(
    Uint8List bytes, {
    int size = 300,
  }) async {
    final codec = await ui.instantiateImageCodec(bytes);
    final frame = await codec.getNextFrame();
    final image = frame.image;

    try {
      final shortSide = image.width < image.height
          ? image.width.toDouble()
          : image.height.toDouble();

      // Center-crop source rect
      final srcRect = ui.Rect.fromCenter(
        center: ui.Offset(
          image.width / 2.0,
          image.height / 2.0,
        ),
        width: shortSide,
        height: shortSide,
      );
      final dstRect = ui.Rect.fromLTWH(
        0,
        0,
        size.toDouble(),
        size.toDouble(),
      );

      final recorder = ui.PictureRecorder();
      final canvas = ui.Canvas(recorder);
      canvas.drawImageRect(image, srcRect, dstRect, ui.Paint());

      final picture = recorder.endRecording();
      final thumb = await picture.toImage(size, size);
      final byteData =
          await thumb.toByteData(format: ui.ImageByteFormat.png);
      thumb.dispose();

      if (byteData == null) return bytes;

      debugPrint(
          '[Panopticon] Thumbnail generated: ${size}x$size '
          '(${byteData.lengthInBytes} bytes)');
      return byteData.buffer.asUint8List();
    } finally {
      image.dispose();
    }
  }
}
