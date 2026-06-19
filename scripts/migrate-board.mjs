import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

function slugifyId(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
}

function makeInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function computeCirclePositionsAndRadii(circles, people) {
  const childrenMap = new Map();
  const peopleMap = new Map();
  
  for (const c of circles) {
    if (c.parentId) {
      if (!childrenMap.has(c.parentId)) childrenMap.set(c.parentId, []);
      childrenMap.get(c.parentId).push(c);
    }
  }
  
  for (const p of people) {
    if (p.circleId) {
      if (!peopleMap.has(p.circleId)) peopleMap.set(p.circleId, []);
      peopleMap.get(p.circleId).push(p);
    }
  }

  const circleById = new Map(circles.map(c => [c.id, c]));
  
  function getDepth(id) {
    const children = childrenMap.get(id) || [];
    if (children.length === 0) return 0;
    return 1 + Math.max(...children.map(child => getDepth(child.id)));
  }

  const sortedCircles = [...circles].sort((a, b) => getDepth(a.id) - getDepth(b.id));

  const PERSON_CONTAINMENT_RADIUS = 28;
  const IMPORT_CIRCLE_RADIUS_PADDING = 18;
  const PERSON_PACK_SPACING = 28;
  const PERSON_PACK_INNER = 4;
  const CIRCLE_CONTAINMENT_PADDING = 28;

  function packedCircleRadius(count) {
    if (count <= 1) return 90;
    const rMax = PERSON_PACK_SPACING * Math.sqrt(count - 1 + PERSON_PACK_INNER);
    return Math.max(90, Math.ceil(rMax + PERSON_CONTAINMENT_RADIUS + IMPORT_CIRCLE_RADIUS_PADDING));
  }

  for (const circle of sortedCircles) {
    if (circle.id === 'you') continue;

    const directPeople = peopleMap.get(circle.id) || [];
    const childCircles = childrenMap.get(circle.id) || [];

    let sumX = 0, sumY = 0, count = 0;
    for (const p of directPeople) {
      sumX += p.x;
      sumY += p.y;
      count++;
    }
    for (const child of childCircles) {
      sumX += child.x;
      sumY += child.y;
      count++;
    }

    if (count > 0) {
      circle.x = Math.round(sumX / count);
      circle.y = Math.round(sumY / count);
    }

    let maxDist = 90;
    for (const p of directPeople) {
      const dist = Math.hypot(p.x - circle.x, p.y - circle.y) + PERSON_CONTAINMENT_RADIUS;
      if (dist > maxDist) maxDist = dist;
    }
    for (const child of childCircles) {
      const dist = Math.hypot(child.x - circle.x, child.y - circle.y) + child.radius + CIRCLE_CONTAINMENT_PADDING;
      if (dist > maxDist) maxDist = dist;
    }

    circle.radius = Math.max(packedCircleRadius(directPeople.length), Math.ceil(maxDist));
    circle.minRadius = circle.radius;
  }

  const youCircle = circleById.get('you');
  if (youCircle) {
    const directPeople = peopleMap.get('you') || [];
    const childCircles = circles.filter(c => c.parentId === null && c.id !== 'you');

    youCircle.x = 0;
    youCircle.y = 0;

    let maxDist = 104;
    for (const p of directPeople) {
      const dist = Math.hypot(p.x - youCircle.x, p.y - youCircle.y) + PERSON_CONTAINMENT_RADIUS;
      if (dist > maxDist) maxDist = dist;
    }
    for (const child of childCircles) {
      const dist = Math.hypot(child.x - youCircle.x, child.y - youCircle.y) + child.radius + CIRCLE_CONTAINMENT_PADDING;
      if (dist > maxDist) maxDist = dist;
    }

    youCircle.radius = Math.max(104, Math.ceil(maxDist));
    youCircle.minRadius = youCircle.radius;
  }
}

