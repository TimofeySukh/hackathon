import 'dart:async';
import 'dart:js_interop';
import 'package:web/web.dart' as web;

Future<String?> pickImageBase64() async {
  final completer = Completer<String?>();
  final input = web.HTMLInputElement()
    ..type = 'file'
    ..accept = 'image/*';

  input.addEventListener(
    'change',
    (web.Event event) {
      final files = input.files;
      if (files == null || files.length == 0) {
        completer.complete(null);
        return;
      }
      final file = files.item(0);
      if (file == null) {
        completer.complete(null);
        return;
      }
      final reader = web.FileReader();
      reader.addEventListener(
        'loadend',
        (web.Event e) {
          final result = reader.result;
          if (result != null) {
            completer.complete(result.dartify()?.toString());
          } else {
            completer.complete(null);
          }
        }.toJS,
      );
      reader.readAsDataURL(file);
    }.toJS,
  );

  input.click();
  return completer.future;
}
