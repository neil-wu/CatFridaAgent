import { arrayFromNSArray, toJSON } from './lib/nsdict'
import uuidv4 from './lib/uuid'
import { open } from './lib/libc'
import { getDataAttrForPath } from './lib/foundation'

const { NSFileManager, NSProcessInfo, NSDictionary, NSBundle } = ObjC.classes

const fileManager = NSFileManager.defaultManager()


export function lsAppBundle() {
  const path = NSBundle.mainBundle().bundlePath().toString();
  return ls(path);
}

export function lsAppData() {
  const path = NSProcessInfo.processInfo().environment().objectForKey_('HOME').toString();
  return ls(path);
}
export function appBundlePath() {
  const path = NSBundle.mainBundle().bundlePath().toString();
  return path;
}

export function appDataPath() {
  const path = NSProcessInfo.processInfo().environment().objectForKey_('HOME').toString();
  return path;
}

// neilwu modify this function to ls more files on jailbreak device
export function ls(cwd) {
  const pErr = Memory.alloc(Process.pointerSize)
  Memory.writePointer(pErr, NULL)
  const nsArray = fileManager.contentsOfDirectoryAtPath_error_(cwd, pErr)
  const err = Memory.readPointer(pErr)

  if (!err.isNull()) {
    const description = new ObjC.Object(err).localizedDescription();
    throw new Error(description)
  }

  if (!nsArray) {
    return { cwd, list: [] }
  }
  const isDir = Memory.alloc(Process.pointerSize)
  const list = arrayFromNSArray(nsArray, 100).map((filename) => {
    const fullPath = [cwd, filename].join('/')
    fileManager.fileExistsAtPath_isDirectory_(fullPath, isDir)

    return {
      /* eslint eqeqeq:0 */
      type: Memory.readPointer(isDir) == 0 ? 'file' : 'directory',
      name: filename,
      path: fullPath,
      attribute: getDataAttrForPath(fullPath) || {}
    }
  })

  return { cwd, list }
}


export function plist(path) {
  const info = NSDictionary.dictionaryWithContentsOfFile_(path)
  if (info === null)
    throw new Error(`malformed plist file: ${path}`)
  return toJSON(info)
}

export function text(path) {
  const name = Memory.allocUtf8String(path)
  const size = 10 * 1024 // max read size: 10k

  return new Promise((resolve, reject) => {
    const fd = open(name, 0, 0)
    if (fd === -1)
      reject(new Error(`unable to open file ${path}`))

    const stream = new UnixInputStream(fd, { autoClose: true })
    stream.read(size).then(resolve).catch(reject)
  })
}


export function download(path) {
  const session = uuidv4()
  const name = Memory.allocUtf8String(path)
  const watermark = 10 * 1024 * 1024
  const subject = 'download'
  const { size } = getDataAttrForPath(path)

  const fd = open(name, 0, 0)
  if (fd === -1)
    throw new Error(`unable to open file ${path}`)

  const stream = new UnixInputStream(fd, { autoClose: true })
  const read = () => {
    stream.read(watermark).then((buffer) => {
      send({
        subject,
        event: 'data',
        session
      }, buffer)

      if (buffer.byteLength === watermark) {
        setImmediate(read)
      } else {
        send({
          subject,
          event: 'end',
          session
        })
      }
    }).catch((error) => {
      send({
        subject,
        event: 'error',
        session,
        error: error.message
      })
    })
  }
  send({
    subject,
    event: 'start',
    session
  })
  setImmediate(read)
  return {
    size,
    session
  }
}
