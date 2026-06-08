import 'dart:math' as math;
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter/scheduler.dart';
import 'image_helper.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'DN Circle Graph Board',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF2563EB),
          surface: const Color(0xFFF6F7F4),
        ),
      ),
      home: const MyHomePage(),
    );
  }
}

enum CircleTone { blue, red, green, amber, violet }

enum ShapeType { circle, wavy, polygon }

class CircleNode {
  final String id;
  String name;
  final String icon;
  double x;
  double y;
  double radius;
  double minRadius;
  String? parentId;
  String? connectedTo;
  CircleTone tone;
  ShapeType shapeType;
  int sides;
  double amplitude;
  String? imageUrl;

  CircleNode({
    required this.id,
    required this.name,
    required this.icon,
    required this.x,
    required this.y,
    required this.radius,
    required this.minRadius,
    this.parentId,
    this.connectedTo,
    required this.tone,
    this.shapeType = ShapeType.wavy,
    this.sides = 12,
    this.amplitude = 8.0,
    this.imageUrl,
  });

  CircleNode copyWith({
    String? id,
    String? name,
    String? icon,
    double? x,
    double? y,
    double? radius,
    double? minRadius,
    String? parentId,
    bool clearParentId = false,
    String? connectedTo,
    CircleTone? tone,
    ShapeType? shapeType,
    int? sides,
    double? amplitude,
    String? imageUrl,
    bool clearImageUrl = false,
  }) {
    return CircleNode(
      id: id ?? this.id,
      name: name ?? this.name,
      icon: icon ?? this.icon,
      x: x ?? this.x,
      y: y ?? this.y,
      radius: radius ?? this.radius,
      minRadius: minRadius ?? this.minRadius,
      parentId: clearParentId ? null : (parentId ?? this.parentId),
      connectedTo: connectedTo ?? this.connectedTo,
      tone: tone ?? this.tone,
      shapeType: shapeType ?? this.shapeType,
      sides: sides ?? this.sides,
      amplitude: amplitude ?? this.amplitude,
      imageUrl: clearImageUrl ? null : (imageUrl ?? this.imageUrl),
    );
  }
}

class PersonNode {
  final String id;
  String name;
  final String role;
  double x;
  double y;
  String circleId;
  final String avatar;
  ShapeType shapeType;
  int sides;
  double amplitude;
  String? imageUrl;

  PersonNode({
    required this.id,
    required this.name,
    required this.role,
    required this.x,
    required this.y,
    required this.circleId,
    required this.avatar,
    this.shapeType = ShapeType.polygon,
    this.sides = 8,
    this.amplitude = 2.0,
    this.imageUrl,
  });

  PersonNode copyWith({
    String? id,
    String? name,
    String? role,
    double? x,
    double? y,
    String? circleId,
    String? avatar,
    ShapeType? shapeType,
    int? sides,
    double? amplitude,
    String? imageUrl,
    bool clearImageUrl = false,
  }) {
    return PersonNode(
      id: id ?? this.id,
      name: name ?? this.name,
      role: role ?? this.role,
      x: x ?? this.x,
      y: y ?? this.y,
      circleId: circleId ?? this.circleId,
      avatar: avatar ?? this.avatar,
      shapeType: shapeType ?? this.shapeType,
      sides: sides ?? this.sides,
      amplitude: amplitude ?? this.amplitude,
      imageUrl: clearImageUrl ? null : (imageUrl ?? this.imageUrl),
    );
  }
}

class ToneColors {
  final Color fill;
  final Color border;
  final Color text;
  final Color centerBg;

  const ToneColors({
    required this.fill,
    required this.border,
    required this.text,
    required this.centerBg,
  });
}

const Map<CircleTone, ToneColors> materialTones = {
  CircleTone.blue: ToneColors(
    fill: Color(0xFFD2E4FF),
    border: Color(0xFF004A77),
    text: Color(0xFF001D35),
    centerBg: Color(0xFF00629D),
  ),
  CircleTone.red: ToneColors(
    fill: Color(0xFFFFDAD6),
    border: Color(0xFFBA1A1A),
    text: Color(0xFF410002),
    centerBg: Color(0xFFC00015),
  ),
  CircleTone.green: ToneColors(
    fill: Color(0xFFD1E8D2),
    border: Color(0xFF0F6D38),
    text: Color(0xFF00210B),
    centerBg: Color(0xFF1E824A),
  ),
  CircleTone.amber: ToneColors(
    fill: Color(0xFFFFE082),
    border: Color(0xFFB06000),
    text: Color(0xFF2A1400),
    centerBg: Color(0xFFD87A00),
  ),
  CircleTone.violet: ToneColors(
    fill: Color(0xFFEADDFF),
    border: Color(0xFF6750A4),
    text: Color(0xFF21005D),
    centerBg: Color(0xFF7F67BE),
  ),
};

const double worldSize = 5000.0;
const double halfWorldSize = worldSize / 2;
const int maxStressIcons = 10000;

class MyHomePage extends StatefulWidget {
  const MyHomePage({super.key});

  @override
  State<MyHomePage> createState() => _MyHomePageState();
}