function migrate(oldGraph) {
  const oldPeople = oldGraph.people || [];
  const oldRootPerson = oldPeople.find(p => p.is_root);
  const oldRootPersonId = oldRootPerson ? oldRootPerson.id : null;
  
  const circles = [];
  const people = [];
  const connections = [];

  // Create central circle
  const youCircle = {
    id: 'you',
    name: oldRootPerson ? oldRootPerson.name : 'You',
    icon: 'YOU',
    x: 0,
    y: 0,
    radius: 104,
    minRadius: 104,
    parentId: null,
    connectedTo: null,
    tone: 'blue',
    fillMode: 'transparent',
    shapeType: 'circle',
    shapeCustom: false,
    sides: 25,
    amplitude: 0
  };
  
  if (oldRootPerson && (oldRootPerson.avatar || oldRootPerson.imageUrl)) {
    youCircle.imageUrl = oldRootPerson.avatar || oldRootPerson.imageUrl;
  }
  
  circles.push(youCircle);

  // Map tags to circles
  const oldTags = oldGraph.tags || [];
  const tagCirclesMap = new Map();

  for (const tag of oldTags) {
    const tagPeople = oldPeople.filter(p => p.tag_id === tag.id && !p.is_root);
    let avgX = 0;
    let avgY = 0;
    if (tagPeople.length > 0) {
      avgX = Math.round(tagPeople.reduce((sum, p) => sum + p.x, 0) / tagPeople.length);
      avgY = Math.round(tagPeople.reduce((sum, p) => sum + p.y, 0) / tagPeople.length);
    } else {
      avgX = 150;
      avgY = 150;
    }

    const circleNode = {
      id: tag.id,
      name: tag.name,
      icon: makeInitials(tag.name),
      x: avgX,
      y: avgY,
      radius: 90,
      minRadius: 90,
      parentId: null,
      connectedTo: null,
      tone: 'blue',
      customColor: tag.color,
      fillMode: 'transparent',
      shapeType: 'circle',
      shapeCustom: false,
      sides: 25,
      amplitude: 0
    };
    circles.push(circleNode);
    tagCirclesMap.set(tag.id, circleNode);
  }

  // Map nodeGroups to circles
  const oldNodeGroups = oldGraph.nodeGroups || oldGraph.node_groups || [];
  const groupCirclesMap = new Map();

  for (const group of oldNodeGroups) {
    let groupName = group.id;
    if (groupName.startsWith('group-')) {
      groupName = groupName.replace(/^group-/, '');
    }
    groupName = groupName.charAt(0).toUpperCase() + groupName.slice(1);

    const memberIdsSet = new Set(group.memberIds || []);
    const groupPeople = oldPeople.filter(p => memberIdsSet.has(p.id) && !p.is_root);

    let avgX = 0;
    let avgY = 0;
    if (groupPeople.length > 0) {
      avgX = Math.round(groupPeople.reduce((sum, p) => sum + p.x, 0) / groupPeople.length);
      avgY = Math.round(groupPeople.reduce((sum, p) => sum + p.y, 0) / groupPeople.length);
    } else {
      avgX = 300;
      avgY = 300;
    }

    const circleNode = {
      id: group.id,
      name: groupName,
      icon: makeInitials(groupName),
      x: avgX,
      y: avgY,
      radius: 120,
      minRadius: 120,
      parentId: null,
      connectedTo: null,
      tone: 'blue',
      customColor: group.color,
      fillMode: 'transparent',
      shapeType: 'circle',
      shapeCustom: false,
      sides: 25,
      amplitude: 0
    };
    circles.push(circleNode);
    groupCirclesMap.set(group.id, circleNode);
  }

  // Map parent hierarchy
  for (const tag of oldTags) {
    const tagPeople = oldPeople.filter(p => p.tag_id === tag.id && !p.is_root);
    if (tagPeople.length === 0) continue;

    const groupCounts = {};
    for (const p of tagPeople) {
      for (const group of oldNodeGroups) {
        const memberIdsSet = new Set(group.memberIds || []);
        if (memberIdsSet.has(p.id)) {
          groupCounts[group.id] = (groupCounts[group.id] || 0) + 1;
        }
      }
    }

    let maxGroupId = null;
    let maxCount = 0;
    for (const [groupId, count] of Object.entries(groupCounts)) {
      if (count > maxCount) {
        maxCount = count;
        maxGroupId = groupId;
      }
    }

    if (maxGroupId) {
      const tagCircle = tagCirclesMap.get(tag.id);
      if (tagCircle) {
        tagCircle.parentId = maxGroupId;
      }
    }
  }

  // Map people
  const oldNotes = oldGraph.notes || [];
  for (const p of oldPeople) {
    if (p.is_root) continue;

    let circleId = '';
    if (p.tag_id && tagCirclesMap.has(p.tag_id)) {
      circleId = p.tag_id;
    } else {
      const group = oldNodeGroups.find(g => (g.memberIds || []).includes(p.id));
      if (group) {
        circleId = group.id;
      }
    }

    const personNotes = oldNotes
      .filter(n => n.person_id === p.id)
      .map(n => ({
        id: n.id,
        title: n.title || 'Note',
        body: n.body || ''
      }));

    people.push({
      id: p.id,
      name: p.name,
      role: p.role || '',
      x: p.x,
      y: p.y,
      circleId: circleId,
      avatar: makeInitials(p.name),
      imageUrl: p.imageUrl || p.avatar_url || p.avatarUrl || undefined,
      isFavorite: p.isFavorite || p.is_favorite || false,
      shapeType: 'circle',
      sides: 10,
      amplitude: 0,
      notes: personNotes,
      links: p.links || []
    });
  }

  // Map connections
  const oldConnections = oldGraph.connections || [];
  for (const conn of oldConnections) {
    let fromId = conn.person_a_id || conn.fromId;
    let toId = conn.person_b_id || conn.toId;

    if (fromId === oldRootPersonId) fromId = 'you';
    if (toId === oldRootPersonId) toId = 'you';

    connections.push({
      id: conn.id,
      fromId: fromId,
      toId: toId
    });
  }

  computeCirclePositionsAndRadii(circles, people);

  return {
    circles,
    people,
    connections
  };
}

