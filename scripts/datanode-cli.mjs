#!/usr/bin/env node

import {
  addLink,
  addNote,
  batchOperations,
  createConnection,
  createPerson,
  getMeta,
  listCircles,
  search,
  importLinkedInPerson,
  deletePerson,
  deleteNote,
  deleteLink,
  deleteConnection,
  exportGraph,
  importGraph,
  clearGraph,
  createCircle,
  updateCircle,
  deleteCircle,
  uploadAvatar
} from './datanode-api-client.mjs'

function usage() {
  console.log(`Usage:
  datanode meta
  datanode search <query> [limit]
  datanode circles
  datanode people:add <circleId> <name> [note]
  datanode people:import-linkedin <url>
  datanode notes:add <personId> <body>
  datanode links:add <personId> <service> <url> [label]
  datanode connections:add <fromId> <toId>
  datanode operations:run <filePath>
  datanode people:delete <personId>
  datanode notes:delete <personId> <noteId>
  datanode links:delete <personId> <linkId>
  datanode connections:delete <connectionId>
  datanode graph:export
  datanode graph:import <filePath>
  datanode graph:clear
  datanode circles:add <name> [parentId] [connectedTo]
  datanode circles:update <circleId> <field> <value>
  datanode circles:delete <circleId>
  datanode avatars:upload <type> <id> <base64OrUrlOrFilePath>

Environment:
  DATANODE_API_URL=https://.../functions/v1/graph-api/v1
  DATANODE_API_TOKEN=dn_live_...`)
}

function getArg(index, name) {
  const value = process.argv[index]
  if (!value) throw new Error(`${name} is required.`)
  return value
}

