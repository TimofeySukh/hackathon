import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

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
    String? connectedTo,
    CircleTone? tone,
  }) {
    return CircleNode(
      id: id ?? this.id,
      name: name ?? this.name,
      icon: icon ?? this.icon,
      x: x ?? this.x,
      y: y ?? this.y,
      radius: radius ?? this.radius,
      minRadius: minRadius ?? this.minRadius,
      parentId: parentId ?? this.parentId,
      connectedTo: connectedTo ?? this.connectedTo,
      tone: tone ?? this.tone,
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

  PersonNode({
    required this.id,
    required this.name,
    required this.role,
    required this.x,
    required this.y,
    required this.circleId,
    required this.avatar,
  });

  PersonNode copyWith({
    String? id,
    String? name,
    String? role,
    double? x,
    double? y,
    String? circleId,
    String? avatar,
  }) {
    return PersonNode(
      id: id ?? this.id,
      name: name ?? this.name,
      role: role ?? this.role,
      x: x ?? this.x,
      y: y ?? this.y,
      circleId: circleId ?? this.circleId,
      avatar: avatar ?? this.avatar,
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

class MyHomePage extends StatefulWidget {
  const MyHomePage({super.key});

  @override
  State<MyHomePage> createState() => _MyHomePageState();
}

class _MyHomePageState extends State<MyHomePage> {
  late List<CircleNode> circles;
  late List<PersonNode> people;

  final TransformationController _transformationController = TransformationController();

  String? selectedCircleId;
  String? selectedPersonId;

  Offset? createMenuWorldPos;
  Offset? createMenuScreenPos;
  String? createMenuSourceCircleId;

  String? connectorSourceCircleId;
  Offset? connectorStartPos;
  Offset? connectorEndPos;

  bool isResizing = false;

  @override
  void initState() {
    super.initState();
    circles = createInitialGraphCircles();
    people = createInitialGraphPeople();
    circles = ensureContainment(circles, people);

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

  void _addDemoCluster() {
    final String sourceId = selectedCircleId ?? 'you';
    final source = circles.firstWhere((c) => c.id == sourceId);
    final int nextIndex = people.length + 1;
    final time = DateTime.now().millisecondsSinceEpoch;

    final offsets = [-58.0, 0.0, 58.0];
    final names = ['Alex', 'Daria', 'Sam'];

    setState(() {
      for (int i = 0; i < 3; i++) {
        people.add(PersonNode(
          id: 'person-$time-$i',
          name: names[i],
          role: 'Added to ${source.name}',
          x: source.x + offsets[i],
          y: source.y + source.radius * 0.42 + i * 18.0,
          circleId: source.id,
          avatar: makeAvatar(nextIndex + i),
        ));
      }
      circles = ensureContainment(circles, people);
    });
  }

  void _openCircleContextMenu(CircleNode circle, Offset globalPos, Offset localPos) {
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

    final double distance = (localPos - Offset(circle.radius, circle.radius)).distance;
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
          return candidate.copyWith(
            x: candidate.x + dx,
            y: candidate.y + dy,
          );
        }
        return candidate;
      }).toList();

      people = people.map((person) {
        if (subtreeIds.contains(person.circleId)) {
          return person.copyWith(
            x: person.x + dx,
            y: person.y + dy,
          );
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

    setState(() {
      people.add(PersonNode(
        id: newId,
        name: 'New person ${people.length + 1}',
        role: 'Inside parent',
        x: createMenuWorldPos!.dx,
        y: createMenuWorldPos!.dy,
        circleId: sourceId,
        avatar: makeAvatar(people.length + 1),
      ));
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
      circles.add(CircleNode(
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
      ));
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
      style: IconButton.styleFrom(
        hoverColor: const Color(0x121C2528),
      ),
    );
  }

  Widget _helpRow(String text) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('• ', style: TextStyle(color: Color(0x8A1C2528), fontSize: 12, fontWeight: FontWeight.bold)),
          Expanded(
            child: Text(
              text,
              style: const TextStyle(color: Color(0xAD1C2528), fontSize: 12, fontWeight: FontWeight.w600, height: 1.35),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final circlesById = {for (final c in circles) c.id: c};
    final selectedCircle = selectedCircleId != null ? circlesById[selectedCircleId] : null;
    final selectedPerson = selectedPersonId != null ? people.firstWhere((p) => p.id == selectedPersonId) : null;

    int getDepth(String? circleId) {
      int depth = 0;
      String? curr = circleId;
      while (curr != null) {
        depth++;
        curr = circlesById[curr]?.parentId;
      }
      return depth;
    }

    final sortedCircles = [...circles]..sort((a, b) => getDepth(a.parentId).compareTo(getDepth(b.parentId)));

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
                      child: CustomPaint(
                        painter: GridPainter(),
                      ),
                    ),
                    Positioned.fill(
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
                    ...sortedCircles.map((circle) {
                      final double size = circle.radius * 2;
                      return Positioned(
                        left: circle.x - circle.radius + halfWorldSize,
                        top: circle.y - circle.radius + halfWorldSize,
                        width: size,
                        height: size,
                        child: GestureDetector(
                          onSecondaryTapUp: (details) {
                            _openCircleContextMenu(circle, details.globalPosition, details.localPosition);
                          },
                          onLongPressStart: (details) {
                            _openCircleContextMenu(circle, details.globalPosition, details.localPosition);
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
                          child: CircleWidget(
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
                    ...people.map((person) {
                      final parentCircle = circlesById[person.circleId];
                      final tone = parentCircle?.tone ?? CircleTone.blue;
                      return Positioned(
                        left: person.x - 71.0 + halfWorldSize,
                        top: person.y - 19.0 + halfWorldSize,
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
                          child: PersonWidget(
                            person: person,
                            parentCircleTone: tone,
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
          Positioned(
            top: 16,
            left: 16,
            right: 16,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  height: 44,
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: const Color(0xFFC4C7C8), width: 1.5),
                    boxShadow: const [
                      BoxShadow(color: Color(0x14363D44), blurRadius: 48, offset: Offset(0, 18))
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
                          style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                        ),
                      ),
                      const SizedBox(width: 10),
                      const Text(
                        'Circle graph board',
                        style: TextStyle(color: Color(0xFF1C2528), fontSize: 14, fontWeight: FontWeight.w800),
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
                    border: Border.all(color: const Color(0xFFC4C7C8), width: 1.5),
                    boxShadow: const [
                      BoxShadow(color: Color(0x14363D44), blurRadius: 48, offset: Offset(0, 18))
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
          Positioned(
            left: 16,
            bottom: 16,
            child: Container(
              width: 320,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFC4C7C8), width: 1.5),
                boxShadow: const [
                  BoxShadow(color: Color(0x14363D44), blurRadius: 48, offset: Offset(0, 18))
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text(
                    'HOW IT WORKS',
                    style: TextStyle(color: Color(0xFF1C2528), fontSize: 12, fontWeight: FontWeight.w900, letterSpacing: 1.0),
                  ),
                  const SizedBox(height: 6),
                  _helpRow('Drag people or circles to move them.'),
                  _helpRow('Grab a circle edge to resize it.'),
                  _helpRow('Right-click a circle to add a person, subset, or connected circle.'),
                  _helpRow('Shift-drag from center to connect/create.'),
                  _helpRow('Parent circles auto-fit contents.'),
                ],
              ),
            ),
          ),
          Positioned(
            right: 16,
            bottom: 16,
            child: InspectorWidget(
              selectedCircle: selectedCircle,
              selectedPerson: selectedPerson,
              circlesCount: circles.length,
              peopleCount: people.length,
              onRename: _renameSelected,
              onAddDemoCluster: _addDemoCluster,
              circlesById: circlesById,
              peopleList: people,
              circlesList: circles,
            ),
          ),
        ],
      ),
    );
  }
}

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
      final double lift = math.min(100.0, (to.dy - from.dy).abs() * 0.22 + 38.0);
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
      drawCurve(Offset(source.x, source.y), Offset(circle.x, circle.y), circlePaint);
    }

    for (final person in people) {
      final circle = circlesById[person.circleId];
      if (circle == null) continue;
      drawCurve(Offset(circle.x, circle.y), Offset(person.x, person.y), personPaint);
    }

    if (connectorStart != null && connectorEnd != null) {
      drawCurve(connectorStart!, connectorEnd!, draftPaint);
    }
  }

  @override
  bool shouldRepaint(covariant EdgePainter oldDelegate) => true;
}

class WavyCirclePainter extends CustomPainter {
  final CircleTone tone;
  final bool isSelected;

  WavyCirclePainter({required this.tone, required this.isSelected});

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2;
    final amp = math.max(4.0, radius * 0.06);
    final baseR = radius - amp - 4.0;
    final int petals = math.max(8, (radius / 10.0).round());

    final path = Path();
    const int pointsCount = 240;
    for (int i = 0; i <= pointsCount; i++) {
      final double angle = (i * 2 * math.pi) / pointsCount;
      final double r = baseR + amp * math.cos(petals * angle);
      final double x = center.dx + r * math.cos(angle);
      final double y = center.dy + r * math.sin(angle);

      if (i == 0) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    }
    path.close();

    final colors = materialTones[tone]!;

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
  bool shouldRepaint(covariant WavyCirclePainter oldDelegate) {
    return oldDelegate.tone != tone || oldDelegate.isSelected != isSelected;
  }
}

class WavyAvatarPainter extends CustomPainter {
  final Color fill;
  final Color stroke;

  WavyAvatarPainter({required this.fill, required this.stroke});

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2;
    const double amp = 2.5;
    final baseR = radius - amp - 1.5;

    final path = Path();
    const int pointsCount = 120;
    for (int i = 0; i <= pointsCount; i++) {
      final double angle = (i * 2 * math.pi) / pointsCount;
      final double r = baseR + amp * math.cos(6 * angle);
      final double x = center.dx + r * math.cos(angle);
      final double y = center.dy + r * math.sin(angle);

      if (i == 0) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    }
    path.close();

    final fillPaint = Paint()
      ..color = fill
      ..style = PaintingStyle.fill;
    canvas.drawPath(path, fillPaint);

    final borderPaint = Paint()
      ..color = stroke
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;
    canvas.drawPath(path, borderPaint);
  }

  @override
  bool shouldRepaint(covariant WavyAvatarPainter oldDelegate) {
    return oldDelegate.fill != fill || oldDelegate.stroke != stroke;
  }
}

class CircleWidget extends StatelessWidget {
  final CircleNode circle;
  final bool isSelected;
  final VoidCallback onSelect;
  final GestureDragStartCallback onCenterDragStart;
  final GestureDragUpdateCallback onCenterDragUpdate;
  final GestureDragEndCallback onCenterDragEnd;

  const CircleWidget({
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
        Positioned.fill(
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: onSelect,
            child: CustomPaint(
              painter: WavyCirclePainter(
                tone: circle.tone,
                isSelected: isSelected,
              ),
            ),
          ),
        ),
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
                  BoxShadow(color: Color(0x171C2528), blurRadius: 20, offset: Offset(0, 8))
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
                color: colors.centerBg,
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white, width: 3),
                boxShadow: const [
                  BoxShadow(color: Color(0x331C2528), blurRadius: 26, offset: Offset(0, 12)),
                  BoxShadow(color: Color(0x141C2528), blurRadius: 1, offset: Offset(0, 0)),
                ],
              ),
              alignment: Alignment.center,
              child: Text(
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

class PersonWidget extends StatelessWidget {
  final PersonNode person;
  final CircleTone parentCircleTone;
  final bool isSelected;
  final VoidCallback onSelect;

  const PersonWidget({
    super.key,
    required this.person,
    required this.parentCircleTone,
    required this.isSelected,
    required this.onSelect,
  });

  @override
  Widget build(BuildContext context) {
    final colors = materialTones[parentCircleTone]!;

    return GestureDetector(
      onTap: onSelect,
      child: Container(
        width: 142,
        height: 38,
        padding: const EdgeInsets.all(3),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? const Color(0xFF2563EB) : const Color(0xFFC4C7C8),
            width: isSelected ? 2.5 : 1.5,
          ),
          boxShadow: [
            BoxShadow(
              color: isSelected ? const Color(0x1F2563EB) : const Color(0x12363D44),
              blurRadius: isSelected ? 18 : 12,
              offset: const Offset(0, 4),
            )
          ],
        ),
        child: Row(
          children: [
            CustomPaint(
              size: const Size(32, 32),
              painter: WavyAvatarPainter(
                fill: colors.centerBg,
                stroke: Colors.white,
              ),
              child: Container(
                width: 32,
                height: 32,
                alignment: Alignment.center,
                child: Text(
                  person.avatar,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 10,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                person.name,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Color(0xFF1C2528),
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ],
        ),
      ),
    );
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
          BoxShadow(color: Color(0x1F363D44), blurRadius: 48, offset: Offset(0, 18))
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _menuButton(Icons.person_add, 'Add person here', onAddPerson),
          _menuButton(Icons.filter_center_focus, 'Add subset inside source circle', onAddNested),
          _menuButton(Icons.add_circle_outline, 'Create connected circle outside', onAddExternal),
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
  });

  @override
  State<InspectorWidget> createState() => _InspectorWidgetState();
}

class _InspectorWidgetState extends State<InspectorWidget> {
  late TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(
      text: widget.selectedCircle?.name ?? widget.selectedPerson?.name ?? '',
    );
  }

  @override
  void didUpdateWidget(covariant InspectorWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    final String currentText = widget.selectedCircle?.name ?? widget.selectedPerson?.name ?? '';
    if (_controller.text != currentText) {
      _controller.text = currentText;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
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
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFC4C7C8), width: 1.5),
        boxShadow: const [
          BoxShadow(color: Color(0x14363D44), blurRadius: 48, offset: Offset(0, 18))
        ],
      ),
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
            controller: _controller,
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
            _inspectorDetail(
              'People',
              '${widget.peopleList.where((p) => p.circleId == widget.selectedCircle!.id).length}',
            ),
            _inspectorDetail(
              'Nested circles',
              '${widget.circlesList.where((c) => c.parentId == widget.selectedCircle!.id).length}',
            ),
            _inspectorDetail(
              'Tone',
              widget.selectedCircle!.tone.name[0].toUpperCase() + widget.selectedCircle!.tone.name.substring(1),
            ),
            _inspectorDetail(
              'Radius',
              '${widget.selectedCircle!.radius.round()} px',
            ),
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
            _inspectorDetail(
              'Role',
              widget.selectedPerson!.role,
            ),
            _inspectorDetail(
              'Circle',
              widget.circlesById[widget.selectedPerson!.circleId]?.name ?? '',
            ),
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
    );
  }

  Widget _inspectorDetail(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: const TextStyle(color: Color(0x8A1C2528), fontSize: 12, fontWeight: FontWeight.bold),
          ),
          Text(
            value,
            style: const TextStyle(color: Color(0xFF1C2528), fontSize: 13, fontWeight: FontWeight.w900),
          ),
        ],
      ),
    );
  }
}

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
      math.pow(latestChild.x - circle.x, 2) + math.pow(latestChild.y - circle.y, 2),
    );
    requiredRadius = math.max(requiredRadius, dist + latestChild.radius + 28.0);
  }

  return requiredRadius.ceilToDouble();
}