class _MyHomePageState extends State<MyHomePage>
    with SingleTickerProviderStateMixin {
  late List<CircleNode> circles;
  late List<PersonNode> people;

  final TransformationController _transformationController =
      TransformationController();

  String? selectedCircleId;
  String? selectedPersonId;

  Offset? createMenuWorldPos;
  Offset? createMenuScreenPos;
  String? createMenuSourceCircleId;

  String? connectorSourceCircleId;
  Offset? connectorStartPos;
  Offset? connectorEndPos;

  bool isResizing = false;

  // Stress test state
  int stressCount = 0;
  bool showEdges = true;
  bool showLabels = false;

  // FPS
  int _frameCount = 0;
  late int _lastFpsTimestamp;
  Ticker? _fpsTicker;
  final ValueNotifier<int> _fpsNotifier = ValueNotifier<int>(0);

  // Stress people cache
  List<PersonNode> _stressPeople = [];

  // Caches for stress rendering to prevent freezes
  final List<ui.Picture> _stressAvatarPictures = [];
  final List<ui.Image> _stressAvatarImages = [];
  final Map<String, TextPainter> _stressLabelCache = {};

  @override
  void initState() {
    super.initState();
    circles = createInitialGraphCircles();
    people = createInitialGraphPeople();
    circles = ensureContainment(circles, people);

    _initStressAvatarPictures();
    _initStressAvatarImages();

    _lastFpsTimestamp = DateTime.now().millisecondsSinceEpoch;
    _fpsTicker = createTicker((duration) {
      _frameCount++;
      final now = DateTime.now().millisecondsSinceEpoch;
      if (now - _lastFpsTimestamp >= 500) {
        _fpsNotifier.value = ((_frameCount * 1000) / (now - _lastFpsTimestamp))
            .round();
        _frameCount = 0;
        _lastFpsTimestamp = now;
      }
    });
    _fpsTicker!.start();

    WidgetsBinding.instance.addPostFrameCallback((_) {
      final size = MediaQuery.of(context).size;
      const double scale = 0.82;
      final double tx = size.width / 2 - halfWorldSize * scale;
      final double ty = size.height / 2 - halfWorldSize * scale;
      _transformationController.value = Matrix4.identity()
        ..translateByDouble(tx, ty, 0.0, 1.0)
        ..scaleByDouble(scale, scale, 1.0, 1.0);
      setState(() {});
    });
  }

  @override
  void dispose() {
    for (final img in _stressAvatarImages) {
      img.dispose();
    }
    _fpsTicker?.dispose();
    _fpsNotifier.dispose();
    _transformationController.dispose();
    super.dispose();
  }

  void _initStressAvatarPictures() {
    const colors = [
      Color(0xFF00629D),
      Color(0xFFC00015),
      Color(0xFF1E824A),
      Color(0xFFD87A00),
      Color(0xFF7F67BE),
      Color(0xFF0F766E),
      Color(0xFF4F46E5),
      Color(0xFFBE185D),
      Color(0xFFBE185D),
    ];
    for (int i = 0; i < colors.length; i++) {
      final color = colors[i];
      final avatar = makeAvatar(i);
      _stressAvatarPictures.add(_recordAvatarPicture(color, avatar));
    }
  }

  Future<void> _initStressAvatarImages() async {
    const colors = [
      Color(0xFF00629D),
      Color(0xFFC00015),
      Color(0xFF1E824A),
      Color(0xFFD87A00),
      Color(0xFF7F67BE),
      Color(0xFF0F766E),
      Color(0xFF4F46E5),
      Color(0xFFBE185D),
      Color(0xFFBE185D),
    ];
    final List<Future<ui.Image>> futures = [];
    for (int i = 0; i < colors.length; i++) {
      final color = colors[i];
      final avatar = makeAvatar(i);
      final picture = _recordAvatarPicture(color, avatar);
      futures.add(picture.toImage(40, 40));
    }
    final images = await Future.wait(futures);
    if (mounted) {
      setState(() {
        _stressAvatarImages.addAll(images);
      });
    }
  }

  ui.Picture _recordAvatarPicture(Color color, String avatar) {
    final recorder = ui.PictureRecorder();
    final canvas = Canvas(recorder, const Rect.fromLTWH(0, 0, 40, 40));

    final path = Path();
    const int points = 72;
    const double cx = 20.0;
    const double cy = 20.0;
    const double r = 13.0;
    const double amp = 4.0;
    const int petals = 6;
    for (int i = 0; i <= points; i++) {
      final angle = (i * 2 * math.pi) / points;
      final currentR = r + amp * math.cos(petals * angle);
      final x = cx + currentR * math.cos(angle);
      final y = cy + currentR * math.sin(angle);
      if (i == 0) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    }
    path.close();

    final fillPaint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;
    final borderPaint = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.0;

    canvas.drawPath(path, fillPaint);
    canvas.drawPath(path, borderPaint);

    final textPainter = TextPainter(
      text: TextSpan(
        text: avatar,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 8,
          fontWeight: FontWeight.w900,
        ),
      ),
      textDirection: TextDirection.ltr,
    );
    textPainter.layout();
    textPainter.paint(
      canvas,
      Offset(20.0 - textPainter.width / 2, 20.0 - textPainter.height / 2),
    );

    return recorder.endRecording();
  }

  TextPainter _getOrCreateLabelPainter(String name) {
    var painter = _stressLabelCache[name];
    if (painter == null) {
      painter = TextPainter(
        text: TextSpan(
          text: name,
          style: const TextStyle(
            color: Color(0xFF1C2528),
            fontSize: 9,
            fontWeight: FontWeight.w600,
          ),
        ),
        textDirection: TextDirection.ltr,
      );
      painter.layout();
      _stressLabelCache[name] = painter;
    }
    return painter;
  }

  void _updateStressCount(int count) {
    setState(() {
      stressCount = count;
      _stressPeople = generateStressPeople(count);
      // Clear label cache if count is reduced or cleared to avoid holding dead entries
      if (count < _stressPeople.length) {
        _stressLabelCache.clear();
      }
    });
  }

  Offset screenToWorld(Offset screenPos, BuildContext context) {
    final RenderBox renderBox = context.findRenderObject() as RenderBox;
    final localScreenPos = renderBox.globalToLocal(screenPos);

    final matrix = _transformationController.value;
    final double scale = matrix.storage[0];
    final double tx = matrix.storage[12];
    final double ty = matrix.storage[13];

    final double lx = (localScreenPos.dx - tx) / scale;
    final double ly = (localScreenPos.dy - ty) / scale;

    return Offset(lx - halfWorldSize, ly - halfWorldSize);
  }

  void _zoomIn() {
    final matrix = _transformationController.value;
    final double scale = matrix.storage[0];
    final double nextScale = (scale * 1.14).clamp(0.35, 1.8);
    final size = MediaQuery.of(context).size;
    _zoomTo(size.width / 2, size.height / 2, nextScale);
  }

  void _zoomOut() {
    final matrix = _transformationController.value;
    final double scale = matrix.storage[0];
    final double nextScale = (scale / 1.14).clamp(0.35, 1.8);
    final size = MediaQuery.of(context).size;
    _zoomTo(size.width / 2, size.height / 2, nextScale);
  }

  void _zoomTo(double px, double py, double nextScale) {
    final matrix = _transformationController.value;
    final double scale = matrix.storage[0];
    final double tx = matrix.storage[12];
    final double ty = matrix.storage[13];

    final double wx = (px - tx) / scale;
    final double wy = (py - ty) / scale;

    final double nextTx = px - wx * nextScale;
    final double nextTy = py - wy * nextScale;

    setState(() {
      _transformationController.value = Matrix4.identity()
        ..translateByDouble(nextTx, nextTy, 0.0, 1.0)
        ..scaleByDouble(nextScale, nextScale, 1.0, 1.0);
    });
  }

  void _resetDemo() {
    setState(() {
      circles = createInitialGraphCircles();
      people = createInitialGraphPeople();
      circles = ensureContainment(circles, people);
      selectedCircleId = 'you';
      selectedPersonId = null;
      createMenuWorldPos = null;
      createMenuScreenPos = null;
      connectorSourceCircleId = null;
    });

    final size = MediaQuery.of(context).size;
    const double scale = 0.82;
    final double tx = size.width / 2 - halfWorldSize * scale;
    final double ty = size.height / 2 - halfWorldSize * scale;
    setState(() {
      _transformationController.value = Matrix4.identity()
        ..translateByDouble(tx, ty, 0.0, 1.0)
        ..scaleByDouble(scale, scale, 1.0, 1.0);
    });
  }

  void _renameSelected(String value) {
    setState(() {
      if (selectedCircleId != null) {
        final index = circles.indexWhere((c) => c.id == selectedCircleId);
        if (index != -1) {
          circles[index].name = value;
        }
      } else if (selectedPersonId != null) {
        final index = people.indexWhere((p) => p.id == selectedPersonId);
        if (index != -1) {
          people[index].name = value;
        }
      }
    });
  }

  void _updateCircleStyle(
    String circleId, {
    ShapeType? shapeType,
    int? sides,
    double? amplitude,
    String? imageUrl,
    bool clearImageUrl = false,
    CircleTone? tone,
  }) {
    setState(() {
      final index = circles.indexWhere((c) => c.id == circleId);
      if (index != -1) {
        circles[index] = circles[index].copyWith(
          shapeType: shapeType,
          sides: sides,
          amplitude: amplitude,
          imageUrl: imageUrl,
          clearImageUrl: clearImageUrl,
          tone: tone,
        );
        circles = ensureContainment(circles, people);
      }
    });
  }

  void _updatePersonStyle(
    String personId, {
    ShapeType? shapeType,
    int? sides,
    double? amplitude,
    String? imageUrl,
    bool clearImageUrl = false,
  }) {
    setState(() {
      final index = people.indexWhere((p) => p.id == personId);
      if (index != -1) {
        people[index] = people[index].copyWith(
          shapeType: shapeType,
          sides: sides,
          amplitude: amplitude,
          imageUrl: imageUrl,
          clearImageUrl: clearImageUrl,
        );
      }
    });
  }

  void _addDemoCluster() {
    final String sourceId = selectedCircleId ?? 'you';
    final source = circles.firstWhere((c) => c.id == sourceId);
    final int nextIndex = people.length + 1;
    final time = DateTime.now().millisecondsSinceEpoch;

    final offsets = [-58.0, 0.0, 58.0];
    final names = ['Alex', 'Daria', 'Sam'];

    setState(() {
      for (int i = 0; i < 3; i++) {
        final randomSides = math.Random().nextInt(5) + 8; // 8 to 12
        people.add(
          PersonNode(
            id: 'person-$time-$i',
            name: names[i],
            role: 'Added to ${source.name}',
            x: source.x + offsets[i],
            y: source.y + source.radius * 0.42 + i * 18.0,
            circleId: source.id,
            avatar: makeAvatar(nextIndex + i),
            shapeType: ShapeType.polygon,
            sides: randomSides,
            amplitude: 2.0,
          ),
        );
      }
      circles = ensureContainment(circles, people);
    });
  }

  void _openCircleContextMenu(CircleNode circle, Offset globalPos) {
    setState(() {
      createMenuSourceCircleId = circle.id;
      createMenuWorldPos = screenToWorld(globalPos, context);
      createMenuScreenPos = globalPos;
    });
  }

  void _startCircleDrag(CircleNode circle, Offset localPos) {
    setState(() {
      selectedCircleId = circle.id;
      selectedPersonId = null;
      createMenuWorldPos = null;
    });

    final double distance =
        (localPos - Offset(circle.radius, circle.radius)).distance;
    final double scale = _transformationController.value.storage[0];
    final double edgeHitSize = 18.0 / scale;

    if ((distance - circle.radius).abs() <= edgeHitSize) {
      isResizing = true;
    } else {
      isResizing = false;
    }
  }

  void _updateCircleDrag(CircleNode circle, DragUpdateDetails details) {
    final double scale = _transformationController.value.storage[0];
    if (isResizing) {
      final Offset worldPos = screenToWorld(details.globalPosition, context);
      final double distance = (worldPos - Offset(circle.x, circle.y)).distance;
      final double requestedRadius = math.max(72.0, distance);

      setState(() {
        final index = circles.indexWhere((c) => c.id == circle.id);
        if (index != -1) {
          circles[index] = circles[index].copyWith(
            minRadius: requestedRadius,
            radius: requestedRadius,
          );
          circles = ensureContainment(circles, people);
        }
      });
    } else {
      final double dx = details.delta.dx / scale;
      final double dy = details.delta.dy / scale;
      _moveCircleSubtree(circle.id, dx, dy);
    }
  }

  void _endCircleDrag() {
    isResizing = false;
  }

  void _startCircleSubtreeDrag(CircleNode circle) {
    setState(() {
      selectedCircleId = circle.id;
      selectedPersonId = null;
      createMenuWorldPos = null;
    });
  }

  void _updateCircleSubtreeDrag(Offset delta) {
    final double scale = _transformationController.value.storage[0];
    _moveCircleSubtree(selectedCircleId!, delta.dx / scale, delta.dy / scale);
  }

  void _endCircleSubtreeDrag() {}

  void _startConnector(CircleNode circle) {
    setState(() {
      connectorSourceCircleId = circle.id;
      connectorStartPos = Offset(circle.x, circle.y);
      connectorEndPos = Offset(circle.x, circle.y);
      selectedCircleId = circle.id;
      selectedPersonId = null;
      createMenuWorldPos = null;
    });
  }

  void _updateConnector(Offset globalPosition) {
    setState(() {
      connectorEndPos = screenToWorld(globalPosition, context);
    });
  }

  void _endConnector(Offset globalPosition) {
    if (connectorStartPos != null && connectorEndPos != null) {
      final distance = (connectorEndPos! - connectorStartPos!).distance;
      if (distance > 40.0) {
        setState(() {
          createMenuSourceCircleId = connectorSourceCircleId;
          createMenuWorldPos = connectorEndPos;
          createMenuScreenPos = globalPosition;
        });
      }
    }
    setState(() {
      connectorSourceCircleId = null;
      connectorStartPos = null;
      connectorEndPos = null;
    });
  }

  void _updatePersonDrag(PersonNode person, Offset delta) {
    final double scale = _transformationController.value.storage[0];
    setState(() {
      final index = people.indexWhere((p) => p.id == person.id);
      if (index != -1) {
        people[index] = people[index].copyWith(
          x: people[index].x + delta.dx / scale,
          y: people[index].y + delta.dy / scale,
        );
        circles = ensureContainment(circles, people);
      }
    });
  }

  void _moveCircleSubtree(String circleId, double dx, double dy) {
    setState(() {
      final Set<String> subtreeIds = _getDescendantCircleIds(circleId);
      subtreeIds.add(circleId);

      circles = circles.map((candidate) {
        if (subtreeIds.contains(candidate.id)) {
          return candidate.copyWith(x: candidate.x + dx, y: candidate.y + dy);
        }
        return candidate;
      }).toList();

      people = people.map((person) {
        if (subtreeIds.contains(person.circleId)) {
          return person.copyWith(x: person.x + dx, y: person.y + dy);
        }
        return person;
      }).toList();

      circles = ensureContainment(circles, people);
    });
  }

  Set<String> _getDescendantCircleIds(String circleId) {
    final Set<String> descendants = {};
    final List<String> pending = [circleId];

    while (pending.isNotEmpty) {
      final parentId = pending.removeLast();
      for (final circle in circles) {
        if (circle.parentId == parentId && !descendants.contains(circle.id)) {
          descendants.add(circle.id);
          pending.add(circle.id);
        }
      }
    }
    return descendants;
  }

  void _createPerson() {
    if (createMenuWorldPos == null || createMenuSourceCircleId == null) return;

    final sourceId = createMenuSourceCircleId!;
    final newId = 'person-${DateTime.now().millisecondsSinceEpoch}';
    final randomSides = math.Random().nextInt(5) + 8; // 8 to 12

    setState(() {
      people.add(
        PersonNode(
          id: newId,
          name: 'New person ${people.length + 1}',
          role: 'Inside parent',
          x: createMenuWorldPos!.dx,
          y: createMenuWorldPos!.dy,
          circleId: sourceId,
          avatar: makeAvatar(people.length + 1),
          shapeType: ShapeType.polygon,
          sides: randomSides,
          amplitude: 2.0,
        ),
      );
      circles = ensureContainment(circles, people);
      selectedPersonId = newId;
      selectedCircleId = null;
      createMenuWorldPos = null;
      createMenuScreenPos = null;
    });
  }

  void _createCircle({required bool isNested}) {
    if (createMenuWorldPos == null || createMenuSourceCircleId == null) return;

    final sourceId = createMenuSourceCircleId!;
    final newId = 'circle-${DateTime.now().millisecondsSinceEpoch}';
    final sourceCircle = circles.firstWhere((c) => c.id == sourceId);

    setState(() {
      circles.add(
        CircleNode(
          id: newId,
          name: isNested ? '${sourceCircle.name} subset' : 'New circle',
          icon: isNested ? 'SUB' : 'C',
          x: createMenuWorldPos!.dx,
          y: createMenuWorldPos!.dy,
          radius: isNested ? 82.0 : 190.0,
          minRadius: isNested ? 82.0 : 190.0,
          parentId: isNested ? sourceId : null,
          connectedTo: sourceId,
          tone: isNested ? CircleTone.violet : nextTone(circles.length),
          shapeType: isNested ? ShapeType.polygon : ShapeType.wavy,
          sides: isNested ? 6 : 12,
          amplitude: isNested ? 4.0 : 8.0,
        ),
      );
      circles = ensureContainment(circles, people);
      selectedCircleId = newId;
      selectedPersonId = null;
      createMenuWorldPos = null;
      createMenuScreenPos = null;
    });
  }

  double _menuPositionX(double screenX) {
    final double screenWidth = MediaQuery.of(context).size.width;
    return math.min(screenWidth - 300.0, math.max(14.0, screenX + 12.0));
  }

  double _menuPositionY(double screenY) {
    final double screenHeight = MediaQuery.of(context).size.height;
    return math.min(screenHeight - 190.0, math.max(74.0, screenY + 12.0));
  }

  Widget _toolbarButton(IconData icon, VoidCallback onPressed) {
    return IconButton(
      onPressed: onPressed,
      icon: Icon(icon, color: const Color(0xFF1C2528)),
      style: IconButton.styleFrom(hoverColor: const Color(0x121C2528)),
    );
  }

  Widget _helpRow(String text) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            '• ',
            style: TextStyle(
              color: Color(0x8A1C2528),
              fontSize: 12,
              fontWeight: FontWeight.bold,
            ),
          ),
          Expanded(
            child: Text(
              text,
              style: const TextStyle(
                color: Color(0xAD1C2528),
                fontSize: 12,
                fontWeight: FontWeight.w600,
                height: 1.35,
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final circlesById = {for (final c in circles) c.id: c};
    final selectedCircle = selectedCircleId != null
        ? circlesById[selectedCircleId]
        : null;
    final actualSelectedPerson = selectedPersonId != null
        ? (people.any((p) => p.id == selectedPersonId)
              ? people.firstWhere((p) => p.id == selectedPersonId)
              : null)
        : null;

    int getDepth(String? circleId) {
      int depth = 0;
      String? curr = circleId;
      while (curr != null) {
        depth++;
        curr = circlesById[curr]?.parentId;
      }
      return depth;
    }

    final sortedCircles = [...circles]
      ..sort((a, b) => getDepth(a.parentId).compareTo(getDepth(b.parentId)));

    return Scaffold(
      body: Stack(
        children: [
          InteractiveViewer(
            transformationController: _transformationController,
            constrained: false,
            boundaryMargin: const EdgeInsets.all(5000),
            minScale: 0.35,
            maxScale: 1.8,
            child: GestureDetector(
              behavior: HitTestBehavior.translucent,
              onTap: () {
                setState(() {
                  createMenuWorldPos = null;
                  createMenuScreenPos = null;
                  createMenuSourceCircleId = null;
                });
              },
              child: SizedBox(
                width: worldSize,
                height: worldSize,
                child: Stack(
                  children: [
                    Positioned.fill(
                      child: RepaintBoundary(
                        child: CustomPaint(painter: GridPainter()),
                      ),
                    ),
                    // Pass 1: Circle fills and borders
                    ...sortedCircles.map((circle) {
                      final double size = circle.radius * 2;
                      return Positioned(
                        left: circle.x - circle.radius + halfWorldSize,
                        top: circle.y - circle.radius + halfWorldSize,
                        width: size,
                        height: size,
                        child: IgnorePointer(
                          child: RepaintBoundary(
                            child: CustomPaint(
                              painter: CircleShapePainter(
                                circle: circle,
                                isSelected: selectedCircleId == circle.id,
                              ),
                            ),
                          ),
                        ),
                      );
                    }),
                    // Pass 2: Edge layer
                    Positioned.fill(
                      child: RepaintBoundary(
                        child: CustomPaint(
                          painter: EdgePainter(
                            circles: circles,
                            circlesById: circlesById,
                            people: people,
                            connectorStart: connectorStartPos,
                            connectorEnd: connectorEndPos,
                          ),
                        ),
                      ),
                    ),
                    // Pass 3: Circle interactive elements (hit area, center handle, label)
                    ...sortedCircles.map((circle) {
                      final double size = circle.radius * 2;
                      return Positioned(
                        left: circle.x - circle.radius + halfWorldSize,
                        top: circle.y - circle.radius + halfWorldSize,
                        width: size,
                        height: size,
                        child: GestureDetector(
                          onSecondaryTapUp: (details) {
                            _openCircleContextMenu(
                              circle,
                              details.globalPosition,
                            );
                          },
                          onLongPressStart: (details) {
                            _openCircleContextMenu(
                              circle,
                              details.globalPosition,
                            );
                          },
                          onPanStart: (details) {
                            _startCircleDrag(circle, details.localPosition);
                          },
                          onPanUpdate: (details) {
                            _updateCircleDrag(circle, details);
                          },
                          onPanEnd: (details) {
                            _endCircleDrag();
                          },
                          child: CircleInteractiveWidget(
                            circle: circle,
                            isSelected: selectedCircleId == circle.id,
                            onSelect: () {
                              setState(() {
                                selectedCircleId = circle.id;
                                selectedPersonId = null;
                                createMenuWorldPos = null;
                              });
                            },
                            onCenterDragStart: (details) {
                              if (HardwareKeyboard.instance.isShiftPressed) {
                                _startConnector(circle);
                              } else {
                                _startCircleSubtreeDrag(circle);
                              }
                            },
                            onCenterDragUpdate: (details) {
                              if (connectorSourceCircleId != null) {
                                _updateConnector(details.globalPosition);
                              } else {
                                _updateCircleSubtreeDrag(details.delta);
                              }
                            },
                            onCenterDragEnd: (details) {
                              if (connectorSourceCircleId != null) {
                                _endConnector(details.globalPosition);
                              } else {
                                _endCircleSubtreeDrag();
                              }
                            },
                          ),
                        ),
                      );
                    }),
                    // Pass 4: Real people icons
                    ...people.map((person) {
                      final parentCircle = circlesById[person.circleId];
                      final tone = parentCircle?.tone ?? CircleTone.blue;
                      final colors = materialTones[tone]!;
                      return Positioned(
                        left: person.x - 20.0 + halfWorldSize,
                        top: person.y - 20.0 + halfWorldSize,
                        width: 100,
                        height: 80,
                        child: GestureDetector(
                          onPanStart: (details) {
                            setState(() {
                              selectedPersonId = person.id;
                              selectedCircleId = null;
                              createMenuWorldPos = null;
                            });
                          },
                          onPanUpdate: (details) {
                            _updatePersonDrag(person, details.delta);
                          },
                          child: PersonIconWidget(
                            person: person,
                            fillColor: colors.centerBg,
                            isSelected: selectedPersonId == person.id,
                            onSelect: () {
                              setState(() {
                                selectedPersonId = person.id;
                                selectedCircleId = null;
                                createMenuWorldPos = null;
                              });
                            },
                          ),
                        ),
                      );
                    }),
                  ],
                ),
              ),
            ),
          ),
          if (_stressPeople.isNotEmpty)
            Positioned.fill(
              child: IgnorePointer(
                child: RepaintBoundary(
                  child: CustomPaint(
                    painter: StressIconsPainter(
                      people: _stressPeople,
                      circlesById: circlesById,
                      showEdges: showEdges,
                      showLabels: showLabels,
                      transformationController: _transformationController,
                      avatarPictures: _stressAvatarPictures,
                      avatarImages: _stressAvatarImages,
                      labelPainterProvider: _getOrCreateLabelPainter,
                    ),
                  ),
                ),
              ),
            ),
          if (createMenuScreenPos != null)
            Positioned(
              left: _menuPositionX(createMenuScreenPos!.dx),
              top: _menuPositionY(createMenuScreenPos!.dy),
              child: CreateContextMenuWidget(
                onAddPerson: _createPerson,
                onAddNested: () => _createCircle(isNested: true),
                onAddExternal: () => _createCircle(isNested: false),
              ),
            ),
          // Toolbar
          Positioned(
            top: 16,
            left: 16,
            right: 16,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  height: 44,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(
                      color: const Color(0xFFC4C7C8),
                      width: 1.5,
                    ),
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x14363D44),
                        blurRadius: 48,
                        offset: Offset(0, 18),
                      ),
                    ],
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 32,
                        height: 32,
                        decoration: const BoxDecoration(
                          color: Color(0xFF1C2528),
                          shape: BoxShape.circle,
                        ),
                        alignment: Alignment.center,
                        child: const Text(
                          'DN',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      const Text(
                        'Circle graph board',
                        style: TextStyle(
                          color: Color(0xFF1C2528),
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  height: 44,
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(
                      color: const Color(0xFFC4C7C8),
                      width: 1.5,
                    ),
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x14363D44),
                        blurRadius: 48,
                        offset: Offset(0, 18),
                      ),
                    ],
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _toolbarButton(Icons.zoom_in, _zoomIn),
                      _toolbarButton(Icons.zoom_out, _zoomOut),
                      _toolbarButton(Icons.refresh, _resetDemo),
                    ],
                  ),
                ),
              ],
            ),
          ),
          // Stress panel (top-right area, below toolbar)
          Positioned(
            top: 76,
            right: 16,
            child: ValueListenableBuilder<int>(
              valueListenable: _fpsNotifier,
              builder: (context, fps, child) => StressPanelWidget(
                fps: fps,
                stressCount: stressCount,
                showEdges: showEdges,
                showLabels: showLabels,
                renderedIcons: people.length + _stressPeople.length,
                renderedEdges:
                    circles.where((c) => c.connectedTo != null).length +
                    people.length +
                    (showEdges ? _stressPeople.length : 0),
                onCountChanged: _updateStressCount,
                onShowEdgesChanged: (v) => setState(() => showEdges = v),
                onShowLabelsChanged: (v) => setState(() => showLabels = v),
              ),
            ),
          ),
          // Help panel
          Positioned(
            left: 16,
            bottom: 16,
            child: Container(
              width: 300,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFC4C7C8), width: 1.5),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x14363D44),
                    blurRadius: 48,
                    offset: Offset(0, 18),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text(
                    'HOW IT WORKS',
                    style: TextStyle(
                      color: Color(0xFF1C2528),
                      fontSize: 12,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 1.0,
                    ),
                  ),
                  const SizedBox(height: 6),
                  _helpRow('Drag people or circles to move them.'),
                  _helpRow('Grab a circle edge to resize it.'),
                  _helpRow('Right-click / long-press a circle to add.'),
                  _helpRow('Shift-drag from center to connect/create.'),
                  _helpRow('Parent circles auto-fit contents.'),
                ],
              ),
            ),
          ),
          // Inspector
          Positioned(
            right: 16,
            bottom: 16,
            child: InspectorWidget(
              selectedCircle: selectedCircle,
              selectedPerson: actualSelectedPerson,
              circlesCount: circles.length,
              peopleCount: people.length,
              onRename: _renameSelected,
              onAddDemoCluster: _addDemoCluster,
              circlesById: circlesById,
              peopleList: people,
              circlesList: circles,
              onUpdateCircleStyle: _updateCircleStyle,
              onUpdatePersonStyle: _updatePersonStyle,
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Painters ────────────────────────────────────────────────────────────────

class GridPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final bgPaint = Paint()..color = const Color(0xFFF6F7F4);
    canvas.drawRect(Rect.fromLTWH(0, 0, size.width, size.height), bgPaint);

    final thinGridPaint = Paint()
      ..color = const Color(0x0E3D474E)
      ..strokeWidth = 1.0;

    final thickGridPaint = Paint()
      ..color = const Color(0x143D474E)
      ..strokeWidth = 1.0;

    for (double x = 0; x < size.width; x += 32) {
      final paint = (x % 160 == 0) ? thickGridPaint : thinGridPaint;
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }
    for (double y = 0; y < size.height; y += 32) {
      final paint = (y % 160 == 0) ? thickGridPaint : thinGridPaint;
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
  }

  @override
  bool shouldRepaint(covariant GridPainter oldDelegate) => false;
}

/// Paints circle fill + border (no interactive elements).
class CircleShapePainter extends CustomPainter {
  final CircleNode circle;
  final bool isSelected;

  CircleShapePainter({required this.circle, required this.isSelected});

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2;

    final path = getCustomNodePath(
      center.dx,
      center.dy,
      radius,
      circle.shapeType,
      circle.sides,
      circle.amplitude,
    );
    final colors = materialTones[circle.tone]!;

    canvas.drawShadow(path, const Color(0x0F000000), 6.0, true);

    final fillPaint = Paint()
      ..color = colors.fill
      ..style = PaintingStyle.fill;
    canvas.drawPath(path, fillPaint);

    if (isSelected) {
      final borderPaint = Paint()
        ..color = colors.border
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3.5;
      canvas.drawPath(path, borderPaint);
    }
  }

  @override
  bool shouldRepaint(covariant CircleShapePainter oldDelegate) {
    return oldDelegate.circle.shapeType != circle.shapeType ||
        oldDelegate.circle.sides != circle.sides ||
        oldDelegate.circle.amplitude != circle.amplitude ||
        oldDelegate.circle.tone != circle.tone ||
        oldDelegate.circle.radius != circle.radius ||
        oldDelegate.isSelected != isSelected;
  }
}

