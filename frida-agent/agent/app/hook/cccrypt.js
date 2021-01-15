const btoa = (buf, len) => {
  const data = ObjC.classes.NSData.initWithBytesNoCopy_length_(buf, len)
  const str = data.base64EncodedStringWithOptions_(0).toString();
  data.release()
  return str;
}

const CCOperation = ['kCCEncrypt', 'kCCDecrypt']
const CCAlgorithm = [
  { name: 'kCCAlgorithmAES128', blocksize: 16 },
  { name: 'kCCAlgorithmDES', blocksize: 8 },
  { name: 'kCCAlgorithm3DES', blocksize: 8 },
  { name: 'kCCAlgorithmCAST', blocksize: 8 },
  { name: 'kCCAlgorithmRC4', blocksize: 8 },
  { name: 'kCCAlgorithmRC2', blocksize: 8 }
]

const subject = 'crypto'
const now = () => (new Date()).getTime()

const handlers = {
  // CCCryptorStatus
  // CCCryptorCreate(CCOperation op, CCAlgorithm alg, CCOptions options,
  //     const void *key, size_t keyLength, const void *iv,
  //     CCCryptorRef *cryptorRef);

  CCCryptorCreate: {
    onEnter(args) {
      const op = args[0].toInt32()
      const alg = args[1].toInt32()
      // const options = args[2].toInt32()
      const key = args[3]
      const keyLength = args[4].toInt32()
      const iv = args[5]

      const strKey = btoa(key, keyLength)
      const strIV = iv === 0 ? 'null' : btoa(iv, CCAlgorithm[alg].blocksize)

      const time = now()
      const backtrace = Thread.backtrace(this.context, Backtracer.ACCURATE)
        .map(DebugSymbol.fromAddress).filter(e => e.name)

      let operation = CCOperation[op]
      if (operation === 'kCCEncrypt')
        operation = 'encrypt'
      else if (operation === 'kCCDecrypt')
        operation = 'decrypt'

      send({
        subject,
        func: 'CCCryptorCreate',
        event: operation,
        arguments: {
          operation,
          algorithm: CCAlgorithm[alg].name,
          key: strKey,
          iv: strIV
        },
        time,
        backtrace
      })
    }
  },

  // CCCryptorStatus
  // CCCrypt(CCOperation op, CCAlgorithm alg, CCOptions options,
  //     const void *key, size_t keyLength, const void *iv,
  //     const void *dataIn, size_t dataInLength, void *dataOut,
  //     size_t dataOutAvailable, size_t *dataOutMoved);

  CCCrypt: {
    onEnter(args) {
      const op = args[0].toInt32()
      const alg = args[1].toInt32()
      // const options = args[2].toInt32()
      const key = args[3]
      const keyLength = args[4].toInt32()
      const iv = args[5]
      const dataIn = args[6]
      const dataInLength = args[7].toInt32()
      const dataOut = args[8]
      const dataOutAvailable = args[9]
      const dataOutMoved = args[10]

      this.dataOut = dataOut
      this.dataOutAvailable = dataOutAvailable
      this.dataOutMoved = dataOutMoved

      const strKey = btoa(key, keyLength)
      const strIV = iv === 0 ? 'null' : btoa(iv, CCAlgorithm[alg].blocksize)

      const strDataIn = btoa(dataIn, dataInLength)

      const time = now()
      const backtrace = Thread.backtrace(this.context, Backtracer.ACCURATE)
        .map(DebugSymbol.fromAddress).filter(e => e.name)

      let operation = CCOperation[op]
      if (operation === 'kCCEncrypt')
        operation = 'encrypt'
      else if (operation === 'kCCDecrypt')
        operation = 'decrypt'

      this.operation = operation
      send({
        subject,
        event: operation,
        arguments: {
          operation,
          algorithm: CCAlgorithm[alg].name,
          key: strKey,
          iv: strIV,
          in: strDataIn
        },
        time,
        backtrace
      })
    },
    onLeave(retVal) {
      if (retVal.toInt32() !== 0)
        return

      const time = now()
      const { dataOut, dataOutMoved, operation } = this
      const len = Memory.readUInt(dataOutMoved)
      const strDataOut = btoa(dataOut, len)

      send({
        subject,
        event: operation,
        arguments: {
          out: strDataOut
        },
        time
      })
    }
  }
}


let hooks = []
export default function toggle(on) {
  if (on && !hooks.length) {
    for (const func in handlers) {
      if (({}).hasOwnProperty.call(handlers, func))
        hooks.push(Interceptor.attach(Module.findExportByName(null, func), handlers[func]))
    }
  }

  if (!on && hooks.length) {
    hooks.forEach(hook => hook.detach())
    hooks = []
  }
}