async function main() {
  const command = process.argv[2]
  if (!command || command === 'help' || command === '--help') {
    usage()
    return
  }

  if (command === 'meta') {
    console.log(JSON.stringify(await getMeta(), null, 2))
    return
  }

  if (command === 'search') {
    console.log(JSON.stringify(await search(getArg(3, 'query'), Number(process.argv[4] ?? 10)), null, 2))
    return
  }

  if (command === 'circles') {
    console.log(JSON.stringify(await listCircles(), null, 2))
    return
  }

  if (command === 'people:add') {
    const meta = await getMeta()
    const circleId = getArg(3, 'circleId')
    const name = getArg(4, 'name')
    const note = process.argv[5]
    const payload = {
      expectedRevision: meta.revision,
      circleId,
      name,
      notes: note ? [{ body: note }] : [],
    }
    console.log(JSON.stringify(await createPerson(payload), null, 2))
    return
  }

  if (command === 'people:import-linkedin') {
    const meta = await getMeta()
    const url = getArg(3, 'url')
    const payload = {
      expectedRevision: meta.revision,
      url,
    }
    console.log(JSON.stringify(await importLinkedInPerson(payload), null, 2))
    return
  }

  if (command === 'notes:add') {
    const meta = await getMeta()
    console.log(JSON.stringify(await addNote(getArg(3, 'personId'), {
      expectedRevision: meta.revision,
      body: getArg(4, 'body'),
    }), null, 2))
    return
  }

  if (command === 'links:add') {
    const meta = await getMeta()
    console.log(JSON.stringify(await addLink(getArg(3, 'personId'), {
      expectedRevision: meta.revision,
      service: getArg(4, 'service'),
      url: getArg(5, 'url'),
      label: process.argv[6],
    }), null, 2))
    return
  }

  if (command === 'connections:add') {
    const meta = await getMeta()
    console.log(JSON.stringify(await createConnection({
      expectedRevision: meta.revision,
      fromId: getArg(3, 'fromId'),
      toId: getArg(4, 'toId'),
    }), null, 2))
    return
  }

  if (command === 'operations:run') {
    const filePath = getArg(3, 'filePath')
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const content = await fs.readFile(path.resolve(filePath), 'utf8')
    const payload = JSON.parse(content)
    const operations = Array.isArray(payload) ? payload : payload.operations
    if (!Array.isArray(operations) || operations.length === 0) {
      throw new Error('operations:run requires a JSON file containing an operations array.')
    }
    const meta = await getMeta()
    console.log(JSON.stringify(await batchOperations({
      expectedRevision: meta.revision,
      operations,
    }), null, 2))
    return
  }

  if (command === 'people:delete') {
    const meta = await getMeta()
    console.log(JSON.stringify(await deletePerson(getArg(3, 'personId'), {
      expectedRevision: meta.revision,
    }), null, 2))
    return
  }

  if (command === 'notes:delete') {
    const meta = await getMeta()
    console.log(JSON.stringify(await deleteNote(getArg(3, 'personId'), getArg(4, 'noteId'), {
      expectedRevision: meta.revision,
    }), null, 2))
    return
  }

  if (command === 'links:delete') {
    const meta = await getMeta()
    console.log(JSON.stringify(await deleteLink(getArg(3, 'personId'), getArg(4, 'linkId'), {
      expectedRevision: meta.revision,
    }), null, 2))
    return
  }

  if (command === 'connections:delete') {
    const meta = await getMeta()
    console.log(JSON.stringify(await deleteConnection(getArg(3, 'connectionId'), {
      expectedRevision: meta.revision,
    }), null, 2))
    return
  }

  if (command === 'graph:export') {
    console.log(JSON.stringify(await exportGraph(), null, 2))
    return
  }

  if (command === 'graph:import') {
    const filePath = getArg(3, 'filePath')
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const content = await fs.readFile(path.resolve(filePath), 'utf8')
    const graphData = JSON.parse(content)
    const graph = graphData.graph ? graphData.graph : graphData
    const meta = await getMeta()
    console.log(JSON.stringify(await importGraph({
      graph,
      expectedRevision: meta.revision,
    }), null, 2))
    return
  }

  if (command === 'graph:clear') {
    const meta = await getMeta()
    console.log(JSON.stringify(await clearGraph({
      expectedRevision: meta.revision,
    }), null, 2))
    return
  }

  if (command === 'circles:add') {
    const meta = await getMeta()
    const name = getArg(3, 'name')
    const parentId = process.argv[4] || null
    const connectedTo = process.argv[5] || null
    console.log(JSON.stringify(await createCircle({
      expectedRevision: meta.revision,
      name,
      parentId,
      connectedTo,
    }), null, 2))
    return
  }

  if (command === 'circles:update') {
    const meta = await getMeta()
    const circleId = getArg(3, 'circleId')
    const field = getArg(4, 'field')
    const value = getArg(5, 'value')
    let parsedValue = value
    if (value === 'true') parsedValue = true
    else if (value === 'false') parsedValue = false
    else if (!isNaN(Number(value))) parsedValue = Number(value)
    
    console.log(JSON.stringify(await updateCircle(circleId, {
      expectedRevision: meta.revision,
      [field]: parsedValue,
    }), null, 2))
    return
  }

  if (command === 'circles:delete') {
    const meta = await getMeta()
    console.log(JSON.stringify(await deleteCircle(getArg(3, 'circleId'), {
      expectedRevision: meta.revision,
    }), null, 2))
    return
  }

  if (command === 'avatars:upload') {
    const meta = await getMeta()
    const type = getArg(3, 'type')
    if (type !== 'person' && type !== 'circle') throw new Error('type must be person or circle')
    const id = getArg(4, 'id')
    const source = getArg(5, 'source')
    let base64OrUrl = source
    if (!source.startsWith('http://') && !source.startsWith('https://') && !source.startsWith('data:')) {
      const fs = await import('node:fs/promises')
      const path = await import('node:path')
      try {
        const fileBuffer = await fs.readFile(path.resolve(source))
        const ext = path.extname(source).toLowerCase().replace(/^\./, '') || 'png'
        const mime = ext === 'jpg' ? 'image/jpeg' : ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`
        base64OrUrl = `data:${mime};base64,${fileBuffer.toString('base64')}`
      } catch (err) {
        throw new Error(`Failed to read file ${source}: ${err.message}`)
      }
    }
    console.log(JSON.stringify(await uploadAvatar(type, id, base64OrUrl, meta.revision), null, 2))
    return
  }

  throw new Error(`Unknown command: ${command}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