class EdgePainter extends CustomPainter {
  final List<CircleNode> circles;
  final Map<String, CircleNode> circlesById;
  final List<PersonNode> people;
  final Offset? connectorStart;
  final Offset? connectorEnd;

  EdgePainter({
    required this.circles,
    required this.circlesById,
    required this.people,
    this.connectorStart,
    this.connectorEnd,
  });

  @override
  void paint(Canvas canvas, Size size) {
    const double shift = halfWorldSize;

    final circlePaint = Paint()
      ..color = const Color(0xFFB5B8B9)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.0
      ..strokeCap = StrokeCap.round;

    final personPaint = Paint()
      ..color = const Color(0xFFD3D6D7)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5
      ..strokeCap = StrokeCap.round;

    final draftPaint = Paint()
      ..color = const Color(0xFF2563EB)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.0
      ..strokeCap = StrokeCap.round;

    void drawCurve(Offset from, Offset to, Paint paint) {
      final path = Path();
      path.moveTo(from.dx + shift, from.dy + shift);
      final double midX = (from.dx + to.dx) / 2;
      final double lift = math.min(
        100.0,
        (to.dy - from.dy).abs() * 0.22 + 38.0,
      );
      path.cubicTo(
        midX + shift,
        from.dy - lift + shift,
        midX + shift,
        to.dy + lift + shift,
        to.dx + shift,
        to.dy + shift,
      );
      canvas.drawPath(path, paint);
    }

    for (final circle in circles) {
      if (circle.connectedTo == null) continue;
      final source = circlesById[circle.connectedTo];
      if (source == null) continue;
      drawCurve(
        Offset(source.x, source.y),
        Offset(circle.x, circle.y),
        circlePaint,
      );
    }

    for (final person in people) {
      final circle = circlesById[person.circleId];
      if (circle == null) continue;
      drawCurve(
        Offset(circle.x, circle.y),
        Offset(person.x, person.y),
        personPaint,
      );
    }

    if (connectorStart != null && connectorEnd != null) {
      drawCurve(connectorStart!, connectorEnd!, draftPaint);
    }
  }