// Locate old export file in Downloads
const downloadsDir = path.join(process.env.HOME || '', 'Downloads');

function findOldExport() {
  if (!fs.existsSync(downloadsDir)) return null;
  const files = fs.readdirSync(downloadsDir)
    .filter(f => f.startsWith('hackathon-board-') && f.endsWith('.json'))
    .map(f => {
      const fullPath = path.join(downloadsDir, f);
      const stat = fs.statSync(fullPath);
      return { path: fullPath, mtime: stat.mtimeMs };
    });
  
  if (files.length === 0) return null;
  files.sort((a, b) => b.mtime - a.mtime);
  return files[0].path;
}

function main() {
  const customInputPath = process.argv[2];
  let inputPath = '';

  if (customInputPath) {
    inputPath = path.resolve(customInputPath);
  } else {
    const found = findOldExport();
    if (!found) {
      console.error('ERROR: Could not find any file starting with "hackathon-board-" in your Downloads folder.');
      console.error('Please specify the file path explicitly:');
      console.error('  node scripts/migrate-board.mjs /path/to/old-export.json');
      process.exit(1);
    }
    inputPath = found;
  }

  console.log(`Reading old export file from: ${inputPath}...`);
  if (!fs.existsSync(inputPath)) {
    console.error(`ERROR: File does not exist: ${inputPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(inputPath, 'utf8');
  let oldGraph;
  try {
    oldGraph = JSON.parse(raw);
  } catch (e) {
    console.error('ERROR: Failed to parse JSON from export file.', e.message);
    process.exit(1);
  }

  console.log('Running migration to the new schema format...');
  const migratedGraph = migrate(oldGraph);

  // Write outputs
  const outputFileName = 'hackathon-board-migrated.json';
  const localOutputPath = path.join(process.cwd(), outputFileName);
  const downloadsOutputPath = path.join(downloadsDir, outputFileName);

  fs.writeFileSync(localOutputPath, JSON.stringify(migratedGraph, null, 2), 'utf8');
  console.log(`Saved migrated graph to project root: ${localOutputPath}`);

  try {
    fs.writeFileSync(downloadsOutputPath, JSON.stringify(migratedGraph, null, 2), 'utf8');
    console.log(`Saved migrated graph to Downloads: ${downloadsOutputPath}`);
  } catch (err) {
    // If downloads isn't writable for any reason, skip silently
  }

  console.log('\n---------------------------------');
  console.log('MIGRATION COMPLETED SUCCESSFULLY!');
  console.log('---------------------------------');
  console.log(`Total Circles:      ${migratedGraph.circles.length}`);
  console.log(`Total People:       ${migratedGraph.people.length}`);
  console.log(`Total Connections:  ${migratedGraph.connections.length}`);
  console.log('---------------------------------');
  console.log('\nHOW TO IMPORT YOUR CONVERTED DATA:');
  console.log('1. Open your browser and navigate to the application.');
  console.log('2. Open the browser Developer Console (F12 or Cmd+Option+I).');
  console.log('3. Copy the entire contents of the migrated file:');
  console.log(`   ${localOutputPath}`);
  console.log('4. Run the following command in the browser console, replacing <PASTE_JSON_HERE> with the copied contents:');
  console.log('   localStorage.setItem("hackathon-board:local-graph", JSON.stringify(<PASTE_JSON_HERE>));');
  console.log('5. Refresh the page. Your migrated board will load!');
  console.log('   (If you are logged in, the application will automatically save this imported local state to your Supabase cloud database.)');
}

main();