List<CircleNode> ensureContainment(List<CircleNode> circles, List<PersonNode> people) {
  List<CircleNode> currentCircles = circles.map((c) => c.copyWith()).toList();

  for (int pass = 0; pass < currentCircles.length + 2; pass++) {
    final circlesById = {for (final c in currentCircles) c.id: c};
    bool changed = false;

    for (int i = 0; i < currentCircles.length; i++) {
      final circle = currentCircles[i];
      final requiredRadius = getRequiredCircleRadius(circle, currentCircles, circlesById, people);
      if (requiredRadius != circle.radius) {
        currentCircles[i] = circle.copyWith(radius: requiredRadius);
        changed = true;
      }
    }

    if (!changed) break;
  }

  return currentCircles;
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
    ),
  ];
}

List<PersonNode> createInitialGraphPeople() {
  return [
    PersonNode(id: 'p1', name: 'Mia', role: 'Close friend', x: -62.0, y: -54.0, circleId: 'you', avatar: 'MI'),
    PersonNode(id: 'p2', name: 'Noah', role: 'Founder friend', x: 58.0, y: -6.0, circleId: 'you', avatar: 'NO'),
    PersonNode(id: 'p3', name: 'Ava', role: 'Design', x: 34.0, y: 67.0, circleId: 'you', avatar: 'AV'),
    PersonNode(id: 'p4', name: 'Sofia', role: 'Portugal', x: 168.0, y: -472.0, circleId: 'eu-network', avatar: 'SO'),
    PersonNode(id: 'p5', name: 'Lucas', role: 'Germany', x: 28.0, y: -610.0, circleId: 'eu-network', avatar: 'LU'),
    PersonNode(id: 'p6', name: 'Emma', role: 'Finland', x: -112.0, y: -416.0, circleId: 'eu-network', avatar: 'EM'),
    PersonNode(id: 'p7', name: 'Oscar', role: 'Denmark', x: 106.0, y: -302.0, circleId: 'eu-network', avatar: 'OC'),
    PersonNode(id: 'p8', name: 'Olivia', role: 'Brand', x: -166.0, y: 335.0, circleId: 'pandora', avatar: 'OL'),
    PersonNode(id: 'p9', name: 'Victor', role: 'Retail', x: 154.0, y: 360.0, circleId: 'pandora', avatar: 'VI'),
    PersonNode(id: 'p10', name: 'Freja', role: 'Operations', x: -190.0, y: 575.0, circleId: 'pandora', avatar: 'FR'),
    PersonNode(id: 'p11', name: 'Anton', role: 'PM', x: -92.0, y: 575.0, circleId: 'product-team', avatar: 'AN'),
    PersonNode(id: 'p12', name: 'Nora', role: 'UX', x: -20.0, y: 591.0, circleId: 'product-team', avatar: 'NR'),
    PersonNode(id: 'p13', name: 'Eli', role: 'Engineering', x: 50.0, y: 575.0, circleId: 'product-team', avatar: 'EL'),
    PersonNode(id: 'p14', name: 'Karim', role: 'Investor', x: 645.0, y: -15.0, circleId: 'market', avatar: 'KA'),
    PersonNode(id: 'p15', name: 'Lina', role: 'Media', x: 423.0, y: 4.0, circleId: 'market', avatar: 'LI'),
    PersonNode(id: 'p16', name: 'Yara', role: 'Analyst', x: 580.0, y: 198.0, circleId: 'market', avatar: 'YA'),
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