  @override
  bool shouldRepaint(covariant EdgePainter oldDelegate) => true;
}

class StressIconsPainter extends CustomPainter {
  final List<PersonNode> people;
  final Map<String, CircleNode> circlesById;
  final bool showEdges;
  final bool showLabels;
  final TransformationController transformationController;
  final List<ui.Picture> avatarPictures;
  final List<ui.Image> avatarImages;
  final TextPainter Function(String) labelPainterProvider;

  StressIconsPainter({
    required this.people,
    required this.circlesById,
    required this.showEdges,
    required this.showLabels,
    required this.transformationController,
    required this.avatarPictures,
    required this.avatarImages,
    required this.labelPainterProvider,
  }) : super(repaint: transformationController);

  @override
  void paint(Canvas canvas, Size size) {
    final matrix = transformationController.value;
    final double scale = matrix.storage[0];
    final double tx = matrix.storage[12];
    final double ty = matrix.storage[13];

    final double left = -tx / scale - halfWorldSize;
    final double top = -ty / scale - halfWorldSize;
    final double right = (size.width - tx) / scale - halfWorldSize;
    final double bottom = (size.height - ty) / scale - halfWorldSize;

    final double padding = showLabels ? (120.0 / scale) : (48.0 / scale);
    final visiblePeople = <PersonNode>[];

    for (final person in people) {
      if (person.x >= left - padding &&
          person.x <= right + padding &&
          person.y >= top - padding &&
          person.y <= bottom + padding) {
        visiblePeople.add(person);
      }
    }

    if (showEdges) {
      final youCircle = circlesById['you'];
      if (youCircle != null) {
        final path = Path();
        final double sx = (youCircle.x + halfWorldSize) * scale + tx;
        final double sy = (youCircle.y + halfWorldSize) * scale + ty;

        for (final person in visiblePeople) {
          final double px = (person.x + halfWorldSize) * scale + tx;
          final double py = (person.y + halfWorldSize) * scale + ty;
          path.moveTo(sx, sy);
          path.lineTo(px, py);
        }

        canvas.drawPath(
          path,
          Paint()
            ..color = const Color(0x1F747E84)
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1.0,
        );
      }
    }

    for (int i = 0; i < visiblePeople.length; i++) {
      final person = visiblePeople[i];
      final double cx = (person.x + halfWorldSize) * scale + tx;
      final double cy = (person.y + halfWorldSize) * scale + ty;

      // Extract the index of the person to match the avatar sprite index
      final idMatch = RegExp(r'\d+').firstMatch(person.id);
      final idNum = idMatch != null ? int.parse(idMatch.group(0)!) : i;

      // Use the rasterized image if loaded, otherwise fallback to picture
      if (avatarImages.isNotEmpty) {
        const double iconSize = 40.0;
        canvas.drawImage(
          avatarImages[idNum % avatarImages.length],
          Offset(cx - iconSize / 2, cy - iconSize / 2),
          Paint(),
        );
      } else if (avatarPictures.isNotEmpty) {
        canvas.save();
        canvas.translate(cx - 20.0, cy - 20.0);
        canvas.drawPicture(avatarPictures[idNum % avatarPictures.length]);
        canvas.restore();
      }

      if (showLabels) {
        final labelPainter = labelPainterProvider(person.name);

        final double labelWidth = labelPainter.width + 10.0;
        final double labelHeight = labelPainter.height + 4.0;
        final double x = cx - labelWidth / 2;
        final double y = cy + 18.0;

        final bgPaint = Paint()
          ..color = Colors.white.withValues(alpha: 0.86)
          ..style = PaintingStyle.fill;

        canvas.drawRRect(
          RRect.fromRectAndRadius(
            Rect.fromLTWH(x, y, labelWidth, labelHeight),
            const Radius.circular(5.0),
          ),
          bgPaint,
        );

        labelPainter.paint(
          canvas,
          Offset(cx - labelPainter.width / 2, y + 2.0),
        );
      }
    }
  }

