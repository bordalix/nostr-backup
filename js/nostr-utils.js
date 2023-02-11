// from https://github.com/paulmillr/noble-secp256k1/blob/main/index.ts#L803
function hexToBytes(hex) {
  if (typeof hex !== 'string') {
    throw new TypeError('hexToBytes: expected string, got ' + typeof hex)
  }
  if (hex.length % 2)
    throw new Error('hexToBytes: received invalid unpadded hex' + hex.length)
  const array = new Uint8Array(hex.length / 2)
  for (let i = 0; i < array.length; i++) {
    const j = i * 2
    const hexByte = hex.slice(j, j + 2)
    const byte = Number.parseInt(hexByte, 16)
    if (Number.isNaN(byte) || byte < 0) throw new Error('Invalid byte sequence')
    array[i] = byte
  }
  return array
}

// decode nip19 ('npub') to hex
const npub2hexa = (npub) => {
  let { prefix, words } = bech32.bech32.decode(npub, 90)
  if (prefix === 'npub') {
    let data = new Uint8Array(bech32.bech32.fromWords(words))
    return buffer.Buffer.from(data).toString('hex')
  }
}

// encode hex to nip19 ('npub)
const hexa2npub = (hex) => {
  const data = hexToBytes(hex)
  const words = bech32.bech32.toWords(data)
  const prefix = 'npub'
  return bech32.bech32.encode(prefix, words, 90)
}

// parse inserted pubkey
const parsePubkey = (pubkey) =>
  pubkey.match('npub1') ? npub2hexa(pubkey) : pubkey

// download json file
const downloadFile = (data, fileName) => {
  const prettyJson = JSON.stringify(data, null, 2)
  const tempLink = document.createElement('a')
  const taBlob = new Blob([prettyJson], { type: 'application/json' })
  tempLink.setAttribute('href', URL.createObjectURL(taBlob))
  tempLink.setAttribute('download', fileName)
  tempLink.click()
}

// fetch events from relay, returns a promise
const fetchFromRelay = async (relay, pubkey, events) =>
  new Promise((resolve, reject) => {
    try {
      // prevent hanging forever
      setTimeout(() => reject('timeout'), 20_000)
      // open websocket
      const ws = new WebSocket(relay)
      // subscription id
      const subsId = 'my-sub'
      // subscribe to events filtered by author
      ws.onopen = () => {
        ws.send(JSON.stringify(['REQ', subsId, { authors: [pubkey] }]))
      }

      // Listen for messages
      ws.onmessage = (event) => {
        const [msgType, subscriptionId, data] = JSON.parse(event.data)
        // event messages
        if (msgType === 'EVENT' && subscriptionId === subsId) {
          const { id } = data
          // prevent duplicated events
          if (events[id]) return
          else events[id] = data
          // show how many events were found until this moment
          $('#events-found').text(`${Object.keys(events).length} events found`)
        }
        // end of subscription messages
        if (msgType === 'EOSE' && subscriptionId === subsId) resolve()
      }
      ws.onerror = (err) => reject(err)
    } catch (exception) {
      reject(exception)
    }
  })

// query relays for events published by this pubkey
const getEvents = async (pubkey) => {
  // events hash
  const events = {}
  // wait for all relays to finish
  await Promise.allSettled(
    relays.map((relay) => fetchFromRelay(relay, pubkey, events))
  )
  // return data as an array of events
  return Object.keys(events).map((id) => events[id])
}

// send events to a relay, returns a promisse
const sendToRelay = async (relay, data) =>
  new Promise((resolve, reject) => {
    try {
      // prevent hanging forever
      setTimeout(() => reject('timeout'), 20_000)
      const ws = new WebSocket(relay)
      // fetch events from relay
      ws.onopen = () => {
        for (evnt of data) {
          ws.send(JSON.stringify(['EVENT', evnt]))
        }
        ws.close()
        resolve(`done for ${relay}`)
      }
      ws.onerror = (err) => reject(err)
    } catch (exception) {
      reject(exception)
    }
  })

// broadcast events to list of relays
const broadcastEvents = async (data) => {
  await Promise.allSettled(relays.map((relay) => sendToRelay(relay, data)))
}
