let events = {}
const subsId = 'my-sub'

// decode nip19 ('npub') to hex
const npub2hexa = (npub) => {
  let { prefix, words } = bech32.bech32.decode(npub, 90)
  if (prefix === 'npub') {
    let data = new Uint8Array(bech32.bech32.fromWords(words))
    return buffer.Buffer.from(data).toString('hex')
  }
}

// parse inserted pubkey
const parsePubkey = () => {
  const input = $('#pubkey').val()
  return input.match('npub1') ? npub2hexa(input) : input
}

// download json file
const downloadFile = (data) => {
  const prettyJson = JSON.stringify(data, null, 2)
  const tempLink = document.createElement('a')
  const taBlob = new Blob([prettyJson], { type: 'application/json' })
  tempLink.setAttribute('href', URL.createObjectURL(taBlob))
  tempLink.setAttribute('download', 'nostr-backup.json')
  tempLink.click()
}

// fetch events from relay, returns a promise
const fetchFromRelay = async (relay, pubkey) =>
  new Promise((resolve, reject) => {
    try {
      // prevent hanging forever
      setTimeout(() => reject('timeout'), 20_000)
      const ws = new WebSocket(relay)
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
  // wait for all relays to finish
  await Promise.allSettled(relays.map((relay) => fetchFromRelay(relay, pubkey)))
  // return data as an array of events
  return Object.keys(events).map((id) => events[id])
}

// button click handler
const fetchAndBackup = async () => {
  // reset hash of events
  events = {}
  // reset UI
  $('#fetching-status').html('')
  $('#fetching-progress').css('visibility', 'hidden')
  $('#fetching-progress').val(0)
  $('#file-download').html('')
  $('#events-found').text('')
  // messages to show to user
  const checkMark = '&#10003;'
  const txt = {
    fetching: 'Fetching from relays... ',
    download: `Downloading json file... ${checkMark}`,
  }
  // parse pubkey ('npub' or hexa)
  const pubkey = parsePubkey()
  if (!pubkey) return
  // disable button (will be re-enable at the end of the process)
  $('#backup').prop('disabled', true)
  // inform user that app is fetching from relays
  $('#fetching-status').html(txt.fetching)
  // show and update fetching progress bar
  $('#fetching-progress').css('visibility', 'visible')
  const fetchInterval = setInterval(() => {
    // update fetching progress bar
    const currValue = parseInt($('#fetching-progress').val())
    $('#fetching-progress').val(currValue + 1)
  }, 1_000)
  // get all events from relays
  const data = await getEvents(pubkey)
  // inform user fetching is done
  $('#fetching-status').html(txt.fetching + checkMark)
  clearInterval(fetchInterval)
  $('#fetching-progress').val(20)
  // inform user that backup file (json format) is being downloaded
  $('#file-download').html(txt.download)
  downloadFile(data)
  // re-enable backup button
  $('#backup').prop('disabled', false)
}