  @override
  bool shouldRepaint(covariant StressIconsPainter oldDelegate) => true;
}

// ─── Widgets ─────────────────────────────────────────────────────────────────

/// Circle interactive layer: transparent hit area with center handle and label.
class CircleInteractiveWidget extends StatelessWidget {
  final CircleNode circle;
  final bool isSelected;
  final VoidCallback onSelect;
  final GestureDragStartCallback onCenterDragStart;
  final GestureDragUpdateCallback onCenterDragUpdate;
  final GestureDragEndCallback onCenterDragEnd;

  const CircleInteractiveWidget({
    super.key,
    required this.circle,
    required this.isSelected,
    required this.onSelect,
    required this.onCenterDragStart,
    required this.onCenterDragUpdate,
    required this.onCenterDragEnd,
  });

  @override
  Widget build(BuildContext context) {
    final colors = materialTones[circle.tone]!;

    return Stack(
      clipBehavior: Clip.none,
      children: [
        // Transparent hit area
        Positioned.fill(
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: onSelect,
            child: const SizedBox.expand(),
          ),
        ),
        // Name label at bottom
        Positioned(
          left: 0,
          right: 0,
          bottom: 17,
          child: Center(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(7),
                border: Border.all(color: const Color(0xFFC4C7C8), width: 1.0),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x171C2528),
                    blurRadius: 20,
                    offset: Offset(0, 8),
                  ),
                ],
              ),
              child: Text(
                circle.name,
                style: const TextStyle(
                  color: Color(0xFF20282C),
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ),
        ),
        // Center handle
        Positioned(
          left: circle.radius - 20,
          top: circle.radius - 20,
          width: 40,
          height: 40,
          child: GestureDetector(
            onPanStart: onCenterDragStart,
            onPanUpdate: onCenterDragUpdate,
            onPanEnd: onCenterDragEnd,
            child: Container(
              decoration: BoxDecoration(
                color: circle.imageUrl == null ? colors.centerBg : null,
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white, width: 3),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x331C2528),
                    blurRadius: 26,
                    offset: Offset(0, 12),
                  ),
                  BoxShadow(
                    color: Color(0x141C2528),
                    blurRadius: 1,
                    offset: Offset(0, 0),
                  ),
                ],
              ),
              clipBehavior: Clip.antiAlias,
              alignment: Alignment.center,
              child: circle.imageUrl != null
                  ? Image.network(
                      circle.imageUrl!,
                      width: 40,
                      height: 40,
                      fit: BoxFit.cover,
                      errorBuilder: (_, _, _) => Text(
                        circle.icon,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    )
                  : Text(
                      circle.icon,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 10,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
            ),
          ),
        ),
      ],
    );
  }
}

/// Icon-only person widget — polygon/wavy avatar with name label below.
class PersonIconWidget extends StatelessWidget {
  final PersonNode person;
  final Color fillColor;
  final bool isSelected;
  final VoidCallback onSelect;

  const PersonIconWidget({
    super.key,
    required this.person,
    required this.fillColor,
    required this.isSelected,
    required this.onSelect,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onSelect,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            width: 40,
            height: 40,
            child: RepaintBoundary(
              child: CustomPaint(
                painter: PersonAvatarPainter(
                  person: person,
                  fillColor: fillColor,
                  isSelected: isSelected,
                ),
                child: person.imageUrl != null
                    ? ClipPath(
                        clipper: ShapeClipper(
                          shapeType: person.shapeType,
                          sides: person.sides,
                          amplitude: person.amplitude,
                        ),
                        child: Image.network(
                          person.imageUrl!,
                          width: 40,
                          height: 40,
                          fit: BoxFit.cover,
                          errorBuilder: (_, _, _) => const SizedBox.shrink(),
                        ),
                      )
                    : Center(
                        child: Text(
                          person.avatar,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 11,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
              ),
            ),
          ),
          const SizedBox(height: 4),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.88),
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(
              person.name,
              style: TextStyle(
                color: isSelected
                    ? const Color(0xFF2563EB)
                    : const Color(0xFF1C2528),
                fontSize: 10,
                fontWeight: FontWeight.w800,
              ),
              overflow: TextOverflow.ellipsis,
              maxLines: 1,
            ),
          ),
        ],
      ),
    );
  }
}

class PersonAvatarPainter extends CustomPainter {
  final PersonNode person;
  final Color fillColor;
  final bool isSelected;

  PersonAvatarPainter({
    required this.person,
    required this.fillColor,
    required this.isSelected,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2 - 1.0;
    final path = getCustomNodePath(
      center.dx,
      center.dy,
      radius,
      person.shapeType,
      person.sides,
      person.amplitude,
    );

    final fillPaint = Paint()
      ..color = person.imageUrl != null ? fillColor : fillColor
      ..style = PaintingStyle.fill;
    canvas.drawPath(path, fillPaint);

    final borderPaint = Paint()
      ..color = isSelected ? const Color(0xFF2563EB) : Colors.white
      ..style = PaintingStyle.stroke
      ..strokeWidth = isSelected ? 2.5 : 1.5;
    canvas.drawPath(path, borderPaint);
  }

  @override
  bool shouldRepaint(covariant PersonAvatarPainter oldDelegate) {
    return oldDelegate.person.shapeType != person.shapeType ||
        oldDelegate.person.sides != person.sides ||
        oldDelegate.person.amplitude != person.amplitude ||
        oldDelegate.fillColor != fillColor ||
        oldDelegate.isSelected != isSelected;
  }
}

class CreateContextMenuWidget extends StatelessWidget {
  final VoidCallback onAddPerson;
  final VoidCallback onAddNested;
  final VoidCallback onAddExternal;

