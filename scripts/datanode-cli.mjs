#!/usr/bin/env node

import { addLink, addNote, createConnection, createPerson, getMeta, listCircles, search, importLinkedInPerson, deletePerson, deleteNote, deleteLink, deleteConnection } from './datanode-api-client.mjs'

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
  datanode people:delete <personId>
  datanode notes:delete <personId> <noteId>
  datanode links:delete <personId> <linkId>
  datanode connections:delete <connectionId>

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

  throw new Error(`Unknown command: ${command}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
