// button click handler
const fetchAndBackup = async () => {
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
    download: `Downloading javascript file... ${checkMark}`,
  }
  // parse pubkey ('npub' or hexa)
  const pubkey = parsePubkey($('#pubkey').val())
  if (!pubkey) return
  // disable button (will be re-enable at the end of the process)
  $('#fetch-and-backup').prop('disabled', true)
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
  const filter = { authors: [pubkey] }
  const data = await getEvents(filter)
  // inform user fetching is done
  $('#fetching-status').html(txt.fetching + checkMark)
  clearInterval(fetchInterval)
  $('#fetching-progress').val(20)
  // inform user that backup file (js format) is being downloaded
  $('#file-download').html(txt.download)
  downloadFile(data, 'nostr-backup.js')
  // re-enable backup button
  $('#fetch-and-backup').prop('disabled', false)
}

const getFromExtension = async () => {
  const pubkey = await window.nostr.getPublicKey()
  if (pubkey) $('#pubkey').val(pubkey).change()
}

const pubkeyOnChange = () => {
  $('#fetch-and-backup').css('display', '')
  $('#get-from-extension').css('display', 'none')
}

if (window.nostr) {
  $('#fetch-and-backup').css('display', 'none')
  $('#get-from-extension').css('display', '')
}