  const CreateContextMenuWidget({
    super.key,
    required this.onAddPerson,
    required this.onAddNested,
    required this.onAddExternal,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 280,
      padding: const EdgeInsets.all(7),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFC4C7C8), width: 1.5),
        boxShadow: const [
          BoxShadow(
            color: Color(0x1F363D44),
            blurRadius: 48,
            offset: Offset(0, 18),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _menuButton(Icons.person_add, 'Add person here', onAddPerson),
          _menuButton(
            Icons.filter_center_focus,
            'Add subset inside source circle',
            onAddNested,
          ),
          _menuButton(
            Icons.add_circle_outline,
            'Create connected circle outside',
            onAddExternal,
          ),
        ],
      ),
    );
  }

  Widget _menuButton(IconData icon, String text, VoidCallback onPressed) {
    return InkWell(
      onTap: onPressed,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        height: 44,
        padding: const EdgeInsets.symmetric(horizontal: 10),
        child: Row(
          children: [
            Icon(icon, color: const Color(0xFF2563EB), size: 19),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                text,
                style: const TextStyle(
                  color: Color(0xFF1C2528),
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class StressPanelWidget extends StatelessWidget {
  final int fps;
  final int stressCount;
  final bool showEdges;
  final bool showLabels;
  final int renderedIcons;
  final int renderedEdges;
  final ValueChanged<int> onCountChanged;
  final ValueChanged<bool> onShowEdgesChanged;
  final ValueChanged<bool> onShowLabelsChanged;

  const StressPanelWidget({
    super.key,
    required this.fps,
    required this.stressCount,
    required this.showEdges,
    required this.showLabels,
    required this.renderedIcons,
    required this.renderedEdges,
    required this.onCountChanged,
    required this.onShowEdgesChanged,
    required this.onShowLabelsChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 260,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFC4C7C8), width: 1.5),
        boxShadow: const [
          BoxShadow(
            color: Color(0x14363D44),
            blurRadius: 48,
            offset: Offset(0, 18),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Icon stress',
                style: TextStyle(
                  color: Color(0xFF1C2528),
                  fontSize: 13,
                  fontWeight: FontWeight.w900,
                ),
              ),
              Text(
                '$fps FPS',
                style: const TextStyle(
                  color: Color(0xFF2563EB),
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            '${stressCount.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},')} synthetic icons',
            style: const TextStyle(
              color: Color(0xFF6B7280),
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
          Slider(
            value: stressCount.toDouble(),
            min: 0,
            max: maxStressIcons.toDouble(),
            divisions: 40,
            activeColor: const Color(0xFF2563EB),
            inactiveColor: const Color(0xFFE5E7EB),
            onChanged: (v) => onCountChanged(v.round()),
          ),
          Wrap(
            spacing: 12,
            runSpacing: 4,
            children: [
              _toggle('Edges', showEdges, onShowEdgesChanged),
              _toggle('Labels', showLabels, onShowLabelsChanged),
            ],
          ),
          const SizedBox(height: 8),
          _stat('Rendered icons', renderedIcons),
          _stat('Rendered edges', renderedEdges),
        ],
      ),
    );
  }

  Widget _toggle(String label, bool value, ValueChanged<bool> onChanged) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Transform.scale(
          scale: 0.8,
          child: Switch(
            value: value,
            onChanged: onChanged,
            activeThumbColor: const Color(0xFF2563EB),
            materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
          ),
        ),
        Text(
          label,
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: Color(0xFF1C2528),
          ),
        ),
      ],
    );
  }

  Widget _stat(String label, int value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: const TextStyle(color: Color(0xFF6B7280), fontSize: 11),
          ),
          Text(
            value.toString().replaceAllMapped(
              RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
              (m) => '${m[1]},',
            ),
            style: const TextStyle(
              color: Color(0xFF1C2528),
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class InspectorWidget extends StatefulWidget {
  final CircleNode? selectedCircle;
  final PersonNode? selectedPerson;
  final int circlesCount;
  final int peopleCount;
  final ValueChanged<String> onRename;
  final VoidCallback onAddDemoCluster;
  final Map<String, CircleNode> circlesById;
  final List<PersonNode> peopleList;
  final List<CircleNode> circlesList;
  final Function(
    String circleId, {
    ShapeType? shapeType,
    int? sides,
    double? amplitude,
    String? imageUrl,
    bool clearImageUrl,
    CircleTone? tone,
  })
  onUpdateCircleStyle;
  final Function(
    String personId, {
    ShapeType? shapeType,
    int? sides,
    double? amplitude,
    String? imageUrl,
    bool clearImageUrl,
  })
  onUpdatePersonStyle;

  const InspectorWidget({
    super.key,
    required this.selectedCircle,
    required this.selectedPerson,
    required this.circlesCount,
    required this.peopleCount,
    required this.onRename,
    required this.onAddDemoCluster,
    required this.circlesById,
    required this.peopleList,
    required this.circlesList,
    required this.onUpdateCircleStyle,
    required this.onUpdatePersonStyle,
  });

  @override
  State<InspectorWidget> createState() => _InspectorWidgetState();
}

class _InspectorWidgetState extends State<InspectorWidget> {
  late TextEditingController _nameController;
  late TextEditingController _imageUrlController;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(
      text: widget.selectedCircle?.name ?? widget.selectedPerson?.name ?? '',
    );
    _imageUrlController = TextEditingController(
      text:
          widget.selectedCircle?.imageUrl ??
          widget.selectedPerson?.imageUrl ??
          '',
    );
  }

  @override
  void didUpdateWidget(covariant InspectorWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    final String currentText =
        widget.selectedCircle?.name ?? widget.selectedPerson?.name ?? '';
    if (_nameController.text != currentText) {
      _nameController.text = currentText;
    }
    final String currentImageUrl =
        widget.selectedCircle?.imageUrl ??
        widget.selectedPerson?.imageUrl ??
        '';
    if (_imageUrlController.text != currentImageUrl) {
      _imageUrlController.text = currentImageUrl;
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _imageUrlController.dispose();
    super.dispose();
  }

  void _handleImageUpload() async {
    final base64 = await pickImageBase64();
    if (base64 == null) return;
    if (widget.selectedCircle != null) {
      widget.onUpdateCircleStyle(
        widget.selectedCircle!.id,
        imageUrl: base64,
        clearImageUrl: false,
      );
    } else if (widget.selectedPerson != null) {
      widget.onUpdatePersonStyle(
        widget.selectedPerson!.id,
        imageUrl: base64,
        clearImageUrl: false,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    if (widget.selectedCircle == null && widget.selectedPerson == null) {
      return const SizedBox.shrink();
    }

    final isCircle = widget.selectedCircle != null;
    final String title = isCircle ? 'Circle center' : 'Person';

    return Container(
      width: 320,
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height - 120,
      ),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFC4C7C8), width: 1.5),
        boxShadow: const [
          BoxShadow(
            color: Color(0x14363D44),
            blurRadius: 48,
            offset: Offset(0, 18),
          ),
        ],
      ),
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              title.toUpperCase(),
              style: const TextStyle(
                color: Color(0x841C2528),
                fontSize: 11,
                fontWeight: FontWeight.w900,
                letterSpacing: 1.0,
              ),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _nameController,
              style: const TextStyle(
                color: Color(0xFF10181C),
                fontSize: 24,
                fontWeight: FontWeight.bold,
              ),
              decoration: const InputDecoration(
                isDense: true,
                contentPadding: EdgeInsets.symmetric(vertical: 6),
                enabledBorder: UnderlineInputBorder(
                  borderSide: BorderSide(color: Color(0x241C2528)),
                ),
                focusedBorder: UnderlineInputBorder(
                  borderSide: BorderSide(color: Color(0xFF2563EB)),
                ),
              ),
              onChanged: widget.onRename,
            ),
            const SizedBox(height: 14),
            if (isCircle) ...[
              _detail(
                'People',
                '${widget.peopleList.where((p) => p.circleId == widget.selectedCircle!.id).length}',
              ),
              _detail(
                'Nested circles',
                '${widget.circlesList.where((c) => c.parentId == widget.selectedCircle!.id).length}',
              ),
              _detail('Radius', '${widget.selectedCircle!.radius.round()} px'),
              const SizedBox(height: 10),
              // Tone selector
              _label('Tone'),
              const SizedBox(height: 6),
              Wrap(
                spacing: 6,
                children: CircleTone.values.map((tone) {
                  final color = materialTones[tone]!.centerBg;
                  final isActive = widget.selectedCircle!.tone == tone;
                  return GestureDetector(
                    onTap: () => widget.onUpdateCircleStyle(
                      widget.selectedCircle!.id,
                      tone: tone,
                    ),
                    child: Container(
                      width: 28,
                      height: 28,
                      decoration: BoxDecoration(
                        color: color,
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: isActive
                              ? const Color(0xFF2563EB)
                              : Colors.transparent,
                          width: 3,
                        ),
                        boxShadow: isActive
                            ? [
                                BoxShadow(
                                  color: color.withValues(alpha: 0.5),
                                  blurRadius: 8,
                                ),
                              ]
                            : null,
                      ),
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 10),
              // Shape type
              _label('Shape Type'),
              const SizedBox(height: 6),
              _shapeDropdown(
                value: widget.selectedCircle!.shapeType,
                onChanged: (v) => widget.onUpdateCircleStyle(
                  widget.selectedCircle!.id,
                  shapeType: v,
                ),
                forCircle: true,
              ),
              if (widget.selectedCircle!.shapeType != ShapeType.circle) ...[
                const SizedBox(height: 10),
                _label('Sides / Petals  (${widget.selectedCircle!.sides})'),
                Slider(
                  value: widget.selectedCircle!.sides.toDouble(),
                  min: 3,
                  max: 60,
                  divisions: 57,
                  activeColor: const Color(0xFF2563EB),
                  inactiveColor: const Color(0xFFE5E7EB),
                  onChanged: (v) => widget.onUpdateCircleStyle(
                    widget.selectedCircle!.id,
                    sides: v.round(),
                  ),
                ),
                _label(
                  'Amplitude / Rounding  (${widget.selectedCircle!.amplitude.toStringAsFixed(0)})',
                ),
                Slider(
                  value: widget.selectedCircle!.amplitude,
                  min: 0,
                  max: 50,
                  divisions: 50,
                  activeColor: const Color(0xFF2563EB),
                  inactiveColor: const Color(0xFFE5E7EB),
                  onChanged: (v) => widget.onUpdateCircleStyle(
                    widget.selectedCircle!.id,
                    amplitude: v,
                  ),
                ),
              ],
              const SizedBox(height: 10),
              _label('Center Image URL'),
              const SizedBox(height: 4),
              TextField(
                controller: _imageUrlController,
                style: const TextStyle(fontSize: 12, color: Color(0xFF1C2528)),
                decoration: InputDecoration(
                  isDense: true,
                  hintText: 'https://example.com/image.jpg',
                  hintStyle: const TextStyle(
                    fontSize: 12,
                    color: Color(0xFFADB5BD),
                  ),
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 8,
                  ),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: const BorderSide(color: Color(0xFFCED4DA)),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: const BorderSide(color: Color(0xFFCED4DA)),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: const BorderSide(color: Color(0xFF2563EB)),
                  ),
                ),
                onChanged: (v) => widget.onUpdateCircleStyle(
                  widget.selectedCircle!.id,
                  imageUrl: v.isEmpty ? null : v,
                  clearImageUrl: v.isEmpty,
                ),
              ),
              const SizedBox(height: 8),
              _uploadButton(),
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                height: 42,
                child: ElevatedButton(
                  onPressed: widget.onAddDemoCluster,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF1C2528),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(9),
                    ),
                    elevation: 0,
                  ),
                  child: const Text(
                    'Add 3 demo people',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                  ),
                ),
              ),
            ] else ...[
              _detail('Role', widget.selectedPerson!.role),
              _detail(
                'Circle',
                widget.circlesById[widget.selectedPerson!.circleId]?.name ?? '',
              ),
              const SizedBox(height: 10),
              _label('Shape Type'),
              const SizedBox(height: 6),
              _shapeDropdown(
                value: widget.selectedPerson!.shapeType,
                onChanged: (v) => widget.onUpdatePersonStyle(
                  widget.selectedPerson!.id,
                  shapeType: v,
                ),
                forCircle: false,
              ),
              if (widget.selectedPerson!.shapeType != ShapeType.circle) ...[
                const SizedBox(height: 10),
                _label('Sides / Petals  (${widget.selectedPerson!.sides})'),
                Slider(
                  value: widget.selectedPerson!.sides.toDouble(),
                  min: 3,
                  max: 20,
                  divisions: 17,
                  activeColor: const Color(0xFF2563EB),
                  inactiveColor: const Color(0xFFE5E7EB),
                  onChanged: (v) => widget.onUpdatePersonStyle(
                    widget.selectedPerson!.id,
                    sides: v.round(),
                  ),
                ),
                _label(
                  'Amplitude / Rounding  (${widget.selectedPerson!.amplitude.toStringAsFixed(0)})',
                ),
                Slider(
                  value: widget.selectedPerson!.amplitude,
                  min: 0,
                  max: 20,
                  divisions: 20,
                  activeColor: const Color(0xFF2563EB),
                  inactiveColor: const Color(0xFFE5E7EB),
                  onChanged: (v) => widget.onUpdatePersonStyle(
                    widget.selectedPerson!.id,
                    amplitude: v,
                  ),
                ),
              ],
              const SizedBox(height: 10),
              _label('Photo Image URL'),
              const SizedBox(height: 4),
              TextField(
                controller: _imageUrlController,
                style: const TextStyle(fontSize: 12, color: Color(0xFF1C2528)),
                decoration: InputDecoration(
                  isDense: true,
                  hintText: 'https://example.com/image.jpg',
                  hintStyle: const TextStyle(
                    fontSize: 12,
                    color: Color(0xFFADB5BD),
                  ),
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 8,
                  ),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: const BorderSide(color: Color(0xFFCED4DA)),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: const BorderSide(color: Color(0xFFCED4DA)),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: const BorderSide(color: Color(0xFF2563EB)),
                  ),
                ),
                onChanged: (v) => widget.onUpdatePersonStyle(
                  widget.selectedPerson!.id,
                  imageUrl: v.isEmpty ? null : v,
                  clearImageUrl: v.isEmpty,
                ),
              ),
              const SizedBox(height: 8),
              _uploadButton(),
            ],
            const SizedBox(height: 14),
            const Text(
              'Drag objects directly. Long-press or right-click a circle for creation actions. Parent circles auto-fit as contained objects move.',
              style: TextStyle(
                color: Color(0x9E1C2528),
                fontSize: 12,
                height: 1.48,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _label(String text) {
    return Text(
      text,
      style: const TextStyle(
        color: Color(0xFF6B7280),
        fontSize: 11,
        fontWeight: FontWeight.w700,
      ),
    );
  }

  Widget _detail(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: const TextStyle(
              color: Color(0x8A1C2528),
              fontSize: 12,
              fontWeight: FontWeight.bold,
            ),
          ),
          Text(
            value,
            style: const TextStyle(
              color: Color(0xFF1C2528),
              fontSize: 13,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }

  Widget _shapeDropdown({
    required ShapeType value,
    required ValueChanged<ShapeType> onChanged,
    required bool forCircle,
  }) {
    return DropdownButton<ShapeType>(
      value: value,
      isDense: true,
      isExpanded: true,
      underline: Container(height: 1, color: const Color(0xFFCED4DA)),
      style: const TextStyle(
        fontSize: 13,
        color: Color(0xFF1C2528),
        fontWeight: FontWeight.w600,
      ),
      onChanged: (v) {
        if (v != null) onChanged(v);
      },
      items: [
        if (forCircle)
          const DropdownMenuItem(
            value: ShapeType.wavy,
            child: Text('Wavy (Flower)'),
          ),
        const DropdownMenuItem(
          value: ShapeType.polygon,
          child: Text('Soft Polygon'),
        ),
        const DropdownMenuItem(value: ShapeType.circle, child: Text('Circle')),
        if (!forCircle)
          const DropdownMenuItem(
            value: ShapeType.wavy,
            child: Text('Wavy (Flower)'),
          ),
      ],
    );
  }

  Widget _uploadButton() {
    return SizedBox(
      width: double.infinity,
      height: 36,
      child: OutlinedButton.icon(
        onPressed: _handleImageUpload,
        icon: const Icon(Icons.upload, size: 16),
        label: const Text('Upload Photo', style: TextStyle(fontSize: 12)),
        style: OutlinedButton.styleFrom(
          foregroundColor: const Color(0xFF2563EB),
          side: const BorderSide(color: Color(0xFF2563EB)),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          padding: const EdgeInsets.symmetric(horizontal: 12),
        ),
      ),
    );
  }
}

// ─── Shape math ──────────────────────────────────────────────────────────────

Path getCustomNodePath(
  double cx,
  double cy,
  double r,
  ShapeType shapeType,
  int sides,
  double amplitude,
) {
  final path = Path();
  if (shapeType == ShapeType.circle || amplitude == 0.0) {
    final int points = math.max(120, (r * 2).round());
    for (int i = 0; i <= points; i++) {
      final double angle = (i * 2 * math.pi) / points;
      final double x = cx + r * math.cos(angle);
      final double y = cy + r * math.sin(angle);
      if (i == 0) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    }
    path.close();
    return path;
  }

  if (shapeType == ShapeType.wavy) {
    final int points = math.max(240, (r * 2 * math.pi).round());
    final double baseR = r - amplitude - 4.0;
    for (int i = 0; i <= points; i++) {
      final double angle = (i * 2 * math.pi) / points;
      final double currentR = baseR + amplitude * math.cos(sides * angle);
      final double x = cx + currentR * math.cos(angle);
      final double y = cy + currentR * math.sin(angle);
      if (i == 0) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    }
    path.close();
    return path;
  }

  // shapeType == ShapeType.polygon
  final double softness = (amplitude / 20.0).clamp(0.0, 1.0);
  final List<Offset> vertices = [];
  final double angleStep = (2 * math.pi) / sides;
  for (int i = 0; i < sides; i++) {
    final double angle = i * angleStep - math.pi / 2;
    vertices.add(Offset(cx + r * math.cos(angle), cy + r * math.sin(angle)));
  }

  final List<Offset> midpoints = [];
  for (int i = 0; i < sides; i++) {
    final int next = (i + 1) % sides;
    midpoints.add(
      Offset(
        (vertices[i].dx + vertices[next].dx) / 2,
        (vertices[i].dy + vertices[next].dy) / 2,
      ),
    );
  }

  for (int i = 0; i < sides; i++) {
    final int prevIdx = (i - 1 + sides) % sides;
    final Offset p = vertices[i];
    final Offset mPrev = midpoints[prevIdx];
    final Offset mNext = midpoints[i];

    final double startX = p.dx + (mPrev.dx - p.dx) * softness;
    final double startY = p.dy + (mPrev.dy - p.dy) * softness;

    final double endX = p.dx + (mNext.dx - p.dx) * softness;
    final double endY = p.dy + (mNext.dy - p.dy) * softness;

    if (i == 0) {
      path.moveTo(startX, startY);
    } else {
      path.lineTo(startX, startY);
    }
    path.quadraticBezierTo(p.dx, p.dy, endX, endY);
  }
  path.close();
  return path;
}

class ShapeClipper extends CustomClipper<Path> {
  final ShapeType shapeType;
  final int sides;
  final double amplitude;

  ShapeClipper({
    required this.shapeType,
    required this.sides,
    required this.amplitude,
  });

  @override
  Path getClip(Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2;
    return getCustomNodePath(
      center.dx,
      center.dy,
      radius,
      shapeType,
      sides,
      amplitude,
    );
  }

  @override
  bool shouldReclip(covariant ShapeClipper oldClipper) {
    return oldClipper.shapeType != shapeType ||
        oldClipper.sides != sides ||
        oldClipper.amplitude != amplitude;
  }
}

// ─── Graph helpers ────────────────────────────────────────────────────────────

double getRequiredCircleRadius(
  CircleNode circle,
  List<CircleNode> circles,
  Map<String, CircleNode> circlesById,
  List<PersonNode> people,
) {
  double requiredRadius = math.max(72.0, circle.minRadius);

  for (final person in people) {
    if (person.circleId != circle.id) continue;
    final double dist = math.sqrt(
      math.pow(person.x - circle.x, 2) + math.pow(person.y - circle.y, 2),
    );
    requiredRadius = math.max(requiredRadius, dist + 62.0);
  }

  for (final childCircle in circles) {
    if (childCircle.parentId != circle.id) continue;

    final latestChild = circlesById[childCircle.id] ?? childCircle;
    final double dist = math.sqrt(
      math.pow(latestChild.x - circle.x, 2) +
          math.pow(latestChild.y - circle.y, 2),
    );
    requiredRadius = math.max(requiredRadius, dist + latestChild.radius + 28.0);
  }

  return requiredRadius.ceilToDouble();
}

List<CircleNode> ensureContainment(
  List<CircleNode> circles,
  List<PersonNode> people,
) {
  List<CircleNode> currentCircles = circles.map((c) => c.copyWith()).toList();

  for (int pass = 0; pass < currentCircles.length + 2; pass++) {
    final circlesById = {for (final c in currentCircles) c.id: c};
    bool changed = false;

    for (int i = 0; i < currentCircles.length; i++) {
      final circle = currentCircles[i];
      final requiredRadius = getRequiredCircleRadius(
        circle,
        currentCircles,
        circlesById,
        people,
      );
      if (requiredRadius != circle.radius) {
        currentCircles[i] = circle.copyWith(radius: requiredRadius);
        changed = true;
      }
    }

    if (!changed) break;
  }

  return currentCircles;
}

List<PersonNode> generateStressPeople(int count) {
  final people = <PersonNode>[];
  for (int i = 0; i < count; i++) {
    final angle = i * 2.399963229728653;
    final ring = math.sqrt(i).floor();
    final radius = 185.0 + ring * 15.0;
    final jitter = (seededRandom(i + 11) - 0.5) * 18.0;

    people.add(
      PersonNode(
        id: 'stress-$i',
        name: 'Stress ${i + 1}',
        role: '',
        x: math.cos(angle) * (radius + jitter),
        y: math.sin(angle) * (radius + jitter),
        circleId: 'you',
        avatar: makeAvatar(i),
      ),
    );
  }
  return people;
}

double seededRandom(int seed) {
  final value = math.sin(seed * 12.9898) * 43758.5453;
  return value - value.floor();
}

List<CircleNode> createInitialGraphCircles() {
  return [
    CircleNode(
      id: 'you',
      name: 'You',
      icon: 'YOU',
      x: 0.0,
      y: 0.0,
      radius: 126.0,
      minRadius: 126.0,
      parentId: null,
      connectedTo: null,
      tone: CircleTone.blue,
      shapeType: ShapeType.wavy,
      sides: 12,
      amplitude: 7.0,
    ),
    CircleNode(
      id: 'eu-network',
      name: 'EU friends',
      icon: 'EU',
      x: 36.0,
      y: -430.0,
      radius: 250.0,
      minRadius: 250.0,
      parentId: null,
      connectedTo: 'you',
      tone: CircleTone.blue,
      shapeType: ShapeType.wavy,
      sides: 25,
      amplitude: 15.0,
    ),
    CircleNode(
      id: 'pandora',
      name: 'Pandora',
      icon: 'P',
      x: -48.0,
      y: 450.0,
      radius: 270.0,
      minRadius: 270.0,
      parentId: null,
      connectedTo: 'you',
      tone: CircleTone.red,
      shapeType: ShapeType.wavy,
      sides: 27,
      amplitude: 16.0,
    ),
    CircleNode(
      id: 'product-team',
      name: 'Product team',
      icon: 'PT',
      x: -56.0,
      y: 535.0,
      radius: 78.0,
      minRadius: 78.0,
      parentId: 'pandora',
      connectedTo: 'pandora',
      tone: CircleTone.blue,
      shapeType: ShapeType.wavy,
      sides: 8,
      amplitude: 5.0,
    ),
    CircleNode(
      id: 'market',
      name: 'Market circle',
      icon: 'M',
      x: 510.0,
      y: 72.0,
      radius: 236.0,
      minRadius: 236.0,
      parentId: null,
      connectedTo: 'you',
      tone: CircleTone.green,
      shapeType: ShapeType.wavy,
      sides: 23,
      amplitude: 14.0,
    ),
  ];
}

List<PersonNode> createInitialGraphPeople() {
  return [
    PersonNode(
      id: 'p1',
      name: 'Mia',
      role: 'Close friend',
      x: -62.0,
      y: -54.0,
      circleId: 'you',
      avatar: 'MI',
      shapeType: ShapeType.polygon,
      sides: 8,
      amplitude: 2.0,
    ),
    PersonNode(
      id: 'p2',
      name: 'Noah',
      role: 'Founder friend',
      x: 58.0,
      y: -6.0,
      circleId: 'you',
      avatar: 'NO',
      shapeType: ShapeType.polygon,
      sides: 10,
      amplitude: 2.0,
    ),
    PersonNode(
      id: 'p3',
      name: 'Ava',
      role: 'Design',
      x: 34.0,
      y: 67.0,
      circleId: 'you',
      avatar: 'AV',
      shapeType: ShapeType.polygon,
      sides: 11,
      amplitude: 2.0,
    ),
    PersonNode(
      id: 'p4',
      name: 'Sofia',
      role: 'Portugal',
      x: 168.0,
      y: -472.0,
      circleId: 'eu-network',
      avatar: 'SO',
      shapeType: ShapeType.polygon,
      sides: 9,
      amplitude: 2.0,
    ),
    PersonNode(
      id: 'p5',
      name: 'Lucas',
      role: 'Germany',
      x: 28.0,
      y: -610.0,
      circleId: 'eu-network',
      avatar: 'LU',
      shapeType: ShapeType.polygon,
      sides: 12,
      amplitude: 2.0,
    ),
    PersonNode(
      id: 'p6',
      name: 'Emma',
      role: 'Finland',
      x: -112.0,
      y: -416.0,
      circleId: 'eu-network',
      avatar: 'EM',
      shapeType: ShapeType.polygon,
      sides: 8,
      amplitude: 2.0,
    ),
    PersonNode(
      id: 'p7',
      name: 'Oscar',
      role: 'Denmark',
      x: 106.0,
      y: -302.0,
      circleId: 'eu-network',
      avatar: 'OC',
      shapeType: ShapeType.polygon,
      sides: 10,
      amplitude: 2.0,
    ),
    PersonNode(
      id: 'p8',
      name: 'Olivia',
      role: 'Brand',
      x: -166.0,
      y: 335.0,
      circleId: 'pandora',
      avatar: 'OL',
      shapeType: ShapeType.polygon,
      sides: 11,
      amplitude: 2.0,
    ),
    PersonNode(
      id: 'p9',
      name: 'Victor',
      role: 'Retail',
      x: 154.0,
      y: 360.0,
      circleId: 'pandora',
      avatar: 'VI',
      shapeType: ShapeType.polygon,
      sides: 9,
      amplitude: 2.0,
    ),
    PersonNode(
      id: 'p10',
      name: 'Freja',
      role: 'Operations',
      x: -190.0,
      y: 575.0,
      circleId: 'pandora',
      avatar: 'FR',
      shapeType: ShapeType.polygon,
      sides: 12,
      amplitude: 2.0,
    ),
    PersonNode(
      id: 'p11',
      name: 'Anton',
      role: 'PM',
      x: -92.0,
      y: 575.0,
      circleId: 'product-team',
      avatar: 'AN',
      shapeType: ShapeType.polygon,
      sides: 8,
      amplitude: 2.0,
    ),
    PersonNode(
      id: 'p12',
      name: 'Nora',
      role: 'UX',
      x: -20.0,
      y: 591.0,
      circleId: 'product-team',
      avatar: 'NR',
      shapeType: ShapeType.polygon,
      sides: 10,
      amplitude: 2.0,
    ),
    PersonNode(
      id: 'p13',
      name: 'Eli',
      role: 'Engineering',
      x: 50.0,
      y: 575.0,
      circleId: 'product-team',
      avatar: 'EL',
      shapeType: ShapeType.polygon,
      sides: 11,
      amplitude: 2.0,
    ),
    PersonNode(
      id: 'p14',
      name: 'Karim',
      role: 'Investor',
      x: 645.0,
      y: -15.0,
      circleId: 'market',
      avatar: 'KA',
      shapeType: ShapeType.polygon,
      sides: 9,
      amplitude: 2.0,
    ),
    PersonNode(
      id: 'p15',
      name: 'Lina',
      role: 'Media',
      x: 423.0,
      y: 4.0,
      circleId: 'market',
      avatar: 'LI',
      shapeType: ShapeType.polygon,
      sides: 12,
      amplitude: 2.0,
    ),
    PersonNode(
      id: 'p16',
      name: 'Yara',
      role: 'Analyst',
      x: 580.0,
      y: 198.0,
      circleId: 'market',
      avatar: 'YA',
      shapeType: ShapeType.polygon,
      sides: 8,
      amplitude: 2.0,
    ),
  ];
}

String makeAvatar(int index) {
  const names = ['AL', 'BD', 'CE', 'DK', 'EV', 'FX', 'GN', 'HM', 'IR'];
  return names[index % names.length];
}

CircleTone nextTone(int index) {
  const tones = CircleTone.values;
  return tones[index % tones.length];
}
