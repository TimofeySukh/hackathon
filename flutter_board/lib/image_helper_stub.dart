import 'dart:convert';
import 'package:file_picker/file_picker.dart';

Future<String?> pickImageBase64() async {
  try {
    final result = await FilePicker.pickFiles(
      type: FileType.image,
      withData: true,
    );
    if (result != null && result.files.isNotEmpty) {
      final file = result.files.first;
      final bytes = file.bytes;
      if (bytes != null) {
        final extension = file.extension ?? 'png';
        final base64String = base64Encode(bytes);
        return 'data:image/$extension;base64,$base64String';
      }
    }
  } catch (e) {
    // ignore
  }
  return null;
}
